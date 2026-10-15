"""Offline tests for varfill.py against template 1.2 and the seed table.

Run:  python3 tests/test_varfill.py
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from pptx import Presentation  # noqa: E402
import varfill  # noqa: E402

RULES = json.load(open(os.path.join(ROOT, "variables", "template_variables.json")))
METALCO = json.load(open(os.path.join(HERE, "metalco.json")))
VAR_RE = re.compile(r"(?<![A-Za-z0-9_])(cover|section|finding|sources|next_step|summary|objective|solution|outcome)_[a-z0-9_]+")


def walk(shapes):
    for sh in shapes:
        if sh.shape_type == 6:
            yield from walk(sh.shapes)
        else:
            yield sh


def texts(pptx_bytes):
    prs = Presentation(io.BytesIO(pptx_bytes))
    out = []
    for i, sl in enumerate(prs.slides, 1):
        for sh in walk(sl.shapes):
            if getattr(sh, "has_text_frame", False):
                out.append((i, sh.name, sh.text_frame.text))
    return prs, out


def groups(prs, slide_no):
    return sum(1 for sh in list(prs.slides)[slide_no - 1].shapes if sh.shape_type == 6)


results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


# 1. template and table agree
tv = varfill.template_variables()
table_names = {r["variable"] for r in RULES}
check("every template variable has a table row", tv <= table_names, sorted(tv - table_names))

# 2. realistic deck with the real rules
pptx, warns = varfill.build_deck(METALCO, RULES)
prs, tx = texts(pptx)
left = [t for t in tx if VAR_RE.search(t[2])]
check("no variable names left in the deck", not left, left[:3])
check("agenda shows 3 topics", groups(prs, 2) == 3, groups(prs, 2))
check("market slide shows 3 finding rows", groups(prs, 6) == 3, groups(prs, 6))
check("next steps shows 3 steps", groups(prs, 8) == 3, groups(prs, 8))
cover = [t for t in tx if t[0] == 1 and "Consulting Proposal" in t[2]]
check("cover title and subtitle filled separately",
      cover and "A proposal for MetalCo" in cover[0][2] and "sub" not in cover[0][2].replace("subtitle", ""),
      cover)
f2 = [t for t in tx if t[0] == 6 and "Eurostat reported" in t[2]]
check("empty result line hidden (finding 2 has 2 lines)",
      f2 and len(f2[0][2].split("\n")) == 2, f2[0][2] if f2 else None)
src = [t for t in tx if t[0] == 6 and t[2].startswith("Sources:")]
check("sources footer filled", src and "[1] Hierros" in src[0][2], src)
check("no cut warnings on realistic input", not [w for w in warns if " cut to " in w], warns)
check("every table row has a variable in the template", not any("table rows have no variable" in w for w in warns), warns)

# 3. empty action removes the whole finding row (remove_row)
v = dict(METALCO)
v["finding_03_action_taken"] = ""
prs3, _ = texts(varfill.build_deck(v, RULES)[0])
check("empty action removes the finding row", groups(prs3, 6) == 2, groups(prs3, 6))

# 4. empty sources clears the whole footer line, label included (clear)
v = dict(METALCO)
v["sources_market_01"] = ""
_, tx4 = texts(varfill.build_deck(v, RULES)[0])
check("empty sources clears 'Sources:' label", not any(t[2].startswith("Sources") for t in tx4))

# 5. no findings at all: market slide has no rows, deck still renders
v = {k: x for k, x in METALCO.items() if not k.startswith("finding_")}
prs5, tx5 = texts(varfill.build_deck(v, RULES)[0])
check("no findings -> no finding rows", groups(prs5, 6) == 0, groups(prs5, 6))

# 6. too many agenda topics stops the render
v = dict(METALCO)
v["section_08"] = "Appendix"
try:
    varfill.build_deck(v, RULES)
    check("8 topics raise TemplateCapacityError", False)
except varfill.TemplateCapacityError as e:
    check("8 topics raise TemplateCapacityError", "8 agenda topics" in str(e), str(e))

# 7. a template variable missing from the table stops the render
try:
    varfill.build_deck(METALCO, [r for r in RULES if r["variable"] != "finding_02_context"])
    check("missing table row raises TemplateRulesError", False)
except varfill.TemplateRulesError as e:
    check("missing table row raises TemplateRulesError", "finding_02_context" in str(e), str(e))

# 8. limits come from the table, not the code
rules = [dict(r) for r in RULES]
for r in rules:
    if r["variable"] == "next_step_01":
        r["max_chars"] = 20
pptx8, w8 = varfill.build_deck(METALCO, rules)
_, tx8 = texts(pptx8)
ns = [t[2] for t in tx8 if t[0] == 8 and t[2].startswith("Confirm")]
check("table max_chars is enforced", ns and len(ns[0]) <= 20 and ns[0].endswith("…"), ns)
check("cut produces a warning", any("next_step_01" in w for w in w8), w8)

# 9. a long source list is cut at a whole entry
v = dict(METALCO)
v["sources_market_01"] = "; ".join(f"[{i}] Publisher number {i}, a long report title, 2025" for i in range(1, 9))
_, tx9 = texts(varfill.build_deck(v, RULES)[0])
s9 = [t[2] for t in tx9 if t[0] == 6 and t[2].startswith("Sources:")][0]
check("sources cut after a whole entry", s9.endswith("2025; …"), s9[-40:])

# 10. if_empty from the table overrides the default
rules = [dict(r) for r in RULES]
for r in rules:
    if r["variable"] == "finding_02_result_achieved":
        r["if_empty"] = "firm_todo"
_, tx10 = texts(varfill.build_deck(METALCO, rules)[0])
check("table if_empty overrides the default",
      any("Eurostat reported" in t[2] and "[Firm to complete]" in t[2] for t in tx10))

# 11. a line ending in a citation keeps the citation when it has to be cut
v = dict(METALCO)
v["finding_01_context"] = "Spanish contractors moved a growing share of their steel purchasing to online channels during 2024 and 2025 across the whole of Iberia. [1, 2]"
_, tx11 = texts(varfill.build_deck(v, RULES)[0])
l11 = [t[2] for t in tx11 if t[0] == 6 and "Spanish contractors" in t[2]][0].split("\n")[0]
check("cut keeps the citation", l11.endswith("\u2026 [1, 2]") and len(l11) <= 90, l11)

# 12. slide 4 (summary), template 1.2
SUM = json.load(open(os.path.join(HERE, "summary_doc06.json")))
NOPLAN = json.load(open(os.path.join(HERE, "summary_noplan.json")))


def slide4(values):
    prs = Presentation(io.BytesIO(varfill.build_deck(values, RULES)[0]))
    s4 = list(prs.slides)[3]
    shapes = {sh.name: sh for sh in walk(s4.shapes) if getattr(sh, "has_text_frame", False)}
    col = lambda name: [p.text for p in shapes[name].text_frame.paragraphs if p.text.strip()]
    return (shapes["Title 1"].text_frame.text, col("Google Shape;881;p247"),
            col("Google Shape;882;p247"), col("Google Shape;883;p247"))


t, o, so, oc = slide4({**METALCO, **SUM})
check("slide 4: sentence title printed", t == SUM["summary_title_01"], t)
check("slide 4: four objectives", o == [SUM[f"objective_{k:02d}"] for k in range(1, 5)], o)
n_sol = sum(1 for k in range(1, 6) if SUM[f"solution_{k:02d}"])
check("slide 4: unused solution lines hidden", len(so) == n_sol, so)
check("slide 4: outcomes printed", oc[0] == SUM["outcome_01"], oc)
_, tx12 = texts(varfill.build_deck({**METALCO, **SUM}, RULES)[0])
check("slide 4: no sample text left", not any(w in t2[2] for t2 in tx12 for w in ("proven methodology", "de-risked", "Consulting firm]")))
t, o, so, oc = slide4({**METALCO, **NOPLAN})
check("slide 4, no plan: one placeholder line in Solution", so == ["[Firm to complete] The proposed approach and phases."], so)
check("slide 4, no plan: one placeholder line in Outcomes", oc == ["[Firm to complete] The expected results and deliverables."], oc)
t, o, so, oc = slide4(METALCO)
check("slide 4, nothing sent: one [Firm to complete] per column",
      o == ["[Firm to complete]"] and so == ["[Firm to complete]"] and oc == ["[Firm to complete]"] and t == "[Firm to complete]", (t, o, so, oc))

failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -> {detail}"))
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
