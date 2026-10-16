const p = $json.output || {};
const today = $('Config').item.json.today;
const words = s => (s || '').split(/\s+/).filter(Boolean).length;
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const mentions = (t, n) => !!n && norm(n).length > 2 && (' ' + norm(t) + ' ').includes(' ' + norm(n) + ' ');
const v = [];
// Client Profiler runs with onError=continue: a failed run arrives as { error } with no output.
// problem_focus is then undefined, so both IFs take their stubs and the deck is built without market research.
if ($json.error) v.push('profiler_failed: ' + String($json.error).slice(0, 200));
if (p.problem_focus === 'offering' && p.topic !== null) v.push('topic_set_on_offering');
if (p.problem_focus !== 'offering' && !p.topic) v.push('topic_missing');
if (p.topic && words(p.topic) > 6) v.push('topic_over_6_words');
if (words(p.summary) > 120) v.push('summary_over_120_words');
(p.competitors || []).forEach((c, i) => { if (mentions(c.name, p.client_name)) v.push('competitor_' + i + '_is_client'); });
for (const k of ['market_size', 'client_size']) { const f = p[k]; if (f && f.source_date && String(f.source_date).slice(0, 10) > today) v.push(k + '_date_after_today'); }
// TODO first-run: add url-from-search and client-name-in-query checks from $json.intermediateSteps once the trace shape is confirmed.
return { json: { output: p, _validation: { valid: v.length === 0, violations: v } } };
