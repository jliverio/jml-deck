// Research state (Code, run once for all items). Step 6, the time limit (23 Nov).
// "Market research" starts the research and does not wait for it. Every 20 seconds this node reads the research's
// rows in run_log and says whether the flow can go on:
//   done     the research logged its end; its result (outcome, report, PDF) is read from the row
//   failed   the client's website could not be read: the research has stopped
//   timeout  the limit (12 minutes) has passed: the flow goes on without the research slides. The research may still
//            end later; its report then stays in Drive, unused.
//   wait     none of these yet
const inp = $('Research input').first().json || {};
const rows = $input.all().map(i => i.json).filter(r => r && r.run_id && r.run_id === inp.run_id);
const parent = rows.find(r => r.stage === 'parent');
const crawl = rows.filter(r => r.stage === 'crawl').pop();
const limit = Number(inp.research_limit_s) || 720;
const waited_s = Math.max(0, Math.round((Date.now() - Date.parse(inp.research_started_at)) / 1000));
let state = 'wait', why = '', result = {};
if (parent && parent.outcome && parent.outcome !== 'running' && parent.ended_at) {
  state = 'done';
  try { result = JSON.parse(parent.result_json || '{}') || {}; } catch (e) { result = {}; }
  if (!result.outcome) result.outcome = String(parent.outcome);
  if (result.duration_s === undefined) result.duration_s = parent.duration_s;
} else if (crawl && crawl.outcome === 'error' && crawl.ended_at) {
  state = 'failed';
  why = "The client's website could not be read.";
} else if (!(waited_s < limit)) {
  state = 'timeout';
  why = 'The market research had not finished after ' + Math.round(limit / 60) + ' minutes.';
}
const done = state === 'done';
const text = (v) => (done && v ? String(v) : '');
return [{ json: { state, why, waited_s, run_id: String(inp.run_id || ''), outcome: text(result.outcome), reasons: done && Array.isArray(result.reasons) ? result.reasons : [],
  doc_url: text(result.doc_url), pdf_file_id: text(result.pdf_file_id), pdf_name: text(result.pdf_name), pdf_url: text(result.pdf_url),
  duration_s: done && result.duration_s !== undefined ? result.duration_s : null },
  // Several rows come in and one item goes out: the link to the first row keeps later nodes able to trace back to the brief.
  pairedItem: { item: 0 } }];
