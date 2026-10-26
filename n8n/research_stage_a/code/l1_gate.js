// L1 gate (Code, run once for each item). Input: the Frame Challenger's answer. Reads the L1 check of the same pass,
// merges code gaps and challenger gaps, and routes: 'retry' once when gaps remain and budget is left, else 'go'.
const ch = $json.output || {};
const pass = typeof $runIndex === 'number' ? $runIndex : 0;
const checks = $('L1 check').all(0, pass);
const ck = (checks[0] || {}).json || {};
const cgaps = (Array.isArray(ch.gaps) ? ch.gaps : []).map(g => ({ ...g, source: 'challenger' }));
const gaps = [...(ck.code_gaps || []), ...cgaps];
const serious = gaps.some(g => g.severity === 'high' || g.severity === 'medium') || (ck.violations || []).length > 0;
const left = ck.budget_left || { searches: 0, reads: 0 };
const route = (pass === 0 && serious && (left.searches > 0 || left.reads > 0)) ? 'retry' : 'go';
const finder = $('Competitor Finder').all(0, pass);
const previous_output = ((finder[0] || {}).json || {}).output || null;
return { json: {
  layer: 'L1', pass, route,
  records: ck.records, violations: ck.violations || [], gaps, challenger_verdict: ch.verdict || null, weak_records: ch.weak_records || [],
  budget_left: left, searches_used: ck.searches_used, reads_used: ck.reads_used,
  _retry: route === 'retry' ? { previous_output, gaps, unopened_urls: ck.unopened_urls || [], budget_left: left } : null,
} };
