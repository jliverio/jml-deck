// Assemble drafts (Code, run once for each item). Input: Plan valid? (true branch: a compiled phase plan);
// the market findings are read from Assemble market.
// Maps every agent output to its template variable, using `fills_from` in the
// template_variables table. Produces:
//   values   final text that needs no copywriter (fixed text, source list)
//   items    drafts for the Copywriter: {variable, draft, max_chars, writing_rule}
//            max_chars here already leaves room for the " [n]" citation
//   refs     {variable: [source numbers]} added back after the Copywriter
//   sources  the renumbered source list (URLs kept for the record, not printed)
//   warnings plain-English notes for the run log
const rules = $('Template rules').first().json._rules || [];
const prof = ($('checkProfiler').first().json.output) || {};
const bo = ($('Brief Organizer').first().json.output) || {};
const market = $('Assemble market').first().json || {};
const planIn = ($json && $json.output) || {};
const plan = Array.isArray(planIn.phases) && planIn.phases.length ? planIn : null;

const sv = f => (f && f.value != null ? f.value : null);
const hf = bo.hard_fields || {};
const clientName = String(prof.client_name || sv(hf.client) || 'the client').split(',')[0].trim();
const problem = sv(hf.problem_statement) || '';
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
const fills = r => String(r.fills_from || '').trim();
const byVar = {};
rules.forEach(r => { byVar[r.variable] = r; });

const values = {};
const drafts = {};
const warnings = [];

// 1. Fixed text.
for (const r of rules) {
  if (fills(r).startsWith('fixed:')) values[r.variable] = fills(r).slice(6).replace(/\{client_name\}/g, clientName);
}

// 2. Market findings from both researchers, strongest first.
const RISK = { high: 0, medium: 1, none: 2 };
const cand = [];
(market.market_slides || []).forEach((ms, si) => {
  const srcByRef = {};
  (ms.sources || []).forEach(s => { srcByRef[s.ref] = s; });
  ((ms.slide || {}).rows || []).forEach((row, ri) => {
    if (row && row.action && String(row.action.text || '').trim()) cand.push({ row, si, ri, srcByRef });
  });
});
cand.sort((a, b) => ((RISK[a.row.scope_risk] ?? 3) - (RISK[b.row.scope_risk] ?? 3)) || a.ri - b.ri || a.si - b.si);

const slotNums = rules
  .filter(r => /^finding_\d+_headline$/.test(r.variable) && fills(r).startsWith('researcher:'))
  .map(r => r.variable.match(/^finding_(\d+)_/)[1])
  .sort();
const kept = cand.slice(0, slotNums.length);
if (cand.length > kept.length) {
  warnings.push(`${cand.length - kept.length} market finding(s) left out: the template holds ${slotNums.length}.`);
}

// 3. One source list for the slide, numbered in order of first citation.
const globalRef = new Map();
const sourceList = [];
const refOf = (c, local) => {
  const key = c.si + ':' + local;
  if (!globalRef.has(key)) {
    const s = c.srcByRef[local];
    if (!s) return null;
    sourceList.push(s);
    globalRef.set(key, sourceList.length);
  }
  return globalRef.get(key);
};
const varFor = (nn, field) => rules.find(r => r.variable.startsWith('finding_' + nn + '_') && fills(r) === 'researcher:' + field);

kept.forEach((c, k) => {
  const nn = slotNums[k];
  const head = varFor(nn, 'summary');
  if (head && String(c.row.summary || '').trim()) drafts[head.variable] = { draft: String(c.row.summary).trim(), refs: [] };
  for (const field of ['context', 'action', 'result']) {
    const r = varFor(nn, field);
    if (!r) continue;
    const part = c.row[field] || {};
    let text = String(part.text || '').trim();
    if (field === 'result' && /^not yet reported\.?$/i.test(text)) text = '';
    if (!text) continue;
    const refs = [...new Set((part.refs || []).map(l => refOf(c, l)).filter(Boolean))];
    drafts[r.variable] = { draft: text, refs };
  }
});

// 4. The source footer: built here, never by an AI, and never cut mid-source.
const srcRule = rules.find(r => fills(r) === 'researcher:sources');
if (srcRule && sourceList.length) {
  const mx = num(srcRule.max_chars) || 100000;
  const year = s => (String(s.source_date || '').match(/\d{4}/) || [''])[0];
  const fmt = level => sourceList.map((s, i) => {
    const parts = [String(s.source_name || '').trim()];
    if (level === 0 && s.source_title) parts.push(String(s.source_title).trim());
    if (level < 2 && year(s)) parts.push(year(s));
    return `[${i + 1}] ` + parts.filter(Boolean).join(', ');
  }).join('; ');
  let txt = fmt(0);
  if (txt.length > mx) txt = fmt(1);
  if (txt.length > mx) txt = fmt(2);
  if (txt.length > mx) warnings.push('The source list is longer than the footer; the renderer will drop the last sources.');
  values[srcRule.variable] = txt;
}

