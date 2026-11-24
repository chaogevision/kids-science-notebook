# `lesson_data.json` Schema & Authoring Guide

Every generated learning web app is driven entirely by `data/lesson_data.json` (compiled into `data/lesson_data.js` as `window.LESSON_DATA = ...` for `file://` offline compatibility).

## 1. `meta` (Dynamic Branding & Hero Configuration)

The Scheme B template hydrates brand titles, Hero spread, certificate text, and footer from `meta`:

```json
{
  "meta": {
    "brandCn": "科学侦探手账",
    "brandEn": "Science Detective",
    "eyebrow": "SCIENCE JOURNAL FOR KIDS · NOVEMBER 2026",
    "title": "Exact English Paper Title",
    "titleCn": "小行星里，<br>藏着关于[[hl|生命的线索]]？",
    "subtitleCn": "跟随太空科学侦探手账，通过双语绘本与趣味实验，一起揭开……",
    "heroCover": "assets/ui/hero_cover.png",
    "heroCoverAlt": "水彩绘本封面插画描述",
    "heroSticker": "Bennu · 科学档案",
    "heroPeekFigureId": "fig0",
    "heroPeekLabel": "🔭 原版配图",
    "paperSource": "Sandford et al. (2025), Nature Astronomy",
    "source": "Science Journal For Kids — November 2026",
    "footerSource": "原文来源：Science Journal For Kids (...) · 研究论文：...",
    "footerNote": "英文论文内容忠实于原 PDF；中文为辅助提示。插图：科学侦探手账 / Science Journal For Kids。",
    "certificateHeading": "科学小侦探",
    "certificateCourse": "《小行星里，藏着关于生命的线索？》",
    "target": "小学五年级 / 初一",
    "audioVoice": "en-US-AriaNeural"
  }
}
```

- `[[hl|...]]` inside `titleCn` renders the hand-drawn yellow highlighter underline.
- `heroPeekFigureId` is optional (`null` hides the peek button on the Hero frame).

## 2. `warmup` (3 Ruled Story Cards)

Exactly 3 entries (`w1`, `w2`, `w3`) with icons `"question"`, `"flask"`, `"bulb"`:
- `titleEn`: `"The Question"`, `"The Method"`, `"The Discovery"`
- `titleCn`: Kid-friendly Chinese title (`科学家想解什么谜` / `他们怎么查的` / `发现了什么`)
- `en`: Simplified child-friendly English briefing (100–130 words each). Tag core vocab terms inline as `[[vocab_id|surface form]]` (e.g. `[[organic molecules|plastics]]`).
- `cn`: Natural Chinese translation (hidden behind the yellow folded sticky-note button by default).

## 3. `vocab` (10 Core Terms across 2 Scenes)

Exactly 10 terms (5 assigned to `"scene": "scene1"` and 5 to `"scene": "scene2"`):
- `id`: canonical lowercase/hyphenated identifier (e.g. `"organic molecules"`, `"X-rays"`)
- `word`: display spelling
- `ipa`: IPA phonetic transcription
- `cn`: concise Chinese meaning
- `gloss`: kid-friendly English definition (derived from the PDF glossary when available)
- `glossCn`: Chinese explanation
- `analogy`: vivid kid-friendly analogy (`"像……"`)
- `scene`: `"scene1"` or `"scene2"` (matching `scenes[].id`)
- `x`, `y`: bubble center percentage (`8..90`)
- `ax`, `ay`: pointer anchor dot on the illustration (`5..95`)

**Bubble Placement Guardrail**: Visually inspect the generated scene image and verify `(x, y)` sits on open background (never covering the focal object) and `(ax, ay)` points directly to the matching visual element!

## 4. `scenes` (2 Illustrated Vocabulary Scenes)

2 entries referencing `assets/scenes/scene_1.jpg` and `assets/scenes/scene_2.jpg`, each listing its 5 `words` IDs.

## 5. `figures` (PDF Extracted Figures)

Each figure extracted from the PDF (`id`, `file`, `title`, `caption`, `captionCn`, `section`).

## 6. `sections` (Verbatim Original Paper)

Keep the PDF's English paragraphs **100% verbatim** (typically `Abstract`, `Introduction`, `Methods`, `Results`, `Discussion`, `Conclusion` — or matching the article's exact headings).
- Each paragraph object: `{ "en": "...", "cn": "...", "notes": ["..."], "isList": false }`
- Set `"isList": true` for bullet/symbol lists so formatting renders cleanly while every word remains clickable.
- `notes`: 1–2 concise Chinese syntax/reading hints for children (e.g., clause breakdown, contrast clues, "hypothesis ≠ proven fact").

## 7. `missions` (4 Detective Missions = 8 Stamps)

1. `order` (5 chronological steps from Methods -> **1 stamp**): `{ "id": "m1", "text": "...", "hint": "..." }`
2. `figQuiz` (2–3 figure-reading MCQs -> **1 stamp each**): `{ "id": "fq1", "figure": "fig2", "q": "...", "options": [...], "answer": 0, "why": "...", "evidence": "sectionId-paraIndex" }`
3. `trueFalse` (4 true/false statements targeting common misconceptions -> **1 stamp each**): `{ "id": "tf1", "statement": "...", "cn": "...", "answer": true, "why": "...", "evidence": "sectionId-paraIndex" }`
4. `feynman` (3 explain-in-your-own-words prompts -> **1 stamp** when all 3 checked): `{ "cn": "...", "en": "...", "tip": "...", "from": "..." }`

Total stamps (`m1` + `fq*` + `tf*` + `m4`) are counted dynamically by the UI (`starStampsBar` renders one star stamp per mission key!). Aim for **8 total stamps** (`1 + 2 + 4 + 1`).
