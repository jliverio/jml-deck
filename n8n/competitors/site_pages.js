// One item per candidate home page that came back with text (cut at 10,000 characters), beside the client's product category and numbered claims.
const comps = $('Site sources').all().map(i => i.json).filter(c => !c._none);
const q0 = $('Queries').first().json;
const out = [];
$input.all().forEach((i, idx) => {
  const j = i.json || {};
  const d = j.data || j;
  const md = String((d && d.markdown) || '').trim();
  const c = comps[idx];
  if (!c || j.error || md.split(' ').length < 60) return;
  const meta = (d && d.metadata) || {};
  out.push({ rank: c.rank, name: c.name, site_url: c.site_url, landed_on: String(meta.url || meta.sourceURL || ''), text: md.slice(0, 10000), claims_text: q0.claims_text, category: q0.category });
});
if (!out.length) return [{ json: { _none: true } }];
return out.map(o => ({ json: o }));
