#!/usr/bin/env python3
"""Generate unified Edge TTS narration MP3s (with native WordBoundary timings),
vocab MP3s, and individual tap-to-read word MP3s into data/audio_timings.js."""
import argparse, asyncio, hashlib, json, os, re
import edge_tts

WORD_RE = re.compile(r"[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*")


def plain_for_dom(text):
    text = re.sub(r"\[\[[^\]|]+\|([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    return text


def plain_for_tts(text):
    return plain_for_dom(text).replace("•", ",").strip()


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def align_wb_to_dom(dom_words, wb_events):
    """Align Edge TTS WordBoundary events 1-to-1 with DOM word tokens."""
    if not dom_words:
        return []
    if not wb_events:
        return [[0.0, 0.2] for _ in dom_words]

    aligned = [None] * len(dom_words)
    di = wi = 0
    n_dom, n_wb = len(dom_words), len(wb_events)

    while di < n_dom and wi < n_wb:
        d_norm = norm(dom_words[di])
        w_start, w_end, w_txt = wb_events[wi]
        w_norm = norm(w_txt)

        if not w_norm:
            wi += 1
            continue

        if d_norm == w_norm:
            aligned[di] = [round(w_start, 3), round(w_end, 3)]
            di += 1
            wi += 1
            continue

        if w_norm.startswith(d_norm) and len(w_norm) > len(d_norm):
            group = [di]
            acc = d_norm
            dj = di + 1
            while dj < n_dom and len(acc) < len(w_norm):
                nxt = norm(dom_words[dj])
                if w_norm.startswith(acc + nxt):
                    acc += nxt
                    group.append(dj)
                    dj += 1
                else:
                    break
            if acc == w_norm:
                weights = [max(1, len(norm(dom_words[k]))) for k in group]
                tot = sum(weights)
                t = w_start
                span = max(0.05, w_end - w_start)
                for k, wt in zip(group, weights):
                    dt = span * (wt / tot)
                    aligned[k] = [round(t, 3), round(t + dt, 3)]
                    t += dt
                di = dj
                wi += 1
                continue

        if d_norm.startswith(w_norm) and len(d_norm) > len(w_norm):
            acc = w_norm
            wj = wi + 1
            end_s = w_end
            while wj < n_wb and len(acc) < len(d_norm):
                nxt = norm(wb_events[wj][2])
                if d_norm.startswith(acc + nxt):
                    acc += nxt
                    end_s = wb_events[wj][1]
                    wj += 1
                else:
                    break
            aligned[di] = [round(w_start, 3), round(end_s, 3)]
            di += 1
            wi = wj
            continue

        aligned[di] = [round(w_start, 3), round(w_end, 3)]
        di += 1
        wi += 1

    while di < n_dom:
        prev_end = aligned[di - 1][1] if di > 0 and aligned[di - 1] else 0.0
        aligned[di] = [round(prev_end, 3), round(prev_end + 0.15, 3)]
        di += 1

    if wi != n_wb:
        print(f"    WARNING: leftover wb events {wi}/{n_wb}")
    return aligned


async def synth_narration(audio_dir, key, raw_text, voice, rate, semaphore):
    path = os.path.join(audio_dir, key + ".mp3")
    tts_text = plain_for_tts(raw_text)
    dom_words = WORD_RE.findall(plain_for_dom(raw_text))

    async with semaphore:
        last = ""
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(tts_text, voice, rate=rate, boundary="WordBoundary")
                audio_chunks = bytearray()
                wb_events = []
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        audio_chunks.extend(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        s = chunk["offset"] / 1e7
                        e = (chunk["offset"] + chunk["duration"]) / 1e7
                        wb_events.append((s, e, chunk["text"]))
                if len(audio_chunks) > 500 and wb_events:
                    with open(path, "wb") as f:
                        f.write(audio_chunks)
                    timings = align_wb_to_dom(dom_words, wb_events)
                    return key, timings, len(dom_words), len(wb_events)
            except Exception as exc:
                last = str(exc)
                await asyncio.sleep(1 + attempt)
        raise RuntimeError(f"Failed narration {key}: {last}")


async def synth_simple(path, text, voice, rate, semaphore, force=False):
    if not force and os.path.exists(path) and os.path.getsize(path) > 400:
        return "cached"
    async with semaphore:
        last = ""
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, voice, rate=rate).save(path)
                if os.path.exists(path) and os.path.getsize(path) > 400:
                    return "ok"
            except Exception as exc:
                last = str(exc)
                await asyncio.sleep(0.8 + attempt)
        raise RuntimeError(f"Failed clip {path} ({text}): {last}")


def word_filename(w_lower):
    slug = re.sub(r"[^a-z0-9]+", "_", w_lower).strip("_") or "w"
    h = hashlib.md5(w_lower.encode("utf-8")).hexdigest()[:6]
    return f"w_{slug}_{h}.mp3"


async def run(project_dir, voice=None, rate="-10%", force_words=False):
    data = json.load(open(os.path.join(project_dir, "data", "lesson_data.json"), encoding="utf-8"))
    voice = voice or data.get("meta", {}).get("audioVoice") or "en-US-AriaNeural"
    audio_dir = os.path.join(project_dir, "assets", "audio")
    words_dir = os.path.join(audio_dir, "words")
    os.makedirs(audio_dir, exist_ok=True)
    os.makedirs(words_dir, exist_ok=True)

    sem_narr = asyncio.Semaphore(5)
    sem_words = asyncio.Semaphore(10)

    narr_jobs = [(f"warm_{w['id']}", w["en"]) for w in data.get("warmup", [])]
    for s in data.get("sections", []):
        for i, p in enumerate(s.get("paras", [])):
            narr_jobs.append((f"sec_{s['id']}_{i}", p["en"]))

    word_repr = {}
    for _, raw in narr_jobs:
        for m in WORD_RE.finditer(plain_for_dom(raw)):
            tok = m.group(0)
            low = tok.lower()
            if low not in word_repr or (tok[0].isupper() and not word_repr[low][0].isupper()):
                word_repr[low] = tok

    narr_results = await asyncio.gather(*[
        synth_narration(audio_dir, k, t, voice, rate, sem_narr) for k, t in narr_jobs
    ])

    vocab_tasks = [
        synth_simple(
            os.path.join(audio_dir, f"vocab_{v['id'].replace(' ', '_')}.mp3"),
            v["word"], voice, rate, sem_words, force=force_words
        )
        for v in data.get("vocab", [])
    ]

    word_map = {}
    word_tasks = []
    for low, spoken in sorted(word_repr.items()):
        fname = word_filename(low)
        fpath = os.path.join(words_dir, fname)
        word_map[low] = f"assets/audio/words/{fname}"
        word_tasks.append(synth_simple(fpath, spoken, voice, rate, sem_words, force=force_words))

    await asyncio.gather(*vocab_tasks, *word_tasks)

    timings = {}
    manifest = {}
    for key, t_list, n_dom, n_wb in narr_results:
        timings[key] = t_list
        manifest[key] = f"assets/audio/{key}.mp3"
        print(f"  {key}: dom={n_dom}, wb={n_wb}, aligned={len(t_list)}")

    for v in data.get("vocab", []):
        vk = f"vocab_{v['id'].replace(' ', '_')}"
        manifest[vk] = f"assets/audio/{vk}.mp3"

    with open(os.path.join(project_dir, "data", "audio_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    out_js = os.path.join(project_dir, "data", "audio_timings.js")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write("window.AUDIO_TIMINGS = ")
        json.dump(timings, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\nwindow.WORD_AUDIO_MAP = ")
        json.dump(word_map, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"Done! {len(timings)} narrations, {len(word_map)} tap-to-read words (voice={voice}).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("project_dir")
    ap.add_argument("--voice", default=None)
    ap.add_argument("--rate", default="-10%")
    ap.add_argument("--force-words", action="store_true")
    args = ap.parse_args()
    asyncio.run(run(args.project_dir, args.voice, args.rate, args.force_words))
