// --- _summary_values.js (shared; edit there, then run tools/build_n8n_code.py) ---
// Code-only slide and slide-4 values (extracted from _summary_checker.js by tools/build_n8n_code.py).
const fmtWeeks = d => d.min === d.max ? `${d.min} week${d.min === 1 ? '' : 's'}` : `${d.min}–${d.max} weeks`;

function buildFallback(input) {
  const P = input.plan, B = input.brief, L = input.limits;
  const fitIn = c => s => (s && s.length <= L[c].item_max_chars ? s : null);
  const cap = (arr, c) => arr.filter(fitIn(c)).slice(0, L[c].max);
  // Objectives: the client's own conditions, which are already written verb first; else a placeholder.
  const conds = B.success_criteria ? B.success_criteria.split(';').map(x => x.trim().replace(/\.$/, '')).filter(Boolean)
    .map(c => `${c.charAt(0).toUpperCase()}${c.slice(1)}.`) : [];
  let objectives = cap(conds, 'objectives');
  if (!objectives.length) objectives = ['[Firm to complete] The client\'s objectives.'];
  const client = B.client_name && B.client_name.length <= 30 ? B.client_name : 'the client';
  if (!P) return { title: `Summary of our proposal for ${client}`, objectives, solution: null, outcomes: null };
  const word = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][P.phases.length];
  const solution = [`The work will run ${fmtWeeks(P.total_duration_weeks)} in ${word} phases, ${P.sequencing === 'parallel' ? 'in parallel' : 'one after the other'}.`];
  P.phases.forEach(p => solution.push(`${p.name} (${fmtWeeks(p.duration_weeks)})`));
  const plain = s => s.replace(/\/\s*MVP\b|\bMVP\s*\//g, '').replace(/\bMVP\b/g, 'first version');
  const last = P.phases[P.phases.length - 1];
  const outcomes = cap(last.macro_deliverables.map(plain), 'outcomes');
  const t = `We propose ${word} phases over ${fmtWeeks(P.total_duration_weeks)} for ${client}`;
  return { title: t.length <= L.title_max_chars ? t : `Summary of our proposal for ${client}`, objectives, solution: cap(solution, 'solution'), outcomes };
}

function toValues(out, input) {
  const L = input.limits, values = { summary_title_01: out.title || '' };
  const PH = { solution: '[Firm to complete] The proposed approach and phases.', outcomes: '[Firm to complete] The expected results and deliverables.' };
  const texts = a => (a || []).map(x => (typeof x === 'string' ? x : x.text));
  const put = (prefix, col, list) => { for (let k = 1; k <= L[col].max; k++) values[`${prefix}_${String(k).padStart(2, '0')}`] = list[k - 1] || ''; };
  put('objective', 'objectives', texts(out.objectives));
  put('solution', 'solution', input.plan && out.solution && out.solution.length ? texts(out.solution) : [PH.solution]);
  put('outcome', 'outcomes', input.plan && out.outcomes && out.outcomes.length ? texts(out.outcomes) : [PH.outcomes]);
  return values;
}
// --- end _summary_values.js ---
// Final summary (Code, run once for each item). Input: Summary OK? (true branch): a checked answer from
// the first or the second attempt, or a second failure. Returns the copy results unchanged plus
// summary_values for slide 4. After two failures the slide is built by code (buildFallback), never a third call.
const P = $('Prepare summary').first().json;
const input = P.summary_input;
const c = $json || {};
const notes = [];
let out = null, source = c.attempt === 2 ? 'retry' : 'first';
if (c.ok && c.out) {
  out = c.out;
} else {
  notes.push(c.model_error
    ? `Summary slide: the Summary Writer was unavailable (${c.model_error}); built by code instead.`
    : `Summary slide: the Summary Writer failed twice (${(c.violations || []).slice(0, 5).map(x => x.where + ' ' + x.rule).join('; ')}); built by code instead.`);
  out = buildFallback(input);
  source = 'fallback';
}
const pass = P.pass || {};
return { json: { ...pass, summary_values: toValues(out, input), summary_source: source,
  warnings: [...(pass.warnings || []), ...notes] } };
