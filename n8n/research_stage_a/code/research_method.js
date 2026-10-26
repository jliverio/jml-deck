// Research method (Code, run once for each item). The firm's method as data: the question each layer answers, the
// attribute set per category, the publisher lists, the comparability basis. Stage A v0 (Oct 26): defaults from the
// guideline "Product-driven market analysis"; the firm edits this table later (Sequence 4).
const cfg = $json;
const category = cfg.category || 'consumer_goods';

const ATTRIBUTES = {
  consumer_goods: [
    { id: 'list_price', label: 'List price of the main line (entry and top)', unit: 'EUR per piece', basis: 'list price on the company\'s own store, not a promotion' },
    { id: 'range_size', label: 'Range size (distinct products on the own listing pages)', unit: 'count', basis: 'count on the own listing page; over 200 as "over 200"' },
    { id: 'channels', label: 'Channels (own store, retail, online, wholesale)', unit: 'list', basis: 'as the own site states' },
    { id: 'countries', label: 'Countries sold in', unit: 'list', basis: 'as the own site states (store selector, shipping page, store list)' },
    { id: 'launches_24m', label: 'Launches or new lines in the last 24 months', unit: 'count', basis: 'own newsroom or press page, dated items' },
  ],
};
const ALWAYS = [
  { id: 'scale', label: 'Scale (revenue or employees, with year)', unit: 'EUR or headcount', basis: 'filings, results, or a listed publication naming the year' },
  { id: 'positioning', label: 'Positioning (one sentence quoted from the About or home page)', unit: 'quote', basis: 'verbatim' },
];

const PUBLISHERS = {
  primary_domains: ['ine.pt', 'ine.es', 'ec.europa.eu', 'europa.eu', 'oecd.org', 'worldbank.org', 'bportugal.pt', 'bde.es', 'erse.pt', 'cnmc.es', 'dgeg.gov.pt', 'asae.gov.pt', 'concorrencia.pt', 'iea.org', 'wto.org', 'gov.pt', 'gob.es', 'portugalglobal.pt', 'icex.es'],
  trade_bodies: [
    { name: 'FIPA', domain: 'fipa.pt', sector: 'food', country: 'PT' }, { name: 'APED', domain: 'aped.pt', sector: 'retail', country: 'PT' },
    { name: 'ATP', domain: 'atp.pt', sector: 'textiles and apparel', country: 'PT' }, { name: 'ANIVEC', domain: 'anivec.com', sector: 'apparel', country: 'PT' },
    { name: 'AECOC', domain: 'aecoc.es', sector: 'consumer goods', country: 'ES' }, { name: 'FIAB', domain: 'fiab.es', sector: 'food', country: 'ES' },
    { name: 'ANGED', domain: 'anged.es', sector: 'retail', country: 'ES' }, { name: 'Acotex', domain: 'acotex.org', sector: 'apparel retail', country: 'ES' },
    { name: 'Moda España', domain: 'modaespana.org', sector: 'apparel', country: 'ES' }, { name: 'EURATEX', domain: 'euratex.eu', sector: 'textiles and apparel', country: 'EU' },
  ],
  press_domains: ['expresso.pt', 'publico.pt', 'eco.sapo.pt', 'jornaldenegocios.pt', 'observador.pt', 'dn.pt', 'lusa.pt', 'jornaleconomico.pt', 'dinheirovivo.pt',
    'elpais.com', 'expansion.com', 'cincodias.elpais.com', 'elmundo.es', 'lavanguardia.com', 'efe.com', 'eleconomista.es', 'modaes.com', 'modaes.es',
    'ft.com', 'reuters.com', 'bloomberg.com', 'economist.com', 'wsj.com', 'businessoffashion.com', 'just-style.com', 'fashionnetwork.com'],
};

const method = {
  category,
  attributes: [...(ATTRIBUTES[category] || ATTRIBUTES.consumer_goods), ...ALWAYS],
  comparability: { price_basis: 'list price on the own store in the problem geography, else the home store marked as such', unit_rule: 'same unit and basis per row; never converted; a row that mixes them is not comparable' },
  depths: ['locality', 'region', 'country', 'multi-country', 'global'],
  list_types: ['share_table', 'retailer_shelf', 'ranking'],
  competitor_tests: ['product_market', 'geography', 'channel', 'segment'],
  questions: {
    L1: [
      { id: 'L1.1', q: 'Where does the client sell today (home geography, depth) and where does the brief\'s question play out (problem geography)?' },
      { id: 'L1.2', q: 'What is the product market, in one phrase: what is sold, to whom, through what channels, where? Name the sector, the category and the segment around it.' },
      { id: 'L1.3', q: 'Is there a published size for that product market in the problem geography, with unit, year and scope?' },
      { id: 'L1.4', q: 'Which five companies are the direct competitors in the problem geography: same product market, same customers, overlapping channels, same segment when one is set? From which list did each come?' },
    ],
    L3: [{ id: 'L3.1', q: 'For the client and each of the five, the value of every attribute in the attribute set, from the company\'s own pages, with the page and the passage.' }],
    L4: [
      { id: 'L4.1', q: 'What did each of the five announce or do in the last 24 months in the problem geography: launches, store openings, price moves, acquisitions?' },
      { id: 'L4.2', q: 'Which indirect competitors or entrants moved into the product market in the problem geography?' },
      { id: 'L4.3', q: 'What substitutes are gaining in the category?' },
      { id: 'L4.4', q: 'What changed in regulation, demand, prices or channels for the category in the problem geography (statistics, regulators, trade bodies)?' },
    ],
  },
  publishers: PUBLISHERS,
  budget: cfg.budget,
};

// The brief's own figures, each a claim the public record may show (same rule as the Research brief, Oct 25).
const FIG = /(\d[\d.,]*\s*%|\b\d[\d.,]*\s*(?:percent|per cent|pp|bps|million|billion|bn|m|k|x|times)\b|[€$£]\s?\d[\d.,]*|\b\d[\d.,]*\s?[€$£]|\b(?:19|20)\d{2}\b|\b\d[\d.,]*\s+(?:hours?|days?|weeks?|months?|years?|plants?|sites?|stores?|shops?|facilities|employees|staff|customers|units|branches|countries|markets)\b)/i;
const GOAL = /(wants?|aims?|targets?|goals?|objective|at least|no more than|under|below|within|by the end of|by (?:19|20)\d{2})\s*[^.;]{0,40}$/i;
const stated = f => f && f.source === 'stated' && f.value != null ? String(Array.isArray(f.value) ? f.value.join('; ') : f.value) : '';
const claims = [];
for (const t of [stated((cfg.brief.hard_fields || {}).problem_statement), stated((cfg.brief.soft_fields || {}).success_criteria)]) {
  for (const s of String(t).replace(/\s+/g, ' ').split(/(?<=[.;!?])\s+(?=[A-Z0-9(])/).map(x => x.trim()).filter(Boolean)) {
    const figures = [];
    for (const m of s.matchAll(new RegExp(FIG.source, 'gi'))) { const f = m[0].trim(); if (!GOAL.test(s.slice(Math.max(0, m.index - 48), m.index)) && !/^\d[\d.,]*\s+(weeks?|months?)$/i.test(f) && !figures.includes(f)) figures.push(f); }
    if (!figures.length || claims.some(c => figures.every(f => c.figures.includes(f)))) continue;
    claims.push({ id: 'C' + (claims.length + 1), text: s.length > 240 ? s.slice(0, 237) + '...' : s, figures });
    if (claims.length >= 5) break;
  }
}
return { json: { ...cfg, method, claims } };
