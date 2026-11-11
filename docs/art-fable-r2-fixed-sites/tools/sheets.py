#!/usr/bin/env python3
"""SAND-ART2 sheets, built only from the captured frames and the intercepted production textures.

  python3 docs/art-fable-r2-fixed-sites/tools/sheets.py glyphs      # glyph-sheet.png (seven rows, BEFORE/AFTER)
  python3 docs/art-fable-r2-fixed-sites/tools/sheets.py pairs       # pairs/<pose>.jpg, whole frames side by side
  python3 docs/art-fable-r2-fixed-sites/tools/sheets.py protected   # two protected-region sheets
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(ROOT))
FAC = {f["id"]: f for f in json.load(open(os.path.join(REPO, "data/facilities/hormuz.json")))["facilities"]}
OSI = {s["id"]: s for s in json.load(open(os.path.join(REPO, "data/osint/hormuz.json")))["sites"]}
KINDS = ["airbase", "heliport", "naval_base", "port", "ad", "radar", "nuclear"]
BG = (6, 14, 10)
INK = (190, 235, 205)
DIMINK = (110, 150, 125)


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def poses(setname, vp="1920"):
    return json.load(open(os.path.join(ROOT, setname, f"poses-{vp}.json")))


def meta(setname, pose):
    return json.load(open(os.path.join(ROOT, setname, pose + ".json")))


_img = {}
def frame(setname, pose):
    k = (setname, pose)
    if k not in _img:
        _img.clear()
        _img[k] = Image.open(os.path.join(ROOT, setname, pose + ".png")).convert("RGB")
    return _img[k]


def variant(box):
    """(kind, tint) of an icon box, by the layer's own colour rule."""
    if box["kind"] == "facility-icon":
        f = FAC[box["id"]]
        mil = (f.get("use") == "military") if f.get("use") else f["kind"] == "naval_base"
        return f["kind"], "military (phosphor)" if mil else "civil (phosphor dim)"
    if box["kind"] == "osint-icon":
        s = OSI[box["id"]]
        return s["layer"], "Iran (alarm)" if s["affiliation"] == "iran" else "coalition (phosphor hi)"
    return None, None


def pick_instances():
    """For every kind and tint present in the data, the cleanest fully visible instance across the 1920 poses."""
    best = {}
    for pose in poses("before"):
        d = meta("before", pose)
        if pose.startswith("00-") or pose.startswith("13-"):
            continue
        im = np.asarray(frame("before", pose)).astype(np.int32).sum(axis=2)
        s = d["dpr"]
        for o in d["occupancy"]:
            kind, tint = variant(o)
            if not kind:
                continue
            size = 20 if o["kind"] == "facility-icon" else 22
            if abs(o["w"] - size) > 0.01 or abs(o["h"] - size) > 0.01:
                continue
            cx = (o["x"] + o["w"] / 2 + d["host"]["x"]) * s; cy = (o["y"] + o["h"] / 2 + d["host"]["y"]) * s
            h = int(size * s / 2)
            a = im[int(cy) - h - 14:int(cy) + h + 14, int(cx) - h - 14:int(cx) + h + 14]
            if a.shape != (2 * h + 28, 2 * h + 28):
                continue
            ring = a.copy(); ring[10:-10, 10:-10] = 0
            score = float(ring.sum())
            if (kind, tint) not in best or score < best[(kind, tint)][0]:
                best[(kind, tint)] = (score, pose, o["id"], cx, cy)
    return best


def crop(setname, pose, cx, cy, half=30):
    return frame(setname, pose).crop((int(round(cx)) - half, int(round(cy)) - half, int(round(cx)) + half, int(round(cy)) + half))


def tex(setname, kind):
    p = os.path.join(ROOT, setname, "textures", kind + ".png")
    t = Image.open(p).convert("RGBA")
    bg = Image.new("RGBA", t.size, BG + (255,)); bg.alpha_composite(t)
    return bg.convert("RGB"), hashlib.sha256(open(p, "rb").read()).hexdigest()


