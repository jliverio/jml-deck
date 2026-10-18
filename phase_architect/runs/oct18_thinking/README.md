# Who does the thinking: sizing without a stated length, and a fifth agent (Oct 18, 2026)

Fictional briefs only. Every agent ran on Sonnet through sub-agents, as in production; the blind reviews ran on Opus.

| Folder | What |
|---|---|
| `old_lead/` | Today's lead (`../../v3/snapshots/prompt_lead_part1.md`) on 10 briefs with no length, twice each (n1a-n4b in pairs: small and large scope; n5 vague; n6 a 12-week deadline) |
| `chain/<brief>_r1/lead.json`, `new_lead/` | The lead with the scoping step, run 1 and run 2 |
| `new_lead_round2/` | Run again after the library fix (no double-counted sign-off week, rules on when a unit applies, a packaged-software unit) |
| `regression/` | The new lead on 5 briefs with a stated length or deadline (A, B, e1, e3, e7) |
| `chain/` | Full chain on run 1 of each brief, then the Plan Reviewer (`review.json`), one revision round in `rev/` (`review_feedback.json`, the reruns, `rev/review.json` = the re-review) and a blind before/after review (`critic_rev.json`, `critic_rev_key.json`) |
| `length_reviews/` | Blind review of the old vs the new lead's phases and notes, before (`round1`) and after (`round2`) the library fix |

Results (details in the Claude Doc, sections "Results after the changes" and "Decisions for you after part 2"):

- Old lead: every phase of the larger briefs sat exactly on the top of the archetype range; every phase range was 2 weeks wide.
- New lead: 35 runs, all checks passed (2 after one retry); 8 of 10 briefs stable across runs; 11 of 36 phases above the
  archetype maximum with a reason; every count quotes its source. Blind length review: preferred on 6 of 10 both times;
  realism 32 vs 31 and 31 vs 31; partner notes 39 vs 26 both times.
- Plan Reviewer: revise on 10 of 10 (29 issues, 14 owned by the lead), again on 9 of 10 after one revision. Blind
  before/after: revised plan preferred on 6 of 10, average 19.0 -> 18.6 of 30; 6 of 10 plans got 3-11 weeks longer.
  Lead reruns (7 briefs): -6 points in total; later-agent reruns only (3 briefs): +2. Hence `routeReview` mode `local`.
