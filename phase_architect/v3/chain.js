// Phase Architect v3: a lead agent and three agents in a chain (Oct 18, 2026).
//   1. Phase Architect (lead)  -> basis, phases (1-5), notes
//   2. meetingCalendar (code)   -> kick-off, gates, workshops, check-ins: types and weeks
//   3. Workstream agent         -> workstreams per phase and their weeks
//   4. Deliverable agent        -> 1-3 deliverables per workstream and their due weeks
//   5. Governance agent         -> what each meeting is for: label, purpose, attendees, presents, decision, agenda
//   6. compile (code)           -> the v2 agent format, run through validate_plan_v2.js -> the same plan the renderer uses
// After each agent, checkStage() returns only that agent's violations; the agent retries once with them.
// Pure functions, no I/O: the same code can run in n8n Code nodes.

const { validatePlan } = require('../validate_plan_v2.js');

const MAX_PHASES = 5;
const MAX_DEL_PER_WS = 3;
const MAX_AGENT_NOTES = 2;      // workstream, deliverable and governance agents; the lead has up to 6
const NOTE_WORDS = 25;

function words(s) { return String(s || '').split(/\s+/).filter(Boolean).length; }

// Phases with absolute weeks. Phases run one after the other; a phase lasts its `max` weeks on the slides.
function phaseWeeks(phases) {
  let cursor = 1;
  return (phases || []).map((p, i) => {
    const d = p.duration_weeks || {};
    const mx = Math.max(1, Number(d.max) || 0);
    const mn = Math.min(Math.max(1, Number(d.min) || mx), mx);
    const out = { ...p, order: i + 1, duration_weeks: { min: mn, max: mx }, start_week: cursor, end_week: cursor + mx - 1 };
    cursor += mx;
    return out;
  });
}

// Meeting calendar, from the phase lengths only. The rules are the validator's:
//   kick-off in week 1 of phase 1; one gate in each phase's last week;
//   workshops: 8-11 weeks one (50-75% of the phase), 12+ weeks two (25-45% and 60-80%, at least 4 weeks apart);
//   check-in: one in a 5-7 week phase (50-75%); from 16 weeks, check-ins wherever more than 6 weeks would pass;
//   never more than 6 weeks between two meetings, across phases too.
// Among the allowed placements it takes the one needing the fewest gap check-ins, then the one closest to the
// usual positions (one workshop at 60%, two at 35% and 70%, the check-in at 60%).
function meetingCalendar(phasesIn) {
  const phases = phaseWeeks(phasesIn);
  const out = [];
  let prev = null;
  for (const p of phases) {
    const L = p.duration_weeks.max, S = p.start_week;
    const win = (lo, hi) => { const a = []; for (let w = 1; w < L; w++) { const r = w / L; if (r >= lo - 1e-9 && r <= hi + 1e-9) a.push(w); } return a; };
    const wantW = L >= 12 ? 2 : (L >= 8 ? 1 : 0);
    const wantC = (L >= 5 && L <= 7) ? 1 : 0;
    const maxC = L >= 16 ? Math.ceil(L / 6) : wantC;
    let opts = [{ items: [], dev: 0 }];
    if (wantW === 1) opts = win(0.5, 0.75).map(w => ({ items: [{ type: 'workshop', wip: w }], dev: Math.abs(w / L - 0.6) }));
    if (wantW === 2) {
      opts = [];
      for (const a of win(0.25, 0.45)) for (const b of win(0.6, 0.8)) if (b - a >= 4) opts.push({ items: [{ type: 'workshop', wip: a }, { type: 'workshop', wip: b }], dev: Math.abs(a / L - 0.35) + Math.abs(b / L - 0.7) });
    }
    if (wantC) {
      const o2 = [];
      for (const o of opts) for (const c of win(0.5, 0.75)) o2.push({ items: [...o.items, { type: 'checkin', wip: c }], dev: o.dev + Math.abs(c / L - 0.6) });
      opts = o2;
    }
    const first = p.order === 1 ? [{ type: 'kickoff', wip: 1 }] : [];
    let best = null;
    for (const o of opts) {
      const items = [...first, ...o.items, { type: 'gate', wip: L }];
      const weeks = [...new Set(items.map(i => S + i.wip - 1))].sort((a, b) => a - b);
      const seq = prev == null ? weeks : [prev, ...weeks];
      const extra = [];
      for (let i = 1; i < seq.length; i++) {
        const g = seq[i] - seq[i - 1];
        const k = Math.ceil(g / 6) - 1;
        for (let j = 1; j <= k; j++) extra.push({ type: 'checkin', wip: seq[i - 1] + Math.round(j * g / (k + 1)) - S + 1 });
      }
      const ok = wantC + extra.length <= maxC;
      const cost = (ok ? 0 : 1e6) + extra.length * 10 + o.dev;
      if (!best || cost < best.cost) best = { cost, items: [...items, ...extra], ok };
    }
    if (!best.ok) throw new Error(`meetingCalendar: no placement keeps phase ${p.order} (${L} weeks) within 6-week gaps`);
    const rank = { kickoff: 0, checkin: 1, workshop: 1, gate: 2 };
    best.items.sort((a, b) => a.wip - b.wip || rank[a.type] - rank[b.type]);
    for (const it of best.items) out.push({ type: it.type, phase_order: p.order, week_in_phase: it.wip, week: S + it.wip - 1 });
    prev = Math.max(...best.items.map(i => S + i.wip - 1));
  }
  out.sort((a, b) => a.week - b.week || (a.type === 'kickoff' ? -1 : 0));
  out.forEach((e, i) => { e.id = 'G' + (i + 1); });
  return out.map(e => ({ id: e.id, type: e.type, phase_order: e.phase_order, week_in_phase: e.week_in_phase, week: e.week }));
}

