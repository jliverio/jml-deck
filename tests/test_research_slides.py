"""Template 1.5.4: the two market research slides (research_slides.py) and the file layout.

    python tests/test_research_slides.py [out_dir]     # out_dir: also writes the decks, to look at them
"""
import base64
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from pptx import Presentation  # noqa: E402

import research_slides as rs  # noqa: E402
import varfill  # noqa: E402

CASES = json.load(open(os.path.join(HERE, "research_cases.json"), encoding="utf8"))
RULES = json.load(open(os.path.join(os.path.dirname(HERE), "variables", "template_variables_1_5_4.json"), encoding="utf8"))
PLAN = json.load(open(os.path.join(HERE, "metalco_1_4.json"), encoding="utf8"))["workplan"]
LIMIT = {r["variable"]: int(r["max_chars"]) for r in RULES if r["max_chars"]}
OUT = sys.argv[1] if len(sys.argv) > 1 else None
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("ok   " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


def common(client):
    return {"cover_title_01": "Consulting Proposal", "cover_subtitle_01": f"A proposal for {client}",
            "section_01": "Executive Summary", "section_03": "Approach",
            "summary_title_01": f"Two phases take {client} from diagnosis to a decision in 24 weeks",
            "objective_01": "Decide where to grow next", "solution_01": "Diagnose, then design",
            "outcome_01": "A costed plan", "footer_01": f"{client} | Draft for discussion"}


def build(values, name, **kw):
    pptx, warns = varfill.build_deck(values, RULES, workplan=kw.pop("workplan", PLAN), version="1.5.4", **kw)
    if OUT:
        open(os.path.join(OUT, name + ".pptx"), "wb").write(pptx)
    return Presentation(io.BytesIO(pptx)), warns, pptx


def texts(slide):
    out = []

    def walk(shapes):
        for sh in shapes:
            if sh.shape_type == 6:
                walk(sh.shapes)
            elif sh.has_text_frame:
                out.append(sh.text_frame.text)
    walk(slide.shapes)
    return out


def find(prs, needle):
    for s in prs.slides:
        if any(needle in t for t in texts(s)):
            return s
    return None


def boxes(slide, pred):
    return [sh for sh in slide.shapes if sh.has_text_frame and pred(sh.text_frame.text)]


# 1. the template and the seed agree
names = varfill.template_variables(varfill.TEMPLATES["1.5.4"])
check("every template variable has a seed row", not (names - {r["variable"] for r in RULES}),
      str(sorted(names - {r["variable"] for r in RULES})))
check("48 market research variables in the template",
      len([n for n in names if rs.OWN.fullmatch(n) or re.fullmatch(r"(profile|compare)_title_01|client_name_01|sources_(profile|compare)_01", n)]) == 48)

# 2. the seven firms of the trial: nothing cut, no variable or markup left, the rules hold
for firm, vals in CASES.items():
    v = {**vals, **common(vals.get("client_name_01") or firm)}
    prs, warns, raw = build(v, firm)
    allt = [t for s in prs.slides for t in texts(s)]
    check(f"{firm}: no value cut, no box too full", not [w for w in warns if "cut to" in w or "height of its box" in w], str(warns))
    left = [t for t in allt if varfill.TOKEN.search(t) and not t.startswith("http")]
    check(f"{firm}: no variable left", not left, str(left[:3]))
    check(f"{firm}: no markup left", not [t for t in allt if "**" in t or "__" in t])
    check(f"{firm}: no [Firm to complete] on the research slides",
          not any("[Firm to complete]" in t for s in prs.slides for t in texts(s)
                  if any("Product Portfolio" in x or "Competitors Analysis" in x for x in texts(s))))
    prof = find(prs, "Product Portfolio")
    n_layers = sum(1 for k in range(1, 5) if vals.get(f"value_layer_{k:02d}"))
    layer_boxes = boxes(prof, lambda t: t.startswith(("Sells", "In-house only", "Mixed", "Buys from")))
    check(f"{firm}: {n_layers} layer description(s) on the slide", len(layer_boxes) == n_layers, str(len(layer_boxes)))
    n_prod = sum(1 for k in range(1, 7) if vals.get(f"product_{k:02d}_name"))
    prod = [sh for sh in prof.shapes if sh.has_text_frame and sh.text_frame.text.strip() in
            {rs.plain(vals.get(f"product_{k:02d}_name")) for k in range(1, 7)} - {""}]
    check(f"{firm}: {n_prod} product box(es)", len(prod) == n_prod, str(len(prod)))
    if n_prod % 2 == 1 and prod:
        check(f"{firm}: the odd product spans both columns", max(p.width for p in prod) > 1.8 * min(p.width for p in prod)
              or n_prod == 1)
    comp = find(prs, "Competitors Analysis")
    n_comp = sum(1 for k in range(1, 5) if vals.get(f"competitor_{k:02d}_name"))
    if not vals.get("compare_title_01"):
        check(f"{firm}: no competitor, the comparison slide is left out", comp is None)
        continue
    heads = [sh for sh in comp.shapes if sh.has_text_frame and sh.text_frame.text.strip() in
             {vals.get(f"competitor_{k:02d}_name") for k in range(1, 5)} - {None, ""}]
    check(f"{firm}: {n_comp} competitor column(s)", len(heads) == n_comp, str(len(heads)))
    for k in range(1, 5):
        if vals.get(f"competitor_{k:02d}_name") and not any(vals.get(f"competitor_{k:02d}_point_{j:02d}") for j in (1, 2, 3)):
            check(f"{firm}: competitor {k} has no claims and says so", any(rs.NO_CLAIMS in t for t in texts(comp)))
    for sh in comp.shapes:
        if sh.has_text_frame and len(sh.text_frame.paragraphs) >= 2 and sh.height > 3000000:
            sp = {p.line_spacing for p in sh.text_frame.paragraphs}
            check(f"{firm}: line spacing 1.5 in {sh.name} at x={sh.left}", sp == {1.5}, str(sp))

# 3. two competitors: the columns left share the width
v = {**CASES["equalfood"], **common("Equal Food")}
for k in (3, 4):
    for key in list(v):
        if key.startswith(f"competitor_{k:02d}_"):
            v[key] = ""
prs, warns, _ = build(v, "two_competitors")
comp = find(prs, "Competitors Analysis")
heads = sorted((sh for sh in comp.shapes if sh.has_text_frame and sh.text_frame.text.strip() in ("Fruta Feia", "Misfits Market")),
               key=lambda s: s.left)
check("two competitors: two columns", len(heads) == 2)
check("two competitors: they fill the width of four", len(heads) == 2 and heads[1].left + heads[1].width > 11500000
      and heads[0].width > 4000000, str([(h.left, h.width) for h in heads]))

# 4. logos: a chip and a picture in the header; an unreadable logo costs nothing
from PIL import Image  # noqa: E402
buf = io.BytesIO()
Image.new("RGBA", (300, 100), (200, 30, 30, 255)).save(buf, "PNG")
logos = {"competitor_01": base64.b64encode(buf.getvalue()).decode(), "competitor_02": "not an image"}
prs, warns, _ = build({**CASES["equalfood"], **common("Equal Food")}, "logos", logos=logos)
comp = find(prs, "Competitors Analysis")
check("logo: picture placed for competitor 1", any(sh.name == "logo:competitor_01" for sh in comp.shapes))
check("logo: unreadable logo gives a warning and no picture",
      any("logo of competitor_02" in w for w in warns) and not any(sh.name == "logo:competitor_02" for sh in comp.shapes))
head = [sh for sh in comp.shapes if sh.has_text_frame and sh.text_frame.text.strip() == "Fruta Feia"][0]
pic = [sh for sh in comp.shapes if sh.name == "logo:competitor_01"][0]
check("logo: inside its header", head.left <= pic.left and pic.left + pic.width <= head.left + head.width
      and head.top <= pic.top and pic.top + pic.height <= head.top + head.height)

# 5. research found nothing: both slides are left out, the deck still builds
prs, warns, _ = build(common("Bento"), "no_research")
check("no research: both research slides left out", find(prs, "Product Portfolio") is None and find(prs, "Competitors Analysis") is None)
check("no research: the warning names them", any("profile_title_01" in w for w in warns), str(warns))

# 6. every value at its limit: nothing is cut, and the deck is there to look at for overflow
def fill(name):
    n = LIMIT[name]
    words = "market research value chain product competitor price claim source subscription platform".split()
    out, i = "", 0
    while len(out) + len(words[i % len(words)]) + 1 <= n:
        out += (" " if out else "") + words[i % len(words)]
        i += 1
    return out
v = common("Client at the limit")
for n_ in names:
    if rs.OWN.fullmatch(n_) or re.fullmatch(r"(profile|compare)_title_01|client_name_01|sources_(profile|compare)_01", n_):
        v[n_] = fill(n_)
prs, warns, _ = build(v, "at_limits")
check("at the limits: no value cut", not [w for w in warns if "cut to" in w], str(warns))
check("at the limits: the renderer says which boxes are too full",
      sum(1 for w in warns if "height of its box" in w) == 5, str(warns))

# 7. the deck's structure is the file's
prs, warns, _ = build({**CASES["n8n"], **common("n8n")}, "structure",
                      s3={"assumptions": [{"id": "A1", "text": "A sponsor is named before kick-off.", "if_wrong": "The start moves."}]})
titles = [next((sh.text_frame.text for sh in s.placeholders if sh.placeholder_format.idx == 0), "") for s in prs.slides]
check("structure: 12 slides", len(titles) == 12, str(len(titles)))
check("structure: titles keep their section", all(t.startswith(("Market Research | ", "Approach | ")) for t in titles[3:5] + titles[7:10]),
      str(titles))
check("structure: assumptions close the deck", "assumption" in titles[-1], titles[-1])
check("structure: no stock team slide", not any("Our Expert" in t for s in prs.slides for t in texts(s)))
check("structure: the cover carries a date", not any("DD_Month" in t or "cover_date" in t for t in texts(prs.slides[0])))

print(f"{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
