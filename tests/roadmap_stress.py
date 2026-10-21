"""Layout check of the approach overview (template 1.4) on every plan from phase_architect/tests/plan_size_test.js
(1 to 4 phases, 2 to 52 weeks) plus the model-made plans in phase_architect/runs/oct18_plan_size, with the
longest objectives, gate labels and decisions the Phase Architect may write.
Usage: node phase_architect/tests/plan_size_test.js && python3 tests/roadmap_stress.py"""
import copy, glob, io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
from pptx import Presentation
import varfill, workplan as wp
from workplan_stress import check_slide

plans = [(os.path.basename(f)[:-5], json.load(open(f))) for f in sorted(glob.glob(os.path.join(ROOT, "phase_architect", "tests", "out_plan_size", "*.json")))]
LONG_OBJ = "Establish what small print shops and resellers need from a direct channel and how distributors would react to it"[:130]
LONG_DEC = "Do the findings on settlement delays stand as the basis for the design phase and its budget?"[:90]
bad = 0
for name, plan in plans:
    for variant in ("as_is", "longest"):
        p = copy.deepcopy(plan)
        p["client"] = "The Navigator Company"
        if variant == "longest":
            for ph in p["phases"]:
                ph["objective_one_line"] = LONG_OBJ
                ph["gate"] = {"label": "Go/no-go on the pilot"[:22], "decision": LONG_DEC}
            for e in p["governance"]["events"]:
                if e["type"] == "gate":
                    e["label"] = "Go/no-go on the pilot"[:22]; e["decision"] = LONG_DEC
                e["attendees"] = ["Chief Commercial Officer", "Head of Digital", "Iberia sales director"]
        prs = varfill._load_template(varfill.TEMPLATES["1.4"])
        s = wp.roadmap_slide(prs, p, "Approach", p["client"])
        title = wp.titles(p)["roadmap"]
        probs = check_slide(s, prs.slide_width, prs.slide_height, 1)
        if len(title) > 110:
            probs.append(f"title {len(title)} chars")
        bad += bool(probs)
        if probs:
            print(f"FAIL {name} {variant}: " + " | ".join(probs[:3]))
print(f"{bad} failing of {2 * len(plans)}")