// ---------- stage inputs: each agent sees only what its job needs ----------
function pick(obj, keys) { const o = {}; for (const k of keys) if (obj && obj[k] !== undefined) o[k] = obj[k]; return o; }
function briefSubset(brief, hard, req, soft) {
  return { hard_fields: pick(brief.hard_fields || {}, hard), required: pick(brief.required || {}, req), soft_fields: pick(brief.soft_fields || {}, soft) };
}
function phasesView(lead) {
  return phaseWeeks((lead || {}).phases).map(p => pick(p, ['order', 'name', 'duration_weeks', 'start_week', 'end_week', 'objective_one_line', 'gate']));
}
function wsView(state) {
  const ph = Object.fromEntries(phaseWeeks(state.lead.phases).map(p => [p.order, p]));
  return ((state.ws || {}).workstreams || []).map(w => {
    const p = ph[w.phase_order] || { start_week: 1 };
    const so = Number(w.start_offset) || 0, du = Math.max(1, Number(w.duration) || 1);
    return { ...pick(w, ['id', 'phase_order', 'name', 'answers', 'traces_to', 'start_offset', 'duration', 'follows', 'activities']), weeks_in_phase: `${so + 1}-${so + du}`, start_week: p.start_week + so, end_week: p.start_week + so + du - 1 };
  });
}
function stageInput(stage, state) {
  const inp = state.input;
  const brief = inp.brief || {};
  if (stage === 'lead') return inp;
  const arche = ((inp.method_library || []).find(a => a.id === ((state.lead || {}).basis || {}).archetype_id)) || null;
  const meetings = state.calendar;
  if (stage === 'ws') return {
    brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type', 'stakeholders'], ['workstreams', 'success_criteria', 'out_of_scope', 'prior_attempts']),
    success_criteria_list: inp.success_criteria_list || [],
    basis: state.lead.basis, archetype: arche, phases: phasesView(state.lead), meetings,
  };
  if (stage === 'del') return {
    brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type'], ['deliverable_format', 'success_criteria', 'out_of_scope']),
    success_criteria_list: inp.success_criteria_list || [],
    basis: state.lead.basis, archetype: arche, phases: phasesView(state.lead), workstreams: wsView(state), meetings,
  };
  if (stage === 'gov') {
    const ph = Object.fromEntries(phaseWeeks(state.lead.phases).map(p => [p.order, p]));
    const wsv = wsView(state);
    const wsById = Object.fromEntries(wsv.map(w => [w.id, w]));
    return {
      brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type', 'stakeholders'], ['timeline', 'success_criteria']),
      phases: phasesView(state.lead),
      workstreams: wsv.map(w => pick(w, ['id', 'phase_order', 'name', 'start_week', 'end_week'])),
      deliverables: ((state.del || {}).deliverables || []).map(d => ({ ...pick(d, ['id', 'workstream_id', 'name', 'kind', 'due_week_in_phase']), due_week: ((ph[(wsById[d.workstream_id] || {}).phase_order] || {}).start_week || 1) + (Number(d.due_week_in_phase) || 1) - 1 })),
      meetings: meetings.map(m => m.type === 'gate' ? { ...m, label: ((ph[m.phase_order] || {}).gate || {}).label, decision: ((ph[m.phase_order] || {}).gate || {}).decision } : m),
    };
  }
  throw new Error('unknown stage ' + stage);
}

