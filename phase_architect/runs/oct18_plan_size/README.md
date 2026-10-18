# Plan size runs (Oct 18, 2026)

Question: does the chain follow the partner's length and workstreams, from 6 weeks to 6 months and from 2 to 12 streams?
Fictional emails in `emails.json`. Each went through the Brief Organizer prompt (`n8n/prompts/01_brief_organizer.txt`)
and then the Phase Architect prompt (`prompt_v2.md`), both on Sonnet 5.5 through sub-agents, with no market findings.
`e6` (24-week rollout in one phase) uses a hand-written brief. `a_regression` is scenario A (20 weeks, no stated streams).
Scripts: `make_arch.py` (brief -> Phase Architect input, same shape as `n8n/code/architect_input.js`),
`check_plan.js` (validator), `render_llm.py` (slides + layout checks). Paths in them point at the session's work folder.

| Run | Email | Brief: length, streams | Plan (first pass) |
|---|---|---|---|
| e1 | Iberia Foods, 12-week cost program, twelve named streams | 12 weeks; 12 named, stated | 0 violations. One 12-week Diagnostic phase, 12 rows, 14 deliverables, two workshops (weeks 4, 9), gate week 12 |
| e2 | Lusitania Telecom, "three months in total", three named streams, rollout support | 13 weeks; 3 named, stated | 0 violations. Diagnostic 5 + Implementation 8 weeks; each stream in both phases (6 rows, 3 names) |
| e3 | Norte Hospitals, six weeks, "four workstreams" (count only) | 6 weeks; count 4, stated | 0 violations. One 6-week phase, 4 streams named by the model, check-in week 4 |
| e4 | Atlas Logistics, six months, design and pilot, no streams | 26 weeks; none | 0 violations. Design 8 + Pilot 18 weeks, 7 streams (default rule), workshops every 6 weeks |
| e5 | Vinhos do Douro, eight weeks, "we propose two workstreams" | 8 weeks; 2 named, firm's proposal (assumed) | 0 violations. One 8-week phase with the two proposed streams |
| a_regression | Scenario A brief, 20 weeks, no streams | 20 weeks; none | 0 violations. Design 6 + Pilot 14 weeks, 7 streams, same shape as round 4 |
