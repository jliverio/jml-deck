// Reads the checked entries of the run and prepares everything the slide writer needs.
// Code fills what needs no writing (names, source lines, offer type and pricing line, competitor facts).
// The model only writes the short texts; it gets the entries it may use, by id, and the room each box has.
// An entry that failed the checks never reaches this stage's writer.
const start = $('Start').first().json;
const all = $input.all().map(i => i.json).filter(r => r && r.run_id === start.run_id && r.entry_id);
const checked = all.filter(r => r.status === 'checked');
const kept = checked.length ? checked : all.filter(r => r.status !== 'failed');
const E = {};
for (const r of kept) if (!E[r.entry_id] || Number(r.id) > Number(E[r.entry_id].id)) E[r.entry_id] = r;
const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
const safe = (s) => clean(s).replace(/\{/g, '(').replace(/\}/g, ')');
const num = (id) => Number((String(id).match(/(\d+)(?!.*\d)/) || [0, 0])[1]);
const ids = (re) => Object.keys(E).filter(k => re.test(k)).sort((a, b) => num(a) - num(b));
const host = (u) => { const s = String(u || ''); const a = s.indexOf('//'); if (a === -1) return ''; const b = s.indexOf('/', a + 2); return s.slice(a + 2, b === -1 ? s.length : b).toLowerCase().replace(/^www\./, ''); };
const SUFFIX = /,?\s+(inc\.?|llc|ltd\.?|limited|gmbh|s\.a\.?|sa|lda\.?|crl|plc|corp\.?|corporation|co\.|b\.v\.?|s\.r\.l\.?|s\.l\.?)$/i;
const shortName = (s) => { let n = clean(s); for (let k = 0; k < 2; k += 1) n = n.replace(SUFFIX, '').trim(); return n; };
const company = shortName(start.company) || 'The company';
const year = new Date().getUTCFullYear();

// Value chain: one status per layer. A layer the company works in gets a description; a layer it buys names its suppliers.
const LABEL = { 1: 'Supplies Essential Components', 2: 'Builds the Core Product', 3: 'Creates Specialist Capability', 4: 'Applies Intelligence' };
const OPERATES = ['sells', 'in-house only', 'mixed'];
const layers = [];
for (const n of [1, 2, 3, 4]) {
  const e = E['A1-L' + n];
  if (!e) continue;
  const m = clean(e.statement).match(/^Layer \d \([^)]*\):\s*([A-Za-z -]+?)\.\s*(.*)$/);
  if (!m) continue;
  const status = m[1].trim();
  const mode = OPERATES.includes(status.toLowerCase()) ? 'operates' : (status.toLowerCase() === 'buys' ? 'buys' : 'none');
  layers.push({ n, entry: e.entry_id, status, mode, covers: m[2] });
}

// Products, in the site's order. The name is the text before the first colon of the entry.
const products = ids(/^A3-P\d+$/).map(id => { const s = clean(E[id].statement); const i = s.indexOf(': '); return { entry: id, name: i === -1 ? s : s.slice(0, i), what: i === -1 ? '' : s.slice(i + 2) }; }).filter(p => p.name);
const offers = ids(/^A4-O\d+$/);
const markets = ids(/^A4-M\d+$/);
const noMarket = !markets.length;

// Offer type and pricing model: written by code, word for word from the entries.
const typeM = E['A2-TYPE'] ? clean(E['A2-TYPE'].statement).match(/^Offer type:\s*(B2C and B2B|B2C|B2B|Not public)/i) : null;
const offerType = typeM ? typeM[1] : '';
const modelM = E['A4-MODEL'] ? clean(E['A4-MODEL'].statement).match(/^Pricing model:\s*(.+?)\.?$/i) : null;
const pricing = modelM ? modelM[1] : '';
const regulator = Object.keys(E).filter(k => /^REG-.+-R\d+$/.test(k) && /Topic: status/i.test(String(E[k].check_note || ''))).sort((a, b) => num(a) - num(b)).slice(0, 3);