// 5. Context slide, Solution and Outcomes columns, drafted in code from the phase plan.
//    Only rows whose fills_from is phase_architect:* are filled. Rows still marked
//    pending:phase_architect are skipped: template 1.1 has no variables on that slide yet.
//    The Copywriter only shortens them; every name, week and decision comes from the plan.
const fromPlan = r => /^phase_architect:/.test(fills(r));
if (plan) {
  const slotsOf = prefix => rules.filter(r => fromPlan(r) && new RegExp('^' + prefix + '_\\d+$').test(r.variable))
    .map(r => r.variable).sort();
  const wk = d => (d.min === d.max ? `${d.max} weeks` : `${d.min}-${d.max} weeks`);
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  const lc = t => String(t || '').replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase()).replace(/\.$/, '');
  const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const tot = plan.total_duration_weeks || {};
  const totTxt = tot.min === tot.max ? `${tot.max}-week` : `${tot.min}- to ${tot.max}-week`;
  const n = plan.phases.length;
  const events = (plan.governance || {}).events || [];
  const steering = events.filter(e => e.type !== 'kickoff');
  const lastGate = steering.filter(e => e.type === 'gate').slice(-1)[0] || {};

  const sol = [];
  sol.push(`We will run a ${totTxt} project in ${words[n] || n} phase${n > 1 ? 's' : ''}: ${list(plan.phases.map(p => p.name))}.`);
  plan.phases.forEach(p => sol.push(`${p.name} (${wk(p.duration_weeks)}): ${lc(p.objective_one_line)}.`));
  const who = (lastGate.attendees || []).filter(a => a && !/^\[/.test(a));
  sol.push(`${steering.length} steering meetings${who.length ? ' with ' + list(who) : ''}, each phase closing on a decision.`);
  if (n === 1) {
    const ws = (plan.workstreams || []).map(w => w.name);
    if (ws.length) sol.push(`${words[ws.length] ? words[ws.length][0].toUpperCase() + words[ws.length].slice(1) : ws.length} workstreams: ${list(ws)}.`);
  }
  const cad = (plan.governance || {}).status_cadence_weeks;
  if (cad) sol.push(`Status meetings ${cad === 1 ? 'every week' : 'every ' + cad + ' weeks'} between steering meetings.`);
  const solSlots = slotsOf('solution');
  sol.slice(0, solSlots.length).forEach((t, i) => { drafts[solSlots[i]] = { draft: t, refs: [] }; });

  const RANK = { decision_pack: 0, build: 1, design: 2, analysis: 3, enablement: 4 };
  const outSlots = slotsOf('outcome');
  const dels = (plan.deliverables || []).slice()
    .sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || b.due_week - a.due_week)
    .slice(0, outSlots.length)
    .sort((a, b) => a.due_week - b.due_week);
  const evByLabel = Object.fromEntries(events.map(e => [e.label, e]));
  const usedDecision = new Set();
  dels.forEach((d, i) => {
    const e = evByLabel[d.presented_at] || {};
    // a decision is quoted once; later outcomes for the same meeting just name it
    const why = e.decision && !usedDecision.has(e.decision) ? `, for the decision: ${e.decision}`
      : (d.presented_at ? `, reviewed at the ${d.presented_at}` : '');
    if (e.decision) usedDecision.add(e.decision);
    drafts[outSlots[i]] = { draft: `${d.name}${why}`, refs: [] };
  });
  if (!solSlots.length || !outSlots.length) {
    const pending = rules.filter(r => /^pending:phase_architect/.test(fills(r))).length;
    warnings.push(pending
      ? `Context slide approach rows are still marked pending:phase_architect in template_variables (${pending} rows); the plan reaches the work-plan slides only.`
      : 'The template_variables table has no solution/outcome rows for the Phase Architect; the plan reaches the work-plan slides only.');
  }
  if ($json && Array.isArray($json.violations) && $json.violations.length) {
    warnings.push(`Phase plan kept with ${$json.violations.length} unresolved check(s): ${$json.violations.slice(0, 5).join('; ')}`);
  }
} else {
  const why = ($json && $json.agent_error) ? ` Phase Architect error: ${$json.agent_error}` : '';
  warnings.push('No phase plan reached the deck: the work-plan slides are left out.' + why);
}

// 6. The Copywriter's work list.
const suffix = refs => (refs.length ? ' [' + refs.join(', ') + ']' : '');
const items = Object.entries(drafts).map(([variable, d]) => {
  const r = byVar[variable] || {};
  const mx = num(r.max_chars);
  return { variable, draft: d.draft, max_chars: mx === null ? null : mx - suffix(d.refs).length, writing_rule: r.writing_rule || '' };
});

return {
  json: {
    client_name: clientName,
    problem_statement: problem,
    items,
    values,
    refs: Object.fromEntries(Object.entries(drafts).map(([k, d]) => [k, d.refs])),
    sources: sourceList.map((s, i) => ({ ref: i + 1, source_name: s.source_name, source_title: s.source_title, source_url: s.source_url, source_date: s.source_date })),
    workplan: plan ? { ...plan, client: clientName } : null,
    warnings,
  },
};
