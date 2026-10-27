// Layer result (Code, run once, on the 'go' path of a gate). Input: the gate's last answer. Computes the fill rate:
// the gaps named on pass 0 that the challenger marks filled on pass 1. Same code serves L1 and L4 (the gate node name is read
// from the input).
const g = $json;
const gateName = g.layer === 'L4' ? 'L4 gate' : 'L1 gate';
const runs = [];
for (let k = 0; k < 3; k++) { try { const a = $(gateName).all(0, k); if (!a || !a.length) break; runs.push(a[0].json); } catch (e) { break; } }
const first = runs[0] || g, last = runs[runs.length - 1] || g;
// Fill rate: the gaps the challenger named on pass 0 that it marks `filled` on the last pass (its `previous_gaps` review).
// Wording comparison was tried first and counted every reworded gap as filled.
const named = (first.gaps || []).filter(x => x.source === 'challenger');
const review = runs.length > 1 ? (last.previous_gaps_review || []) : [];
const filled = review.filter(x => x.status === 'filled');
const fill_rate = named.length && runs.length > 1 ? Math.round(100 * filled.length / named.length) : null;
return { json: { ...last, passes: runs.length, fill_rate, gaps_named_pass0: named.length, gaps_filled: filled.length, open_questions: (last.gaps || []).map(x => ({ layer: g.layer, question_id: x.question_id, question: x.what_is_missing, why: x.how_to_fill })) } };
