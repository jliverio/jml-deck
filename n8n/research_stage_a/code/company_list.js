// Company list (Code, run once for all items). Input: L1 result. Output: one item per company to read: the client first,
// then the competitors that have a name; each item carries what the Company Reader needs.
const r = $input.first().json;
const cfg = $('Research method').first().json;
const frame = (r.records || {}).frame || {};
const comps = (r.records || {}).competitors || [];
const clientName = String(cfg.brief.hard_fields.client.value || '').split(',')[0].trim();
const items = [{ company: { name: clientName, role: 'client', domain: frame.client_domain || null, country: ((frame.home_geography || {}).countries || [])[0] || null } }];
for (const c of comps) if (c && c.name) items.push({ company: { name: c.name, role: 'competitor', domain: c.domain || null, country: c.country || null, status: c.status } });
return items.map(x => ({ json: { ...x, attributes: cfg.method.attributes, frame: { market: frame.market, segment: frame.segment, channels: frame.channels, problem_geography: frame.problem_geography }, today: cfg.today, reader_pages: cfg.budget.reader_pages } }));
