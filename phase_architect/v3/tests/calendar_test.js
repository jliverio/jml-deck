// Every phase sequence of 1 to 5 phases (1 to 60 weeks each, sampled) gets a calendar that passes the
// validator's meeting rules: counts, windows, gates, kick-off and the 6-week gap.
const { meetingCalendar } = require('../chain.js');
const { validatePlan } = require('../../validate_plan_v2.js');
const CAL = /^gov:(gap_|kickoff_count|[^:]+:(gates_|workshops_|checkins_|workshop_outside|checkin_outside|workshops_under))/;
const NAMES = ['Diagnostic', 'Research', 'Design', 'Pilot', 'Implementation'];
function check(lens) {
  const phases = lens.map((L, i) => ({ name: NAMES[i], order: i + 1, duration_weeks: { min: L, max: L }, gate: { label: 'g', decision: 'd?' } }));
  const cal = meetingCalendar(phases);
  const arch = { basis: {}, phases, workstreams: [], governance: { events: cal.map(e => ({ ...e, label: 'x', purpose: 'x', attendees: ['a'], presents: [], decision: 'd?', agenda: ['Review a', 'Decide b'] })) }, architect_notes: [] };
  const v = validatePlan(arch, { brief: {} }).violations.filter(x => CAL.test(x));
  return { v, cal };
}
let n = 0, bad = [];
const seqs = [];
for (let L = 1; L <= 60; L++) seqs.push([L]);
const S = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 30, 36, 40, 52];
for (const a of S) for (const b of S) seqs.push([a, b]);
for (const a of S) for (const b of S) for (const c of [2, 5, 8, 12, 16, 24]) seqs.push([a, b, c]);
let seed = 7; const rnd = k => { seed = (seed * 9301 + 49297) % 233280; return 1 + Math.floor(seed / 233280 * k); };
for (let i = 0; i < 3000; i++) { const k = 1 + rnd(5) % 5 + 0; const s = []; for (let j = 0; j < Math.min(k, 5); j++) s.push(rnd(30)); seqs.push(s); }
for (const s of seqs) { n++; try { const r = check(s); if (r.v.length) bad.push([s.join('+'), r.v]); } catch (e) { bad.push([s.join('+'), [e.message]]); } }
console.log(`${n - bad.length}/${n} phase sequences get a calendar that passes the meeting rules`);
bad.slice(0, 15).forEach(b => console.log(' ', b[0], JSON.stringify(b[1])));
const show = s => console.log(' ', s.join('+') + 'w:', meetingCalendar(s.map((L, i) => ({ name: NAMES[i], duration_weeks: { min: L, max: L } }))).map(e => e.type[0].toUpperCase() + e.week).join(' '));
[[20], [24], [6, 14], [6, 6, 8, 13, 6], [4], [12, 26], [52]].forEach(show);
process.exit(bad.length ? 1 : 0);
