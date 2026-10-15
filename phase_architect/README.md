# Phase Architect v2 — work plan by workstream

Turns the brief into the three work-plan slides a partner expects in a proposal:

1. **Timeline by workstream.** Gantt rows grouped by phase, numbered deliverable diamonds in the week each is due, and a steering row (kick-off, status meetings, check-ins, steering workshops, go/no-go gates). When the brief gives a deadline, it carries a line saying whether the plan fits.
2. **Deliverables by workstream.** Each deliverable with its due week and the meeting that reviews it.
3. **Steering meetings.** One column per check-in, workshop or gate, showing who attends, what is presented, what is reviewed and the one decision asked.

## How it obtains a consulting-level plan

| Step | Who | What |
|---|---|---|
| Architect input | Code (`n8n_architect_input_node.js`) | Brief fields, numbered success criteria, profiler focus, market findings, **weeks available to the deadline** (date parsed from `timeline`, minus 2 weeks to contract), **method library** |
| Phase Architect | LLM (`prompt_v2.md`, `schema_v2.json`) | Governing question; nearest firm archetype, adapted; phases; 2–4 workstreams per phase, each answering one sub-question and traced to the problem, a success criterion or a gate; 1–2 deliverables per workstream with a due week; steering events with attendees, deliverables presented, one decision and an agenda |
| Validate plan | Code (`n8n_validate_plan_node.js`, generated from `validate_plan_v2.js`) | Computes every week; repairs arithmetic; returns content **violations** (see below) |
| Retry once | LLM, same prompt | Input + `previous_output` + `violations`; tested: it changes only what was flagged |
| Render | `workplan.py` (called from `varfill.build_deck` when the payload has `workplan`) | Draws the slides in template v1.1 style; **titles are composed from the numbers**, so a title can never disagree with its chart |

**What the validator enforces** (each check maps to a failure seen in testing):

- **Weeks.**
  - Stated length is honored.
  - The plan fits `weeks_available`.
  - Each estimate range is at most 2 weeks wide.
  - No idle week inside a phase.
  - Something runs into every gate week.
- **Dependencies.** A workstream that follows another starts after it starts and ends no earlier.
- **Deliverables.**
  - There are 3–12 of them, each a noun phrase, never an activity.
  - Each is due inside its workstream's weeks.
  - Each is presented at a meeting on or after its due week.
- **Governance.**
  - One kick-off.
  - One gate per phase, in its last week.
  - Workshops by phase length: one for 8–11 weeks, two from 12 weeks.
  - One check-in for phases of 5–7 weeks.
  - At most 6 weeks between steering moments.
  - Each meeting brings material that is new since the previous one.
  - Attendees come only from stated stakeholders.
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

## Wiring into n8n (not applied: the live workflow is untouched)

```
Assemble market → Architect input (Code) → Phase Architect (agent, prompt_v2 + schema_v2, Sonnet, ~8k tokens)
  → Validate plan (Code) → IF valid
       ├─ yes → Assemble deck JSON
       └─ no  → Phase Architect (retry; text = {{ JSON.stringify($json.retry_input) }}) → Validate plan (2) → Assemble deck JSON
```

- **Config.** Add `method_library` = the `archetypes` array from `method_library.json`.
- **Assemble deck JSON.** Add `workplan: $('Validate plan').item.json.output`, `workplan_client: <client name>`, and an agenda topic "Approach".
- **Renderer.**
  - `app.py` still imports `templatefill`, not `varfill`. The workplan slides only appear through `varfill.build_deck`.
  - Template slide 4 ("Context") is hard-coded sample text describing a 24-week Blueprint + Pilot project. It will contradict any other plan. Turn it into variables or drop it.
  - There is no "Approach" section divider; the slides carry "Approach" in the on-page tracker.

## Files

```
prompt_v2.md                   system message
schema_v2.json                 output parser schema
method_library.json            firm archetypes (Config data, not prompt)
validate_plan_v2.js            validator / plan compiler (source of truth)
n8n_validate_plan_node.js      same, wrapped for an n8n Code node
n8n_architect_input_node.js    builds the agent input
run_validate.js, make_run_prompt.py, show.py   test harness
tests/                         scenario briefs and inputs, reference fixture
runs/                          every test run, compiled plans, final_{A,B,C}.json
../workplan.py                 slide drawing
../varfill.py                  template renderer, now inserts the work plan after Market Research
```
