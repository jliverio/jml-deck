// Keeps a company only if its quote is on the page, merges mentions of the same company, leaves out those the pages show do not sell in the
// client's country, ranks by revenue, then customers, then funding, then by how many pages name it, and passes on up to eight for the site checks
// (fewer when more searches were run: the stage's budget is 10 searches in all).
const q0 = $('Queries').first().json;
const pages = $('Pages').all().map(i => i.json);
const norm = (s) => String(s || '').replace(/\]\([^)]*\)/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const DROP = ['inc', 'ltd', 'limited', 'ab', 'gmbh', 'llc', 'plc', 'corp', 'corporation', 'the', 'sa', 'lda', 'bv', 'nv', 'srl', 'spa', 'oy', 'as', 'ag'];
const key = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => !DROP.includes(w)).join(' ');
const own = key(q0.company);
const inside = (a, b) => (' ' + a + ' ').indexOf(' ' + b + ' ') !== -1;
const home = String(q0.home_country || '');
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace('www.', ''); };
const SLD = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
const PLATFORM = ['wixsite.com', 'wordpress.com', 'blogspot.com', 'myshopify.com', 'webflow.io', 'squarespace.com', 'github.io', 'netlify.app', 'vercel.app', 'weebly.com', 'substack.com', 'notion.site', 'godaddysites.com', 'business.site'];
const regdom = (h) => { const p = String(h || '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); const pf = PLATFORM.find(x => h.endsWith('.' + x)); if (pf) return p.slice(-(pf.split('.').length + 1)).join('.'); return p.slice(-((p[p.length - 1].length === 2 && SLD.includes(p[p.length - 2])) ? 3 : 2)).join('.'); };
// Addresses that are never a company's own home page: directories, media, social networks, shops and app stores.
const NOT_A_SITE = ['wikipedia.org', 'linkedin.com', 'crunchbase.com', 'cbinsights.com', 'craft.co', 'pitchbook.com', 'tracxn.com', 'dealroom.co', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'youtube.com', 'tiktok.com', 'pinterest.com', 'bloomberg.com', 'g2.com', 'capterra.com', 'getapp.com', 'softwareadvice.com', 'producthunt.com', 'trustpilot.com', 'glassdoor.com', 'zoominfo.com', 'owler.com', 'reddit.com', 'medium.com', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.es', 'amazon.fr', 'amazon.it', 'amazon.nl', 'amzn.to', 'ebay.com', 'etsy.com', 'aliexpress.com', 'alibaba.com', 'walmart.com', 'target.com', 'bol.com', 'apps.apple.com', 'itunes.apple.com', 'play.google.com', 'chromewebstore.google.com', 'chrome.google.com', 'docs.google.com', 'drive.google.com', 'maps.google.com', 'support.google.com', 'apps.microsoft.com', 'appsource.microsoft.com', 'marketplace.visualstudio.com', 'github.com', 'goo.gl', 'bit.ly'];
const siteOf = (raw, page) => {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const h = host(s);
  if (!h || h.indexOf('.') === -1 || /[^a-z0-9.-]/.test(h)) return '';
  if (NOT_A_SITE.some(a => h === a || h.endsWith('.' + a))) return '';
  if (q0.own_host && (h === q0.own_host || h.endsWith('.' + q0.own_host))) return '';
  if (regdom(h) === regdom(host(page.url))) return '';
  if (String(page.text || '').toLowerCase().indexOf(regdom(h)) === -1) return '';     // the address must be written on the page
  return s;
};
const PRI = { revenue: 0, customers: 1, funding: 2, none: 3 };
const SELL = { yes: 0, unknown: 1, no: 2 };
const by = {};
let dropped = 0;
$input.all().forEach((i, idx) => {
  const j = i.json || {};
  const p = pages[idx] || {};
  if (j.error || !j.output) return;
  const hay = norm(p.text);
  for (const x of (Array.isArray(j.output.companies) ? j.output.companies : [])) {
    const name = String((x && x.name) || '').replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const k = key(name);
    if (!k || k === own || inside(k, own) || inside(own, k)) continue;
    const needle = norm(x.quote);
    if (!needle || needle.split(' ').length < 4 || hay.indexOf(needle) === -1) { dropped += 1; continue; }
    const kk = k.split(' ').join('');          // "Millennium bcp" and "Millenniumbcp" are one name
    const e = by[kk] || (by[kk] = { names: {}, pages: new Set(), types: {}, hq: '', measure: 'none', value: 0, unit: '', as_of: '', quote: String(x.quote).trim(), source_url: p.url, source_title: p.title, markets: new Set(), sells: {}, site: '' });
    e.names[name] = (e.names[name] || 0) + 1;
    e.pages.add(p.url);
    const t = x.type === 'Substitute' ? 'Substitute' : 'Direct';
    e.types[t] = (e.types[t] || 0) + 1;
    if (!e.hq && x.hq_country) e.hq = String(x.hq_country).trim();
    for (const m of (Array.isArray(x.markets) ? x.markets : [])) e.markets.add(String(m).trim());
    const st = SELL[x.sells_there] !== undefined ? x.sells_there : 'unknown';
    e.sells[st] = (e.sells[st] || 0) + 1;
    if (!e.site) e.site = siteOf(x.site, p);
    const meas = PRI[x.measure] !== undefined ? x.measure : 'none';
    const val = Number(x.value) || 0;
    if (meas !== 'none' && val > 0 && (PRI[meas] < PRI[e.measure] || (meas === e.measure && val > e.value))) { e.measure = meas; e.value = val; e.unit = String(x.unit || '').trim(); e.as_of = String(x.as_of || '').trim(); e.quote = String(x.quote).trim(); e.source_url = p.url; e.source_title = p.title; }
  }
});
// Of the ways a name was written, keep the most frequent; then the one with accents; then the longest ("Millennium bcp", not "Millenniumbcp").
const written = (names) => Object.keys(names).sort((a, b) => (names[b] - names[a]) || (/[^\x00-\x7f]/.test(b) - /[^\x00-\x7f]/.test(a)) || (b.length - a.length))[0];
let list = Object.values(by).map(e => ({ name: written(e.names), type: (e.types.Substitute || 0) > (e.types.Direct || 0) ? 'Substitute' : 'Direct', hq: e.hq, measure: e.measure, value: e.value, unit: e.unit, as_of: e.as_of, quote: e.quote, source_url: e.source_url, source_title: e.source_title, mentions: e.pages.size, markets: [...e.markets], sells: !home ? 'unknown' : (e.sells.yes ? 'yes' : (e.sells.no ? 'no' : 'unknown')), site: e.site }));
const named = list.length;
const not_selling = list.filter(e => e.sells === 'no').map(e => e.name);
list = list.filter(e => e.sells !== 'no');
list.sort((a, b) => (SELL[a.sells] - SELL[b.sells]) || (PRI[a.measure] - PRI[b.measure]) || (b.value - a.value) || (b.mentions - a.mentions) || ((a.type === 'Substitute') - (b.type === 'Substitute')));
const POOL = Math.max(5, Math.min(8, 10 - $('Queries').all().length));
const pool = list.slice(0, POOL).map((e, i) => ({ ...e, rank: i + 1, candidates: named, quotes_dropped: dropped, also_named: list.slice(POOL, POOL + 10).map(x => x.name), not_selling }));
if (!pool.length) return [{ json: { _none: true, candidates: named, quotes_dropped: dropped, not_selling } }];
return pool.map(e => ({ json: e }));
