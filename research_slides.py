"""The two market research slides of template 1.5.4 (company profile, competitor comparison).

Called by varfill.build_deck before the generic fill. It writes the variables that need more than a plain
replacement and applies the layout rules José set on 12-22 Nov (Claude Doc "Market Research Slides -
Variables and Mapping v1"):

Profile slide
  * value_layer_01..04: a layer with a description keeps its label above it; a layer with none loses the
    description box and its label moves level with the middle of its circle.
  * product_01..06 (name + text): unused boxes are removed. One product fills the area in one column; two or
    more go in two columns; with an odd count the last box spans both columns.
  * details_01 / details_02: two lines; an empty one is left out.
Comparison slide
  * client_point_01..05 and competitor_NN_point_01..03: an empty point is left out.
  * competitor_NN_fact_01: the grey line above a competitor's points; left out when empty.
  * a competitor with a name and no points shows "No claims captured from its home page".
  * a competitor with no name loses its column; the columns left share the width.
  * logos: {"competitor_01": <base64 PNG/JPEG>} puts the logo on a white chip at the left of that header;
    without one the header shows the name alone.

Text markup in these values (the slide-values stage writes it):
    **bold**            the status word of a layer (Sells, In-house only), a price, a point's label
    __grey italic__     "Buys from: ...", "Markets: not public."
    \\n                  a line break inside one value
Titles, source lines and client_name_01 are plain and are filled by varfill as usual.
"""
import base64
import copy
import io
import re

from pptx.oxml.ns import qn
from pptx.util import Emu

NO_CLAIMS = "No claims captured from its home page"
GREY = "7F7F7F"
MARK = re.compile(r"(\*\*.+?\*\*|__.+?__)", re.S)
LOGO_MAX_W = 760000          # 0.83 in
LOGO_PAD = 54000


# ------------------------------------------------------------------ text
def plain(v):
    return re.sub(r"\*\*|__", "", str(v or "")).replace("\n", " ").strip()


def _segments(text):
    """[(text, style)] with style in {None, 'b', 'g'}; a "\\n" segment is a line break."""
    out = []
    for li, line in enumerate(str(text).split("\n")):
        if li:
            out.append(("\n", None))
        for part in MARK.split(line):
            if not part:
                continue
            if part.startswith("**") and part.endswith("**") and len(part) > 4:
                out.append((part[2:-2], "b"))
            elif part.startswith("__") and part.endswith("__") and len(part) > 4:
                out.append((part[2:-2], "g"))
            else:
                out.append((part, None))
    return out


def _proto(p):
    """The paragraph's first run properties: every run written into it starts from them."""
    r = p.find(qn("a:r"))
    rPr = r.find(qn("a:rPr")) if r is not None else None
    return copy.deepcopy(rPr) if rPr is not None else p.makeelement(qn("a:rPr"), {"lang": "en-GB"})


def _styled(rPr, style):
    rPr = copy.deepcopy(rPr)
    if style == "b":
        rPr.set("b", "1")
    elif style == "g":
        rPr.set("i", "1")
        fill = rPr.find(qn("a:solidFill"))
        new = rPr.makeelement(qn("a:solidFill"), {})
        new.append(new.makeelement(qn("a:srgbClr"), {"val": GREY}))
        if fill is not None:
            rPr.replace(fill, new)
        else:
            ln = rPr.find(qn("a:ln"))
            rPr.insert(list(rPr).index(ln) + 1 if ln is not None else 0, new)
    return rPr


def write(p, text, style=None):
    """Replace the paragraph's runs with `text` (markup applied). `style` forces one style on all of it."""
    rPr = _proto(p)
    for el in list(p):
        if el.tag in (qn("a:r"), qn("a:br"), qn("a:fld")):
            p.remove(el)
    end = p.find(qn("a:endParaRPr"))
    for seg, st in _segments(text):
        if seg == "\n":
            el = p.makeelement(qn("a:br"), {})
            el.append(copy.deepcopy(rPr))
        else:
            el = p.makeelement(qn("a:r"), {})
            el.append(_styled(rPr, style or st))
            t = el.makeelement(qn("a:t"), {})
            t.text = seg
            el.append(t)
        if end is not None:
            end.addprevious(el)
        else:
            p.append(el)


