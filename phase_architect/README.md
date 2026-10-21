# Phase Architect v2 — work plan by workstream

Turns the brief into the three work-plan slides a partner expects in a proposal:

1. **Timeline by workstream.** Gantt rows grouped by phase, numbered deliverable diamonds in the week each is due, and a steering row (kick-off, status meetings, check-ins, steering workshops, go/no-go gates). When the brief gives a deadline, it carries a line saying whether the plan fits.
2. **Deliverables by workstream.** Each deliverable with its due week and the meeting that reviews it.
3. **Steering meetings.** One column per check-in, workshop or gate, showing who attends, what is presented, what is reviewed and the one decision asked.

## How it obtains a consulting-level plan

| Step | Who | What |
|---|---|---|
| Architect input | Code (`n8n/code/architect_input.js`) | Brief fields, numbered success criteria, profiler focus, market findings, **weeks available to the deadline** (date parsed from `timeline`, minus 2 weeks to contract), **method library** |
| Phase Architect | LLM (`prompt_v2.md`, `schema_v2.json`) | Governing question; nearest firm archetype, adapted; phases; the partner's own workstreams when the email gives them (any number per phase, at most 12 rows), otherwise 2–4 per phase, each answering one sub-question and traced to the problem, a success criterion or a gate; 1–2 deliverables per workstream with a due week; steering events with attendees, deliverables presented, one decision and an agenda |
| Validate plan | Code (`n8n/code/validate_plan.js`, generated from `validate_plan_v2.js`) | Computes every week; repairs arithmetic; returns content **violations** (see below) |
| Retry once | LLM, same prompt | Input + `previous_output` + `violations`; tested: it changes only what was flagged |
| Render | `workplan.py`, called from `varfill.build_deck(..., workplan=)`; `app.py` passes the payload's `workplan` | Draws the slides in template v1.1 style; **titles are composed from the numbers**, so a title can never disagree with its chart |

**What the validator enforces** (each check maps to a failure seen in testing):

- **Weeks.**
  - Stated length is honored.
  - The plan fits `weeks_available`.
  - Each estimate range is at most 2 weeks wide.
  - No idle week inside a phase.
  - Something runs into every gate week.
- **Dependencies.** A workstream that follows another starts after it starts and ends no earlier.
- **Deliverables.**
  - There are 3–16 of them, each a noun phrase, never an activity.
  - Each is due inside its workstream's weeks.
  - Each is presented at a meeting on or after its due week.
- **Governance.**
  - One kick-off.
  - One gate per phase, in its last week.
  - Workshops by phase length: one for 8–11 weeks, two from 12 weeks.
  - One check-in for phases of 5–7 weeks; from 16 weeks, check-ins may fill gaps (at most one per 6 weeks).
  - At most 6 weeks between steering moments.
  - Each meeting brings material that is new since the previous one.
  - Attendees come only from stated stakeholders.
- **Size.** At most 12 workstreams. With the partner's streams (`soft_fields.workstreams.count`), one name per stream and any number per phase; otherwise 2–4 per phase.
- **Traceability.** Every stated success criterion is traced by a workstream, including one in the last phase.
- **Language.** Character and word limits, and the firm's banned-jargon list.

## Test results

Scenario A is the offering case: MetalCo marketplace, assessment plus pilot, 20 weeks stated, distributors council as stakeholder. Scenario B is the topic case: Atlântico Seguros claims operating model, assessment only, no length given, Board deadline on March 15, 2027, report and board deck required, IT replacement out of scope. Scenario C is a stress case: 4 weeks, two parallel workstreams stated. Runs used Sonnet, the production model family, through sub-agents. The original runs are in `runs/`.

| Round | Change | Result |
|---|---|---|
| 1 | v2.0 | 0 violations in A, B and C. On reading the plans: the pilot KPIs were due in week 18 of 20, because every due date was forced to its workstream's end |
| 2 | Deliverable due weeks; "new material per meeting" rule; evidence from the people doing the work | KPIs moved to week 8. Repeat samples of B swung between 16 and 21 weeks against a Board 21.5 weeks away, and nothing checked the fit |
| 3 | Deadline fit; ranges at most 2 weeks wide; a board is not Handover | Retry loop tested: A2 changed only its notes, and B2 went from 21 to 19 weeks |
| Review | Independent "engagement manager" critic | A: **No** (no steering between weeks 7 and 13, go-live before the readiness review, distributors council absent). B: **Yes with edits** |
| 4–5 | Attendees; 6-week gap cap; two workshops from 12 weeks; readiness review before go-live; choice before detailing; criteria tested in the last phase; the deadline meeting falls outside the plan | 0 violations in all scenarios (C after one retry). Re-review of A: **Yes with edits** |

