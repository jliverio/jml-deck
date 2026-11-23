// Assemble market (Code, run once for all items). Step 6 (23 Nov): the market research replaces the two researchers.
// This node hands on what the rest of the flow already reads from it:
//   market_slides      empty: the old findings slide is not in template 1.5.4
//   market_findings    up to 8 short findings (who, one line) as background for the phase plan. The research does not
//                      judge the risk to the scope, so scope_risk is "none": a finding never adds or removes a phase.
//   market_warnings    why the research is missing or thin, in plain words
// and, new, "research": the run, the report PDF, which slides were filled, and the client's colour when it was read
// with high confidence. The slide texts and the logos are not copied here: the deck request reads them from Slide values.
const get = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const inp = get('Research input');
const res = get('Market research');
const sv = get('Slide values');
const pal = get('Read client colour');
const plain = (t) => String(t || '').replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();
const v = sv.values || {};
const slides = { profile: !!(sv.slides && sv.slides.profile), compare: !!(sv.slides && sv.slides.compare) };
const ran = !!(inp.research_go && res.run_id && !res.error);
const findings = [];
const add = (actor, summary) => {
  const text = plain(summary);
  if (actor && text && findings.length < 8) findings.push({ actor, dimension: 'market research', summary: text.slice(0, 220), scope_risk: 'none', why_it_matters_to_scope: '' });
};
if (slides.profile || slides.compare) {
  const client = plain(v.client_name_01) || inp.company;
  add(client, v.profile_title_01);
  add(client, v.client_point_01);
  for (const k of ['01', '02', '03', '04']) {
    const name = plain(v['competitor_' + k + '_name']);
    if (name) add(name, v['competitor_' + k + '_point_01'] || 'Named as a competitor; its website gave no claims.');
  }
  add(client, v.compare_title_01);
}
const warnings = [];
const errText = (o) => (o && o.error ? String(o.error.message || o.error).slice(0, 160) : '');
if (!inp.research_go) warnings.push('Market research was not run. ' + (inp.why_not || 'The client has no website on record.'));
else if (!ran) warnings.push('Market research did not return a result' + (errText(res) ? ': ' + errText(res) : '.'));
else {
  if (res.outcome && res.outcome !== 'ok') warnings.push('Market research ended ' + res.outcome + (Array.isArray(res.reasons) && res.reasons.length ? ': ' + res.reasons.join('; ') : '') + '.');
  if (!slides.profile && !slides.compare) warnings.push('Market research found nothing for the two slides' + (errText(sv) ? ': ' + errText(sv) : '') + '.');
  for (const t of (Array.isArray(sv.thin) ? sv.thin : [])) warnings.push('Market research is thin: ' + plain(t) + '.');
}
const hex = String(pal.primary || '').replace('#', '').toUpperCase();
const colour_applied = pal.apply === true && /^[0-9A-F]{6}$/.test(hex);
const LINE = "This deck is in JML colours: the client's colour could not be read from its website with enough confidence. Reply with the client's main colour as a HEX code (for example #E60000) and the same deck comes back in that colour.";
return [{ json: {
  market_slides: [], market_slide_count: 0, market_findings: findings, market_warnings: warnings,
  research: {
    asked: !!inp.research_go, ran, run_id: ran ? res.run_id : '', outcome: ran ? String(res.outcome || '') : '', reasons: ran && Array.isArray(res.reasons) ? res.reasons : [],
    doc_url: ran ? (res.doc_url || '') : '', pdf_file_id: ran ? (res.pdf_file_id || '') : '', pdf_name: ran ? (res.pdf_name || '') : '', pdf_url: ran ? (res.pdf_url || '') : '',
    duration_s: ran ? (res.duration_s || null) : null, slides, thin: Array.isArray(sv.thin) ? sv.thin : [], logos_found: Array.isArray(sv.logos_found) ? sv.logos_found : [],
    brand: colour_applied ? { primary: hex } : null, colour_applied, colour_confidence: pal.error ? 'not read' : String(pal.confidence || (inp.research_go ? 'none' : 'not read')),
    colour_note: colour_applied ? '' : LINE,
  } } }];