def cmd_glyphs():
    best = pick_instances()
    f12, f14, f18 = font(12), font(14), font(18)
    ROW = 300; W = 2590
    sheet = Image.new("RGB", (W, 70 + ROW * len(KINDS)), BG)
    dr = ImageDraw.Draw(sheet)
    dr.text((16, 10), "SAND-ART2 fixed-site glyphs: BEFORE / AFTER. Left: the production texture the drawer made in the page (64 px, shown 4x nearest). Right: the same symbol in the production chart, cropped from the 1920x1080 DPR 2 frames at real device pixels and 4x nearest.", fill=INK, font=f12)
    dr.text((16, 30), "Each chart crop is 30 CSS px square (60 device px). Facility symbols display at 20 CSS px, OSINT symbols at 22. No neutral-affiliation OSINT site exists in the checked-in data: that tint is shown as a labelled fixture, not a chart crop.", fill=DIMINK, font=f12)
    manifest = {}
    for r, kind in enumerate(KINDS):
        y = 70 + r * ROW
        dr.line((0, y - 6, W, y - 6), fill=(30, 60, 44))
        tb, hb = tex("before", kind); ta, ha = tex("after", kind)
        same = hb == ha
        dr.text((16, y), kind.upper().replace("_", " "), fill=INK, font=f18)
        dr.text((16, y + 26), "NO CHANGE" if same else "CHANGED", fill=(150, 150, 150) if same else (255, 210, 90), font=f18)
        dr.text((16, y + 52), "texture bytes identical" if same else "texture redrawn", fill=DIMINK, font=f12)
        x = 190
        for label, t in (("BEFORE texture", tb), ("AFTER texture", ta)):
            sheet.paste(t.resize((256, 256), Image.NEAREST), (x, y + 18)); dr.text((x, y), label, fill=DIMINK, font=f12); x += 266
        x += 20
        manifest[kind] = {"changed": not same, "texture_sha256_before": hb, "texture_sha256_after": ha, "crops": []}
        for (k, tint), (score, pose, iid, cx, cy) in sorted(best.items()):
            if k != kind:
                continue
            dr.text((x, y), f"{tint}  {iid}  [{pose}]", fill=DIMINK, font=f12)
            cb = crop("before", pose, cx, cy); ca = crop("after", pose, cx, cy)
            sheet.paste(cb, (x, y + 18)); sheet.paste(ca, (x, y + 18 + 70))
            dr.text((x, y + 18 + 134), "1:1 B / A", fill=DIMINK, font=f12)
            sheet.paste(cb.resize((240, 240), Image.NEAREST), (x + 70, y + 18)); sheet.paste(ca.resize((240, 240), Image.NEAREST), (x + 70 + 250, y + 18))
            dr.text((x + 70, y + 262), "BEFORE 4x", fill=DIMINK, font=f12); dr.text((x + 320, y + 262), "AFTER 4x", fill=DIMINK, font=f12)
            manifest[kind]["crops"].append({"tint": tint, "id": iid, "pose": pose, "centre_device_px": [cx, cy]})
            x += 590
        if kind in ("ad", "radar", "nuclear"):
            # The layer has a third tint (neutral affiliation, phosphor dim) that no checked-in site uses. FIXTURE, not a
            # chart crop: the production texture resampled to 44 device px and multiplied by the palette colour.
            dr.text((x, y), "neutral (phosphor dim)  FIXTURE, no such site in data", fill=(255, 210, 90), font=f12)
            for k2, setname in enumerate(("before", "after")):
                t = Image.open(os.path.join(ROOT, setname, "textures", kind + ".png")).convert("RGBA").resize((44, 44), Image.BILINEAR)
                al = np.asarray(t)[..., 3:4].astype(np.float32) / 255
                tile = np.zeros((60, 60, 3), np.float32) + np.array(BG, np.float32)
                tile[8:52, 8:52] += al * np.array((0x2b, 0x9e, 0x5c), np.float32)
                im = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8))
                sheet.paste(im, (x, y + 18 + 70 * k2)); sheet.paste(im.resize((240, 240), Image.NEAREST), (x + 70 + 250 * k2, y + 18))
            dr.text((x, y + 18 + 134), "1:1 B / A", fill=DIMINK, font=f12)
            dr.text((x + 70, y + 262), "BEFORE 4x (fixture)", fill=DIMINK, font=f12); dr.text((x + 320, y + 262), "AFTER 4x (fixture)", fill=DIMINK, font=f12)
    sheet.save(os.path.join(ROOT, "glyph-sheet.png"))
    json.dump(manifest, open(os.path.join(ROOT, "glyph-sheet.json"), "w"), indent=1)
    print(json.dumps({k: (v["changed"], [(c["tint"], c["id"], c["pose"]) for c in v["crops"]]) for k, v in manifest.items()}, indent=1))


