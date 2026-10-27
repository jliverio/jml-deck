// Findings check (Code, run once for each item). Input: the Press Gatherer's answer ({ output, intermediateSteps }).
// Every finding: a date or period in the action, a named actor, pages on listed publishers (or a competitor's own
// domain), pages opened in this call, passages in the page text; no two findings on one document; coverage per
// question and per competitor; the brief's claims reported; budget and unopened pages from the trace.
const cfg = $('Research method').first().json;
const M = cfg.method;
const L1 = $('L1 result').first().json;
const frame = (L1.records || {}).frame || {};
const comps = (L1.records || {}).competitors || [];
const out = $json.output || {};
const pass = typeof $runIndex === 'number' ? $runIndex : 0;
const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u00a0/g, ' ').replace(/[*_#`>\[\]()|]/g, '').replace(/\s+/g, ' ').trim();   // markdown marks the read-page tool keeps and a quoting model drops
// A passage may join several excerpts with '...' or '…'; every part of at least 15 characters must be in the page.
const inPage = (text, passage) => { const whole = norm(passage); let parts = whole.split(/\.{3}|\u2026/).map(x => x.trim()).filter(x => x.length >= 15); if (!parts.length && whole.length >= 5) parts = [whole]; return parts.length > 0 && parts.every(p => text.includes(p)); };   // a short passage ('3533 articulos') is checked whole
const host = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '');
const urlKey = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const inList = (h, list) => list.some(d => h === d || h.endsWith('.' + d));
const compDomains = comps.map(c => c.domain && host('https://' + String(c.domain).replace(/^https?:\/\//, ''))).filter(Boolean);
const allowed = h => inList(h, M.publishers.primary_domains) || inList(h, M.publishers.press_domains) || inList(h, M.publishers.trade_bodies.map(b => b.domain)) || inList(h, compDomains);
const parseObs = o => { if (typeof o !== 'string') return o; try { return JSON.parse(o); } catch (e) { return null; } };
const pages = {}, surfaced = []; let searches = 0, reads = 0; const queries = [];
// Pages opened and budget spent count across passes: a second pass keeps the first pass's findings, whose pages it did not open again.
const traces = []; for (let k = 0; k < pass; k++) { try { const a = $('Press Gatherer').all(0, k); if (a && a.length) traces.push(a[0].json.intermediateSteps || []); } catch (e) {} } traces.push($json.intermediateSteps || []);
for (const steps of traces) for (const st of steps) {
  const tool = String(((st || {}).action || {}).tool || ''); const obs = parseObs((st || {}).observation); const inp = ((st || {}).action || {}).toolInput;
  if (/search/i.test(tool)) { searches += 1; queries.push(typeof inp === 'string' ? inp : (inp && inp.query) || ''); const list = Array.isArray(obs) ? obs : [obs]; for (const q of list) for (const r of ((q || {}).results || [])) if (r && r.url && !surfaced.some(x => x.url === r.url)) surfaced.push({ url: r.url, title: r.title || '', date: r.date || null }); }
  if (/read/i.test(tool)) { reads += 1; const list = Array.isArray(obs) ? obs : [obs]; for (const p of list) if (p && p.url) pages[urlKey(p.url)] = norm(p.text || ''); }
}
const DATE = /\b(?:19|20)\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:q[1-4]|h[12])\b|\b(?:last|past|this)\s+(?:year|month|quarter)\b/i;
const findings = (Array.isArray(out.findings) ? out.findings : []).map((f, i) => {
  const faults = [];
  if (!f.actor) faults.push('no_actor');
  if (!DATE.test(f.action && f.action.text) && !DATE.test(f.date)) faults.push('no_date_or_period');
  for (const part of ['context', 'action', 'result']) {
    const p = f[part]; if (!p) { if (part !== 'result') faults.push(part + '_missing'); continue; }
    const h = host(p.url);
    if (!p.url) faults.push(part + '_no_url');
    else if (!allowed(h)) faults.push(part + '_publisher_' + h + '_not_listed');
    const text = pages[urlKey(p.url)];
    if (p.url && text === undefined) faults.push(part + '_page_not_opened');
    else if (text !== undefined && !inPage(text, p.passage)) faults.push(part + '_passage_not_in_page');
  }
  if (/\b(should|must|needs? to)\b/i.test(f.why_it_matters)) faults.push('why_gives_advice');
  return { ...f, index: i, ok: faults.length === 0, faults };
});
// one finding per document
const docs = {};
findings.forEach(f => { const k = urlKey((f.action || {}).url); if (!k) return; (docs[k] = docs[k] || []).push(f.index); });
for (const [k, idx] of Object.entries(docs)) if (idx.length > 1) for (const i of idx.slice(1)) { findings[i].ok = false; findings[i].faults.push('same_document_as_finding_' + idx[0]); }
const violations = findings.filter(f => !f.ok).map(f => `finding_${f.index + 1}:${f.faults.join('+')}`);
// coverage per question (dimension) and per competitor
const dimOf = { 'L4.1': 'direct_competitors', 'L4.2': 'indirect_competitors', 'L4.3': 'substitutes', 'L4.4': 'market_trends' };
const okDims = new Set(findings.filter(f => f.ok).map(f => f.dimension));
const nc = Array.isArray(out.not_covered) ? out.not_covered : [];
const gaps = [];
for (const q of M.questions.L4) { const d = dimOf[q.id]; if (!okDims.has(d) && !nc.some(x => norm(x.dimension) === d)) gaps.push({ question_id: q.id, what_is_missing: `no finding and no not_covered line for ${d}`, how_to_fill: 'one query on this dimension for the product market in the problem geography', severity: 'medium', source: 'code' }); }
const allQ = norm([...queries, ...(out.queries_run || [])].join(' | '));
for (const c of comps) if (c.name && !allQ.includes(norm(c.name).split(' ')[0])) gaps.push({ question_id: 'L4.1', what_is_missing: `${c.name} was never searched`, how_to_fill: `search "${c.name}" with the product and the problem geography, 24 months`, severity: 'medium', source: 'code' });
const claimsOut = Array.isArray(out.claims) ? out.claims : [];
for (const c of (cfg.claims || [])) { const e = claimsOut.find(x => x && x.id === c.id); if (!e) gaps.push({ question_id: 'L4.4', what_is_missing: `claim ${c.id} not reported`, how_to_fill: `one query for the public series behind: ${c.text.slice(0, 80)}`, severity: 'medium', source: 'code' }); else if (e.status === 'found' && !(findings[e.finding_index] && findings[e.finding_index].ok)) violations.push(`claims:${c.id}_found_but_finding_${e.finding_index}_not_ok`); }
const budget_left = { searches: Math.max(0, cfg.budget.l4_searches - searches), reads: Math.max(0, cfg.budget.l4_reads - reads) };
const cutoff = new Date(cfg.today + 'T00:00:00Z'); cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
const unopened_urls = surfaced.filter(x => pages[urlKey(x.url)] === undefined && allowed(host(x.url)) && (!x.date || isNaN(Date.parse(x.date)) || new Date(x.date) >= cutoff)).slice(0, 8);
const records = { findings, claims: claimsOut, not_covered: nc, queries: queries.length ? queries : (out.queries_run || []) };
let previous_gaps = []; if (pass > 0) { try { const g = $('L4 gate').all(0, pass - 1); previous_gaps = (((g[0] || {}).json || {}).gaps || []).filter(x => x.source === 'challenger').map((x, i) => ({ id: 'G' + (i + 1), question_id: x.question_id, what_is_missing: x.what_is_missing })); } catch (e) {} }
const _challenger_input = { layer: 'L4', pass, previous_gaps, questions: M.questions.L4, brief: { client: cfg.brief.hard_fields.client.value, problem_statement: cfg.brief.hard_fields.problem_statement.value }, frame: { market: frame.market, problem_geography: frame.problem_geography, competitors: comps.map(c => c.name) }, records: { findings: findings.map(f => ({ index: f.index, ok: f.ok, faults: f.faults, actor: f.actor, dimension: f.dimension, date: f.date, geography: f.geography, action: (f.action || {}).text, result: f.result && f.result.text, scope_risk: f.scope_risk })), claims: claimsOut, not_covered: nc }, violations, budget_left };
return { json: { pass, records, violations, code_gaps: gaps, budget_left, unopened_urls, searches_used: searches, reads_used: reads, _challenger_input } };
