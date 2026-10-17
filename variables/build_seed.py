"""
Seed for the n8n data table `template_variables` (template 1.2).

The live copy is the n8n data table; this file is the version-controlled
starting point and the input for the renderer's offline tests.

Columns
  variable      exact name as written in the template
  draft_chars   length the drafting agent may write (blank: no drafting stage)
  max_chars     longest text that fits the box (what the renderer enforces)
  limit_basis   measured (test render) or estimated (box geometry)
  fills_from    who supplies the value:
                  fixed:<text>          literal text; {client_name} is filled in
                  researcher:<field>    market researchers: summary, context,
                                        action, result, sources
                  summary_writer:<part> the Summary Writer agent: title,
                                        objectives, solution, outcomes
                  pending:<agent>       not built yet; treated as empty
                  none                  slot not used
  writing_rule  instruction given to the agent that writes or shortens it
  if_empty      what the renderer does when the value is empty:
                  remove_row  delete the grouped row (agenda topic, finding,
                              next step)
                  hide_line   delete just this line
                  clear       blank the whole line, label included
                  firm_todo   print [Firm to complete]
  example       sample text in the expected style (fictional MetalCo brief)
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
rows = []


def add(variable, max_chars, basis, fills_from, rule, if_empty, example="", draft=None):
    rows.append({
        "variable": variable,
        "draft_chars": draft,
        "max_chars": max_chars,
        "limit_basis": basis,
        "fills_from": fills_from,
        "writing_rule": rule,
        "if_empty": if_empty,
        "example": example,
    })


# Slide 1
add("cover_title_01", 21, "measured", "fixed:Consulting Proposal",
    "Title Case, at most 4 words. Generic until a topic-specific rule is agreed.",
    "firm_todo", "Consulting Proposal")
add("cover_subtitle_01", 100, "measured", "fixed:A proposal for {client_name}",
    "\"A proposal for [client short name]\". Use the name the client uses for itself, "
    "without legal suffixes (SA, GmbH, Ltd).",
    "firm_todo", "A proposal for MetalCo")

# Sections (agenda, dividers, slide headers)
sections = {1: "Context", 2: "Market Research", 3: "Next Steps"}
for n in range(1, 8):
    add(f"section_{n:02d}", 20, "measured",
        f"fixed:{sections[n]}" if n in sections else "none",
        "Title Case noun phrase, 1 to 3 words. Same text on the agenda, the divider and the "
        "slide header. No numbers (the template prints them).",
        "remove_row", sections.get(n, ""))

# Slide 4: Summary of our proposal (template 1.2). Written by the Summary Writer agent
# (06_proposal_summary.md); limits estimated from a test render (substitute font, 14 pt, box 277 x 296 pt).
add("summary_title_01", 90, "estimated", "summary_writer:title",
    "One full sentence naming the client, no final period. With a plan: what the work as a whole "
    "will do, with the total duration and the number of phases. Without a plan: what the client wants.",
    "firm_todo", "We will design and pilot MetalCo's marketplace in two phases over 16 weeks")
obj = ["Launch a digital marketplace for construction materials.",
       "Reach smaller contractors directly without losing distributor margins.",
       "Grow digital revenue to 10% of sales within two years.",
       "Launch in Iberia first, then expand to other markets."]
for n in range(1, 5):
    add(f"objective_{n:02d}", 127, "estimated", "summary_writer:objectives",
        "One client goal per line, verb first, no subject, in the client's own words. Every "
        "condition the client stated appears. No solution or firm language.",
        "firm_todo" if n == 1 else "hide_line", obj[n - 1])
sol = ["The work will run 16 weeks in two phases, one after the other.",
       "Design (6 weeks): Define the marketplace model, pricing and channel rules.",
       "Pilot (10 weeks): Launch with a first group of contractors and measure uptake.",
       "The rollout after the pilot will not be part of these phases.", ""]
for n in range(1, 6):
    add(f"solution_{n:02d}", 95, "estimated", "summary_writer:solution",
        "Line 1: total duration, number of phases and how they run. Then one line per phase, "
        "\"Name (N weeks): objective\". Last, what stays outside the phases, only when the brief or "
        "the plan says so. Future tense. Names and weeks exactly as the Phase Architect set them.",
        "firm_todo" if n == 1 else "hide_line", sol[n - 1])
out = ["Marketplace business model blueprint",
       "Roadmap and feature backlog for a first version",
       "Business case including implementation plan and roadmap", ""]
for n in range(1, 5):
    add(f"outcome_{n:02d}", 127, "estimated", "summary_writer:outcomes",
        "A deliverable the client receives, as a noun phrase in the plan's own words. No promised "
        "results and no adjective the deliverable does not carry.",
        "firm_todo" if n == 1 else "hide_line", out[n - 1])

# Slide 6: market findings (CAR)
ex = {
    "headline": "A competitor already sells in MetalCo's target channel.",
    "context": "Spanish contractors moved more of their purchasing online in 2024.",
    "action_taken": "Hierros García launched an online steel marketplace in Spain in March 2025.",
    "result_achieved": "Hierros García reported 1,200 registered contractors by June 2025.",
}
spec = [
    ("headline", 80, "researcher:summary", "remove_row",
     "Why the finding matters to the client's problem, naming the part of the problem it "
     "touches. Describe the link, not a response. No \"should\" or \"must\", no advice."),
    ("context", 90, "researcher:context", "hide_line",
     "The situation that led to the action. Name the country or region if the source does. "
     "Past tense for what happened. No judgment adjectives."),
    ("action_taken", 90, "researcher:action", "remove_row",
     "Start with the actor's name (the slide has no separate actor box). What they did or "
     "announced, past tense. No judgment adjectives."),
    ("result_achieved", 90, "researcher:result", "hide_line",
     "What came of it, only as a source reports it. \"[Publisher] projects\" for a forecast. "
     "When no source reports a result, write \"Not yet reported\"; the line is then hidden on the slide."),
]
for n in range(1, 6):
    for key, mx, fills, empty, rule in spec:
        add(f"finding_{n:02d}_{key}", mx, "measured", fills, rule, empty,
            ex[key] if n == 1 else "", draft=mx * 2)
add("sources_market_01", 204, "measured", "researcher:sources",
    "The template prints \"Sources:\"; this holds only the list, built by code: \"[1] "
    "Publisher, Title, Year; [2] ...\" in order of first citation, one list across both "
    "researchers. Titles are dropped before any source is. URLs never appear on the slide.",
    "clear", "[1] Hierros García, press release, 2025; [2] Eurostat, B2B e-commerce, 2024")

# Slide 8
steps = ["Confirm engagement scope, length and the stakeholders on both sides.",
         "Develop the detailed phase plan and deliverables.",
         "Agree commercial terms and the project team before kickoff."]
for n in range(1, 7):
    add(f"next_step_{n:02d}", 115, "measured",
        f"fixed:{steps[n - 1]}" if n <= 3 else "none",
        "Verb first, one action per step. Add who and when if known.",
        "remove_row", steps[n - 1] if n <= 3 else "")

# Template 1.4 (Scenario 1, Oct 17): situation slide and key-question slide.
# The situation is written by the Context Writer from the cited findings only; drop_slide removes the
# slide when it is empty (fewer than three cited findings, or the writer's text failed the checks).
add("situation_title_01", 90, "estimated", "context_writer:situation_title",
    "One sentence, present tense: what the market findings mean for the client's request. "
    "Figures only as the findings give them.",
    "drop_slide", "Online selling is established in Iberia, opening a direct route to small paper buyers")
sit = ["Where the market stands today, from the cited findings.",
       "What is changing, from the cited findings.",
       "What that means for the client's request; may say \"likely\"; adds no fact."]
for n in range(1, 4):
    add(f"situation_{n:02d}", 150, "estimated", "context_writer:situation",
        sit[n - 1] + " Figures only as the findings give them, with unit and year. No reference numbers.",
        "hide_line")
add("belief_01", 140, "estimated", "context_writer:belief",
    "One sentence starting \"We believe\": the point of view the proposal acts on. No figures.",
    "clear", "We believe a direct channel can win small buyers if it is designed with distributors, not against them.")
add("key_question_01", 200, "estimated", "phase_architect:governing_question",
    "The Phase Architect's governing question, kept as one question ending in a question mark.",
    "drop_slide")
add("criteria_basis_01", 70, "fixed", "code:criteria_basis",
    "Set by code: \"As stated in your request\" or \"Our reading of your request, to confirm at kick-off\".",
    "clear")
for n in range(1, 5):
    add(f"criterion_{n:02d}", 110, "estimated", "context_writer:criteria",
        "Verb first, about the client: one thing a good answer must achieve. Stated criteria keep "
        "every figure; criteria we read from the request hold no figure.",
        "hide_line")

if __name__ == "__main__":
    json.dump(rows, open(os.path.join(HERE, "template_variables.json"), "w"),
              ensure_ascii=False, indent=1)
    with open(os.path.join(HERE, "template_variables.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(len(rows), "rows written")
