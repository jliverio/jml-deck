// Check summary (n8n Code node after the Summary Writer). Pure functions; no network.
// checkSummary(out, input) -> { ok, violations[], warnings[] }
// buildFallback(input)     -> a slide built by code alone, used after the retry fails
// toRenderSlide(out, input) -> the object the deck builder receives for slide 4

const STOP = new Set(('a an the and or of to in on for with by at from as is are be been being will would can could may ' +
  'it its this that these those their there they them we our us you your he she his her which who whom what when where ' +
  'how than then so such into onto over under about after before while without within not no nor all each both any ' +
  'one two three four five six seven eight nine ten first last also only more most other some own same very just ' +
  'has have had do does did doing per via up out off s').split(' '));
// Words a summary may add around copied text: framing verbs for objectives, connecting words for outcomes,
// and the plain-word replacements for never_use words.
const OBJ_FRAME = new Set('wants want wish wishes aim aims ambition objective objectives goal goals needs need asks ask seeks seek looking important must should keep make sure ensure is are'.split(' '));
const OUT_GLUE = new Set('including include includes incl set package together across covering covers plus final first version use lessons detailed review change'.split(' '));
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

const FIRM_CLAIM = /\b(proven|experienced|expertise|expert team|track record|tried[- ]and[- ]tested|world[- ]class|best[- ]in[- ]class|unique|renowned|leading|award|our (method|methodology|approach|team|experience)|methodology)\b/i;
const PROMISE = /\b(guarantee[sd]?|ensures?|ensuring|de-?risk(ed|s)?|product[- ]market fit|successful(ly)?|succeed|will deliver value|ready for (wider |broader )?roll-?out|increase[sd]? revenue|savings|return on investment|roi|market share)\b/i;
const EVALUATIVE = /\b(clear|clearly|complete|comprehensive|robust|validated|full|strong|credible|powerful|effective|optimal|seamless|significant|tailored|actionable|scalable|best|ready)\b/ig;
const CAVEAT = /(\?|\bconfirm\b|\bestimate[sd]?\b|\bassum(e|ed|ption)\b|\[firm|\btbd\b|\bplaceholder\b)/i;
const FORMAT = /(\n|\r|\*\*|^\s*[-•·▪]\s|https?:\/\/|www\.)/;
const UK = /\b(organisation|organisations|programme|programmes|analyse|analysed|centre|centres|modelling|behaviour|colour|favour|labour|prioritise|optimise|utilise|recognise|realise|cognisant)\b/i;

const norm = s => String(s || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').toLowerCase();
const stem = w => w.length > 5 ? w.replace(/(ings|ing|ed|es|s)$/, '') : w.replace(/s$/, '');
const tokens = s => (norm(s).match(/[a-z0-9]+/g) || []);
const content = s => tokens(s).filter(w => !STOP.has(w) && !/^\d+$/.test(w));
const numbers = s => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []);
const fmtWeeks = d => d.min === d.max ? `${d.min} week${d.min === 1 ? '' : 's'}` : `${d.min}–${d.max} weeks`;
const hasWord = (text, term) => new RegExp(`(^|[^a-z])${norm(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ \(.*\)$/, '')}([^a-z]|$)`, 'i').test(norm(text));

function overlap(text, sourceText, extraAllowed) {
  const src = new Set(content(sourceText).map(stem));
  const ws = content(text).filter(w => !(extraAllowed && extraAllowed.has(w)));
  if (!ws.length) return { share: 1, missing: [] };
  const missing = ws.filter(w => !src.has(stem(w)));
  return { share: 1 - missing.length / ws.length, missing };
}

function checkSummary(out, input) {
  const V = [], W = [];
  const v = (where, rule, detail) => V.push({ where, rule, detail });
  const w = (where, rule, detail) => W.push({ where, rule, detail });
  const L = input.limits, B = input.brief, P = input.plan, H = input.house_style;
  const neverUse = (H.never_use || []).map(t => t.replace(/ \(.*\)$/, ''));
  const protectedText = (H.protected_terms || []).join(' \n ');
  const clientWords = new Set(content(B.client_name));

  if (!out || typeof out !== 'object') return { ok: false, violations: [{ where: 'output', rule: 'not_an_object', detail: '' }], warnings: [] };
  const cols = { objectives: out.objectives || [], solution: out.solution || [], outcomes: out.outcomes || [] };

  // ---- structure and counts
  for (const c of ['objectives', 'solution', 'outcomes']) {
    const n = cols[c].length;
    if (c !== 'objectives' && !P) { if (n) v(c, 'must_be_empty_without_plan', `${n} items`); continue; }
    if (n < L[c].min || n > L[c].max) v(c, 'item_count', `${n} items, allowed ${L[c].min}–${L[c].max}`);
  }

  // ---- limits and formatting, every string
  const strings = [['title', out.title || '']];
  for (const c of Object.keys(cols)) cols[c].forEach((it, i) => strings.push([`${c}[${i}]`, it.text || '']));
  if ((out.title || '').length > L.title_max_chars) v('title', 'over_limit', `${out.title.length} > ${L.title_max_chars}`);
  for (const c of Object.keys(cols)) {
    let sum = 0;
    const mx = L[c].item_max_chars;
    cols[c].forEach((it, i) => {
      const len = (it.text || '').length; sum += len;
      if (mx && len > mx) v(`${c}[${i}]`, 'over_limit', `${len} > ${mx}`);
    });
    if (L[c].column_max_chars && sum > L[c].column_max_chars) v(c, 'column_over_limit', `${sum} > ${L[c].column_max_chars}`);
  }
  for (const [where, s] of strings) {
    if (FORMAT.test(s)) v(where, 'format', 'line break, markdown, bullet character or URL');
    if (/\{\{|\}\}/.test(s)) v(where, 'format', 'template braces');
    if (CAVEAT.test(s)) v(where, 'caveat_or_question', s.match(CAVEAT)[0]);
    if (/\d+\s?-\s?\d+\s*(weeks|months)/i.test(s)) v(where, 'range_needs_en_dash', s.match(/\d+\s?-\s?\d+/)[0]);
    for (const m of s.replace(/Change & Training/g, '').matchAll(/\s&\s|\b[A-Za-z]{2,}(?:\/[A-Za-z]{2,})+\b/g))
      if (!protectedText.includes(m[0].trim())) v(where, 'shorthand', m[0].trim());
    if (/\byou(r|rs)?\b/i.test(s)) v(where, 'you_on_slide', '');
    if (UK.test(s) && !hasWord(protectedText, s.match(UK)[0])) w(where, 'non_us_spelling', s.match(UK)[0]);
    for (const m of s.matchAll(new RegExp(FIRM_CLAIM.source, 'ig')))
      if (!(where.startsWith('objectives') && hasWord(protectedText, m[0]))) v(where, 'firm_claim', m[0]);
    if (!where.startsWith('objectives')) {
      const pr = s.match(PROMISE);
      if (pr) v(where, 'promise', pr[0]);
      for (const t of neverUse) if (hasWord(s, t)) v(where, 'never_use', t);
    } else {
      for (const t of neverUse) if (hasWord(s, t) && !hasWord(protectedText, t)) v(where, 'never_use_not_client_words', t);
    }
  }

  // ---- end punctuation: sentences end with a period, noun phrases take none
  cols.objectives.forEach((it, i) => { if (!/[.]$/.test(it.text.trim())) v(`objectives[${i}]`, 'no_final_period', ''); });
  cols.solution.forEach((it, i) => { if (!/[.]$/.test(it.text.trim())) v(`solution[${i}]`, 'no_final_period', ''); });
  cols.outcomes.forEach((it, i) => { if (/[.]$/.test(it.text.trim())) v(`outcomes[${i}]`, 'final_period_on_noun_phrase', ''); });

  // ---- numbers the slide may carry
  const planNums = new Set();
  if (P) {
    P.phases.forEach(p => { planNums.add(String(p.duration_weeks.min)); planNums.add(String(p.duration_weeks.max)); numbers(p.objective_one_line).forEach(n => planNums.add(n)); });
    planNums.add(String(P.total_duration_weeks.min)); planNums.add(String(P.total_duration_weeks.max));
  }
  const briefNums = new Set(numbers([B.problem_statement, B.success_criteria, B.brief_narrative].join(' ')));

  // ---- title
  const t = out.title || '';
  if (/[.]\s*$/.test(t)) v('title', 'final_period', '');
  if (tokens(t).length < 5) w('title', 'too_short_for_a_sentence', t);
  for (const n of numbers(t)) if (!planNums.has(n) && !briefNums.has(n)) v('title', 'number_not_in_inputs', n);
  if (P && !numbers(t).some(n => n === String(P.total_duration_weeks.max) || n === String(P.total_duration_weeks.min)) &&
      !new RegExp(`\\b(${COUNT_WORDS.join('|')})\\b`, 'i').test(t)) w('title', 'no_duration_or_phase_count', t);
  if (!clientWords.size || ![...clientWords].some(cw => tokens(t).includes(cw))) w('title', 'client_not_named', t);

  // ---- objectives
  const srcText = { problem_statement: B.problem_statement, success_criteria: B.success_criteria, brief_narrative: B.brief_narrative };
  cols.objectives.forEach((it, i) => {
    const s = srcText[it.source];
    if (!s) { v(`objectives[${i}]`, 'source_not_stated', it.source); return; }
    const allowed = new Set([...OBJ_FRAME, ...clientWords]);
    const o = overlap(it.text, s, allowed);
    if (o.share < 0.75) v(`objectives[${i}]`, 'not_in_source', `${Math.round(o.share * 100)}% of words found in ${it.source}; new: ${o.missing.join(', ')}`);
    else if (o.missing.length) w(`objectives[${i}]`, 'new_words', o.missing.join(', '));
    for (const n of numbers(it.text)) if (!numbers(s).includes(n)) v(`objectives[${i}]`, 'number_not_in_source', n);
    if (/^\S+(\s+\S+)?\s+(is|are|was|were|has|have|had)\b/i.test(it.text))
      v(`objectives[${i}]`, 'objective_is_background', 'a statement of fact, not a goal: ' + it.text.slice(0, 60));
  });
  // Objectives are goals written verb first: never the client, a pronoun or "The aim is" as subject.
  const BAD_START = new Set(['the', 'it', 'its', 'they', 'their', 'you', 'we', 'our', 'a', 'an', 'this', 'these', 'there']);
  cols.objectives.forEach((it, i) => {
    const first = (norm(it.text).match(/[a-z0-9\[\]]+/) || [''])[0].replace(/[\[\]]/g, '');
    if (BAD_START.has(first) || clientWords.has(first) || /^\[/.test(it.text.trim()))
      v(`objectives[${i}]`, 'objective_frame', 'opens with "' + it.text.split(' ')[0] + '"');
  });
  if (cols.objectives.length && cols.objectives[0].source !== 'problem_statement') w('objectives[0]', 'first_item_not_problem', cols.objectives[0].source);
  if (B.success_criteria) {
    const scText = cols.objectives.filter(o => o.source === 'success_criteria').map(o => o.text).join(' ');
    B.success_criteria.split(';').map(x => x.trim()).filter(Boolean).forEach((cond, k) => {
      const cw = content(cond);
      const got = new Set(content(scText).map(stem));
      const share = cw.filter(x => got.has(stem(x))).length / (cw.length || 1);
      if (share < 0.5) v('objectives', 'condition_dropped', `condition ${k + 1}: "${cond}"`);
    });
  }

  // ---- solution
  if (P && cols.solution.length) {
    const sol = cols.solution;
    if (sol[0].kind !== 'overview') v('solution[0]', 'overview_not_first', sol[0].kind);
    const overviews = sol.filter(x => x.kind === 'overview');
    if (overviews.length !== 1) v('solution', 'overview_count', overviews.length);
    const ov = overviews[0] ? overviews[0].text : '';
    if (ov && !norm(ov).includes(norm(fmtWeeks(P.total_duration_weeks)).replace(' weeks', '')))
      v('solution[overview]', 'total_duration_missing', `expected ${fmtWeeks(P.total_duration_weeks)}`);
    const nWord = COUNT_WORDS[P.phases.length];
    if (ov && !new RegExp(`\\b${nWord}\\b`, 'i').test(ov)) v('solution[overview]', 'phase_count_missing', `expected "${nWord}"`);
    if (ov && P.sequencing === 'parallel' && !/parallel|at the same time|concurrent/i.test(ov)) v('solution[overview]', 'sequencing_missing', 'parallel');
    if (ov && P.sequencing === 'sequential' && /parallel|concurrent/i.test(ov)) v('solution[overview]', 'sequencing_wrong', 'says parallel');
    const covered = [];
    sol.forEach((it, i) => {
      if (it.kind === 'phase') {
        if (!it.phases || !it.phases.length) v(`solution[${i}]`, 'phase_item_without_phase', '');
        (it.phases || []).forEach(o => {
          const p = P.phases.find(x => x.order === o);
          if (!p) { v(`solution[${i}]`, 'unknown_phase', o); return; }
          covered.push(o);
          if (!it.text.includes(p.name)) v(`solution[${i}]`, 'phase_name_missing', p.name);
          if (!it.text.includes(fmtWeeks(p.duration_weeks))) v(`solution[${i}]`, 'phase_duration_missing', `${p.name}: ${fmtWeeks(p.duration_weeks)}`);
        });
        const objs = (it.phases || []).map(o => (P.phases.find(x => x.order === o) || {}).objective_one_line || '').join(' ');
        const names = new Set((it.phases || []).flatMap(o => content((P.phases.find(x => x.order === o) || {}).name || '')));
        const o = overlap(it.text, objs, new Set([...names, 'week', 'weeks', ...clientWords]));
        if (o.share < 0.75) v(`solution[${i}]`, 'objective_not_from_plan', `new: ${o.missing.join(', ')}`);
        // Activities: the head word of each clause and every one-word item of a list in the objective must survive.
        const have = new Set(content(it.text).map(stem));
        const heads = [], listed = [];
        objs.split(/;|\.\s/).forEach(cl => { const h = content(cl)[0]; if (h) heads.push(h); });
        for (const m of objs.matchAll(/\b([A-Za-z-]+)((?:, [A-Za-z-]+)+),? (?:and|or) ([A-Za-z-]+)\b/g))
          [m[1], ...m[2].split(', ').filter(Boolean), m[3]].forEach(x => { if (!STOP.has(x.toLowerCase())) listed.push(x.toLowerCase()); });
        const lostHeads = [...new Set(heads)].filter(x => !have.has(stem(x)));
        const lostListed = [...new Set(listed)].filter(x => !have.has(stem(x)) && !lostHeads.includes(x));
        if (lostHeads.length) v(`solution[${i}]`, 'phase_activity_dropped', lostHeads.join(', '));
        if (lostListed.length) w(`solution[${i}]`, 'phase_list_item_dropped', lostListed.join(', '));
      } else if (it.kind === 'scope') {
        if (i !== sol.length - 1) v(`solution[${i}]`, 'scope_not_last', '');
        const srcS = [B.out_of_scope, ...(P.scope_notes || [])].filter(Boolean).join(' ');
        if (!srcS) v(`solution[${i}]`, 'scope_without_source', it.text);
        else {
          const o = overlap(it.text, srcS, new Set([...clientWords, 'work', 'phases', 'phase', 'plan', 'proposal', 'outside', 'stay', 'stays', 'beyond', 'excluded', 'part', 'included', 'covered']));
          if (o.share < 0.6) v(`solution[${i}]`, 'scope_not_from_source', `new: ${o.missing.join(', ')}`);
        }
      }
      for (const n of numbers(it.text)) if (!planNums.has(n)) v(`solution[${i}]`, 'number_not_in_plan', n);
    });
    const want = P.phases.map(p => p.order).sort((a, b) => a - b).join(',');
    if (covered.join(',') !== want) v('solution', 'phases_not_covered_once_in_order', `got ${covered.join(',')}, want ${want}`);
    if (sol.filter(x => x.kind === 'scope').length > 1) v('solution', 'more_than_one_scope_item', '');
  }

  // ---- outcomes
  if (P && cols.outcomes.length) {
    const lastOrder = Math.max(...P.phases.map(p => p.order));
    let citesLast = false;
    cols.outcomes.forEach((it, i) => {
      const cited = [];
      for (const r of it.from || []) {
        const p = P.phases.find(x => x.order === r.phase_order);
        const d = p && p.macro_deliverables[r.deliverable - 1];
        if (!d) { v(`outcomes[${i}]`, 'unknown_deliverable', `${r.phase_order}.${r.deliverable}`); continue; }
        cited.push(d); if (r.phase_order === lastOrder) citesLast = true;
      }
      if (!cited.length) return;
      const src = cited.join(' ') + ' ' + (B.deliverable_format || '');
      const allowed = new Set([...OUT_GLUE, ...clientWords, ...content(P.phases.map(p => p.name).join(' '))]);
      const o = overlap(it.text, src, allowed);
      if (o.missing.length > 1) v(`outcomes[${i}]`, 'words_not_in_cited_deliverables', o.missing.join(', '));
      else if (o.missing.length === 1) w(`outcomes[${i}]`, 'one_new_word', o.missing[0]);
      const ev = (it.text.match(EVALUATIVE) || []).filter(x => !hasWord(src, x));
      if (ev.length) v(`outcomes[${i}]`, 'evaluative_word', ev.join(', '));
      for (const n of numbers(it.text)) if (!numbers(src).includes(n)) v(`outcomes[${i}]`, 'number_not_in_deliverables', n);
      if (/^(the |a |an )?(alignment|clarity|confidence|understanding|buy-in|consensus)\b/i.test(it.text)) v(`outcomes[${i}]`, 'state_not_thing', it.text.split(' ').slice(0, 3).join(' '));
    });
    if (!citesLast) w('outcomes', 'last_phase_not_cited', `phase ${lastOrder}`);
  }

  return { ok: V.length === 0, violations: V, warnings: W };
}

// Code-only slide: used when the retry also fails. Exact and plain; never better than the agent, never wrong.
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

// The template variables for slide 4 (template 1.2): summary_title_01, objective_NN, solution_NN, outcome_NN.
// Unused lines are sent empty: the table's if_empty (hide_line) removes them. With no plan, line 01 of
// Solution and Outcomes carries the placeholder and the other lines are empty.
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

function toRenderSlide(out, input) {
  const PH = { solution: '[Firm to complete] The proposed approach and phases.', outcomes: '[Firm to complete] The expected results and deliverables.' };
  const texts = a => (a || []).map(x => (typeof x === 'string' ? x : x.text));
  return {
    slide_id: 'proposal_summary',
    title: out.title,
    objectives: texts(out.objectives),
    solution: input.plan && out.solution && out.solution.length ? texts(out.solution) : [PH.solution],
    outcomes: input.plan && out.outcomes && out.outcomes.length ? texts(out.outcomes) : [PH.outcomes]
  };
}


// Retry message for the second Summary Writer call: plain words for each broken rule.
const RULE_TEXT = {
  over_limit: 'this string is longer than its limit; shorten it by leaving words out',
  column_over_limit: 'the items of this column together are too long for the box',
  item_count: 'wrong number of items in this column',
  must_be_empty_without_plan: 'plan is null, so this column must be an empty array',
  firm_claim: 'a claim about the firm; remove it',
  promise: 'a promised result; remove it',
  never_use: 'a word from never_use; replace it with the plain word',
  never_use_not_client_words: 'a never_use word that the client did not use; replace it',
  caveat_or_question: 'a question, request to confirm, estimate caveat or placeholder; remove it',
  range_needs_en_dash: 'write the range with an en dash (8–9 weeks)',
  you_on_slide: 'never write "you" on this slide',
  not_in_source: 'this objective uses words that are not in its source field; keep the client\'s words',
  number_not_in_source: 'a number that is not in the source field',
  objective_is_background: 'a statement of fact, not a goal; remove it or write the goal it points to, verb first',
  objective_frame: 'write the objective as a goal, verb first, with no subject (not the client, "It", "They", "You", "We" or "The aim is")',
  condition_dropped: 'a condition in success_criteria is missing; add it, merged with a related one if needed',
  overview_not_first: 'the overview item must come first', overview_count: 'exactly one overview item',
  total_duration_missing: 'the overview must state the total duration as given', phase_count_missing: 'the overview must state the number of phases as a word',
  sequencing_missing: 'the overview must say the phases run in parallel', sequencing_wrong: 'the phases run one after the other',
  phase_name_missing: 'this phase item must carry the phase name', phase_duration_missing: 'this phase item must carry the phase duration as given',
  objective_not_from_plan: 'this phase line uses words that are not in the phase objective',
  phase_activity_dropped: 'this phase line dropped or replaced an activity of the phase objective (the listed verbs); keep each one and shorten their objects instead',
  phases_not_covered_once_in_order: 'every phase must appear in exactly one phase item, in order',
  scope_without_source: 'a scope item needs out_of_scope or scope_notes; remove it', scope_not_from_source: 'the scope item must be taken from out_of_scope or scope_notes', scope_not_last: 'the scope item goes last',
  unknown_deliverable: 'from cites a deliverable that does not exist', words_not_in_cited_deliverables: 'this outcome uses words that are not in the deliverables it cites',
  evaluative_word: 'an evaluative word that is not in the cited deliverables; remove it', number_not_in_deliverables: 'a number that is not in the cited deliverables',
  state_not_thing: 'name a thing the client receives, not a state', no_final_period: 'end this item with a period', final_period_on_noun_phrase: 'an outcome is a noun phrase: no final period',
  final_period: 'no final period in the title', shorthand: 'write "and" in full; no "&" and no slash between words', source_not_stated: 'this objective cites a source field that is null', phase_item_without_phase: 'a phase item must list its phase order in phases', unknown_phase: 'phases lists an order that does not exist', more_than_one_scope_item: 'at most one scope item', number_not_in_inputs: 'a number that is not in the inputs', number_not_in_plan: 'a number that is not in the plan', format: 'plain text only: no line breaks, markdown, bullets or URLs'
};
function retryMessage(violations, previous) {
  const lines = violations.map(x => `- ${x.where}: ${RULE_TEXT[x.rule] || x.rule}${x.detail ? ` (${x.detail})` : ''}`);
  return `Your previous answer broke these rules. Return the whole JSON object again. Change only what is needed to fix them, and keep every other item as it was.\n${lines.join('\n')}\nYour previous answer:\n${JSON.stringify(previous)}`;
}
