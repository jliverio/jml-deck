"""
Builds template_v1_2.potx from template_v1_1.potx. Run from the repo root:

    python3 variables/build_template_v1_2.py

What changes against 1.1 (nothing else is touched):

1. Context slide (4): the hard-coded sample text becomes variables.
     title             summary_title_01   (the slide's action title)
     Objectives box    objective_01..04
     Solution box      solution_01..05
     Outcomes box      outcome_01..04
   One paragraph per variable; empty ones are hidden by the table's if_empty.
2. Approach section: a new divider "3" and three work-plan slides after
   Market Research. The section name is section_04; the agenda shows it third
   and Next Steps (section_03) fourth, so the live 1.1 table keeps working
   unchanged. The Next Steps divider now prints "4".
3. The three work-plan slides are named, not filled: their title placeholder is
   called workplan:timeline, workplan:deliverables and workplan:steering. The
   renderer draws the plan onto them (workplan.py); without a plan it marks
   them [Firm to complete]. Restyle their chrome in PowerPoint freely; keep the
   shape names.

Slide order in 1.2: cover, agenda, 1 Context, Context, 2 Market Research,
Market Research, 3 Approach, timeline, deliverables, steering meetings,
4 Next Steps, Next Steps, back cover.
"""
import copy
import io
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import varfill  # noqa: E402

SRC = os.path.join(ROOT, "template_v1_1.potx")
DST = os.path.join(ROOT, "template_v1_2.potx")
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def set_paragraphs(shape, names):
    """Make the text box hold one paragraph per variable, keeping the first
    paragraph's formatting (bullets, size) and dropping emphasis runs."""
    tf = shape.text_frame
    paras = list(tf.paragraphs)
    proto = paras[0]
    for p in paras[1:]:
        p._p.getparent().remove(p._p)
    for i, name in enumerate(names):
        if i == 0:
            p = proto
        else:
            new = copy.deepcopy(proto._p)
            tf._txBody.append(new)
            p = tf.paragraphs[-1]
        runs = list(p.runs)
        for r in runs[1:]:
            r._r.getparent().remove(r._r)
        runs[0].text = name
        runs[0].font.bold = None


def replace_token(slide, old, new):
    for sh in varfill._walk(slide.shapes):
        if getattr(sh, "has_text_frame", False):
            for p in sh.text_frame.paragraphs:
                for r in p.runs:
                    if r.text == old:
                        r.text = new


def duplicate_slide(prs, src):
    """Copy a slide (shapes and their relationships) to the end of the deck."""
    new = prs.slides.add_slide(src.slide_layout)
    tree = new.shapes._spTree
    for el in list(tree)[2:]:
        tree.remove(el)
    rmap = {}
    for rid, rel in src.part.rels.items():
        kind = rel.reltype.split("/")[-1]
        if kind in ("notesSlide", "slideLayout"):
            continue
        if rel.is_external:
            rmap[rid] = new.part.relate_to(rel.target_ref, rel.reltype, is_external=True)
        else:
            rmap[rid] = new.part.relate_to(rel.target_part, rel.reltype)
    for el in list(src.shapes._spTree)[2:]:
        tree.append(copy.deepcopy(el))
    for node in tree.iter():
        for k, v in list(node.attrib.items()):
            if k.startswith("{%s}" % R_NS) and v in rmap:
                node.set(k, rmap[v])
    return new


def add_workplan_slide(prs, layout, marker, hint_title, hint_sub):
    s = prs.slides.add_slide(layout)
    for ph in s.placeholders:
        idx = ph.placeholder_format.idx
        if idx == 0:
            ph.text_frame.text = hint_title
            ph.name = marker
        elif idx == 1:
            ph.text_frame.text = hint_sub
        elif idx == 17:
            ph.text_frame.text = "section_04"
    return s


def main():
    prs = varfill._load_template(SRC)
    slides = list(prs.slides)
    agenda, context, next_div, next_steps = slides[1], slides[3], slides[6], slides[7]

    # 1. Context slide
    for sh in context.shapes:
        if sh.is_placeholder and sh.placeholder_format.idx == 0:
            sh.text_frame.paragraphs[0].runs[0].text = "summary_title_01"
    boxes = {sh.name: sh for sh in context.shapes}
    set_paragraphs(boxes["Google Shape;881;p247"], [f"objective_0{i}" for i in range(1, 5)])
    set_paragraphs(boxes["Google Shape;882;p247"], [f"solution_0{i}" for i in range(1, 6)])
    set_paragraphs(boxes["Google Shape;883;p247"], [f"outcome_0{i}" for i in range(1, 5)])

    # 2. Agenda: Approach (section_04) third, Next Steps (section_03) fourth
    for grp in agenda.shapes:
        if grp.shape_type != 6:
            continue
        for sh in grp.shapes:
            if sh.has_text_frame and sh.text_frame.text == "section_03":
                sh.text_frame.paragraphs[0].runs[0].text = "__S4__"
            elif sh.has_text_frame and sh.text_frame.text == "section_04":
                sh.text_frame.paragraphs[0].runs[0].text = "section_03"
    replace_token(agenda, "__S4__", "section_04")

    # 3. Approach divider (copy of the Next Steps divider), Next Steps becomes 4
    approach_div = duplicate_slide(prs, next_div)
    replace_token(approach_div, "section_03", "section_04")
    replace_token(next_div, "3", "4")

    # 4. Work-plan slides
    default = context.slide_layout
    wp = [
        add_workplan_slide(prs, default, "workplan:timeline",
                           "Work plan timeline by workstream (drawn from the Phase Architect plan)",
                           "Plan by workstream and week"),
        add_workplan_slide(prs, default, "workplan:deliverables",
                           "Deliverables by workstream (drawn from the Phase Architect plan)",
                           "Deliverables by workstream"),
        add_workplan_slide(prs, default, "workplan:steering",
                           "Steering meetings (drawn from the Phase Architect plan)",
                           "Steering meetings"),
    ]

    # 5. Order: ... Market Research, 3 Approach, work plan x3, 4 Next Steps, Next Steps, back
    lst = prs.slides._sldIdLst
    ids = list(lst)
    by_id = {s.slide_id: el for s, el in zip(prs.slides, ids)}
    order = slides[:6] + [approach_div] + wp + [next_div, next_steps, slides[8]]
    order_ids = [s.slide_id for s in order]
    for el in ids:
        lst.remove(el)
    for sid in order_ids:
        lst.append(by_id[sid])

    buf = io.BytesIO()
    prs.save(buf)
    src = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == "[Content_Types].xml":
                data = data.replace(b"presentationml.presentation.main+xml",
                                    b"presentationml.template.main+xml")
            dst.writestr(item, data)
    print("wrote", DST, "slides:", len(order))


if __name__ == "__main__":
    main()
