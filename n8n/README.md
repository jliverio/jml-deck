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
| workflows/search_slim.sdk.js | Separate workflow "JML tool: web search (slim)" (bK1o2w8TdT4WUeUL), called by Search: Offering, Search: Topic and Search: Profiler |
| workflows/read_page.sdk.js | Separate workflow "JML tool: read page" (4Iq16peRkEXybs11), called by Read page: Offering, Read page: Topic and Read page: Profiler |
| prompts/02a_client_profiler.txt | Client Profiler (system message) |
| prompts/02a_profiler_schema.json | Profiler schema (extra top-level keys allowed) |
| code/check_profiler.js | checkProfiler |

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
X-JML-Test header secret. Its message ids start with `test-`; "Real email?"
stops those runs after Name attachment, so no email is sent and a good run ends
as success. (The no-deck and missing-info replies still fail on test runs.)

Model settings: researchers and copywriter use claude-sonnet-5-5 with a 16,384
output cap. The copywriter runs adaptive thinking at low effort: with the model
default it spent the whole cap thinking and returned nothing (execution 25).

Failure handling: Client Profiler, Offering researcher and Topic researcher
continue on error. A failed profile leaves problem_focus empty, both IFs take
their stubs, and the deck is built without market research (checkProfiler logs
`profiler_failed`). Copywriter, Phase Architect and Summary Writer already
continued on error with code fallbacks.

Phase Architect model: claude-sonnet-5-5, output cap 32,000 with streaming on
(the Anthropic SDK refuses non-streaming calls above ~21k tokens). Long
engagements need it: a 40-week plan with 10 workstreams retried once and used
the room (execution 555). Streaming hides the token count in the run log.
Plan size limits (prompt + validator): up to 12 workstreams (more than 8 only
past 16 weeks) and 16 deliverables; the schema tolerates 16 workstreams so an
oversized plan reaches the validator and gets a retry instead of a parser error.

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

## October 16 changes (live)

- Trigger `New proposal request`: unread mail sent to `jose.liverio+proposals@jml-ops.com`, or labelled
  `proposal-requests` (query `{to:jose.liverio+proposals@jml-ops.com label:proposal-requests}`). The label did not
  exist before, so no email had ever started a run. The Gmail account behind the credential is jose.liverio@jml-ops.com.
- `Profiler schema`, `Offering schema`, `Topic schema`: auto-fix on, each with its own fixer model
  (`Model: Profiler fixer`, `Model: Offering fixer`, `Model: Topic fixer`). A format failure on the final answer is
  repaired by one small call instead of rerunning the whole search loop. The fix prompt forbids new content and
  answers EMPTY when there is no JSON, so an empty answer still fails into the node's retry.
- `Assemble market` (code/assemble_market.js): a finding reaches the deck only when its context and its action
  cite a listed source.

## Run logger (workflow "JML run logger", id mqEGPCkfgZ8anFwQ)

Every morning at 07:17 Lisbon it copies each finished run of the proposal workflow (executions from 762 on)
into the **Run log** and **Agent log** tabs of `JML_Financial_Model`, writing data columns only
(Run log A–M and S–X, Agent log A–J and L); the sheet's formula columns price the rows.
Source: `workflows/run_logger.sdk.js`; parsing logic: `code/log_runs.js` (testable with node against saved executions).

- **Purpose** (Run log X): `Live` only for email briefs whose sender domain is on Inputs `Firm_Domains` (B68:B77);
  any other outside sender is `Measurement` with Sample `Unlisted sender`; `Debug` for manual runs, untagged
  webhook runs and emails from jml-ops.com / example.com; `Measurement` with Sample = tag for webhook runs with
  `log_purpose: "Measurement"`, `log_sample`, `log_round` in the body, or emails tagged `[B0]`, `[T1]` … `[T99]`
  (optional suffix, e.g. `[T2-PDF]`). An email subject with `[DEBUG]` is always Debug.
- **Confidentiality**: for Live and unlisted-sender runs, Run log C holds the Gmail thread ID, never the subject,
  and error text is left out of the notes.
- **No double logging**: executions already in Run log column A are skipped and counted (`skippedAlreadyLogged`).
- A questions-only reply is never a failure: deck failures are detected only on the deck-failure branch
  (`Reply without deck`, `Flag deck failure`), which the questions route never reaches.
- **Category** (Run log D): `Live run`, `Live questions`, `Test round N` or `Debug` — never "Full build (current pipeline)".
- **Page-read credits** come from `credits_used`, which the read-page tool returns since 17 Oct (version 1f0d1def).
- **Phase Architect tokens** under streaming are rebuilt as 11,553 input per call and model time × 156.2 output tokens/s.
- Needs two credentials: an **n8n API** key (Settings → n8n API) and **Google Sheets OAuth2** for the sheet owner.
