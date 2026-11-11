#!/usr/bin/env python3
"""SAND-ART1 R2: lay each re-shot pose beside its BEFORE frame and its round-1 AFTER frame.

    python3 docs/art-fable-r2/tools/pairs_r2.py

Reads docs/handoffs/sand-art-fable-r1-frames/{before,after,after-r2}/NN-pose.png and writes two files per pose
into after-r2/pairs/: NN-pose.jpg (BEFORE left, R2 right, both at half size: the CSS pixel grid) and
NN-pose-crop.png (the same screen rectangle from BEFORE, R1 and R2 at real pixels, for the touched text).
Needs Pillow (host tool, not an npm dependency).
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "handoffs", "sand-art-fable-r1-frames")
OUT = os.path.join(ROOT, "after-r2", "pairs")
os.makedirs(OUT, exist_ok=True)
# pose -> the rectangle (device pixels of the 3840x2160 frame) that holds the text this round touched
CROPS = {
    "09-missiles-combat-tab": (16, 500, 704, 1060),
    "10-hit": (16, 500, 704, 1060),
    "21-help": (1400, 500, 2440, 1240),
    "26-wego-review": (2730, 150, 3810, 990),
    "27-debrief-victory": (1300, 780, 2560, 1740),
    "28-debrief-defeat": (1300, 780, 2560, 1740),
}

def bar(w, text):
    im = Image.new("RGB", (w, 36), (2, 10, 6))
    ImageDraw.Draw(im).text((12, 10), text, fill=(185, 244, 207))
    return im

def load(folder, pose):
    return Image.open(os.path.join(ROOT, folder, pose + ".png")).convert("RGB")

for pose, box in CROPS.items():
    b, r1, r2 = load("before", pose), load("after", pose), load("after-r2", pose)
    w, h = r2.width // 2, r2.height // 2
    pair = Image.new("RGB", (w * 2 + 8, h + 36), (0, 0, 0))
    pair.paste(bar(w, "BEFORE (base fc33750)  " + pose), (0, 0))
    pair.paste(bar(w, "AFTER (sand/art-fable-r2)  " + pose), (w + 8, 0))
    pair.paste(b.resize((w, h), Image.LANCZOS), (0, 36))
    pair.paste(r2.resize((w, h), Image.LANCZOS), (w + 8, 36))
    pair.save(os.path.join(OUT, pose + ".jpg"), quality=90)
    cw, ch = box[2] - box[0], box[3] - box[1]
    sheet = Image.new("RGB", (cw * 3 + 16, ch + 36), (0, 0, 0))
    for i, (im, label) in enumerate([(b, "BEFORE"), (r1, "R1 AFTER (rejected)"), (r2, "R2 AFTER")]):
        sheet.paste(bar(cw, label + "  " + pose), (i * (cw + 8), 0))
        sheet.paste(im.crop(box), (i * (cw + 8), 36))
    sheet.save(os.path.join(OUT, pose + "-crop.png"))
    print("wrote", pose)
