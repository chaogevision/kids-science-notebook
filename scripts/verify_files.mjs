import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function projectFileURL(projectDir) {
  return pathToFileURL(path.resolve(projectDir, 'index.html')).href;
}

export function audioFileProblem(root, rel) {
  if (typeof rel !== 'string' || !rel.startsWith('assets/audio/') ||
      !rel.endsWith('.mp3') || /[\\:#?%]/.test(rel) || rel.split('/').some(p => !p || p.startsWith('.') || p === '__pycache__') || path.posix.basename(rel).startsWith('qa-')) {
    return `invalid local MP3 path: ${JSON.stringify(rel)}`;
  }
  try {
    let candidate = root;
    for (const part of rel.split('/')) {
      if (!fs.readdirSync(candidate).includes(part)) return `missing or case-mismatched: ${rel}`;
      candidate = path.join(candidate, part);
      if (fs.lstatSync(candidate).isSymbolicLink()) return `symlink is not a portable packaged asset: ${rel}`;
    }
    const inside = path.relative(fs.realpathSync(root), fs.realpathSync(candidate));
    if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) return `path escapes project: ${rel}`;
    const stat = fs.statSync(candidate);
    if (!stat.isFile() || stat.size === 0) return `not a non-empty file: ${rel}`;
    return null;
  } catch (e) {
    return `${rel}: ${e.message}`;
  }
}

export function expectedNarrations(data) {
  return [...data.warmup.map(w => `warm_${w.id}`), ...data.sections.flatMap(s => s.paras.map((_, i) => `sec_${s.id}_${i}`))];
}

export function expectedLocalClips(data, keys = expectedNarrations(data)) {
  return [...keys.map(k => `assets/audio/${k}.mp3`), ...data.vocab.map(v => `assets/audio/vocab_${v.id.replace(/ /g, '_')}.mp3`)];
}
