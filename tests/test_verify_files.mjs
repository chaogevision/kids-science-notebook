import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { projectFileURL, audioFileProblem, expectedNarrations, expectedLocalClips } from '../scripts/verify_files.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '科学 # % notebook '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets/audio/words'), { recursive: true });
  return root;
}

test('file URL safely round-trips Unicode, spaces, # and %', t => {
  const root = fixture(t);
  const url = projectFileURL(root);
  assert.match(url, /%23%20%25/);
  assert.equal(fileURLToPath(url), path.join(root, 'index.html'));
});
test('normal local nonempty MP3 path is accepted', t => {
  const root = fixture(t);
  const rel = 'assets/audio/words/word.mp3';
  fs.writeFileSync(path.join(root, rel), 'fixture');
  assert.equal(audioFileProblem(root, rel), null);
});
test('missing referenced MP3 fails', t => {
  const root = fixture(t);
  assert.match(audioFileProblem(root, 'assets/audio/words/missing.mp3'), /missing/);
});
test('zero-byte MP3 and directory fail', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'assets/audio/empty.mp3'), '');
  fs.mkdirSync(path.join(root, 'assets/audio/dir.mp3'));
  assert.match(audioFileProblem(root, 'assets/audio/empty.mp3'), /non-empty/);
  assert.match(audioFileProblem(root, 'assets/audio/dir.mp3'), /non-empty/);
});
test('case mismatch fails even on case-insensitive filesystems', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'assets/audio/Word.mp3'), 'fixture');
  assert.match(audioFileProblem(root, 'assets/audio/word.mp3'), /case-mismatched/);
});
test('external, absolute, escaped, hidden, or non-MP3 paths fail', t => {
  const root = fixture(t);
  for (const rel of ['https://example.com/x.mp3', 'C:/x.mp3', 'assets/audio/../../x.mp3', 'assets/audio\\x.mp3', 'assets/audio/.hidden.mp3', 'assets/audio/qa-x.mp3', 'assets/audio/a%20b.mp3', 'assets/audio/x.wav', undefined]) {
    assert.match(audioFileProblem(root, rel), /invalid local MP3 path/);
  }
});
test('symlink cannot substitute for a packaged MP3', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'assets/audio/real.mp3'), 'fixture');
  try { fs.symlinkSync('real.mp3', path.join(root, 'assets/audio/link.mp3'), 'file'); }
  catch (e) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(e.code)) return t.skip('symlink unavailable'); throw e; }
  assert.match(audioFileProblem(root, 'assets/audio/link.mp3'), /symlink/);
});
test('expected lesson clips match generator naming', () => {
  const data = { warmup: [{ id: 'w1' }], sections: [{ id: 'methods', paras: [{}, {}] }], vocab: [{ id: 'organic molecules' }] };
  assert.deepEqual(expectedNarrations(data), ['warm_w1', 'sec_methods_0', 'sec_methods_1']);
  assert.deepEqual(expectedLocalClips(data), ['assets/audio/warm_w1.mp3', 'assets/audio/sec_methods_0.mp3', 'assets/audio/sec_methods_1.mp3', 'assets/audio/vocab_organic_molecules.mp3']);
});
