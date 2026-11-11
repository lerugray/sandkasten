#!/usr/bin/env python3
"""SAND-ART2 gates: determinism, glow-fringe calibration, forbidden pixels, text/rectangle diff.

  python3 docs/art-fable-r2-fixed-sites/tools/gate.py noise    # BEFORE vs CONTROL (same tree): the noise floor
  python3 docs/art-fable-r2-fixed-sites/tools/gate.py calib    # glow fringe, measured in the BEFORE set alone
  python3 docs/art-fable-r2-fixed-sites/tools/gate.py after    # BEFORE vs AFTER: text diff, rectangles, forbidden pixels

The masks are fixed before AFTER is looked at: the icon rectangles of the kinds whose drawing changed (read from the
BEFORE occupancy), grown by 1 px for the sprite's antialiased edge, plus the calibrated glow fringe. Nothing is
masked because it differs.
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(ROOT))
FAC = {f["id"]: f for f in json.load(open(os.path.join(REPO, "data/facilities/hormuz.json")))["facilities"]}
OSI = {s["id"]: s for s in json.load(open(os.path.join(REPO, "data/osint/hormuz.json")))["sites"]}
CAL = os.path.join(ROOT, "fringe-calibration.json")
# Kinds whose drawing body changed. Fixed by the source diff, not by the pixel diff.
CHANGED = set(json.load(open(os.path.join(ROOT, "changed-kinds.json")))) if os.path.exists(os.path.join(ROOT, "changed-kinds.json")) else set()


def kind_of(box):
    if box["kind"] == "facility-icon":
        return FAC[box["id"]]["kind"]
    if box["kind"] == "osint-icon":
        return OSI[box["id"]]["layer"]
    return None


def poses(setname):
    out = []
    for vp in ("1920", "1440", "1280"):
        p = os.path.join(ROOT, setname, f"poses-{vp}.json")
        if os.path.exists(p):
            out += json.load(open(p))
    return out


def load(setname, pose):
    d = json.load(open(os.path.join(ROOT, setname, pose + ".json")))
    im = np.asarray(Image.open(os.path.join(ROOT, setname, pose + ".png")).convert("RGB")).astype(np.int16)
    return d, im


def diff(a, b):
    return np.abs(a - b).max(axis=2)


def rect_px(d, box, grow=0.0):
    """Device-pixel slice of a host-relative CSS box."""
    s = d["dpr"]
    x0 = int(np.floor((box["x"] + d["host"]["x"] - grow) * s)); y0 = int(np.floor((box["y"] + d["host"]["y"] - grow) * s))
    x1 = int(np.ceil((box["x"] + box["w"] + d["host"]["x"] + grow) * s)); y1 = int(np.ceil((box["y"] + box["h"] + d["host"]["y"] + grow) * s))
    H = int(d["viewport"]["h"] * s); W = int(d["viewport"]["w"] * s)
    return max(0, y0), min(H, y1), max(0, x0), min(W, x1)


def full_icon(box, size):
    """occupancy() reports the visible part of an icon; the mask uses the whole sprite square around its centre."""
    return box  # clipped boxes sit at the screen edge or under chrome: the visible part is all that can change


FIELDS = ["host", "dpr", "viewport", "view", "clock", "facilities", "osint", "tracks", "occupancy", "labels", "labelOwners", "centres", "panels", "picks"]


def state_diff(a, b):
    out = []
    for f in FIELDS:
        if json.dumps(a.get(f), sort_keys=True) != json.dumps(b.get(f), sort_keys=True):
            out.append(f)
    return out


def dom_diff(a, b):
    """Visible strings and their line rectangles, node by node. Returns human-readable difference lines."""
    out = []
    A, B = a["dom"], b["dom"]
    if len(A) != len(B):
        out.append(f"text node count {len(A)} -> {len(B)}")
    sa = [x["s"] for x in A]; sb = [x["s"] for x in B]
    if sa != sb:
        for s in sa:
            if s not in sb: out.append(f"- string only before: {s!r}")
        for s in sb:
            if s not in sa: out.append(f"+ string only after: {s!r}")
        if not out or len(out) == 1: out.append("string order differs")
    else:
        for x, y in zip(A, B):
            if x["r"] != y["r"]:
                out.append(f"rect moved for {x['s']!r} ({x['at']}): {x['r']} -> {y['r']}")
    return out


def cmd_noise():
    res = {}
    worst = 0
    for p in poses("before"):
        da, a = load("before", p); db, b = load("control", p)
        d = diff(a, b)
        st = state_diff(da, db); dm = dom_diff(da, db)
        res[p] = {"changed_pixels": int((d > 0).sum()), "max_error": int(d.max()), "state_fields_differing": st, "dom_differences": len(dm)}
        worst = max(worst, int(d.max()))
        print(p, res[p], dm[:3])
    json.dump({"comparison": "BEFORE vs CONTROL, same untouched product tree", "poses": res,
               "total_changed_pixels": sum(r["changed_pixels"] for r in res.values()), "max_error": worst}, open(os.path.join(ROOT, "noise-floor.json"), "w"), indent=1)


def cmd_calib():
    """Glow fringe of one isolated symbol: frame 08 (NUC on) against 08b (same camera, NUC off), BEFORE set only."""
    da, a = load("before", "08-barakah-nuclear-1920"); db, b = load("before", "08b-barakah-nuc-off-1920")
    d = diff(a, b)
    s = da["dpr"]
    icon = [o for o in da["occupancy"] if o["id"] == "nuc-ae-barakah" and o["kind"] == "osint-icon"][0]
    cx = (icon["x"] + icon["w"] / 2 + da["host"]["x"]) * s; cy = (icon["y"] + icon["h"] / 2 + da["host"]["y"]) * s
    # everything else that legitimately differs between the two frames is taken out: labels and icons that exist in
    # only one of them (the site's label, a facility symbol the site had decluttered), and DOM text that moved
    excl = np.zeros(d.shape, bool)
    def key(o): return (o["kind"], o["id"], round(o["x"], 2), round(o["y"], 2), round(o["w"], 2), round(o["h"], 2))
    ka = {key(o) for o in da["occupancy"]}; kb = {key(o) for o in db["occupancy"]}
    for o in da["occupancy"] + db["occupancy"]:
        if (key(o) in ka) != (key(o) in kb) and o["id"] != "nuc-ae-barakah":
            y0, y1, x0, x1 = rect_px(da, o, 4); excl[y0:y1, x0:x1] = True
    ta = {(x["s"], json.dumps(x["r"])) for x in da["dom"]}; tb = {(x["s"], json.dumps(x["r"])) for x in db["dom"]}
    for x in da["dom"] + db["dom"]:
        k = (x["s"], json.dumps(x["r"]))
        if (k in ta) != (k in tb):
            for r in x["r"]:
                y0, y1, x0, x1 = rect_px({**da, "host": {"x": 0, "y": 0}}, {"x": r[0], "y": r[1], "w": r[2], "h": r[3]}, 4); excl[y0:y1, x0:x1] = True
    yy, xx = np.mgrid[0:d.shape[0], 0:d.shape[1]]
    # distance from the sprite square (Chebyshev), in CSS px
    half = icon["w"] / 2 * s
    dist = np.maximum(np.abs(xx - cx), np.abs(yy - cy)) - half
    dist_css = dist / s
    prof = []
    for r0 in range(0, 260, 4):
        m = (dist_css >= r0) & (dist_css < r0 + 4) & ~excl
        prof.append({"from_px": r0, "to_px": r0 + 4, "pixels": int(m.sum()), "changed": int((d[m] > 0).sum()), "max_error": int(d[m].max()) if m.any() else 0})
    # the ring of the site (20 km) is a second removed light source far from the symbol; the fringe is read inside it
    ring_css = None
    quiet = [p for p in prof if p["changed"] == 0]
    first_quiet = quiet[0]["from_px"] if quiet else None
    near = (dist_css > 1) & (dist_css <= (first_quiet or 260)) & ~excl
    out = {
        "method": "BEFORE 08-barakah-nuclear vs BEFORE 08b-barakah-nuc-off: one isolated coalition-tint (brightest) 22 px symbol with its true-position dot removed; distances are from the sprite square edge, CSS px",
        "icon_centre_device_px": [cx, cy],
        "profile": prof,
        "fringe_css_px": first_quiet,
        "max_error_in_fringe": int(d[near].max()) if near.any() else 0,
        "changed_in_fringe": int((d[near] > 0).sum()),
    }
    json.dump(out, open(CAL, "w"), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != "profile"}, indent=1))
    for p in prof[:40]:
        print(p)
    # heatmap of the calibration pair
    os.makedirs(os.path.join(ROOT, "heatmaps"), exist_ok=True)
    y0, y1, x0, x1 = int(cy - 600), int(cy + 600), int(cx - 600), int(cx + 600)
    h = np.clip(d[max(0, y0):y1, max(0, x0):x1] * 40, 0, 255).astype(np.uint8)
    Image.fromarray(h).save(os.path.join(ROOT, "heatmaps", "calibration-08-vs-08b.png"))


TIER_MINZOOM = [3, 5.5, 7.5, 9.5]
EXACT_FAC = ["apt-oikb", "apt-oikp", "apt-oibk", "apt-omfj"]
EXACT_OSI = ["radar-ir-khalij-fars", "radar-ir-sepehr", "nuc-ae-barakah"]  # drawn on their true position (no slot offset)
BANDS = [(0, 8), (8, 30), (30, 100), (100, 100000)]


def facility_tier(f):
    if f["kind"] in ("heliport", "military_area"): return 3
    if f["kind"] == "naval_base": return 0
    if f["kind"] == "port": return 1 if (f.get("areaM2") or 0) > 1_000_000 else 2
    longest = max([0] + [r["lengthM"] for r in f.get("runways") or []])
    if f.get("airportType") == "large_airport" or (f.get("use") == "military" and longest >= 2000): return 0
    if f.get("airportType") == "medium_airport" or f.get("use") == "military": return 1
    return 2


def fit(da):
    """lng/lat -> host CSS px for this pose, fitted to the plot's own reported centres (the projection is linear in
    lng/lat, so a homography is exact flat or tilted). Returns the map and its worst residual on the fit points."""
    pts = [(FAC[i]["position"], da["centres"][i]) for i in EXACT_FAC if da["centres"].get(i)]
    pts += [(OSI[i]["position"], da["centres"][i]) for i in EXACT_OSI if da["centres"].get(i)]
    lng0 = sum(p["lng"] for p, _ in pts) / len(pts); lat0 = sum(p["lat"] for p, _ in pts) / len(pts)
    A = []; bb = []
    flat = da["view"]["tilt"] == 0
    for p, c in pts:
        u, v = p["lng"] - lng0, p["lat"] - lat0
        if flat:
            A.append([u, v, 1, 0, 0, 0]); bb.append(c["x"]); A.append([0, 0, 0, u, v, 1]); bb.append(c["y"])
        else:
            A.append([u, v, 1, 0, 0, 0, -u * c["x"], -v * c["x"]]); bb.append(c["x"]); A.append([0, 0, 0, u, v, 1, -u * c["y"], -v * c["y"]]); bb.append(c["y"])
    h = np.linalg.lstsq(np.array(A, float), np.array(bb, float), rcond=None)[0]
    def m(pos):
        u, v = pos["lng"] - lng0, pos["lat"] - lat0
        if flat: return h[0] * u + h[1] * v + h[2], h[3] * u + h[4] * v + h[5]
        w = h[6] * u + h[7] * v + 1
        return (h[0] * u + h[1] * v + h[2]) / w, (h[3] * u + h[4] * v + h[5]) / w
    res = max(max(abs(m(p)[0] - c["x"]), abs(m(p)[1] - c["y"])) for p, c in pts)
    return m, res


def candidates(da):
    """Every changed-kind symbol that can be on the canvas in this pose, visible or under chrome, drawn or decluttered:
    airbases of a tier the zoom shows, radar sites while the radar layer is on. Positions do not come from the diff."""
    m, res = fit(da)
    W, H = da["host"]["w"], da["host"]["h"]
    k_px = 2 * da["view"]["dist"] * np.tan(np.radians(15)) / H
    zoom = np.log2(139.5 / k_px)
    max_tier = max([-1] + [t for t in range(4) if zoom >= TIER_MINZOOM[t]])
    out = []
    drawn_ids = {o["id"] for o in da["occupancy"] if o["kind"] in ("facility-icon", "osint-icon")}
    if "airbase" in CHANGED or "heliport" in CHANGED or "naval_base" in CHANGED or "port" in CHANGED:
        for f in FAC.values():
            if f["kind"] in CHANGED and facility_tier(f) <= max_tier:
                x, y = m(f["position"])
                if -12 < x < W + 12 and -12 < y < H + 12: out.append({"id": f["id"], "kind": f["kind"], "cx": x, "cy": y, "half": 10, "listed_visible": f["id"] in drawn_ids})
    # OSINT symbols: the plot reports the centre of every site it draws (slot offset included) only for the visible ones;
    # the three radar sites are few enough to take from the occupancy list and, for one under chrome, from its true position
    osint_on = da["osint"]["total"] > 0
    for sid, sdat in OSI.items():
        if sdat["layer"] in CHANGED and osint_on:
            occ = [o for o in da["occupancy"] if o["kind"] == "osint-icon" and o["id"] == sid]
            if occ and abs(occ[0]["w"] - 22) < 0.01 and abs(occ[0]["h"] - 22) < 0.01:
                x, y = occ[0]["x"] + 11, occ[0]["y"] + 11
            else:
                x, y = m(sdat["position"])  # slot offsets are at most 28 px: the square is grown by that below
            pad = 0 if (occ and abs(occ[0]["w"] - 22) < 0.01 and abs(occ[0]["h"] - 22) < 0.01) or sid in EXACT_OSI else 28
            if -40 < x < W + 40 and -40 < y < H + 40: out.append({"id": sid, "kind": sdat["layer"], "cx": x, "cy": y, "half": 11 + pad, "listed_visible": bool(occ)})
    # cross-check: every changed-kind icon the plot lists must be a candidate at the fitted position
    worst = 0.0
    for o in da["occupancy"]:
        if o["kind"] == "facility-icon" and kind_of(o) in CHANGED and abs(o["w"] - 20) < 0.01 and abs(o["h"] - 20) < 0.01:
            c = [c for c in out if c["id"] == o["id"]]
            assert c, f"listed icon {o['id']} missing from candidates"
            worst = max(worst, abs(c[0]["cx"] - (o["x"] + 10)), abs(c[0]["cy"] - (o["y"] + 10)))
    return out, res, worst


def zones(shape, da, cands):
    """interior: candidate sprite squares +1 px (device px mask); dist: CSS px from the nearest candidate square."""
    s = da["dpr"]; hx, hy = da["host"]["x"], da["host"]["y"]
    yy = (np.arange(shape[0], dtype=np.float32) + 0.5) / s - hy
    xx = (np.arange(shape[1], dtype=np.float32) + 0.5) / s - hx
    dist = np.full(shape, 1e6, np.float32)
    for c in cands:
        dx = np.abs(xx - c["cx"]) - (c["half"] + 1); dy = np.abs(yy - c["cy"]) - (c["half"] + 1)
        near_x = dx < 300; near_y = dy < 300
        if not near_x.any() or not near_y.any(): continue
        x0, x1 = np.nonzero(near_x)[0][[0, -1]]; y0, y1 = np.nonzero(near_y)[0][[0, -1]]
        sub = np.maximum(dy[y0:y1 + 1, None], dx[None, x0:x1 + 1])
        dist[y0:y1 + 1, x0:x1 + 1] = np.minimum(dist[y0:y1 + 1, x0:x1 + 1], sub)
    return dist <= 0, dist


def envelope(cal):
    """Whole-symbol glow by distance (CSS px from the sprite square), from the BEFORE calibration pair: the measured
    4 px bands out to 116 px, made non-increasing; held flat beyond (the calibration frame has a ring further out)."""
    prof = [p for p in cal["profile"] if p["to_px"] <= 116]
    vals = [p["max_error"] for p in prof]
    for i in range(len(vals) - 2, -1, -1): vals[i] = max(vals[i], vals[i + 1])
    return vals


def protected_boxes(da):
    """Named protected regions of a pose: labels, data blocks, unit glyphs, scale, unchanged-kind icons, DOM text."""
    out = []
    for o in da["occupancy"]:
        k = kind_of(o)
        if o["kind"] in ("label", "block", "unit", "scale"):
            out.append((o["kind"], o["id"], rect_px(da, o, 0)))
        elif k and k not in CHANGED:
            out.append(("icon-unchanged:" + k, o["id"], rect_px(da, o, 1)))
    z = {**da, "host": {"x": 0, "y": 0}}
    for x in da["dom"]:
        for r in x["r"]:
            out.append(("dom-text", x["s"][:40], rect_px(z, {"x": r[0], "y": r[1], "w": r[2], "h": r[3]}, 0)))
    return out


def cmd_after():
    cal = json.load(open(CAL))
    env = envelope(cal)
    noise = json.load(open(os.path.join(ROOT, "noise-floor.json")))
    os.makedirs(os.path.join(ROOT, "heatmaps"), exist_ok=True)
    res = {}; text_lines = []; ok_text = True; fails = []
    for p in poses("before"):
        da, a = load("before", p); db, b = load("after", p)
        d = diff(a, b)
        st = state_diff(da, db); dm = dom_diff(da, db)
        text_lines.append(f"## {p}: {len(da['dom'])} visible text nodes, {sum(len(x['r']) for x in da['dom'])} line rectangles; state fields differing: {st or 'none'}; text/rect differences: {len(dm)}")
        text_lines += ["   " + l for l in dm]
        if st or dm: ok_text = False
        cands, fit_res, icon_res = candidates(da)
        interior, dist = zones(d.shape, da, cands)
        outside = ~interior
        nf = noise["poses"][p]
        r = {
            "changed_kind_symbols_on_canvas": len(cands), "of_which_listed_visible": sum(1 for c in cands if c["listed_visible"]),
            "position_fit_residual_px": round(float(fit_res), 4), "listed_icon_vs_fit_px": round(float(icon_res), 4),
            "noise_floor": {"changed": nf["changed_pixels"], "max_error": nf["max_error"]},
            "total_changed_pixels": int((d > 0).sum()), "max_error": int(d.max()),
            "interior": {"pixels": int(interior.sum()), "changed": int((d[interior] > 0).sum()), "max_error": int(d[interior].max()) if interior.any() else 0},
            "outside_interior": {"pixels": int(outside.sum()), "changed": int((d[outside] > 0).sum()), "max_error": int(d[outside].max())},
            "bands_css_px": [],
        }
        over = 0
        if cands:
            for lo, hi in BANDS:
                m = (dist > lo) & (dist <= hi)
                v = d[m]
                r["bands_css_px"].append({"from": lo, "to": hi if hi < 100000 else None, "pixels": int(m.sum()), "changed": int((v > 0).sum()), "max_error": int(v.max()) if v.size else 0, "mean_error": round(float(v.mean()), 5) if v.size else 0})
            idx = np.clip((np.maximum(dist, 0) // 4).astype(np.int32), 0, len(env) - 1)
            bound = np.asarray(env, np.int16)[idx]
            over = int(((d > bound) & outside).sum())
            r["pixels_above_whole_symbol_envelope"] = over
            r["pass"] = over == 0
        else:
            r["pass"] = r["total_changed_pixels"] <= nf["changed_pixels"] and r["max_error"] <= nf["max_error"]
        agg = {}; prot = []
        for kind, pid, (y0, y1, x0, x1) in protected_boxes(da):
            if y1 <= y0 or x1 <= x0: continue
            vals = d[y0:y1, x0:x1][~interior[y0:y1, x0:x1]]
            if vals.size == 0: continue
            mx = int(vals.max()); ch = int((vals > 0).sum())
            g = agg.setdefault(kind, {"regions": 0, "regions_changed": 0, "changed_pixels": 0, "max_error": 0})
            g["regions"] += 1; g["regions_changed"] += 1 if ch else 0; g["changed_pixels"] += ch; g["max_error"] = max(g["max_error"], mx)
            if ch: prot.append({"kind": kind, "id": pid, "changed_pixels": ch, "max_error": mx})
        r["protected_by_kind"] = agg
        r["protected_regions_changed_worst"] = sorted(prot, key=lambda x: -x["max_error"])[:12]
        if not r["pass"]: fails.append(p)
        res[p] = r
        print(p, "cands", len(cands), "fit", r["position_fit_residual_px"], r["listed_icon_vs_fit_px"], "total", r["total_changed_pixels"], "max", r["max_error"], "interior", r["interior"]["changed"], "outside", r["outside_interior"]["changed"], r["outside_interior"]["max_error"],
              "bands", [(x["changed"], x["max_error"]) for x in r["bands_css_px"]], "over", over, "text", len(dm), st, "PASS" if r["pass"] else "FAIL")
        if r["total_changed_pixels"]:
            h = np.zeros(d.shape + (3,), np.uint8)
            h[..., 0] = np.clip(d * 60, 0, 255); h[..., 1] = np.where(interior, 70, 0); h[..., 2] = np.clip(d * 60, 0, 255) // 2
            Image.fromarray(h).resize((d.shape[1] // 2, d.shape[0] // 2), Image.BOX).save(os.path.join(ROOT, "heatmaps", p + ".png"))
    control = res.get("15-control-no-glyphs-1920", {})
    zero_c = [p for p, r in res.items() if r["changed_kind_symbols_on_canvas"] == 0]
    summary = {
        "comparison": "BEFORE vs AFTER", "changed_kinds": sorted(CHANGED),
        "criteria": "fixed before AFTER was captured, see REPORT.md: state/rect/text identical; frames with no changed-kind symbol on the canvas pixel-identical (noise floor); elsewhere changes outside the changed sprite squares (+1 px) stay under the whole-symbol glow envelope by distance",
        "envelope_per_4px_band_to_116px_then_flat": env,
        "noise_floor": {"total_changed_pixels": noise["total_changed_pixels"], "max_error": noise["max_error"]},
        "layers_off_control_total_changed_pixels": control.get("total_changed_pixels"),
        "frames_with_no_changed_symbol": {p: res[p]["total_changed_pixels"] for p in zero_c},
        "frames_failing": fails,
        "text_and_rectangles_identical": ok_text,
        "outside_interior_changed_pixels_all_frames": sum(r["outside_interior"]["changed"] for r in res.values()),
        "outside_interior_max_error_all_frames": max(r["outside_interior"]["max_error"] for r in res.values()),
        "verdict": "PASS" if not fails and ok_text and control.get("total_changed_pixels") == 0 else "FAIL",
        "poses": res,
    }
    json.dump(summary, open(os.path.join(ROOT, "forbidden-pixels.json"), "w"), indent=1)
    n = sum(1 for l in text_lines if not l.startswith("##"))
    open(os.path.join(ROOT, "text-diff.txt"), "w").write(
        f"SAND-ART2 text and rectangle diff, BEFORE vs AFTER, every pose. Differences: {n}\n"
        "Compared per pose: every visible DOM text node (whole string, document order) and each of its line rectangles to 0.01 px;\n"
        "plot occupancy boxes (labels, data blocks, unit glyphs, facility and OSINT icon rectangles, scale), label strings and rectangles,\n"
        "label owners, icon centres, camera, drawn counts, panel text, and what a click on each icon picks.\n\n" + "\n".join(text_lines) + "\n")
    print("VERDICT", summary["verdict"], "text differences", n, "failing", fails, "zero-candidate frames", summary["frames_with_no_changed_symbol"])


if __name__ == "__main__":
    {"noise": cmd_noise, "calib": cmd_calib, "after": cmd_after}[sys.argv[1]]()
