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
    check(f"{firm}: no value cut, nothing trimmed to fit",
          not [w for w in warns if "cut" in w or "left out to fit" in w or "does not fit" in w], str(warns))
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

# 5b. no competitor, but the company's claims are there: the slide stays and says so
v = {**CASES["equalfood"], **common("Equal Food")}
for n_ in list(v):
    if n_.startswith("competitor_"):
        v[n_] = ""
v["compare_title_01"] = "Equal Food makes 5 claims; the research found no competitor to compare them with"
v["sources_compare_01"] = "[1] Equal Food; company website, 2026"
prs, warns, _ = build(v, "no_competitor_claims_only")
comp = find(prs, "Competitors Analysis")
check("no competitor, claims present: the slide stays", comp is not None)
if comp is not None:
    tx = "\n".join(texts(comp))
    check("no competitor: one box says none was found", rs.NO_COMPETITOR in tx and rs.NO_CLAIMS not in tx, tx[-300:])
    check("no competitor: the company's points are there, no column header is left",
          "cheaper than supermarkets" in tx and not [sh for sh in comp.shapes if sh.name.startswith("rs:competitor_")])
    box = [sh for sh in comp.shapes if sh.name == "rs:no_competitor"]
    check("no competitor: the box spans the competitors' area", len(box) == 1 and box[0].width > 6000000, [b.width for b in box])
    check("no competitor: no variable name left on the slide", not re.search(r"competitor_\d+_|client_point_\d+", tx), tx)

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
check("at the limits: no value cut by its character limit", not [w for w in warns if re.search(r"cut to \d+ characters", w)], str(warns))
check("at the limits: the last resort says what it left out or cut",
      sum(1 for w in warns if "left out to fit the box" in w) >= 4 and any("client_points" in w for w in warns), str(warns))
after = rs.fit_boxes(prs, [], last_resort=False)
check("at the limits: after the last resort no points box and no text box is over",
      not [b["box"] for b in after if b["over"] and b["kind"] in ("points", "text")],
      str([(b["box"], b["lines"], b["room_lines"]) for b in after if b["over"]]))

# 6b. the fit report: line counts as LibreOffice wraps them (seen in the rendered test decks of 22 Nov)
def report(values, **kw):
    rep = {}
    varfill.build_deck(values, RULES, version="1.5.4", fit_report=rep, last_resort=False, **kw)
    return {b["box"]: b for b in rep["boxes"]}
rep = report({**CASES["n8n"], **common("n8n")})
got = {k: rep[k]["lines"] for k in ("client_points", "competitor_01_points", "competitor_02_points", "competitor_03_points", "competitor_04_points")}
check("fit: n8n comparison boxes wrap as rendered (13, 10, 10, 10, 9 lines)", list(got.values()) == [13, 10, 10, 10, 9], str(got))
rep = report({**CASES["equalfood"], **common("Equal Food")})
got = {k: rep[k]["lines"] for k in ("client_points", "competitor_01_points", "competitor_02_points", "competitor_03_points", "competitor_04_points")}
check("fit: Equal Food comparison boxes wrap as rendered (12, 10, 9, 10, 8 lines)", list(got.values()) == [12, 10, 9, 10, 8], str(got))
check("fit: every box of a real case has room, titles on two lines at most",
      not [b for b in rep.values() if b["over"]] and rep["profile_title_01"]["lines"] <= 2)
check("fit: each box names its variables", rep["competitor_02_points"]["variables"][0] == "competitor_02_fact_01"
      and rep["details"]["variables"] == ["details_01", "details_02"])
rep = report(v)
over = sorted(b["box"] for b in rep.values() if b["over"])
check("fit: at the limits the report names the boxes that are over, and by how many lines",
      "client_points" in over and all(rep[k]["over_by_lines"] >= 1 for k in over), str(over))

# 6c. /fit endpoint
import app as webapp  # noqa: E402
webapp.API_KEY = ""
client = webapp.app.test_client()
r = client.post("/fit", json={"values": {**CASES["n8n"], **common("n8n")}, "rules": RULES, "template": "1.5.4"})
j = r.get_json()
check("/fit: a real case fits", r.status_code == 200 and j["fits"] is True and j["over"] == [] and len(j["boxes"]) >= 20, str(j)[:300])
r = client.post("/fit", json={"values": v, "rules": RULES, "template": "1.5.4"})
j = r.get_json()
check("/fit: at the limits it does not fit and lists the boxes", r.status_code == 200 and j["fits"] is False
      and any(b["box"] == "client_points" for b in j["over"]), str(j)[:300])
