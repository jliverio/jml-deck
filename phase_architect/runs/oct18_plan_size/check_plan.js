// node check_plan.js key -> validates <key>_plan.json against <key>_arch_input.json, writes <key>_compiled.json
const fs = require('fs');
const { validatePlan } = require('/home/claude/repo/jml-deck/phase_architect/validate_plan_v2.js');
const key = process.argv[2], sfx = process.argv[3] || '';
const inp = JSON.parse(fs.readFileSync(`${key}_arch_input.json`));
const arch = JSON.parse(fs.readFileSync(`${key}_plan${sfx}.json`));
const jn = ["leverage","synergy","best practice","best-in-class","value-add","holistic","end-to-end","hit the ground running","world-class","proven","tried-and-tested","mission-critical","north star","step change","deep dive","learnings","unlock","drive (for outcomes)","robust","actionable","scalable","transformation","transform","passionate","MVP","compare notes"];
const r = validatePlan(arch, { brief: inp.brief, success_criteria_list: inp.success_criteria_list, jargon_never: jn, weeks_available: inp.weeks_available });
fs.writeFileSync(`${key}_compiled${sfx}.json`, JSON.stringify({ client: (inp.brief.hard_fields.client || {}).value, ...r.plan }));
const SOFT = /^(note_\d+:over_\d+_words|notes:over_6|basis:governing_question_too_long)$/;
const hard = r.violations.filter(x => !SOFT.test(x));
const p = r.plan;
console.log(`${key}${sfx}: ${hard.length} violations ${JSON.stringify(hard)}${r.violations.length - hard.length ? ' soft:' + JSON.stringify(r.violations.filter(x => SOFT.test(x))) : ''}`);
console.log(`  ${p.total_duration_weeks.max} wk | phases ${p.phases.map(x => x.name + ' ' + x.duration_weeks.max + 'w/' + x.workstream_ids.length + 'ws').join(', ')} | ${p.deliverables.length} del`);
console.log(`  streams: ${[...new Set(p.workstreams.map(w => w.name))].join(' | ')}`);
console.log(`  meetings: ${p.governance.events.map(e => e.type[0].toUpperCase() + e.week).join(' ')} | status ${p.governance.status_weeks.join(',')}`);
console.log(`  notes: ${JSON.stringify(p.architect_notes)}`);
if (hard.length) {
  const retry = { ...inp, previous_output: arch, violations: hard };
  fs.writeFileSync(`${key}_retry_input.json`, JSON.stringify(retry));
}
