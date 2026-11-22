// The run to write slide values for. The parent passes the run id, the company and its website.
const j = $input.first().json || {};
const s = (v) => String(v === undefined || v === null ? '' : v).trim();
const run_id = s(j.run_id);
if (!run_id) throw new Error('Slide values needs the run id of a research run.');
return [{ json: { run_id, company: s(j.company), website: s(j.website), started_at: new Date().toISOString() } }];
