// Plan-size stress test for the Phase Architect rules (validate_plan_v2.js).
// Builds rule-following plans from 2 to 52 weeks with 1 to 12 workstreams, with and without the partner's
// own streams (brief.soft_fields.workstreams), and checks that each passes the validator; then checks that
// the size rules still catch the plans they should. Writes the compiled plans to tests/out_plan_size/ for
// tests/workplan_render_size.py. Usage: node phase_architect/tests/plan_size_test.js
const fs = require('fs');
const path = require('path');
const { validatePlan } = require('../validate_plan_v2.js');
const OUT = path.join(__dirname, 'out_plan_size');
fs.mkdirSync(OUT, { recursive: true });

const NAMES = ['Diagnostic', 'Research', 'Design', 'Handover'];
const STREAMS = ['Pricing', 'Channel economics', 'Distributor terms', 'Customer service', 'Supply chain', 'Procurement',
  'Finance processes', 'HR and organization', 'IT and data', 'Legal and compliance', 'Brand and marketing', 'Sales operations',
  'Treasury', 'Facilities'];

function brief(totalWeeks, streams) {
  const f = (value, extra) => ({ value, source: value == null ? 'assumed' : 'stated', quote: value == null ? null : String(value), assumption_text: null, ...(extra || {}) });
  return {
    hard_fields: { client: f('Testco'), problem_statement: f('Testco wants to know why margins fell.') },
    required: { engagement_type: f('assessment'), engagement_length: f(`${totalWeeks} weeks`, { weeks_min: totalWeeks, weeks_max: totalWeeks, duration_derived: false }), stakeholders: f(['COO', 'CFO']) },
    soft_fields: { deliverable_format: f(null), timeline: f(null), prior_attempts: f(null), success_criteria: f(null), out_of_scope: f(null),
      workstreams: streams ? f(streams.names ? streams.names.join('; ') : String(streams.count), { count: streams.count }) : f(null, { count: null }) }
  };
}

// steering weeks inside a phase of L weeks, given the previous moment's week counted in this phase (1 = kickoff, 0 = last gate)
function meetings(L, prevRel) {
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const ev = [];
  if (L >= 12) {
    const w1 = clamp(prevRel + 6, Math.ceil(0.25 * L), Math.floor(0.45 * L));
    const w2 = clamp(w1 + 6, Math.max(Math.ceil(0.6 * L), w1 + 4), Math.floor(0.8 * L));
    ev.push({ type: 'workshop', w: w1 }, { type: 'workshop', w: w2 });
  } else if (L >= 8) ev.push({ type: 'workshop', w: clamp(prevRel + 6, Math.ceil(0.5 * L), Math.floor(0.75 * L)) });
  else if (L >= 5) ev.push({ type: 'checkin', w: Math.ceil(0.5 * L) });
  ev.push({ type: 'gate', w: L });
  if (L >= 16) { // fill gaps over 6 weeks with check-ins
    const out = []; let prev = prevRel;
    for (const e of ev) { while (e.w - prev > 6) { prev += 6; out.push({ type: 'checkin', w: prev }); } out.push(e); prev = e.w; }
    return out;
  }
  return ev;
}

// phases: [L, ...]; perPhase: [k, ...] workstreams in each phase; stated: null or {count, names?}
function build(phases, perPhase, stated) {
  const total = phases.reduce((a, b) => a + b, 0);
  const arch = { basis: { governing_question: 'Why did Testco margins fall?', archetype_id: null }, phases: [], workstreams: [],
    governance: { status_cadence_weeks: total <= 8 ? 1 : 2, events: [] }, architect_notes: [] };
  let wsN = 0, dN = 0, gN = 0, start = 1, prevAbs = 1;
  arch.governance.events.push({ id: 'G' + (++gN), type: 'kickoff', phase_order: 1, week_in_phase: 1, label: 'Kick-off', purpose: 'Agree scope and ways of working',
    presents: [], decision: null, agenda: ['Confirm scope and governing question', 'Align on data access and meeting rhythm'], attendees: ['COO'] });
  phases.forEach((L, i) => {
    const order = i + 1;
    arch.phases.push({ name: NAMES[i], order, duration_weeks: { min: L, max: L }, duration_derived: false, objective_one_line: 'Establish the facts the next decision needs.',
      gate: { label: 'Phase sign-off', decision: 'Do the findings stand as the basis for the next step?' }, depends_on_assumptions: [] });
    const ms = meetings(L, prevAbs - start + 1);
    const fresh = ms.filter(m => m.type !== 'checkin');
    const k = perPhase[i];
    const streams = [];
    for (let j = 0; j < k; j++) {
      const name = stated ? (stated.names ? stated.names[j] : STREAMS[j]) : `${NAMES[i]} stream ${j + 1}`;
      streams.push({ id: 'W' + (++wsN), phase_order: order, name, answers: 'What explains this part of the margin fall?', traces_to: ['problem_statement'],
        start_offset: 0, duration: L, follows: [], activities: ['Review documents and operational data', 'Interview the people who do the work'], deliverables: [] });
    }
    // give each workshop and gate one deliverable due in its week, then one each to the streams left without one
    fresh.forEach((m, j) => { const w = streams[j % k]; w.deliverables.push({ id: null, name: `Findings for ${m.type} in week ${m.w}`, kind: 'analysis', due_week_in_phase: m.w }); });
    streams.forEach(w => { if (!w.deliverables.length) w.deliverables.push({ id: null, name: 'Stream findings pack', kind: 'analysis', due_week_in_phase: L }); });
    // a plan needs 3 deliverables: in a short plan, streams hand over a second one at the gate
    for (const w of streams) if (dN + streams.reduce((a, x) => a + x.deliverables.length, 0) < 3 && w.deliverables.length < 2)
      w.deliverables.push({ id: null, name: 'Recommendations for the gate', kind: 'decision_pack', due_week_in_phase: L });
    streams.forEach(w => w.deliverables.forEach(d => { d.id = 'D' + (++dN); }));
    arch.workstreams.push(...streams);
    for (const m of ms) {
      const dueHere = streams.flatMap(w => w.deliverables).filter(d => d.due_week_in_phase === m.w).map(d => d.id);
      arch.governance.events.push({ id: 'G' + (++gN), type: m.type, phase_order: order, week_in_phase: m.w,
        label: m.type === 'gate' ? 'Phase sign-off' : (m.type === 'workshop' ? 'Workshop' : 'Check-in'), purpose: 'Review findings and direction',
        presents: m.type === 'checkin' ? [] : dueHere, decision: m.type === 'gate' ? 'Do the findings stand as the basis for the next step?' : 'Confirm the focus of the remaining work?',
        agenda: ['Present the latest findings', 'Decide the focus of the next weeks'], attendees: ['COO'] });
    }
    prevAbs = start + L - 1;
    start += L;
  });
  return { arch, ctx: { brief: brief(total, stated), success_criteria_list: [], jargon_never: [] } };
}

