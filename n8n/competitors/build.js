// Picks the final five and writes the entries. A candidate is left out when the site found belongs to another company, or when its home page
// shows it sells something unrelated. When the client's country is known, a candidate is listed only if something read shows it sells there:
// a page that names it says so, or its own site is a site of that country, or its home page shows it. Two candidates whose pages land on the same site, or name the same company, are one company. Each competitor gets one entry with its ranking measure and quote, its claimed advantages and price when
// its home page was read, and each of the client's claims gets the count of competitors that make the same claim.
const start = $('Start').first().json;
const get = (name) => { try { return $(name).all().map(i => i.json); } catch (e) { return []; } };
const q0 = $('Queries').first().json;
const rank0 = get('Rank')[0] || {};
const src = get('Site sources');
const sites_report = (src[0] && src[0]._sites) || { left_out: [], merged: [], empty_searches: 0 };
const cands = src.filter(x => !x._none);
const sites = get('Site pages').filter(x => !x._none);
const today = new Date().toISOString();
const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').replace(/\]\([^)]*\)/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace('www.', ''); };
const SLD = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
const regdom = (h) => { const p = String(h || '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); return p.slice(-((p[p.length - 1].length === 2 && SLD.includes(p[p.length - 2])) ? 3 : 2)).join('.'); };
const plain = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const home = String(q0.home_country || '');
const CC = { Portugal: 'pt', Spain: 'es', France: 'fr', Germany: 'de', Italy: 'it', Netherlands: 'nl', Belgium: 'be', 'United Kingdom': 'uk', Ireland: 'ie', Sweden: 'se', Norway: 'no', Denmark: 'dk', Finland: 'fi', Switzerland: 'ch', Austria: 'at', Poland: 'pl', Greece: 'gr', Brazil: 'br', Mexico: 'mx', Argentina: 'ar', Chile: 'cl', Canada: 'ca', Australia: 'au', 'New Zealand': 'nz', India: 'in', Japan: 'jp' };
const cc = CC[home] || '';
// A site of the country: its address ends in the country's letters (oralb.nl) or carries them as a part (nl.sonicdental.co).
const localSite = (u) => { const p = host(u).split('.').filter(Boolean); return !!cc && p.length > 1 && (p[p.length - 1] === cc || p.slice(0, -1).includes(cc)); };
const DB = ['cbinsights.com', 'crunchbase.com', 'craft.co', 'pitchbook.com', 'tracxn.com', 'dealroom.co', 'owler.com', 'zoominfo.com', 'growjo.com'];
const rows = [];
const row = (entry_id, kind, statement, o) => rows.push(Object.assign({ run_id: start.run_id, entry_id, question: 'B2', kind, statement: clean(statement), value: null, unit: '', measurement_base: '', source_url: '', source_title: '', source_tier: '', source_date: null, access_date: today, quote: '', confidence: '', budget: 'competitor', branch: 'competitors', status: 'draft', check_note: '' }, o || {}));
const light = {};
let dropped = 0;
const items = $input.all().map(i => i.json || {});
if (items.length && !items[0]._none && sites.length) items.forEach((j, idx) => { const s = sites[idx]; if (!s || j.error || !j.output) return; light[s.rank] = { o: j.output, s }; });
// The final five, in rank order.
const left_out = (sites_report.left_out || []).slice();
const comps = [];
const spare = [];
const merged = (sites_report.merged || []).slice();
for (const c of cands) {
  const L = light[c.rank];
  // An address that is exactly the company's name is taken as its own site whatever the page says; a company of the same name in another trade fails the next test.
  if (L && L.o.is_competitor_site === false && !(c.site_fit >= 100)) { left_out.push({ name: c.name, why: 'the site found, ' + host(c.site_url) + ', is not its own' + (clean(L.o.reason) ? ': ' + clean(L.o.reason).replace(/\.$/, '') : (clean(L.o.page_company) ? ' (it is the page of ' + clean(L.o.page_company) + ')' : '')) }); continue; }
  if (L && L.o.same_need === false) { left_out.push({ name: c.name, why: 'its home page shows it sells something else' + (clean(L.o.reason) ? ': ' + clean(L.o.reason).replace(/\.$/, '') : '') }); continue; }
  const says = L ? String(L.o.sells_there || '') : '';
  const proof = !home ? '' : (c.sells === 'yes' ? 'a page that names it says so' : (localSite(c.site_url) ? 'its own site is a site of that country' : (says === 'yes' ? 'its home page shows it' : '')));
  if (home && !proof) { left_out.push({ name: c.name, why: says === 'no' ? 'its home page shows it does not sell in ' + home : 'nothing read shows it sells in ' + home }); continue; }
  const land = L ? regdom(host(L.s.landed_on)) : '';
  const who = L ? plain(L.o.page_company) : '';
  const twin = L ? comps.find(k => (land && k.land === land) || (who && k.who === who)) : null;
  if (twin) { twin.aliases = (twin.aliases || []).concat([c.name]); twin.mentions += c.mentions; merged.push({ kept: twin.name, names: [twin.name, c.name], site: twin.site_url }); continue; }
  if (comps.length < 5) comps.push({ ...c, was: c.rank, rank: comps.length + 1, land, who, proof }); else spare.push(c.name);
}
const same = {};
let read = 0;
for (const c of comps) {
  const L = light[c.was];
  const db = DB.some(d => host(c.source_url).endsWith(d));
  // The country a home page states is used only when the page read is the address asked for: a company's world site can answer with a national one (pfizer.com gave the Austrian site).
  const moved = L && L.s.landed_on && regdom(host(L.s.landed_on)) !== regdom(host(L.s.site_url));
  const hq = c.hq || (L && !moved && clean(L.o.hq_country)) || '';
  const also = (c.aliases || []).length ? ' Also named as: ' + c.aliases.join(', ') + '.' : '';
  row('B2-K' + c.rank, 'fact', c.name + ': ' + c.type + ' competitor' + (hq ? ', based in ' + hq : '') + '. Ranking measure: ' + (c.measure !== 'none' ? c.measure + ' ' + c.value + ' ' + c.unit + (c.as_of ? ' (' + c.as_of + ')' : '') : 'none found, ranked by the number of pages naming it') + '.', { value: c.measure !== 'none' ? c.value : null, unit: c.unit, measurement_base: c.measure, source_url: c.source_url, source_title: clean(c.source_title).slice(0, 200), source_tier: db ? '3' : '', quote: c.quote, confidence: db ? 'Database figure' : 'Independent source, not yet checked', check_note: 'Rank ' + c.rank + '. Named on ' + c.mentions + ' of the pages read. ' + (L ? 'Home page read: ' + L.s.site_url + '.' : 'Site not loaded: ' + c.site_url + '.') + (c.proof ? ' Sells in ' + home + ': ' + c.proof + '.' : '') + also });
  if (!L) continue;
  read += 1;
  const hay = norm(L.s.text);
  let k = 0;
  for (const a of (Array.isArray(L.o.advantages) ? L.o.advantages : []).slice(0, 3)) {
    const needle = norm(a && a.quote);
    if (!needle || needle.split(' ').length < 4 || hay.indexOf(needle) === -1) { dropped += 1; continue; }
    k += 1;
    row('B2-K' + c.rank + '-A' + k, 'fact', a.claim, { source_url: L.s.site_url, source_tier: '1', quote: clean(a.quote), confidence: 'Company claim', check_note: 'Claimed advantage of ' + c.name + '.' });
  }
  const pr = L.o.price || {};
  if (Number(pr.amount) > 0 && norm(pr.quote) && hay.indexOf(norm(pr.quote)) !== -1) row('B2-K' + c.rank + '-P', 'fact', c.name + ' public price: ' + Number(pr.amount) + ' ' + clean(pr.currency).toUpperCase() + (clean(pr.buys) ? ' for ' + clean(pr.buys) : '') + '.', { value: Number(pr.amount), unit: clean(pr.currency).toUpperCase(), source_url: L.s.site_url, source_tier: '1', quote: clean(pr.quote), confidence: 'Company claim' });
  const sc = (Array.isArray(L.o.same_claims) ? L.o.same_claims : []).map(Number).filter(n => (q0.claims || []).find(x => x.n === n));
  for (const n of sc) same[n] = (same[n] || 0) + 1;
  row('B2-K' + c.rank + '-S', 'assessment', 'Same claims as the client: ' + (sc.length ? 'Claims ' + sc.join(' and ') : 'None') + '.', { source_url: L.s.site_url, confidence: 'Likely', check_note: 'Judged from the home page only.' });
}
for (const x of (q0.claims || [])) row('B2-CLAIM-' + x.n, 'assessment', 'Claim ' + x.n + ' is also made by ' + (same[x.n] || 0) + ' of the ' + read + ' competitors whose home page was read.' + (read >= 5 && same[x.n] === read ? ' Common claim.' : ''), { value: same[x.n] || 0, unit: 'competitors', confidence: 'Likely' });
const not_selling = rank0.not_selling || [];
if (comps.length < 5) row('B2-COUNT', 'gap', comps.length + ' of 5 found.', { check_note: ('Fewer than five companies passed the checks.' + (q0.home_country ? ' Searched in ' + q0.home_country + '.' : '') + (left_out.length ? ' Left out: ' + left_out.map(x => x.name + ' (' + x.why + ')').join('; ') + '.' : '') + (not_selling.length ? ' Not selling in ' + q0.home_country + ' on the pages read: ' + not_selling.join(', ') + '.' : '')).slice(0, 900) });
const summary = { competitors: comps.map(c => ({ rank: c.rank, name: c.name, type: c.type, measure: c.measure, value: c.value, unit: c.unit, mentions: c.mentions, site: c.site_url, site_found: c.site_found, sells_in_country: c.proof || '', home_page_read: !!light[c.was], also_named_as: c.aliases || [] })), candidates: rank0.candidates || 0, checked: cands.length + (sites_report.left_out || []).length, also_named: spare.concat(rank0.also_named || []), left_out, merged, not_selling, site_searches_empty: sites_report.empty_searches || 0, home_country: q0.home_country || '', country_basis: q0.country_basis || '', quotes_dropped_round_one: rank0.quotes_dropped || 0, home_pages_read: read, light_checks: Object.keys(light).length, quotes_dropped_light_check: dropped, same_claim_counts: same, entries: rows.length };
const list = comps.map(c => ({ name: c.name, market: (c.markets || []).join(', '), measure: c.measure, measure_value: c.value || null, measure_source: c.source_url, rank: c.rank, site_loaded: !!light[c.was] }));
if (!rows.length) return [{ json: { _none: true, _summary: summary, _list: list } }];
return rows.map((r, i) => ({ json: i === 0 ? { ...r, _summary: summary, _list: list } : r }));
