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
return [{ json: { research_go: !why_not, why_not, company, url: why_not ? '' : url, product: '', folder_name: '', max_pages: 60, test_force_fail: 0, test_force_fail_always: false } }];
