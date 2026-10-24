"""Template 1.5's timeline rule (José, 24 Oct): at most 24 boxes, one unit each, the same unit throughout.

    python3 tests/timeline_units_stress.py [outdir]

Draws the timeline with unit_scale=True for plans of 2 to 624 weeks and 3 to 12 workstreams, and checks:
the unit is the smallest of week, month, bi-month, quarter, four-month period, semester that fits 24 boxes;
every header box is one unit; phases follow each other with no shared box; every bar, diamond and meeting
sits inside its phase; one marker per box on the timeline, while the steering slides keep every meeting; and
the slide passes the layout checks of workplan_stress.py, five phase-colour squares sit off the slide, the rows
fill the 7.42 cm, status dots appear only up to 16 weeks and only the phase gates carry a label. Past 24 semesters
time_unit must return None. Exits 1 on any failure.
"""
import io, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
from pptx import Presentation
import varfill, workplan
from workplan_stress import make_plan, check_slide

TOTALS = (2, 6, 12, 16, 17, 20, 24, 25, 26, 39, 52, 78, 104, 105, 130, 173, 208, 260, 312, 416, 520, 624)
WS = (3, 7, 10, 12)


def expected_k(total):
    for k in (52, 12, 6, 4, 3, 2):
        if workplan._span(1, total, k)[1] <= workplan.MAX_BOXES:
            return k
    return None