const results = [];
function expect(label, phases, perPhase, stated, want) {
  const { arch, ctx } = build(phases, perPhase, stated);
  const r = validatePlan(arch, ctx);
  const dels = r.plan.deliverables.length;
  const v = r.violations;
  const ok = want === 'pass' ? v.length === 0 : v.some(x => x.includes(want));
  results.push({ label, ok, v });
  if (want === 'pass') fs.writeFileSync(path.join(OUT, label + '.json'), JSON.stringify({ client: 'Testco', ...r.plan }));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${r.plan.total_duration_weeks.max} wk, ${r.plan.workstreams.length} ws, ${dels} del` +
    (ok ? '' : ` -> ${JSON.stringify(v)}`));
}
const split = (T, n) => { const b = Math.floor(T / n), r = T % n; return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0)); };

// 1. Partner's own streams: any length, 1 to 12 streams, rows = streams x phases <= 12
for (const T of [4, 6, 8, 12, 13, 16, 20, 26, 39, 52]) {
  for (const c of [2, 3, 6, 7, 12]) {
    const nPh = Math.max(1, Math.min(T >= 8 ? 3 : 2, Math.floor(12 / c)));
    const phases = split(T, nPh);
    expect(`stated_${String(T).padStart(2, '0')}w_${String(c).padStart(2, '0')}streams_${nPh}ph`, phases, phases.map(() => c), { count: c }, 'pass');
  }
}
// 2. No stated streams: the 2-4 per phase default still works at every length
for (const T of [2, 4, 6, 8, 12, 13, 16, 20, 26, 39, 52]) {
  const nPh = T <= 3 ? 1 : (T <= 8 ? 2 : (T <= 26 ? 3 : 4));
  const phases = split(T, nPh);
  for (const k of [2, 3]) expect(`default_${String(T).padStart(2, '0')}w_${k}perphase`, phases, phases.map(() => k), null, 'pass');
}
// 3. One long phase: 16 to 52 weeks need gap check-ins, and pass with them
for (const L of [16, 19, 20, 24, 30, 52]) expect(`longphase_${L}w`, [L], [3], null, 'pass');
expect('longphase_20w_after_another', [6, 20], [2, 3], null, 'pass');

// 4. The rules still catch what they should
expect('catch_default_6_in_a_phase', [6, 6], [6, 6], null, 'workstreams_6');
expect('catch_stated_3_planned_4', [6, 6], [4, 4], { count: 3 }, 'streams_4_vs_stated_3');
expect('catch_over_12_rows', [6, 6], [7, 7], { count: 7 }, 'count_14_over_12');
{ // a long phase without the gap check-ins
  const { arch, ctx } = build([24], [3], null);
  arch.governance.events = arch.governance.events.filter(e => e.type !== 'checkin');
  const r = validatePlan(arch, ctx);
  const ok = r.violations.some(x => x.startsWith('gov:gap_'));
  results.push({ label: 'catch_long_phase_without_checkins', ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} catch_long_phase_without_checkins: ${JSON.stringify(r.violations)}`);
}
{ // too many check-ins in a 6-week phase
  const { arch, ctx } = build([6, 6], [2, 2], null);
  arch.governance.events.push({ ...arch.governance.events.find(e => e.type === 'checkin'), id: 'G99', week_in_phase: 2 });
  const r = validatePlan(arch, ctx);
  const ok = r.violations.some(x => x.includes('checkins_2_want_1'));
  results.push({ label: 'catch_two_checkins_in_6w', ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} catch_two_checkins_in_6w: ${JSON.stringify(r.violations)}`);
}
const bad = results.filter(r => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
