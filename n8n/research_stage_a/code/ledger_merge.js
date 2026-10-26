// Ledger merge (Code, run once). Input: L4 result. Assembles the Stage A ledger from every layer's result, then the
// compact view for the Phase Architect and the partner's report (markdown). v0: Layers 1, 2+3 (one wave), 4; no sentiment.
const cfg = $('Research method').first().json;
const L1 = $('L1 result').first().json;
const T = $('Table build').first().json;
const C3 = (() => { try { return $('Comparison Challenger').first().json.output || {}; } catch (e) { return {}; } })();
const L4 = $input.first().json;
const frame = (L1.records || {}).frame || {};
const comps = (L1.records || {}).competitors || [];
const findings = ((L4.records || {}).findings || []).filter(f => f.ok);
const dropped = ((L4.records || {}).findings || []).filter(f => !f.ok);
const gaps = [
  ...(L1.gaps || []).map(g => ({ layer: 'L1', ...g })),
  ...((C3.gaps || []).map(g => ({ layer: 'L3', ...g, source: 'challenger' }))),
  ...(L4.gaps || []).map(g => ({ layer: 'L4', ...g })),
];
const open_questions = [...(L1.open_questions || []), ...((C3.gaps || []).map(g => ({ layer: 'L3', question_id: g.question_id, question: g.what_is_missing, why: g.how_to_fill }))), ...(L4.open_questions || [])];
const ledger = {
  run_id: cfg.run_id, today: cfg.today, category: cfg.category,
  frame, competitors: comps, lists_tried: (L1.records || {}).lists_tried || [],
  cells: T.table, findings, findings_dropped: dropped.map(f => ({ index: f.index, actor: f.actor, faults: f.faults })),
  claims: (L4.records || {}).claims || [], not_covered: (L4.records || {}).not_covered || [],
  gaps, open_questions,
  challengers: { L1: { verdict: L1.challenger_verdict, weak: L1.weak_records, fill_rate: L1.fill_rate, named: L1.gaps_named_pass0, filled: L1.gaps_filled, passes: L1.passes }, L3: { verdict: C3.verdict || null, weak: C3.weak_records || [] }, L4: { verdict: L4.challenger_verdict, weak: L4.weak_records, fill_rate: L4.fill_rate, named: L4.gaps_named_pass0, filled: L4.gaps_filled, passes: L4.passes } },
  budget: { L1: { searches: L1.searches_used, reads: L1.reads_used }, L3: { reads: (T.table.per_company || []).reduce((s, c) => s + (c.pages || []).length, 0) }, L4: { searches: L4.searches_used, reads: L4.reads_used } },
};
const extremes = (T.table.rows || []).filter(r => r.comparable && r.filled >= 3).map(r => ({ attribute: r.attribute, values: r.cells.map((c, i) => ({ company: T.table.columns[i].name, value: c.value })) }));
const compact = {
  frame: { market: frame.market, segment: frame.segment, problem_geography: frame.problem_geography, home_geography: frame.home_geography, channels: frame.channels, market_size: frame.market_size },
  competitors: comps.map(c => ({ name: c.name, status: c.status, list_type: c.list_type })),
  comparison_rows: extremes,
  findings: findings.filter(f => f.scope_risk !== 'none').map(f => ({ actor: f.actor, dimension: f.dimension, date: f.date, action: (f.action || {}).text, scope_risk: f.scope_risk, why_it_matters: f.why_it_matters })),
  open_questions,
};
const md = [];
md.push(`# Market research ledger: ${String(cfg.brief.hard_fields.client.value).split(',')[0]} (${cfg.today}, run ${cfg.run_id})`);
md.push(`\n## Frame\n- Market: ${frame.market || '-'}\n- Segment: ${frame.segment || '-'}\n- Home: ${((frame.home_geography || {}).countries || []).join(', ')} (${(frame.home_geography || {}).depth || '-'}); problem: ${((frame.problem_geography || {}).countries || []).join(', ')} (${(frame.problem_geography || {}).depth || '-'})\n- Channels: ${(frame.channels || []).join(', ') || '-'}\n- Market size: ${frame.market_size ? `${frame.market_size.value} ${frame.market_size.unit} (${frame.market_size.year}, ${frame.market_size.scope}) <${frame.market_size.url}>` : 'none found'}\n- Client verified: ${frame.client_verified} ${frame.client_domain ? '(' + frame.client_domain + ')' : ''}`);
md.push(`\n## The five\n| # | Name | Country | List | Tests (market/geo/channel/segment) | Status | Page |\n|---|---|---|---|---|---|---|`);
comps.forEach((c, i) => { const t = c.tests || {}; md.push(`| ${i + 1} | ${c.name} | ${c.country || ''} | ${c.list_type} | ${[t.product_market, t.geography, t.channel, t.segment].map(x => x ? 'y' : 'n').join('/')} | ${c.status} | ${c.list_url} |`); });
md.push(`\nLists tried: ${((L1.records || {}).lists_tried || []).map(l => `${l.list_type} (${l.result})`).join('; ') || '-'}`);
md.push(`\n## Comparison (${T.table.coverage.filled} of ${T.table.coverage.cells} cells, ${T.table.coverage.pct}%)\n| Attribute | ${T.table.columns.map(c => c.name + (c.role === 'client' ? ' (client)' : '')).join(' | ')} | Comparable |\n|---|${T.table.columns.map(() => '---').join('|')}|---|`);
for (const r of T.table.rows) md.push(`| ${r.label} | ${r.cells.map(c => c.value == null ? '' : String(c.value).replace(/\|/g, '/').slice(0, 60)).join(' | ')} | ${r.comparable ? 'yes' : 'no'} |`);
md.push(`\n## Findings (${findings.length} kept, ${dropped.length} dropped by the check)`);
findings.forEach((f, i) => md.push(`${i + 1}. **${f.actor}** (${f.dimension}, ${f.date}, ${f.geography}; risk ${f.scope_risk}). ${(f.action || {}).text} ${f.result ? 'Result: ' + f.result.text : ''} <${(f.action || {}).url}>`));
if (dropped.length) md.push(`\nDropped: ${dropped.map(f => `${f.actor} (${f.faults.join(', ')})`).join('; ')}`);
md.push(`\n## Claims\n${(ledger.claims.map(c => `- ${c.id}: ${c.status} — ${c.query}`).join('\n')) || '- none'}`);
md.push(`\n## Open questions\n${open_questions.map(q => `- [${q.layer} ${q.question_id}] ${q.question} (${q.why})`).join('\n') || '- none'}`);
md.push(`\n## Challengers and budget\n- L1: verdict ${ledger.challengers.L1.verdict}, passes ${ledger.challengers.L1.passes}, gaps named ${ledger.challengers.L1.named}, filled ${ledger.challengers.L1.filled} (fill rate ${ledger.challengers.L1.fill_rate}%); ${ledger.budget.L1.searches} searches, ${ledger.budget.L1.reads} reads\n- L3: verdict ${ledger.challengers.L3.verdict}; ${ledger.budget.L3.reads} pages\n- L4: verdict ${ledger.challengers.L4.verdict}, passes ${ledger.challengers.L4.passes}, gaps named ${ledger.challengers.L4.named}, filled ${ledger.challengers.L4.filled} (fill rate ${ledger.challengers.L4.fill_rate}%); ${ledger.budget.L4.searches} searches, ${ledger.budget.L4.reads} reads`);
return [{ json: { ledger, compact, report_markdown: md.join('\n') } }];
