# n8n side of the JML AI Analyst

The live workflow is "Proposal request → scoping deck reply" in n8n. This folder
holds the exact code and prompts pasted into its nodes, so changes are reviewed
and tested here first.

| File | n8n node |
|---|---|
| code/template_rules.js | Template rules (after Read template variables) |
| code/check_research.js | Check offering, Check topic |
| code/assemble_drafts.js | Assemble drafts |
| code/check_copy.js | Check copy (= _checker.js + its own tail) |
| code/check_retry.js | Check retry (= _checker.js + its own tail) |
| code/build_render_payload.js | Build render payload |
| code/validate_brief.js | Validate brief |
| code/architect_input.js | Architect input |
| code/validate_plan.js | Validate plan (generated from phase_architect/validate_plan_v2.js) |
| ../phase_architect/prompt_v2.md | Phase Architect (system message) |
| ../phase_architect/schema_v2.json | Phases schema |
| prompts/02b_offering_researcher.txt | Offering researcher (system message) |
| prompts/02c_topic_researcher.txt | Topic researcher (system message) |
| prompts/04_copywriter_variables.txt | Copywriter and Copywriter retry (system message) |
| prompts/04_copywriter_schema.json | Copy schema, Copy retry schema |
| code/prepare_summary.js | Prepare summary (slide 4: Summary of our proposal) |
| code/check_summary.js | Check summary (runs on both attempts) |
| code/final_summary.js | Final summary |
| prompts/06_summary_writer.txt | Summary Writer and Summary Writer retry (system message) |
| prompts/06_summary_writer_schema.json | Summary schema, Summary retry schema |

The three summary node files are built from shared parts (`_summary_input.js`, `_summary_checker.js`,
`*_tail.js`) by `python3 tools/build_n8n_code.py`; edit the parts, rebuild, then paste.

The variable rules live in the n8n data table `template_variables`
(id oEGx7TvhjZ2X6HeB). `variables/` at the repo root is its seed.

Flow: Gmail → Config → Brief Organizer → Client Profiler → Read template
variables → Template rules → researchers (rules injected) → Architect input → Phase
Architect → Validate plan → Plan valid? [once back to Phase Architect with the violations] → Assemble drafts →
Copywriter (one call, whole deck) → Check copy → [Copywriter retry → Check
retry] → Prepare summary → Summary Writer → Check summary → Summary OK? →
[Summary Writer retry → Check summary] → Final summary → Build render payload → Build deck (Render) → reply.

Tests: `node n8n/tests/harness.js` runs these files with mocked n8n lookups.
Test entry point: the "Test brief (no email)" webhook, which only runs with the
X-JML-Test header secret; the reply nodes fail on its fake message id, so no
email is sent.

## Phase Architect wiring tests (in n8n, agents pinned)

`node n8n/tests/make_pins.js valid|invalid|error` writes pin data that pins
every agent and external node, so the Code, IF and loop nodes run for real in
n8n without Gateway credits. Run with the n8n `test_workflow` tool, trigger
"Test brief (no email)". The run ends at Flag deck failure by design (Build
deck is pinned without a file). Results on 16 Oct 2026:

- valid (execution 11): Plan valid? true on the first pass; payload carries the
  work plan; `payload_n8n_exec11.json` renders to 12 slides via app.py.
- error (execution 12): Phase Architect and Validate plan ran twice, the second
  pass continued ($runIndex guard), the deck assembled without a work plan and
  the run log names the agent error.
