// The final list, after the checks, shaped exactly as the competitors table.
const start = $('Start').first().json;
const b = $('Build entries').first().json || {};
const list = Array.isArray(b._list) ? b._list : [];
if (!list.length) return [{ json: { _none: true } }];
return list.map(r => ({ json: { run_id: start.run_id, ...r } }));