// Deliverable ids in workstream order (D1, D2, ...), as the slides number them. Returns the renamed output.
function renumberDeliverables(state) {
  const order = ((state.ws || {}).workstreams || []).map(w => w.id);
  const dels = ((state.del || {}).deliverables || []).slice();
  dels.sort((a, b) => (order.indexOf(a.workstream_id) - order.indexOf(b.workstream_id)) || 0);
  const repairs = [];
  dels.forEach((d, i) => { const id = 'D' + (i + 1); if (d.id !== id) repairs.push(`del ${d.id} -> ${id}`); d.id = id; });
  return { deliverables: dels.map(d => ({ ...d })), notes: (state.del || {}).notes || [], repairs };
}

// ---------- merge into the v2 agent format ----------
function buildArch(state) {
  const lead = state.lead || {};
  const govById = Object.fromEntries((((state.gov || {}).events) || []).map(e => [e.id, e]));
  // the Governance agent may reword a gate's decision to match what the gate reviews (same choice);
  // that wording then closes the phase everywhere in the deck
  const gateWord = {};
  for (const c of (state.calendar || [])) {
    const d = (govById[c.id] || {}).decision;
    if (c.type === 'gate' && typeof d === 'string' && /\?$/.test(d.trim()) && d.length <= 90) gateWord[c.phase_order] = d.trim();
  }
  const phases = (lead.phases || []).map((p, i) => gateWord[i + 1] ? { ...p, gate: { ...(p.gate || {}), decision: gateWord[i + 1] } } : p);
  const delOut = ((state.del || {}).deliverables) || [];
  const workstreams = (((state.ws || {}).workstreams) || []).map(w => ({
    ...pick(w, ['id', 'phase_order', 'name', 'answers', 'traces_to', 'start_offset', 'duration', 'follows', 'activities']),
    deliverables: delOut.filter(d => d.workstream_id === w.id).map(d => pick(d, ['id', 'name', 'kind', 'due_week_in_phase'])),
  }));
  const content = Object.fromEntries((((state.gov || {}).events) || []).map(e => [e.id, e]));
  const events = (state.calendar || []).map(c => {
    const g = content[c.id] || {};
    const gate = c.type === 'gate' ? ((phases[c.phase_order - 1] || {}).gate || {}) : null;
    return {
      id: c.id, type: c.type, phase_order: c.phase_order, week_in_phase: c.week_in_phase,
      label: gate ? gate.label : g.label, purpose: g.purpose, attendees: g.attendees || [], presents: g.presents || [],
      decision: gate ? gate.decision : (g.decision === undefined ? null : g.decision), agenda: g.agenda || [],
    };
  });
  const notes = [...(lead.architect_notes || []), ...(((state.ws || {}).notes) || []), ...(((state.del || {}).notes) || []), ...(((state.gov || {}).notes) || [])];
  const total = phaseWeeks(phases).reduce((a, p) => a + p.duration_weeks.max, 0);
  return { basis: lead.basis || {}, phases, workstreams, governance: { status_cadence_weeks: total <= 8 ? 1 : 2, events }, architect_notes: notes.slice(0, 6) };
}

