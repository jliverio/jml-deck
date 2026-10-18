// Usage: node n8n/tests/make_pins.js valid|invalid|error|s1  -> n8n/tests/out/pins_<mode>.json
// Pass the file as pinData to the n8n test_workflow tool (trigger: "Test brief (no email)").
// Builds pin data for an in-n8n wiring test: agents pinned, every Code/IF node runs for real.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const jl = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const briefB = jl('phase_architect/tests/scenario_B_brief.json');
const email = [
  'Hi,', '',
  'We need a proposal for Atlântico Seguros, a mid-size Portuguese insurer. They want to understand why property and health claims take too long to settle and what claims operating model it should move to. Motor claims were improved through an internal lean program in 2024 that cut handling time for motor claims only.', '',
  'they want a diagnostic and a recommendation, not implementation support. The goal: reduce average settlement time without customer satisfaction dropping. Note that replacing the claims IT system is out of scope.', '',
  'Our counterparts are the COO and the Head of Claims, and the final answer goes to the Board. They want a written report and a board presentation; the Board meets on 15 March 2027.', '',
  'Thanks', 'José'].join('\n');
const brief = { ...briefB,
  contracting_parties: { value: null, source: 'assumed', quote: null, assumption_text: null },
  client_url: { value: null, source: 'assumed', quote: null, assumption_text: null },
  relationship_stage: { value: 'cold', source: 'assumed', quote: null, assumption_text: 'No existing relationship mentioned.' },
  brief_narrative: 'Atlântico Seguros wants to understand why property and health claims take too long to settle and what claims operating model to move to. The final answer goes to the Board.',
  questions: [{ field: 'engagement_length', text: 'What is the intended duration?' }, { field: 'client_url', text: "What is the client's website?" }],
  routing: 'build', opt_in_offered: false };
brief.soft_fields = { ...brief.soft_fields, budget_range: { value: null, source: 'assumed', quote: null, assumption_text: null } };
const profile = { problem_focus: 'topic', focus_unclear: false, topic: 'claims operating model', client_name: 'Atlântico Seguros', client_verified: false, client_url: null,
  business_unit: null, product: null, current_state: null, geography: 'Portugal', market: 'Non-life insurance, Portugal', market_size: null, client_size: null, competitors: [],
  summary: 'TEST FIXTURE. Topic: claims operating model at a Portuguese non-life insurer; market and client size unknown.' };
const T = s => s; // fixture text is labeled in source names
const topic = { slide: { slide_id: 'market_context_topic', title: 'Two of three test findings concern claims handling rules and peers', not_covered: [], rows: [
  { actor: 'Supervisor (test fixture)', actor_type: 'regulator', dimension: 'constraints', scope_risk: 'high',
    summary: 'Sets response-time rules any new claims model must meet.',
    context: { text: 'Supervisors reviewed non-life claims response times in 2025.', refs: [1] },
    action: { text: 'The supervisor issued guidance on claims-handling response times in 2025.', refs: [1] },
    result: { text: 'Not yet reported', refs: [] }, why_it_matters_to_scope: 'Adds a regulatory constraint to the target model design.' },
  { actor: 'Peer insurer (test fixture)', actor_type: 'company', dimension: 'peer_moves', scope_risk: 'medium',
    summary: 'Shows one way a peer reorganized property claims triage.',
    context: { text: 'Property claims volumes rose after the 2025 storm season.', refs: [2] },
    action: { text: 'A peer insurer centralized property claims triage in one hub in 2025.', refs: [2] },
    result: { text: 'The peer reported shorter triage times in its 2025 annual report.', refs: [2] }, why_it_matters_to_scope: 'Gives a comparison for the options work.' },
  { actor: 'Statistics office (test fixture)', actor_type: 'statistics_office', dimension: 'drivers', scope_risk: 'none',
    summary: 'Sizes the rise in property claims that loads the current model.',
    context: { text: 'Storm damage was concentrated in coastal regions in 2025.', refs: [3] },
    action: { text: 'The statistics office reported a rise in property damage claims in 2025.', refs: [3] },
    result: { text: 'Not yet reported', refs: [] }, why_it_matters_to_scope: 'Context only; no effect on scope.' } ] },
  sources: [
    { ref: 1, source_name: 'TEST FIXTURE supervisor', source_title: 'Not a real source', source_url: 'https://example.com/1', source_date: '2025-06' },
    { ref: 2, source_name: 'TEST FIXTURE peer', source_title: 'Not a real source', source_url: 'https://example.com/2', source_date: '2026-03' },
    { ref: 3, source_name: 'TEST FIXTURE statistics', source_title: 'Not a real source', source_url: 'https://example.com/3', source_date: '2026-01' } ],
  search_quality: 'thin' };
const plan = jl('phase_architect/runs/r5_B.json');
const mode = process.argv[2] || 'valid';
// Copywriter: faithful copy of each draft, cut to its limit (computed from the seed table + this research).
const rules = jl('variables/template_variables.json');
const lim = Object.fromEntries(rules.map(r => [r.variable, Number(r.max_chars) || null]));
const items = [];
topic.slide.rows.forEach((r, i) => {
  const nn = String(i + 1).padStart(2, '0');
  items.push({ variable: `finding_${nn}_headline`, text: r.summary });
  items.push({ variable: `finding_${nn}_context`, text: r.context.text });
  items.push({ variable: `finding_${nn}_action_taken`, text: r.action.text });
  if (r.result.text !== 'Not yet reported') items.push({ variable: `finding_${nn}_result_achieved`, text: r.result.text });
});
// Template 1.4 (mode s1): the Context Writer is pinned too, and the Copywriter returns its texts as written.
const ctxWriter = jl('n8n/tests/fixtures/context_writer_atlantico.json');
if (mode === 's1') {
  const o = ctxWriter.output;
  items.push({ variable: 'situation_title_01', text: o.situation_title });
  o.situation.forEach((t, i) => items.push({ variable: `situation_0${i + 1}`, text: t }));
  items.push({ variable: 'belief_01', text: o.belief });
}
const w = j => [{ json: j }];
const pins = {
  'Test brief (no email)': w({ headers: { 'x-jml-test': 'pinned' }, params: {}, query: {}, body: { id: 'test-pa-v2-pinned', threadId: 'test-thread', subject: 'Proposal: claims operating model for Atlântico Seguros', text: email, from: { value: [{ address: 'test@example.com', name: 'Test' }], text: 'Test <test@example.com>' } } }),
  'Brief Organizer': w({ output: brief }),
  'Client Profiler': w({ output: profile }),
  'Topic researcher': w({ output: topic }),
  'Phase Architect': w(mode === 'invalid' ? { output: jl('phase_architect/runs/r2_B2.json') } : (mode === 'error' ? { error: 'Payment required - perhaps check your payment details?' } : { output: plan })),
  ...(mode === 's1' ? { 'Context Writer': w(ctxWriter) } : {}),
  'Copywriter': w({ output: { items } }),
  'Copywriter retry': w({ output: { items } }),
  'Build deck': w({ pinned: 'render skipped in the wiring test' }),
  'Reply with deck': w({ id: 'x' }), 'Mark handled (deck sent)': w({ id: 'x' }),
  'Reply without deck': w({ id: 'x' }), 'Mark handled (deck failed)': w({ id: 'x' }),
  'Reply with missing info': w({ id: 'x' }), 'Mark handled (questions)': w({ id: 'x' }),
};
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', `pins_${mode}.json`), JSON.stringify(pins));
console.log(mode, JSON.stringify(pins).length);
