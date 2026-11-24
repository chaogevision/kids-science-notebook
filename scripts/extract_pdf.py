#!/usr/bin/env python3
"""Extract verbatim text, embedded bitmaps, and high-DPI page renders (for vector figure cropping)
from a Science Journal For Kids PDF using PyMuPDF (fitz)."""
import argparse, json, os
import pymupdf as fitz


def extract(pdf_path, out_dir, dpi=220):
    os.makedirs(out_dir, exist_ok=True)
    pages_dir = os.path.join(out_dir, "pages")
    emb_dir = os.path.join(out_dir, "embedded")
    os.makedirs(pages_dir, exist_ok=True)
    os.makedirs(emb_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    all_text = []
    meta_pages = []

    for i, page in enumerate(doc):
        pno = i + 1
        txt = page.get_text("text")
        all_text.append(f"=== PAGE {pno} ({page.rect.width:.0f}x{page.rect.height:.0f} pt) ===\n{txt}")

        # Render full page at high DPI so vector diagrams can be inspected and cropped cleanly
        pix = page.get_pixmap(dpi=dpi)
        page_img = os.path.join(pages_dir, f"page_{pno}.png")
        pix.save(page_img)

        # Extract embedded raster images
        imgs = []
        for idx, info in enumerate(page.get_images(full=True)):
            xref = info[0]
            base = doc.extract_image(xref)
            ext = base["ext"]
            fname = f"p{pno}_img{idx + 1}_x{xref}.{ext}"
            fpath = os.path.join(emb_dir, fname)
            with open(fpath, "wb") as f:
                f.write(base["image"])
            imgs.append({"file": f"embedded/{fname}", "width": base["width"], "height": base["height"]})

        meta_pages.append({
            "page": pno,
            "width_pt": page.rect.width,
            "height_pt": page.rect.height,
            "render": f"pages/page_{pno}.png",
            "embedded": imgs,
        })

    txt_path = os.path.join(out_dir, "extracted_text.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(all_text))

    manifest_path = os.path.join(out_dir, "pdf_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"pdf": os.path.abspath(pdf_path), "page_count": len(doc), "pages": meta_pages}, f, indent=2)

    print(f"Extracted {len(doc)} pages -> {out_dir}")
    print(f"  Text: {txt_path}")
    print(f"  Manifest: {manifest_path}")


def crop_region(pdf_path, page_num, x0_frac, y0_frac, x1_frac, y1_frac, out_file, dpi=260):
    """Crop a normalized [0..1] bounding box from a PDF page at high DPI (ideal for vector figures)."""
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]
    r = page.rect
    clip = fitz.Rect(r.width * x0_frac, r.height * y0_frac, r.width * x1_frac, r.height * y1_frac)
    pix = page.get_pixmap(clip=clip, dpi=dpi)
    os.makedirs(os.path.dirname(os.path.abspath(out_file)), exist_ok=True)
    pix.save(out_file)
    print(f"Cropped page {page_num} ({x0_frac},{y0_frac})-({x1_frac},{y1_frac}) -> {out_file} ({pix.width}x{pix.height})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ext = sub.add_parser("extract")
    p_ext.add_argument("pdf")
    p_ext.add_argument("out_dir")
    p_ext.add_argument("--dpi", type=int, default=220)

    p_crop = sub.add_parser("crop")
    p_crop.add_argument("pdf")
    p_crop.add_argument("--page", type=int, required=True)
    p_crop.add_argument("--box", nargs=4, type=float, metavar=("X0", "Y0", "X1", "Y1"), required=True,
                        help="Normalized [0..1] coordinates on the page")
    p_crop.add_argument("--out", required=True)
    p_crop.add_argument("--dpi", type=int, default=260)

    args = ap.parse_args()
    if args.cmd == "extract":
        extract(args.pdf, args.out_dir, args.dpi)
    elif args.cmd == "crop":
        crop_region(args.pdf, args.page, *args.box, args.out, args.dpi)
