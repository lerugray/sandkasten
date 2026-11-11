#!/usr/bin/env python3
"""SAND-ART1: lay each pose's BEFORE frame beside its AFTER frame (before left, after right).

    python3 docs/art-fable-r1/tools/pairs.py

Reads docs/handoffs/sand-art-fable-r1-frames/{before,after}/NN-pose.png and writes
after/pairs/NN-pose.jpg: both frames at half size (1920x1080 each, the CSS pixel grid) under a caption bar.
The full DPR-2 frames stay beside them untouched. Also writes the drawn-effect crop sheet
docs/art-fable-r1/plot-details.png: crops of the same screen rectangle from both sets at real pixels and 4x.
Needs Pillow (host tool, not an npm dependency).
"""
import glob, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "handoffs", "sand-art-fable-r1-frames")
B, A = os.path.join(ROOT, "before"), os.path.join(ROOT, "after")
OUT = os.path.join(A, "pairs")
os.makedirs(OUT, exist_ok=True)

def bar(w, text):
    im = Image.new("RGB", (w, 36), (2, 10, 6))
    ImageDraw.Draw(im).text((12, 10), text, fill=(185, 244, 207))
    return im

n = 0
for a in sorted(glob.glob(os.path.join(A, "[0-9][0-9]*.png"))):
    name = os.path.basename(a)
    b = os.path.join(B, name)
    if not os.path.exists(b):
        print("no BEFORE frame for", name); continue
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    w, h = ia.width // 2, ia.height // 2
    ia, ib = ia.resize((w, h), Image.LANCZOS), ib.resize((w, h), Image.LANCZOS)
    out = Image.new("RGB", (w * 2 + 8, h + 36), (0, 0, 0))
    out.paste(bar(w, "BEFORE (base fc33750)  " + name), (0, 0))
    out.paste(bar(w, "AFTER (sand/art-fable-r1)  " + name), (w + 8, 0))
    out.paste(ib, (0, 36)); out.paste(ia, (w + 8, 36))
    out.save(os.path.join(OUT, name.replace(".png", ".jpg")), quality=90)
    n += 1
print(n, "pairs written to", os.path.relpath(OUT))

# crops of line-drawn subjects (not sprites): the same rectangle of the same pose from both sets
CROPS = [
    ("missile darts and trails (08)", "08-missiles-in-flight.png", None),
    ("a hit, 0.2 s in (10)", "10-hit.png", None),
    ("a kill, 0.3 s in (11)", "11-kill.png", None),
]
def find_bright(path):
    """Centre of the brightest red/white activity on the plot area, device pixels."""
    import numpy as np
    im = np.asarray(Image.open(path).convert("RGB")).astype(int)
    plot = im[100:1780, 760:3800]
    score = plot[:, :, 0] * 2 - plot[:, :, 1]  # red and white beat green
    ys, xs = np.where(score > 330)
    if len(xs) == 0: return (2200, 900)
    return (int(np.median(xs)) + 760, int(np.median(ys)) + 100)

rows = []
for title, name, _ in CROPS:
    pa, pb = os.path.join(A, name), os.path.join(B, name)
    if not (os.path.exists(pa) and os.path.exists(pb)): continue
    cx, cy = find_bright(pb)
    box = (cx - 160, cy - 120, cx + 160, cy + 120)
    cb, ca = Image.open(pb).convert("RGB").crop(box), Image.open(pa).convert("RGB").crop(box)
    rows.append((title, cb, ca))
if rows:
    cw, ch = 320, 240
    W = 40 + cw + 20 + cw * 4 + 40 + cw + 20 + cw * 4 + 20
    H = 50 + len(rows) * (ch * 4 + 50)
    sheet = Image.new("RGB", (W, H), (3, 14, 8))
    d = ImageDraw.Draw(sheet)
    d.text((40, 16), "BEFORE: real pixels (DPR 2), then 4x", fill=(185, 244, 207))
    d.text((40 + cw + 20 + cw * 4 + 40, 16), "AFTER: real pixels (DPR 2), then 4x", fill=(185, 244, 207))
    for i, (title, cb, ca) in enumerate(rows):
        y = 50 + i * (ch * 4 + 50)
        d.text((40, y), title, fill=(185, 244, 207))
        y += 22
        x = 40
        for c in (cb, ca):
            sheet.paste(c, (x, y + (ch * 4 - ch) // 2)); x += cw + 20
            sheet.paste(c.resize((cw * 4, ch * 4), Image.NEAREST), (x, y)); x += cw * 4 + 40
    sheet.save(os.path.join(os.path.dirname(__file__), "..", "plot-details.png"))
    print("plot-details.png written")
