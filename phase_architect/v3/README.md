# Phase Architect v3: a lead agent and three agents in a chain, and a Plan Reviewer

Status (Oct 18, 2026): tested on 10 briefs with a stated length and 10 without one (`../runs/oct18_chain/`, `../runs/oct18_thinking/`); not wired into n8n. The plan it produces has the same format as v2,
so the renderer, Assemble drafts and the Summary Writer need no change.

| Step | Who | File | Output |
|---|---|---|---|
| 1 | Phase Architect (lead, LLM) | `prompt_lead.md`, `schema_lead.json` | governing question, archetype, sub-questions, sizing (drivers quoted from the brief, work per phase, estimate), 1-5 phases with length, objective, gate; notes |
| 2 | Meeting calendar (code) | `chain.js` `meetingCalendar()` | kick-off, gates, workshops, check-ins and their weeks, from the phase lengths |
| 3 | Workstream agent (LLM) | `prompt_workstreams.md` | workstreams per phase: question, trace, weeks, follows, activities |
| 4 | Deliverable agent (LLM) | `prompt_deliverables.md` | 1-3 deliverables per workstream, 3-16 in all, with due weeks |
| 5 | Governance agent (LLM) | `prompt_governance.md` | per meeting: label, purpose, attendees, deliverables shown, decision, agenda |
| 6 | Merge (code) | `chain.js` `compile()` | the v2 agent format, run through `../validate_plan_v2.js`, plus `sizing` (the table the partner reviews) |
| 7 | Plan Reviewer (LLM, optional) | `prompt_reviewer.md`, `schema_reviewer.json` | send or revise, up to 5 issues with an owner; `routeReview()` sends workstream, deliverable and meeting issues back for one revision round and gives sizing and phase issues to the partner |

After each agent, `checkStage(stage, state)` returns only that agent's violations; the agent retries once with them.
Checks added on top of v2: at most 5 phases; a stream that follows another and overlaps it starts at least 2 weeks
in and gets an interim deliverable from it; at most half of a phase's deliverables (or 2) due in its gate week;
something due before every meeting after the kick-off, and every meeting reviews all of it; every deliverable shown
at a workshop or gate by the agent itself (v2 repaired this silently). The governance agent may reword a gate's
decision to match what the gate reviews; that wording then closes the phase on every slide.

Sizing (`checkSizing()`): each driver's evidence must appear word for word in a stated brief field, the profile or the
findings; a library unit must keep the library's weeks and at-once values; each phase's estimate must equal fixed weeks
plus ceil(count / at once) x weeks each; with no stated length each phase's weeks sit inside its estimate; every phase
answers a sub-question and the Workstream agent gives every sub-question a stream in its phase. When a stated length or
deadline sits below the middle of the work counted, code writes the partner a note (`fitNote()`). The weeks per unit in
`../method_library.json` are placeholders until JML replaces them with its own history.

Tests:
- `node tests/calendar_test.js`: 7,435 phase sequences (1-5 phases, 1-60 weeks) get a calendar that passes the meeting rules.
- `../tests/plan_size_test.js` includes five-phase plans (90 cases); `../../tests/workplan_render_size.py` and
  `../../tests/roadmap_stress.py` render them.
- `../runs/oct18_chain/`: the 10-brief comparison with today's single agent (see its README).

Harness: `run.js` (prompt / check / compile / baseline), `next.js` (checks the newest answers and writes the next run
prompts), `critic_view.js` (blind review pack), `render_check.py`, `show.js`.
