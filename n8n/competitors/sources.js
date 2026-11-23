// Gathers the search results, leaves out the company's own site and social networks, removes repeats and keeps at most 10 pages, taking turns between the searches.
// The searches as they were run (Searches): one of them may be written in the country's language.
const qs = $('Searches').all().map(i => i.json);
const own = (qs[0] && qs[0].own_host) || '';
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace('www.', ''); };
const SKIP = ['youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'linkedin.com', 'reddit.com', 'pinterest.com'];
const lists = qs.map(() => []);
$input.all().forEach((i, idx) => {
  const j = i.json || {};
  const res = (j.web && j.web.results) || j.results;
  if (Array.isArray(res)) { const q = Math.min(idx, lists.length - 1); for (const r of res) if (r && r.url) lists[q].push({ url: r.url, title: r.title || '' }); }
});
const seen = new Set();
const out = [];
for (let k = 0; k < 8 && out.length < 10; k++) {
  for (let q = 0; q < lists.length && out.length < 10; q++) {
    const r = lists[q][k];
    if (!r) continue;
    const h = host(r.url);
    if (!h || (own && (h === own || h.endsWith('.' + own))) || SKIP.some(s => h === s || h.endsWith('.' + s)) || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({ url: r.url, title: r.title, purpose: qs[q].purpose, query: qs[q].q });
  }
}
if (!out.length) return [{ json: { _none: true } }];
return out.map(o => ({ json: o }));