def cmd_pairs():
    os.makedirs(os.path.join(ROOT, "pairs"), exist_ok=True)
    f = font(22)
    for vp in ("1920", "1440", "1280"):
        if not os.path.exists(os.path.join(ROOT, "before", f"poses-{vp}.json")):
            continue
        for pose in poses("before", vp):
            b = Image.open(os.path.join(ROOT, "before", pose + ".png")).convert("RGB"); a = Image.open(os.path.join(ROOT, "after", pose + ".png")).convert("RGB")
            w, h = b.size[0] // 2, b.size[1] // 2
            out = Image.new("RGB", (w * 2 + 12, h + 40), BG)
            out.paste(b.resize((w, h), Image.LANCZOS), (0, 40)); out.paste(a.resize((w, h), Image.LANCZOS), (w + 12, 40))
            dr = ImageDraw.Draw(out)
            dr.text((12, 8), f"BEFORE  {pose}", fill=INK, font=f); dr.text((w + 24, 8), f"AFTER  {pose}", fill=INK, font=f)
            out.save(os.path.join(ROOT, "pairs", pose + ".jpg"), quality=92)
    print("pairs written")


_zone = {}
def interior_mask(pose):
    """Changed-kind sprite squares (+1 px) of a pose, from the gate's own candidate list."""
    if pose not in _zone:
        sys.path.insert(0, HERE)
        import gate
        d = meta("before", pose)
        cands, _, _ = gate.candidates(d)
        w, h = frame("before", pose).size
        _zone.clear()
        _zone[pose] = gate.zones((h, w), d, cands)[0]
    return _zone[pose]


def region_row(sheet, dr, y, title, pose, box_css, f12):
    """One protected region: BEFORE, AFTER and the absolute difference x40, at device pixels. The numbers are for the
    crop without the redrawn sprite squares (outlined in the difference panel), which are the art and not protected."""
    d = meta("before", pose); s = d["dpr"]
    x0, y0, w, h = [int(round(v * s)) for v in box_css]
    b = frame("before", pose).crop((x0, y0, x0 + w, y0 + h)); a = frame("after", pose).crop((x0, y0, x0 + w, y0 + h))
    df = np.abs(np.asarray(b).astype(np.int16) - np.asarray(a).astype(np.int16)).max(axis=2)
    inner = interior_mask(pose)[y0:y0 + h, x0:x0 + w]
    prot = df[~inner]
    heat = np.clip(df * 40, 0, 255).astype(np.uint8)
    rgb = np.stack([heat, heat, heat], axis=2)
    edge = inner & ~(np.roll(inner, 1, 0) & np.roll(inner, -1, 0) & np.roll(inner, 1, 1) & np.roll(inner, -1, 1))
    rgb[edge] = (255, 210, 90)
    heat = Image.fromarray(rgb)
    n = int((prot > 0).sum()); mx = int(prot.max()) if prot.size else 0
    dr.text((12, y), f"{title}   [{pose}]   outside the redrawn sprite squares: {n} of {prot.size} pixels differ, largest error {mx}/255" + ("  (identical)" if n == 0 else "  (glow only)"), fill=INK, font=f12)
    for i, (lab, im) in enumerate((("BEFORE", b), ("AFTER", a), ("|diff| x40, redrawn squares outlined", heat))):
        sheet.paste(im, (12 + i * (w + 12), y + 20))
        dr.text((12 + i * (w + 12) + 4, y + 22), lab, fill=(255, 210, 90), font=f12)
    return {"title": title, "pose": pose, "box_css": box_css, "protected_pixels": int(prot.size), "protected_changed_pixels": n, "protected_max_error": mx,
            "redrawn_sprite_pixels_in_crop": int(inner.sum())}, y + 20 + h + 16


