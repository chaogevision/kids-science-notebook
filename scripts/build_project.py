#!/usr/bin/env python3
"""Scaffold/sync the Scheme B Storybook Science Notebook project from template,
compile lesson_data.json -> lesson_data.js, validate assets, and optionally zip."""
import argparse, json, os, shutil, zipfile

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


def build_data_js(project_dir):
    json_path = os.path.join(project_dir, "data", "lesson_data.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Missing {json_path}")
    data = json.load(open(json_path, encoding="utf-8"))
    js_path = os.path.join(project_dir, "data", "lesson_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.LESSON_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"Compiled {js_path} ({os.path.getsize(js_path)} bytes)")
    return data


def validate_assets(project_dir, data):
    missing = []
    meta = data.get("meta", {})
    cover = meta.get("heroCover", "assets/ui/hero_cover.png")
    if not os.path.exists(os.path.join(project_dir, cover)):
        missing.append(cover)
    for s in data.get("scenes", []):
        if not os.path.exists(os.path.join(project_dir, s["img"])):
            missing.append(s["img"])
    for fig in data.get("figures", []):
        if not os.path.exists(os.path.join(project_dir, fig["file"])):
            missing.append(fig["file"])
    if missing:
        print("WARNING missing visual assets:", missing)
    else:
        print("All visual assets referenced in lesson_data.json exist.")
    return missing


def package_zip(project_dir, zip_path):
    os.makedirs(os.path.dirname(os.path.abspath(zip_path)), exist_ok=True)
    base_name = os.path.basename(os.path.abspath(project_dir))
    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
            for fn in sorted(files):
                if fn.startswith(".") or fn.startswith("qa-"):
                    continue
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, project_dir)
                zf.write(full, os.path.join(base_name, rel))
                count += 1
    print(f"Packaged {count} files -> {zip_path} ({os.path.getsize(zip_path) / (1024*1024):.2f} MB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project_dir", help="Target project output directory")
    ap.add_argument("--init-only", action="store_true", help="Only scaffold template files without requiring lesson_data.json yet")
    ap.add_argument("--zip", dest="zip_path", help="Optional offline .zip output path")
    args = ap.parse_args()

    copy_template(args.project_dir)
    if args.init_only:
        print(f"Scaffolded Scheme B template -> {args.project_dir}")
        return

    data = build_data_js(args.project_dir)
    validate_assets(args.project_dir, data)
    if args.zip_path:
        package_zip(args.project_dir, args.zip_path)


if __name__ == "__main__":
    main()
