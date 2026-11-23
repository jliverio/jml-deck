"""Test plans with 1 to 5 phases and every text at its limit, built from the MetalCo test plan.
Used by tests/test_research_slides.py for the approach slide of template 1.5.4 (the phases beside the panel).

    plan(n, scoped=True) -> a plan with n phases; scoped: each phase has a scope of 300 characters (216 from 4 phases)
"""
import copy
import json
import os

BASE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "metalco_1_4.json"), encoding="utf8"))["workplan"]
NAMES = ["Diagnostic", "Design", "Pilot", "Implementation", "Change & Training"]
SCOPE300 = ("Map how orders move from the sales desk to the plant today, measure where time and margin are lost in each of "
            "the three product lines, and agree with the commercial and operations heads which two of the losses the pilot "
            "should attack first, with the data each will need from the ERP team to be tested")
SCOPE220 = ("Map how orders move from the sales desk to the plant, measure where time and margin are lost in each product "
            "line, and agree with the commercial and operations heads which two losses the pilot attacks first this year")
GATES = [("Go/no-go on the pilot scope", "Do we take the two priority losses into a pilot, with the plant in Aveiro as the test site and the budget agreed in the proposal?"),
         ("Design sign-off", "Do we build the new order process as designed, and does the ERP team commit the two people it needs for twelve weeks?"),
         ("Go/no-go on roll-out", "Did the pilot cut order lead time by the agreed 20%, and do we roll the process out to the other two plants on this plan?"),
         ("Roll-out review", "Are the three plants running the new process at the agreed service level, and can the project team hand over to operations?"),
         ("Handover decision", "Do the plant managers own the new process, with the training completed and the measures reported monthly to the board?")]


def plan(n, scoped=True, total=24, client="MetalCo"):
    p = copy.deepcopy(BASE)
    p["client"] = client
    step = total // n
    bounds = [(i * step + 1, (i + 1) * step if i < n - 1 else total) for i in range(n)]
    p["phases"] = []
    for i, (a, b) in enumerate(bounds):
        ph = {"name": NAMES[i], "order": i + 1, "start_week": a, "end_week": b, "duration_weeks": {"min": b - a + 1, "max": b - a + 1},
              "duration_derived": False, "objective_one_line": "Answer the key questions on the order process and agree what the next phase will test and with whom",
              "gate": {"label": GATES[i][0], "decision": GATES[i][1]}, "depends_on_assumptions": [], "workstream_ids": []}
        if scoped:
            ph["scope"] = (SCOPE300 if n <= 3 else SCOPE220)
            assert 212 <= len(ph["scope"]) <= 300, len(ph["scope"])
        p["phases"].append(ph)
    ws = p["workstreams"]
    for k, w in enumerate(ws):
        i = min(n - 1, k * n // len(ws))
        a, b = bounds[i]
        w["phase_order"] = i + 1
        w["start_week"], w["end_week"] = a, b
        w["follows"] = []
        p["phases"][i]["workstream_ids"].append(w["id"])
    wsp = {w["id"]: w for w in ws}
    for d in p["deliverables"]:
        w = wsp[d["workstream_id"]]
        d["phase_order"] = w["phase_order"]
        d["due_week"] = w["end_week"]
        d["presented_at"] = p["phases"][w["phase_order"] - 1]["gate"]["label"]
    ev = [e for e in p["governance"]["events"] if e["type"] == "kickoff"]
    for i, (a, b) in enumerate(bounds):
        ev.append({"id": f"G{i + 2}", "type": "gate", "phase_order": i + 1, "week": b, "label": GATES[i][0], "purpose": "Decide",
                   "presents": [d["id"] for d in p["deliverables"] if d["phase_order"] == i + 1], "decision": GATES[i][1],
                   "agenda": ["Present the findings", "Decide"], "attendees": ["CEO", "COO", "Head of Sales"]})
    p["governance"]["events"] = ev
    p["governance"]["status_weeks"] = [w for w in range(3, total, 2)]
    p["total_duration_weeks"] = {"min": total, "max": total}
    p["timeline_slide"] = {"unit": "weeks", "bars": [{"phase": ph["name"], "start": ph["start_week"], "end": ph["end_week"]} for ph in p["phases"]]}
    return p
