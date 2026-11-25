import fs from 'node:fs';
import path from 'node:path';
import { projectFileURL, audioFileProblem, expectedNarrations, expectedLocalClips } from './verify_files.mjs';

const results = [];
const errors = [];
const networkRequests = [];

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    throw new Error('Playwright is not installed locally. From the skill repository root run: npm install && npx playwright install chromium', { cause: e });
  }
}

async function setupPage(browser, label, options) {
  const context = await browser.newContext(options);
  // Do not let missing local files silently fall back to network resources.
  await context.route(/^https?:\/\//i, async route => {
    networkRequests.push(`${label}: ${route.request().url()}`);
    await route.abort();
  });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`${label} console.error: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${label} pageerror: ${e.message}`));
  // Observe actual MP3 playback rather than treating the speech-synthesis fallback as proof.
  await page.addInitScript(() => {
    window.__qaMedia = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      const src = this.currentSrc || this.src;
      this.addEventListener('playing', () => window.__qaMedia.push({ event: 'playing', src }), { once: true });
      this.addEventListener('error', () => window.__qaMedia.push({ event: 'error', src }), { once: true });
      return originalPlay.apply(this, args);
    };
  });
  return page;
}

async function waitForCondition(page, predicate, arg, timeout = 5000) {
  try {
    await page.waitForFunction(predicate, arg, { timeout });
    return true;
  } catch (e) {
    if (e.name !== 'TimeoutError') throw e;
    return false;
  }
}

async function playedLocalClip(page, ref) {
  const expected = new URL(ref, page.url()).href;
  return waitForCondition(page, src => window.__qaMedia.some(e => e.event === 'playing' && e.src === src), expected);
}

function check(name, ok, detail = '') {
  results.push([name, Boolean(ok), detail]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' | ' + detail : ''));
}

