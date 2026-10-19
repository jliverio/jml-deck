// Blind review pack: the brief and the two compiled plans (chain and single agent) as Plan X and Plan Y in a
// per-scenario random order. Writes <dir>/critic_prompt.txt and <dir>/critic_key.json (which plan is which).
//   node critic_view.js <dir> <seed> [<fileA>:<nameA> <fileB>:<nameB> <tag>]
// Default: compiled.json (chain) against v2_compiled.json (single). With a tag, writes <dir>/critic_<tag>_prompt.txt,
// critic_<tag>_key.json and asks for critic_<tag>.json; the tagged review also scores sizing (are the lengths realistic).
const fs = require('fs'), path = require('path');
const dir = process.argv[2], seed = Number(process.argv[3] || 1);
const [fa, na] = (process.argv[4] || 'compiled.json:chain').split(':');
const [fb, nb] = (process.argv[5] || 'v2_compiled.json:single').split(':');
const tag = process.argv[6] ? '_' + process.argv[6] : '';
const inp = JSON.parse(fs.readFileSync(path.join(dir, 'input.json')));
const plans = { [na]: JSON.parse(fs.readFileSync(path.join(dir, fa))), [nb]: JSON.parse(fs.readFileSync(path.join(dir, fb))) };
const order = (seed % 2) ? [na, nb] : [nb, na];
fs.writeFileSync(path.join(dir, `critic${tag}_key.json`), JSON.stringify({ X: order[0], Y: order[1] }));
const b = inp.brief, v = f => (f && f.value != null) ? `${typeof f.value === 'string' ? f.value : JSON.stringify(f.value)} (${f.source})` : 'not given';
const brief = [
  `Client: ${v(b.hard_fields.client)}`, `Problem: ${v(b.hard_fields.problem_statement)}`,
  `Engagement type: ${v(b.required.engagement_type)}`, `Length: ${v(b.required.engagement_length)}`,
  `Stakeholders: ${v(b.required.stakeholders)}`, `Workstreams named by the partner: ${v(b.soft_fields.workstreams)}`,
  `Deliverable format: ${v(b.soft_fields.deliverable_format)}`, `Timeline/deadline: ${v(b.soft_fields.timeline)}${inp.weeks_available != null ? ` (${inp.weeks_available} weeks available)` : ''}`,
  `Success criteria: ${v(b.soft_fields.success_criteria)}`, `Out of scope: ${v(b.soft_fields.out_of_scope)}`, `Prior attempts: ${v(b.soft_fields.prior_attempts)}`,
].join('\n');
function render(p) {
  const L = [`Total: ${p.total_duration_weeks.min === p.total_duration_weeks.max ? p.total_duration_weeks.max : p.total_duration_weeks.min + '-' + p.total_duration_weeks.max} weeks. Governing question: ${p.basis.governing_question}`];
  for (const ph of p.phases) {
    L.push(`\nPhase ${ph.order}: ${ph.name}, weeks ${ph.start_week}-${ph.end_week}${ph.duration_weeks.min !== ph.duration_weeks.max ? ` (estimate ${ph.duration_weeks.min}-${ph.duration_weeks.max})` : ''}. Objective: ${ph.objective_one_line}`);
    L.push(`  Gate: ${ph.gate.label}: ${ph.gate.decision}`);
    for (const w of p.workstreams.filter(w => w.phase_order === ph.order)) {
      L.push(`  ${w.id} ${w.name}, weeks ${w.start_week}-${w.end_week}${w.follows.length ? ', after ' + w.follows.join(', ') : ''}. Answers: ${w.answers}`);
      L.push(`     Activities: ${w.activities.join('; ')}`);
      for (const id of w.deliverable_ids) { const d = p.deliverables.find(x => x.id === id); L.push(`     ${d.id} (${d.kind}${d.format ? ', ' + d.format : ''}, due week ${d.due_week}): ${d.name}`); }
    }
  }
  L.push(`\nSteering meetings (status meetings every ${p.governance.status_cadence_weeks} week(s) in between):`);
  for (const e of p.governance.events) L.push(`  Week ${e.week}, ${e.type}: ${e.label}. Purpose: ${e.purpose}. Attendees: ${e.attendees.join(', ')}. Reviews: ${e.presents.join(', ') || 'nothing'}. Decision: ${e.decision || '-'}. Agenda: ${e.agenda.join('; ')}`);
  L.push(`\nNotes to the partner:`); p.architect_notes.forEach(n => L.push(`  - ${n}`));
  return L.join('\n');
}
const out = path.join(dir, `critic${tag}.json`);
const sizing = !!tag;
const txt = `You are an experienced engagement manager at a strategy consulting firm. Two draft work plans were written for the same client proposal from the same brief. Review both as you would before a partner sends the proposal. Judge only what is written; do not assume anything that is not there.

For each plan, score 1 to 5 (5 = you would send it as is) on:
1. structure: do the phases and their lengths fit the brief (stated length, stages, deadline, type of engagement)?
2. workstreams: does each phase have the right streams, each answering a distinct question, running in a realistic order and timing?
3. deliverables: are they tangible things the client receives, the right number per stream, due when the work and the meetings need them?
4. governance: do the steering meetings come at sensible moments, review what is new, ask one real decision each, with the right people?
5. coherence: do phases, streams, deliverables and meetings fit together without contradictions?${sizing ? `
6. sizing: are the total length and each phase's length realistic for the work the brief describes (number of markets, sites, units, systems, rollout), neither padded nor squeezed?` : ''}
Then give a verdict per plan: "Yes" (send as is), "Yes with edits" or "No", and list up to 5 concrete defects per plan, most serious first, each one sentence naming the item (e.g. "W3 starts before the workshop that chooses the option"). Finally say which plan is better overall (X, Y or tie) and why in two sentences.

Save your answer with the Write tool to ${out} as JSON: {"X": {"scores": {"structure": n, "workstreams": n, "deliverables": n, "governance": n, "coherence": n${sizing ? ', "sizing": n' : ''}}, "verdict": "...", "defects": ["..."]}, "Y": {...same...}, "better": "X|Y|tie", "why": "..."}. Do not read or open any other file and use no tool other than Write. After saving, reply with the single word: done.

=== BRIEF ===
${brief}

=== PLAN X ===
${render(plans[order[0]])}

=== PLAN Y ===
${render(plans[order[1]])}
`;
fs.writeFileSync(path.join(dir, `critic${tag}_prompt.txt`), txt);
console.log(path.join(dir, `critic${tag}_prompt.txt`), txt.length);
