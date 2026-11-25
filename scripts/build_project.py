#!/usr/bin/env python3
"""Scaffold/sync the Scheme B Storybook Science Notebook project from template,
compile lesson_data.json -> lesson_data.js, validate assets, and optionally zip."""
import argparse, json, os, shutil, sys, tempfile, zipfile
from pathlib import Path, PurePosixPath

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_DIR = os.path.join(SKILL_DIR, "assets", "template")


def copy_template(project_dir):
    os.makedirs(project_dir, exist_ok=True)
    for rel in ["index.html", "styles.css", "app.js"]:
        shutil.copy2(os.path.join(TEMPLATE_DIR, rel), os.path.join(project_dir, rel))
    ui_src = os.path.join(TEMPLATE_DIR, "assets", "ui")
    ui_dst = os.path.join(project_dir, "assets", "ui")
    os.makedirs(ui_dst, exist_ok=True)
    for name in os.listdir(ui_src):
        if name.endswith(".svg"):
            shutil.copy2(os.path.join(ui_src, name), os.path.join(ui_dst, name))
    for sub in ["assets/scenes", "assets/figures", "assets/audio", "data"]:
        os.makedirs(os.path.join(project_dir, sub), exist_ok=True)


def load_data(project_dir):
    json_path = os.path.join(project_dir, "data", "lesson_data.json")
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("lesson_data.json must contain a JSON object")
    return data


def build_data_js(project_dir, data=None):
    if data is None:
        data = load_data(project_dir)
    js_path = os.path.join(project_dir, "data", "lesson_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.LESSON_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"Compiled {js_path} ({os.path.getsize(js_path)} bytes)")
    return data


def validate_assets(project_dir, data):
    """Fail closed on invalid, missing, empty or non-file image references.

    Browser verification still checks that the images actually decode.
    Use portable, case-exact, project-relative URL paths in lesson_data.json.
    """
    root = Path(project_dir).resolve()
    errors = []
    refs = [("meta.heroCover", data.get("meta", {}).get("heroCover", "assets/ui/hero_cover.png"))]
    for i, scene in enumerate(data.get("scenes", [])):
        refs.append((f"scenes[{i}].img", scene.get("img")))
    for i, fig in enumerate(data.get("figures", [])):
        refs.append((f"figures[{i}].file", fig.get("file")))
    for field, rel in refs:
        if (not isinstance(rel, str) or not rel or "\\" in rel or ":" in rel
                or "?" in rel or "#" in rel or "%" in rel or "\x00" in rel
                or any(part in ("", ".", "..") for part in rel.split("/"))):
            errors.append(f"{field}: invalid project-relative image path {rel!r}")
            continue
        parts = PurePosixPath(rel).parts
        if any(p.startswith(".") or p == "__pycache__" for p in parts) or parts[-1].startswith("qa-"):
            errors.append(f"{field}: image path would be excluded from ZIP: {rel}")
            continue
        candidate = root.joinpath(*parts)
        try:
            if not candidate.resolve().is_relative_to(root):
                errors.append(f"{field}: path escapes project: {rel}")
                continue
            # Exact spelling also catches paths that only work on case-insensitive disks.
            parent = root
            for part in PurePosixPath(rel).parts:
                if part not in os.listdir(parent):
                    raise FileNotFoundError(rel)
                parent = parent / part
                if parent.is_symlink():
                    raise ValueError("symlink is not a portable packaged asset")
            if not candidate.is_file() or candidate.stat().st_size == 0:
                raise ValueError("not a non-empty file")
        except (OSError, RuntimeError, ValueError) as exc:
            errors.append(f"{field}: {rel} ({exc})")
    if errors:
        raise ValueError("Visual asset validation failed:\n  " + "\n  ".join(errors))
    print("All referenced visual assets exist and are non-empty files.")
    return []


def package_zip(project_dir, zip_path):
    root = Path(project_dir).resolve()
    target = Path(zip_path).resolve()
    if target.is_relative_to(root):
        raise ValueError("ZIP output must be outside the project directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    # Write next to the destination, then replace atomically. Failed packaging
    # must not publish a partial ZIP or overwrite an earlier valid archive.
    fd, temp_path = tempfile.mkstemp(prefix=".notebook-", suffix=".zip", dir=target.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for current, dirs, files in os.walk(root):
                dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d != "__pycache__")
                for fn in sorted(files):
                    if fn.startswith(".") or fn.startswith("qa-"):
                        continue
                    full = Path(current) / fn
                    if not full.resolve().is_relative_to(root):
                        raise ValueError(f"Cannot package file outside project: {full}")
                    rel = full.relative_to(root).as_posix()
                    zf.write(full, f"{root.name}/{rel}")
                    count += 1
        os.replace(temp_path, target)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    print(f"Packaged {count} files -> {target} ({target.stat().st_size / (1024*1024):.2f} MB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project_dir", help="Target project output directory")
    ap.add_argument("--init-only", action="store_true", help="Only scaffold template files without requiring lesson_data.json yet")
    ap.add_argument("--zip", dest="zip_path", help="Optional offline .zip output path (outside the project directory)")
    args = ap.parse_args()
    if args.init_only and args.zip_path:
        ap.error("--init-only and --zip cannot be used together")
    if args.zip_path and Path(args.zip_path).resolve().is_relative_to(Path(args.project_dir).resolve()):
        ap.error("ZIP output must be outside the project directory")

    try:
        copy_template(args.project_dir)
        if args.init_only:
            print(f"Scaffolded Scheme B template -> {args.project_dir}")
            return 0

        data = load_data(args.project_dir)
        validate_assets(args.project_dir, data)
        build_data_js(args.project_dir, data)
        if args.zip_path:
            package_zip(args.project_dir, args.zip_path)
        return 0
    except (OSError, ValueError, RuntimeError, TypeError, AttributeError, KeyError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        if args.zip_path:
            print("No new ZIP was produced; any earlier archive is unchanged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
