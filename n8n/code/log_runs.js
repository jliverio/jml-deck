// Code node "Build log rows" of the workflow "JML run logger" (n8n/workflows/run_logger.sdk.js).
// Turns finished executions of "Proposal request → scoping deck reply" into rows for the
// JML_Financial_Model sheet: one Run log row per execution, and one Agent log row per agent
// for full builds (Brief Organizer only for questions-only runs).
// Inputs: $('Read sheet').first().json  (values:batchGet of Run log!A6:A, Agent log!A6:A, Prices!A24:F28, Inputs!B68:B77)
//         $input.all()                   (one item per execution, from GET /api/v1/executions/{id}?includeData=true)
// Output: one item { body, runs, agentRows, skippedAlreadyLogged } for spreadsheets.values:batchUpdate (body null when nothing is new).
//
// Rules agreed with the CFO (claude/CFO_to_IT_Tab_Ownership_Oct17.md):
// - write data columns only: Run log A–M and S–X, Agent log A–J and L (never the formula columns);
// - Category: "Live run", "Live questions", "Test round N", "Debug"; never "Full build (current pipeline)";
// - Purpose: Live (sender domain on Inputs Firm_Domains), Measurement (test tags; any other outside sender, Sample
//   "Unlisted sender") or Debug (manual runs, untagged webhooks, internal senders, [DEBUG]);
// - confidentiality: for Live and unlisted-sender runs the Brief column holds the Gmail thread ID, never the subject,
//   and error text (which can quote the subject) is left out of the notes;
// - an execution already in Run log column A is skipped, so running twice never logs twice.

const PA_SPEED = 156.2;   // tokens/s, measured on 28 Phase Architect calls with reported usage (IT workbook v1)
const PA_INPUT = 11553;   // input tokens per Phase Architect call, same sample
const INTERNAL_DOMAINS = ['jml-ops.com', 'example.com'];   // senders treated as Debug unless the subject is tagged
const TEST_TAG = /\[(B0|T[1-9]\d?)(-[A-Za-z0-9]+)?\]/;     // [B0], [T1] … [T99], optional suffix such as [T2-PDF]

const AGENTS = [
  ['Brief Organizer', ['Model: Brief Organizer']],
  ['Client Profiler', ['Model: Client Profiler', 'Model: Profiler fixer']],
  ['Offering researcher', ['Model: Offering researcher', 'Model: Offering fixer']],
  ['Topic researcher', ['Model: Topic researcher', 'Model: Topic fixer']],
  ['Phase Architect', ['Model: Phase Architect']],
  ['Copywriter', ['Model: Copywriter', 'Model: Copywriter retry']],
  ['Summary Writer', ['Model: Summary Writer', 'Model: Summary Writer retry']],
  ['Context Writer', ['Model: Context Writer', 'Model: Context Writer retry']],
];

