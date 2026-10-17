// node n8n/tests/log_runs_test.js — checks the run logger's classification rules on synthetic executions.
const assert = require('assert');
const { logRows } = require('../code/log_runs.js');

const sheet = { valueRanges: [
  { values: [['4'], ['900']] },                       // Run log A: 900 already logged
  { values: [['50'], ['50']] },
  { values: [['Sonnet 5.5', '', '', '', '', 'claude-sonnet-5-5']] },
  { values: [['acmeconsult.pt']] },                   // Firm_Domains
] };
const model = (tokens) => [{ executionTime: 1000, inputOverride: { ai_languageModel: [[{ json: { options: { model: 'claude-sonnet-5-5' } } }]] },
  data: { ai_languageModel: [[{ json: { tokenUsage: tokens } }]] } }];
const email = (id, from, subject, extra = {}) => ({ id: String(id), mode: 'trigger', status: 'success',
  startedAt: '2026-10-20T09:00:00.000Z', stoppedAt: '2026-10-20T09:05:00.000Z',
  data: { resultData: { lastNodeExecuted: 'x', runData: Object.assign({
    'New proposal request': [{ data: { main: [[{ json: { threadId: 'thr' + id, subject, from: { value: [{ address: from }] } } }]] } }],
    'Model: Brief Organizer': model({ promptTokens: 1000, completionTokens: 500 }),
  }, extra) } } });
const full = { 'Client Profiler': [{ data: {} }], 'Phase Architect': [{ data: {} }] };
const questions = { 'Reply with missing info': [{ data: {} }] };

const out = logRows(sheet, [
  email(900, 'x@acmeconsult.pt', 'Dup'),                                         // already logged -> skipped
  email(901, 'partner@acmeconsult.pt', 'Proposal - Secret Client SA', full),     // Live, masked
  email(902, 'someone@gmail.com', 'Proposal - Other Client', questions),         // Unlisted sender, masked, questions
  email(903, 'jose.liverio@jml-ops.com', 'Proposal - internal', full),           // Debug
  email(904, 'partner@acmeconsult.pt', '[T3] Proposal - test', full),            // Measurement T3
]);
const j = out[0].json;
const rows = {};
for (const d of j.body.data) if (/'Run log'!A/.test(d.range)) rows[d.values[0][0]] = d.values[0];
const sx = {};
for (const d of j.body.data) if (/'Run log'!S/.test(d.range)) sx[d.range] = d.values[0];

assert.strictEqual(j.skippedAlreadyLogged, 1);
assert.strictEqual(j.runs, 4);
assert.ok(!rows[900]);
assert.deepStrictEqual([rows[901][2], rows[901][3], rows[901][12]], ['thr901', 'Live run', 'Live']);
assert.deepStrictEqual([rows[902][2], rows[902][3], rows[902][4], rows[902][5], rows[902][12]], ['thr902', 'Test round 1', 'success', '', 'Unlisted sender']);
assert.deepStrictEqual([rows[903][2], rows[903][3]], ['Proposal - internal', 'Debug']);
assert.deepStrictEqual([rows[904][3], rows[904][12]], ['Test round 1', 'T3']);
assert.ok(!JSON.stringify(j.body).includes('Secret Client'), 'client name leaked');
assert.ok(!JSON.stringify(j.body).includes('Other Client'), 'unlisted client name leaked');
// running again with everything logged -> nothing new
const again = logRows({ valueRanges: [{ values: [['900'], ['901'], ['902'], ['903'], ['904']] }, sheet.valueRanges[1], sheet.valueRanges[2], sheet.valueRanges[3]] },
  [email(901, 'partner@acmeconsult.pt', 'x', full)]);
assert.strictEqual(again[0].json.runs, 0);
assert.strictEqual(again[0].json.skippedAlreadyLogged, 1);
console.log('log_runs: all checks pass');
