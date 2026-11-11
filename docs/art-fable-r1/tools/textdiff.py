#!/usr/bin/env python3
"""SAND-ART1: proof the text held. Compares the visible strings the frame tool recorded for every pose.

    python3 docs/art-fable-r1/tools/textdiff.py [before] [after]

Each pose's text/NN-pose.json holds every visible string on the page (sorted) and each text block that ends
with one word alone on its last line. Two diffs are printed per pose:
  exact   : the sorted string lists compared as they are
  masked  : digits replaced by '#', for poses where the sim clock ran (times, counts and positions then differ
            from run to run of the same tree; the BEFORE-vs-BEFORE control run measures that floor)
Line breaks never enter the comparison (strings are whitespace-collapsed), so a block that only re-broke to cure a
one-word last line compares equal; those cures are listed from the orphan findings instead.
"""
import json, glob, os, re, sys
from collections import Counter

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "handoffs", "sand-art-fable-r1-frames")
b = sys.argv[1] if len(sys.argv) > 1 else "before"
a = sys.argv[2] if len(sys.argv) > 2 else "after"
mask = lambda s: re.sub(r"\d", "#", s)

def diff(x, y):
    cx, cy = Counter(x), Counter(y)
    return sorted((cx - cy).elements()), sorted((cy - cx).elements())

tot_exact = tot_masked = 0
cured, new_orphans, kept = [], [], []
poses = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, a, "text", "*.json")))
print(f"TEXT DIFF {b} -> {a}: {len(poses)} poses")
for p in poses:
    pb = os.path.join(ROOT, b, "text", p)
    if not os.path.exists(pb):
        print(f"  {p[:-5]}: no {b} capture"); continue
    jb, ja = json.load(open(pb)), json.load(open(os.path.join(ROOT, a, "text", p)))
    gone, came = diff(jb["strings"], ja["strings"])
    mg, mc = diff([mask(s) for s in jb["strings"]], [mask(s) for s in ja["strings"]])
    tot_exact += len(gone) + len(came); tot_masked += len(mg) + len(mc)
    print(f"  {p[:-5]}: strings {len(jb['strings'])}/{len(ja['strings'])}  exact -{len(gone)} +{len(came)}  masked -{len(mg)} +{len(mc)}")
    for s in mg: print(f"      - {s}")
    for s in mc: print(f"      + {s}")
    if not mg and not mc:
        for s in gone[:6]: print(f"      (digits only) - {s}")
        for s in came[:6]: print(f"      (digits only) + {s}")
    ob, oa = set(map(mask, jb["orphans"])), set(map(mask, ja["orphans"]))
    for o in sorted(ob - oa): cured.append((p[:-5], o))
    for o in sorted(oa - ob): new_orphans.append((p[:-5], o))
    for o in sorted(oa & ob): kept.append((p[:-5], o))
print(f"TOTAL exact={tot_exact} masked={tot_masked}")

# Control: a second capture of the untouched tree. Whatever differs between two runs of the SAME tree is the
# capture's own run-to-run variation (which data blocks the plot's declutter shows in full, how many record
# lines a real-time run produced). A difference in AFTER is unexplained only if neither BEFORE run shows it.
c = sys.argv[3] if len(sys.argv) > 3 else "before-b"
if os.path.isdir(os.path.join(ROOT, c, "text")):
    ctl = unexplained = 0
    lines = []
    for p in poses:
        pb, pc = os.path.join(ROOT, b, "text", p), os.path.join(ROOT, c, "text", p)
        if not (os.path.exists(pb) and os.path.exists(pc)): continue
        sb = Counter(mask(s) for s in json.load(open(pb))["strings"])
        sc = Counter(mask(s) for s in json.load(open(pc))["strings"])
        sa = Counter(mask(s) for s in json.load(open(os.path.join(ROOT, a, "text", p)))["strings"])
        ctl += sum(((sb - sc) + (sc - sb)).values())
        new = sa - (sb | sc)          # shown in AFTER more often than in either BEFORE run
        lost = (sb & sc) - sa         # shown in both BEFORE runs, missing from AFTER
        n = sum(new.values()) + sum(lost.values())
        unexplained += n
        if n:
            lines.append(f"  {p[:-5]}: +{sum(new.values())} -{sum(lost.values())}")
            lines += [f"      + {s}" for s in sorted(new.elements())] + [f"      - {s}" for s in sorted(lost.elements())]
    print(f"\nCONTROL {b} vs {c} (same tree, two runs): masked={ctl}")
    print(f"UNEXPLAINED in {a} (not in either {b} run, or in both and missing): {unexplained}")
    print("\n".join(lines))
print(f"\nONE-WORD LAST LINES cured ({len(cured)}):")
for p, o in cured: print(f"  {p}: {o}")
print(f"ONE-WORD LAST LINES still present in both ({len(kept)}):")
for p, o in kept: print(f"  {p}: {o}")
print(f"ONE-WORD LAST LINES new in {a} ({len(new_orphans)}):")
for p, o in new_orphans: print(f"  {p}: {o}")
