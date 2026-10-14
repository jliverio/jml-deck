"""
varfill.py - JML AI Analyst deck renderer (v3, variable-based).

The template marks every editable text with a lowercase variable name
(e.g. section_01, finding_02_headline). Everything else ships exactly as
written. build_deck(values) fills the variables and returns .pptx bytes.

Rules (see JML_Template_Variables guide):
  * only exact, whole variable names are replaced (title_01 never matches
    inside subtitle_01);
  * a variable split across text runs is re-joined first, but only when the
    runs share the same formatting - otherwise rendering fails loudly;
  * a group whose variables are all empty is removed (agenda topics,
    finding rows, next steps);
  * an empty context/result line is hidden; an empty footer is cleared;
  * anything still unfilled at the end becomes [Firm to complete];
  * if more agenda topics are supplied than the template holds, rendering
    stops with TemplateCapacityError instead of dropping topics.
"""
import io
import os
import re
import zipfile

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "template_v1_1.potx")
FIRM_TODO = "[Firm to complete]"

TOKEN = re.compile(r"(?<![A-Za-z0-9_])[a-z0-9]+(?:_[a-z0-9]+)+(?![A-Za-z0-9_])")

# Character limits measured by test render on Oct 15, 2026 (template 1.1).
LIMITS = [
    (r"cover_title_\d+", 21),
    (r"cover_subtitle_\d+", 100),
    (r"section_\d+", 20),
    (r"objective_\d+", 127),
    (r"solution_\d+", 95),
    (r"outcome_\d+", 127),
    (r"finding_\d+_headline", 80),
    (r"finding_\d+_(context|action_taken|result_achieved)", 90),
    (r"sources_market_\d+", 204),
    (r"next_step_\d+", 115),
]
DEFAULTS = {
    "cover_title_01": "Consulting Proposal",
    "cover_subtitle_01": "A consulting proposal",
}
HIDE_LINE = re.compile(r"finding_\d+_(context|result_achieved)$")
CLEAR_PARA = re.compile(r"sources_market_\d+$")


class TemplateCapacityError(ValueError):
    pass


class TemplateFormatError(ValueError):
    pass


# --------------------------------------------------------------- helpers
def _load_template(path):
    """python-pptx refuses .potx; patch the content type in memory."""
    with open(path, "rb") as fh:
        raw = fh.read()
    if path.endswith(".potx"):
        src = zipfile.ZipFile(io.BytesIO(raw))
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as dst:
            for item in src.infolist():
                data = src.read(item.filename)
                if item.filename == "[Content_Types].xml":
                    data = data.replace(b"presentationml.template.main+xml",
                                        b"presentationml.presentation.main+xml")
                dst.writestr(item, data)
        raw = buf.getvalue()
    return Presentation(io.BytesIO(raw))


def _limit(name):
    for pat, n in LIMITS:
        if re.fullmatch(pat, name):
            return n
    return None


def _shorten(s, n):
    s = " ".join(str(s).split())
    if n is None or len(s) <= n:
        return s
    cut = s[: n - 1]
    sp = cut.rfind(" ")
    if sp > n * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ,.;:") + "…"


def _fmt(run):
    f = run.font
    color = None
    try:
        if f.color and f.color.type is not None:
            color = str(f.color.rgb) if f.color.type == 1 else str(f.color.theme_color)
    except Exception:
        pass
    return (f.size, f.bold, f.italic, f.name, color)


def _same_look(runs):
    """True when the runs would render alike. An unset value (inherited)
    matches anything; italic unset counts as not italic."""
    looks = [_fmt(r) for r in runs]
    for k in range(5):
        vals = {lk[k] for lk in looks}
        if k == 2:  # italic
            vals = {bool(v) for v in vals}
        else:
            vals.discard(None)
        if len(vals) > 1:
            return False
    return True


def _walk(shapes):
    for sh in shapes:
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from _walk(sh.shapes)
        else:
            yield sh


def _text_shapes(slide):
    return [s for s in _walk(slide.shapes) if getattr(s, "has_text_frame", False)]


