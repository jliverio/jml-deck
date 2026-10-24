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
const FORMATS = require('../deliverable_formats.json');
const FORMAT_IDS = FORMATS.formats.map(f => f.id);

const MAX_PHASES = 5;
const MAX_DEL_PER_WS = 3;
const MAX_AGENT_NOTES = 2;      // workstream, deliverable and governance agents; the lead has up to 6
const NOTE_WORDS = 25;

function words(s) { return String(s || '').split(/\s+/).filter(Boolean).length; }
// Same rule as the validator: a term the firm's list qualifies with '(for outcomes)' hits only before an outcome noun.
const OUTCOME_NOUN = /^(growth|results?|value|outcomes?|performance|change|revenue|sales|savings|adoption|impact|improvements?|margins?|profit|efficiency|success|innovation|alignment|engagement)$/;
function jargonHit(s, term, list) {
  const t = String(s || '').toLowerCase();
  const qualified = (list || []).some(x => /\(for outcomes\)/i.test(String(x)) && String(x).replace(/\s*\(.*\)\s*/, '').trim().toLowerCase() === term);
  const toks = t.split(/[^a-z0-9]+/).filter(Boolean);
  if (qualified) return toks.some((w, i) => (w === term || w === term + 's') && OUTCOME_NOUN.test(toks[i + 1] || ''));
  return term.includes(' ') ? t.includes(term) : toks.includes(term);
}

