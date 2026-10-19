"""The deliverable formats live in three places that must agree: phase_architect/deliverable_formats.json (the
Deliverable agent's checks), workplan.py (slide icons and legend) and validate_plan_v2.js (default when a plan has
no format). Also checks every format has its icon file.
Usage: python3 tests/test_formats.py"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import workplan as wp

spec = json.load(open(os.path.join(ROOT, "phase_architect", "deliverable_formats.json")))
bad = []
ids = [f["id"] for f in spec["formats"]]
if ids != [f for f, _ in wp.FORMATS]:
    bad.append(f"ids differ: json {ids} vs workplan {[f for f, _ in wp.FORMATS]}")
if [f["label"] for f in spec["formats"]] != [l for _, l in wp.FORMATS]:
    bad.append("labels differ between deliverable_formats.json and workplan.FORMATS")
if spec["default_by_kind"] != wp.FORMAT_DEFAULT:
    bad.append(f"defaults differ: json {spec['default_by_kind']} vs workplan {wp.FORMAT_DEFAULT}")
js = open(os.path.join(ROOT, "phase_architect", "validate_plan_v2.js")).read()
m = re.search(r"const FORMAT_DEFAULT = (\{[^}]*\});", js)
jsdef = json.loads(re.sub(r"(\w+):", r'"\1":', m.group(1)).replace("'", '"')) if m else None
if jsdef != spec["default_by_kind"]:
    bad.append(f"validate_plan_v2.js FORMAT_DEFAULT {jsdef} differs from deliverable_formats.json")
for kind, d in spec["default_by_kind"].items():
    if d not in spec["allowed_by_kind"].get(kind, []):
        bad.append(f"default {d} not allowed for {kind}")
for f in ids:
    if not os.path.exists(os.path.join(wp.ICON_DIR, f + ".png")):
        bad.append(f"missing icon {f}.png")
    if f not in spec["brief_words"]:
        bad.append(f"no brief words for {f}")
print("\n".join(bad) if bad else f"formats consistent: {len(ids)} formats, {len(spec['allowed_by_kind'])} kinds, icons present")
sys.exit(1 if bad else 0)
