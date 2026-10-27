// L4 gate (Code, run once for each item). Input: the Findings Challenger's answer. Same logic as L1 gate.
// merges code gaps and challenger gaps, and routes: 'retry' once when gaps remain and budget is left, else 'go'.
const ch = $json.output || {};
const pass = typeof $runIndex === 'number' ? $runIndex : 0;
const checks = $('Findings check').all(0, pass);
const ck = (checks[0] || {}).json || {};
const cgaps = (Array.isArray(ch.gaps) ? ch.gaps : []).map(g => ({ ...g, source: 'challenger' }));
const gaps = [...(ck.code_gaps || []), ...cgaps];
const serious = gaps.some(g => g.severity === 'high' || g.severity === 'medium') || (ck.violations || []).length > 0;
const left = ck.budget_left || { searches: 0, reads: 0 };
const route = (pass === 0 && serious && (left.searches > 0 || left.reads > 0)) ? 'retry' : 'go';
const finder = $('Press Gatherer').all(0, pass);
const previous_output = ((finder[0] || {}).json || {}).output || null;
return { json: {
  layer: 'L4', pass, route,
  records: ck.records, violations: ck.violations || [], gaps, challenger_verdict: ch.verdict || null, weak_records: ch.weak_records || [], previous_gaps_review: Array.isArray(ch.previous_gaps) ? ch.previous_gaps : [],
  budget_left: left, searches_used: ck.searches_used, reads_used: ck.reads_used,
  _retry: route === 'retry' ? { previous_output, gaps, unopened_urls: ck.unopened_urls || [], budget_left: left } : null,
} };