def run(total, n_ws, outdir=None):
    plan = make_plan(total, n_ws)
    probs = []
    unit = workplan.time_unit(plan)
    if unit is None:
        return f"{total}w/{n_ws}ws: no unit", ["no unit within 24 semesters"]
    k, head, one, many, g = unit
    if k != expected_k(total) and _span_pushed(plan, expected_k(total)) <= 24:
        probs.append(f"unit {head}, expected k={expected_k(total)}")
    n = g["total_duration_weeks"]["max"]
    if n > workplan.MAX_BOXES:
        probs.append(f"{n} boxes")
    prev = 0
    spans = {}
    for p in sorted(g["phases"], key=lambda p: p["order"]):
        if p["start_week"] != prev + 1 or p["end_week"] < p["start_week"]:
            probs.append(f"phase {p['order']} boxes {p['start_week']}-{p['end_week']} after {prev}")
        spans[p["order"]] = (p["start_week"], p["end_week"])
        prev = p["end_week"]
    for w in g["workstreams"]:
        a, b = spans[w["phase_order"]]
        if not (a <= w["start_week"] <= w["end_week"] <= b):
            probs.append(f"{w['id']} outside its phase")
    ws_span = {w["id"]: (w["start_week"], w["end_week"]) for w in g["workstreams"]}
    for d in g["deliverables"]:
        a, b = ws_span[d["workstream_id"]]
        if not a <= d["due_week"] <= b:
            probs.append(f"{d['id']} due outside its workstream")
    if any(not 1 <= e["week"] <= n for e in g["governance"]["events"]):
        probs.append("a meeting off the grid")
    boxes = [e["week"] for e in workplan._markers(g["governance"]["events"])]   # one timeline marker per box
    if len(boxes) != len(set(boxes)):
        probs.append("two markers in one box")
    if set(boxes) & set(g["governance"]["status_weeks"]):
        probs.append("status dot on a meeting box")
    if len(g["governance"]["events"]) != len(plan["governance"]["events"]):
        probs.append("a meeting was dropped (the steering slides list them all)")
    prs = varfill._load_template(varfill.TEMPLATES["1.4"])
    lst = prs.slides._sldIdLst
    for el in list(lst):
        prs.part.drop_rel(el.rId); lst.remove(el)
    slides = workplan.timeline_slides(prs, plan, "Approach", "The Navigator Company", unit_scale=True, swatches=True)
    hdr = [s for s in slides[0].shapes if s.has_text_frame and s.text_frame.text == head]
    if not hdr:
        probs.append(f"no '{head}' header")
    labels = [s for s in slides[0].shapes if s.has_text_frame and s.text_frame.text.isdigit()
              and s.top == min((x.top for x in slides[0].shapes if x.has_text_frame and x.text_frame.text.isdigit()), default=0)]
    if len(labels) != n:
        probs.append(f"{len(labels)} header boxes for {n} {many}")
    for sl in slides:                       # five squares beside every page, all off the slide (José, 24 Oct)
        sq = [x for x in sl.shapes if x.name.startswith("palette:phase")]
        if len(sq) != 5 or any(x.left + x.width > 0 for x in sq):
            probs.append(f"{len(sq)} palette squares, or one on the slide")
    # José, 24 Oct: rows fill the 7.42 cm (at most 10 a page); no status dots past 16 weeks; labels on gates only
    import re as _re
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    labs = [x for x in slides[0].shapes if x.has_text_frame and _re.match(r"^\d\d ", x.text_frame.text)]
    cap = workplan.WS_MAX_15
    want_h = workplan.WS_AREA_15 * min(len(labs), cap) / (cap if n_ws > cap else len(labs))
    span = (max(x.top + x.height for x in labs) - min(x.top for x in labs)) if labs else 0
    if labs and abs(span - want_h) > 30000:
        probs.append(f"rows span {span / 360000:.2f} cm, want {want_h / 360000:.2f}")
    white = [x for x in slides[0].shapes if x.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE and x.fill.type == 1
             and str(x.fill.fore_color.rgb) == "FFFFFF" and x.width == x.height]
    if total > 16 and white:                 # José: none past 16 weeks
        probs.append(f"{len(white)} status dots on a {total}-week plan")
    gate_boxes = {e["week"] for e in workplan._markers(g["governance"]["events"]) if e["type"] == "gate"}
    lab_texts = [x.text_frame.text for x in slides[0].shapes if x.has_text_frame
                 and x.top > max((y.top for y in labs), default=0) and x.text_frame.text
                 and x.text_frame.text in {e["label"] for e in g["governance"]["events"]}]
    if len(lab_texts) != len(gate_boxes):
        probs.append(f"{len(lab_texts)} steering labels for {len(gate_boxes)} gates")
    # the other plan slides in the same unit (José, 24 Oct)
    sp = workplan.scaled(plan)
    workplan.roadmap_slide(prs, sp, "Approach", "The Navigator Company")
    workplan.deliverables_slides(prs, sp, "Approach", "The Navigator Company")
    workplan.governance_slides(prs, sp, "Approach", "The Navigator Company")
    words = [x.text_frame.text for sl in prs.slides for x in sl.shapes if x.has_text_frame]
    if one != "week" and any(("Week " in w or "week " in w) and "weeks between" not in w and "every" not in w for w in words):
        probs.append("a slide still counts in weeks: " + next(w for w in words if "Week " in w or "week " in w)[:40])
    buf = io.BytesIO(); prs.save(buf)
    deck = Presentation(io.BytesIO(buf.getvalue()))
    for i, sl in enumerate(deck.slides, 1):
        probs += check_slide(sl, deck.slide_width, deck.slide_height, i)
    if outdir:
        open(os.path.join(outdir, f"tu_{total:03d}w_{n_ws:02d}ws.pptx"), "wb").write(buf.getvalue())
    return f"{total}w/{n_ws}ws: {n} {many}, {len(slides)} slide(s)", probs


def _span_pushed(plan, k):
    return workplan._to_units(plan, k)["total_duration_weeks"]["max"] if k else 99


if __name__ == "__main__":
    outdir = sys.argv[1] if len(sys.argv) > 1 else None
    bad = 0
    for t in TOTALS:
        for n in WS:
            if n > t * 2:
                continue
            name, probs = run(t, n, outdir)
            bad += bool(probs)
            print(("FAIL " if probs else "PASS ") + name + ("" if not probs else "; " + " | ".join(probs[:3])))
    over = make_plan(651, 3)
    if workplan.time_unit(over) is not None:
        bad += 1; print("FAIL 651w: a unit was found past 24 semesters")
    else:
        print("PASS 651w (25 semesters): no unit, plan slides left out")
    print(f"\n{bad} failing cases")
    sys.exit(1 if bad else 0)