// The company's claims (up to five) and the competitors in the research's rank.
const claims = ids(/^B1-C\d+$/).slice(0, 5);
const money = (v, unit) => { const a = Math.abs(v); const f = (x) => String(Math.round(x * 10) / 10); return unit + ' ' + (a >= 1e9 ? f(v / 1e9) + ' billion' : (a >= 1e6 ? f(v / 1e6) + ' million' : Math.round(v).toLocaleString('en-US'))); };
const competitors = [];
const seenHost = new Set();
for (const id of ids(/^B2-K\d+$/)) {
  const e = E[id];
  const s = clean(e.statement);
  const m = s.match(/^(.*?):\s*([^.,]*?)(?:,\s*based in\s+([^.]*))?\.\s*Ranking measure:\s*(.*)$/);
  const name = shortName(m ? m[1] : s.split(':')[0]);
  if (!name) continue;
  const pts = ids(new RegExp('^' + id + '-A\\d+$')).slice(0, 3);
  const home = pts.length ? host(E[pts[0]].source_url) : '';
  if (home && seenHost.has(home)) continue;          // two names on one home page count once
  if (home) seenHost.add(home);
  const country = m && m[3] ? clean(m[3]) : '';
  let figure = '';
  const v = Number(e.value);
  if (m && !/^none found/i.test(m[4]) && e.value !== null && e.value !== undefined && isFinite(v) && v > 0 && e.unit) {
    figure = /^(USD|EUR|GBP|SEK|CHF)$/i.test(e.unit) ? money(v, e.unit.toUpperCase()) + (/^funding/i.test(m[4]) ? ' funding' : '') : Math.round(v).toLocaleString('en-US') + ' ' + clean(e.unit);
  }
  let fact = [country, figure].filter(Boolean).join(' · ');
  if (fact.length > 40) fact = country.length <= 40 ? country : '';
  const sameE = E[id + '-S'];
  const same = sameE ? (clean(sameE.statement).match(/\d+/g) || []).map(Number) : null;   // null: its home page was not read
  competitors.push({ entry: id, name, fact, points: pts, same, home });
}
const shown0 = competitors.slice(0, 4);

const found = { layers: layers.filter(l => l.mode !== 'none').length, products: products.length, markets: markets.length, claims: claims.length, competitors: competitors.length };
const nothing = !found.layers && !found.products && !found.claims && !found.competitors && !markets.length && !offerType;
if (nothing) return [{ json: { _none: true, run_id: start.run_id, company, found, entries_read: kept.length, checks_ran: checked.length > 0 } }];

// The request the writer reads.
const line = (id) => { const e = E[id]; return '[' + id + '] ' + e.kind + ' | ' + safe(e.statement) + (e.value !== null && e.value !== undefined && e.unit ? ' | value: ' + e.value + ' ' + safe(e.unit) : '') + (e.quote ? ' | quote: "' + safe(e.quote).slice(0, 320) + '"' : ''); };
const has = (id) => !!E[id];
const P = [];
P.push('Company: ' + safe(company) + '\nWebsite: ' + safe(host(start.website) || start.website));
const titleIds = ['A1-L4', 'A1-L2', 'A1-L1', 'A1-L3'].filter(id => has(id) && layers.some(l => l.entry === id && l.mode === 'operates')).slice(0, 2).concat(['A1-CATEGORY', 'A3-FOCUS', 'A2-TYPE'].filter(has)).concat(markets.slice(0, 3));
P.push('PART 1. profile_title\nOne sentence, no final period, at most 90 characters (about 14 words). It starts with "' + safe(company) + '" and says what the company sells and how it sells it. Facts only.\nEntries:\n' + (titleIds.length ? titleIds.map(line).join('\n') : 'None: leave the text empty.'));
const lay = layers.filter(l => l.mode !== 'none');
P.push('PART 2. layers\n' + (lay.length ? 'Write one text for each layer listed here, and for no other layer.\n' + lay.map(l => l.mode === 'buys'
  ? '- Layer ' + l.n + ' (status: Buys). The suppliers the entry names, with what each supplies in brackets when the entry says it. Write only the list, for example: local farmers (produce); Oatly and Why Not (add-ons). At most 150 characters (about 22 words). Leave it empty when the entry names no supplier.'
  : '- Layer ' + l.n + ' (status: ' + l.status + '). One sentence on what the company does in this layer, at most 150 characters (about 22 words). Do not write the status word; it is added for you.').join('\n') + '\nEntries:\n' + lay.map(l => line(l.entry)).join('\n') : 'No layer needs a text: return an empty list.'));
