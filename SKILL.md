---
name: kids-science-notebook
description: >-
  Convert any Science Journal For Kids PDF article into a complete, offline-ready,
  child-friendly interactive Storybook Science Notebook web app (Scheme B design:
  watercolor paper, 3 tabbed notebook stages, 2 scene word-card illustrations,
  open two-page spiral reader + 4 detective missions, Edge TTS unified neural voice
  for every word, native WordBoundary karaoke read-along, pure SVG icons, and .zip
  delivery). Trigger when the user uploads or points to a Science Journal For Kids
  (or similar bilingual kids' science) PDF and asks to turn it into an interactive
  learning webpage or storybook app.
---

# Kids Science Notebook (Science Journal For Kids -> Interactive Web App)

## Overview

End-to-end 6-stage pipeline transforming a raw **Science Journal For Kids** PDF into a standalone, zero-dependency, offline-openable (`file://`) **Storybook Science Notebook** web app (`index.html` + `.zip` package) tailored for upper-elementary / middle-school children (ages 8–13).

**Design System (Scheme B — Locked Visual Standard):**
- Warm watercolor paper desk (`#FDF8EE`) with ruled notebook lines, pastel washi tape, paperclips, and folded sticky-note translation toggles
- 3 physical notebook index tabs (`① 读前故事`, `② 漫画找词`, `③ 原版破案`) + `中/大` font toggle + `慢/适中/快` speed pill + spiral vocab folder
- Open leather-bound two-page spiral notebook for Stage 3 (left: verbatim English paper + Polaroid figures; right: 8-stamp detective mission board)
- Unified **Edge TTS** neural voice (`en-US-AriaNeural` `-10%` by default) for paragraph narration, vocab cards, AND every clickable word (`WORD_AUDIO_MAP`), paired with native `WordBoundary` word-by-word karaoke highlighting and pure SVG dialog icons.

---

## Pipeline Stages

```
[Stage 1] Extract PDF Text, Bitmaps & Page Renders (extract_pdf.py)
   ↓
[Stage 2] Author Structured Curriculum JSON (data/lesson_data.json)
   ↓
[Stage 3] Create Watercolor Cover & 2 Text-Free Scene Illustrations + Visually Audit Coords
   ↓
[Stage 4] Hydrate Scheme B Template & Validate Assets (build_project.py)
   ↓
[Stage 5] Generate Edge TTS Narrations, WordBoundary Timings & All Word MP3s (generate_audio.py)
   ↓
[Stage 6] Offline Headless Browser Verification + Screenshot Audit + .zip Package
```

---

## Stage 1: Extract PDF Content & Figures

Run [extract_pdf.py](./scripts/extract_pdf.py) via `uv`:

```bash
/Users/Apple/.local/bin/uv run --with pymupdf python3 \
  /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/extract_pdf.py \
  extract "<INPUT_PDF>" "<WORK_DIR>/_pdf_extract"
```

1. Read `<WORK_DIR>/_pdf_extract/extracted_text.txt` and inspect the rendered PNG pages (`pages/page_*.png`) with `read_file`.
2. Copy clean embedded photos from `embedded/` into `<PROJECT_DIR>/assets/figures/`.
3. For **vector diagrams** (which `get_images()` does not extract cleanly), crop directly from the PDF page at high DPI:
   ```bash
   /Users/Apple/.local/bin/uv run --with pymupdf python3 \
     /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/extract_pdf.py \
     crop "<INPUT_PDF>" --page <N> --box <X0> <Y0> <X1> <Y1> --out "<PROJECT_DIR>/assets/figures/<fig_name>.png"
   ```
   Visually inspect every cropped figure with `read_file` to verify labels and captions are crisp and unclipped.

---

## Stage 2: Author `data/lesson_data.json`

Scaffold the project directory first:

```bash
python3 /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/build_project.py \
  "<PROJECT_DIR>" --init-only
```

Author `<PROJECT_DIR>/data/lesson_data.json` strictly following [lesson_schema.md](./references/lesson_schema.md):
- **`meta`**: Set topic-matched `brandCn`, `brandEn`, `titleCn` (use `[[hl|...]]` for yellow underline), `subtitleCn`, `heroCover: "assets/ui/hero_cover.png"`, `heroSticker`, optional `heroPeekFigureId`, and source attribution.
- **`warmup`** (3 cards): `The Question`, `The Method`, `The Discovery` (~100–130 words each, tagged with `[[vocab_id|surface]]` + natural Chinese).
- **`vocab`** (10 terms) & **`scenes`** (2 scenes, 5 terms each): Kid-friendly IPA, English/Chinese gloss (from PDF glossary), vivid analogy (`"像……"`), and scene bubble coordinates `(x, y)` + anchor `(ax, ay)`.
- **`sections`**: **100% verbatim** English paragraphs copied from the PDF (`Abstract`, `Introduction`, `Methods`, `Results`, `Discussion`, `Conclusion`), paired with Chinese translation and 1–2 concise syntax/logic `notes`.
- **`missions`** (8 stamps total): 5 chronological Method steps (`order`), 2 figure-reading MCQs (`figQuiz`), 4 misconception-busting `trueFalse` items with `evidence` anchors (`"sectionId-paraIndex"`), and 3 `feynman` reflection prompts.

---

## Stage 3: Generate Watercolor Illustrations & Audit Scene Bubbles

Generate 3 custom illustrations (matching Scheme B's warm children's picture-book watercolor aesthetic, **NO embedded text**):
1. **Hero Cover** (`<PROJECT_DIR>/assets/ui/hero_cover.png`): 4:3 watercolor illustration showing the article's core science subject + curious kid explorers with magnifying glasses on soft cream/sky watercolor wash.
2. **Scene 1** (`<PROJECT_DIR>/assets/scenes/scene_1.jpg`): 16:9 text-free watercolor scene clearly illustrating the first 5 vocab terms.
3. **Scene 2** (`<PROJECT_DIR>/assets/scenes/scene_2.jpg`): 16:9 text-free watercolor scene clearly illustrating the second 5 vocab terms.

**Mandatory Visual Inspection**:
- Inspect all 3 generated images via `read_file`. Check for distorted artifacts or corner watermarks (crop out any bottom-right watermark cleanly if present).
- Verify each term's `(x, y)` places its bubble on open background without overlapping the main visual object, and `(ax, ay)` lands directly on the corresponding element in the illustration. Update `lesson_data.json` coordinates if needed.

---

## Stage 4: Build Template & Compile `lesson_data.js`

Run [build_project.py](./scripts/build_project.py) to sync the Scheme B template (`index.html`, `styles.css`, `app.js`, 19 SVG icons), compile `data/lesson_data.js`, and verify all visual assets exist:

```bash
python3 /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/build_project.py "<PROJECT_DIR>"
```

---

## Stage 5: Generate Edge TTS Audio & Native `WordBoundary` Timings

Run [generate_audio.py](./scripts/generate_audio.py) via `uv`:

```bash
/Users/Apple/.local/bin/uv run --with edge-tts python3 \
  /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/generate_audio.py \
  "<PROJECT_DIR>"
```

- Uses `en-US-AriaNeural` at `-10%` rate by default (pass `--voice en-US-AnaNeural` if the user explicitly requests a younger child narrator).
- Outputs:
  - `assets/audio/warm_*.mp3` & `assets/audio/sec_*.mp3` (full narrations)
  - `assets/audio/vocab_*.mp3` (10 vocab terms)
  - `assets/audio/words/*.mp3` (every unique tap-to-read English word in the lesson)
  - `data/audio_timings.js` (`window.AUDIO_TIMINGS` + `window.WORD_AUDIO_MAP`) & `data/audio_manifest.json`

---

## Stage 6: Headless Chrome Verification & Offline ZIP Delivery

1. Run [verify_app.mjs](./scripts/verify_app.mjs) against `<PROJECT_DIR>` (`file://` mode):
   ```bash
   node /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/verify_app.mjs "<PROJECT_DIR>"
   ```
   Confirm **100% checks pass**, including:
   - Word-timing parity (`AUDIO_TIMINGS[key].length === DOM .rw count`) across all narrations
   - 100% tap-to-read words mapped to existing Edge TTS MP3s
   - Zero broken images/SVGs and pure SVG icons inside `#termPop`
   - Read-along highlight, ordinary word tap, highlighted term auto-speak, all 4 missions, certificate modal, and zero console/page errors.
2. Visually inspect the captured `assets/qa-home.png`, `assets/qa-scenes.png`, `assets/qa-reader.png`, and `assets/qa-ipad.png` via `read_file` to ensure bubble positions and layout look crisp.
3. Package the clean offline `.zip` (automatically excludes `qa-*.png` test screenshots):
   ```bash
   python3 /Users/Apple/.gemini/config/skills/kids-science-notebook/scripts/build_project.py \
     "<PROJECT_DIR>" --zip "<OUTPUT_ZIP_PATH>"
   ```
4. Clean up `<WORK_DIR>/_pdf_extract` (or temporary `qa-*.png` if desired) and deliver the clickable path to `index.html` and the `.zip` archive.
