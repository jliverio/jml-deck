"""Seed rows of `template_variables` for template 1.5.4 (José's file of 22 Nov, with the two market research slides).

    python variables/build_seed_1_5_4.py   -> variables/template_variables_1_5_4.csv / .json

Rows already in the 1.x seed keep their text. New rows: the 48 market research variables and the few names
his file adds (section_05..07, a fourth and fifth summary line). The limits of the 48 are "estimated" from the
box sizes and checked by tests/test_research_slides.py on the seven firms of the November trial and on a
deck filled to every limit; they become "measured" once José has seen a real deck in PowerPoint.

These rows are NOT yet in the live n8n table: the live proposal flow reads that table on every run, so they go
in when the flow is switched to 1.5.4 (plan step 8).
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import varfill  # noqa: E402

COLS = ["variable", "draft_chars", "max_chars", "limit_basis", "fills_from", "writing_rule", "if_empty", "example"]
MARKUP = " Markup: **bold**, __grey italic__."


def new_rows():
    r = []

    def add(var, mx, src, rule, empty, ex):
        r.append(dict(variable=var, draft_chars="", max_chars=str(mx), limit_basis="estimated", fills_from=src,
                      writing_rule=rule, if_empty=empty, example=ex))

    add("cover_date_01", 20, "code:today", "The date of the draft, as \"22 November 2026\". The renderer writes "
        "today's date when the payload gives none.", "clear", "22 November 2026")
    add("profile_title_01", 115, "research:profile_title",
        "One sentence, no final period: what the company sells and how. Starts with the company's name.",
        "drop_slide", "n8n sells a workflow automation and AI agent platform, hosted or self-hosted")
    layer = ("Layer {n} of the value chain ({name}). Sells / In-house only / Mixed: the status word in bold, a line "
             "break, then one sentence on what the company does there. Buys: \"Buys from: \" and the suppliers "
             "named, all in grey italic. Not involved or not public: empty (the label then stands alone)." + MARKUP)
    for n, name in enumerate(["Supplies Essential Components", "Builds the Core Product",
                              "Creates Specialist Capability", "Applies Intelligence"], 1):
        add(f"value_layer_{n:02d}", 215, f"research:value_layer_{n}", layer.format(n=n, name=name), "clear",
            "**Sells**\nA platform for building and running workflows and AI agents." if n == 4 else
            "__Buys from: OpenAI, Anthropic and Google Gemini (models)__")
    for n in range(1, 7):
        add(f"product_{n:02d}_name", 40, f"research:product_{n}_name",
            "The product's name as the site writes it. Product in focus first, then in the site's order. "
            "With seven or more products, box 6 is named \"Multi-product company\".", "remove_row",
            "n8n Community Edition")
        add(f"product_{n:02d}_text", 200, f"research:product_{n}_text",
            "One sentence on what the product is. A published price follows after a line break, in bold. "
            "Box 6 of a company with seven or more products lists the other names, separated by \" · \", "
            "ending \"and N more\" in grey italic when they do not fit." + MARKUP, "hide_line",
            "Self-hosted version, available on GitHub.\n**Free**")
    add("details_01", 140, "research:details_markets",
        "The markets: the country in bold, then regions or cities. When the research found none: "
        "\"Markets: not public.\" in grey italic, plus one sentence from the research when it adds something." + MARKUP,
        "hide_line", "**Portugal** · Lisbon, Porto, Setúbal, Leiria, Coimbra, Santarém and Braga")
    add("details_02", 140, "research:details_offer",
        "\"Offer type: \" B2C, B2B or B2C and B2B in bold; \" · Pricing: \" the pricing models in bold; "
        "\" · Regulatory: \" the status in bold, only when the research holds one. A part that is not public reads "
        "\"not public\" in grey italic." + MARKUP, "hide_line",
        "Offer type: **B2C** · Pricing: **subscription, one-off sale**")
    add("sources_profile_01", 135, "research:sources_profile",
        "The company's site, numbered: \"[1] Name, company website, YEAR\". The template prints \"Source: \".",
        "clear", "[1] n8n, company website, 2026")
    add("compare_title_01", 115, "research:compare_title",
        "One sentence, no final period, built from the claims on the slide: what the competitors claim against "
        "the client's claims. Empty only when the research holds neither a claim nor a competitor (the slide is then left out).",
        "drop_slide", "All four competitors also claim to rescue imperfect produce; none claims free delivery")
    add("client_name_01", 20, "research:client_name", "The client's short name, without legal suffixes.",
        "firm_todo", "Equal Food")
    for n in range(1, 6):
        add(f"client_point_{n:02d}", 120, f"research:client_point_{n}",
            "One claim the client makes about itself: a label of one or two words in bold, a colon, then the "
            "claim in the site's sense. Figures in bold. Up to five. The box holds about 13 lines of 23 "
            "characters: with five points keep each under 60 characters." + MARKUP, "hide_line", "**Price:** up to **40%** cheaper than supermarkets")
    for c in range(1, 5):
        add(f"competitor_{c:02d}_name", 30, f"research:competitor_{c}_name",
            "The company's name, not a product's. First four in the research's rank; a competitor whose main "
            "entry failed the checks is skipped. Empty: the column is left out and the others share the width.",
            "remove_row", "Fruta Feia")
        add(f"competitor_{c:02d}_fact_01", 40, f"research:competitor_{c}_fact",
            "The grey line above the claims: country, then one size figure when the research holds one, "
            "separated by \" · \". Plain text (the template makes it grey italic).", "hide_line",
            "Portugal · 12,970 members")
        for p in range(1, 4):
            add(f"competitor_{c:02d}_point_{p:02d}", 100, f"research:competitor_{c}_point_{p}",
                "One claim from the competitor's home page: a label in bold, a colon, the claim. Figures in bold. "
                "No reference numbers. With no claim at all the column says so by itself." + MARKUP, "hide_line",
                "**Waste:** a cooperative that has kept thousands of tonnes of produce from waste")
    add("sources_compare_01", 135, "research:sources_compare",
        "One line in column order: \"[1] Client; [2] Competitor; ...; company websites, YEAR\". "
        "The template prints \"Sources: \".", "clear",
        "[1] Equal Food; [2] Fruta Feia; [3] Misfits Market; [4] Imperfect Foods; company websites, 2026")
    return r


def main():
    old = {r["variable"]: r for r in csv.DictReader(open(os.path.join(HERE, "template_variables.csv"), encoding="utf8"))}
    new = {r["variable"]: r for r in new_rows()}
    names = sorted(varfill.template_variables(varfill.TEMPLATES["1.5.4"]))
    rows, made = [], []
    for n in names:
        if n in new:
            rows.append(new[n])
        elif n in old:
            rows.append(old[n])
        else:                                   # a further line of a block the 1.x seed already describes
            base = n.rsplit("_", 1)[0]
            like = next((old[k] for k in sorted(old, reverse=True) if k.rsplit("_", 1)[0] == base), None)
            row = dict(like) if like else dict.fromkeys(COLS, "")
            row.update(variable=n, example="")
            if base == "section":
                row.update(fills_from="none", if_empty="remove_row")
            elif like and like.get("if_empty") == "firm_todo":
                row["if_empty"] = "hide_line"
            rows.append(row)
            made.append(n)
    with open(os.path.join(HERE, "template_variables_1_5_4.csv"), "w", newline="", encoding="utf8") as fh:
        w = csv.DictWriter(fh, COLS)
        w.writeheader()
        w.writerows(rows)
    json.dump(rows, open(os.path.join(HERE, "template_variables_1_5_4.json"), "w", encoding="utf8"),
              ensure_ascii=False, indent=1)
    print(len(rows), "rows;", len(new), "new;", "copied from a sibling:", made)
    print("not in the template:", sorted(set(new) - set(names)))


if __name__ == "__main__":
    main()
