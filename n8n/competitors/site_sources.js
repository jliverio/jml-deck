// Finds each candidate's own website: the address the source page gave, or the search result whose address matches the company's name.
// A shop, a directory or an article is not a company's own site. Names that share a site are merged; a name with no site of its own is left out.
const q0 = $('Queries').first().json;
const comps = $('Site queries').all().map(i => i.json);
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace('www.', ''); };
const rawhost = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase(); };
const path1 = (u) => { const s = String(u || ''); const a = s.indexOf('//'); const b = a === -1 ? -1 : s.indexOf('/', a + 2); if (b === -1) return ''; return s.slice(b + 1).split(/[/?#]/)[0]; };
const SLD = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
const PLATFORM = ['wixsite.com', 'wordpress.com', 'blogspot.com', 'myshopify.com', 'webflow.io', 'squarespace.com', 'github.io', 'netlify.app', 'vercel.app', 'weebly.com', 'substack.com', 'notion.site', 'godaddysites.com', 'business.site'];
const regdom = (h) => { const p = String(h || '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); const pf = PLATFORM.find(x => h.endsWith('.' + x)); if (pf) return p.slice(-(pf.split('.').length + 1)).join('.'); return p.slice(-((p[p.length - 1].length === 2 && SLD.includes(p[p.length - 2])) ? 3 : 2)).join('.'); };
const NOT_A_SITE = ['wikipedia.org', 'linkedin.com', 'crunchbase.com', 'cbinsights.com', 'craft.co', 'pitchbook.com', 'tracxn.com', 'dealroom.co', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'youtube.com', 'tiktok.com', 'pinterest.com', 'bloomberg.com', 'g2.com', 'capterra.com', 'getapp.com', 'softwareadvice.com', 'producthunt.com', 'trustpilot.com', 'glassdoor.com', 'zoominfo.com', 'owler.com', 'reddit.com', 'medium.com', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.es', 'amazon.fr', 'amazon.it', 'amazon.nl', 'amzn.to', 'ebay.com', 'etsy.com', 'aliexpress.com', 'alibaba.com', 'walmart.com', 'target.com', 'bol.com', 'apps.apple.com', 'itunes.apple.com', 'play.google.com', 'chromewebstore.google.com', 'chrome.google.com', 'docs.google.com', 'drive.google.com', 'maps.google.com', 'support.google.com', 'apps.microsoft.com', 'appsource.microsoft.com', 'marketplace.visualstudio.com', 'github.com', 'goo.gl', 'bit.ly'];
const LEGAL = ['inc', 'ltd', 'limited', 'ab', 'gmbh', 'llc', 'plc', 'corp', 'corporation', 'sa', 'lda', 'bv', 'nv', 'srl', 'spa', 'oy', 'ag'];
const SMALL = ['the', 'de', 'da', 'do', 'dos', 'das', 'del', 'la', 'le', 'el', 'of', 'and', 'e', 'y', 'et', 'und', 'en', 'van', 'von', 'em'];
const GENERIC = ['bank', 'banco', 'banque', 'group', 'grupo', 'groupe', 'company', 'companhia', 'health', 'food', 'foods', 'market', 'mortgage', 'home', 'loans', 'financial', 'insurance', 'seguros', 'dental', 'pharma', 'bio', 'biosciences', 'therapeutics', 'labs', 'software', 'technologies', 'technology', 'systems', 'solutions', 'services', 'global', 'international', 'digital', 'online', 'ai', 'app', 'mail', 'direct', 'first', 'united', 'national', 'american', 'barbearia', 'barbershop', 'barber', 'clinica', 'clinic', 'studio', 'salon', 'cafe', 'restaurante', 'restaurant', 'hotel', 'loja', 'store', 'shop'];
const plain = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const toks = (name) => plain(name).replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && !LEGAL.includes(w));
// Words a company often adds to its name in its address: shopremi.com, getzapier.com, pursonicusa.com.
const PRE = ['shop', 'get', 'try', 'use', 'the', 'hello', 'join', 'official', 'my', 'go', 'hey', 'meet', 'with', 'team', 'buy'];
const POST = ['shop', 'app', 'hq', 'official', 'store', 'online', 'labs', 'inc', 'group', 'global', 'usa'];
const CC = ['uk', 'eu', 'nl', 'pt', 'es', 'de', 'fr', 'it', 'us'];
// How well an address fits a company name, 0 to 100.
const fit = (name, h) => {
  const t = toks(name);
  if (!t.length || !h) return 0;
  const compact = t.join('');
  const tld = h.split('.').pop();
  const pf = PLATFORM.find(x => h.endsWith('.' + x));
  const suffix = pf ? pf.split('.').length : ((tld.length === 2 && SLD.includes(h.split('.').slice(-2)[0])) ? 2 : 1);
  const labels = h.split('.').slice(0, -suffix).map(l => l.replace(/[^a-z0-9]/g, '')).filter(Boolean);
  const acro = t.filter(w => !SMALL.includes(w)).map(w => w[0]).join('');
  const strong = t.filter(w => !SMALL.includes(w) && !GENERIC.includes(w));
  const firsts = t.map((w, i) => t.slice(0, i + 1).join('')).slice(0, -1);          // the first one, two, ... words of the name run together
  let best = 0;
  for (const L of labels) {
    let s = 0;
    if (L === compact || L + tld === compact) s = 100;
    else if ((compact.length >= 3 && (PRE.some(x => L === x + compact) || POST.some(x => L === compact + x))) || (compact.length >= 5 && CC.some(x => L === compact + x))) s = 90;
    else if (L.length >= 4 && firsts.includes(L) && L.length * 2 >= compact.length) s = 85;
    else if (acro.length >= 3 && L === acro) s = 70;
    else if (strong.some(w => w.length >= 5 && L === w)) s = 65;
    else if (strong.some(w => w.length >= 6 && L.indexOf(w) !== -1)) s = 55;
    if (s > best) best = s;
  }
  return best;
};
// A directory, a shop or an app store counts only as the site of the company of that very name (Amazon, LinkedIn). The client's own site never counts.
const bad = (h, name) => !h || (q0.own_host && (h === q0.own_host || h.endsWith('.' + q0.own_host))) || (NOT_A_SITE.some(a => h === a || h.endsWith('.' + a)) && fit(name, h) < 100);
const APP = ['app', 'mail', 'login', 'my', 'accounts', 'account', 'auth', 'dashboard', 'portal', 'signin', 'secure', 'console', 'docs', 'help', 'support', 'blog', 'news', 'community', 'forum', 'status', 'careers', 'jobs', 'investors', 'ir', 'press', 'developer', 'developers', 'api', 'learn', 'go', 'web', 'cloud'];
const address = (u) => {
  const h = host(u);
  if (PLATFORM.some(x => h.endsWith('.' + x))) { const seg = path1(u); return 'https://' + h + '/' + (h.endsWith('.wixsite.com') && seg ? seg : ''); }
  if (PLATFORM.includes(h)) return '';
  const r = regdom(h);
  const subs = h === r ? [] : h.slice(0, h.length - r.length - 1).split('.');
  if (subs.some(x => APP.includes(x) || /^v[0-9]+$/.test(x))) return 'https://' + r + '/';          // an app or sign-in address is not the home page
  return 'https://' + rawhost(u) + '/';          // with www when the address found has it: some sites do not answer without
};
const home_tld = Object.entries({ pt: 'Portugal', es: 'Spain', fr: 'France', de: 'Germany', it: 'Italy', nl: 'Netherlands', be: 'Belgium', uk: 'United Kingdom', ie: 'Ireland', se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland', ch: 'Switzerland', at: 'Austria', pl: 'Poland', br: 'Brazil', mx: 'Mexico', ca: 'Canada', au: 'Australia' }).filter(e => e[1] === q0.home_country).map(e => e[0])[0] || '';
const found = [];
const left_out = [];
let empty_searches = 0;
$input.all().forEach((i, idx) => {
  const c = comps[idx];
  if (!c) return;
  const j = i.json || {};
  const res = ((j.web && j.web.results) || j.results || []);
  if (j.error || !Array.isArray(res) || !res.length) empty_searches += 1;
  const ok = (Array.isArray(res) ? res : []).filter(r => r && r.url && !bad(host(r.url), c.name));
  let best = null;
  ok.forEach((r, pos) => { const h = host(r.url); const s = fit(c.name, h); if (s < 55) return; const total = s + (home_tld && h.endsWith('.' + home_tld) ? 5 : 0) - pos * 0.1; if (!best || total > best.total) best = { url: r.url, total, fit: s }; });
  const linked = c.site && !bad(host(c.site), c.name) ? { url: c.site, fit: fit(c.name, host(c.site)) } : null;
  let pick = null;
  let how = '';
  if (linked && linked.fit >= 55) { pick = linked; how = 'linked from the page that names it'; }
  else if (best) { pick = best; how = 'search result whose address matches its name'; }
  else if (linked) { pick = linked; how = 'linked from the page that names it'; }
  const site_url = pick ? address(pick.url) : '';
  if (!site_url) { left_out.push({ name: c.name, why: 'no website of its own was found' }); return; }
  found.push({ ...c, site_url, site_found: how, site_fit: pick.fit, site_key: regdom(host(site_url)) + (host(site_url).endsWith('.wixsite.com') ? '/' + path1(site_url) : ''), aliases: [] });
});
// Names that share a site are one company.
const PRI = { revenue: 0, customers: 1, funding: 2, none: 3 };
const SELL = { yes: 0, unknown: 1, no: 2 };
const merged = [];
const one = {};
for (const c of found) {
  const m = one[c.site_key];
  if (!m) { one[c.site_key] = c; continue; }
  merged.push({ kept: '', names: [m.name, c.name], site: m.site_url });
  const a = toks(c.name).join(' '); const b = toks(m.name).join(' ');
  const better = a !== b && (b + ' ').indexOf(a + ' ') === 0;      // the shorter name when one starts the other: the company, not its product
  if (better) { m.aliases.push(m.name); m.name = c.name; m.site_fit = c.site_fit; } else m.aliases.push(c.name);
  m.mentions += c.mentions;
  if (SELL[c.sells] < SELL[m.sells]) m.sells = c.sells;
  if (!m.hq && c.hq) m.hq = c.hq;
  if (c.measure !== 'none' && (PRI[c.measure] < PRI[m.measure] || (c.measure === m.measure && c.value > m.value))) { m.measure = c.measure; m.value = c.value; m.unit = c.unit; m.as_of = c.as_of; m.quote = c.quote; m.source_url = c.source_url; m.source_title = c.source_title; }
  merged[merged.length - 1].kept = m.name;
}
const list = Object.values(one);
list.sort((a, b) => (SELL[a.sells] - SELL[b.sells]) || (PRI[a.measure] - PRI[b.measure]) || (b.value - a.value) || (b.mentions - a.mentions) || ((a.type === 'Substitute') - (b.type === 'Substitute')));
const report = { left_out, merged, empty_searches };
if (!list.length) return [{ json: { _none: true, _sites: report } }];
return list.map((c, i) => ({ json: i === 0 ? { ...c, rank: i + 1, _sites: report } : { ...c, rank: i + 1 } }));
