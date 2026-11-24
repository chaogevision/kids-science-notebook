import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/Apple/.nvm/versions/node/v22.22.0/lib/node_modules/playwright');

const ROOT = path.resolve(process.argv[2] || '.');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lesson_data.json'), 'utf-8'));
const URL = 'file://' + path.join(ROOT, 'index.html');
const results = [];

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

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
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
  return { diffs, missingWords };
});
check('word-timing parity across all clips', parity.diffs.length === 0, JSON.stringify(parity.diffs));
check('100% tap-to-read words mapped to Edge TTS MP3', parity.missingWords.length === 0, JSON.stringify(parity.missingWords));

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
await page.waitForTimeout(850);
const playingInfo = await page.evaluate(() => {
  const btn = document.querySelector('.para-play-btn');
  const activeWord = document.querySelector('.para .rw.rw-active');
  return { btnPlaying: btn.classList.contains('playing'), activeWord: activeWord?.textContent || null };
});
check('read-along highlights active word', playingInfo.btnPlaying && Boolean(playingInfo.activeWord), JSON.stringify(playingInfo));
await firstPlay.click();
await page.waitForTimeout(150);
check('stop playback clears highlight', (await page.locator('.para .rw.rw-active').count()) === 0);

await page.locator('.para-en button.rw[data-speak-word]').first().click();
await page.waitForTimeout(100);
check('tap ordinary word activates speaking state', await page.evaluate(() => Boolean(document.querySelector('.para-en button.rw.rw-speaking'))));

await page.locator('.para-en .term').first().click();
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

const ipad = await browser.newPage({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1 });
await ipad.goto(URL, { waitUntil: 'load' });
await ipad.waitForTimeout(450);
await ipad.screenshot({ path: path.join(ROOT, 'assets/qa-ipad.png'), fullPage: false });

check('no console/page errors', errors.length === 0, JSON.stringify(errors.slice(0, 5)));
await browser.close();

const passed = results.filter(r => r[1]).length;
console.log(`\nSUMMARY ${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
