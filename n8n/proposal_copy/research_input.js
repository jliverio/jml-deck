// Step 6 (23 Nov): what the market research is asked for. It replaces the Offering and Topic researchers and runs
// for every brief whose client has a website the Client Profiler could confirm.
const j = $input.first().json || {};
const prof = j.output || {};
const s = (v) => String(v === undefined || v === null ? '' : v).trim();
let url = s(prof.client_url);
if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
const company = s(prof.client_name);
let why_not = '';
if (!company) why_not = 'The brief names no client.';
else if (!/^https?:\/\/[^\s\/]+\.[a-z]{2,}/i.test(url)) why_not = 'No website was found for ' + company + '.';
else if (prof.client_verified === false) why_not = company + ' could not be confirmed online, so its website was not researched.';
// Time limit (23 Nov): the flow starts the research and does not wait inside it. It makes the run id here, so it can
// read the research's rows in run_log, and stops waiting after research_limit_s seconds (12 minutes).
const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'company';
// A test brief may set a shorter limit ("research_limit_s" in its body), to prove that the flow goes on without the research.
let limit = 720;
try { const t = Number((($('Test brief (no email)').first().json.body) || {}).research_limit_s); if (t >= 20 && t <= 720) limit = t; } catch (e) { limit = 720; }
// Product in focus (23 Nov, after step 7): the brief's own subject when the brief is about something the client sells
// (the Client Profiler's problem_focus is offering or both). Without it the research picked the product the client's
// home page leads with: a current account for a brief on small business lending. A brief about anything else (a topic)
// leaves it empty, and the research describes the client's lead product as before.
const product = ['offering', 'both'].includes(prof.problem_focus) ? s(prof.product).slice(0, 120) : '';
return [{ json: { research_go: !why_not, why_not, company, url: why_not ? '' : url, product: why_not ? '' : product, folder_name: '', max_pages: 60, test_force_fail: 0, test_force_fail_always: false,
  run_id: why_not ? '' : 'run-par-' + slug + '-' + Date.now(), research_started_at: new Date().toISOString(), research_limit_s: limit } }];
