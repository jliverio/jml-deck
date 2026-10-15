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
| prompts/02b_offering_researcher.txt | Offering researcher (system message) |
| prompts/02c_topic_researcher.txt | Topic researcher (system message) |
| prompts/04_copywriter_variables.txt | Copywriter and Copywriter retry (system message) |
| prompts/04_copywriter_schema.json | Copy schema, Copy retry schema |

The variable rules live in the n8n data table `template_variables`
(id oEGx7TvhjZ2X6HeB). `variables/` at the repo root is its seed.

Flow: Gmail → Config → Brief Organizer → Client Profiler → Read template
variables → Template rules → researchers (rules injected) → Assemble drafts →
Copywriter (one call, whole deck) → Check copy → [Copywriter retry → Check
retry] → Build render payload → Build deck (Render) → reply.

Tests: `node n8n/tests/harness.js` runs these files with mocked n8n lookups.
Test entry point: the "Test brief (no email)" webhook, which only runs with the
X-JML-Test header secret; the reply nodes fail on its fake message id, so no
email is sent.
