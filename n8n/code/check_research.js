// Check offering / Check topic (Code, run once for each item). Input: the researcher's answer ({ output, intermediateSteps }).
// Sequence 1 (Oct 25): the checks are fixed (dates parsed, one source per document, coverage, the brief's claims, the
// budget) and a failed first pass is routed back to the same researcher once, with what it did not use.
// Output: { output, _research_validation: { ok, violations, warnings, pass }, _route: 'retry' | 'go', _retry: {...} | null }.
const out = $json.output || {};
const R = ($('Template rules').first().json._research) || {};
const RB = ($('Research brief').first().json._research_brief) || {};
const fr = f => (R.field_rules || []).find(x => x.field === f) || {};
const limits = { title: 90, actor: 60, summary: fr('summary').draft_chars || null,
  bullet: Math.max(fr('context').draft_chars || 0, fr('action').draft_chars || 0, fr('result').draft_chars || 0) || null,
  not_covered: 100, max_rows: R.max_rows || 5 };
const prof = ($('checkProfiler').first().json.output) || {};
const today = String($('Config').first().json.today).slice(0, 10);
const pass = typeof $runIndex === 'number' ? $runIndex : 0;
const budget = (RB.budget) || { searches: Number($('Config').first().json.researcher_max_searches) || 10, reads: 6 };

const VAGUE = ['lots', 'many', 'most', 'several', 'numerous', 'various', 'majority', 'few', 'some', 'a lot'];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasWord = (t, w) => (' ' + norm(t) + ' ').includes(' ' + w + ' ');
const mentions = (t, n) => { const x = norm(n); return x.length > 2 && (' ' + norm(t) + ' ').includes(' ' + x + ' '); };
const words = s => String(s || '').split(/\s+/).filter(Boolean).length;

// Dates: '2026-08-25', '2026-08', '2026', 'August 25, 2026', '25 August 2026', 'August 2026' -> an ISO prefix, or null.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const isoDate = d => {
  const s = String(d || '').trim();
  let m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s);
  if (m) return m[1] + (m[2] ? '-' + m[2] : '') + (m[3] ? '-' + m[3] : '');
  const mon = name => { const i = MONTHS.findIndex(x => x.startsWith(name.toLowerCase().slice(0, 3))); return i < 0 ? null : String(i + 1).padStart(2, '0'); };
  m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m && mon(m[1])) return `${m[3]}-${mon(m[1])}-${String(m[2]).padStart(2, '0')}`;
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s);
  if (m && mon(m[2])) return `${m[3]}-${mon(m[2])}-${String(m[1]).padStart(2, '0')}`;
  m = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s);
  if (m && mon(m[1])) return `${m[2]}-${mon(m[1])}`;
  m = /^(\d{4})[/.](\d{1,2})(?:[/.](\d{1,2}))?$/.exec(s);
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + (m[3] ? '-' + String(m[3]).padStart(2, '0') : '');
  return null;
};
const dateAfter = (iso, t) => !!iso && iso > t.slice(0, iso.length);

// One source per document: the same URL, or one URL that is a path prefix of another (sections of one report).
const urlKey = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const sameDoc = (a, b) => { const x = urlKey(a), y = urlKey(b); if (!x || !y) return false; return x === y || x.startsWith(y + '/') || y.startsWith(x + '/'); };

// Geography: the profile's region named in the row, or a usual alias of it. A warning, not a violation (words test).
const ALIAS = { 'united states': ['us', 'usa', 'u s', 'american'], 'united kingdom': ['uk', 'britain', 'british'], 'portugal': ['portuguese'], 'spain': ['spanish'], 'germany': ['german'], 'france': ['french'], 'italy': ['italian'], 'netherlands': ['dutch'], 'europe': ['eu', 'european'], 'european union': ['eu', 'european'], 'brazil': ['brazilian'], 'midwest': ['midwestern'] };
const geoWords = (() => {
  const g = norm(prof.geography);
  if (!g || g === 'worldwide' || g === 'global') return [];
  const ws = g.split(' ').filter(w => w.length > 2 && !['the', 'and', 'of'].includes(w));
  const extra = [];
  for (const k of Object.keys(ALIAS)) if (g.includes(k)) extra.push(...ALIAS[k]);
  for (const w of ws) if (ALIAS[w]) extra.push(...ALIAS[w]);
  return [...new Set([...ws, ...extra, g])];
})();