async function checkVisibleImgs(page) {
  return await page.evaluate(() => {
    const broken = [];
    for (const el of document.querySelectorAll('img')) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      if (!el.complete || el.naturalWidth === 0) broken.push(el.getAttribute('src'));
    }
    return broken;
  });
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/verify_app.mjs [PROJECT_DIR]\nOptional: CHROMIUM_EXECUTABLE_PATH=/path/to/chromium (otherwise Playwright-managed Chromium)');
    return;
  }
  if (process.argv.length > 3 || process.argv[2]?.startsWith('--')) throw new Error('Expected one project directory. Use --help.');
  const ROOT = path.resolve(process.argv[2] || '.');
  const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lesson_data.json'), 'utf-8'));
  const FILE_URL = projectFileURL(ROOT);
  const expectedClips = expectedNarrations(DATA);
  const requiredClips = expectedLocalClips(DATA, expectedClips);
  const preflightProblems = [...new Set(requiredClips)].map(rel => audioFileProblem(ROOT, rel)).filter(Boolean);
  check('narration and vocabulary MP3 preflight', expectedClips.length > 0 && preflightProblems.length === 0, JSON.stringify(preflightProblems));
  if (!expectedClips.length || preflightProblems.length) throw new Error('Missing or invalid narration/vocabulary audio. Run generate_audio.py first.');
  const { chromium } = await loadPlaywright();
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
    .catch(e => { throw new Error(`Chromium launch failed: ${e.message}\nRun npx playwright install chromium (Linux: npx playwright install --with-deps chromium), or set CHROMIUM_EXECUTABLE_PATH to an installed compatible Chromium/Chrome executable.`, { cause: e }); });
  console.log(`QA: ${process.platform} / Node ${process.version} / Chromium ${browser.version()} / ${executablePath ? 'explicit executable' : 'Playwright-managed browser'}`);
  try {
    const page = await setupPage(browser, 'desktop', { viewport: { width: 1440, height: 900 } });
    await page.goto(FILE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const parity = await page.evaluate(() => {
      const diffs = [];
      const t = window.AUDIO_TIMINGS || {};
      document.querySelectorAll('[data-play]').forEach(btn => {
        const key = btn.dataset.play;
        const container = btn.closest('.warm-card')?.querySelector('.warm-en') || btn.closest('.para')?.querySelector('.para-en');
        const domCount = container ? container.querySelectorAll('.rw').length : -1;
        const timingCount = Array.isArray(t[key]) ? t[key].length : -1;
        if (domCount !== timingCount || timingCount <= 0) diffs.push({ key, domCount, timingCount });
      });
      const missingWords = [];
      const wmap = window.WORD_AUDIO_MAP || {};
      document.querySelectorAll('button.rw[data-speak-word]').forEach(b => {
        const k = b.dataset.speakWord.trim().toLowerCase();
        if (!wmap[k]) missingWords.push(k);
      });
      return { diffs, missingWords, clipKeys: Array.from(document.querySelectorAll('[data-play]'), b => b.dataset.play), wordPaths: Object.values(wmap) };
    });
    check('word-timing parity across all clips', expectedClips.length > 0 && parity.diffs.length === 0 && parity.clipKeys.length === expectedClips.length && expectedClips.every(k => parity.clipKeys.includes(k)), JSON.stringify(parity.diffs));
    check('100% tap-to-read words mapped to Edge TTS MP3', parity.missingWords.length === 0, JSON.stringify(parity.missingWords));
    const clipPaths = parity.wordPaths;
    const audioProblems = [...new Set(clipPaths)].map(rel => audioFileProblem(ROOT, rel)).filter(Boolean);
    check('all mapped word MP3s are non-empty local files', audioProblems.length === 0, JSON.stringify(audioProblems));
    if (!expectedClips.length || audioProblems.length || parity.diffs.length || parity.missingWords.length || parity.clipKeys.length !== expectedClips.length || !expectedClips.every(k => parity.clipKeys.includes(k))) {
      throw new Error('Audio/lesson preflight failed. Regenerate missing assets or correct timings before browser interactions.');
    }

    const totalParas = DATA.sections.reduce((acc, s) => acc + s.paras.length, 0);
    const totalStamps = 1 + DATA.missions.figQuiz.length + DATA.missions.trueFalse.length + 1;

    check('warmup cards count', await page.locator('.warm-card').count() === DATA.warmup.length);
    const brokenP1 = await checkVisibleImgs(page);
    check('page 1 images load', brokenP1.length === 0, JSON.stringify(brokenP1));
    await page.screenshot({ path: path.join(ROOT, 'assets/qa-home.png'), fullPage: false });

    await page.locator(`[data-toggle-cn="${DATA.warmup[0].id}"]`).click();
    check('Chinese aid toggles', await page.locator(`#cn-${DATA.warmup[0].id}`).isVisible());
    await page.locator('.font-control [data-font="lg"]').click();
    check('font size lg active', await page.evaluate(() => document.body.dataset.font === 'lg'));
    await page.locator('.font-control [data-font="md"]').click();
    await page.locator('[data-speed="1.2"]').click();
    check('speed switch', (await page.locator('[data-speed="1.2"]').getAttribute('class') || '').includes('active'));
    await page.locator('[data-speed="0.9"]').click();

    // Page 2: Scenes
    await page.locator('.nb-tab[data-page="scenes"]').click();
    await page.waitForTimeout(350);
    check('scene cards count', await page.locator('.scene-card').count() === DATA.scenes.length);
    check('word bubbles count', await page.locator('.word-bubble').count() === DATA.vocab.length);
    const brokenP2 = await checkVisibleImgs(page);
    check('page 2 images load', brokenP2.length === 0, JSON.stringify(brokenP2));
    await page.screenshot({ path: path.join(ROOT, 'assets/qa-scenes.png'), fullPage: false });

    for (let i = 0; i < DATA.vocab.length; i++) await page.locator('.word-bubble').nth(i).click();
    await page.waitForTimeout(250);
    check('mastered meter full', (await page.locator('#masteredCount').innerText()) === String(DATA.vocab.length));
    check('gate CTA visible', await page.locator('#gateCta').isVisible());

    // Page 3: Reader & Missions
    await page.locator('#gateCta').click();
    await page.waitForTimeout(400);
    check('page 3 active', (await page.locator('#page-reader').getAttribute('class') || '').includes('active'));
    check('paper sections count', await page.locator('.paper-section').count() === DATA.sections.length);
    check('paper paragraphs count', await page.locator('.para').count() === totalParas);
    const brokenP3 = await checkVisibleImgs(page);
    check('page 3 images load', brokenP3.length === 0, JSON.stringify(brokenP3));

    const firstPlay = page.locator('.para-play-btn').first();
    await firstPlay.click();
    const narrationPlayed = await playedLocalClip(page, `assets/audio/${await firstPlay.getAttribute('data-play')}.mp3`);
    const highlighted = await waitForCondition(page, () => Boolean(document.querySelector('.para-play-btn.playing') && document.querySelector('.para .rw.rw-active')));
    check('read-along highlights active word while local MP3 plays', narrationPlayed && highlighted);
    const wasPlaying = (await firstPlay.getAttribute('class') || '').includes('playing');
    if (wasPlaying) await firstPlay.click();
    await page.waitForTimeout(150);
    check('stop playback clears highlight', wasPlaying && (await page.locator('.para .rw.rw-active').count()) === 0);

    const ordinaryWord = page.locator('.para-en button.rw[data-speak-word]').first();
    const word = (await ordinaryWord.getAttribute('data-speak-word')).trim().toLowerCase();
    const wordPath = await page.evaluate(k => window.WORD_AUDIO_MAP[k], word);
    await page.evaluate(() => { window.__qaMedia = []; });
    await ordinaryWord.click();
    check('tap ordinary word plays mapped local MP3', await playedLocalClip(page, wordPath));

    const firstTerm = page.locator('.para-en .term').first();
    const termId = await firstTerm.getAttribute('data-term');
    await page.evaluate(() => { window.__qaMedia = []; });
    await firstTerm.click();
    check('highlighted term auto-plays local vocabulary MP3', await playedLocalClip(page, `assets/audio/vocab_${termId.replace(/ /g, '_')}.mp3`));
    await page.waitForTimeout(250);
    check('term popup opens', await page.locator('#termPop').isVisible());
    const popInspect = await page.evaluate(() => {
      const pop = document.querySelector('#termPop');
      const hasEmoji = /[🔊💡📌▶📖]/.test(pop.innerText);
      const svgCount = pop.querySelectorAll('svg.ui-svg, img.ui-svg').length;
      const imgsOk = Array.from(pop.querySelectorAll('img')).every(i => i.complete && i.naturalWidth > 0);
      return { hasEmoji, svgCount, imgsOk, speakBtnPlaying: pop.querySelector('[data-speak-term]')?.classList.contains('playing') };
    });
    check('term popup uses pure SVG icons', !popInspect.hasEmoji && popInspect.svgCount >= 3 && popInspect.imgsOk, JSON.stringify(popInspect));
    await page.locator('#termPop [data-nb]').click();
    check('notebook count updates', (await page.locator('#notebookCount').innerText()) === '1');
    await page.keyboard.press('Escape');

    // Missions 1..4
    for (let i = 0; i < DATA.missions.order.length; i++) await page.locator(`.order-option[data-step="${i}"]`).click();
    check('M1 star awarded', (await page.locator('#m1Feedback').innerText()).includes('顺序完全正确'));

    await page.locator('[data-mission="m2"]').click();
    for (const q of DATA.missions.figQuiz) {
      await page.locator(`.quiz-card[data-q="${q.id}"] .quiz-option[data-opt="${q.answer}"]`).click();
    }
    await page.screenshot({ path: path.join(ROOT, 'assets/qa-reader.png'), fullPage: false });

    await page.locator('[data-mission="m3"]').click();
    for (const t of DATA.missions.trueFalse) {
      await page.locator(`.tf-card[data-tf="${t.id}"] .tf-btn[data-val="${t.answer ? 'true' : 'false'}"]`).click();
    }

    await page.locator('[data-mission="m4"]').click();
    for (let i = 0; i < DATA.missions.feynman.length; i++) await page.locator(`#feynmanList input[data-fq="${i}"]`).check();
    check('all mission stamps awarded', (await page.locator('#starCount').innerText()) === String(totalStamps));
    await page.locator('#badgeBtn').click();
    check('badge card opens', await page.locator('#badgeCard').isVisible());
    await page.locator('#badgeClose').click();

    // This is a Chromium touch/viewport simulation, NOT an iPadOS/Safari test.
    const tablet = await setupPage(browser, 'tablet simulation', { viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1, hasTouch: true });
    await tablet.goto(FILE_URL, { waitUntil: 'load' });
    await tablet.waitForTimeout(450);
    await tablet.screenshot({ path: path.join(ROOT, 'assets/qa-ipad.png'), fullPage: false });
    const tabletBroken = await checkVisibleImgs(tablet);
    check('tablet simulation: warmup visible and images load', await tablet.locator('#page-warmup').isVisible() && tabletBroken.length === 0, JSON.stringify(tabletBroken));
    await tablet.locator('.nb-tab[data-page="scenes"]').tap();
    await tablet.waitForTimeout(350);
    const tabletSceneBroken = await checkVisibleImgs(tablet);
    check('tablet simulation: scene navigation and images load', await tablet.locator('#page-scenes').isVisible() && tabletSceneBroken.length === 0, JSON.stringify(tabletSceneBroken));
    await tablet.locator('.word-bubble').first().tap();
    check('tablet simulation: vocabulary tap updates progress', (await tablet.locator('#masteredCount').innerText()) === '1');
    await tablet.locator('#skipWords').tap();
    await tablet.waitForTimeout(400);
    const tabletReaderBroken = await checkVisibleImgs(tablet);
    check('tablet simulation: reader navigation and images load', await tablet.locator('#page-reader').isVisible() && tabletReaderBroken.length === 0, JSON.stringify(tabletReaderBroken));
    await tablet.screenshot({ path: path.join(ROOT, 'assets/qa-tablet-reader.png'), fullPage: false });
    console.log('NOTE: qa-ipad.png and qa-tablet-reader.png show a simulated Chromium viewport, not physical iPad or Safari evidence.');
    check('no external HTTP(S) requests (desktop and tablet)', networkRequests.length === 0, JSON.stringify(networkRequests));
    check('no console/page errors (desktop and tablet)', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (e) {
  check('verification completed', false, e.message);
}
if (results.length) {
  const passed = results.filter(r => r[1]).length;
  console.log(`\nSUMMARY ${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
