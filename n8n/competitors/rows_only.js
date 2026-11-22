// Rows shaped exactly as the findings_record table (the summary and the list travel separately).
const out = [];
for (const i of $input.all()) { const r = { ...i.json }; delete r._summary; delete r._list; if (!r._none) out.push({ json: r }); }
if (!out.length) return [{ json: { _none: true } }];
return out;
