# Test copy of the proposal flow (n8n jVwdeA9u2TaNnJpG): the market research wiring (plan step 6)

Copies of the Code nodes that step 6 added to or changed in "TEST: Proposal flow (step 6)", with an offline test.
**The workflow in n8n is the source of truth.** The live flow (Id8uRq0GgHDg7NBV) is not changed.

| File | Node |
|---|---|
| research_input.js | Research input (new): what the market research is asked for; no confirmed website, no research |
| assemble_market.js | Assemble market (new code, same name): findings and warnings for the rest of the flow, plus `research` |
| research_into_payload.js | Research into payload (new): the deck request becomes a template 1.5.4 request with the two research slides, the logos and the client colour |

Test without n8n (21 checks): `node n8n/proposal_copy/t_wiring.js`

Working record of the step: project note `Plan_Step6_Wiring_Nov23.md`.
