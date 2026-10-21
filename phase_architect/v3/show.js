// node show.js <compiled.json>: the plan as a partner would read it
const p = JSON.parse(require('fs').readFileSync(process.argv[2]));
console.log(`${p.client} | ${p.total_duration_weeks.min}-${p.total_duration_weeks.max} weeks | ${p.basis.governing_question}`);
for (const ph of p.phases) {
  console.log(`\n## ${ph.order}. ${ph.name} wk ${ph.start_week}-${ph.end_week}: ${ph.objective_one_line}\n   gate: ${ph.gate.label} — ${ph.gate.decision}`);
  for (const w of p.workstreams.filter(w => w.phase_order === ph.order)) {
    console.log(`   ${w.id} ${w.name} [wk ${w.start_week}-${w.end_week}]${w.follows.length ? ' after ' + w.follows.join(',') : ''} — ${w.answers}`);
    for (const id of w.deliverable_ids) { const d = p.deliverables.find(x => x.id === id); console.log(`      ${d.id} wk${d.due_week} ${d.kind}: ${d.name} -> ${d.presented_at}`); }
  }
}
console.log('\nMeetings:');
for (const e of p.governance.events) console.log(`   wk${e.week} ${e.type} "${e.label}" — ${e.purpose} | shows ${e.presents.join(',') || '-'} | ${e.decision || ''} | ${e.attendees.join(', ')}`);
console.log('\nNotes:'); p.architect_notes.forEach(n => console.log('   - ' + n));
