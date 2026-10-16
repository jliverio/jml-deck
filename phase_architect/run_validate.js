// usage: node run_validate.js agent_output.json brief.json out.json
const fs = require('fs');
const { validatePlan, weeksAvailable } = require('./validate_plan_v2.js');
const arch = JSON.parse(fs.readFileSync(process.argv[2]));
const brief = process.argv[3] && process.argv[3] !== '-' ? JSON.parse(fs.readFileSync(process.argv[3])) : {};
const sc = (((brief.soft_fields || {}).success_criteria) || {});
const scList = sc.source === 'stated' && sc.value ? sc.value.split(';').map(s => s.trim().replace(/\.$/, '')).filter(Boolean) : (brief.__sc_list || []);
const jn = ["leverage","synergy","best practice","best-in-class","value-add","holistic","end-to-end","hit the ground running","world-class","proven","tried-and-tested","mission-critical","north star","step change","deep dive","learnings","unlock","drive (for outcomes)","robust","actionable","scalable","transformation","transform","passionate","MVP","compare notes"];
const wa = weeksAvailable(brief, process.env.TODAY || '2026-10-15', 2);
const r = validatePlan(arch, { brief, success_criteria_list: scList, jargon_never: jn, weeks_available: wa });
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(r, null, 1));
console.log('violations', r.violations.length, JSON.stringify(r.violations, null, 0));
console.log('repairs', JSON.stringify(r.repairs));
console.log('total', JSON.stringify(r.plan.total_duration_weeks), 'events', r.plan.governance.events.map(e => e.label + '@' + e.week).join(' | '), 'status', r.plan.governance.status_weeks.join(','));
