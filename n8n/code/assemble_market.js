// Assemble market (Code, run once for all items). Input: Merge market (the Offering and Topic researchers' checked
// answers, or their stubs). Keeps the slides that found something, offering first.
// A row reaches the deck only when its context and its action each cite a source in that slide's source list:
// a figure with no source reads as invented. Uncited rows are left out with a warning (run 152, Oct 16: the
// Topic researcher returned four rows with figures and an empty source list).
const items = $input.all();
const order = { market_context_offering: 0, market_context_topic: 1 };
const kept = [];
const warnings = [];
for (const it of items) {
  const o = (it.json && it.json.output) || {};
  const slide = o.slide || {};
  const skipped = it.json && it.json._skipped;
  if (skipped || !Array.isArray(slide.rows) || slide.rows.length === 0 || o.search_quality === 'none') continue;
  const listed = new Set((o.sources || []).map(s => s && s.ref).filter(x => x != null));
  const cites = p => !!p && Array.isArray(p.refs) && p.refs.some(x => listed.has(x));
  const rows = slide.rows.filter(r => r && cites(r.context) && cites(r.action));
  if (rows.length < slide.rows.length) {
    warnings.push(`Market research (${slide.slide_id}): ${slide.rows.length - rows.length} of ${slide.rows.length} finding(s) left out because they cite no listed source.`);
  }
  if (rows.length) kept.push({ ...o, slide: { ...slide, rows } });
}
kept.sort((a, b) => { const oa = order[a.slide.slide_id]; const ob = order[b.slide.slide_id]; return (oa === undefined ? 9 : oa) - (ob === undefined ? 9 : ob); });
const market_slides = kept.map(o => ({ slide: o.slide, sources: o.sources || [] }));
const market_findings = [];
for (const o of kept) {
  for (const r of o.slide.rows) {
    market_findings.push({ actor: r.actor, dimension: r.dimension, summary: r.summary, scope_risk: r.scope_risk, why_it_matters_to_scope: r.why_it_matters_to_scope });
  }
}
return [{ json: { market_slides: market_slides, market_slide_count: market_slides.length, market_findings: market_findings, market_warnings: warnings } }];