function vctx(state, ctx) {
  const inp = state.input;
  return { brief: inp.brief, success_criteria_list: inp.success_criteria_list || [], jargon_never: ctx.jargon_never || [], weeks_available: inp.weeks_available, max_deliverables_per_ws: MAX_DEL_PER_WS };
}

const CALENDAR = /^gov:(gap_|kickoff_count|[^:]+:(gates_|workshops_|checkins_|workshop_outside|checkin_outside|workshops_under))/;
const STAGE = {
  lead: v => /^(plan:|basis:|note_|notes:|gate:)/.test(v) || (/^phase:/.test(v) && !/:(no_workstreams|workstreams_\d+|idle_weeks_|nothing_runs_into_gate_week)/.test(v)),
  ws: v => (/^ws:/.test(v) && !/:deliverables_count_/.test(v)) || /^trace:/.test(v) || /^phase:[^:]+:(no_workstreams|workstreams_\d+|idle_weeks_|nothing_runs_into_gate_week)/.test(v),
  del: v => (/^del:/.test(v) && !/:never_presented$/.test(v)) || /^ws:[^:]+:deliverables_count_/.test(v),
  gov: v => (/^gov:/.test(v) && !CALENDAR.test(v)) || /^del:[^:]+:never_presented$/.test(v),
};

function agentNotes(stage, out) {
  const v = [];
  const n = (out || {}).notes || [];
  if (n.length > MAX_AGENT_NOTES) v.push(`notes:${stage}_${n.length}_over_${MAX_AGENT_NOTES}`);
  n.forEach((s, i) => { if (words(s) > NOTE_WORDS) v.push(`notes:${stage}_${i + 1}_over_${NOTE_WORDS}_words`); });
  return v;
}

