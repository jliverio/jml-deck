// Cell check (Code, run once for each item). Input: one Company Reader answer ({ output, intermediateSteps }).
// Every cell: its page was opened in this call, its page is on the company's own domain, its passage is in the page
// text, its value is in the passage, its attribute is in the set. Cells keep an `ok` flag and a list of faults;
// nothing is dropped here, the table builder decides.
const out = $json.output || {};
const cfg = $('Research method').first().json;
const attrIds = cfg.method.attributes.map(a => a.id);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const host = u => { try { return new URL(String(u)).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
const urlKey = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const parseObs = o => { if (typeof o !== 'string') return o; try { return JSON.parse(o); } catch (e) { return null; } };
// pages opened in this call, with their text
const pages = {}; let reads = 0, searches = 0;
for (const st of ($json.intermediateSteps || [])) {
  const tool = String(((st || {}).action || {}).tool || ''); const obs = parseObs((st || {}).observation);
  if (/search/i.test(tool)) searches += 1;
  if (/read/i.test(tool)) { reads += 1; const list = Array.isArray(obs) ? obs : [obs]; for (const p of list) if (p && p.url) pages[urlKey(p.url)] = norm(p.text || ''); }
}
const domainUsed = out.domain_used ? host('https://' + String(out.domain_used).replace(/^https?:\/\//, '')) : null;
const company = out.company || '';
const cells = (Array.isArray(out.cells) ? out.cells : []).map(c => {
  const faults = [];
  if (!attrIds.includes(c.attribute)) faults.push('attribute_not_in_set');
  const h = host(c.url);
  if (!c.url) faults.push('no_url');
  else if (domainUsed && !(h === domainUsed || h.endsWith('.' + domainUsed) || domainUsed.endsWith('.' + h))) faults.push('url_not_on_own_domain_' + h);
  const text = pages[urlKey(c.url)];
  if (text === undefined) faults.push('page_not_opened');
  else if (!text.includes(norm(c.passage))) faults.push('passage_not_in_page');
  const val = norm(c.value); const firstVal = val.split(/[,;]/)[0].trim();
  if (!c.value) faults.push('no_value');
  else if (!norm(c.passage).includes(firstVal.slice(0, 40))) faults.push('value_not_in_passage');
  if (!c.unit) faults.push('no_unit');
  if (!c.basis) faults.push('no_basis');
  return { ...c, company, ok: faults.length === 0, faults };
});
const covered = new Set(cells.filter(c => c.ok).map(c => c.attribute));
const missing = attrIds.filter(a => !covered.has(a));
return { json: { company, role: null, domain_used: out.domain_used || null, cells, not_found: out.not_found || [], missing, pages_opened: out.pages_opened || [], reads, searches, ok_cells: cells.filter(c => c.ok).length, faulty_cells: cells.filter(c => !c.ok).length } };
