// Phase Architect v2 validator. Generated from phase_architect/validate_plan_v2.js; edit that file and regenerate.
// Phase Architect v2 — deterministic validator and plan compiler.
// Pure function: validatePlan(arch, ctx) -> { plan, violations, repairs }.
//   arch: the agent's JSON (schema_v2.json)
//   ctx:  { brief, success_criteria_list: [string], jargon_never: [string] }
// Arithmetic is repaired silently and logged in `repairs`; content problems
// go to `violations` (sent back to the agent once as `violations`).
// The same code runs in the n8n "Validate plan" Code node (n8n/code/validate_plan.js).

const LIM = { ws_name: 28, deliverable: 60, activity: 60, label: 28, purpose: 45, decision: 90, agenda: 80, gate_label: 22, objective_words: 20, answers_words: 20, gq_words: 25, note_words: 25 };
const AGENDA_VERBS = ['Present', 'Review', 'Align', 'Discuss', 'Confirm', 'Decide'];

// Deadline in the brief's timeline -> whole weeks available from (today + startLag weeks).
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
function parseDeadline(text) {
  const t = String(text || '');
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = new RegExp('(' + MONTHS.join('|') + ')\\s+(\\d{1,2}),?\\s+(\\d{4})', 'i').exec(t);
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]));
  m = new RegExp('(\\d{1,2})\\s+(' + MONTHS.join('|') + ')\\s+(\\d{4})', 'i').exec(t);
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1]));
  return null;
}
function weeksAvailable(brief, today, startLagWeeks) {
  const tl = ((brief || {}).soft_fields || {}).timeline || {};
  if (tl.source !== 'stated' || !tl.value) return null;
  const d = parseDeadline(tl.value);
  if (!d) return null;
  const t0 = new Date(String(today).slice(0, 10) + 'T00:00:00Z');
  const w = Math.floor((d - t0) / (7 * 864e5)) - (startLagWeeks == null ? 2 : startLagWeeks);
  return w > 0 ? w : 0;
}

function words(s) { return String(s || '').split(/\s+/).filter(Boolean).length; }