// Violations for one stage only. `calendar` reports calendar errors, which are code bugs, never the agent's.
function checkStage(stage, state, ctx) {
  ctx = ctx || {};
  const arch = buildArch(state);
  const r = validatePlan(arch, vctx(state, ctx));
  const v = r.violations.filter(STAGE[stage]);
  const calendar = stage === 'gov' ? r.violations.filter(x => CALENDAR.test(x)) : [];
  if (stage === 'lead') {
    const n = (state.lead.phases || []).length;
    if (n > MAX_PHASES) v.push(`phase:count_${n}_over_${MAX_PHASES}`);
  }
  if (stage === 'ws') {
    const orders = new Set((state.lead.phases || []).map((_, i) => i + 1));
    (state.ws.workstreams || []).forEach(w => { if (!orders.has(w.phase_order)) v.push(`ws:${w.id}:unknown_phase_${w.phase_order}`); });
    // a stream that follows another but overlaps it must leave room for an interim handover (at least 2 weeks in)
    const pw = Object.fromEntries(phaseWeeks(state.lead.phases).map(p => [p.order, p]));
    const abs = w => { const so = Number(w.start_offset) || 0, du = Math.max(1, Number(w.duration) || 1), st = ((pw[w.phase_order] || {}).start_week || 1) + so; return { st, en: st + du - 1 }; };
    const byId = Object.fromEntries((state.ws.workstreams || []).map(w => [w.id, w]));
    (state.ws.workstreams || []).forEach(w => (w.follows || []).forEach(f => {
      const p = byId[f]; if (!p) return;
      const a = abs(w), b = abs(p);
      if (a.st <= b.en && a.st - b.st < 2) v.push(`ws:${w.id}:follows_${f}_but_starts_${a.st - b.st}_week_after_it`);
    }));
    v.push(...agentNotes('ws', state.ws));
  }
  if (stage === 'del') {
    const ids = new Set((state.ws.workstreams || []).map(w => w.id));
    (state.del.deliverables || []).forEach(d => { if (!ids.has(d.workstream_id)) v.push(`del:${d.id}:unknown_workstream_${d.workstream_id}`); });
    // every meeting after the kick-off needs something new to review: a deliverable due after the previous meeting
    const dues = r.plan.deliverables.map(d => d.due_week);
    let prevWk = 0;
    for (const m of state.calendar) {
      if (m.type === 'kickoff') continue;
      if (!dues.some(w => w > prevWk && w <= m.week)) v.push(`del:nothing_due_for_${m.id}_${m.type}_wk${m.week}_since_wk${prevWk}`);
      prevWk = m.week;
    }
    // a stream that follows another and starts before it ends needs an interim handover from it
    const wsP = Object.fromEntries(r.plan.workstreams.map(w => [w.id, w]));
    for (const w of r.plan.workstreams) for (const f of (w.follows || [])) {
      const pw = wsP[f];
      if (!pw || w.start_week > pw.end_week) continue;
      const handed = r.plan.deliverables.some(d => d.workstream_id === f && d.due_week < w.start_week);
      if (!handed) v.push(`del:${f}_hands_nothing_to_${w.id}_before_wk${w.start_week}`);
    }
    // spread: at most half of a phase's deliverables (or 2) fall due in its gate week
    for (const p of r.plan.phases) {
      const mine = r.plan.deliverables.filter(d => d.phase_order === p.order);
      const atGate = mine.filter(d => d.due_week === p.end_week).length;
      if (atGate > Math.max(2, Math.ceil(mine.length / 2))) v.push(`del:${p.name}:${atGate}_of_${mine.length}_due_in_gate_week_${p.end_week}`);
    }
    v.push(...agentNotes('del', state.del));
  }
  if (stage === 'gov') {
    const cal = new Set(state.calendar.map(m => m.id));
    const got = ((state.gov || {}).events || []).map(e => e.id);
    state.calendar.forEach(m => { if (!got.includes(m.id)) v.push(`gov:${m.id}:missing`); });
    got.forEach((id, i) => { if (!cal.has(id)) v.push(`gov:${id}:not_in_calendar`); if (got.indexOf(id) !== i) v.push(`gov:${id}:listed_twice`); });
    // the agent itself must show every deliverable at a workshop or gate on or after its due week
    // (the v2 validator repairs this silently; here the agent fixes it)
    const wk = Object.fromEntries(state.calendar.map(m => [m.id, m]));
    const dueOf = Object.fromEntries(r.plan.deliverables.map(d => [d.id, d.due_week]));
    for (const d of r.plan.deliverables) {
      const shown = ((state.gov || {}).events || []).some(e => wk[e.id] && (wk[e.id].type === 'gate' || wk[e.id].type === 'workshop') && (e.presents || []).includes(d.id) && wk[e.id].week >= dueOf[d.id]);
      if (!shown) v.push(`gov:${d.id}:not_shown_at_a_workshop_or_gate_from_wk${d.due_week}`);
    }
    // each meeting after the kick-off reviews everything that fell due since the previous one
    let prev = 0;
    for (const m of state.calendar) {
      if (m.type === 'kickoff') continue;
      const ev = ((state.gov || {}).events || []).find(e => e.id === m.id) || {};
      const fresh = r.plan.deliverables.filter(d => d.due_week > prev && d.due_week <= m.week).map(d => d.id);
      const missing = fresh.filter(id => !(ev.presents || []).includes(id));
      if (missing.length) v.push(`gov:${m.id}:does_not_present_${missing.join('_')}_due_since_wk${prev}`);
      prev = m.week;
    }
    v.push(...agentNotes('gov', state.gov));
  }
  return { violations: [...new Set(v)], calendar, repairs: r.repairs };
}

// Final plan: the v2 validator over the merged answer. Same plan format as today, so the renderer,
// Assemble drafts and the Summary Writer need no change.
function compile(state, ctx) {
  const arch = buildArch(state);
  const r = validatePlan(arch, vctx(state, ctx || {}));
  return { arch, plan: r.plan, violations: r.violations, repairs: r.repairs };
}

if (typeof module !== 'undefined') module.exports = { meetingCalendar, phaseWeeks, stageInput, renumberDeliverables, buildArch, checkStage, compile, MAX_PHASES, MAX_DEL_PER_WS };
