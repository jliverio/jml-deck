// Prepare context (Code, run once for each item). Input: Assemble market. Template 1.4, Scenario 1.
// Builds the Context Writer's input (situation slide) and passes Assemble market's
// output through untouched, so Architect input downstream sees the same $json as before.
// The situation is written only from the cited findings Assemble market kept, and only when there are
// at least MIN_FINDINGS of them: with fewer, the slide would repeat the findings slide (José, Oct 16).
const MIN_FINDINGS = 3;
const LIMITS = { situation_title: 90, situation: 150, belief: 140 };
const bo = ($('Brief Organizer').first().json.output) || {};
const prof = ($('checkProfiler').first().json.output) || {};
const cfg = $('Config').first().json || {};
const sv = f => (f && f.value != null ? String(f.value) : null);
const hf = bo.hard_fields || {};
const clientName = String(prof.client_name || sv(hf.client) || 'the client').split(',')[0].trim();
const findings = [];
for (const ms of ($json.market_slides || [])) {
  for (const r of ((ms.slide || {}).rows || [])) {
    const t = p => String((p && p.text) || '').trim();
    const result = /^not yet reported\.?$/i.test(t(r.result)) ? '' : t(r.result);
    findings.push({ n: findings.length + 1, headline: String(r.summary || '').trim(), context: t(r.context), action: t(r.action), result });
  }
}
const context_input = {
  client_name: clientName,
  problem_statement: sv(hf.problem_statement) || '',
  profile: { current_state: prof.current_state || null, market: prof.market || null, topic: prof.topic || null },
  findings,
  write_situation: findings.length >= MIN_FINDINGS,
  limits: LIMITS,
  never_use: cfg.jargon_never || [],
};
return { json: { ...$json, context_input } };