P.push('PART 3. products and focus_product\n' + (products.length ? 'For each product entry: text is one sentence on what the product is, at most 110 characters (about 16 words), without repeating its name.\nprice: only when an offer entry (A4-O) or the product\'s own entry gives a published price for this very product. Write the currency symbol and the figure in the English form, with a decimal point (€11.69, not €11,69), and the period or basis when the entry gives one, at most 45 characters. Examples: €19.44 a box. From $20 a month, billed annually. Free. A plan or tier of a product is a price of that product: with several plans give the lowest paid one, as From and the price. Put the id of that entry in price_entry. No such price: leave price and price_entry empty. Never give a product the price of another product.\nfocus_product: the id of the product entry that [A3-FOCUS] names as the product in focus; empty when the focus is the whole range or matches no single product.\nProduct entries:\n' + products.map(p => line(p.entry)).join('\n') + (has('A3-FOCUS') ? '\n' + line('A3-FOCUS') : '') + '\nOffer entries:\n' + (offers.length ? offers.map(line).join('\n') : 'None.') : 'The research lists no product: return an empty list and an empty focus_product.'));
const mctx = ['A4-NOMARKET', 'A4-KI7'].filter(has).concat(ids(/^A4-KI\d+$/).filter(id => /countr|market|zone|region|\bareas?\b/i.test(E[id].statement)).slice(0, 3)).filter((v, i, a) => a.indexOf(v) === i);
P.push('PART 4. markets\n' + (noMarket
  ? 'The research found no market, so the slide prints "Markets: not public." by itself. Write one more sentence, at most 70 characters, only if an entry below says something a reader can use about where the company sells (for example the currency of its prices). Otherwise leave the text empty.\nEntries:\n' + (mctx.length ? mctx.map(line).join('\n') : 'None: leave the text empty.')
  : 'One line, at most 110 characters: each country in bold, followed by its regions or cities when an entry names them. Separate countries with " · ". Mark a market that is only announced with (announced).\nEntries:\n' + markets.map(line).concat(mctx.filter(id => id !== 'A4-NOMARKET').map(line)).join('\n')));
