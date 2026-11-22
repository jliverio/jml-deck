"""How much room a text takes in its box.

The deck is written in Arial. Liberation Sans has the same letter widths as Arial (it was made to), is free to
ship (SIL Open Font License, assets/fonts/), and is what LibreOffice shows in Arial's place. So a line break
worked out here with Liberation Sans falls where PowerPoint puts it with Arial, to within the odd word.

    measure(shape)            -> {"lines", "need_pt", "room_pt", "over", "over_by_lines"}
    lines_of(segments, room)  -> number of lines a paragraph takes in `room` points of width

Used by research_slides.py (template 1.5.4): the /fit endpoint reports every box of the two market research
slides, so the slide-values stage can check its text before a deck is built; /render drops the last point of a
box, or trims a text, when something still does not fit (José, 22 Nov: text never runs out of its box).
"""
import math
import os

from pptx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "assets", "fonts")
FILES = {(False, False): "LiberationSans-Regular.ttf", (True, False): "LiberationSans-Bold.ttf",
         (False, True): "LiberationSans-Italic.ttf", (True, True): "LiberationSans-BoldItalic.ttf"}
LINE = 1.2            # one line takes about 1.15 times the font size in Arial; 1.2 leaves a small margin
SLACK = 1.5           # points a box may be over before it counts (rounding)
DEFAULT_SIZE = 12.0
_cache = {}


def _font(bold, italic):
    key = (bool(bold), bool(italic))
    if key not in _cache:
        from PIL import ImageFont
        _cache[key] = ImageFont.truetype(os.path.join(FONTS, FILES[key]), 200)
    return _cache[key]


def width(text, size, bold=False, italic=False):
    """Width of `text` in points at `size` points."""
    return _font(bold, italic).getlength(text) * size / 200.0


def _words(segments):
    """[(text, size, bold, italic)] -> list of words; a word is a list of pieces [(text, size, bold, italic)],
    followed by the width of the space after it (0 when it ends at a hyphen or at the end)."""
    words, cur = [], []
    for text, size, bold, italic in segments:
        buf = ""
        for ch in text:
            if ch in " \t " and ch != " ":
                if buf:
                    cur.append((buf, size, bold, italic))
                    buf = ""
                if cur:
                    words.append((cur, width(" ", size, bold, italic)))
                    cur = []
            else:
                buf += ch
                if ch == "-" and len(buf) > 1:        # a line may break after a hyphen
                    cur.append((buf, size, bold, italic))
                    buf = ""
                    words.append((cur, 0.0))
                    cur = []
        if buf:
            cur.append((buf, size, bold, italic))
    if cur:
        words.append((cur, 0.0))
    return words


def lines_of(segments, room):
    """Lines a run of text takes in `room` points, breaking at spaces and after hyphens."""
    n, cur, gap = 0, 0.0, 0.0
    for pieces, space in _words(segments):
        w = sum(width(t, s, b, i) for t, s, b, i in pieces)
        if n == 0:
            n, cur = 1, w
        elif cur + gap + w <= room:
            cur += gap + w
        else:
            n += 1
            cur = w
        gap = space
    return max(n, 1)


def _paragraph(p, default_size):
    """A paragraph as hard lines of segments, with its font size."""
    lines, cur, sizes = [], [], []
    for el in p._p:
        if el.tag == qn("a:br"):
            lines.append(cur)
            cur = []
        elif el.tag in (qn("a:r"), qn("a:fld")):
            rPr = el.find(qn("a:rPr"))
            t = el.find(qn("a:t"))
            text = t.text if t is not None and t.text else ""
            size = int(rPr.get("sz")) / 100.0 if rPr is not None and rPr.get("sz") else default_size
            bold = rPr is not None and rPr.get("b") in ("1", "true")
            italic = rPr is not None and rPr.get("i") in ("1", "true")
            if text:
                cur.append((text, size, bold, italic))
                sizes.append(size)
    lines.append(cur)
    return lines, (max(sizes) if sizes else default_size)


def _indent(tf, p):
    """Left indent of a paragraph in EMU: its own marL, else the one its text box sets for that level
    (the fourth competitor box of template 1.5.4 keeps its bullets' indent there, not on the paragraph)."""
    pPr = p._p.find(qn("a:pPr"))
    if pPr is not None and pPr.get("marL") is not None:
        return int(pPr.get("marL"))
    lvl = int(pPr.get("lvl", 0)) + 1 if pPr is not None else 1
    lst = tf._txBody.find(qn("a:lstStyle"))
    if lst is not None:
        el = lst.find(qn(f"a:lvl{lvl}pPr"))
        if el is not None and el.get("marL") is not None:
            return int(el.get("marL"))
    return 0


def measure(shape, max_lines=None, default_size=DEFAULT_SIZE):
    """Lines and height the shape's text needs against the room its box gives.
    max_lines: for a title, whose box is one line high by design but may run to two."""
    tf = shape.text_frame
    box_w = (shape.width - tf.margin_left - tf.margin_right) / 12700.0
    room = (shape.height - tf.margin_top - tf.margin_bottom) / 12700.0
    paras = list(tf.paragraphs)
    need, total, heights = 0.0, 0, []
    for i, p in enumerate(paras):
        hard, size = _paragraph(p, default_size)
        mar = _indent(tf, p) / 12700.0
        n = sum(lines_of(seg, box_w - mar) if seg else 1 for seg in hard)
        ls = p.line_spacing
        line_h = size * LINE * ls if isinstance(ls, float) else (ls.pt if ls is not None else size * LINE)
        before = p.space_before.pt if p.space_before is not None and i > 0 else 0.0
        after = p.space_after.pt if p.space_after is not None and i < len(paras) - 1 else 0.0
        need += n * line_h + before + after
        total += n
        heights.append(line_h)
    line_h = sum(heights) / len(heights) if heights else default_size * LINE
    if max_lines is not None:
        over_by = max(total - max_lines, 0)
        room_lines = max_lines
    else:
        over_by = max(int(math.ceil((need - room - SLACK) / line_h)), 0) if need > room + SLACK else 0
        room_lines = total - over_by if over_by else total + max(int((room + SLACK - need) // line_h), 0)
    return {"lines": total, "room_lines": max(room_lines, 0), "need_pt": round(need, 1), "room_pt": round(room, 1),
            "over": over_by > 0, "over_by_lines": over_by}