// ---------- sizing: the lead's scoping step (sub-questions, drivers, work per phase) ----------
// A phase's estimate = fixed weeks + sum over pieces of ceil(count / at_once) x weeks_each (min and max apart).
function workEstimate(pw) {
  let mn = Number((pw || {}).fixed_weeks) || 0, mx = mn;
  for (const w of ((pw || {}).work || [])) {
    const k = Math.ceil((Number(w.count) || 1) / Math.max(1, Number(w.at_once) || 1));
    mn += k * (Number((w.weeks_each || {}).min) || 0);
    mx += k * (Number((w.weeks_each || {}).max) || 0);
  }
  return { min: mn, max: mx };
}
const norm = t => String(t || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
// the text a driver's evidence may be copied from: stated brief fields only, the profile, the findings
function sourceText(inp, source) {
  const out = [];
  const walk = o => { if (o == null) return; if (typeof o === 'string' || typeof o === 'number') out.push(String(o)); else if (Array.isArray(o)) o.forEach(walk); else if (typeof o === 'object') Object.values(o).forEach(walk); };
  if (source === 'brief') {
    const b = inp.brief || {};
    for (const grp of ['hard_fields', 'required', 'soft_fields']) for (const f of Object.values(b[grp] || {})) if (f && f.source === 'stated') { walk(f.value); walk(f.quote); }
    walk(inp.success_criteria_list);
  } else if (source === 'profile') walk(inp.profile);
  else if (source === 'findings') walk(inp.market_findings);
  return norm(out.join(' \n '));
}
function libraryUnits(inp, archetypeId) {
  const a = (inp.method_library || []).find(x => x.id === archetypeId);
  return [...((a && a.sizing_units) || []), ...(((inp.sizing_common || {}).units) || [])];
}
function expectedBasis(inp) {
  const el = (((inp.brief || {}).required || {}).engagement_length) || {};
  if (el.source === 'stated' && el.weeks_max != null) return 'stated';
  if (inp.weeks_available != null) return 'deadline';
  return 'estimated';
}
function checkSizing(state, ctx) {
  const inp = state.input, L = state.lead || {}, sz = L.sizing;
  if (!sz) return ['sizing:missing'];
  const v = [];
  const n = (L.phases || []).length;
  const sq = sz.sub_questions || [];
  if (sq.length < 3 || sq.length > 6) v.push(`sizing:sub_questions_${sq.length}_not_3_to_6`);
  sq.forEach((q, i) => {
    if (q.id !== 'Q' + (i + 1)) v.push(`sizing:sub_question_${i + 1}_id_${q.id}_should_be_Q${i + 1}`);
    if (!(q.phase_order >= 1 && q.phase_order <= n)) v.push(`sizing:${q.id}:unknown_phase_${q.phase_order}`);
    if (words(q.question) > 20) v.push(`sizing:${q.id}:over_20_words`);
    // sub-questions travel into workstream text, so the firm's banned words are checked here too
    for (const t of ((ctx || {}).jargon_never || []).map(x => String(x).replace(/\s*\(.*\)\s*/, '').trim().toLowerCase()).filter(Boolean))
      if (jargonHit(q.question, t, (ctx || {}).jargon_never)) v.push(`sizing:${q.id}:never_use_${t.replace(/\s+/g, '_')}`);
  });
  for (let o = 1; o <= n; o++) if (!sq.some(q => q.phase_order === o)) v.push(`sizing:phase_${o}_answers_no_sub_question`);
  const drv = {};
  for (const d of (sz.drivers || [])) {
    if (drv[d.key]) v.push(`sizing:driver_${d.key}_listed_twice`);
    drv[d.key] = d;
    if (!(Number(d.value) > 0)) v.push(`sizing:driver_${d.key}_value_${d.value}_not_positive`);
    const ev = String(d.evidence || '').trim();
    if (d.source === 'assumed') { if (ev) v.push(`sizing:driver_${d.key}_assumed_so_evidence_must_be_empty`); continue; }
    if (!ev) { v.push(`sizing:driver_${d.key}_no_evidence_from_${d.source}`); continue; }
    if (words(ev) > 15) v.push(`sizing:driver_${d.key}_evidence_over_15_words`);
    // a list field (stakeholders) may be quoted as 'A and B' or 'A, B': each part must be there
    const src = sourceText(inp, d.source);
    const parts = norm(ev).replace(/[\[\]"]/g, '').split(/,| and /).map(x => x.trim()).filter(Boolean);
    if (!src.includes(norm(ev)) && !(parts.length > 1 && parts.every(x => src.includes(x)))) v.push(`sizing:driver_${d.key}_evidence_not_found_word_for_word_in_${d.source === 'brief' ? 'stated_brief_fields' : d.source}`);
  }
  const lib = Object.fromEntries(libraryUnits(inp, (L.basis || {}).archetype_id).map(u => [norm(u.unit), u]));
  const pw = sz.phase_work || [];
  if (pw.length !== n) v.push(`sizing:phase_work_has_${pw.length}_entries_for_${n}_phases`);
  const planned = phaseWeeks(L.phases);
  pw.forEach((e, i) => {
    const tag = `sizing:phase_${e.phase_order}`;
    if (e.phase_order !== i + 1) v.push(`sizing:phase_work_${i + 1}_has_phase_order_${e.phase_order}`);
    (e.work || []).forEach((w, j) => {
      const t = `${tag}:work_${j + 1}`;
      const c = Number(w.count), a = Number(w.at_once), we = w.weeks_each || {};
      if (!(Number.isInteger(c) && c >= 1)) v.push(`${t}_count_${w.count}_not_a_whole_number`);
      if (!(Number.isInteger(a) && a >= 1 && a <= c)) v.push(`${t}_at_once_${w.at_once}_not_1_to_count_${w.count}`);
      if (!(we.min >= 1 && we.max >= we.min)) v.push(`${t}_weeks_each_${we.min}-${we.max}_invalid`);
      if (w.driver != null) {
        if (!drv[w.driver]) v.push(`${t}_driver_${w.driver}_not_in_drivers`);
        else if (c > Number(drv[w.driver].value)) v.push(`${t}_count_${c}_over_${w.driver}_${drv[w.driver].value}`);
      }
      if (w.from_library) {
        const u = lib[norm(w.unit)];
        if (!u) v.push(`${t}_marked_from_library_but_no_library_unit_reads_${JSON.stringify(String(w.unit).slice(0, 40))}`);
        else if (u.weeks_each[0] !== we.min || u.weeks_each[1] !== we.max || Math.min(u.at_once, c) !== a) v.push(`${t}_library_unit_is_${u.weeks_each[0]}-${u.weeks_each[1]}_weeks_${Math.min(u.at_once, c)}_at_once`);
      } else if (words(w.unit) > 12) v.push(`${t}_unit_over_12_words`);
    });
    if (!(Number.isInteger(Number(e.fixed_weeks)) && e.fixed_weeks >= 0)) v.push(`${tag}:fixed_weeks_${e.fixed_weeks}_invalid`);
    const est = workEstimate(e), ge = e.estimate || {};
    if (ge.min !== est.min || ge.max !== est.max) v.push(`${tag}:estimate_${ge.min}-${ge.max}_but_its_work_adds_to_${est.min}-${est.max}`);
    if (!String(e.why || '').trim()) v.push(`${tag}:no_why`);
    else if (words(e.why) > 25) v.push(`${tag}:why_over_25_words`);
    const ph = planned[e.phase_order - 1];
    if (ph && sz.length_basis === 'estimated' && (ph.duration_weeks.min < est.min || ph.duration_weeks.max > est.max))
      v.push(`${tag}:weeks_${ph.duration_weeks.min}-${ph.duration_weeks.max}_outside_its_estimate_${est.min}-${est.max}`);
  });
  const want = expectedBasis(inp);
  if (sz.length_basis !== want && sz.length_basis !== 'stage_lengths') v.push(`sizing:length_basis_${sz.length_basis}_should_be_${want}`);
  if (!String(sz.levers || '').trim()) v.push('sizing:no_levers');
  else if (words(sz.levers) > 25) v.push('sizing:levers_over_25_words');
  return v;
}
// What the partner and the reviewer see: per phase the work, the estimate, the archetype's reference and the plan.
function sizingSummary(state) {
  const inp = state.input, L = state.lead || {}, sz = L.sizing;
  if (!sz) return null;
  const arche = (inp.method_library || []).find(a => a.id === (L.basis || {}).archetype_id);
  const planned = phaseWeeks(L.phases);
  const phases = planned.map((p, i) => {
    const e = (sz.phase_work || [])[i] || {};
    const ref = arche && (arche.phases || []).find(x => x.name === p.name);
    return { order: p.order, name: p.name, planned_weeks: p.duration_weeks, estimate: workEstimate(e), archetype_weeks: ref ? { min: ref.typical_weeks[0], max: ref.typical_weeks[1] } : null,
      fixed_weeks: e.fixed_weeks, work: (e.work || []).map(w => ({ unit: w.unit, from_library: !!w.from_library, driver: w.driver, count: w.count, at_once: w.at_once, weeks_each: w.weeks_each })), why: e.why };
  });
  const sum = k => phases.reduce((a, p) => a + (p.estimate[k] || 0), 0);
  return { length_basis: sz.length_basis, sub_questions: sz.sub_questions || [], drivers: sz.drivers || [], phases,
    estimate_total: { min: sum('min'), max: sum('max') }, planned_total: { min: planned.reduce((a, p) => a + p.duration_weeks.min, 0), max: planned.reduce((a, p) => a + p.duration_weeks.max, 0) }, levers: sz.levers };
}
// Written by code, not the lead: when a stated length or deadline is shorter than the work counted.
function fitNote(state) {
  const s = sizingSummary(state);
  if (!s || !['stated', 'deadline', 'stage_lengths'].includes(s.length_basis)) return null;
  const have = s.planned_total.max, need = s.estimate_total;
  if (need.min > have) return `The work counted needs ${need.min}-${need.max} weeks, more than the ${have} planned: cut scope, run more at once, or extend.`;
  if (have < (need.min + need.max) / 2) return `The ${have} weeks planned sit in the lower half of what the work counted needs (${need.min}-${need.max} weeks): little slack.`;
  return null;
}

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
    return { ...pick(w, ['id', 'phase_order', 'name', 'question_id', 'answers', 'traces_to', 'start_offset', 'duration', 'follows', 'builds_on_meeting', 'activities']), weeks_in_phase: `${so + 1}-${so + du}`, start_week: p.start_week + so, end_week: p.start_week + so + du - 1 };
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
    sub_questions: ((state.lead.sizing || {}).sub_questions) || [],
    work_plan: (((state.lead.sizing || {}).phase_work) || []).map(e => ({ phase_order: e.phase_order, work: (e.work || []).map(w => pick(w, ['unit', 'count', 'at_once', 'weeks_each'])), why: e.why })),
    ...(state.review_feedback && state.review_feedback.ws ? { review_feedback: state.review_feedback.ws } : {}),
  };
  if (stage === 'del') return {
    brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type'], ['deliverable_format', 'success_criteria', 'out_of_scope']),
    success_criteria_list: inp.success_criteria_list || [],
    basis: state.lead.basis, archetype: arche, phases: phasesView(state.lead), workstreams: wsView(state), meetings,
    ...(state.review_feedback && state.review_feedback.del ? { review_feedback: state.review_feedback.del } : {}),
  };
  if (stage === 'gov') {
    const ph = Object.fromEntries(phaseWeeks(state.lead.phases).map(p => [p.order, p]));
    const wsv = wsView(state);
    const wsById = Object.fromEntries(wsv.map(w => [w.id, w]));
    return {
      brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type', 'stakeholders'], ['timeline', 'success_criteria']),
      phases: phasesView(state.lead),
      workstreams: wsv.map(w => pick(w, ['id', 'phase_order', 'name', 'start_week', 'end_week', 'builds_on_meeting'])),
      deliverables: ((state.del || {}).deliverables || []).map(d => ({ ...pick(d, ['id', 'workstream_id', 'name', 'kind', 'format', 'due_week_in_phase']), due_week: ((ph[(wsById[d.workstream_id] || {}).phase_order] || {}).start_week || 1) + (Number(d.due_week_in_phase) || 1) - 1 })),
      meetings: meetings.map(m => m.type === 'gate' ? { ...m, label: ((ph[m.phase_order] || {}).gate || {}).label, decision: ((ph[m.phase_order] || {}).gate || {}).decision } : m),
      ...(state.review_feedback && state.review_feedback.gov ? { review_feedback: state.review_feedback.gov } : {}),
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
    ...pick(w, ['id', 'phase_order', 'name', 'question_id', 'answers', 'traces_to', 'start_offset', 'duration', 'follows', 'builds_on_meeting', 'activities']),
    deliverables: delOut.filter(d => d.workstream_id === w.id).map(d => pick(d, ['id', 'name', 'kind', 'format', 'due_week_in_phase'])),
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
  const fit = fitNote(state);
  const notes = [...(fit ? [fit] : []), ...(lead.architect_notes || []), ...(((state.ws || {}).notes) || []), ...(((state.del || {}).notes) || []), ...(((state.gov || {}).notes) || [])];
  const total = phaseWeeks(phases).reduce((a, p) => a + p.duration_weeks.max, 0);
  return { basis: lead.basis || {}, phases, workstreams, governance: { status_cadence_weeks: total <= 8 ? 1 : 2, events }, architect_notes: notes.slice(0, 6), sizing: sizingSummary(state) };
}

function vctx(state, ctx) {
  const inp = state.input;
  return { brief: inp.brief, success_criteria_list: inp.success_criteria_list || [], jargon_never: ctx.jargon_never || [], weeks_available: inp.weeks_available, max_deliverables_per_ws: MAX_DEL_PER_WS, any_meeting_reviews: true };
}

const CALENDAR = /^gov:(gap_|kickoff_count|[^:]+:(gates_|workshops_|checkins_|workshop_outside|checkin_outside|workshops_under))/;
const STAGE = {
  lead: v => /^(plan:|basis:|note_|notes:|gate:|sizing:)/.test(v) || (/^phase:/.test(v) && !/:(no_workstreams|workstreams_\d+|idle_weeks_|nothing_runs_into_gate_week)/.test(v)),
  ws: v => (/^ws:/.test(v) && !/:deliverables_count_/.test(v)) || /^trace:/.test(v) || /^phase:[^:]+:(no_workstreams|workstreams_\d+|idle_weeks_|nothing_runs_into_gate_week)/.test(v),
  del: v => (/^del:/.test(v) && !/:never_presented$/.test(v)) || /^ws:[^:]+:deliverables_count_/.test(v),
  gov: v => (/^gov:/.test(v) && !CALENDAR.test(v)) || /^del:[^:]+:never_presented$/.test(v),
};

function agentNotes(stage, out, state) {
  const v = [];
  const n = (out || {}).notes || [];
  if (n.length > MAX_AGENT_NOTES) v.push(`notes:${stage}_${n.length}_over_${MAX_AGENT_NOTES}`);
  n.forEach((s, i) => { if (words(s) > NOTE_WORDS) v.push(`notes:${stage}_${i + 1}_over_${NOTE_WORDS}_words`); });
  if (state) noteNumbers(n, state).forEach(x => v.push(`notes:${stage}_${i1(x)}`));
  return v;
}
const i1 = x => x;
// Week ranges and week counts a note may quote: what the plan, its sizing, the archetype or the brief contains.
function planNumbers(state) {
  const inp = state.input, L = state.lead || {};
  const ranges = new Set(), singles = new Set();
  const add = (a, b) => { if (a == null || b == null) return; ranges.add(`${a}-${b}`); singles.add(a); singles.add(b); };
  const planned = phaseWeeks(L.phases);
  planned.forEach(p => add(p.duration_weeks.min, p.duration_weeks.max));
  add(planned.reduce((a, p) => a + p.duration_weeks.min, 0), planned.reduce((a, p) => a + p.duration_weeks.max, 0));
  const sz = sizingSummary(state);
  if (sz) {
    sz.phases.forEach(p => { add(p.estimate.min, p.estimate.max); if (p.archetype_weeks) add(p.archetype_weeks.min, p.archetype_weeks.max); singles.add(p.fixed_weeks);
      p.work.forEach(w => { add((w.weeks_each || {}).min, (w.weeks_each || {}).max); singles.add(w.count); }); });
    add(sz.estimate_total.min, sz.estimate_total.max);
  }
  (inp.method_library || []).forEach(a => (a.phases || []).forEach(p => add(p.typical_weeks[0], p.typical_weeks[1])));
  const el = (((inp.brief || {}).required || {}).engagement_length) || {};
  add(el.weeks_min, el.weeks_max);
  if (inp.weeks_available != null) singles.add(inp.weeks_available);
  planned.forEach(p => { singles.add(p.start_week); singles.add(p.end_week); });
  ((state.ws || {}).workstreams || []).forEach(w => { singles.add(Number(w.duration)); });
  (state.calendar || []).forEach(m => singles.add(m.week));
  return { ranges, singles };
}
function noteNumbers(notes, state) {
  const { ranges, singles } = planNumbers(state);
  const v = [];
  (notes || []).forEach((t, i) => {
    const s = String(t || '');
    const seen = new Set();
    for (const m of s.matchAll(/(\d+)\s*(?:-|–|to)\s*(\d+)[\s-]*weeks?/gi)) {
      seen.add(m.index);
      if (!ranges.has(`${m[1]}-${m[2]}`)) v.push(`${i + 1}_says_${m[1]}-${m[2]}_weeks_but_the_plan_has_no_such_range`);
    }
    for (const m of s.matchAll(/(\d+)[\s-]*weeks?\b/gi)) {
      const before = s.slice(Math.max(0, m.index - 6), m.index);
      if (/\d\s*(?:-|–|to)\s*$/i.test(before) || /(?:-|–|to)\s*$/.test(before.trim() ? before : '')) continue;
      if (!singles.has(Number(m[1]))) v.push(`${i + 1}_says_${m[1]}_weeks_but_the_plan_has_no_such_length`);
    }
  });
  return v;
}

// Violations for one stage only. `calendar` reports calendar errors, which are code bugs, never the agent's.
// Formats (José, Oct 19): what the client physically receives, allowed per kind; a format the brief names must appear,
// and the final phase's decision pack takes the medium the brief names.
// A medium the brief turns down ('a written report rather than slides', 'no deck') is not asked for (Oct 23: run 1381
// forced a presentation the client had declined): the words from a negation to the next punctuation are dropped first.
// A limit ('no more than 20 slides') is not a negation.
const NOT_ASKED = /\b(?:rather than|instead of|in place of|other than|not|no|without)\b(?!\s+(?:more|less|fewer|longer|shorter|later|earlier|over|under|above|below)\b)[^,;.]*/g;
function briefFormats(inp) {
  const f = ((((inp || {}).brief || {}).soft_fields || {}).deliverable_format) || {};
  if (f.source !== 'stated' || !f.value) return [];
  const t = norm(typeof f.value === 'string' ? f.value : JSON.stringify(f.value)).replace(NOT_ASKED, ' ');
  return FORMAT_IDS.filter(id => (FORMATS.brief_words[id] || []).some(w => new RegExp(`\\b${w}\\b`).test(t)));
}
function checkFormats(state, r) {
  const v = [];
  const dels = (state.del || {}).deliverables || [];
  for (const d of dels) {
    if (!d.format) { v.push(`del:${d.id}:no_format`); continue; }
    if (!FORMAT_IDS.includes(d.format)) { v.push(`del:${d.id}:format_${d.format}_unknown`); continue; }
    const ok = FORMATS.allowed_by_kind[d.kind] || [];
    if (!ok.includes(d.format)) v.push(`del:${d.id}:format_${d.format}_not_allowed_for_${d.kind}_use_${ok.join('_or_')}`);
  }
  const named = briefFormats(state.input);
  for (const f of named) if (!dels.some(d => d.format === f)) v.push(`del:brief_asks_for_${f}_but_no_deliverable_is_one`);
  const media = named.filter(f => f === 'presentation' || f === 'report');
  if (media.length && r.plan.phases.length) {
    const last = Math.max(...r.plan.phases.map(p => p.order));
    for (const d of r.plan.deliverables.filter(x => x.phase_order === last && x.kind === 'decision_pack')) {
      const raw = dels.find(x => x.id === d.id) || {};
      if (raw.format && !media.includes(raw.format)) v.push(`del:${d.id}:final_pack_is_${raw.format}_but_brief_asks_for_${media.join('_or_')}`);
    }
  }
  return v;
}
const L0 = state => state.lead || {};
function checkStage(stage, state, ctx) {
  ctx = ctx || {};
  const arch = buildArch(state);
  const r = validatePlan(arch, vctx(state, ctx));
  const v = r.violations.filter(STAGE[stage]);
  const calendar = stage === 'gov' ? r.violations.filter(x => CALENDAR.test(x)) : [];
  if (stage === 'lead') {
    const n = (state.lead.phases || []).length;
    if (n > MAX_PHASES) v.push(`phase:count_${n}_over_${MAX_PHASES}`);
    v.push(...checkSizing(state, ctx));
    noteNumbers(L0(state).architect_notes, state).forEach(x => v.push(`note_${x}`));
  }
  if (stage === 'ws') {
    const orders = new Set((state.lead.phases || []).map((_, i) => i + 1));
    (state.ws.workstreams || []).forEach(w => { if (!orders.has(w.phase_order)) v.push(`ws:${w.id}:unknown_phase_${w.phase_order}`); });
    // every sub-question of the lead gets at least one workstream in the phase that answers it
    const sq = ((state.lead.sizing || {}).sub_questions) || [];
    const qids = new Set(sq.map(q => q.id));
    (state.ws.workstreams || []).forEach(w => { if (w.question_id != null && !qids.has(w.question_id)) v.push(`ws:${w.id}:question_id_${w.question_id}_unknown`); });
    sq.forEach(q => { if (!(state.ws.workstreams || []).some(w => w.question_id === q.id && w.phase_order === q.phase_order)) v.push(`ws:no_workstream_answers_${q.id}_in_phase_${q.phase_order}`); });
    const mById = Object.fromEntries((state.calendar || []).map(m => [m.id, m]));
    (state.ws.workstreams || []).forEach(w => {
      if (w.builds_on_meeting == null) return;
      const m = mById[w.builds_on_meeting];
      if (!m || m.type === 'kickoff') { v.push(`ws:${w.id}:builds_on_meeting_${w.builds_on_meeting}_is_not_a_steering_meeting`); return; }
      const ph0 = phaseWeeks(state.lead.phases).find(p => p.order === w.phase_order) || { start_week: 1 };
      const st = ph0.start_week + (Number(w.start_offset) || 0);
      if (st <= m.week) v.push(`ws:${w.id}:builds_on_${m.id}_wk${m.week}_but_starts_wk${st}`);
    });
    // a stream that follows another but overlaps it must leave room for an interim handover (at least 2 weeks in)
    const pw = Object.fromEntries(phaseWeeks(state.lead.phases).map(p => [p.order, p]));
    const abs = w => { const so = Number(w.start_offset) || 0, du = Math.max(1, Number(w.duration) || 1), st = ((pw[w.phase_order] || {}).start_week || 1) + so; return { st, en: st + du - 1 }; };
    const byId = Object.fromEntries((state.ws.workstreams || []).map(w => [w.id, w]));
    (state.ws.workstreams || []).forEach(w => (w.follows || []).forEach(f => {
      const p = byId[f]; if (!p) return;
      const a = abs(w), b = abs(p);
      if (a.st <= b.en && a.st - b.st < 2) v.push(`ws:${w.id}:follows_${f}_but_starts_${a.st - b.st}_week_after_it`);
    }));
    v.push(...agentNotes('ws', state.ws, state));
  }
  if (stage === 'del') {
    const ids = new Set((state.ws.workstreams || []).map(w => w.id));
    (state.del.deliverables || []).forEach(d => { if (!ids.has(d.workstream_id)) v.push(`del:${d.id}:unknown_workstream_${d.workstream_id}`); });
    // every meeting after the kick-off needs something new to review: a deliverable due after the previous meeting
    const dues = r.plan.deliverables.map(d => d.due_week);
    let prevWk = 0;
    for (const m of state.calendar) {
      if (m.type === 'kickoff') continue;
      const can = m.type === 'checkin' ? r.plan.deliverables.filter(d => d.kind !== 'decision_pack').map(d => d.due_week) : dues;   // a check-in leaves packs to the next workshop or gate
      if (!can.some(w => w > prevWk && w <= m.week)) v.push(`del:nothing_due_for_${m.id}_${m.type}_wk${m.week}_since_wk${prevWk}`);
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
    // a decision pack sums up its phase: in an assessment phase it is due once the other streams that hand over
    // findings or a design have ended
    for (const d of r.plan.deliverables.filter(x => x.kind === 'decision_pack')) {
      const ph = r.plan.phases.find(p => p.order === d.phase_order);
      if (!ph || !['Diagnostic', 'Research', 'Design'].includes(ph.name)) continue;
      for (const w of r.plan.workstreams.filter(x => x.phase_order === d.phase_order && x.id !== d.workstream_id)) {
        const feeds = r.plan.deliverables.some(x => x.workstream_id === w.id && ['analysis', 'design'].includes(x.kind));
        if (feeds && w.end_week > d.due_week) v.push(`del:${d.id}:decision_pack_due_wk${d.due_week}_before_${w.id}_ends_wk${w.end_week}`);
      }
    }
    // spread: at most half of a phase's deliverables (or 2) fall due in its gate week
    for (const p of r.plan.phases) {
      const mine = r.plan.deliverables.filter(d => d.phase_order === p.order);
      const atGate = mine.filter(d => d.due_week === p.end_week).length;
      if (atGate > Math.max(2, Math.ceil(mine.length / 2))) v.push(`del:${p.name}:${atGate}_of_${mine.length}_due_in_gate_week_${p.end_week}`);
    }
    v.push(...checkFormats(state, r));
    v.push(...agentNotes('del', state.del, state));
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
      const decides = d.kind === 'decision_pack';     // designs may be chosen at a check-in (Oct 19: check-ins were left empty)
      const types = decides ? ['gate', 'workshop'] : ['gate', 'workshop', 'checkin'];
      const shown = ((state.gov || {}).events || []).some(e => wk[e.id] && types.includes(wk[e.id].type) && (e.presents || []).includes(d.id) && wk[e.id].week >= dueOf[d.id]);
      if (!shown) v.push(decides ? `gov:${d.id}:not_shown_at_a_workshop_or_gate_from_wk${d.due_week}` : `gov:${d.id}:not_shown_at_any_meeting_from_wk${d.due_week}`);
      // reviewed once: at the first meeting that can take it
      const at = ((state.gov || {}).events || []).filter(e => wk[e.id] && wk[e.id].type !== 'kickoff' && (e.presents || []).includes(d.id));
      if (at.length > 1) v.push(`gov:${d.id}:reviewed_at_${at.length}_meetings_${at.map(e => e.id).join('_')}`);
    }
    // a meeting a workstream builds on must take a decision
    for (const w of ((state.ws || {}).workstreams || [])) {
      if (w.builds_on_meeting == null) continue;
      const e = ((state.gov || {}).events || []).find(x => x.id === w.builds_on_meeting);
      const c = state.calendar.find(m => m.id === w.builds_on_meeting);
      if (c && c.type !== 'gate' && e && !String(e.decision || '').trim()) v.push(`gov:${w.builds_on_meeting}:${w.id}_builds_on_it_but_it_takes_no_decision`);
    }
    // each meeting after the kick-off reviews everything that fell due since the previous one
    let prev = 0;
    for (const m of state.calendar) {
      if (m.type === 'kickoff') continue;
      const ev = ((state.gov || {}).events || []).find(e => e.id === m.id) || {};
      const fresh = r.plan.deliverables.filter(d => d.due_week > prev && d.due_week <= m.week && !(m.type === 'checkin' && d.kind === 'decision_pack')).map(d => d.id);
      if (!(ev.presents || []).length) v.push(`gov:${m.id}:${m.type}_wk${m.week}_reviews_nothing`);
      const missing = fresh.filter(id => !(ev.presents || []).includes(id));
      if (missing.length) v.push(`gov:${m.id}:does_not_present_${missing.join('_')}_due_since_wk${prev}`);
      prev = m.week;
    }
    v.push(...agentNotes('gov', state.gov, state));
  }
  return { violations: [...new Set(v)], calendar, repairs: r.repairs };
}

// Final plan: the v2 validator over the merged answer. Same plan format as today, so the renderer,
// Assemble drafts and the Summary Writer need no change.
function compile(state, ctx) {
  const arch = buildArch(state);
  const r = validatePlan(arch, vctx(state, ctx || {}));
  if (r.plan && arch.sizing) r.plan.sizing = arch.sizing;
  return { arch, plan: r.plan, violations: r.violations, repairs: r.repairs };
}

// ---------- the Plan Reviewer (fifth agent) ----------
const REVIEW_OWNER = { lead: 'lead', workstreams: 'ws', deliverables: 'del', governance: 'gov' };
function reviewInput(state) {
  const inp = state.input, brief = inp.brief || {};
  const c = compile(state);
  const p = c.plan;
  const qid = Object.fromEntries((((state.ws || {}).workstreams) || []).map(w => [w.id, w.question_id == null ? null : w.question_id]));
  const sz = sizingSummary(state);
  return {
    brief: briefSubset(brief, ['client', 'problem_statement'], ['engagement_type', 'engagement_length', 'stakeholders'], ['timeline', 'success_criteria', 'out_of_scope', 'deliverable_format', 'workstreams']),
    success_criteria_list: inp.success_criteria_list || [],
    profile_current_state: (inp.profile || {}).current_state || null,
    sizing: sz && { governing_question: ((state.lead || {}).basis || {}).governing_question, archetype_id: ((state.lead || {}).basis || {}).archetype_id, ...sz },
    plan: {
      phases: p.phases.map(x => ({ order: x.order, name: x.name, weeks: `${x.start_week}-${x.end_week}`, objective: x.objective_one_line, gate: x.gate })),
      workstreams: p.workstreams.map(w => ({ id: w.id, phase: w.phase_order, name: w.name, question_id: qid[w.id] === undefined ? null : qid[w.id], answers: w.answers, weeks: `${w.start_week}-${w.end_week}`, follows: w.follows, activities: w.activities })),
      deliverables: p.deliverables.map(d => ({ id: d.id, workstream: d.workstream_id, name: d.name, format: d.format, due_week: d.due_week })),
      meetings: p.governance.events.map(e => ({ id: e.id, type: e.type, week: e.week, label: e.label, purpose: e.purpose, attendees: e.attendees, presents: e.presents, decision: e.decision, agenda: e.agenda })),
      notes: [].concat(p.architect_notes || []),
    },
  };
}
function checkReview(review) {
  const v = [];
  const is = (review || {}).issues || [];
  if (is.length > 5) v.push(`review:issues_${is.length}_over_5`);
  if (review.verdict === 'send' && is.length) v.push('review:verdict_send_but_issues_listed');
  if (review.verdict === 'revise' && !is.length) v.push('review:verdict_revise_but_no_issues');
  is.forEach((x, i) => {
    if (!REVIEW_OWNER[x.owner]) v.push(`review:issue_${i + 1}_owner_${x.owner}_invalid`);
    // the issues are internal text for the agents, so length is only a hard limit well past the prompt's 30 words
    if (words(x.problem) > 45) v.push(`review:issue_${i + 1}_problem_over_45_words`);
    if (words(x.fix) > 45) v.push(`review:issue_${i + 1}_fix_over_45_words`);
  });
  return v;
}
// One revision round: the earliest owner reruns with its issues as violations (keeping its previous answer);
// every later agent reruns fresh, with its own issues as review_feedback.
// mode 'local' (default, after the Oct 18 test): issues owned by the lead (sizing, phases, gates) are not sent back;
// they go to the partner as `for_partner`, because rerunning the lead reruns every agent after it and the blind
// reviewer preferred the unrevised plan in most of those cases. mode 'full' sends every issue back (as tested).
function routeReview(review, mode) {
  mode = mode || 'local';
  const is = ((review || {}).issues) || [];
  if ((review || {}).verdict !== 'revise' || !is.length) return null;
  const order = ['lead', 'ws', 'del', 'gov'];
  const feedback = {}, forPartner = [];
  for (const x of is) {
    const st = REVIEW_OWNER[x.owner]; if (!st) continue;
    if (mode === 'local' && st === 'lead') { forPartner.push(`${x.target}: ${x.problem} Suggested: ${x.fix}`); continue; }
    (feedback[st] = feedback[st] || []).push(`review: ${x.target}: ${x.problem} Fix: ${x.fix}`);
  }
  const from = order.find(st => feedback[st]);
  return { from: from || null, feedback, for_partner: forPartner };
}

if (typeof module !== 'undefined') module.exports = { meetingCalendar, phaseWeeks, stageInput, renumberDeliverables, buildArch, checkStage, compile, workEstimate, checkSizing, sizingSummary, fitNote, reviewInput, checkReview, routeReview, MAX_PHASES, MAX_DEL_PER_WS };
