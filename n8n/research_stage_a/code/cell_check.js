// Cell check (Code, run once for each item). Input: one Company Reader answer ({ output, intermediateSteps }).
// Every cell: its page was opened in this call, its page is on the company's own domain, its passage is in the page
// text, its value is in the passage, its attribute is in the set. Cells keep an `ok` flag and a list of faults;
// nothing is dropped here, the table builder decides.
const out = $json.output || {};
const cfg = $('Research method').first().json;
const attrIds = cfg.method.attributes.map(a => a.id);
const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u00a0/g, ' ').replace(/[*_#`>\[\]()|]/g, '').replace(/\s+/g, ' ').trim();   // markdown marks the read-page tool keeps and a quoting model drops
// A passage may join several excerpts with '...' or '…'; every part of at least 15 characters must be in the page.
const inPage = (text, passage) => { const whole = norm(passage); let parts = whole.split(/\.{3}|\u2026/).map(x => x.trim()).filter(x => x.length >= 15); if (!parts.length && whole.length >= 5) parts = [whole]; return parts.length > 0 && parts.every(p => text.includes(p)); };   // a short passage ('3533 articulos') is checked whole
const host = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '');
const urlKey = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const parseObs = o => { if (typeof o !== 'string') return o; try { return JSON.parse(o); } catch (e) { return null; } };
// pages opened in this call, with their text
const pages = {}; let reads = 0, searches = 0;
for (const st of ($json.intermediateSteps || [])) {
  const tool = String(((st || {}).action || {}).tool || ''); const obs = parseObs((st || {}).observation);
  if (/search/i.test(tool)) searches += 1;
  if (/read/i.test(tool)) { reads += 1; const list = Array.isArray(obs) ? obs : [obs]; for (const p of list) if (p && p.url) pages[urlKey(p.url)] = norm(p.text || ''); }
}
const ownDomains = String(out.domain_used || '').split(/[,;\s]+/).map(x => host(x)).filter(Boolean);   // the site and its own store, when the store sits on another domain
const onOwn = h => ownDomains.some(d => h === d || h.endsWith('.' + d) || d.endsWith('.' + h));
const FIGURE = new Set(['list_price', 'range_size', 'launches_24m', 'scale']);
const company = out.company || '';
const cells = (Array.isArray(out.cells) ? out.cells : []).map(c => {
  const faults = [];
  if (!attrIds.includes(c.attribute)) faults.push('attribute_not_in_set');
  const h = host(c.url);
  if (!c.url) faults.push('no_url');
  else if (ownDomains.length && !onOwn(h)) faults.push('url_not_on_own_domain_' + h);
  const text = pages[urlKey(c.url)];
  if (text === undefined) faults.push('page_not_opened');
  else if (!inPage(text, c.passage)) faults.push('passage_not_in_page');
  // A figure's value must be in the passage: the first number of the value (digits with their separators) is looked for.
  const num = (String(c.value || '').match(/\d[\d.,]*/) || [])[0];
  if (!c.value) faults.push('no_value');
  else if (FIGURE.has(c.attribute) && (!num || !String(c.passage || '').includes(num))) faults.push('value_not_in_passage');   // lists and quotes are paraphrased by nature
  if (!c.unit) faults.push('no_unit');
  if (!c.basis) faults.push('no_basis');
  return { ...c, company, ok: faults.length === 0, faults };
});
const covered = new Set(cells.filter(c => c.ok).map(c => c.attribute));
const missing = attrIds.filter(a => !covered.has(a));
return { json: { company, role: null, domain_used: ownDomains.join(',') || null, cells, not_found: out.not_found || [], missing, pages_opened: out.pages_opened || [], reads, searches, ok_cells: cells.filter(c => c.ok).length, faulty_cells: cells.filter(c => !c.ok).length } };
