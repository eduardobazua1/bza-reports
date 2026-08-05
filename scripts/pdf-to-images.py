#!/usr/bin/env python3
"""
Render a PDF to one PNG per page using PyMuPDF (fitz).
Used by the BZA Intelligence upload route so the AI can READ scanned PDFs
(invoices, delivery notes, packing lists) as images via Claude vision.

Usage:  python3 pdf-to-images.py <input.pdf> <out_dir> [max_pages]
Output: prints one absolute PNG path per line (stdout), in page order.
        Errors go to stderr with a non-zero exit code.

Each page is rendered then downscaled so neither dimension exceeds 1500px
(matching the size the model reads well and keeping the request small).
"""
import sys
import os

def main():
    if len(sys.argv) < 3:
        sys.stderr.write("usage: pdf-to-images.py <input.pdf> <out_dir> [max_pages]\n")
        sys.exit(2)

    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 12

    if not os.path.exists(pdf_path):
        sys.stderr.write(f"file not found: {pdf_path}\n")
        sys.exit(1)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        sys.stderr.write("PyMuPDF (fitz) not installed\n")
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(pdf_path))[0]

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"cannot open pdf: {e}\n")
        sys.exit(1)

    n = min(len(doc), max_pages)
    MAX_DIM = 1500
    for i in range(n):
        page = doc[i]
        zoom = 1.6
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        # downscale if too large for the vision model / request size
        while pix.width > MAX_DIM or pix.height > MAX_DIM:
            zoom *= 0.8
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        out_path = os.path.join(out_dir, f"{base}-p{i + 1}.png")
        pix.save(out_path)
        print(out_path)

    doc.close()

if __name__ == "__main__":
    main()