def _join_split_tokens(para, where):
    """Re-join variables that PowerPoint split across runs (one per pass)."""
    for _ in range(50):
        runs = [r for r in para.runs]
        bounds, pos = [], 0
        for r in runs:
            bounds.append((pos, pos + len(r.text)))
            pos += len(r.text)
        full = "".join(r.text for r in runs)
        split = None
        for m in TOKEN.finditer(full):
            idx = [i for i, (s, e) in enumerate(bounds) if e > s and s < m.end() and e > m.start()]
            if len(idx) > 1:
                split = (m.group(), idx)
                break
        if split is None:
            return
        name, idx = split
        if not _same_look([runs[i] for i in idx]):
            raise TemplateFormatError(
                f"{where}: variable '{name}' is split across runs with different formatting; "
                f"retype it in PowerPoint in one go")
        runs[idx[0]].text = "".join(runs[i].text for i in idx)
        for i in idx[1:]:
            runs[i].text = ""


def _remove(el):
    el.getparent().remove(el)


# --------------------------------------------------------------- builder
def build_deck(values, template=TEMPLATE):
    values = dict(values or {})
    prs = _load_template(template)
    slides = list(prs.slides)

    # 0. normalise split variables, collect what the template holds
    present = set()
    for si, sl in enumerate(slides, 1):
        for sh in _text_shapes(sl):
            for p in sh.text_frame.paragraphs:
                _join_split_tokens(p, f"slide {si} / {sh.name}")
                for r in p.runs:
                    present.update(TOKEN.findall(r.text))

    # 1. capacity check for agenda topics
    slots = sorted(v for v in present if re.fullmatch(r"section_\d+", v))
    asked = [k for k, v in values.items() if re.fullmatch(r"section_\d+", k) and str(v or "").strip()]
    extra = [k for k in asked if k not in slots]
    if extra:
        raise TemplateCapacityError(
            f"This proposal has {len(slots) + len(extra)} agenda topics; the template holds {len(slots)}.")

    def val(name):
        v = values.get(name)
        v = "" if v is None else str(v).strip()
        if not v and name in DEFAULTS:
            v = DEFAULTS[name]
        if not v:
            return ""
        n = _limit(name)
        if CLEAR_PARA.fullmatch(name) and n and len(v) > n:
            parts, out = v.split("; "), ""
            for part in parts:
                nxt = part if not out else out + "; " + part
                if len(nxt) + 2 > n:
                    break
                out = nxt
            return (out + "; \u2026") if out else _shorten(v, n)
        return _shorten(v, n)

    # 2. remove groups whose variables are all empty
    def prune(shapes_parent, si):
        for sh in list(shapes_parent):
            if sh.shape_type != MSO_SHAPE_TYPE.GROUP:
                continue
            names = set()
            for s in _walk(sh.shapes):
                if getattr(s, "has_text_frame", False):
                    names.update(TOKEN.findall(s.text_frame.text))
            if names and all(not val(n) for n in names):
                _remove(sh._element)
            else:
                prune(sh.shapes, si)

    for si, sl in enumerate(slides, 1):
        prune(sl.shapes, si)

    # 3. fill, hide empty lines, clear empty footers
    for sl in slides:
        for sh in _text_shapes(sl):
            tf = sh.text_frame
            for p in list(tf.paragraphs):
                ptext = "".join(r.text for r in p.runs)
                names = TOKEN.findall(ptext)
                if not names:
                    continue
                if all(not val(n) for n in names):
                    if all(HIDE_LINE.fullmatch(n) for n in names) and len(tf.paragraphs) > 1:
                        _remove(p._p)
                        continue
                    if all(CLEAR_PARA.fullmatch(n) for n in names):
                        for r in p.runs:
                            r.text = ""
                        continue
                for r in p.runs:
                    r.text = TOKEN.sub(lambda m: val(m.group()) or FIRM_TODO, r.text)

    # 4. safety net: nothing that looks like a variable may survive
    for si, sl in enumerate(slides, 1):
        for sh in _text_shapes(sl):
            for p in sh.text_frame.paragraphs:
                for r in p.runs:
                    if TOKEN.search(r.text) and any(m.group() in present for m in TOKEN.finditer(r.text)):
                        r.text = TOKEN.sub(lambda m: FIRM_TODO if m.group() in present else m.group(), r.text)

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()


if __name__ == "__main__":
    import json, sys
    vals = json.load(open(sys.argv[1]))
    dest = sys.argv[2] if len(sys.argv) > 2 else "out.pptx"
    open(dest, "wb").write(build_deck(vals))
    print("wrote", dest)
