"""
workplan.py - draws the Phase Architect v2 plan as native PowerPoint slides
on the template's "Default" layout:

  1. Timeline by workstream  (Gantt rows grouped by phase + governance row)
  2. Deliverables by workstream (what each stream hands over, due week, where reviewed)
  3. Steering meetings (one column per check-in / workshop / gate, max 4 per slide)

Input = the `plan` object returned by validate_plan_v2.js. All weeks are
already computed there; this module only draws. Titles are composed here
from the numbers (no model writes them), so they can never disagree with the chart.

    add_workplan_slides(prs, plan, section="Approach", client="[Client]") -> [slides]
    build_workplan_deck(plan) -> pptx bytes (template with only these slides; for tests)
"""
import io

from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt, Inches
from lxml import etree

NAVY = RGBColor(0x05, 0x1C, 0x2C)
BLUE = RGBColor(0x22, 0xA3, 0xDF)
ELECTRIC = RGBColor(0x22, 0x22, 0xF6)
TEAL = RGBColor(0x18, 0x77, 0xA2)
LIGHT = RGBColor(0xA2, 0xD5, 0xEC)
YELLOW = RGBColor(0xF8, 0xBC, 0x3B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x00, 0x00, 0x00)
GREY = RGBColor(0x59, 0x59, 0x59)
LGREY = RGBColor(0xD0, 0xD0, 0xD0)
PHASE_COLORS = [BLUE, ELECTRIC, TEAL, NAVY]
FONT = "Arial"

L = Emu(554736)            # content left (title placeholder left)
W = Emu(11082528)          # content width
TOP = Emu(1700000)         # content top (below subtitle)
BOTTOM = Emu(6300000)      # content bottom (above footer)


# ------------------------------------------------------------------ helpers
def _box(slide, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, dash=False, line_w=0.75):
    s = slide.shapes.add_shape(shape, Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(line_w)
        if dash:
            s.line.dash_style = 4  # sysDash
    s.shadow.inherit = False
    tf = s.text_frame
    tf.margin_left = tf.margin_right = Emu(45720); tf.margin_top = tf.margin_bottom = Emu(18288)
    return s


def _text(shape_or_slide, text, size=10, bold=False, color=BLACK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE,
          x=None, y=None, w=None, h=None, italic=False, wrap=True):
    if x is not None:
        sh = shape_or_slide.shapes.add_textbox(Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)))
        sh.text_frame.margin_left = sh.text_frame.margin_right = Emu(0)
        sh.text_frame.margin_top = sh.text_frame.margin_bottom = Emu(0)
    else:
        sh = shape_or_slide
    tf = sh.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    lines = text if isinstance(text, list) else [text]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run(); r.text = str(ln)
        f = r.font; f.size = Pt(size); f.bold = bold; f.italic = italic; f.name = FONT; f.color.rgb = color
    return sh


def _bullets(shape, items, size=11, color=BLACK, space_after=6):
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", "171450"); pPr.set("indent", "-171450")
        for tag in ("a:buNone", "a:buChar", "a:buAutoNum"):
            for el in pPr.findall(qn(tag)):
                pPr.remove(el)
        bu = etree.SubElement(pPr, qn("a:buChar")); bu.set("char", "•")
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(space_after)
        r = p.add_run(); r.text = str(it)
        f = r.font; f.size = Pt(size); f.name = FONT; f.color.rgb = color


def _line(slide, x1, y1, x2, y2, color=BLACK, width=0.75, dash=False):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Emu(int(x1)), Emu(int(y1)), Emu(int(x2)), Emu(int(y2)))
    c.line.color.rgb = color; c.line.width = Pt(width)
    if dash:
        c.line.dash_style = 4
    return c


def _new_slide(prs, title, subtitle, section):
    layout = prs.slide_layouts[0]  # "Default": title, subtitle, on-page tracker
    s = prs.slides.add_slide(layout)
    for ph in s.placeholders:
        idx = ph.placeholder_format.idx
        if idx == 0:
            ph.text_frame.text = title
        elif idx == 1:
            ph.text_frame.text = subtitle
        elif idx == 17:
            ph.text_frame.text = section
    return s


def _weeks_label(dw):
    return f"{dw['min']} weeks" if dw["min"] == dw["max"] else f"{dw['min']}-{dw['max']} weeks"


def _phase_color(order):
    return PHASE_COLORS[(order - 1) % len(PHASE_COLORS)]


