// L1 check (Code, run once for each item). Input: the Competitor Finder's answer ({ output, intermediateSteps }).
// Reads the Frame Setter's answer and the method; checks the frame and the five by rules; counts the budget used by
// both agents from their traces; lists the pages surfaced and never opened. Output: the L1 records plus
// `violations`, `code_gaps`, `budget_left`, `unopened_urls`, and `_challenger_input` for the Frame Challenger.
const cfg = $('Research method').first().json;
const M = cfg.method;
const fs = $('Frame Setter').first().json;
const frame = fs.output || {};
const cf = $json.output || {};
const pass = typeof $runIndex === 'number' ? $runIndex : 0;
const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u00a0/g, ' ').replace(/[*_#`>\[\]()|]/g, '').replace(/\s+/g, ' ').trim();   // markdown marks the read-page tool keeps and a quoting model drops
// A passage may join several excerpts with '...' or '…'; every part of at least 15 characters must be in the page.
const inPage = (text, passage) => { const parts = norm(passage).split(/\.{3}|\u2026/).map(x => x.trim()).filter(x => x.length >= 15); return parts.length > 0 && parts.every(p => text.includes(p)); };
const host = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '');
const inList = (h, list) => list.some(d => h === d || h.endsWith('.' + d));
const primary = M.publishers.primary_domains, press = M.publishers.press_domains, bodies = M.publishers.trade_bodies.map(b => b.domain);

const v = [], gaps = [];
// Frame
if (!frame.market || norm(frame.market).split(' ').length < 6) v.push('frame:market_phrase_too_short');
const pg = frame.problem_geography || {}, hg = frame.home_geography || {};
if (!M.depths.includes(pg.depth)) v.push('frame:problem_depth_' + pg.depth + '_invalid');
if (!M.depths.includes(hg.depth)) v.push('frame:home_depth_' + hg.depth + '_invalid');
if (!(pg.countries || []).length) v.push('frame:problem_geography_no_country');
const geoWords = [...(pg.countries || []), ...(hg.countries || [])].map(norm).filter(Boolean);
if (frame.market && geoWords.length && !geoWords.some(g => norm(frame.market).includes(g))) v.push('frame:market_phrase_names_no_geography');
if (frame.market_size) {
  const h = host(frame.market_size.url);
  if (!(inList(h, primary) || inList(h, press) || inList(h, bodies))) v.push('frame:market_size_publisher_' + h + '_not_listed');
}
// Competitors
const comps = Array.isArray(cf.competitors) ? cf.competitors : [];
const seen = new Set();
comps.forEach((c, i) => {
  const tag = 'competitor_' + (i + 1) + '_' + norm(c.name).replace(/ /g, '_');
  if (!c.name) v.push(tag + ':no_name');
  if (seen.has(norm(c.name))) v.push(tag + ':duplicate'); seen.add(norm(c.name));
  if (!M.list_types.includes(c.list_type)) v.push(tag + ':list_type_invalid');
  if (!c.list_url) v.push(tag + ':no_list_page');
  if (!norm(c.passage).includes(norm(c.name).split(' ')[0])) v.push(tag + ':passage_does_not_name_it');
  const h = host(c.list_url);
  if (c.list_type !== 'retailer_shelf' && !(inList(h, primary) || inList(h, press) || inList(h, bodies))) v.push(tag + ':list_publisher_' + h + '_not_listed');
  const t = c.tests || {};
  if (!t.product_market) v.push(tag + ':fails_product_market');
  c.status = (t.product_market && t.geography && t.channel && t.segment) ? 'confirmed' : 'candidate';
});
if (comps.length < 3) gaps.push({ question_id: 'L1.4', what_is_missing: `only ${comps.length} competitors with a list page`, how_to_fill: 'try the list types not yet tried: ' + M.list_types.filter(t => !(cf.lists_tried || []).some(l => l.list_type === t)).join(', '), severity: 'high', source: 'code' });
if (!frame.market_size) gaps.push({ question_id: 'L1.3', what_is_missing: 'no published market size', how_to_fill: 'one search on the statistics office or the trade body for the product market size in the problem geography', severity: 'low', source: 'code' });
if (!(frame.channels || []).length) gaps.push({ question_id: 'L1.1', what_is_missing: 'no channels', how_to_fill: "open the client's store or shipping page", severity: 'medium', source: 'code' });
// Budget and unopened pages, from both traces
const parseObs = o => { if (typeof o !== 'string') return o; try { return JSON.parse(o); } catch (e) { return null; } };
const urlKey = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
let searches = 0, reads = 0; const surfaced = [], opened = new Set();
for (const steps of [fs.intermediateSteps || [], $json.intermediateSteps || []]) for (const st of steps) {
  const tool = String(((st || {}).action || {}).tool || ''); const obs = parseObs((st || {}).observation);
  if (/search/i.test(tool)) { searches += 1; const list = Array.isArray(obs) ? obs : [obs]; for (const q of list) for (const r of ((q || {}).results || [])) if (r && r.url && !surfaced.some(x => x.url === r.url)) surfaced.push({ url: r.url, title: r.title || '', date: r.date || null }); }
  else if (/read/i.test(tool)) { reads += 1; const inp = ((st || {}).action || {}).toolInput; const u = typeof inp === 'string' ? inp : (inp && inp.url) || ''; if (u) opened.add(urlKey(u)); }
}
const budget_left = { searches: Math.max(0, cfg.budget.l1_searches - searches), reads: Math.max(0, cfg.budget.l1_reads - reads) };
const unopened_urls = surfaced.filter(x => !opened.has(urlKey(x.url))).slice(0, 8);
const records = { frame, competitors: comps, lists_tried: cf.lists_tried || [], notes: [...(frame.notes || []), ...(cf.notes || [])] };
const _challenger_input = { layer: 'L1', questions: M.questions.L1, brief: { client: cfg.brief.hard_fields.client.value, problem_statement: cfg.brief.hard_fields.problem_statement.value }, frame: null, records, violations: v, budget_left };
return { json: { pass, records, violations: v, code_gaps: gaps, budget_left, unopened_urls, searches_used: searches, reads_used: reads, _challenger_input } };