def centre_box(d, cid, w, h, dx=0, dy=0):
    c = d["centres"][cid]
    return [c["x"] + d["host"]["x"] + dx - w / 2, c["y"] + d["host"]["y"] + dy - h / 2, w, h]


def occ_box(d, kind, pad, pred=lambda o: True, n=0):
    o = [o for o in d["occupancy"] if o["kind"] == kind and pred(o)][n]
    return [o["x"] + d["host"]["x"] - pad, o["y"] + d["host"]["y"] - pad, o["w"] + 2 * pad, o["h"] + 2 * pad], o["id"]


def cmd_protected():
    f12 = font(13)
    out = {}
    # sheet 1: geometry
    rows = []
    d10 = meta("before", "10-kish-two-runways-1920"); d11 = meta("before", "11-fujairah-construction-1920")
    d03 = meta("before", "03-bandar-abbas-close-1920"); d02 = meta("before", "02-bandar-abbas-crowded-1920"); d06 = meta("before", "06-bushehr-nuclear-close-1920")
    rows.append(("Kish: both runways and their end labels (airfield symbol withdrawn)", "10-kish-two-runways-1920", centre_box(d10, "apt-oibk", 520, 300)))
    rows.append(("Fujairah: runway and construction strip", "11-fujairah-construction-1920", centre_box(d11, "apt-omfj", 520, 300)))
    rows.append(("Havadarya: co-located true-position dot under the S-300 symbol, runway, outlines", "03-bandar-abbas-close-1920", centre_box(d03, "ad-ir-s300-bandar-abbas", 200, 150, 0, 20)))
    rows.append(("Bandar Abbas: estimated (dashed) AD ring crossing the chart", "02-bandar-abbas-crowded-1920", [760, 90, 520, 160]))
    rows.append(("Bushehr: measured (solid) nuclear ring, estimated Tor ring, co-located dot", "06-bushehr-nuclear-close-1920", centre_box(d06, "nuc-ir-bushehr-reactor", 420, 300, 20, 0)))
    for name, items in (("protected-geometry.png", rows),):
        W = max(int(r[2][2] * 2) for r in items) * 3 + 60; H = sum(int(r[2][3] * 2) + 36 for r in items) + 20
        sheet = Image.new("RGB", (W, H), BG); dr = ImageDraw.Draw(sheet); y = 10; res = []
        for title, pose, box in items:
            r, y = region_row(sheet, dr, y, title, pose, box, f12); res.append(r)
        sheet.save(os.path.join(ROOT, name)); out[name] = res
    # sheet 2: unit glyphs and labels
    rows = []
    d01 = meta("before", "01-cold-chart-1920"); d04 = meta("before", "04-ad-selected-rings-1920")
    for n in range(3):
        box, uid = occ_box(d01, "unit", 46, n=n)
        rows.append((f"cold chart: unit glyph {uid} with its data block", "01-cold-chart-1920", box))
    box, lid = occ_box(d02, "label", 30, pred=lambda o: "HAVADARYA" in o["id"])
    rows.append((f"label '{lid}' beside the Havadarya airbase symbol", "02-bandar-abbas-crowded-1920", box))
    box, lid = occ_box(d02, "label", 30, pred=lambda o: "KHALIJ FARS" in o["id"])
    rows.append((f"label '{lid}' beside the radar symbol", "02-bandar-abbas-crowded-1920", box))
    rows.append(("selected S-300: selection ring, panel edge, units", "04-ad-selected-rings-1920", centre_box(d04, "ad-ir-s300-bandar-abbas", 420, 260)))
    W = max(int(r[2][2] * 2) for r in rows) * 3 + 60; H = sum(int(r[2][3] * 2) + 36 for r in rows) + 20
    sheet = Image.new("RGB", (W, H), BG); dr = ImageDraw.Draw(sheet); y = 10; res = []
    for title, pose, box in rows:
        r, y = region_row(sheet, dr, y, title, pose, box, f12); res.append(r)
    sheet.save(os.path.join(ROOT, "protected-units-labels.png")); out["protected-units-labels.png"] = res
    json.dump(out, open(os.path.join(ROOT, "protected-regions.json"), "w"), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    {"glyphs": cmd_glyphs, "pairs": cmd_pairs, "protected": cmd_protected}[sys.argv[1]]()
