# Four-agent chain against the single agent (Oct 18, 2026)

Ten fictional briefs: scenarios A, B, C (`../../tests/scenario_*_input.json`), the Oct 18 size runs e1-e6
(`../oct18_plan_size/`) and e7, a new hand-written brief with five named stages over 39 weeks. Every agent ran on
Sonnet through sub-agents, as in production. The single-agent plans (`v2.json`) are the current `prompt_v2.md`:
A and e1-e6 from the Oct 18 size runs, B, C and e7 run fresh. An Opus reviewer, briefed as an engagement manager,
saw both compiled plans for a brief as Plan X and Plan Y in a per-brief random order (`critic_key.json`) and scored
structure, workstreams, deliverables, governance and coherence from 1 to 5 each (`critic.json`).

| Round | What changed | Chain wins | Average score /25 (chain vs single) | Verdict "No" |
|---|---|---|---|---|
| 1 | Same rules as v2, split across four prompts | 6 of 10 | 17.2 vs 16.6 | 1 each |
| 2 | Fixes from the round-1 reviews (handover check, spread, every meeting reviews what is new, real decisions) | 6 of 10 | 17.8 vs 15.9 | chain 1 (e1), single 2 |
| 3 | C, e3, e5 again, with the round-2 prompt fixes (one synthesis pack per gate, kick-off asks one thing, real choices at workshops and gates) | 3 of 3 | C 21 vs 18, e3 18 vs 14, e5 18 vs 16 | single 1 (e3) |

The single-agent plans were the same in every round, yet their scores moved by up to 5 points between reviews
(e7: 17 then 12). Read the scores as direction, not measurement.

Checks that do not depend on the reviewer (all 10 briefs, `compiled.json`):

| | Single agent | Chain, round 1 | Chain, round 2 |
|---|---|---|---|
| Stream marked as following another that starts before anything is handed over | 18 of 34 | 26 of 46 | 0 of 36 |
| Phase with more than half its deliverables due in the gate week | 0 | 2 | 0 |
| Meeting after the kick-off with nothing new to review | 0 of 40 | 1 of 42 | 0 of 41 |
| Retries | not measured here (production average 0.7 per run) | 0 of 40 calls | 1 of 41 calls |

Size per brief: the chain sends 1.9 times the input characters of the single agent (57k against 29k) and writes
about the same output (9.7k against 9.4k). Run time, measured on B, C and e7 including sub-agent overhead: 8-20%
longer (`round1/timings.json`).

Still open: e1 (12 named streams in 12 weeks) is rated "No" in both rounds: with at most 16 deliverables, each
stream hands over about one thing, and the reviewer wanted findings and a design per stream.