const slide = out.slide || {};
const rows = Array.isArray(slide.rows) ? slide.rows : [];
const sources = Array.isArray(out.sources) ? out.sources : [];
const qq = out.search_quality;
const v = [];
const warn = [];

if (rows.length === 0) {
  if (qq !== 'none') v.push('quality:empty_rows_not_none');
  if (slide.title !== null) v.push('quality:empty_rows_title_not_null');
} else if (qq === 'none') {
  v.push('quality:rows_present_but_none');
}
if (rows.length > limits.max_rows) v.push('rows:over_max');

if (rows.length > 0) {
  const t = slide.title;
  if (t === null || t === undefined || t === '') v.push('title:missing');
  else {
    if (limits.title && t.length > limits.title) v.push('title:over_limit');
    if (VAGUE.some(w => hasWord(t, w))) v.push('title:vague_quantifier');
  }
}

const srcRefs = sources.map(s => s.ref);
const appearance = [];
const pushRef = r => { if (!appearance.includes(r)) appearance.push(r); };
rows.forEach(r => { ['context', 'action', 'result'].forEach(part => { const p = r && r[part]; if (p && Array.isArray(p.refs)) p.refs.forEach(pushRef); }); });
appearance.forEach(r => { if (!srcRefs.includes(r)) v.push('refs:unresolved_' + r); });
srcRefs.forEach((r, i) => { if (r !== i + 1) v.push('refs:source_not_sequential_' + r); });
appearance.forEach((r, i) => { if (r !== i + 1) v.push('refs:appearance_out_of_order_' + r); });
srcRefs.forEach(r => { if (!appearance.includes(r)) v.push('refs:source_unused_' + r); });

rows.forEach((r, i) => {
  const tag = 'row' + i;
  if (mentions(r.actor, prof.client_name)) v.push(tag + ':actor_is_client');
  if (limits.actor && r.actor && r.actor.length > limits.actor) v.push(tag + ':actor_over_limit');
  if (limits.summary && r.summary && r.summary.length > limits.summary) v.push(tag + ':summary_over_limit');
  ['context', 'action', 'result'].forEach(part => { const p = r && r[part]; if (!p) { v.push(tag + ':' + part + '_missing'); return; } if (limits.bullet && p.text && p.text.length > limits.bullet) v.push(tag + ':' + part + '_over_limit'); });
  ['context', 'action'].forEach(part => { const p = r[part]; if (p && (!Array.isArray(p.refs) || p.refs.length === 0)) v.push(tag + ':' + part + '_no_refs'); });
  const res = r.result || {};
  const noRefs = !Array.isArray(res.refs) || res.refs.length === 0;
  const nyr = res.text === 'Not yet reported';
  if (noRefs !== nyr) v.push(tag + ':result_nyr_mismatch');
  if (words(r.why_it_matters_to_scope) > 25) v.push(tag + ':why_over_25_words');
  if (geoWords.length) {
    const txt = [r.context && r.context.text, r.action && r.action.text, r.result && r.result.text, r.summary].join(' ');
    if (!geoWords.some(g => hasWord(txt, g))) warn.push(tag + ':geography_' + norm(prof.geography).replace(/ /g, '_') + '_not_named');
  }
});

const nc = Array.isArray(slide.not_covered) ? slide.not_covered : [];
if (nc.length > 3) v.push('not_covered:over_3');
nc.forEach((line, i) => { if (limits.not_covered && line.length > limits.not_covered) v.push('not_covered_over_limit_' + i); });
sources.forEach(s => {
  const iso = isoDate(s.source_date);
  if (!iso) v.push('source_date_unreadable_' + s.ref);
  else if (dateAfter(iso, today)) v.push('source_date_after_today_' + s.ref);
});
for (let i = 0; i < sources.length; i++) for (let j = i + 1; j < sources.length; j++) {
  if (sameDoc(sources[i].source_url, sources[j].source_url)) v.push(`sources:${sources[i].ref}_and_${sources[j].ref}_same_document`);
}