function logRows(sheet, executions) {
  const ranges = sheet.valueRanges || [];
  const col = (i) => ((ranges[i] || {}).values || []).map((r) => String(r[0] ?? '').trim());
  const runCol = col(0);                           // rows in use below row 5
  const loggedRuns = runCol.filter(Boolean);
  const agentRowsUsed = col(1).length;            // rows in use below row 5 (blank rows inside the block count)
  const prices = (ranges[2] || {}).values || [];   // A name … F gateway id
  const modelByGateway = {};
  for (const p of prices) if (p[0] && p[5]) modelByGateway[String(p[5]).trim()] = String(p[0]).trim();
  const known = new Set(Object.values(modelByGateway));
  const firmDomains = new Set(col(3).map((d) => d.toLowerCase().replace(/^@/, '')).filter(Boolean));
  const done = new Set(loggedRuns);
  let skipped = 0;

  const g = (o, ...ks) => { for (const k of ks) { if (o == null || typeof o !== 'object') return undefined; o = o[k]; } return o; };
  const first = (data, key) => { try { return data[key][0][0].json; } catch (e) { return undefined; } };
  const round = (x) => Math.round(x);

  const runRows = [];
  const agentRows = [];
  const sorted = executions.slice().sort((a, b) => Number(a.id) - Number(b.id));
  for (const raw of sorted) {
    const ex = raw.execution || raw;
    const data = raw.data || ex.data || {};
    const id = String(ex.id);
    if (done.has(id)) { skipped += 1; continue; }
    if (!['success', 'error', 'crashed', 'canceled'].includes(ex.status)) continue;   // still running or waiting
    const res = data.resultData || {};
    const rd = res.runData || {};
    const has = (n) => Array.isArray(rd[n]) && rd[n].length > 0;

    // --- what kind of run is this?
    let trig = {}, source = 'manual';
    if (has('New proposal request')) { source = 'email'; trig = first(rd['New proposal request'][0].data || {}, 'main') || {}; }
    else if (has('Test brief (no email)')) { source = 'webhook'; trig = first(rd['Test brief (no email)'][0].data || {}, 'main') || {}; }
    const body = source === 'webhook' ? (trig.body || {}) : {};
    const subject = String(source === 'email' ? trig.subject || '' : body.subject || '').trim();
    const threadId = String(source === 'email' ? trig.threadId || '' : body.log_brief_id || body.threadId || body.id || '').trim();
    const fromText = JSON.stringify(source === 'email' ? trig.from || '' : body.from || '');
    const internal = INTERNAL_DOMAINS.some((d) => fromText.toLowerCase().includes('@' + d));
    const senderDomains = (fromText.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/g) || []).map((x) => x.slice(1));
    const listedFirm = senderDomains.some((d) => firmDomains.has(d));
    const tag = subject.match(TEST_TAG);
    let purpose, sample = 'n/a', round_ = 1;
    if (ex.mode === 'manual') purpose = 'Debug';
    else if (source === 'webhook') {
      purpose = ['Live', 'Measurement', 'Debug'].includes(body.log_purpose) ? body.log_purpose : 'Debug';
      if (purpose === 'Measurement') { sample = String(body.log_sample || 'n/a'); round_ = Number(body.log_round) || 1; }
    } else if (/\[DEBUG\]/i.test(subject)) purpose = 'Debug';
    else if (tag) { purpose = 'Measurement'; sample = tag[1] + (tag[2] || ''); }
    else if (internal) purpose = 'Debug';
    else if (listedFirm) purpose = 'Live';
    else { purpose = 'Measurement'; sample = 'Unlisted sender'; }
    const confidential = purpose === 'Live' || sample === 'Unlisted sender';

    const questionsOnly = has('Reply with missing info') && !has('Client Profiler');
    const fullBuild = has('Client Profiler') || has('Phase Architect');
    const category = purpose === 'Live' ? (questionsOnly ? 'Live questions' : 'Live run')
      : purpose === 'Measurement' ? 'Test round ' + round_ : 'Debug';
    if (purpose === 'Live') sample = 'Live';

    // --- outcome
    let status = ex.status;
    const errMsg = String(g(res, 'error', 'message') || '');
    const noDeck = has('Reply without deck') || has('Flag deck failure');
    if (noDeck) status = 'error';
    let cause = '';
    if (status !== 'success') {
      const last = String(res.lastNodeExecuted || '');
      if (/payment required/i.test(errMsg) || JSON.stringify(rd).includes('Payment required')) cause = 'Credits exhausted';
      else if (noDeck || /Build deck|Deck built|Wake renderer|render/i.test(last + ' ' + errMsg)) cause = 'Renderer';
      else if (/Phase Architect|Validate plan|Plan valid/i.test(last)) cause = 'Plan check';
      else if (/Profiler|researcher|Check topic|Check offering|checkProfiler|Merge market|Assemble market/i.test(last)) cause = 'Research loop';
      else if (/Reply with missing info/i.test(last)) cause = 'Reply email';
      else cause = 'Other: ' + (last || errMsg).slice(0, 60);
    }

    // --- model calls, by agent
    const nodeModel = (nodeName) => {
      const n = (g(raw, 'workflowData', 'nodes') || g(ex, 'workflowData', 'nodes') || []).find((x) => x.name === nodeName);
      let m = n && n.parameters ? n.parameters.model : undefined;
      if (m && typeof m === 'object') m = m.value;
      m = String(m || '').trim();
      return modelByGateway[m] || (known.has(m) ? m : '');
    };
    const per = {};
    let calls = 0, inp = 0, outp = 0, rebuilt = false, unknownModel = '';
    for (const [node, runs] of Object.entries(rd)) {
      const isModel = node.startsWith('Model: ') || runs.some((r) => r && r.data && r.data.ai_languageModel);
      if (!isModel) continue;
      const agent = (AGENTS.find(([, nodes]) => nodes.includes(node)) || [node.replace(/^Model: /, '')])[0];
      const a = per[agent] || (per[agent] = { n: 0, inp: 0, outp: 0, ms: 0, model: '', rebuilt: false });
      for (const run of runs) {
        const mm = JSON.stringify(run.inputOverride || {}).match(/"model"\s*:\s*"([^"]+)"/);
        const m = mm ? (modelByGateway[mm[1]] || (known.has(mm[1]) ? mm[1] : '')) : nodeModel(node);
        if (m) a.model = m; else if (!a.model) unknownModel = node + (mm ? ' (' + mm[1] + ')' : '');
        const j = first(run.data || {}, 'ai_languageModel') || {};
        let p = 0, c = 0;
        if (j.tokenUsage) { p = j.tokenUsage.promptTokens || 0; c = j.tokenUsage.completionTokens || 0; }
        else if (j.tokenUsageEstimate) {
          p = j.tokenUsageEstimate.promptTokens || 0; c = j.tokenUsageEstimate.completionTokens || 0;
          if (node === 'Model: Phase Architect') { p = PA_INPUT; c = (run.executionTime || 0) / 1000 * PA_SPEED; a.rebuilt = rebuilt = true; }
        } else if (!run.error) { /* no usage reported and no error: counts as a call with 0 tokens */ }
        a.n += 1; a.inp += p; a.outp += c; a.ms += run.executionTime || 0;
        calls += 1; inp += p; outp += c;
      }
    }

    // --- tools: billed searches = search tool runs without an error; page-read credits from the read-page output
    let searches = 0, credits = 0;
    for (const [node, runs] of Object.entries(rd)) {
      if (node.startsWith('Search: ')) searches += runs.filter((r) => !r.error).length;
      if (node.startsWith('Read page: ')) for (const r of runs) {
        const m = JSON.stringify(r.data || {}).match(/credits_used\\*"?\s*:\s*(\d+(?:\.\d+)?)/);
        if (m) credits += Number(m[1]);
      }
    }

    const t0 = Date.parse(ex.startedAt), t1 = Date.parse(ex.stoppedAt);
    const notes = [questionsOnly ? 'Questions reply' : fullBuild ? (status === 'success' ? 'Deck sent' : 'No deck') : 'No build',
      unknownModel ? 'model of ' + unknownModel + ' not in Prices: priced as Sonnet 5.5' : '',
      errMsg && !confidential ? 'Error: ' + errMsg.replace(/\s+/g, ' ').slice(0, 120) : ''].filter(Boolean).join('; ');
    const tokenSource = rebuilt ? 'Rebuilt: Phase Architect thinking from model time' : calls ? 'Reported by n8n' : 'No model calls';
    const version = String(ex.workflowVersionId || g(raw, 'workflowData', 'versionId') || g(ex, 'workflowData', 'versionId') || '');
    runRows.push({
      am: [Number(id), String(ex.startedAt || '').replace('T', ' ').slice(0, 16), confidential ? threadId : subject.slice(0, 120), category, status, cause,
        isFinite(t1 - t0) ? round((t1 - t0) / 1000) : '', calls, round(inp), round(outp), searches, credits, sample],
      sx: [threadId, version || 'unknown', '', notes, tokenSource, purpose],
    });

    const agentList = questionsOnly ? ['Brief Organizer'] : fullBuild ? AGENTS.map((x) => x[0]).filter((n) => n !== 'Context Writer' || per[n]) : Object.keys(per);
    for (const name of agentList) {
      const a = per[name] || { n: 0, inp: 0, outp: 0, ms: 0, model: '', rebuilt: false };
      agentRows.push({
        aj: [Number(id), name, a.n, round(a.inp), round(a.outp), Math.round(a.ms / 100) / 10, sample, a.model || 'Sonnet 5.5', '', ''],
        l: [a.rebuilt ? 'Rebuilt: thinking from model time' : 'Reported by n8n'],
      });
    }
  }
  if (!runRows.length) return [{ json: { body: null, runs: 0, agentRows: 0, skippedAlreadyLogged: skipped } }];

  const runStart = 6 + runCol.length;
  const agentStart = 6 + agentRowsUsed;
  const dataRanges = [];
  runRows.forEach((r, i) => {
    const row = runStart + i;
    dataRanges.push({ range: `'Run log'!A${row}:M${row}`, values: [r.am] });
    dataRanges.push({ range: `'Run log'!S${row}:X${row}`, values: [r.sx] });
  });
  agentRows.forEach((r, i) => {
    const row = agentStart + i;
    dataRanges.push({ range: `'Agent log'!A${row}:J${row}`, values: [r.aj] });
    dataRanges.push({ range: `'Agent log'!L${row}`, values: [r.l] });
  });
  return [{ json: { body: { valueInputOption: 'RAW', data: dataRanges }, runs: runRows.length, agentRows: agentRows.length,
    skippedAlreadyLogged: skipped, firstRunRow: runStart, firstAgentRow: agentStart } }];
}

// n8n entry point (Code node, run once for all items). Not executed when this file is required by a test.
if (typeof $input !== 'undefined') {
  const out = logRows($('Read sheet').first().json, $input.all().map((i) => i.json));
  out[0].json.skippedAlreadyLogged += Number($('Pick new runs').first().json.skippedAlreadyLogged) || 0;
  return out;
}
if (typeof module !== 'undefined') module.exports = { logRows };