P.push('PART 5. regulatory\n' + (regulator.length ? 'The regulatory status in at most 40 characters, in the regulator record\'s own terms, for example: FDA 510(k) cleared. Leave it empty when the entries give no clear status.\nEntries:\n' + regulator.map(line).join('\n') : 'No regulator record: leave the text empty.'));
const perClaim = claims.length >= 5 ? 55 : (claims.length === 4 ? 70 : 95);
P.push('PART 6. client_points\n' + (claims.length ? 'One point per claim entry, in this order. Format: a label of one or two words in bold, a colon, then the claim in the sense the site gives it, without the words "The company presents itself as". Put figures in bold. No final period. The box holds about 13 lines of 23 characters, so keep each point to at most ' + perClaim + ' characters (about ' + (claims.length >= 5 ? 8 : (claims.length === 4 ? 10 : 13)) + ' words after the label).\nExample: **Price:** up to **40%** cheaper than supermarkets\nEntries:\n' + claims.map(line).join('\n') : 'The research holds no claim: return an empty list.'));
const cat = has('A1-CATEGORY') ? line('A1-CATEGORY') : '';
P.push('PART 7. competitors\n' + (competitors.length ? 'One item per competitor listed here.\nsame_business: false only when the competitor\'s claims plainly describe a different kind of business from the company\'s' + (cat ? ' category in [A1-CATEGORY]' : '') + ' (for example an identity-verification firm listed against a food-box company). Then say why in one short sentence. In every other case true, with an empty why. A competitor with no claim entries is true.\nname: the competitor\'s own name, taken from the name given here, without product words (Ueofen, not Ueofen Ultrasonic Retainer Cleaner). Use only words of the name given.\npoints: one point per claim entry of that competitor, in the format of PART 6, at most 65 characters each (about 9 words after the label; its box holds about 10 lines of 21 characters).\n' + (cat ? cat + '\n' : '') + competitors.map(c => 'Competitor [' + c.entry + '] ' + safe(c.name) + (c.points.length ? '\n' + c.points.map(line).join('\n') : '\n(no claim entries: return an empty points list)')).join('\n') : 'The research found no competitor: return an empty list.'));
// The comparison title rests on this table: which competitors on the slide also make each of the company's claims.
// Only a competitor whose claims were captured can be compared; the others are named so the title says nothing about them.
const table = (shown) => {
  const comp = shown.filter(c => c.same !== null && c.points.length > 0);
  const lines = claims.map(id => { const n = num(id); const yes = comp.filter(c => c.same.includes(n)); const no = comp.filter(c => !c.same.includes(n)); return 'Claim ' + n + ' [' + id + ']: ' + safe(E[id].statement) + ' Also made by: ' + (yes.length ? yes.map(c => safe(c.name)).join(', ') : 'none') + '. Not made by: ' + (no.length ? no.map(c => safe(c.name)).join(', ') : 'none') + '.'; });
  const blank = shown.filter(c => !comp.includes(c));
  if (blank.length) lines.push('No claims were captured for ' + blank.map(c => safe(c.name)).join(', ') + ': say nothing about ' + (blank.length === 1 ? 'it' : 'them') + '.');
  return lines;
};
const t0 = table(shown0);
const comp0 = shown0.filter(c => c.same !== null && c.points.length > 0);
P.push('PART 8. compare_title\n' + (comp0.length && claims.length ? 'One sentence, no final period, at most 90 characters, for a reader who sees the slide: which of the company\'s claims a competitor also makes, and which none of them makes. Build it only from the table below. Use the competitors\' names rather than counts. Name a claim by its subject in plain words (for example: the price saving), never by its number. If a point you wrote in PART 7 plainly makes one of these claims although the table says that competitor does not, leave that claim out of the sentence.\n' + t0.join('\n')
  : (comp0.length ? 'The research holds no claim by the company. One sentence, no final period, at most 90 characters, on what the competitors\' claims in PART 7 have in common. Competitors on the slide: ' + shown0.map(c => safe(c.name)).join(', ') + '.' : 'Nothing to compare: leave the text empty.')));
return [{ json: { run_id: start.run_id, company, website: start.website, year, prompt: P.join('\n\n'), table0: t0, shown0: shown0.map(c => c.entry), layers, labels: LABEL, products, offers, markets, noMarket, offerType, pricing, regulator, claims, competitors, found, perClaim,
  entries: Object.fromEntries(Object.keys(E).filter(k => /^(A1-|A2-|A3-P|A3-FOCUS|A4-|B1-C\d+$|B2-K|B2-CLAIM|REG-)/.test(k)).map(k => [k, { kind: E[k].kind, statement: clean(E[k].statement), quote: clean(E[k].quote), value: E[k].value, unit: E[k].unit || '', source_url: E[k].source_url || '' }])),
  entries_read: kept.length, checks_ran: checked.length > 0, failed_left_out: all.filter(r => r.status === 'failed').length } }];
