"""Build template_v1_5_4.potx from José's PowerPoint file (20261028_JML_template_1.5.3.pptx, sent 22 Nov).

    python tools/make_template_1_5_4.py <his file.pptx> [--no-team]

His file is the deck as he wants it, with the two market research slides (48 variables) in place. Three of its
slides are pictures of what the renderer draws (approach overview, timeline, deliverables), written with
placeholders such as "phases[1].name". This script turns them back into marked slides the renderer draws on,
and applies the decisions of 22 Nov:

- slide 8 (approach overview): the drawn example of the phases is removed; the title becomes the marker
  workplan:roadmap and reads "section_03 | approach_title_01". The "Main Deliverables" panel on the right
  stays exactly as he drew it (José, 23 Nov: "Keep the panel as it is in the file I shared"): its shapes are
  named approach:panel:*, and the renderer draws the phases in the room to its left. The "Source: xx" line
  at the foot stays too, named approach:note: the renderer writes "Initial view – to confirm with <client>"
  there;
- slides 9 and 10 (timeline, deliverables): the drawn example is removed; title, subtitle and marker stay.
  The small section tracker above the title is removed (slides 3 to 8 have none; the title names the section);
- slide 11 (team): kept as he wrote it (José, 22 Nov: "Include it"). It still holds a stock template's
  names ("Anthony Harmon") and filler text, for the firm to replace. --no-team leaves it out;
- slide 2 (agenda): each topic's number and text become one group named agenda:row:N. His file has them as
  loose shapes, so an unused topic could not be removed and printed "[Firm to complete]" (the 1.4 file
  groups them). s3layout.apply_file_layout then closes the gaps and renumbers;
- slide 5: line spacing 1.5 in all five boxes (José, 22 Nov; his file had 1.7 in the competitor boxes);
- everything else ships as he wrote it (slides 6 and 7 are for the firm to complete by hand).
"""
import copy
import io
import os
import sys
import zipfile

from pptx import Presentation
from pptx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "template_v1_5_4.potx")
LINE_SPACING = "150000"          # 1.5


def _title(slide):
    for sh in slide.placeholders:
        if sh.placeholder_format.idx == 0:
            return sh
    return None


def _texts(slide):
    return " | ".join(sh.text_frame.text for sh in slide.shapes if sh.has_text_frame)


def _clear_drawing(slide, keep_subtitle=True, keep=()):
    """Remove everything but the title (and the subtitle): the renderer draws the rest. Shapes whose name
    starts with one of `keep` stay."""
    for sh in list(slide.shapes):
        if sh.is_placeholder and sh.placeholder_format.idx == 0:
            continue
        if keep_subtitle and sh.is_placeholder and sh.placeholder_format.idx == 1:
            continue
        if any(sh.name.startswith(k) for k in keep):
            continue
        sh._element.getparent().remove(sh._element)


def _mark_panel(slide):
    """The "Main Deliverables" panel of the approach slide: its heading, its background, the four lines of
    text with their icons and the rules between them. Everything from the heading's left edge to the right
    is the panel. Returns the number of shapes named."""
    head = next((sh for sh in slide.shapes if sh.has_text_frame and not sh.is_placeholder
                 and sh.text_frame.text.strip() == "Main Deliverables"), None)
    if head is None:
        return 0
    kinds = {"text": 0, "icon": 0, "rule": 0}
    n = 0
    for sh in sorted(slide.shapes, key=lambda x: (x.top or 0, x.left or 0)):
        if sh.is_placeholder or sh.left is None or sh.left < head.left - 20000:
            continue
        if sh is head or sh._element is head._element:
            sh.name = "approach:panel:head"
        elif sh.shape_type == 13:
            kinds["icon"] += 1
            sh.name = f"approach:panel:icon:{kinds['icon']}"
        elif sh.shape_type == 9:
            kinds["rule"] += 1
            sh.name = f"approach:panel:rule:{kinds['rule']}"
        elif sh.has_text_frame and sh.text_frame.text.strip():
            kinds["text"] += 1
            sh.name = f"approach:panel:text:{kinds['text']}"
        else:
            sh.name = "approach:panel:back"
        n += 1
    return n


def _mark_note(slide):
    """The "Source: xx" line at the foot of the approach slide becomes the place of the slide's note."""
    for sh in slide.shapes:
        if sh.has_text_frame and not sh.is_placeholder and sh.text_frame.text.strip().lower().startswith("source:"):
            sh.name = "approach:note"
            return 1
    return 0


def _drop_unused_rels(slide):
    """A cleared slide still points at the pictures of its drawn example; drop them so they leave the file."""
    xml = slide._element.xml
    for rId, rel in list(slide.part.rels.items()):
        if rel.reltype.endswith("/image") and f'"{rId}"' not in xml:
            slide.part.drop_rel(rId)


def _shrink_pictures(data, max_px=1600):
    """Pictures wider than max_px are scaled down (the cover drawing is 2273 px wide for half a slide):
    the deck goes out by email with the report beside it, and Gmail stops at 25 MB."""
    from PIL import Image
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    saved = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            raw = src.read(item.filename)
            if item.filename.startswith("ppt/media/") and item.filename.lower().endswith(".png") and len(raw) > 1_000_000:
                im = Image.open(io.BytesIO(raw))
                if max(im.size) > max_px:
                    k = max_px / max(im.size)
                    im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
                    b = io.BytesIO()
                    im.save(b, "PNG", optimize=True)
                    if b.tell() < len(raw):
                        saved += len(raw) - b.tell()
                        raw = b.getvalue()
            dst.writestr(item, raw)
    return out.getvalue(), saved


