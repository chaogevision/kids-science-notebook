/* ============================================================
   SCIENCE DETECTIVE · SCHEME B (Storybook Science Notebook)
   Universal offline interactive template driven by window.LESSON_DATA
   ============================================================ */
(function () {
  "use strict";
  const D = window.LESSON_DATA || {};
  const M = D.meta || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const slug = String(M.title || "default").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32);
  const KEY = "science_notebook_b_" + slug;
  const SAVE = Object.assign({
    mastered: [],
    notebook: [],
    stars: {},
    speed: 0.9,
    font: "md",
    feynman: [],
    warmHeard: [],
    page: "warmup"
  }, load());

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch (e) { /* file:// private mode */ }
  }
  const inSet = (arr, v) => Array.prototype.includes.call(arr || [], v);
  const addOnce = (arr, v) => { if (!inSet(arr, v)) arr.push(v); };
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------------- hydrate dynamic meta ---------------- */
  function hydrateMeta() {
    const brandCn = M.brandCn || "科学侦探手账";
    const brandEn = M.brandEn || "Science Detective";
    document.title = brandCn + " · " + brandEn;
    $("#brandCn").textContent = brandCn;
    $("#brandEn").textContent = brandEn;
    if (M.eyebrow) $("#heroEyebrow").textContent = M.eyebrow;
    if (M.titleCn) {
      const htmlTitle = esc(M.titleCn)
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
        .replace(/\[\[hl\|([^\]]+)\]\]/g, '<span class="hl-underline">$1</span>');
      $("#heroTitle").innerHTML = htmlTitle;
    }
    if (M.subtitleCn) $("#heroSub").textContent = M.subtitleCn;
    if (M.heroCover) $("#heroCoverImg").src = M.heroCover;
    if (M.heroCoverAlt) $("#heroCoverImg").alt = M.heroCoverAlt;
    if (M.heroSticker) $("#heroSticker").textContent = M.heroSticker;
    if (M.heroPeekFigureId) {
      const btn = $("#heroPeekBtn");
      btn.dataset.zoom = M.heroPeekFigureId;
      if (M.heroPeekLabel) btn.textContent = M.heroPeekLabel;
      btn.classList.remove("hidden");
    }
    if (M.footerSource) $("#footerSource").textContent = M.footerSource;
    else if (M.source || M.paperSource) {
      $("#footerSource").textContent = "原文来源：" + (M.source || "Science Journal For Kids") + (M.paperSource ? " · 研究论文：" + M.paperSource : "");
    }
    if (M.footerNote) $("#footerNote").textContent = M.footerNote;
    if (M.certificateHeading) $("#certHeading").textContent = M.certificateHeading;
    if (M.certificateCourse) $("#certName").textContent = "我已完成" + M.certificateCourse + "的全套绘本阅读与破案挑战！";

    const vLen = (D.vocab || []).length || 10;
    $("#vocabGoalHeader").textContent = vLen;
    $("#vocabTotalCount").textContent = vLen;
    $("#remainingCount").textContent = vLen;
  }

  /* ---------------- page navigation (3 storybook tabs) ---------------- */
  let currentPage = "warmup";
  function setPage(pageId, scrollTop = true) {
    if (!$("#page-" + pageId)) return;
    currentPage = pageId;
    SAVE.page = pageId;
    save();
    $$(".page-panel").forEach(p => p.classList.toggle("active", p.id === "page-" + pageId));
    $$(".nb-tab").forEach(t => t.classList.toggle("active", t.dataset.page === pageId));
    $("#termPop").classList.add("hidden");
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- SVG icons & audio + read-along sync ---------------- */
  const TIMINGS = window.AUDIO_TIMINGS || {};
  const WORD_AUDIO = window.WORD_AUDIO_MAP || {};
  const SVG_SPEAKER = '<svg class="ui-svg speaker-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 9.5h3.8l4.7-4v13l-4.7-4H4.5a1.2 1.2 0 01-1.2-1.2v-2.6a1.2 1.2 0 011.2-1.2z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16.2 8.8a4.5 4.5 0 010 6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.9 6.2a8 8 0 010 11.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/></svg>';
  const SVG_PLAY = '<svg class="ui-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 5.8c0-1 1.1-1.6 2-1.1l9.5 5.7c.9.5.9 1.8 0 2.3l-9.5 5.7c-.9.5-2-.1-2-1.1V5.8z" fill="currentColor"/></svg>';
  const SVG_STOP = '<svg class="ui-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/></svg>';
  const SVG_BOOK = '<svg class="ui-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6.5c-2.8-1.8-6-1.8-8-.8v12c2-1 5.2-1 8 .8 2.8-1.8 6-1.8 8-.8v-12c-2-1-5.2-1-8 .8z" fill="#FFFDF8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6.5v12" stroke="currentColor" stroke-width="1.6"/></svg>';

  let voices = [];
  function refreshVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
  refreshVoices();
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = refreshVoices;

  function pickVoice() {
    const want = ["aria", "ana", "samantha", "zira", "google us english", "jenny"];
    for (const name of want) {
      const v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en-us") && v.name.toLowerCase().includes(name));
      if (v) return v;
    }
    return voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en")) || null;
  }

  let activeAudio = null;
  let activePlayBtn = null;
  let activeTermEl = null;
  let syncRaf = 0;
  let activeWordEl = null;

  function clearWordHighlights() {
    if (syncRaf) { cancelAnimationFrame(syncRaf); syncRaf = 0; }
    if (activeWordEl) { activeWordEl.classList.remove("rw-active"); activeWordEl = null; }
    $$(".rw.rw-active, .rw.rw-speaking").forEach(el => el.classList.remove("rw-active", "rw-speaking"));
    $$(".term.term-speaking").forEach(el => el.classList.remove("term-speaking"));
  }
  function setPlayBtnLabel(btn, playing) {
    if (!btn) return;
    if (btn.classList.contains("play-btn") || btn.classList.contains("para-play-btn")) {
      if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.innerHTML;
      btn.innerHTML = playing ? (SVG_STOP + " 停止朗读") : btn.dataset.idleLabel;
    }
  }
  function stopAudio() {
    if (activeAudio) { try { activeAudio.pause(); } catch (e) {} activeAudio = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (activePlayBtn) { setPlayBtnLabel(activePlayBtn, false); activePlayBtn = null; }
    activeTermEl = null;
    $$(".play-btn.playing, .para-play-btn.playing, .word-bubble.speaking, [data-speak-term].playing, [data-nb-speak].playing")
      .forEach(b => b.classList.remove("playing", "speaking"));
    clearWordHighlights();
  }
  function getNarrationContainer(btn) {
    if (!btn) return null;
    const warm = btn.closest(".warm-card");
    if (warm) return $(".warm-en", warm);
    const para = btn.closest(".para");
    if (para) return $(".para-en", para);
    return null;
  }
  function setActiveWord(container, wi) {
    if (!container) return;
    const next = wi >= 0 ? container.querySelector(`.rw[data-wi="${wi}"]`) : null;
    if (next === activeWordEl) return;
    if (activeWordEl) activeWordEl.classList.remove("rw-active");
    activeWordEl = next;
    if (activeWordEl) activeWordEl.classList.add("rw-active");
  }
  function startTimingSync(audio, key, container) {
    const slots = TIMINGS[key];
    if (!slots || !container) return;
    const tick = () => {
      if (activeAudio !== audio || audio.paused || audio.ended) return;
      const t = audio.currentTime;
      let hit = -1;
      for (let i = 0; i < slots.length; i++) {
        if (t >= slots[i][0] - 0.04 && t <= slots[i][1] + 0.05) { hit = i; break; }
      }
      if (hit === -1 && slots.length && t > slots[0][0]) {
        for (let i = slots.length - 1; i >= 0; i--) {
          if (t >= slots[i][0]) {
            if (t - slots[i][1] < 0.35) hit = i;
            break;
          }
        }
      }
      setActiveWord(container, hit);
      syncRaf = requestAnimationFrame(tick);
    };
    syncRaf = requestAnimationFrame(tick);
  }
  function speakFallback(text, btn, container, termEl) {
    if (!window.speechSynthesis) { toast("当前浏览器不支持语音朗读"); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = SAVE.speed; u.pitch = 1;
    const v = pickVoice(); if (v) u.voice = v;

    let offsets = [];
    if (container) {
      const rwEls = $$(".rw", container);
      let cursor = 0;
      rwEls.forEach(el => {
        const idx = text.indexOf(el.textContent, cursor);
        if (idx >= 0) {
          offsets.push({ start: idx, end: idx + el.textContent.length, wi: +el.dataset.wi });
          cursor = idx + el.textContent.length;
        }
      });
    }

    u.onstart = () => {
      if (btn) {
        btn.classList.add(btn.classList.contains("word-bubble") ? "speaking" : "playing");
        setPlayBtnLabel(btn, true);
        activePlayBtn = btn;
      }
      if (termEl) termEl.classList.add("term-speaking");
    };
    u.onboundary = (e) => {
      if (!container || e.name !== "word") return;
      const hit = offsets.find(o => e.charIndex >= o.start - 1 && e.charIndex < o.end + 1)
        || offsets.filter(o => o.start <= e.charIndex).pop();
      if (hit) setActiveWord(container, hit.wi);
    };
    u.onend = u.onerror = () => {
      if (btn) {
        btn.classList.remove("playing", "speaking", "rw-speaking");
        setPlayBtnLabel(btn, false);
        if (activePlayBtn === btn) activePlayBtn = null;
      }
      if (termEl) termEl.classList.remove("term-speaking");
      clearWordHighlights();
    };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function play(key, text, btn, termEl, srcOverride) {
    if (btn && activePlayBtn === btn && (btn.classList.contains("play-btn") || btn.classList.contains("para-play-btn"))) {
      stopAudio();
      return;
    }
    stopAudio();
    if (key && key.startsWith("warm_")) {
      addOnce(SAVE.warmHeard, key);
      save();
      refreshTabChecks();
    }
    const container = getNarrationContainer(btn);
    const src = srcOverride || ("assets/audio/" + key + ".mp3");
    const a = new Audio();
    a.preload = "auto";
    a.src = src;
    a.playbackRate = Math.max(.5, Math.min(2, SAVE.speed / 0.9));
    activeAudio = a;
    activePlayBtn = btn || null;
    activeTermEl = termEl || null;
    a.onplaying = () => {
      if (btn) {
        btn.classList.add(btn.classList.contains("word-bubble") ? "speaking" : (btn.classList.contains("rw") ? "rw-speaking" : "playing"));
        setPlayBtnLabel(btn, true);
      }
      if (termEl) termEl.classList.add("term-speaking");
      if (key) startTimingSync(a, key, container);
    };
    a.onended = a.onerror = () => {
      if (activeAudio !== a) return;
      if (btn) {
        btn.classList.remove("playing", "speaking", "rw-speaking");
        setPlayBtnLabel(btn, false);
      }
      if (termEl) termEl.classList.remove("term-speaking");
      activePlayBtn = null;
      activeTermEl = null;
      clearWordHighlights();
      if (a.error || !a.duration) speakFallback(text, btn, container, termEl);
    };
    const p = a.play();
    if (p && p.catch) p.catch(() => {
      if (activeAudio === a) activeAudio = null;
      speakFallback(text, btn, container, termEl);
    });
  }
  const audioKey = (word) => "vocab_" + word.replace(/\s+/g, "_");

  function speakSingleWord(word, el) {
    const clean = word.trim();
    const low = clean.toLowerCase();
    const wordSrc = WORD_AUDIO[low];
    if (wordSrc) {
      play(null, clean, el, null, wordSrc);
      if (el) el.classList.add("rw-speaking");
      return;
    }
    const mappedId = surfaceMap[low];
    if (mappedId) {
      play(audioKey(mappedId), VOCAB[mappedId].word, el, null);
      if (el) el.classList.add("rw-speaking");
      return;
    }
    stopAudio();
    if (!window.speechSynthesis) { toast("当前浏览器不支持语音朗读"); return; }
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "en-US"; u.rate = SAVE.speed; u.pitch = 1;
    const v = pickVoice(); if (v) u.voice = v;
    if (el) el.classList.add("rw-speaking");
    u.onend = u.onerror = () => { if (el) el.classList.remove("rw-speaking"); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  /* ---------------- word tokenization & warm-up ---------------- */
  const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  function wrapWords(rawText, state, insideTerm) {
    let out = "";
    let last = 0;
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(rawText)) !== null) {
      if (m.index > last) out += esc(rawText.slice(last, m.index));
      const wi = state.wi++;
      const w = m[0];
      out += insideTerm
        ? `<span class="rw" data-wi="${wi}">${esc(w)}</span>`
        : `<button class="rw" type="button" data-wi="${wi}" data-speak-word="${esc(w)}">${esc(w)}</button>`;
      last = m.index + w.length;
    }
    if (last < rawText.length) out += esc(rawText.slice(last));
    return out;
  }

  const WARM_ICONS = {
    question: "assets/ui/icon_question.svg",
    flask: "assets/ui/icon_flask.svg",
    bulb: "assets/ui/icon_bulb.svg"
  };
  function markupWarm(text) {
    const state = { wi: 0 };
    const tagRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
      if (m.index > last) out += wrapWords(text.slice(last, m.index), state, false);
      const id = m[1];
      const disp = m[2] || id;
      out += `<button class="term" type="button" data-term="${esc(id)}">${wrapWords(disp, state, true)}</button>`;
      last = m.index + m[0].length;
    }
    if (last < text.length) out += wrapWords(text.slice(last), state, false);
    return out;
  }
  function plainWarm(text) {
    return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, id, disp) => disp || id);
  }
  function renderWarmup() {
    $("#warmupGrid").innerHTML = (D.warmup || []).map((w, idx) => `
      <article class="warm-card">
        <span class="warm-tape" aria-hidden="true"></span>
        <img class="warm-clip" src="assets/ui/paperclip.svg" alt="" aria-hidden="true">
        <div class="warm-card-head">
          <span class="warm-icon" aria-hidden="true"><img src="${WARM_ICONS[w.icon] || WARM_ICONS.question}" alt=""></span>
          <div>
            <div class="warm-kicker">0${idx + 1} · ${esc(w.titleEn)}</div>
            <h3>${esc(w.titleCn)}</h3>
          </div>
        </div>
        <div class="warm-actions">
          <button class="play-btn" type="button" data-play="warm_${w.id}" data-text="${esc(plainWarm(w.en))}">${SVG_PLAY} 听英文故事</button>
          <button class="cn-toggle" type="button" data-toggle-cn="${w.id}">掀开中文提示</button>
        </div>
        <div class="warm-en">${markupWarm(w.en)}</div>
        <div class="warm-cn hidden" id="cn-${w.id}">${esc(w.cn)}</div>
      </article>`).join("");
  }

  /* ---------------- scene cards ---------------- */
  const VOCAB = {};
  (D.vocab || []).forEach(v => VOCAB[v.id] = v);
  const VOCAB_GOAL = (D.vocab || []).length || 10;

  function renderScenes() {
    $("#sceneGrid").innerHTML = (D.scenes || []).map(s => {
      const bubbles = s.words.map(id => {
        const v = VOCAB[id]; if (!v) return "";
        return `<button class="word-bubble ${inSet(SAVE.mastered, id) ? "mastered" : ""}"
            type="button" style="left:${v.x}%;top:${v.y}%" data-word="${esc(id)}" title="${esc(v.cn)}">
            <span class="wb-star" aria-hidden="true">★</span>
            <span class="wb-word">${esc(v.word)}</span>
            <span class="wb-ipa">${esc(v.ipa)}</span>
            <span class="wb-cn">${esc(v.cn)}</span>
          </button>`;
      }).join("");
      const lines = s.words.map(id => {
        const v = VOCAB[id]; if (!v) return "";
        return `<line x1="${v.x}" y1="${v.y}" x2="${v.ax}" y2="${v.ay}" stroke="#4A90E2" stroke-opacity=".75"
          stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" />
          <circle cx="${v.ax}" cy="${v.ay}" r="1.2" fill="#F7B731" stroke="#2C3531" stroke-width=".5" vector-effect="non-scaling-stroke"/>`;
      }).join("");
      const chips = s.words.map(id => VOCAB[id] ? `<button class="word-chip ${inSet(SAVE.mastered, id) ? "mastered" : ""}" type="button" data-word="${esc(id)}">
          <span class="star" aria-hidden="true">★</span>${esc(VOCAB[id].word)}</button>` : "").join("");
      return `<article class="scene-card">
        <span class="washi-tape tape-tl" aria-hidden="true"></span>
        <span class="washi-tape tape-tr" aria-hidden="true"></span>
        <div class="scene-head"><h3>${esc(s.title)}</h3><span>${esc(s.subtitle)}</span></div>
        <div class="scene-canvas">
          <img src="${esc(s.img)}" alt="${esc(s.title)}——无文字科普场景插画">
          <svg class="scene-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          ${bubbles}
        </div>
        <div class="scene-wordlist">${chips}</div>
      </article>`;
    }).join("");
    updateMastery();
  }
  function updateMastery() {
    const n = SAVE.mastered.length;
    $("#masteredCount").textContent = n;
    $("#masteredFill").style.width = Math.min(100, Math.round(n * 100 / VOCAB_GOAL)) + "%";
    $("#remainingCount").textContent = Math.max(0, VOCAB_GOAL - n);
    if (n >= VOCAB_GOAL) $("#gateCta").classList.remove("hidden");
    refreshTabChecks();
  }
  function masterWord(id, btn) {
    addOnce(SAVE.mastered, id); save();
    $$(`.word-bubble[data-word="${cssEsc(id)}"], .word-chip[data-word="${cssEsc(id)}"]`)
      .forEach(b => b.classList.add("mastered"));
    updateMastery();
    play(audioKey(id), VOCAB[id].word, btn || $('.word-bubble[data-word="' + cssEsc(id) + '"]'));
    if (SAVE.mastered.length === VOCAB_GOAL) toast(`${VOCAB_GOAL} 颗星星全部点亮！可以翻开第 3 页原版破案啦 🎉`);
  }
  function cssEsc(s) { return s.replace(/"/g, '\\"'); }

  /* ---------------- original paper reader ---------------- */
  const surfaces = [];
  (D.vocab || []).forEach(v => {
    const forms = [v.word, ...(v.forms || [])];
    if (!v.forms) {
      if (v.word.endsWith("y") && !/[aeiou]y$/i.test(v.word)) forms.push(v.word.slice(0, -1) + "ies");
      else if (/(s|x|z|ch|sh)$/i.test(v.word)) forms.push(v.word + "es");
      else forms.push(v.word + "s");
    }
    forms.forEach(f => surfaces.push({ re: f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), id: v.id }));
  });
  surfaces.sort((a, b) => b.re.length - a.re.length);
  const termRE = surfaces.length ? new RegExp("\\b(" + surfaces.map(s => s.re).join("|") + ")\\b", "gi") : null;
  const surfaceMap = {};
  surfaces.forEach(s => surfaceMap[s.re.toLowerCase()] = s.id);

  function decorate(text, isList) {
    const state = { wi: 0 };
    if (isList || !termRE) return wrapWords(text, state, false);
    let out = "";
    let last = 0;
    termRE.lastIndex = 0;
    let m;
    while ((m = termRE.exec(text)) !== null) {
      const prevCh = m.index > 0 ? text[m.index - 1] : "";
      const nextCh = m.index + m[0].length < text.length ? text[m.index + m[0].length] : "";
      if (prevCh === "-" || nextCh === "-") continue;
      if (m.index > last) out += wrapWords(text.slice(last, m.index), state, false);
      const id = surfaceMap[m[0].toLowerCase()];
      out += id
        ? `<button class="term" type="button" data-term="${esc(id)}">${wrapWords(m[0], state, true)}</button>`
        : wrapWords(m[0], state, false);
      last = m.index + m[0].length;
    }
    if (last < text.length) out += wrapWords(text.slice(last), state, false);
    return out;
  }
  const FIG = {}; (D.figures || []).forEach(f => FIG[f.id] = f);
  function figureBlock(f) {
    if (!f) return "";
    return `<figure class="paper-figure">
      <img src="${esc(f.file)}" data-zoom="${esc(f.id)}" alt="${esc(f.title)}">
      <figcaption><strong>${esc(f.title)} · (点击放大)</strong><br>${esc(f.caption)}<br>${esc(f.captionCn)}</figcaption>
    </figure>`;
  }
  function renderPaper() {
    const secs = D.sections || [];
    $("#sectionPills").innerHTML = secs.map((s, si) =>
      `<button class="sec-pill ${si === 0 ? "active" : ""}" type="button" data-jump-sec="${esc(s.id)}">${esc(s.name)}</button>`
    ).join("");

    $("#paperSections").innerHTML = secs.map((s, si) => {
      const fig = s.figure ? figureBlock(FIG[s.figure]) : "";
      const paras = (s.paras || []).map((p, i) => `
        <div class="para" id="para-${s.id}-${i}">
          <div class="para-en">${decorate(p.en, p.isList)}</div>
          <div class="para-tools">
            <button class="para-play-btn" type="button" data-play="sec_${s.id}_${i}" data-text="${esc(p.en)}">${SVG_PLAY} 朗读这一段</button>
            <button class="para-trans-btn" type="button" data-trans="${s.id}-${i}">${SVG_BOOK} 展开中文精译与长句拆解</button>
          </div>
          <div class="para-cn hidden" id="trans-${s.id}-${i}">
            ${esc(p.cn)}
            ${(p.notes || []).length ? '<ul class="notes-list">' + p.notes.map(n => "<li>" + esc(n) + "</li>").join("") + "</ul>" : ""}
          </div>
        </div>`).join("");
      return `<article class="paper-section ${si > 0 ? "collapsed" : ""}" id="sec-${s.id}">
        <button class="section-toggle" type="button" data-section="${s.id}">
          <span><span class="sec-en">${esc(s.name)}</span><span class="sec-cn">${esc(s.nameCn)}</span></span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="section-content">${fig}${paras}</div>
      </article>`;
    }).join("");

    $("#spineRings").innerHTML = Array.from({ length: 14 }, () => '<span class="spine-ring"></span>').join("");
  }

  /* ---------------- term popup & notebook (pure SVG icons) ---------------- */
  function nbBtnContent(inNb) {
    return `<img class="ui-svg" src="assets/ui/${inNb ? "icon_pinned" : "icon_pin"}.svg" alt=""><span>${inNb ? "已在生词夹" : "夹进生词夹"}</span>`;
  }
  function showTerm(id, ev, autoSpeak = true) {
    const v = VOCAB[id]; if (!v) return;
    const pop = $("#termPop");
    const inNb = inSet(SAVE.notebook, id);
    pop.innerHTML = `
      <div class="tp-word">${esc(v.word)}</div>
      <div class="tp-ipa">${esc(v.ipa)}</div>
      <div class="tp-cn">${esc(v.cn)}</div>
      <div class="tp-gl">${esc(v.gloss)}</div>
      <div style="font-size:12.5px;margin-bottom:6px">${esc(v.glossCn)}</div>
      <div class="tp-analogy"><img class="ui-svg" src="assets/ui/icon_idea.svg" alt=""><span>${esc(v.analogy)}</span></div>
      <div class="tp-actions">
        <button type="button" data-speak-term="${esc(id)}">${SVG_SPEAKER}<span>朗读单词</span></button>
        <button type="button" data-nb="${esc(id)}">${nbBtnContent(inNb)}</button>
      </div>`;
    pop.classList.remove("hidden");
    const r = ev.currentTarget.getBoundingClientRect();
    const w = 310, h = pop.offsetHeight || 290;
    let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
    let top = r.bottom + 10;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 10);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    pop._anchor = ev.currentTarget;
    if (autoSpeak) {
      const speakBtn = $("[data-speak-term]", pop);
      play(audioKey(id), v.word, speakBtn, ev.currentTarget);
    }
  }
  function renderNotebook() {
    const ids = SAVE.notebook;
    $("#notebookCount").textContent = ids.length;
    $("#badgeNb") && ($("#badgeNb").textContent = ids.length);
    $("#notebookBody").innerHTML = ids.length ? ids.map(id => {
      const v = VOCAB[id]; if (!v) return "";
      return `<div class="nb-item"><div><div class="nb-word">${esc(v.word)}</div>
        <div class="nb-ipa">${esc(v.ipa)}</div><div class="nb-cn">${esc(v.cn)} · ${esc(v.analogy)}</div></div>
        <button type="button" data-nb-speak="${esc(id)}" aria-label="朗读 ${esc(v.word)}">${SVG_SPEAKER}</button><button type="button" data-nb-remove="${esc(id)}" aria-label="移除 ${esc(v.word)}">×</button></div>`;
    }).join("") : '<div class="nb-empty">生词夹还是空的。<br>阅读时点一下带荧光底色的词，就能夹进这里！</div>';
  }
  function toggleNotebook(id) {
    const i = SAVE.notebook.indexOf(id);
    if (i >= 0) { SAVE.notebook.splice(i, 1); toast("已从生词夹移除"); }
    else { addOnce(SAVE.notebook, id); toast("已夹入我的生词夹"); }
    save(); renderNotebook();
    const nb = $("#termPop [data-nb]");
    if (nb) nb.innerHTML = nbBtnContent(inSet(SAVE.notebook, id));
  }

  /* ---------------- missions & dynamic star stamps ---------------- */
  const MS = D.missions || {};
  const fqIds = (MS.figQuiz || []).map(q => q.id);
  const tfIds = (MS.trueFalse || []).map(t => t.id);
  const starKeys = ["m1", ...fqIds, ...tfIds, "m4"];

  function starCount() { return starKeys.filter(k => SAVE.stars[k]).length; }
  function refreshTabChecks() {
    $("#check-warmup").classList.toggle("hidden", (SAVE.warmHeard || []).length === 0);
    $("#check-scenes").classList.toggle("hidden", SAVE.mastered.length < VOCAB_GOAL);
    $("#check-reader").classList.toggle("hidden", starCount() < starKeys.length);
  }
  function refreshStars() {
    const count = starCount();
    $("#starCount").textContent = count;
    $("#starTotal").textContent = starKeys.length;
    $("#starStampsBar").style.gridTemplateColumns = `repeat(${starKeys.length}, 1fr)`;
    $("#starStampsBar").innerHTML = starKeys.map((k, idx) => {
      const earned = !!SAVE.stars[k];
      return `<div class="stamp-slot ${earned ? "earned" : ""}" title="第 ${idx + 1} 枚侦探印章">
        <img src="assets/ui/${earned ? "star_filled.svg" : "star_empty.svg"}" alt="${earned ? "已获得印章" : "未获得印章"}">
      </div>`;
    }).join("");
    $$(".mission-tab").forEach(t => {
      const keys = { m1: ["m1"], m2: fqIds, m3: tfIds, m4: ["m4"] }[t.dataset.mission] || [];
      t.classList.toggle("done", keys.length > 0 && keys.every(k => SAVE.stars[k]));
    });
    refreshTabChecks();
  }
  function award(key, msg) {
    if (SAVE.stars[key]) return;
    SAVE.stars[key] = true; save(); refreshStars(); if (msg) toast(msg);
  }
  function renderM1() {
    const ord = MS.order || [];
    const shuffle = ord.length === 5 ? [2, 4, 0, 3, 1] : ord.map((_, i) => i).reverse();
    $("#orderSlots").innerHTML = ord.map((_, i) => `<div class="slot" data-slot="${i}">${i + 1}</div>`).join("");
    $("#orderOptions").innerHTML = shuffle.map(idx => {
      const s = ord[idx];
      return `<button class="order-option" type="button" data-step="${idx}" title="${esc(s.hint)}">
        <span class="step-n">?</span>${esc(s.text)}</button>`;
    }).join("");
    $("#m1Feedback").innerHTML = "";
    let picked = [];
    $$("#orderOptions .order-option").forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.step;
        if (picked.includes(idx)) return;
        picked.push(idx); btn.disabled = true;
        const s = ord[idx];
        const slot = $(`.slot[data-slot="${picked.length - 1}"]`);
        slot.textContent = s.text.slice(0, 8) + "…"; slot.classList.add("filled");
        slot.title = s.text;
        if (picked.length < ord.length) return;
        const ok = picked.every((v, i) => v === i);
        $("#m1Feedback").innerHTML = ok
          ? '<div class="feedback-ok">✅ 顺序完全正确！你还原了科学家在论文中的真实研究流程。印章 +1 ⭐</div>'
          : `<div class="feedback-bad">差一点点。提示：${esc(ord[0]?.hint || "再对照原文 Methods 部分看看先后顺序")}。点下方按钮再试一次吧！</div>`;
        if (ok) award("m1", "第 1 关通过！收获 1 枚侦探印章 ⭐");
      };
    });
  }
  function renderQuiz() {
    $("#figQuizList").innerHTML = (MS.figQuiz || []).map(q => {
      const f = FIG[q.figure];
      return `<div class="quiz-card" data-q="${q.id}">
        <div class="q-title">${esc(q.q)}</div>
        ${f ? `<img src="${esc(f.file)}" data-zoom="${esc(q.figure)}" alt="${esc(f.title)}">` : ""}
        <div class="quiz-options-grid">
          ${q.options.map((o, i) => `<button class="quiz-option" type="button" data-opt="${i}"><span><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(o)}</span></button>`).join("")}
        </div>
        <div class="q-feedback"></div>
      </div>`;
    }).join("");
    $$("#figQuizList .quiz-card").forEach(card => {
      const q = (MS.figQuiz || []).find(x => x.id === card.dataset.q);
      $$(".quiz-option", card).forEach(btn => {
        btn.onclick = () => {
          const i = +btn.dataset.opt, ok = i === q.answer;
          $$(".quiz-option", card).forEach((b, j) => {
            b.disabled = true;
            if (j === q.answer) {
              b.classList.add("correct");
              if (!$(".opt-check-stamp", b)) {
                b.insertAdjacentHTML("beforeend", '<img class="opt-check-stamp" src="assets/ui/check_stamp.svg" alt="正确">');
              }
            }
            if (j === i && !ok) b.classList.add("wrong");
          });
          $(".q-feedback", card).innerHTML = `<div class="explain">${ok ? "✅ " : "再看看："}${esc(q.why)}
            <br><button class="evidence-btn" type="button" data-evidence="${esc(q.evidence)}">↗ 回到原文看证据</button></div>`;
          if (ok) award(q.id, "图表侦探答对啦！印章 +1 ⭐");
        };
      });
    });
  }
  function renderTF() {
    $("#tfList").innerHTML = (MS.trueFalse || []).map(t => `
      <div class="tf-card" data-tf="${t.id}">
        <div class="tf-sentence">${esc(t.statement)}</div>
        <div class="tf-cn">${esc(t.cn)}</div>
        <div class="tf-buttons">
          <button class="tf-btn" type="button" data-val="true">True</button>
          <button class="tf-btn" type="button" data-val="false">False</button>
        </div>
        <div class="tf-feedback"></div>
      </div>`).join("");
    $$("#tfList .tf-card").forEach(card => {
      const t = (MS.trueFalse || []).find(x => x.id === card.dataset.tf);
      $$(".tf-btn", card).forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.val === "true", ok = val === t.answer;
          $$(".tf-btn", card).forEach(b => {
            b.disabled = true;
            if ((b.dataset.val === "true") === t.answer) b.classList.add("correct");
            else if (b === btn) b.classList.add("wrong");
          });
          $(".tf-feedback", card).innerHTML = `<div class="explain">${ok ? "✅ 判断正确！" : "🤔 再看一眼原文："}${esc(t.why)}
            <br><button class="evidence-btn" type="button" data-evidence="${esc(t.evidence)}">↗ 回到原文看证据</button></div>`;
          if (ok) award(t.id, "鉴真成功！印章 +1 ⭐");
        };
      });
    });
  }
  function renderFeynman() {
    const fl = MS.feynman || [];
    $("#feynmanList").innerHTML = fl.map((f, i) => `
      <div class="feynman-card"><label>
        <input type="checkbox" data-fq="${i}" ${inSet(SAVE.feynman, i) ? "checked" : ""}>
        <span><span class="fq-cn">${i + 1}. ${esc(f.cn)}</span>
        <span class="fq-en">${esc(f.en)}</span>
        <span class="fq-tip">提示：${esc(f.tip)}${f.from ? " · " + esc(f.from) : ""}</span></span>
      </label></div>`).join("");
    $$("#feynmanList input").forEach(cb => cb.onchange = () => {
      if (cb.checked) addOnce(SAVE.feynman, +cb.dataset.fq);
      else SAVE.feynman = SAVE.feynman.filter(x => x !== +cb.dataset.fq);
      save();
      if (fl.length > 0 && SAVE.feynman.length === fl.length) award("m4", "费曼输出完成！收获最后 1 枚印章 ⭐");
    });
  }
  function jumpEvidence(key) {
    const parts = key.split("-"), sec = parts[0], idx = +parts[1];
    if (currentPage !== "reader") setPage("reader", false);
    const secEl = $("#sec-" + sec), para = $("#para-" + sec + "-" + idx);
    if (!secEl || !para) return;
    secEl.classList.remove("collapsed");
    $$(".sec-pill").forEach(p => p.classList.toggle("active", p.dataset.jumpSec === sec));
    const scrollBox = $(".reader-scroll");
    if (scrollBox && window.innerWidth > 1180) {
      const offset = para.offsetTop - scrollBox.offsetTop - 16;
      scrollBox.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    } else {
      para.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => { para.classList.remove("flash"); void para.offsetWidth; para.classList.add("flash"); }, 350);
  }

  /* ---------------- lightbox ---------------- */
  function openLightbox(id) {
    const f = FIG[id]; if (!f) return;
    $("#lightboxImg").src = f.file;
    $("#lightboxCaption").innerHTML = "<strong>" + esc(f.title) + "</strong><br>" + esc(f.caption) + "<br>" + esc(f.captionCn);
    $("#lightbox").classList.remove("hidden");
  }

  /* ---------------- global events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target;

    const pageBtn = t.closest("[data-page]");
    if (pageBtn) { setPage(pageBtn.dataset.page); return; }

    if (t.closest("#openJournalBtn")) {
      const el = $("#warmup");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 82, behavior: "smooth" });
      return;
    }

    const playBtn = t.closest("[data-play]");
    if (playBtn) { play(playBtn.dataset.play, playBtn.dataset.text || "", playBtn); return; }

    const cn = t.closest("[data-toggle-cn]");
    if (cn) {
      const box = $("#cn-" + cn.dataset.toggleCn);
      box.classList.toggle("hidden");
      cn.textContent = box.classList.contains("hidden") ? "掀开中文提示" : "收起中文提示";
      return;
    }
    const term = t.closest(".term"); if (term) { showTerm(term.dataset.term, { currentTarget: term }, true); return; }
    const speakWord = t.closest("[data-speak-word]");
    if (speakWord) { speakSingleWord(speakWord.dataset.speakWord, speakWord); return; }
    const word = t.closest("[data-word]"); if (word) { masterWord(word.dataset.word, word); return; }

    const tr = t.closest("[data-trans]");
    if (tr) {
      const box = $("#trans-" + tr.dataset.trans); box.classList.toggle("hidden");
      tr.innerHTML = SVG_BOOK + (box.classList.contains("hidden") ? " 展开中文精译与长句拆解" : " 收起中文精译与长句拆解");
      return;
    }
    const sec = t.closest("[data-section]");
    if (sec) {
      $("#sec-" + sec.dataset.section).classList.toggle("collapsed");
      $$(".sec-pill").forEach(p => p.classList.toggle("active", p.dataset.jumpSec === sec.dataset.section));
      return;
    }
    const jumpSec = t.closest("[data-jump-sec]");
    if (jumpSec) {
      const sid = jumpSec.dataset.jumpSec;
      const secEl = $("#sec-" + sid);
      if (secEl) {
        secEl.classList.remove("collapsed");
        $$(".sec-pill").forEach(p => p.classList.toggle("active", p === jumpSec));
        const scrollBox = $(".reader-scroll");
        if (scrollBox && window.innerWidth > 1180) {
          scrollBox.scrollTo({ top: Math.max(0, secEl.offsetTop - scrollBox.offsetTop - 8), behavior: "smooth" });
        } else {
          secEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      return;
    }

    const zoom = t.closest("[data-zoom]"); if (zoom) { openLightbox(zoom.dataset.zoom); return; }
    const ev = t.closest("[data-evidence]"); if (ev) { jumpEvidence(ev.dataset.evidence); return; }

    const nb = t.closest("[data-nb]"); if (nb) { toggleNotebook(nb.dataset.nb); return; }
    const sp = t.closest("[data-speak-term]"); if (sp) { play(audioKey(sp.dataset.speakTerm), VOCAB[sp.dataset.speakTerm].word, sp); return; }
    const nbs = t.closest("[data-nb-speak]"); if (nbs) { play(audioKey(nbs.dataset.nbSpeak), VOCAB[nbs.dataset.nbSpeak].word, nbs); return; }
    const nbr = t.closest("[data-nb-remove]"); if (nbr) { toggleNotebook(nbr.dataset.nbRemove); return; }

    const mt = t.closest(".mission-tab");
    if (mt) {
      $$(".mission-tab").forEach(b => b.classList.toggle("active", b === mt));
      $$(".mission-pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + mt.dataset.mission));
      return;
    }
    const reset = t.closest("[data-reset]"); if (reset) { renderM1(); return; }

    const speed = t.closest("[data-speed]");
    if (speed) {
      SAVE.speed = parseFloat(speed.dataset.speed); save();
      $$(".speed-btn").forEach(b => b.classList.toggle("active", b === speed));
      toast("朗读语速已设为：" + speed.textContent + "（" + speed.dataset.speed + "x）");
      return;
    }
    const fontBtn = t.closest(".font-control [data-font]");
    if (fontBtn) {
      SAVE.font = fontBtn.dataset.font; save();
      document.body.dataset.font = SAVE.font;
      $$(".font-control [data-font]").forEach(b => b.classList.toggle("active", b === fontBtn));
      toast("阅读字号已切换为：" + fontBtn.textContent);
      return;
    }

    if (t.closest("#notebookBtn")) { $("#notebook").classList.remove("hidden"); return; }
    if (t.closest("#nbClose")) { $("#notebook").classList.add("hidden"); return; }
    if (t.closest("#clearNotebook")) { SAVE.notebook = []; save(); renderNotebook(); toast("生词夹已清空"); return; }
    if (t.closest("#lightboxClose") || t.id === "lightbox") { $("#lightbox").classList.add("hidden"); return; }
    if (t.closest("#skipWords")) { $("#gateCta").classList.remove("hidden"); setPage("reader"); toast("已直接进入原版破案"); return; }
    if (t.closest("#gateCta")) { setPage("reader"); return; }
    if (t.closest("#expandAll")) { $$(".paper-section").forEach(s => s.classList.remove("collapsed")); return; }
    if (t.closest("#collapseAll")) { $$(".paper-section").forEach(s => s.classList.add("collapsed")); return; }
    if (t.closest("#badgeBtn")) {
      $("#badgeWords").textContent = SAVE.mastered.length;
      $("#badgeStars").textContent = starCount() + "/" + starKeys.length;
      $("#badgeNb").textContent = SAVE.notebook.length;
      $("#badgeOverlay").classList.remove("hidden"); return;
    }
    if (t.closest("#badgeClose")) { $("#badgeOverlay").classList.add("hidden"); return; }
    if (t.closest("#badgePrint")) { window.print(); return; }
    if (!t.closest("#termPop")) $("#termPop").classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#termPop").classList.add("hidden"); $("#lightbox").classList.add("hidden");
      $("#notebook").classList.add("hidden"); $("#badgeOverlay").classList.add("hidden"); stopAudio();
    }
  });

  /* ---------------- boot ---------------- */
  hydrateMeta();
  document.body.dataset.font = SAVE.font || "md";
  $$(".font-control [data-font]").forEach(b => b.classList.toggle("active", b.dataset.font === document.body.dataset.font));
  $$(".speed-btn").forEach(b => b.classList.toggle("active", parseFloat(b.dataset.speed) === SAVE.speed));
  renderWarmup(); renderScenes(); renderPaper();
  renderM1(); renderQuiz(); renderTF(); renderFeynman();
  renderNotebook(); refreshStars();
  setPage(SAVE.page || "warmup", false);
})();
