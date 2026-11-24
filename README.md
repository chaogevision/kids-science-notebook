# Kids Science Notebook

An end-to-end Agent Skill that turns any **Science Journal For Kids** PDF into a standalone, zero-dependency, offline-ready (`file://`) **Storybook Science Notebook** interactive learning web app for children (ages 8–13).

## Highlights

- **Storybook Science Notebook UI (Scheme B)**: Warm watercolor paper (`#FDF8EE`), ruled notebook cards, pastel washi tape, paperclips, folded sticky-note translation toggles, and a 3-tab progression (`① 读前故事` → `② 漫画找词` → `③ 原版破案`).
- **Open Two-Page Spiral Reader & Detective Board**: Left page displays the verbatim English paper with Polaroid-framed figures; right page houses an 8-stamp detective mission board (method ordering, figure quiz, true/false with one-click evidence jump, Feynman reflection, and printable certificate).
- **Unified Edge TTS Neural Voice & Karaoke Read-Along**: Synthesizes narration MP3s with native `WordBoundary` word-by-word highlighting plus individual tap-to-read MP3s for every English word (`en-US-AriaNeural` by default), with pure SVG dialog controls.
- **100% Offline Ready**: Packages cleanly with `window.LESSON_DATA` & `window.AUDIO_TIMINGS` (no CDN or server required) and exports a ready-to-share `.zip` bundle.

## Repository Layout

```text
kids-science-notebook/
├── SKILL.md                  # 6-stage agent workflow instructions
├── references/
│   └── lesson_schema.md      # JSON schema & curriculum authoring guide
├── scripts/
│   ├── extract_pdf.py        # PyMuPDF text, bitmap & vector-region extraction
│   ├── build_project.py      # Template scaffolding, JS compilation & .zip export
│   ├── generate_audio.py     # Edge TTS WordBoundary timings + all word MP3s
│   └── verify_app.mjs        # Headless Chrome offline verification script
└── assets/template/          # Complete Scheme B HTML/CSS/JS + 18 SVG UI icons
```

## Quick Install

Clone directly into your global Antigravity skills directory:

```bash
git clone https://github.com/chaogevision/kids-science-notebook.git ~/.gemini/config/skills/kids-science-notebook
```

Then share any *Science Journal For Kids* PDF with your coding agent and ask:

> "Use `kids-science-notebook` to turn this PDF into an interactive kids' science learning webpage."

## License

[MIT](./LICENSE)