check("/health: says the fit check is ready", client.get("/health").get_json().get("fit") is True)
r = client.post("/fit", json={"values": {}, "template": "1.5"})
check("/fit: refuses a template without the research slides", r.status_code == 422)

# 6d. the client's logo on the cover
def png(color, size=(400, 120)):
    b = io.BytesIO()
    Image.new("RGBA", size, color).save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()
prs, warns, _ = build({**CASES["n8n"], **common("n8n")}, "cover_logo", logos={"client": png((20, 40, 160, 255))})
cover = prs.slides[0]
pic = [sh for sh in cover.shapes if sh.name == "logo:client"]
check("cover logo: placed on the cover", len(pic) == 1)
check("cover logo: inside the logo slot, not stretched",
      len(pic) == 1 and pic[0].left >= 500000 and pic[0].width <= 2010000 and pic[0].height <= 1050000
      and abs(pic[0].width / pic[0].height - 400 / 120) < 0.05, str([(p.left, p.top, p.width, p.height) for p in pic]))
check("cover logo: the empty slot is gone", not any(sh.is_placeholder and "PICTURE" in str(sh.placeholder_format.type) for sh in cover.shapes))
prs, warns, _ = build({**CASES["n8n"], **common("n8n")}, "cover_logo_white", logos={"client": png((255, 255, 255, 255)), "competitor_01": png((250, 250, 250, 255))})
check("cover logo: a white logo is left out, with a warning, on the cover and in a header",
      not any(sh.name.startswith("logo:") for s_ in prs.slides for sh in s_.shapes)
      and sum(1 for w in warns if "would not show on white" in w) == 2, str(warns))
prs, warns, _ = build({**CASES["n8n"], **common("n8n")}, "cover_logo_tiny", logos={"client": png((20, 40, 160, 255), (16, 16))})
check("cover logo: a 16 px icon is left out", any("too small" in w for w in warns) and not any(sh.name == "logo:client" for sh in prs.slides[0].shapes))

# 7. the deck's structure is the file's
prs, warns, _ = build({**CASES["n8n"], **common("n8n")}, "structure",
                      s3={"assumptions": [{"id": "A1", "text": "A sponsor is named before kick-off.", "if_wrong": "The start moves."}]})
titles = [next((sh.text_frame.text for sh in s.placeholders if sh.placeholder_format.idx == 0), "") for s in prs.slides]
check("structure: 13 slides", len(titles) == 13, str(len(titles)))
check("structure: titles keep their section", all(t.startswith(("Market Research | ", "Approach | ")) for t in titles[3:5] + titles[7:10]),
      str(titles))
check("structure: assumptions close the deck", "assumption" in titles[-1], titles[-1])
check("structure: the team slide is in the deck, before the closing slide (José, 22 Nov)",
      any("Our Expert" in t for t in texts(prs.slides[10])), str(texts(prs.slides[10])[:3]))
check("structure: the cover carries a date", not any("DD_Month" in t or "cover_date" in t for t in texts(prs.slides[0])))


# 8. agenda: only the topics that have a slide, closed up and numbered 1, 2, 3
def agenda(prs):
    rows = []
    for g in prs.slides[1].shapes:
        if g.shape_type == 6 and g.name.startswith("agenda:row:"):
            num = next(x.text_frame.text.strip() for x in g.shapes if x.has_text_frame and x.text_frame.text.strip().isdigit())
            txt = next(x.text_frame.text.strip() for x in g.shapes if x.has_text_frame and not x.text_frame.text.strip().isdigit())
            rows.append((g.top, num, txt))
    return sorted(rows)


rows = agenda(prs)
check("agenda: three topics, no [Firm to complete]", [r[2] for r in rows] == ["Executive Summary", "Market Research", "Approach"],
      str(rows))
check("agenda: no [Firm to complete] anywhere on it", not any("[Firm to complete]" in t for t in texts(prs.slides[1])))
first_top, pitch = rows[0][0], rows[1][0] - rows[0][0]
prs2, warns2, _ = build({**common("Bento"), "section_02": "Market Research", "section_04": "Next Steps"}, "agenda_no_research")
rows2 = agenda(prs2)
check("agenda, no research: Market Research and Next Steps are left out", [r[2] for r in rows2] == ["Executive Summary", "Approach"],
      str(rows2))
