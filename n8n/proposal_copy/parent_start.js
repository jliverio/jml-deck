// "Start" of the research parent (Krt2web1P1RxyWii), as changed for plan step 6 (23 Nov).
// One run id for the whole research run. Every stage writes its rows under it.
// 23 Nov: the proposal flow may name the run id itself (run_id), so it can follow the run in run_log while it waits.
const j = $input.first().json || {};
const s = (v) => String(v === undefined || v === null ? '' : v).trim();
const company = s(j.company);
let url = s(j.url);
if (!company || !url) throw new Error('The research needs the company name and its website.');
if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'company';
const force = Number(j.test_force_fail) || 0;
const given = s(j.run_id);
const run_id = /^run-[a-z0-9-]{6,80}$/.test(given) ? given : 'run-par-' + slug + '-' + Date.now();
return [{ json: { run_id, company, url, product: s(j.product), folder_name: s(j.folder_name), max_pages: Number(j.max_pages) || 60, force_first: force, force_later: j.test_force_fail_always === true ? force : 0, started_at: new Date().toISOString() } }];
