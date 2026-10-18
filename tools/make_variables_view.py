"""
Variables view of a template: every variable shows its own name, and the
code-drawn slides (approach overview, timeline, deliverables, steering) are
drawn from a plan whose text fields are replaced by their field paths
(phases[1].name, events[G2].decision, ...). Titles on those slides are composed
by workplan.py from the plan's numbers, so they read as real sentences.

    python3 tools/make_variables_view.py [version] [plan.json] [out.pptx]

Defaults: version 1.4, phase_architect/tests/reference_compiled.json, out/template_<v>_variables.pptx.
For review only; the renderer uses the .potx itself.
"""
import copy
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import varfill  # noqa: E402
import workplan as wp  # noqa: E402


def labelled(plan):
    plan = copy.deepcopy(plan.get("workplan") or plan.get("plan") or plan.get("output") or plan)
    for i, p in enumerate(plan["phases"], 1):
        p["name"] = f"phases[{i}].name"
        p["objective_one_line"] = f"phases[{i}].objective_one_line"
        p["gate"] = {"label": f"phases[{i}].gate.label", "decision": f"phases[{i}].gate.decision"}
    for w in plan["workstreams"]:
        w["name"] = f"workstreams[{w['id']}].name"
    for d in plan["deliverables"]:
        d["name"] = f"deliverables[{d['id']}].name"
    for e in plan["governance"]["events"]:
        lab = f"events[{e['id']}].label"
        for d in plan["deliverables"]:
            if d.get("presented_at") == e["label"]:
                d["presented_at"] = lab
        e["label"] = lab
        e["purpose"] = f"events[{e['id']}].purpose"
        if e.get("decision"):
            e["decision"] = f"events[{e['id']}].decision"
        e["agenda"] = [f"events[{e['id']}].agenda[{j}]" for j in range(1, len(e.get("agenda") or []) + 1)]
        e["attendees"] = ["events[].attendees"]
    # template 1.4: the slide titles are variables; show their names
    plan["_titles"] = {"roadmap": "approach_title_01", "timeline": "timeline_title_01",
                       "deliverables": "deliverables_title_01", "governance": "steering_title_01"}
    return plan


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "1.4"
    plan_file = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "phase_architect", "tests", "reference_compiled.json")
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "out", f"template_{version.replace('.', '_')}_variables.pptx")
    prs = varfill._load_template(varfill.TEMPLATES[version])
    wp.fill_template_slides(prs, labelled(json.load(open(plan_file))), wp.marked_slides(prs), client="{client_name}")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    prs.save(out)
    print("wrote", out, "slides:", len(prs.slides))


if __name__ == "__main__":
    main()