**Known limits** (judgment the partner keeps):

- The week counts are archetype-shaped, not calibrated. Only `new_venture_build` comes from a real proposal; the other archetypes are illustrative until the firm's own history replaces them.
- The plan does not judge whether a test window is long enough for the result to show. The reviewer noted that 4 weeks may be too short to see repeat orders.
- It does not size the platform or IT effort.
- It does not separate an internal steering committee from a counterparty body such as a distributors council.
- It has no calendar: no holidays, no start date.

## Wiring into n8n

Applied to the workflow draft (not published):

```
Assemble market → Architect input → Phase Architect → Validate plan → Plan valid?
   ├─ true  → Assemble drafts → Copywriter → … → Build render payload (adds `workplan`) → Build deck
   └─ false → back to Phase Architect (input = previous answer + violations) → Validate plan → Plan valid? (second pass always continues)
```

- **Errors.** Both agents continue on error. An API failure (for example n8n credits) becomes a named violation. If the retry also fails, the deck still builds without the work-plan slides, and the run log says why.
- **Context slide.** `Assemble drafts` drafts `solution_*` and `outcome_*` from the plan once their table rows read `phase_architect:plan`. Today they read `pending:phase_architect` and template 1.1 has no variables on that slide, so they are skipped. That slide still prints the hard-coded 24-week sample text until the template is changed.
- **Renderer.** The render service ignores `workplan` until this branch is merged and deployed.

## Template 1.3 (16 Oct 2026)

`template_v1_3.potx` is built by `variables/build_template_v1_3.py` on top of template 1.2. Template 1.2 is 1.1 plus the slide 4 summary variables, built by `tools/make_template_1_2.py`, and is the renderer default.

- **Who gets 1.3.** It is used only when the render payload says `"template": "1.3"`. The draft's Assemble drafts sends that. Payloads without the field still render on 1.2, so the published workflow is unaffected.
- **Approach section.** It uses `section_04`. The agenda shows it third and Next Steps (`section_03`) fourth, so the live table needs no change. Assemble drafts sets `section_04 = Approach`.
- **Work-plan slides.** Three slides follow the Approach divider. Their title shapes are named `workplan:timeline`, `workplan:deliverables` and `workplan:steering`.
  - The renderer draws the plan onto them. Steering meetings beyond four add a "continued" slide.
  - Without a plan, the slides stay and their titles start with "[Firm to complete]".
  - You can restyle these slides in PowerPoint, but keep the shape names.
- **Slide 4.** The Summary Writer fills `summary_title_01` plus the objective, solution and outcome variables. Assemble drafts drafts those rows only if the table assigns them to `phase_architect:plan`.
- **Slide order.** Cover, agenda, 1 Context, summary, 2 Market Research, Market Research, 3 Approach, timeline, deliverables, steering meetings, 4 Next Steps, Next Steps, back cover.

## Four-agent chain (v3, Oct 18 2026, not wired into n8n)

`v3/` splits this agent into a lead Phase Architect (length, 1-5 phases, gates), a meeting calendar placed by code,
and Workstream, Deliverable and Governance agents, each checked before the next runs. It produces the same plan
format, so nothing downstream changes. Tested against this single agent on 10 briefs with a blind reviewer:
`runs/oct18_chain/README.md`. Design and decisions: `v3/README.md`.

## Files

```
prompt_v2.md                   system message
schema_v2.json                 output parser schema
method_library.json            firm archetypes (Config data, not prompt)
validate_plan_v2.js            validator / plan compiler (source of truth)
../n8n/code/validate_plan.js   same, wrapped for the n8n Code nodes (generated)
../n8n/code/architect_input.js builds the agent input; embeds method_library.json
run_validate.js, make_run_prompt.py, show.py   test harness
tests/                         scenario briefs and inputs, reference fixture
runs/                          every test run, compiled plans, final_{A,B,C}.json
../workplan.py                 slide drawing
../varfill.py                  template renderer; picks 1.1/1.2/1.3 from the payload (1.2 default), draws the work plan
../template_v1_3.potx           template 1.3 (built by ../variables/build_template_v1_3.py)
```
