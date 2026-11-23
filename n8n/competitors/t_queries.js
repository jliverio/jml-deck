// Offline test of Queries: the two real runs stored beside the slide values stage, and hand-made rows for the other cases.
const { run } = require('./harness');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass += 1; else { fail += 1; console.log('FAIL ' + name + (extra ? ' -> ' + JSON.stringify(extra) : '')); } };
const real = (f) => JSON.parse(fs.readFileSync(__dirname + '/../slide_values/' + f, 'utf8'));
const q = async (rows, company) => { const run_id = rows[0].run_id; const out = await run('queries.js', { outs: { Start: [{ json: { run_id, company } }] }, input: rows.map(r => ({ json: r })) }); return out.map(i => i.json); };
const mk = (run_id, site, quotes, extra) => [{ run_id, entry_id: 'A1-CATEGORY', statement: 'A home mortgage loan for individuals.', budget: 'company', source_url: '', quote: '' }].concat(quotes.map((t, i) => ({ run_id, entry_id: 'A1-L' + (i + 1), statement: 'x', budget: 'company', branch: 'position_product', source_url: site + 'page' + i, quote: t }))).concat(extra || []);
(async () => {
  // Equal Food: .co says nothing; market Portugal.
  let r = await q(real('ef_rows_1.json'), 'Equal Food');
  ok('EF own host', r[0].own_host === 'equalfood.co', r[0].own_host);
  ok('EF country', r[0].home_country === 'Portugal', [r[0].home_country, r[0].country_basis, r[0].page_language]);
  ok('EF three searches', r.length === 3 && r.every(x => x.country === 'PT' && x.q.indexOf('Portugal') !== -1), r.map(x => [x.q, x.country]));
  ok('EF markets clean', r[0].markets.length === 1 && r[0].markets[0] === 'Portugal', r[0].markets);
  console.log('Equal Food:', r[0].home_country, '|', r[0].country_basis, '| language', r[0].page_language || 'none'); r.forEach(x => console.log('   ', x.country, x.q));
  // n8n: .io, English, no market -> no country, searches as before.
  r = await q(real('n8n_rows_1.json'), 'n8n');
  ok('n8n own host', r[0].own_host === 'n8n.io', r[0].own_host);
  ok('n8n no country', r[0].home_country === '' && r[0].home_code === 'ALL', [r[0].home_country, r[0].page_language]);
  ok('n8n two searches, anywhere', r.length === 2 && r.every(x => x.country === 'ALL'), r.map(x => [x.q, x.country]));
  ok('n8n no pricing model among markets', r[0].markets.length === 0, r[0].markets);
  console.log('n8n:', r[0].home_country || 'no country', '| language', r[0].page_language || 'none'); r.forEach(x => console.log('   ', x.country, x.q));
  // Banco BPI: .pt, pages on a subdomain, no claims.
  r = await q(mk('r1', 'https://www.bancobpi.pt/particulares/', ['Crédito Habitação com as melhores condições para a sua casa', 'Simule o seu crédito e fale com um gestor']), 'Banco BPI');
  ok('BPI .pt', r[0].home_country === 'Portugal' && r[0].country_basis === 'its web address ends in .pt' && r[0].own_host === 'bancobpi.pt', r[0]);
  ok('BPI queries', r[0].q === 'home mortgage loan for individuals companies Portugal' && r[1].q === 'Banco BPI competitors alternatives Portugal' && r[2].q === 'largest home mortgage loan for individuals companies in Portugal', r.map(x => x.q));
  // .co.uk and a subdomain.
  r = await q(mk('r2', 'https://shop.example.co.uk/', ['We make the best tea in the world for you and your family']), 'Example');
  ok('co.uk', r[0].home_country === 'United Kingdom' && r[0].home_code === 'GB' && r[0].own_host === 'example.co.uk', [r[0].home_country, r[0].own_host]);
  // A country Brave has no code for: the name goes in the search, the code stays ALL.
  r = await q(mk('r3', 'https://www.example.ie/', ['We make the best tea']), 'Example');
  ok('Ireland: name, code ALL', r[0].home_country === 'Ireland' && r[0].home_code === 'ALL' && r[0].q.endsWith('Ireland'), [r[0].home_country, r[0].home_code]);
  // .com in Swedish: one country speaks it.
  const sv = ['Vi hjälper dig att hitta rätt och det är inte svårt', 'Boka en tid och få svar från oss till ett fast pris', 'Det är enkelt att komma igång och du betalar inte för mer än du behöver'];
  r = await q(mk('r4', 'https://www.example.com/', sv), 'Example');
  ok('Swedish .com', r[0].home_country === 'Sweden' && /Swedish/.test(r[0].country_basis), [r[0].home_country, r[0].country_basis, r[0].page_language]);
  // .com in Portuguese with no market: Portugal or Brazil, not decided.
  const pt = ['Entregamos em sua casa uma caixa com os melhores produtos da nossa região', 'Não é preciso estar em casa, e você pode mudar a sua encomenda', 'São mais de mil clientes que também compram os nossos cabazes'];
  r = await q(mk('r5', 'https://www.example.com/', pt), 'Example');
  ok('Portuguese .com, no market: no country', r[0].home_country === '' && r[0].page_language === 'Portuguese', [r[0].home_country, r[0].page_language]);
  // ... and with Brazil as a market among two.
  r = await q(mk('r6', 'https://www.example.com/', pt, [{ run_id: 'r6', entry_id: 'A4-M1', statement: 'Market: Brazil.', budget: 'company', source_url: '' }, { run_id: 'r6', entry_id: 'A4-M2', statement: 'Market: United States.', budget: 'company', source_url: '' }, { run_id: 'r6', entry_id: 'A4-MODEL', statement: 'Pricing model: subscription.', budget: 'company', source_url: '' }]), 'Example');
  ok('Portuguese .com selling in Brazil', r[0].home_country === 'Brazil' && r[0].home_code === 'BR' && r[0].markets.length === 2, [r[0].home_country, r[0].markets]);
  // English .com with three markets: no country, one search per market as before.
  r = await q(mk('r7', 'https://www.example.com/', ['We make the best tea in the world for you and your family, with our own leaves from the farm'], [{ run_id: 'r7', entry_id: 'A4-M1', statement: 'Market: United Kingdom.', budget: 'company', source_url: '' }, { run_id: 'r7', entry_id: 'A4-M2', statement: 'Market: Sweden.', budget: 'company', source_url: '' }]), 'Example');
  ok('English, two markets: as before', r[0].home_country === '' && r.length === 4 && r[2].country === 'GB' && r[3].country === 'SE', r.map(x => [x.q, x.country]));
  // A generic-use country code says nothing.
  r = await q(mk('r8', 'https://www.kinso.ai/', ['Your unified inbox for the messages that matter to you and your team']), 'Kinso');
  ok('.ai says nothing', r[0].home_country === '' && r[0].own_host === 'kinso.ai', [r[0].home_country]);
  // No category: nothing to search.
  r = await q([{ run_id: 'r9', entry_id: 'A4-M1', statement: 'Market: Spain.' }], 'Example');
  ok('no category', r.length === 1 && r[0]._none === true, r);
  // The language of the search (José, 23 Nov): the country's language for one search; English-speaking and unknown countries stay in English.
  r = await q(mk('r1', 'https://www.bancobpi.pt/particulares/', ['Crédito Habitação com as melhores condições para a sua casa', 'Simule o seu crédito e fale com um gestor']), 'Banco BPI');
  ok('Portugal: Portuguese, last search is the one to translate', r[0].local_language === 'Portuguese' && r[0].local_code === 'pt-pt' && r[0].local_line === r[2].q && r.every(x => x.search_lang === 'en' && x.local_line === r[2].q), [r[0].local_language, r[0].local_code, r[0].local_line]);
  r = await q(real('n8n_rows_1.json'), 'n8n');
  ok('no country: no other language', r.every(x => x.local_language === '' && x.local_line === '' && x.search_lang === 'en'), r.map(x => [x.local_language, x.local_line]));
  r = await q(mk('r2', 'https://shop.example.co.uk/', ['We make the best tea in the world for you and your family']), 'Example');
  ok('United Kingdom: stays in English', r[0].local_language === '' && r[0].local_line === '', [r[0].local_language]);
  r = await q(mk('r4', 'https://www.example.com/', sv), 'Example');
  ok('Sweden: Swedish', r[0].local_language === 'Swedish' && r[0].local_code === 'sv', [r[0].local_language, r[0].local_code]);
  r = await q(mk('r6', 'https://www.example.com/', pt, [{ run_id: 'r6', entry_id: 'A4-M1', statement: 'Market: Brazil.', budget: 'company', source_url: '' }, { run_id: 'r6', entry_id: 'A4-M2', statement: 'Market: United States.', budget: 'company', source_url: '' }]), 'Example');
  ok('Brazil: Portuguese of Brazil', r[0].local_language === 'Portuguese' && r[0].local_code === 'pt-br', [r[0].local_language, r[0].local_code]);
  const nl = ['Wij maken het voor je klaar en het is niet duur, met een vaste prijs voor onze klanten', 'Bestel op de website en je hebt het de volgende dag in huis, ook bij jou in de buurt', 'Dat is een van de redenen dat onze klanten naar ons terugkomen'];
  r = await q(mk('r10', 'https://www.example.be/', nl), 'Example');
  ok('Belgium, pages in Dutch: Dutch', r[0].home_country === 'Belgium' && r[0].local_language === 'Dutch' && r[0].local_code === 'nl', [r[0].home_country, r[0].page_language, r[0].local_language]);
  r = await q(mk('r11', 'https://www.example.be/', ['We make the best tea in the world for you and your family, with our own leaves from the farm and the hills']), 'Example');
  ok('Belgium, pages in English: stays in English', r[0].home_country === 'Belgium' && r[0].local_language === '', [r[0].page_language, r[0].local_language]);
  r = await q(mk('r12', 'https://www.zimadental.nl/', ['The best clean for your retainer and your aligners, with our ultrasonic pod and the tablets']), 'Zima Dental');
  ok('Netherlands, pages in English: Dutch all the same', r[0].home_country === 'Netherlands' && r[0].local_language === 'Dutch' && r[0].local_line === r[2].q, [r[0].local_language, r[0].local_line]);
  // Searches: the node that swaps the translated line in.
  const S = async (qs, tr) => (await run('searches.js', { outs: tr === undefined ? { Queries: qs.map(j => ({ json: j })) } : { Queries: qs.map(j => ({ json: j })), 'Translate the search': [{ json: tr }] }, input: qs.map(j => ({ json: j })) })).map(i => i.json);
  const bpi = await q(mk('r1', 'https://www.bancobpi.pt/particulares/', ['Crédito Habitação com as melhores condições para a sua casa', 'Simule o seu crédito e fale com um gestor']), 'Banco BPI');
  let s3 = await S(bpi, { output: { search: ' "maiores bancos de crédito habitação em Portugal" ' } });
  ok('translated: the last search is in Portuguese, quotes removed', s3.length === 3 && s3[2].q === 'maiores bancos de crédito habitação em Portugal' && s3[2].search_lang === 'pt-pt' && s3[2].english === bpi[2].q && /searched in Portuguese$/.test(s3[2].purpose), s3[2]);
  ok('translated: the other two stay as they were, in English', s3[0].q === bpi[0].q && s3[1].q === bpi[1].q && s3[0].search_lang === 'en' && s3[1].search_lang === 'en' && !s3[0].english, s3.slice(0, 2).map(x => [x.q, x.search_lang]));
  ok('translated: country and code are kept', s3.every(x => x.country === 'PT' && x.home_country === 'Portugal'), s3.map(x => x.country));
  s3 = await S(bpi);
  ok('no translation step ran: English, as before', s3.map(x => x.q).join('|') === bpi.map(x => x.q).join('|') && s3.every(x => x.search_lang === 'en' && !x.english), s3.map(x => [x.q, x.search_lang]));
  s3 = await S(bpi, { error: 'the model call failed' });
  ok('translation failed: English, as before', s3[2].q === bpi[2].q && s3[2].search_lang === 'en', s3[2].q);
  s3 = await S(bpi, { output: { search: '   ' } });
  ok('translation empty: English', s3[2].q === bpi[2].q && s3[2].search_lang === 'en', s3[2].q);
  s3 = await S(bpi, { output: { search: bpi[2].q.toUpperCase() } });
  ok('translation unchanged: English', s3[2].q === bpi[2].q && !s3[2].english, s3[2].q);
  s3 = await S(bpi, { output: { search: Array(80).fill('palavra').join(' ') } });
  ok('a long translation is cut at a word, to at most 40 words and 300 characters', s3[2].q.split(' ').length <= 40 && s3[2].q.length <= 300 && s3[2].q.endsWith('palavra'), [s3[2].q.split(' ').length, s3[2].q.length]);
  const none = await q(real('n8n_rows_1.json'), 'n8n');
  s3 = await S(none, { output: { search: 'qualquer coisa' } });
  ok('no country: nothing is swapped even if a translation exists', s3.map(x => x.q).join('|') === none.map(x => x.q).join('|'), s3.map(x => x.q));
  console.log(pass + ' passed, ' + fail + ' failed (queries)');
  process.exit(fail ? 1 : 0);
})();
