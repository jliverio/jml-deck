# For Testing | Research stage (Seq. 1), standalone

n8n workflow IapsyOlvkzZILCH4. The Sequence 1 research stage of the For Testing deck workflow (9YOxGMEjHeGguQbf), copied node for node so it can run alone in about two minutes instead of inside the fifteen-minute chain.

- Copied unchanged: Read template variables, Template rules, Research brief, IF offering?, IF topic?, Offering and Topic researchers (models, tools, schemas, fixers), Check offering, Check topic, Offering retry?, Topic retry?, stubs, Merge market, Assemble market.
- Stand-ins: Config, Brief Organizer, checkProfiler are Code nodes that replay the outputs of runs 1863 (Valtrenix) and 1909 (Ribeira) of the deck workflow; `Test case` picks the brief (`CASE = 'valtrenix' | 'ribeira'`). Config's `today` is set to the run date.
- Added: Research report, a markdown view of the rows, sources, dates, not-covered lines, retry routes and budget.

Limits: the stand-ins freeze the brief and the profiler output, so this tests the researchers, the checks and the retry, not the upstream agents. A new test brief needs one chain run to capture Config, Brief Organizer and checkProfiler outputs; add them to the three stand-in nodes.

The file research_stage.sdk.js is the SDK code the workflow was created from. The fixture data inside it comes from invented test briefs (Valtrenix, Ribeira), not real clients.