check("agenda, no research: numbered 1 and 2", [r[1] for r in rows2] == ["1", "2"], str(rows2))
check("agenda, no research: Approach moves up into the second place",
      len(rows2) == 2 and abs(rows2[1][0] - (first_top + pitch)) < 20000 and abs(rows2[0][0] - first_top) < 20000, str(rows2))
check("agenda, no research: the warning names what was left out",
      any('"Next Steps" has no slide' in w for w in warns2) and any('"Market Research" has no slide' in w for w in warns2), str(warns2))

# 9. approach slide: the "Main Deliverables" panel stays as in José's file, the phases are drawn beside it
import approach_plans  # noqa: E402
import fit  # noqa: E402


def approach(prs):
    return next(s for s in prs.slides if any(sh.name == "workplan:roadmap" for sh in s.shapes))


def drawn(slide):
    return [sh for sh in slide.shapes if not sh.name.startswith("approach:") and not sh.is_placeholder]


for n, scoped in ((1, True), (2, True), (2, False), (3, True), (4, True), (5, True)):
    tag = f"approach, {n} phase(s){'' if scoped else ', no scope'}"
    client = "Barbearias Bento" if n == 5 else "MetalCo"
    prs9, _, _ = build({**CASES["n8n"], **common(client)}, f"approach_{n}{'' if scoped else 'u'}",
                       workplan=approach_plans.plan(n, scoped, client=client))
    sl = approach(prs9)
    panel = [sh for sh in sl.shapes if sh.name.startswith("approach:panel")]
    if n == 1:
        check("approach: the panel is in the deck, 13 shapes", len(panel) == 13, str(len(panel)))
        check("approach: its heading and its four lines are as in the file",
              [sh.text_frame.text for sh in panel if sh.name == "approach:panel:head"] == ["Main Deliverables"]
              and sum(1 for sh in panel if sh.name.startswith("approach:panel:text") and sh.text_frame.text.startswith("[Insert guiding principle")) == 4)
        check("approach: its four icons are in the deck", sum(1 for sh in panel if sh.shape_type == 13) == 4)
        check("approach: the note sits on the line at the foot", [sh.text_frame.text for sh in sl.shapes if sh.name == "approach:note"]
              == ["Initial view – to confirm with MetalCo"] and not any("Source: xx" in t for t in texts(sl)))
    left = min(sh.left for sh in panel)
    check(f"{tag}: nothing drawn reaches the panel", max(sh.left + sh.width for sh in drawn(sl)) < left,
          str(max(sh.left + sh.width for sh in drawn(sl))))
    over = [sh.text_frame.text[:40] for sh in drawn(sl) if sh.has_text_frame and sh.text_frame.text.strip() and fit.measure(sh)["over"]]
    check(f"{tag}: every text fits its box", not over, str(over))
    cut = [t[:40] for t in texts(sl) if t.endswith("…")]
    check(f"{tag}: no text is cut", not cut, str(cut))
    sizes = {}
    for sh in drawn(sl):
        if sh.has_text_frame and sh.text_frame.text.strip():
            t, r = sh.text_frame.text, sh.text_frame.paragraphs[0].runs[0]
            kind = "phase" if t.startswith("Phase ") else "scope" if t.startswith(("Map how", "Answer the")) else "decision" if "ecision: " in t else None
            if kind:
                sizes.setdefault(kind, set()).add(r.font.size.pt)
    check(f"{tag}: one type size per kind of text", all(len(v) == 1 for v in sizes.values()) and len(sizes) == 3, str(sizes))
    if n <= 2:
        check(f"{tag}: the type is as large as without the panel (12, 12 and 11 pt)",
              sizes == {"phase": {12.0}, "scope": {12.0}, "decision": {11.0}}, str(sizes))
    if n == 5:
        check(f"{tag}: no text under 9 pt but the weeks line in the arrows", min(min(v) for v in sizes.values()) >= 9, str(sizes))
prs9, warns9, _ = build({**CASES["n8n"], **common("n8n")}, "approach_no_plan", workplan=None)
sl = approach(prs9)
check("approach, no plan: the panel stays and the note line is empty",
      sum(1 for sh in sl.shapes if sh.name.startswith("approach:panel")) == 13
      and [sh.text_frame.text for sh in sl.shapes if sh.name == "approach:note"] == [""], str(texts(sl))[:200])

print(f"{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