def _clip(s, n):
    s = " ".join(str(s or "").split())
    return s if len(s) <= n else s[: n - 1].rstrip(" ,.;:") + "…"


# ------------------------------------------------------------------ titles
def titles(plan):
    t = plan["total_duration_weeks"]
    total = f"{t['max']} weeks" if t["min"] == t["max"] else f"{t['min']} to {t['max']} weeks"
    n = len(plan["phases"])
    nws = len(plan["workstreams"])
    nd = len(plan["deliverables"])
    ev = [e for e in plan["governance"]["events"] if e["type"] != "kickoff"]
    gates = sum(1 for e in ev if e["type"] == "gate")
    phase_word = "phase" if n == 1 else "phases"
    return {
        "timeline": (f"The work runs {total} in {n} {phase_word} and {nws} workstreams, each phase closing on a decision" if n > 1
                     else f"The work runs {total} in {nws} workstreams, closing on a decision"),
        "deliverables": f"The {nws} workstreams hand over {nd} deliverables, each reviewed at a steering meeting",
        "governance": f"After the kick-off, {len(ev)} steering meetings review the work, {gates} of them closing a phase with a decision",
    }


# ------------------------------------------------------------------ slide 1: timeline
def timeline_slide(prs, plan, section, client):
    T = titles(plan)
    ranged = any(p["duration_weeks"]["min"] != p["duration_weeks"]["max"] for p in plan["phases"])
    s = _new_slide(prs, T["timeline"], "Plan by workstream and week" + (" (drawn on the longer estimate)" if ranged else ""), section)
    total = plan["total_duration_weeks"]["max"]
    phases = plan["phases"]
    wss = plan["workstreams"]
    events = plan["governance"]["events"]

    _text(s, f"Initial view – to confirm with {client}", size=10, italic=True, color=GREY,
          align=PP_ALIGN.RIGHT, x=L + W - Inches(4), y=TOP - Inches(0.28), w=Inches(4), h=Inches(0.22))

    label_w = Inches(1.85)
    gx = L + label_w
    gw = W - label_w
    col = gw / total
    band_h = Inches(0.24)
    head_h = Inches(0.26)
    n_rows = len(wss)
    avail = Inches(3.05)
    row_h = min(Inches(0.55), avail / max(n_rows, 1))
    y0 = TOP
    # phase band
    for p in phases:
        x = gx + (p["start_week"] - 1) * col
        w = (p["end_week"] - p["start_week"] + 1) * col
        b = _box(s, x, y0, w, band_h, fill=_phase_color(p["order"]))
        est = "" if p["duration_weeks"]["min"] == p["duration_weeks"]["max"] else " (estimate)"
        _text(b, _clip(f"{p['name']} · {_weeks_label(p['duration_weeks'])}{est}", int(w / Inches(0.075))),
              size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    _text(s, "Phase", size=10, bold=True, color=NAVY, x=L, y=y0, w=label_w, h=band_h)
    # week header
    yh = y0 + band_h + Inches(0.04)
    hdr = _box(s, L, yh, W, head_h, fill=NAVY)
    _text(hdr, "Week", size=10, bold=True, color=WHITE)
    step = 1 if total <= 30 else 2
    for wk in range(1, total + 1):
        if (wk - 1) % step:
            continue
        _text(s, str(wk), size=9 if total > 20 else 10, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
              x=gx + (wk - 1) * col, y=yh, w=col * step, h=head_h)
    yr = yh + head_h
    grid_top = yr
    grid_bottom = yr + n_rows * row_h
    # week gridlines and phase boundaries
    for wk in range(1, total):
        x = gx + wk * col
        is_boundary = any(p["end_week"] == wk for p in phases)
        _line(s, x, grid_top, x, grid_bottom, color=BLACK if is_boundary else LGREY,
              width=1.0 if is_boundary else 0.5, dash=not is_boundary)
    _line(s, gx, grid_top, gx, grid_bottom, color=BLACK, width=1.0)
    my = grid_bottom + Inches(0.32)
    d = min(Inches(0.2), col * 0.8)
    for e in events:
        if e["type"] in ("workshop", "gate"):
            cx = gx + (e["week"] - 0.5) * col
            _line(s, cx, grid_top, cx, my - d / 2, color=GREY, width=0.75, dash=True)

    # rows
    del_due = {d["id"]: d["due_week"] for d in plan["deliverables"]}
    order = sorted(wss, key=lambda w: (w["phase_order"], w["start_week"], w["id"]))
    numbering = {w["id"]: i + 1 for i, w in enumerate(order)}
    for i, w in enumerate(order):
        y = yr + i * row_h
        c = _phase_color(w["phase_order"])
        lab = _box(s, L, y + Emu(9144), label_w - Emu(27432), row_h - Emu(18288), fill=c)
        _text(lab, _clip(f"{numbering[w['id']]:02d} {w['name']}", 34), size=10, bold=True, color=WHITE)
        bx = gx + (w["start_week"] - 1) * col + Emu(18288)
        bw = (w["end_week"] - w["start_week"] + 1) * col - Emu(36576)
        _box(s, bx, y + row_h * 0.22, bw, row_h * 0.56, fill=c)
        # deliverable markers: a white diamond in the due week, ids next to it
        due = {}
        for did in w.get("deliverable_ids", []):
            dw = del_due.get(did)
            if dw is not None:
                due.setdefault(dw, []).append(did)
        dm = min(row_h * 0.72, col * 0.9, Inches(0.3))
        for dw, ids in sorted(due.items()):
            cx = gx + (dw - 0.5) * col
            n = len(ids)
            dmw = min(dm, col / (0.95 * n + 0.05))
            for k, did in enumerate(ids):           # same week: diamonds side by side, centred on the week
                ox = (k - (n - 1) / 2) * dmw * 0.95
                ox = min(ox, gx + gw - dmw / 2 - Emu(9144) - cx)
                dmd = _box(s, cx + ox - dmw / 2, y + (row_h - dmw) / 2, dmw, dmw, fill=WHITE, line=NAVY, shape=MSO_SHAPE.DIAMOND, line_w=0.75)
                tf = dmd.text_frame
                tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Emu(0)
                num = did[1:] if did[:1] == "D" else did
                _text(dmd, num, size=7 if len(num) > 1 else 8, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        _line(s, L, y + row_h, L + W, y + row_h, color=LGREY, width=0.5, dash=True)
    # governance row
    _text(s, "Steering", size=10, bold=True, color=NAVY, x=L, y=my - d / 2, w=label_w, h=d)
    for wk in plan["governance"]["status_weeks"]:
        _box(s, gx + (wk - 0.5) * col - d / 2, my - d / 2, d, d, fill=WHITE, line=BLACK, shape=MSO_SHAPE.OVAL, line_w=0.75)
    labelled = [e for e in events]
    last_right = {0: -10**12, 1: -10**12}
    lab_w = Inches(1.45)
    for e in sorted(labelled, key=lambda e: e["week"]):
        cx = gx + (e["week"] - 0.5) * col
        fill = YELLOW if e["type"] in ("workshop", "gate") else NAVY
        _box(s, cx - d / 2, my - d / 2, d, d, fill=fill, shape=MSO_SHAPE.OVAL)
        # stagger labels so neighbours never overlap
        lx = min(max(cx - lab_w / 2, L), L + W - lab_w)
        tier = 0 if lx > last_right[0] + Emu(45720) else (1 if lx > last_right[1] + Emu(45720) else 0)
        last_right[tier] = lx + lab_w
        ly = my + d / 2 + Inches(0.06) + tier * Inches(0.42)
        _text(s, _clip(e["label"], 34), size=9, bold=e["type"] == "gate", color=BLACK, align=PP_ALIGN.CENTER,
              anchor=MSO_ANCHOR.TOP, x=lx, y=ly, w=lab_w, h=Inches(0.4))
    dl = plan.get("deadline")
    if dl and dl.get("weeks_available") is not None:
        t = plan["total_duration_weeks"]["max"]
        fits = "fits within" if t <= dl["weeks_available"] else "does NOT fit within"
        _text(s, f"Deadline: {dl.get('text') or 'stated in the brief'}. The plan ({t} weeks) {fits} the {dl['weeks_available']} weeks available, allowing two weeks to contract and start.",
              size=9, bold=True, color=NAVY, x=L, y=BOTTOM - Inches(0.48), w=W, h=Inches(0.2))
    # legend
    ly = BOTTOM - Inches(0.18)
    lx = L
    for fill, line, name in ((NAVY, None, "Kick-off / check-in"), (YELLOW, None, "Steering workshop / decision gate"),
                             (WHITE, BLACK, ("Status meeting (weekly)" if plan['governance']['status_cadence_weeks'] == 1 else f"Status meeting (every {plan['governance']['status_cadence_weeks']} weeks)"))):
        _box(s, lx, ly, Inches(0.13), Inches(0.13), fill=fill, line=line, shape=MSO_SHAPE.OVAL)
        _text(s, name, size=8, color=GREY, x=lx + Inches(0.18), y=ly - Inches(0.02), w=Inches(2.6), h=Inches(0.17))
        lx += Inches(2.55)
    _box(s, lx, ly, Inches(0.13), Inches(0.13), fill=WHITE, line=NAVY, shape=MSO_SHAPE.DIAMOND)
    _text(s, "Deliverable due (3 = D3, listed on the next page)", size=8, color=GREY, x=lx + Inches(0.18), y=ly - Inches(0.02), w=Inches(3), h=Inches(0.17))
    return s


# ------------------------------------------------------------------ slide 2: deliverables
def deliverables_slide(prs, plan, section, client):
    T = titles(plan)
    s = _new_slide(prs, T["deliverables"], "Deliverables by workstream", section)
    phases = {p["order"]: p for p in plan["phases"]}
    dels = {d["id"]: d for d in plan["deliverables"]}
    order = sorted(plan["workstreams"], key=lambda w: (w["phase_order"], w["start_week"], w["id"]))
    cols = [("Workstream", Inches(2.3)), ("Deliverables", Inches(5.25)), ("Due", Inches(0.9)), ("Reviewed at", W - Inches(8.45))]
    x = L
    y = TOP - Inches(0.05)
    for name, w in cols:
        _text(s, name, size=12, bold=True, color=BLACK, x=x, y=y, w=w, h=Inches(0.25))
        _line(s, x, y + Inches(0.3), x + w - Inches(0.08), y + Inches(0.3), color=BLACK, width=0.75)
        x += w
    y += Inches(0.38)
    n_lines = sum(max(1, len(w["deliverable_ids"])) for w in order)
    avail = BOTTOM - Inches(0.1) - y
    line_h = min(Inches(0.46), avail / max(n_lines, 1))
    numbering = {w["id"]: i + 1 for i, w in enumerate(order)}
    for w in order:
        ids = w["deliverable_ids"] or []
        h = line_h * max(1, len(ids))
        c = _phase_color(w["phase_order"])
        lab = _box(s, L, y + Emu(18288), cols[0][1] - Emu(91440), h - Emu(36576), fill=c)
        _text(lab, [_clip(f"{numbering[w['id']]:02d} {w['name']}", 32), phases[w["phase_order"]]["name"] + " phase"], size=9, bold=True, color=WHITE)
        for j, did in enumerate(ids):
            d = dels[did]
            yy = y + j * line_h
            x = L + cols[0][1]
            _text(s, [f"{did}  {d['name']}"], size=11, x=x, y=yy, w=cols[1][1] - Inches(0.1), h=line_h)
            x += cols[1][1]
            _text(s, f"Week {d['due_week']}", size=11, x=x, y=yy, w=cols[2][1], h=line_h)
            x += cols[2][1]
            _text(s, d.get("presented_at") or "[Firm to complete]", size=11, x=x, y=yy, w=cols[3][1], h=line_h)
        y += h
        _line(s, L, y, L + W, y, color=LGREY, width=0.5, dash=True)
    return s


# ------------------------------------------------------------------ slide 3: steering meetings
def governance_slides(prs, plan, section, client, per_slide=4):
    T = titles(plan)
    dels = {d["id"]: d for d in plan["deliverables"]}
    evs = [e for e in plan["governance"]["events"] if e["type"] != "kickoff"]
    # pack whole phases into slides of at most `per_slide` columns
    chunks, cur = [], []
    for p in plan["phases"]:
        mine = [e for e in evs if e["phase_order"] == p["order"]]
        if cur and len(cur) + len(mine) > per_slide:
            chunks.append(cur); cur = []
        cur += mine
    if cur:
        chunks.append(cur)
    slides = []
    phase_by = {p["order"]: p for p in plan["phases"]}
    numbering = {}
    wk = 0
    for e in evs:
        if e["type"] == "workshop":
            wk += 1; numbering[e["id"]] = wk
    for ci, chunk in enumerate(chunks):
        ph_names = sorted({phase_by[e["phase_order"]]["name"] for e in chunk}, key=lambda n: [p["name"] for p in plan["phases"]].index(n))
        sub = "Steering meetings – " + " and ".join(ph_names) + (" phase" if len(ph_names) == 1 else " phases")
        title = T["governance"] if ci == 0 else T["governance"] + " (continued)"
        s = _new_slide(prs, title, sub, section)
        n = max(len(chunk), 3)
        gap = Inches(0.35)
        cw = (W - gap * (n - 1)) / n
        for i, e in enumerate(chunk):
            x = L + i * (cw + gap)
            y = TOP
            head = f"Week {e['week']}"
            lab_w = cw - Inches(0.7)
            _text(s, _clip(e["label"], int(lab_w / Inches(0.088))), size=11, bold=True, x=x, y=y, w=lab_w, h=Inches(0.3))
            _text(s, head, size=10, color=GREY, align=PP_ALIGN.RIGHT, x=x + cw - Inches(0.68), y=y, w=Inches(0.68), h=Inches(0.3))
            _line(s, x, y + Inches(0.34), x + cw, y + Inches(0.34), color=BLACK, width=1.0)
            fill = YELLOW if e["type"] == "gate" else (ELECTRIC if e["type"] == "workshop" else NAVY)
            band = _box(s, x, y + Inches(0.42), cw, Inches(0.58), fill=fill)
            _text(band, e["purpose"], size=12, bold=True, color=NAVY if e["type"] == "gate" else WHITE)
            att = e.get("attendees") or []
            if att:
                _text(s, _clip("With: " + ", ".join(att), int(cw / Inches(0.062))), size=9, italic=True, color=GREY,
                      anchor=MSO_ANCHOR.TOP, x=x, y=y + Inches(1.06), w=cw, h=Inches(0.2))
            body = _box(s, x, y + Inches(1.3), cw, Inches(1.55))
            _bullets(body, e["agenda"], size=11)
            kind_rank = {"decision_pack": 0, "design": 1, "build": 2, "analysis": 3, "enablement": 4}
            ordered = sorted([d for d in e["presents"] if d in dels], key=lambda d: (kind_rank.get(dels[d]["kind"], 9), -dels[d]["due_week"]))
            pres = [f"{d}  {dels[d]['name']}" for d in ordered]
            if pres:
                maxc = int(cw / Inches(0.062))
                shown = pres[:3] if len(pres) <= 3 else pres[:2]
                lines = [_clip(p, maxc) for p in shown] + ([f"+{len(pres) - len(shown)} more (see deliverables page)"] if len(pres) > len(shown) else [])
                _text(s, "Reviews", size=9, bold=True, color=GREY, anchor=MSO_ANCHOR.TOP, x=x, y=y + Inches(2.9), w=cw, h=Inches(0.2))
                tb = _text(s, lines, size=9, color=GREY, anchor=MSO_ANCHOR.TOP, x=x, y=y + Inches(3.1), w=cw, h=Inches(0.75))
            if e.get("decision"):
                dbox = _box(s, x, BOTTOM - Inches(0.62), cw, Inches(0.55), fill=None, line=NAVY)
                _text(dbox, ["Decision: " + e["decision"]], size=9, bold=True, color=NAVY)
            if i < len(chunk) - 1:
                _line(s, x + cw + gap / 2, y + Inches(0.4), x + cw + gap / 2, BOTTOM - Inches(0.05), color=GREY, width=0.75, dash=True)
        slides.append(s)
    return slides


# ------------------------------------------------------------------ entry points
def add_workplan_slides(prs, plan, section="Approach", client="[Client]"):
    out = [timeline_slide(prs, plan, section, client), deliverables_slide(prs, plan, section, client)]
    out += governance_slides(prs, plan, section, client)
    return out


def build_workplan_deck(plan, client="[Client]", template=None):
    import varfill
    prs = varfill._load_template(template or varfill.TEMPLATE)
    sldIdLst = prs.slides._sldIdLst
    for sldId in list(sldIdLst):
        prs.part.drop_rel(sldId.rId)
        sldIdLst.remove(sldId)
    add_workplan_slides(prs, plan, client=client)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


if __name__ == "__main__":
    import json, sys
    data = json.load(open(sys.argv[1]))
    plan = data.get("plan", data)
    client = data.get("client", "[Client]")
    dest = sys.argv[2] if len(sys.argv) > 2 else "workplan.pptx"
    open(dest, "wb").write(build_workplan_deck(plan, client=client))
    print("wrote", dest)