# ------------------------------------------------------------------ shapes
def _walk(shapes):
    for sh in shapes:
        if sh.shape_type == 6:
            yield from _walk(sh.shapes)
        else:
            yield sh


def _find(slide, token):
    """The shape whose text holds `token` (exact word)."""
    pat = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(token) + r"(?![A-Za-z0-9_])")
    for sh in _walk(slide.shapes):
        if getattr(sh, "has_text_frame", False) and sh.has_text_frame and pat.search(sh.text_frame.text):
            return sh
    return None


def _slide_with(prs, token):
    for s in prs.slides:
        if _find(s, token) is not None:
            return s
    return None


def _remove(sh):
    el = sh._element
    el.getparent().remove(el)


def _para(sh, token):
    for p in sh.text_frame.paragraphs:
        if token in "".join(r.text for r in p.runs):
            return p._p
    return None


def _place(el, x, y, w, h):
    """Set a shape element's frame (a:off / a:ext) in slide coordinates."""
    xfrm = el.find(".//" + qn("a:xfrm"))
    off, ext = xfrm.find(qn("a:off")), xfrm.find(qn("a:ext"))
    off.set("x", str(int(x)))
    off.set("y", str(int(y)))
    ext.set("cx", str(int(w)))
    ext.set("cy", str(int(h)))


# ------------------------------------------------------------------ profile slide
def _profile(slide, val, warnings):
    # value chain: labels and circles pair with the descriptions by vertical order
    descs = [(k, _find(slide, f"value_layer_{k:02d}")) for k in range(1, 5)]
    descs = [(k, sh) for k, sh in descs if sh is not None]
    if descs:
        left = descs[0][1].left
        circles = sorted((sh for sh in slide.shapes if sh.shape_type == 6 and sh.left < left
                          and abs(sh.width - sh.height) < 20000 and sh.width < 900000), key=lambda s: s.top)
        labels = sorted((sh for sh in slide.shapes if sh.shape_type != 6 and getattr(sh, "has_text_frame", False)
                         and sh.has_text_frame and abs(sh.left - left) < 20000 and sh.height < 260000
                         and sh.text_frame.text.strip() and "value_layer_" not in sh.text_frame.text),
                        key=lambda s: s.top)
        order = sorted(descs, key=lambda d: d[1].top)
        for i, (k, sh) in enumerate(order):
            v = val(f"value_layer_{k:02d}")
            if v:
                write(sh.text_frame.paragraphs[0]._p, v)
                continue
            _remove(sh)
            if i < len(circles) and i < len(labels):
                c, lab = circles[i], labels[i]
                lab.top = Emu(int(c.top + c.height / 2 - lab.height / 2))

    # products: the template's grid, then the boxes that are used, laid out again
    groups = {}
    for g in [sh for sh in slide.shapes if sh.shape_type == 6]:
        for k in range(1, 7):
            if any(getattr(s, "has_text_frame", False) and s.has_text_frame
                   and s.text_frame.text.strip() == f"product_{k:02d}_name" for s in g.shapes):
                groups[k] = g
    if groups:
        def cluster(vals, tol=120000):        # the template's boxes sit a few hundredths of a mm apart
            out = []
            for v in sorted(vals):
                if not out or v - out[-1] > tol:
                    out.append(v)
            return out
        xs = cluster(g.left for g in groups.values())
        ys = cluster(g.top for g in groups.values())
        gw = max(g.width for g in groups.values())
        gh = max(g.height for g in groups.values())
        x0, x1 = xs[0], xs[-1]
        area_w = x1 + gw - x0
        row_gap = max((ys[1] - ys[0] - gh) if len(ys) > 1 else 0, 0)
        area_h = ys[-1] + gh - ys[0]
        tree = slide.shapes._spTree
        used = []
        for k in sorted(groups):
            g = groups[k]
            name, text = val(f"product_{k:02d}_name"), val(f"product_{k:02d}_text")
            kids = {("name" if "_name" in s.text_frame.text else "text"): s for s in g.shapes
                    if getattr(s, "has_text_frame", False) and s.has_text_frame}
            if not name:
                if text:
                    warnings.append(f"product_{k:02d}_text has no product_{k:02d}_name; the box is left out")
                _remove(g)
                continue
            name_h = kids["name"].height
            pad = kids["text"].top - kids["name"].top - name_h if "text" in kids else 0
            write(kids["name"].text_frame.paragraphs[0]._p, name)
            els = {"name": kids["name"]._element}
            if text and "text" in kids:
                write(kids["text"].text_frame.paragraphs[0]._p, text)
                els["text"] = kids["text"]._element
            for el in els.values():           # out of the group: the frames below are slide coordinates
                tree.append(el)
            _remove(g)
            used.append((els, name_h, max(pad, 0)))
        n = len(used)
        rows = 1 if n <= 2 else (n + 1) // 2
        pitch = (area_h + row_gap) / max(rows, 1)
        for i, (els, name_h, pad) in enumerate(used):
            wide = n == 1 or (n % 2 == 1 and i == n - 1)
            r, c = divmod(i, 2)
            x = x0 if wide or c == 0 else x1
            w = area_w if wide else gw
            y = ys[0] + r * pitch
            h = pitch - row_gap
            _place(els["name"], x, y, w, name_h)
            if "text" in els:
                _place(els["text"], x, y + name_h + pad, w, max(h - name_h - pad, name_h))

    # additional details: one or two lines
    det = _find(slide, "details_01") or _find(slide, "details_02")
    if det is not None:
        lines = [v for v in (val("details_01"), val("details_02")) if v]
        write(det.text_frame.paragraphs[0]._p, "\n".join(lines))


