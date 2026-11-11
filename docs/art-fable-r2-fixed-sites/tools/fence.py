#!/usr/bin/env python3
"""SAND-ART2 source fence check. Run from the repo root; writes docs/art-fable-r2-fixed-sites/fence-check.txt.

Checks, against the launch tip (HEAD, the card commit on the ART1 R2 base):
  - which tracked files differ, and that product changes are confined to the two drawers
  - that every changed line sits inside iconTexture / glyphTexture and before the texture is constructed
  - that the string literals of both files are the same before and after (no product string changed)
  - that no host flag entered playwright.config.ts or any source file
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {"src/lib/plot/facilityLayer.ts": "iconTexture", "src/lib/plot/osintLayer.ts": "glyphTexture"}
ALLOWED_UNTRACKED = ("docs/art-fable-r2-fixed-sites/", "tests/sand-art2-frames.spec.ts")
out = []
ok = True


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout


def say(s):
    out.append(s); print(s)


def check(cond, msg):
    global ok
    ok = ok and bool(cond)
    say(("PASS  " if cond else "FAIL  ") + msg)


say("base (launch tip): " + sh("git", "rev-parse", "HEAD").strip())
say("ART1 R2 base 443af2c vs launch tip, product paths: " + (sh("git", "diff", "--stat", "443af2c1441c285f2bb64db112ac0964bfbc68ed", "HEAD", "--", "src", "tests", "playwright.config.ts", "package.json", "package-lock.json").strip() or "no difference"))
tracked = [l[3:] for l in sh("git", "status", "--porcelain").splitlines() if not l.startswith("??")]
untracked = [l[3:] for l in sh("git", "status", "--porcelain").splitlines() if l.startswith("??")]
say("tracked files changed: " + ", ".join(tracked))
say("untracked: " + ", ".join(untracked))
check(sorted(tracked) == sorted(FILES), "tracked changes are exactly the two drawers")
check(all(u.startswith(ALLOWED_UNTRACKED) for u in untracked), "untracked files are the capture tool and this lane's evidence folder")
check(sh("git", "diff", "--stat", "--", "playwright.config.ts", "package.json", "package-lock.json", "data", "public").strip() == "", "no change to Playwright config, dependencies or data")

LIT = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`')
for path, fn in FILES.items():
    before = sh("git", "show", "HEAD:" + path)
    after = open(path).read()
    bl = before.split("\n"); al = after.split("\n")
    # the function's drawing body: from its declaration to the line that constructs the texture
    def body(lines):
        s = next(i for i, l in enumerate(lines) if l.startswith(f"function {fn}("))
        e = next(i for i in range(s, len(lines)) if "new THREE.CanvasTexture(canvas)" in lines[i])
        return s, e
    bs, be = body(bl); as_, ae = body(al)
    say(f"{path}: {fn} drawing body is lines {bs + 1}-{be} before, {as_ + 1}-{ae} after")
    check(bl[:bs + 1] == al[:as_ + 1], f"{path}: everything up to and including the {fn} declaration is byte-identical")
    check(bl[be:] == al[ae:], f"{path}: everything from the texture construction to the end of the file is byte-identical")
    # inside the body, only drawing statements on the 2D context, comments and the existing branch structure
    changed = [l for l in al[as_ + 1:ae] if l not in bl[bs + 1:be]]
    bad = [l for l in changed if not re.fullmatch(r"\s*(//.*|(g\.[A-Za-z]+(\([^;]*\)| = [0-9.]+);\s*)+)", l)]
    check(not bad, f"{path}: the {len(changed)} new lines are comments or statements on the 2D context `g` only" + ("" if not bad else " -> " + repr(bad)))
    # literals are read from code only: whole-line comments are dropped first (prose may hold an apostrophe)
    code = lambda t: "\n".join(l for l in t.split("\n") if not l.lstrip().startswith("//"))
    check(sorted(LIT.findall(code(before))) == sorted(LIT.findall(code(after))), f"{path}: string literals identical before and after ({len(LIT.findall(code(after)))} literals)")
    hunks = re.findall(r"^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@", sh("git", "diff", "-U0", "--", path), re.M)
    say(f"{path}: hunks (old start,len -> new start,len): " + "; ".join(f"-{a},{b or 1} +{c},{d or 1}" for a, b, c, d in hunks))

flags = sh("git", "grep", "-n", "-e", "--no-sandbox", "-e", "GALLIUM_DRIVER", "-e", "MESA_D3D12", "--", "src", "tests", "playwright.config.ts", "package.json")
untracked_flags = "".join(l for l in open("tests/sand-art2-frames.spec.ts") if "--no-sandbox" in l or "GALLIUM" in l or "MESA_D3D12" in l)
check(flags.strip() == "" and untracked_flags == "", "no host launch flag or GPU env name in source, tests or the Playwright config")
say("RESULT " + ("PASS" if ok else "FAIL"))
open(os.path.join(ROOT, "fence-check.txt"), "w").write("\n".join(out) + "\n")
sys.exit(0 if ok else 1)
