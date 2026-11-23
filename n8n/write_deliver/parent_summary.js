// The outcome of the whole run, read from run_log: each stage's time and result, the Doc link and the total time.
// Step 4 (23 Nov): hands on the PDF copy of the report (pdf_file_id, pdf_name, pdf_url); a report with no PDF makes the run partial.
// Batch A (22 Nov): the run is partial, never ok, when the crawl stored fewer than 5 pages (Crawl logs that as partial) or a stage ended in error. "reasons" says in plain words why a run is partial.
const start = $('Start').first().json;
const get = (name) => { try { return $(name).first().json || {}; } catch (e) { return null; } };
const rows = $input.all().map(i => i.json).filter(r => r && r.run_id === start.run_id && r.stage !== 'parent');
const ORDER = ['crawl', 'map', 'position_product', 'claims', 'regulator', 'pricing', 'competitors', 'challenge', 'code_checks', 'write'];
rows.sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
const stages = rows.map(r => ({ stage: r.stage, started_at: r.started_at, ended_at: r.ended_at, duration_s: r.duration_s, outcome: r.outcome, note: String(r.note || '').slice(0, 200) }));
const w = get('Write and deliver') || {};
const b = get('Before writing') || {};
const p = get('Stages done?') || {};
const c = get('Crawl') || {};
const ended = new Date();
const duration_s = Math.round((ended.getTime() - new Date(start.started_at).getTime()) / 100) / 10;
const research = rows.filter(r => ['position_product', 'claims', 'regulator', 'pricing', 'competitors', 'challenge'].includes(r.stage));
const rs = research.map(r => Date.parse(r.started_at)).filter(Boolean);
const re = research.map(r => Date.parse(r.ended_at)).filter(Boolean);
const research_window_s = rs.length && re.length ? Math.round((Math.max(...re) - Math.min(...rs)) / 100) / 10 : null;
const bad = stages.filter(s => s.outcome === 'error' || s.outcome === 'running');
const timedOut = (p.state && p.state.timed_out) || [];
const crawlRow = rows.filter(r => r.stage === 'crawl').pop();
const pages = c.pages_fetched === undefined ? (crawlRow ? crawlRow.pages_fetched : null) : c.pages_fetched;
const thin = (crawlRow && crawlRow.outcome === 'partial') || c.outcome === 'partial' || (pages !== null && pages !== undefined && Number(pages) < 5);
const reasons = [];
if (!w.doc_url) reasons.push('no report was created');
if (w.doc_url && !w.pdf_file_id) reasons.push('the PDF of the report was not made');
if (thin) reasons.push('thin crawl: ' + (pages === null || pages === undefined ? 'few' : pages) + ' page' + (Number(pages) === 1 ? '' : 's') + ' stored');
if (bad.length) reasons.push(bad.length + ' stage' + (bad.length === 1 ? '' : 's') + ' without a result: ' + [...new Set(bad.map(s => s.stage))].join(', '));
if (timedOut.length) reasons.push('timed out: ' + timedOut.join(', '));
if (b.failed_left) reasons.push(b.failed_left + ' entr' + (b.failed_left === 1 ? 'y' : 'ies') + ' failed the checks and ' + (b.failed_left === 1 ? 'is' : 'are') + ' left out of the report');
const outcome = !w.doc_url ? 'error' : (reasons.length ? 'partial' : 'ok');
const note = 'Parallel parent. ' + (w.doc_url ? 'Report: ' + w.doc_url : 'No report was created') + '; research stages took ' + research_window_s + ' s side by side; ' + bad.length + ' stages without a result; fix loops: ' + (b.fix_loops || 0) + '; ' + Math.round(duration_s) + ' s in total' + (reasons.length && w.doc_url ? '; partial because: ' + reasons.join('; ') : '');
return [{ json: { run_id: start.run_id, stage: 'parent', mode: 'parallel', company: start.company, ended_at: ended.toISOString(), duration_s, research_window_s, polls: p.state ? p.state.polls : null, timed_out: timedOut, outcome, reasons, pages_stored: pages === undefined ? null : pages, failed_left: b.failed_left || 0, note: note.slice(0, 900), doc_url: w.doc_url || '', pdf_file_id: w.pdf_file_id || '', pdf_name: w.pdf_name || '', pdf_url: w.pdf_url || '', words: w.words === undefined ? null : w.words, fix_loops: b.fix_loops || 0, stages } }];