function validatePlan(arch, ctx) {
  ctx = ctx || {};
  const v = [];       // violations
  const repairs = [];
  const brief = ctx.brief || {};
  const scList = ctx.success_criteria_list || [];
  const never = (ctx.jargon_never || []).map(x => String(x).replace(/\s*\(.*\)\s*/, '').trim().toLowerCase()).filter(Boolean);

  // ---------- phases: order and absolute weeks (repair) ----------
  const phases = (arch.phases || []).map((p, i) => ({ ...p }));
  phases.forEach((p, i) => {
    if (p.order !== i + 1) { repairs.push(`phase ${p.name}: order ${p.order} -> ${i + 1}`); }
    p.order = i + 1;
    const d = p.duration_weeks || {};
    let mn = Number(d.min) || 0, mx = Number(d.max) || 0;
    if (mx < 1) { mx = Math.max(mn, 1); repairs.push(`phase ${p.name}: max set to ${mx}`); }
    if (mn < 1 || mn > mx) { mn = Math.min(Math.max(mn, 1), mx); repairs.push(`phase ${p.name}: min set to ${mn}`); }
    p.duration_weeks = { min: mn, max: mx };
  });
  let cursor = 1;
  for (const p of phases) { p.start_week = cursor; p.end_week = cursor + p.duration_weeks.max - 1; cursor = p.end_week + 1; }
  const total = { min: phases.reduce((a, p) => a + p.duration_weeks.min, 0), max: phases.reduce((a, p) => a + p.duration_weeks.max, 0) };
  const byOrder = Object.fromEntries(phases.map(p => [p.order, p]));
  if (!phases.length) v.push('plan:no_phases');
  const names = phases.map(p => p.name);
  names.forEach((n, i) => { if (names.indexOf(n) !== i) v.push(`phase:${n}:name_used_twice`); });

  // stated length must hold
  const el = (brief.required || {}).engagement_length || {};
  if (el.source === 'stated' && el.weeks_max != null && total.max !== el.weeks_max) v.push(`phase:total_max_${total.max}_vs_stated_${el.weeks_max}`);
  if (el.source === 'stated' && el.weeks_min != null && total.min !== el.weeks_min) v.push(`phase:total_min_${total.min}_vs_stated_${el.weeks_min}`);
  if (ctx.weeks_available != null && total.max > ctx.weeks_available) v.push(`phase:total_max_${total.max}_over_weeks_available_${ctx.weeks_available}`);
  phases.forEach(p => { if (p.duration_weeks.max - p.duration_weeks.min > 2) v.push(`phase:${p.name}:range_${p.duration_weeks.min}-${p.duration_weeks.max}_wider_than_2`); });
  const et = ((brief.required || {}).engagement_type || {}).value;
  const IMPL = ['Pilot', 'Implementation', 'Change & Training', 'Measurement'];
  if (et !== 'assessment_and_implementation' && names.some(n => IMPL.includes(n))) v.push('phase:implementation_phase_in_assessment');
  if (et === 'assessment_and_implementation' && !names.some(n => IMPL.includes(n))) v.push('phase:no_implementation_phase');
  phases.forEach(p => {
    if (words(p.objective_one_line) > LIM.objective_words) v.push(`phase:${p.name}:objective_over_${LIM.objective_words}_words`);
    if (!p.gate || !p.gate.label || !p.gate.decision) v.push(`phase:${p.name}:gate_missing`);
    else {
      if (p.gate.label.length > LIM.gate_label) v.push(`phase:${p.name}:gate_label_over_${LIM.gate_label}`);
      if (!/\?$/.test(p.gate.decision.trim())) v.push(`phase:${p.name}:gate_decision_not_question`);
    }
  });

  // ---------- workstreams (repair weeks, check content) ----------
  const wss = (arch.workstreams || []).map(w => ({ ...w }));
  const wsById = {};
  wss.forEach(w => { if (wsById[w.id]) v.push(`ws:${w.id}:duplicate_id`); wsById[w.id] = w; });
  if (wss.length > 8) v.push(`ws:count_${wss.length}_over_8`);
  for (const w of wss) {
    const p = byOrder[w.phase_order];
    if (!p) { v.push(`ws:${w.id}:unknown_phase_${w.phase_order}`); continue; }
    let so = Number(w.start_offset) || 0, du = Number(w.duration) || 0;
    if (so < 0) { repairs.push(`ws ${w.id}: start_offset ${so} -> 0`); so = 0; }
    if (so > p.duration_weeks.max - 1) { repairs.push(`ws ${w.id}: start_offset ${so} -> ${p.duration_weeks.max - 1}`); so = p.duration_weeks.max - 1; }
    if (du < 1) { repairs.push(`ws ${w.id}: duration ${du} -> 1`); du = 1; }
    if (so + du > p.duration_weeks.max) { const nd = p.duration_weeks.max - so; v.push(`ws:${w.id}:runs_past_phase_end`); repairs.push(`ws ${w.id}: duration ${du} -> ${nd} (clamped to phase end)`); du = nd; }
    w.start_offset = so; w.duration = du;
    w.start_week = p.start_week + so; w.end_week = w.start_week + du - 1;
    if (!w.name || w.name.length > LIM.ws_name) v.push(`ws:${w.id}:name_over_${LIM.ws_name}`);
    if (words(w.answers) > LIM.answers_words) v.push(`ws:${w.id}:answers_over_${LIM.answers_words}_words`);
    const acts = w.activities || [];
    if (acts.length < 2 || acts.length > 3) v.push(`ws:${w.id}:activities_count_${acts.length}`);
    acts.forEach((a, i) => { if (String(a).length > LIM.activity) v.push(`ws:${w.id}:activity_${i + 1}_over_${LIM.activity}`); });
    const ds = w.deliverables || [];
    if (ds.length < 1 || ds.length > 2) v.push(`ws:${w.id}:deliverables_count_${ds.length}`);
    // traces
    const tr = w.traces_to || [];
    if (!tr.length) v.push(`ws:${w.id}:no_trace`);
    tr.forEach(t => {
      if (t === 'problem_statement') return;
      let m = /^success_criteria:(\d+)$/.exec(t);
      if (m) { if (Number(m[1]) < 1 || Number(m[1]) > scList.length) v.push(`ws:${w.id}:trace_${t}_unknown`); return; }
      m = /^gate:(\d+)$/.exec(t);
      if (m) { if (!byOrder[Number(m[1])]) v.push(`ws:${w.id}:trace_${t}_unknown`); return; }
      v.push(`ws:${w.id}:trace_${t}_invalid`);
    });
  }
  // dependencies
  for (const w of wss) {
    for (const f of (w.follows || [])) {
      const d = wsById[f];
      if (!d) { v.push(`ws:${w.id}:follows_unknown_${f}`); continue; }
      if (d.start_week == null || w.start_week == null) continue;
      if (!(w.start_week > d.start_week)) v.push(`ws:${w.id}:starts_before_or_with_${f}`);
      if (w.end_week < d.end_week) v.push(`ws:${w.id}:ends_before_${f}`);
    }
  }
  // per-phase structure: count, coverage, gate feeder
  for (const p of phases) {
    const mine = wss.filter(w => w.phase_order === p.order && w.start_week != null);
    p.workstream_ids = mine.map(w => w.id);
    if (!mine.length) { v.push(`phase:${p.name}:no_workstreams`); continue; }
    const minCount = p.duration_weeks.max <= 3 ? 1 : 2;
    if (mine.length < minCount || mine.length > 4) v.push(`phase:${p.name}:workstreams_${mine.length}`);
    const idle = [];
    for (let wk = p.start_week; wk <= p.end_week; wk++) if (!mine.some(w => w.start_week <= wk && w.end_week >= wk)) idle.push(wk - p.start_week + 1);
    if (idle.length) v.push(`phase:${p.name}:idle_weeks_${idle.join('_')}`);
    if (!mine.some(w => w.end_week === p.end_week)) v.push(`phase:${p.name}:nothing_runs_into_gate_week`);
  }
  // success criteria coverage, and tested in the last phase
  const lastOrder = phases.length;
  scList.forEach((_, i) => {
    const tag = 'success_criteria:' + (i + 1);
    if (!wss.some(w => (w.traces_to || []).includes(tag))) v.push(`trace:success_criteria_${i + 1}_untraced`);
    else if (!wss.some(w => w.phase_order === lastOrder && (w.traces_to || []).includes(tag))) v.push(`trace:success_criteria_${i + 1}_not_tested_in_last_phase`);
  });

  // ---------- deliverables ----------
  const dels = [];
  const delById = {};
  for (const w of wss) for (const d of (w.deliverables || [])) {
    let dueIn = Number(d.due_week_in_phase);
    const wsFirst = (w.start_offset || 0) + 1, wsLast = (w.start_offset || 0) + (w.duration || 1);
    if (!dueIn) { dueIn = wsLast; repairs.push(`del ${d.id}: due week defaulted to workstream end`); }
    if (dueIn < wsFirst || dueIn > wsLast) { v.push(`del:${d.id}:due_wk${dueIn}_outside_${w.id}_wk${wsFirst}-${wsLast}`); dueIn = Math.min(Math.max(dueIn, wsFirst), wsLast); }
    const phStart = (byOrder[w.phase_order] || {}).start_week || 1;
    const dd = { ...d, workstream_id: w.id, phase_order: w.phase_order, due_week: phStart + dueIn - 1 };
    if (delById[d.id]) v.push(`del:${d.id}:duplicate_id`);
    delById[d.id] = dd; dels.push(dd);
    if (!d.name || d.name.length > LIM.deliverable) v.push(`del:${d.id}:name_over_${LIM.deliverable}`);
    if (/^(analy[sz]e|assess|review|conduct|perform|map|build|define|develop)\b/i.test(d.name || '')) v.push(`del:${d.id}:activity_not_noun`);
  }
  if (dels.length < 3 || dels.length > 12) v.push(`del:count_${dels.length}`);

  // ---------- governance ----------
  const gov = arch.governance || {};
  const cadence = total.max <= 8 ? 1 : 2;
  if (gov.status_cadence_weeks !== cadence) repairs.push(`status cadence ${gov.status_cadence_weeks} -> ${cadence}`);
  const events = (gov.events || []).map(e => ({ ...e }));
  const evIds = new Set();
  for (const e of events) {
    if (evIds.has(e.id)) v.push(`gov:${e.id}:duplicate_id`); evIds.add(e.id);
    const p = byOrder[e.phase_order];
    if (!p) { v.push(`gov:${e.id}:unknown_phase`); continue; }
    let wip = Number(e.week_in_phase) || 1;
    if (e.type === 'kickoff' && (p.order !== 1 || wip !== 1)) { repairs.push(`event ${e.id}: kickoff moved to week 1`); e.phase_order = 1; wip = 1; }
    if (e.type === 'gate' && wip !== p.duration_weeks.max) { repairs.push(`event ${e.id}: gate week ${wip} -> ${p.duration_weeks.max}`); wip = p.duration_weeks.max; }
    if (wip < 1 || wip > p.duration_weeks.max) { const nw = Math.min(Math.max(wip, 1), p.duration_weeks.max); repairs.push(`event ${e.id}: week ${wip} -> ${nw}`); wip = nw; }
    e.week_in_phase = wip;
    e.week = byOrder[e.phase_order].start_week + wip - 1;
    if (!e.label || e.label.length > LIM.label) v.push(`gov:${e.id}:label_over_${LIM.label}`);
    if (!e.purpose || e.purpose.length > LIM.purpose) v.push(`gov:${e.id}:purpose_over_${LIM.purpose}`);
    const ag = e.agenda || [];
    if (ag.length < 2 || ag.length > 3) v.push(`gov:${e.id}:agenda_count_${ag.length}`);
    ag.forEach((a, i) => {
      if (String(a).length > LIM.agenda) v.push(`gov:${e.id}:agenda_${i + 1}_over_${LIM.agenda}`);
      if (!AGENDA_VERBS.includes(String(a).split(/\s+/)[0])) v.push(`gov:${e.id}:agenda_${i + 1}_verb`);
    });
    if (e.type !== 'kickoff') {
      if (!e.decision || !/\?$/.test(String(e.decision).trim())) v.push(`gov:${e.id}:decision_not_question`);
      else if (e.decision.length > LIM.decision) v.push(`gov:${e.id}:decision_over_${LIM.decision}`);
    }
    const pres = e.presents || [];
    if ((e.type === 'gate' || e.type === 'workshop') && !pres.length) v.push(`gov:${e.id}:presents_nothing`);
    if (e.type === 'kickoff' && pres.length) { repairs.push(`event ${e.id}: kickoff presents cleared`); e.presents = []; }
    pres.forEach(id => {
      const d = delById[id];
      if (!d) v.push(`gov:${e.id}:presents_unknown_${id}`);
      else if (d.due_week > e.week) v.push(`gov:${e.id}:presents_${id}_before_due_wk${d.due_week}`);
    });
  }
  // attendees come from stated stakeholders, or the placeholder
  const sh = (brief.required || {}).stakeholders || {};
  const stated = sh.source === 'stated' && Array.isArray(sh.value) ? sh.value : null;
  for (const e of events) {
    const at = e.attendees || [];
    if (!at.length) v.push(`gov:${e.id}:no_attendees`);
    else if (stated) at.forEach(a => { if (!stated.includes(a)) v.push(`gov:${e.id}:attendee_not_stated_${String(a).replace(/\s+/g, '_')}`); });
    else if (!(at.length === 1 && at[0] === '[Client steering group]')) v.push(`gov:${e.id}:attendees_without_stated_stakeholders`);
  }
  // never more than 6 weeks between steering moments
  {
    const wk = [...new Set(events.map(e => e.week))].sort((a, b) => a - b);
    for (let i = 1; i < wk.length; i++) if (wk[i] - wk[i - 1] > 6) v.push(`gov:gap_${wk[i - 1]}_to_${wk[i]}_over_6_weeks`);
  }
  if (events.filter(e => e.type === 'kickoff').length !== 1) v.push(`gov:kickoff_count_${events.filter(e => e.type === 'kickoff').length}`);
  for (const p of phases) {
    const mine = events.filter(e => e.phase_order === p.order);
    const L = p.duration_weeks.max;
    const gates = mine.filter(e => e.type === 'gate');
    if (gates.length !== 1) v.push(`gov:${p.name}:gates_${gates.length}`);
    const ws = mine.filter(e => e.type === 'workshop').sort((a, b) => a.week_in_phase - b.week_in_phase);
    const cks = mine.filter(e => e.type === 'checkin');
    const wantW = L >= 12 ? 2 : (L >= 8 ? 1 : 0);
    const wantC = (L >= 5 && L <= 7) ? 1 : 0;
    if (ws.length !== wantW) v.push(`gov:${p.name}:workshops_${ws.length}_want_${wantW}`);
    if (cks.length !== wantC) v.push(`gov:${p.name}:checkins_${cks.length}_want_${wantC}`);
    const inWin = (e, lo, hi) => { const r = e.week_in_phase / L; return r >= lo - 1e-9 && r <= hi + 1e-9 && e.week_in_phase < L; };
    if (wantW === 1 && ws[0] && !inWin(ws[0], 0.5, 0.75)) v.push(`gov:${ws[0].id}:workshop_outside_50_75pct`);
    if (wantW === 2 && ws.length === 2) {
      if (!inWin(ws[0], 0.25, 0.45)) v.push(`gov:${ws[0].id}:workshop_outside_25_45pct`);
      if (!inWin(ws[1], 0.6, 0.8)) v.push(`gov:${ws[1].id}:workshop_outside_60_80pct`);
      if (ws[1].week_in_phase - ws[0].week_in_phase < 4) v.push(`gov:${p.name}:workshops_under_4_weeks_apart`);
    }
    if (wantC && cks[0] && !inWin(cks[0], 0.5, 0.75)) v.push(`gov:${cks[0].id}:checkin_outside_50_75pct`);
  }
  // each check-in, workshop and gate brings material that fell due since the previous one
  {
    const seq = events.filter(e => e.type !== 'kickoff').sort((a, b) => a.week - b.week);
    let prev = 0;
    for (const e of seq) {
      const fresh = (e.presents || []).some(id => delById[id] && delById[id].due_week > prev && delById[id].due_week <= e.week);
      if ((e.type === 'workshop' || e.type === 'gate') && !fresh) v.push(`gov:${e.id}:no_new_material_since_wk${prev}`);
      prev = e.week;
    }
  }
  // every deliverable presented at a gate/workshop at or after due
  for (const d of dels) {
    const shown = events.some(e => (e.type === 'gate' || e.type === 'workshop') && (e.presents || []).includes(d.id) && e.week >= d.due_week);
    if (!shown) v.push(`del:${d.id}:never_presented`);
  }

  // ---------- language ----------
  const texts = [];
  phases.forEach(p => texts.push(['phase:' + p.name, p.objective_one_line], ['gate:' + p.name, p.gate && p.gate.decision]));
  wss.forEach(w => { texts.push(['ws:' + w.id, w.name], ['ws:' + w.id, w.answers]); (w.activities || []).forEach(a => texts.push(['ws:' + w.id, a])); });
  dels.forEach(d => texts.push(['del:' + d.id, d.name]));
  events.forEach(e => { texts.push(['gov:' + e.id, e.label], ['gov:' + e.id, e.purpose], ['gov:' + e.id, e.decision]); (e.agenda || []).forEach(a => texts.push(['gov:' + e.id, a])); });
  const tok = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const [where, s] of texts) for (const term of never) {
    const hit = term.includes(' ') ? String(s || '').toLowerCase().includes(term) : tok(s).includes(term);
    if (hit) v.push(`${where}:never_use_${term.replace(/\s+/g, '_')}`);
  }
  (arch.architect_notes || []).forEach((n, i) => { if (words(n) > LIM.note_words) v.push(`note_${i + 1}:over_${LIM.note_words}_words`); });
  if ((arch.architect_notes || []).length > 6) v.push('notes:over_6');
  if (words((arch.basis || {}).governing_question) > LIM.gq_words) v.push('basis:governing_question_too_long');

  // ---------- compile render model ----------
  const statusWeeks = [];
  const taken = new Set(events.map(e => e.week));
  for (let wk = 1 + cadence; wk <= total.max; wk += cadence) if (!taken.has(wk)) statusWeeks.push(wk);
  const evSorted = events.slice().sort((a, b) => a.week - b.week);
  const presentedAt = {};
  for (const d of dels) {
    const e = evSorted.find(e => e.type !== 'kickoff' && (e.presents || []).includes(d.id) && e.week >= d.due_week);
    presentedAt[d.id] = e ? e.label : null;
  }
  const plan = {
    basis: arch.basis || {},
    total_duration_weeks: total,
    phases: phases.map(p => ({ name: p.name, order: p.order, start_week: p.start_week, end_week: p.end_week, duration_weeks: p.duration_weeks, duration_derived: !!p.duration_derived, objective_one_line: p.objective_one_line, gate: p.gate, depends_on_assumptions: p.depends_on_assumptions || [], workstream_ids: p.workstream_ids || [] })),
    workstreams: wss.map(w => ({ id: w.id, phase_order: w.phase_order, name: w.name, answers: w.answers, traces_to: w.traces_to || [], start_week: w.start_week, end_week: w.end_week, follows: w.follows || [], activities: w.activities || [], deliverable_ids: (w.deliverables || []).map(d => d.id) })),
    deliverables: dels.map(d => ({ id: d.id, name: d.name, kind: d.kind, workstream_id: d.workstream_id, phase_order: d.phase_order, due_week: d.due_week, presented_at: presentedAt[d.id] })),
    governance: { status_cadence_weeks: cadence, status_weeks: statusWeeks, events: evSorted.map(e => ({ id: e.id, type: e.type, phase_order: e.phase_order, week: e.week, label: e.label, purpose: e.purpose, attendees: e.attendees || [], presents: e.presents || [], decision: e.decision || null, agenda: e.agenda || [] })) },
    deadline: (ctx.weeks_available != null) ? { text: (((brief.soft_fields || {}).timeline) || {}).value || null, weeks_available: ctx.weeks_available } : null,
    architect_notes: arch.architect_notes || [],
    // v1-compatible fields for downstream nodes that still read them
    sequencing: 'sequential',
    timeline_slide: { unit: 'weeks', bars: phases.map(p => ({ phase: p.name, start: p.start_week, end: p.end_week })) }
  };
  return { plan, violations: v, repairs };
}



// ---------------- n8n wrapper ----------------
// Validate plan (Code, run once for each item). Input: Phase Architect (first pass, or the retry pass).
// Output: { output: compiled plan, valid, violations, repairs, retry_input, agent_error }.
const inp = $('Architect input').first().json.architect_input;
const cfg = $('Config').first().json;
const agentError = $json && $json.error ? String($json.error.message || $json.error) : '';
const r = validatePlan(($json && $json.output) || {}, {
  brief: inp.brief,
  success_criteria_list: inp.success_criteria_list,
  jargon_never: cfg.jargon_never,
  weeks_available: inp.weeks_available
});
const violations = agentError ? ['agent_error: ' + agentError, ...r.violations] : r.violations;
return { json: {
  output: r.plan,
  valid: violations.length === 0,
  violations,
  repairs: r.repairs,
  agent_error: agentError || null,
  retry_input: violations.length ? { ...inp, previous_output: ($json && $json.output) || null, violations } : null
} };