// Coverage: every dimension that applies has a row or a not_covered line naming it.
const dims = Array.isArray(RB.dimensions) ? RB.dimensions : [];
const rowDims = new Set(rows.map(r => r.dimension));
for (const d of dims) {
  if (rowDims.has(d)) continue;
  if (nc.some(line => norm(line).includes(norm(d)))) continue;
  v.push('coverage:' + d + '_no_row_and_no_not_covered_line');
}

// The brief's claims: each one was searched for, and a found claim has a cited source.
const claimsOut = Array.isArray(out.claims) ? out.claims : [];
for (const c of (RB.claims || [])) {
  const e = claimsOut.find(x => x && x.id === c.id);
  if (!e) { v.push('claims:' + c.id + '_not_reported'); continue; }
  if (!String(e.query || '').trim()) v.push('claims:' + c.id + '_no_query');
  if (e.status === 'found') {
    if (!srcRefs.includes(e.ref)) v.push('claims:' + c.id + '_found_but_ref_' + e.ref + '_not_a_source');
    else if (!appearance.includes(e.ref)) v.push('claims:' + c.id + '_found_but_no_row_cites_source_' + e.ref);
  } else if (e.status !== 'not_found') v.push('claims:' + c.id + '_status_' + e.status + '_invalid');
}

// Budget: what the trace shows the researcher used, and what it surfaced but never opened.
const steps = Array.isArray($json.intermediateSteps) ? $json.intermediateSteps : [];
const seen = [], read = new Set();
let searches = 0, reads = 0;
const parseObs = o => { if (typeof o !== 'string') return o; try { return JSON.parse(o); } catch (e) { return null; } };
for (const st of steps) {
  const tool = String(((st || {}).action || {}).tool || '');
  const obs = parseObs((st || {}).observation);
  if (/search/i.test(tool)) {
    searches += 1;
    const list = Array.isArray(obs) ? obs : [obs];
    for (const q of list) for (const r of ((q || {}).results || [])) if (r && r.url && !seen.some(x => x.url === r.url)) seen.push({ url: r.url, title: r.title || '', date: r.date || null });
  } else if (/read/i.test(tool)) {
    reads += 1;
    const inp = ((st || {}).action || {}).toolInput;
    const u = typeof inp === 'string' ? inp : (inp && (inp.url || inp.query)) || '';
    if (u) read.add(urlKey(u));
    const list = Array.isArray(obs) ? obs : [obs];
    for (const r of list) if (r && r.url) read.add(urlKey(r.url));
  }
}
const SKIP = /mckinsey|bcg\.com|bain\.com|deloitte|pwc\.|\bey\.com|kpmg|accenture|oliverwyman|advisory\.com|6wresearch|marketsandmarkets|grandviewresearch|mordorintelligence|researchandmarkets|statista|linkedin|facebook|youtube|wikipedia|reddit|quora|medium\.com/;
const cutoff = new Date(today + 'T00:00:00Z'); cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
const fresh = x => !x.date || isNaN(Date.parse(x.date)) || new Date(x.date) >= cutoff;   // a dated page older than 24 months fails the source test anyway
const unopened = seen.filter(x => !read.has(urlKey(x.url)) && !SKIP.test(x.url) && fresh(x)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
const left = { searches: Math.max(0, budget.searches - searches), reads: Math.max(0, budget.reads - reads) };
const gaps = dims.filter(d => !rowDims.has(d)).length + claimsOut.filter(c => c && c.status === 'not_found').length;
if (pass === 0 && rows.length < limits.max_rows && gaps > 0 && (left.searches > 0 || left.reads > 0) && steps.length) {
  v.push(`budget:rows_${rows.length}_of_${limits.max_rows}_with_${gaps}_gaps_and_${left.searches}_searches_${left.reads}_reads_unused`);
}

const ok = v.length === 0;
const route = (!ok && pass === 0) ? 'retry' : 'go';
const retry = route === 'retry' ? { previous_output: out, violations: v, unopened_urls: unopened, budget_left: left, searches_used: searches, reads_used: reads } : null;
return { json: { output: out, _research_validation: { ok, violations: v, warnings: warn, pass, searches_used: searches, reads_used: reads }, _route: route, _retry: retry } };
