"""Offline regression tests for the actual builder CLI; no TTS or browser needed."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

BUILDER = Path(__file__).resolve().parents[1] / "scripts" / "build_project.py"


class BuilderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        # Deliberately tiny template to isolate the real CLI from unrelated UI changes.
        skill = self.root / "skill 测试 #1"
        (skill / "scripts").mkdir(parents=True)
        self.script = skill / "scripts" / BUILDER.name
        shutil.copy2(BUILDER, self.script)
        tpl = skill / "assets" / "template"
        (tpl / "assets/ui").mkdir(parents=True)
        for name in ("index.html", "styles.css", "app.js"):
            (tpl / name).write_text("fixture", encoding="utf-8")
        (tpl / "assets/ui/icon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding="utf-8")
        self.project = self.root / "课程 #1 notebook"
        self.archive = self.root / "课程 offline.zip"
        self.assertEqual(self.run_cli("--init-only").returncode, 0)
        self.data = {
            "meta": {"heroCover": "assets/ui/hero_cover.png"},
            "scenes": [{"img": "assets/scenes/scene 1.jpg"}, {"img": "assets/scenes/场景 2.jpg"}],
            "figures": [{"file": "assets/figures/Figure.png"}],
        }
        for rel in [self.data["meta"]["heroCover"], *(s["img"] for s in self.data["scenes"]), self.data["figures"][0]["file"]]:
            # These nonempty fixture bytes test filesystem validation, not image decoding.
            (self.project / rel).write_bytes(b"test asset")
        self.save_data()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-X", "utf8", str(self.script), str(self.project), *map(str, args)],
                              cwd=self.root, capture_output=True, text=True, encoding="utf-8")

    def save_data(self):
        (self.project / "data/lesson_data.json").write_text(json.dumps(self.data, ensure_ascii=False), encoding="utf-8")

    def assert_blocked(self, field, *extra):
        result = self.run_cli("--zip", self.archive, *extra)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(field, result.stderr)
        self.assertFalse(self.archive.exists())
        self.assertFalse((self.project / "data/lesson_data.js").exists())

    def test_scaffold_without_lesson_or_images(self):
        self.assertTrue((self.project / "index.html").is_file())
        self.assertTrue((self.project / "assets/ui/icon.svg").is_file())
        self.assertFalse((self.project / "data/lesson_data.js").exists())

    def test_valid_build_and_zip(self):
        (self.project / "assets/qa-ipad.png").write_bytes(b"not delivery")
        (self.project / ".secret").write_bytes(b"not delivery")
        result = self.run_cli("--zip", self.archive)
        self.assertEqual(result.returncode, 0, result.stderr)
        js = (self.project / "data/lesson_data.js").read_text(encoding="utf-8")
        self.assertEqual(json.loads(js.removeprefix("window.LESSON_DATA = ").rstrip(";\n")), self.data)
        with zipfile.ZipFile(self.archive) as z:
            self.assertIsNone(z.testzip())
            names = z.namelist()
            for rel in ["data/lesson_data.js", "assets/ui/hero_cover.png", "assets/scenes/场景 2.jpg", "assets/figures/Figure.png"]:
                self.assertIn(self.project.name + "/" + rel, names)
            self.assertFalse(any("qa-" in n or ".secret" in n or "\\" in n for n in names))

    def test_missing_cover(self):
        (self.project / self.data["meta"]["heroCover"]).unlink()
        self.assert_blocked("meta.heroCover")

    def test_missing_second_scene(self):
        (self.project / self.data["scenes"][1]["img"]).unlink()
        self.assert_blocked("scenes[1].img")

    def test_missing_figure(self):
        (self.project / self.data["figures"][0]["file"]).unlink()
        self.assert_blocked("figures[0].file")

    def test_zero_length(self):
        (self.project / self.data["meta"]["heroCover"]).write_bytes(b"")
        self.assert_blocked("non-empty file")

    def test_directory_not_image(self):
        path = self.project / self.data["meta"]["heroCover"]
        path.unlink()
        path.mkdir()
        self.assert_blocked("non-empty file")

    def test_case_mismatch(self):
        self.data["figures"][0]["file"] = "assets/figures/figure.png"
        self.save_data()
        self.assert_blocked("figures[0].file")

    def test_invalid_local_paths(self):
        for rel in ("../outside.png", "C:/file.png", "https://example.com/x.png", "assets\\ui\\hero_cover.png", "assets/.hidden.png", "assets/qa-image.png", "assets/figure%20a.png", None):
            with self.subTest(rel=rel):
                self.data["meta"]["heroCover"] = rel
                self.save_data()
                self.assert_blocked("meta.heroCover")

    def test_missing_reference_key(self):
        del self.data["scenes"][0]["img"]
        self.save_data()
        self.assert_blocked("scenes[0].img")

    def test_default_cover(self):
        del self.data["meta"]["heroCover"]
        self.save_data()
        result = self.run_cli("--zip", self.archive)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_json(self):
        (self.project / "data/lesson_data.json").unlink()
        self.assert_blocked("lesson_data.json")

    def test_existing_archive_unchanged_on_missing_asset(self):
        good = self.run_cli("--zip", self.archive)
        self.assertEqual(good.returncode, 0, good.stderr)
        digest = hashlib.sha256(self.archive.read_bytes()).digest()
        js = (self.project / "data/lesson_data.js").read_bytes()
        (self.project / self.data["meta"]["heroCover"]).unlink()
        result = self.run_cli("--zip", self.archive)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(hashlib.sha256(self.archive.read_bytes()).digest(), digest)
        self.assertEqual((self.project / "data/lesson_data.js").read_bytes(), js)

    def test_output_inside_project_rejected(self):
        nested = self.project / "inside.zip"
        result = self.run_cli("--zip", nested)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(nested.exists())

    def test_init_and_zip_mutually_exclusive(self):
        result = self.run_cli("--init-only", "--zip", self.archive)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.archive.exists())

    def test_failed_zip_preserves_existing_file(self):
        self.archive.write_bytes(b"existing output")
        outside = self.root / "outside.txt"
        outside.write_bytes(b"not allowed")
        try:
            (self.project / "outside-link.txt").symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable on this platform")
        result = self.run_cli("--zip", self.archive)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.archive.read_bytes(), b"existing output")
        self.assertFalse(list(self.root.glob(".notebook-*.zip")))

    def test_image_symlink_rejected(self):
        cover = self.project / self.data["meta"]["heroCover"]
        cover.unlink()
        try:
            cover.symlink_to(self.project / self.data["figures"][0]["file"])
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable on this platform")
        self.assert_blocked("meta.heroCover")


if __name__ == "__main__":
    unittest.main()