# ------------------------------------------------------------------ comparison slide
def _points(sh, names, val, fact=None):
    """Fill a box of bulleted points; empty ones are left out. `fact` is the grey line above them.
    A box left with nothing says NO_CLAIMS (a text box must keep one paragraph). Returns the points written."""
    fact_p = _para(sh, fact) if fact else None
    paras = [(nme, _para(sh, nme)) for nme in names]
    paras = [(nme, p) for nme, p in paras if p is not None]
    filled = [(nme, p) for nme, p in paras if val(nme)]
    fact_v = val(fact) if fact_p is not None else ""
    for nme, p in filled:
        write(p, val(nme))
    spare = None
    for nme, p in paras:
        if (nme, p) in filled:
            continue
        if not filled and fact_p is None and spare is None:
            spare = p                              # keep one paragraph for the "no claims" line
            continue
        p.getparent().remove(p)
    if fact_p is not None:
        if fact_v:
            write(fact_p, fact_v)
            if not filled:                         # a fact line and no points: say so under it, in its look
                extra = copy.deepcopy(fact_p)
                fact_p.addnext(extra)
                write(extra, NO_CLAIMS)
        elif filled:
            fact_p.getparent().remove(fact_p)
        else:
            write(fact_p, NO_CLAIMS)
    elif spare is not None:
        pPr = spare.find(qn("a:pPr"))
        if pPr is not None:                        # no bullet in front of the note
            for tag in ("a:buChar", "a:buAutoNum"):
                for el in pPr.findall(qn(tag)):
                    pPr.remove(el)
            pPr.append(pPr.makeelement(qn("a:buNone"), {}))
            pPr.set("marL", "0")
            pPr.set("indent", "0")
        write(spare, NO_CLAIMS, style="g")
    return len(filled)


def _fit(sh, who, warnings):
    """Warn when a box of points will run past its bottom edge. An estimate from the box size: Arial averages
    about 0.52 of its size per character; a line takes size x 1.2 x the paragraph's line spacing."""
    import math
    need = 0.0
    for p in sh.text_frame.paragraphs:
        text = "".join(r.text for r in p.runs)
        if not text:
            continue
        size = next((r.font.size.pt for r in p.runs if r.font.size), 12.0)
        pPr = p._p.find(qn("a:pPr"))
        indent = int(pPr.get("marL", 0)) / 12700 if pPr is not None else 0
        width = sh.width / 12700 - 14.4 - indent
        lines = max(1, math.ceil(len(text) * size * 0.52 / max(width, 1)))
        before = p.space_before.pt if p.space_before is not None else 0
        need += lines * size * 1.2 * (p.line_spacing if isinstance(p.line_spacing, float) else 1.0) + before
    room = sh.height / 12700 - 5.4
    if need > room:
        warnings.append(f"{who}: the text needs about {need / room:.1f} times the height of its box")