def _set_last_run(title, text):
    runs = title.text_frame.paragraphs[0].runs
    runs[-1].text = text
    for r in runs[1:-1]:
        r.text = ""


def _drop_slide(prs, el):
    prs.part.drop_rel(el.rId)
    prs.slides._sldIdLst.remove(el)


def _group_agenda(slide):
    """Number circle + topic text -> one group per row, so an empty topic's row can be removed whole."""
    import re
    texts = {}
    for sh in slide.shapes:
        if sh.has_text_frame:
            m = re.fullmatch(r"section_(\d+)", sh.text_frame.text.strip())
            if m:
                texts[int(m.group(1))] = sh
    nums = [sh for sh in slide.shapes if sh.has_text_frame and sh.text_frame.text.strip().isdigit()]
    made = 0
    for n, txt in sorted(texts.items()):
        num = min(nums, key=lambda c: abs((c.top + c.height / 2) - (txt.top + txt.height / 2)), default=None)
        if num is None or abs((num.top + num.height / 2) - (txt.top + txt.height / 2)) > 150000:
            continue
        nums.remove(num)
        g = slide.shapes.add_group_shape([num, txt])
        g.name = f"agenda:row:{n}"
        made += 1
    return made


def build(src, keep_team=True):
    prs = Presentation(src)
    slides = list(prs.slides)
    ids = list(prs.slides._sldIdLst)
    notes = []
    for el, s in zip(ids, slides):
        tx = _texts(s)
        names = {sh.name for sh in s.shapes}
        if "phases[1].objective_one_line" in tx and not any(n.startswith("workplan:") for n in names):
            t = _title(s)
            kept = _mark_panel(s)
            noted = _mark_note(s)
            _clear_drawing(s, keep_subtitle=False, keep=("approach:panel", "approach:note"))
            _drop_unused_rels(s)
            t.name = "workplan:roadmap"
            _set_last_run(t, "approach_title_01")
            notes.append("approach overview: marker workplan:roadmap; Main Deliverables panel kept "
                         f"({kept} shapes)" + ("; note line kept" if noted else ""))
        elif "workplan:timeline" in names or "workplan:deliverables" in names:
            _clear_drawing(s)
            _drop_unused_rels(s)
            notes.append("cleared the drawn example on " + sorted(n for n in names if n.startswith("workplan:"))[0])
        elif "Our Expert" in tx and not keep_team:
            _drop_slide(prs, el)
            notes.append("team slide left out")
        elif "section_01" in tx and "section_02" in tx and "section_03" in tx:
            notes.append(f"agenda: {_group_agenda(s)} topics grouped with their numbers")
        elif "DD_Month_YYYY" in tx:
            # the cover's date is written as an example; as a variable the renderer fills it (today when empty)
            for sh in s.shapes:
                if sh.has_text_frame:
                    for p in sh.text_frame.paragraphs:
                        if "DD_Month_YYYY" in "".join(r.text for r in p.runs):
                            p.runs[0].text = "cover_date_01"
                            for r in p.runs[1:]:
                                r.text = ""
                            notes.append("cover: DD_Month_YYYY becomes the variable cover_date_01")
        elif "value_layer_01" in tx:
            # "How the Company Creates and Captures Value" needs 5 inches at 14 pt bold and its box is 4.33 wide,
            # so the last word drops under the heading's line. Widen the box to the column's right edge.
            col_right = max(sh.left + sh.width for sh in s.shapes
                            if sh.has_text_frame and sh.text_frame.text.strip() == "value_layer_01")
            for sh in s.shapes:
                if sh.has_text_frame and sh.text_frame.text.strip().startswith("How the Company Creates"):
                    sh.width = col_right - sh.left
                    notes.append("profile slide: heading box widened so it stays on one line")
        elif "competitor_01_point_01" in tx:
            n = 0
            for sh in s.shapes:
                if not sh.has_text_frame or "_point_0" not in sh.text_frame.text:
                    continue
                for p in sh.text_frame.paragraphs:
                    pPr = p._p.get_or_add_pPr()
                    ln = pPr.find(qn("a:lnSpc"))
                    if ln is None:
                        ln = pPr.makeelement(qn("a:lnSpc"), {})
                        pPr.insert(0, ln)
                    for c in list(ln):
                        ln.remove(c)
                    ln.append(ln.makeelement(qn("a:spcPct"), {"val": LINE_SPACING}))
                    n += 1
            notes.append(f"line spacing 1.5 on {n} paragraphs of the comparison slide")
    prs.part.rename_slide_parts([el.rId for el in prs.slides._sldIdLst])
    buf = io.BytesIO()
    prs.save(buf)
    # a .potx carries the template content type; varfill._load_template turns it back when it opens the file
    src_zip = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src_zip.infolist():
            data = src_zip.read(item.filename)
            if item.filename == "[Content_Types].xml":
                data = data.replace(b"presentationml.presentation.main+xml", b"presentationml.template.main+xml")
            dst.writestr(item, data)
    data, saved = _shrink_pictures(out.getvalue())
    if saved:
        notes.append(f"large pictures scaled down: {saved // 1024} KB saved")
    return data, notes


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    data, notes = build(args[0], keep_team="--no-team" not in sys.argv)
    open(OUT, "wb").write(data)
    print("wrote", OUT, len(data), "bytes")
    for n in notes:
        print(" -", n)
