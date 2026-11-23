// Reads the product category, the markets and the claims, works out the company's country, and writes the searches from fixed templates.
// The searches are fixed templates; when the country is known every search carries it. One of them is later written in the
// country's language by a model (Searches), which only translates the template.
const start = $('Start').first().json;
const rows = $input.all().map(i => i.json).filter(r => r && r.run_id === start.run_id);
const find = (id) => { const r = rows.find(x => x.entry_id === id); return r ? String(r.statement || '').trim() : ''; };
let category = find('A1-CATEGORY');
if (!category) return [{ json: { _none: true } }];
const words = category.split(' ').filter(Boolean);
if (['a', 'an', 'the'].includes(words[0].toLowerCase())) words.shift();
category = words.slice(0, 12).join(' ').split('.').join('').split(',').join('');
const markets = rows.filter(r => /^A4-M[0-9]+$/.test(String(r.entry_id || '')) && String(r.statement || '').indexOf('announced') === -1).map(r => String(r.statement).replace('Market: ', '').replace('.', '').trim()).filter(Boolean);
const claims = rows.filter(r => r.branch === 'claims' && /^B1-C[0-9]+$/.test(String(r.entry_id || ''))).map(r => ({ n: Number(String(r.entry_id).slice(4)), claim: String(r.statement || ''), url: String(r.source_url || '') })).sort((a, b) => a.n - b.n);
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace('www.', ''); };
const SLD = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
const PLATFORM = ['wixsite.com', 'wordpress.com', 'blogspot.com', 'myshopify.com', 'webflow.io', 'squarespace.com', 'github.io', 'netlify.app', 'vercel.app', 'weebly.com', 'substack.com', 'notion.site', 'godaddysites.com', 'business.site'];
const regdom = (h) => { const p = String(h || '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); const pf = PLATFORM.find(x => h.endsWith('.' + x)); if (pf) return p.slice(-(pf.split('.').length + 1)).join('.'); return p.slice(-((p[p.length - 1].length === 2 && SLD.includes(p[p.length - 2])) ? 3 : 2)).join('.'); };

// The company's own site: the address most of its own entries cite.
const own_rows = rows.filter(r => r.budget === 'company' && r.source_url);
const tally = {};
for (const r of own_rows) { const h = host(r.source_url); if (h) tally[h] = (tally[h] || 0) + 1; }
const top_host = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || host((claims[0] && claims[0].url) || (rows.find(r => r.source_url) || {}).source_url);
const own_host = regdom(top_host);

// The company's country: its country web address, else the language of its pages, else its only market.
const TLD = { pt: 'Portugal', es: 'Spain', fr: 'France', de: 'Germany', it: 'Italy', nl: 'Netherlands', be: 'Belgium', uk: 'United Kingdom', ie: 'Ireland', se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland', ch: 'Switzerland', at: 'Austria', pl: 'Poland', gr: 'Greece', cz: 'Czechia', hu: 'Hungary', ro: 'Romania', lu: 'Luxembourg', br: 'Brazil', mx: 'Mexico', ar: 'Argentina', cl: 'Chile', us: 'United States', ca: 'Canada', au: 'Australia', nz: 'New Zealand', in: 'India', jp: 'Japan', kr: 'South Korea', za: 'South Africa', tr: 'Turkey', sg: 'Singapore', ae: 'United Arab Emirates', il: 'Israel' };
const CODES = { 'united kingdom': 'GB', 'sweden': 'SE', 'united states': 'US', 'portugal': 'PT', 'spain': 'ES', 'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'netherlands': 'NL', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'switzerland': 'CH', 'austria': 'AT', 'belgium': 'BE', 'canada': 'CA', 'australia': 'AU', 'brazil': 'BR', 'poland': 'PL', 'mexico': 'MX', 'argentina': 'AR', 'chile': 'CL', 'india': 'IN', 'japan': 'JP', 'south korea': 'KR', 'new zealand': 'NZ', 'south africa': 'ZA', 'turkey': 'TR' };
const COUNTRY = {};
for (const n of Object.values(TLD)) COUNTRY[n.toLowerCase()] = n;
const LANG = {
  en: { name: 'English', words: ['the', 'and', 'with', 'your', 'that', 'this', 'our', 'you', 'from', 'are', 'of'], places: [] },
  pt: { name: 'Portuguese', words: ['não', 'uma', 'com', 'dos', 'das', 'você', 'nossa', 'nosso', 'são', 'mais', 'pelo', 'pela', 'também', 'em', 'os', 'na', 'um', 'ao', 'às'], places: ['Portugal', 'Brazil'] },
  es: { name: 'Spanish', words: ['el', 'los', 'las', 'con', 'una', 'más', 'nuestra', 'nuestro', 'también', 'sus', 'y', 'muy', 'está', 'son'], places: ['Spain', 'Mexico', 'Argentina', 'Chile'] },
  nl: { name: 'Dutch', words: ['het', 'een', 'van', 'voor', 'met', 'op', 'je', 'dat', 'niet', 'wij', 'onze', 'naar', 'bij', 'ook', 'zijn', 'uw'], places: ['Netherlands', 'Belgium'] },
  de: { name: 'German', words: ['der', 'das', 'und', 'ist', 'mit', 'für', 'von', 'den', 'nicht', 'ein', 'eine', 'wir', 'sie', 'auf', 'zu', 'im', 'auch', 'sind'], places: ['Germany', 'Austria', 'Switzerland'] },
  fr: { name: 'French', words: ['le', 'les', 'des', 'et', 'est', 'pour', 'avec', 'vous', 'nous', 'une', 'dans', 'votre', 'notre', 'sur', 'au', 'pas'], places: ['France', 'Belgium', 'Switzerland', 'Canada'] },
  it: { name: 'Italian', words: ['il', 'di', 'che', 'per', 'della', 'non', 'più', 'sono', 'nostro', 'gli', 'dei', 'anche', 'nel', 'delle', 'alla'], places: ['Italy', 'Switzerland'] },
  sv: { name: 'Swedish', words: ['och', 'att', 'är', 'för', 'inte', 'ett', 'till', 'från'], places: ['Sweden'] },
  da: { name: 'Danish or Norwegian', words: ['og', 'er', 'til', 'ikke', 'et', 'af', 'fra', 'jeg'], places: ['Denmark', 'Norway'] },
  pl: { name: 'Polish', words: ['w', 'z', 'się', 'nie', 'jest', 'że', 'dla', 'oraz', 'jak', 'przez'], places: ['Poland'] },
  fi: { name: 'Finnish', words: ['ja', 'ei', 'että', 'tai', 'kun', 'myös', 'sekä', 'ovat'], places: ['Finland'] },
};
const text = own_rows.filter(r => regdom(host(r.source_url)) === own_host).map(r => String(r.quote || '')).join(' ').toLowerCase();
const tokens = text.split(/[^\p{L}]+/u).filter(Boolean);
const score = Object.keys(LANG).map(k => ({ k, n: tokens.filter(t => LANG[k].words.includes(t)).length })).sort((a, b) => b.n - a.n);
const lang = (score[0].n >= 8 && score[0].n >= 1.5 * score[1].n) ? score[0].k : '';
let home_country = '';
let country_basis = '';
const tld = own_host.split('.').pop();
if (TLD[tld] && !PLATFORM.some(x => own_host.endsWith('.' + x))) { home_country = TLD[tld]; country_basis = 'its web address ends in .' + tld; }
if (!home_country && lang && LANG[lang].places.length) {
  const places = LANG[lang].places;
  const sold = places.filter(p => markets.some(m => m.toLowerCase() === p.toLowerCase()));
  if (places.length === 1) { home_country = places[0]; country_basis = 'its pages are written in ' + LANG[lang].name; }
  else if (sold.length === 1) { home_country = sold[0]; country_basis = 'its pages are written in ' + LANG[lang].name + ' and it sells in ' + sold[0]; }
}
if (!home_country && markets.length === 1 && COUNTRY[markets[0].toLowerCase()]) { home_country = COUNTRY[markets[0].toLowerCase()]; country_basis = 'it is the only market found on its site'; }
const home_code = home_country ? (CODES[home_country.toLowerCase()] || 'ALL') : 'ALL';

// The language of the company's country, for one of the searches (José, 23 Nov: search in any language, always write in English).
// A country with more than one language takes the language of the company's pages. English-speaking countries stay in English.
// Each entry: the language's name for the translator, and the code the search engine knows it by. A country that is not here
// (Greece: the search engine has no code for Greek) is searched in English.
const LOCAL = { Portugal: ['Portuguese', 'pt-pt'], Brazil: ['Portuguese', 'pt-br'], Spain: ['Spanish', 'es'], Mexico: ['Spanish', 'es'], Argentina: ['Spanish', 'es'], Chile: ['Spanish', 'es'], France: ['French', 'fr'], Germany: ['German', 'de'], Austria: ['German', 'de'], Italy: ['Italian', 'it'], Netherlands: ['Dutch', 'nl'], Sweden: ['Swedish', 'sv'], Norway: ['Norwegian', 'nb'], Denmark: ['Danish', 'da'], Finland: ['Finnish', 'fi'], Poland: ['Polish', 'pl'], Czechia: ['Czech', 'cs'], Hungary: ['Hungarian', 'hu'], Romania: ['Romanian', 'ro'], Turkey: ['Turkish', 'tr'], Israel: ['Hebrew', 'he'], Japan: ['Japanese', 'jp'], 'South Korea': ['Korean', 'ko'] };
const BY_PAGES = { Belgium: { nl: ['Dutch', 'nl'], fr: ['French', 'fr'] }, Switzerland: { de: ['German', 'de'], fr: ['French', 'fr'], it: ['Italian', 'it'] }, Luxembourg: { fr: ['French', 'fr'], de: ['German', 'de'] }, Canada: { fr: ['French', 'fr'] } };
const local = LOCAL[home_country] || (BY_PAGES[home_country] || {})[lang] || null;

const c = start.company;
let queries;
if (home_country) {
  queries = [
    { purpose: 'the category in ' + home_country, q: category + ' companies ' + home_country, country: home_code },
    { purpose: 'named rivals of the company in ' + home_country, q: c + ' competitors alternatives ' + home_country, country: home_code },
    { purpose: 'the largest in the category in ' + home_country, q: 'largest ' + category + ' companies in ' + home_country, country: home_code },
  ];
} else {
  queries = [{ purpose: 'the category, anywhere', q: category + ' companies', country: 'ALL' }, { purpose: 'named rivals of the company', q: c + ' competitors alternatives', country: 'ALL' }];
  for (const m of markets.slice(0, 3)) queries.push({ purpose: 'the category in ' + m, q: category + ' companies ' + m, country: CODES[m.toLowerCase()] || 'ALL' });
}
// The last search of a known country is the one written in that country's language; Searches swaps it in once it is translated.
const local_line = home_country && local ? queries[queries.length - 1].q : '';
const shared = { company: c, category, markets, markets_text: markets.join(', ') || 'not public', claims, claims_text: claims.map(x => x.n + '. ' + x.claim).join('\n') || 'none listed', own_host, home_country, home_code, country_basis, page_language: lang ? LANG[lang].name : '', local_language: local_line ? local[0] : '', local_code: local_line ? local[1] : '', local_line };
return queries.map(x => ({ json: { ...x, search_lang: 'en', ...shared } }));
