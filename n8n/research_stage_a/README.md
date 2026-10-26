# Research Stage A (test workflow zLiqVfeWCT3lv6zX, "For Testing | Research Stage A")

The agents that produce the market-research ledger (records, never prose), per the guideline
"Product-driven market analysis" (Oct 26). v0: Layers 1 (frame, the five), 2+3 (client and competitor
cells, one wave), 4 (press and record, two waves); Layer 5 (sentiment) off. Challengers on L1, L3, L4;
retry loops on L1 and L4 via IF nodes added with update_workflow after the SDK build.

- `code/`     the Code nodes (test brief, research method, checks, gates, table build, ledger merge)
- `prompts/`  the agents' system messages (frame setter, competitor finder, challenger, company reader, press gatherer)
- `schemas/`  the structured-output schemas (frame, competitors, gaps, cells, findings)
- `build_sdk.py` generates `stageA.sdk.js`, the n8n Workflow SDK code (validated, then created from a skeleton
  and filled with setNodeParameter; the SDK string literals are the same files)

Test brief: Marés, an invented Portuguese swimwear brand entering Spain. No real client name is used.
