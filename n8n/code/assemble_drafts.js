// Assemble drafts (Code, run once for each item). Input: Assemble market.
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
const market = $json || {};

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

// 5. The Copywriter's work list.
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
    warnings,
  },
};