def _logo(slide, header, data, warnings, who):
    try:
        from PIL import Image
        raw = base64.b64decode(str(data).split(",", 1)[-1])
        im = Image.open(io.BytesIO(raw))
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        buf = io.BytesIO()
        im.save(buf, "PNG")
    except Exception as e:                                   # an unreadable logo never costs the deck
        warnings.append(f"logo of {who} could not be read ({type(e).__name__}); the name is shown alone")
        return
    h = header.height - 2 * LOGO_PAD
    w = min(int(h * im.size[0] / max(im.size[1], 1)), LOGO_MAX_W)
    ih = int(w * im.size[1] / max(im.size[0], 1))
    chip_w = w + 2 * LOGO_PAD
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    chip = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, header.left + LOGO_PAD // 2, header.top + LOGO_PAD // 2,
                                  chip_w, header.height - LOGO_PAD)
    chip.name = f"logo:chip:{who}"
    chip.fill.solid()
    chip.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    chip.line.fill.background()
    pic = slide.shapes.add_picture(io.BytesIO(buf.getvalue()), header.left + LOGO_PAD // 2 + LOGO_PAD,
                                   int(header.top + (header.height - ih) / 2), w, ih)
    pic.name = f"logo:{who}"
    header.text_frame.margin_left = Emu(chip_w + LOGO_PAD)   # the name keeps to the room beside the chip


def _compare(slide, val, warnings, logos):
    box = _find(slide, "client_point_01")
    if box is not None:
        _points(box, [f"client_point_{k:02d}" for k in range(1, 6)], val)
        _fit(box, "client points", warnings)
    cols = []
    for k in range(1, 5):
        head = _find(slide, f"competitor_{k:02d}_name")
        body = _find(slide, f"competitor_{k:02d}_fact_01") or _find(slide, f"competitor_{k:02d}_point_01")
        if head is None:
            continue
        cols.append((k, head, body))
    if not cols:
        return
    x0 = min(h.left for _, h, _ in cols)
    x1 = max(h.left + h.width for _, h, _ in cols)
    lefts = sorted(h.left for _, h, _ in cols)
    gap = (lefts[1] - lefts[0] - cols[0][1].width) if len(lefts) > 1 else 0
    kept = []
    for k, head, body in cols:
        name = val(f"competitor_{k:02d}_name")
        if not name:
            _remove(head)
            if body is not None:
                _remove(body)
            continue
        write(head.text_frame.paragraphs[0]._p, plain(name))
        if body is not None:
            _points(body, [f"competitor_{k:02d}_point_{j:02d}" for j in range(1, 4)], val,
                    fact=f"competitor_{k:02d}_fact_01")
        kept.append((k, head, body))
    m = len(kept)
    if m and m < len(cols):
        w = (x1 - x0 - gap * (m - 1)) / m
        for i, (_, head, body) in enumerate(kept):
            for sh in (head, body):
                if sh is not None:
                    sh.left = Emu(int(x0 + i * (w + gap)))
                    sh.width = Emu(int(w))
    for k, head, body in kept:                 # after the columns have their final width
        if body is not None:
            _fit(body, f"competitor_{k:02d} points", warnings)
    for k, head, _ in kept:
        data = (logos or {}).get(f"competitor_{k:02d}")
        if data:
            _logo(slide, head, data, warnings, f"competitor_{k:02d}")


# ------------------------------------------------------------------ entry
OWN = re.compile(r"(value_layer_\d+|product_\d+_(name|text)|details_\d+|client_point_\d+|"
                 r"competitor_\d+_(name|fact_\d+|point_\d+))")


def apply(prs, val, warnings, logos=None, skip_ids=()):
    """val(name) -> the value, already cut to its limit ('' when empty). skip_ids: slides about to be dropped."""
    prof = _slide_with(prs, "value_layer_01")
    comp = _slide_with(prs, "competitor_01_name")
    if prof is not None and prof.slide_id not in skip_ids:
        _profile(prof, val, warnings)
    if comp is not None and comp.slide_id not in skip_ids:
        _compare(comp, val, warnings, logos)
