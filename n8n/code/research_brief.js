// Research brief (Code, run once for each item). Input: Template rules. Output: the same item plus `_research_brief`,
// what the researcher must look for before its dimension sweep (Sequence 1, Oct 25):
//   claims     the brief's own figures and dated statements, each a thing the public record may show
//   geography  the profile's geography, a word the rows should carry
//   dimensions the dimensions that apply to this brief's focus
//   budget     searches and page reads allowed; slots on the slide
// It generates no query: the researcher turns each claim into one. Code only lists what a partner would check first.
const prof = $json.output || {};
const brief = ($('Brief Organizer').first().json.output) || {};
const cfg = $('Config').first().json;
const R = $json._research || {};

const stated = f => f && f.source === 'stated' && f.value != null ? String(Array.isArray(f.value) ? f.value.join('; ') : f.value) : '';
const texts = [
  ['problem_statement', stated((brief.hard_fields || {}).problem_statement)],
  ['success_criteria', stated((brief.soft_fields || {}).success_criteria)],
  ['prior_attempts', stated((brief.soft_fields || {}).prior_attempts)],
  ['timeline', stated((brief.soft_fields || {}).timeline)],
].filter(([, t]) => t);

// A claim = a sentence that carries a figure: a percentage, an amount, a count with a unit word, a year, a multiple.
const FIG = /(\d[\d.,]*\s*%|\b\d[\d.,]*\s*(?:percent|per cent|pp|bps|million|billion|bn|m|k|x|times)\b|[€$£]\s?\d[\d.,]*|\b\d[\d.,]*\s?[€$£]|\b(?:19|20)\d{2}\b|\b\d[\d.,]*\s+(?:hours?|days?|weeks?|months?|years?|plants?|sites?|stores?|facilities|employees|staff|customers|units|branches|countries|markets)\b)/i;
const sentences = t => String(t).replace(/\s+/g, ' ').split(/(?<=[.;!?])\s+(?=[A-Z0-9(])/).map(s => s.trim()).filter(Boolean);
const claims = [];
for (const [field, t] of texts) {
  for (const s of sentences(t)) {
    if (!FIG.test(s)) continue;
    // A goal or a deadline is the client's wish, not a fact the record can show: figures after 'wants', 'target', 'within', 'by the end' are left out.
    const GOAL = /(wants?|aims?|targets?|goals?|objective|at least|no more than|under|below|within|by the end of|by (?:19|20)\d{2})\s*[^.;]{0,40}$/i;
    const figures = [];
    for (const m of s.matchAll(new RegExp(FIG.source, 'gi'))) { const f = m[0].trim(); if (!GOAL.test(s.slice(Math.max(0, m.index - 48), m.index)) && !/^\d[\d.,]*\s+(weeks?|months?)$/i.test(f) && !figures.includes(f)) figures.push(f); }
    if (!figures.length) continue;
    if (claims.some(c => c.text === s || figures.every(f => c.figures.includes(f)))) continue;   // a restatement adds no claim
    claims.push({ id: 'C' + (claims.length + 1), field, text: s.length > 240 ? s.slice(0, 237) + '...' : s, figures });
    if (claims.length >= 5) break;
  }
  if (claims.length >= 5) break;
}

const focus = prof.problem_focus;
const dims = focus === 'offering' ? ['direct_competitors', 'indirect_competitors', 'substitutes', 'market_trends']
  : focus === 'both' ? ['direct_competitors', 'indirect_competitors', 'substitutes', 'market_trends', 'peer_moves', 'topic_adoption', 'drivers', 'constraints']
  : ['peer_moves', 'topic_adoption', 'drivers', 'constraints'];
const dimensions = dims.filter(d => !(d === 'substitutes' && !prof.product));

const research_brief = {
  claims,
  geography: prof.geography || null,
  market: prof.market || null,
  peers_known: Array.isArray(prof.competitors) && prof.competitors.length > 0,
  dimensions,
  slots: R.max_rows || 5,
  budget: { searches: Number(cfg.researcher_max_searches) || 10, reads: 6 },
  publishers_to_try: 'the statistics office and the regulator of the geography, Eurostat or OECD for Europe, the central bank, the sector trade body, listed peers\' filings and results',
};
return { json: { ...$json, _research_brief: research_brief } };
