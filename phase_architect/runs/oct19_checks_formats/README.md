# Oct 19: new code checks, governance fix, deliverable formats

All runs reuse the Phase Architect (lead) output of `runs/oct18_thinking/chain/<brief>_r1` (marked `lead.copied`),
so only the later agents differ. Agents ran on Sonnet; blind reviews on Opus, plans unlabeled, 6 scores of 1-5 each.

## chk: the four new checks, live (commit 41bc77c)
Workstream, Deliverable and Governance agents rerun on n1a, n1b, n2b, n4b.
- Every plan passed every new check on the first try (one retry, on an older rule: n1b `ws_violations.json`).
- The same plans before (`prev_compiled.json` = oct18 r1): 4 decision packs due before the work they sum up ended,
  16 deliverables reviewed twice. After: 0 and 0.
- Blind review `critic_chk.json` (key in `critic_chk_key.json`): checks 79, before 84 (of 120); before preferred 3 of 4.
- Cause: decision packs and designs were allowed only at workshops or gates, so the week-8 check-in in n1a and the
  week-13 check-in in n1b reviewed nothing, and the option a later stream built on was never chosen.

## chk2: governance fix (commit 0122d1a)
Same lead, workstreams and deliverables as chk (`*.copied`); only the Governance agent reruns, with the fix:
designs may be chosen at a check-in (only decision packs wait for a workshop or gate), and code flags any
meeting after the kick-off that reviews nothing.
- All 4 passed on the first try; no meeting reviews nothing.
- Blind review `critic_fix.json`: fixed 82, before 81; 2 of 4 each way. The same "before" plans scored 84 and 81
  in the two reviews, so the gap is inside the noise.
- Remaining defects are missing work (training, data migration and cutover in the ERP rollout) and timing at the
  end (roadmaps and business cases first seen at the final readout).

## fmt: deliverable formats (commit 0122d1a)
Deliverable agent rerun with the `format` field on n1a, n1b, n2b, n4b (workstreams copied from chk) and on B
(brief states "A written report and a board presentation"; its workstreams were run fresh).
- 54 deliverables; every run passed the format checks on the first try.
- 35 presentation, 7 report, 7 solution, 2 model, 2 training, 1 dashboard.
- B: final report as a report plus a board presentation of it.
- n4b (ERP rollout, 40 pharmacies and 2 warehouses) has no training; n2b's two trainings fall due a week after their
  wave goes live. A format cannot add missing work: that needs the standard steps per engagement type.
