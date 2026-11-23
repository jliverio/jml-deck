// Offline test of Rank, Site queries, Site sources, Site pages, Build entries, Rows only, List rows and Summary, with hand-written pages,
// search results and model answers.
const { run } = require('./harness');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass += 1; else { fail += 1; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); } };
const J = (a) => a.map(x => ({ json: x }));
const brave = (urls) => ({ web: { results: urls.map(u => ({ url: u, title: 't' })) } });

// ---- The site finder, one name at a time ----
const pick = async (name, urls, o) => {
  o = o || {};
  const q0 = { company: 'Client', category: 'home mortgage loan for individuals', own_host: o.own || 'client.pt', home_country: o.home || '', home_code: 'ALL' };
  const cand = { name, rank: 1, mentions: 1, measure: 'none', value: 0, sells: 'unknown', hq: '', site: o.site || '', q: 'x' };
  const out = await run('site_sources.js', { outs: { Queries: J([q0]), 'Site queries': J([cand]) }, input: J([brave(urls)]) });
  return out[0].json._none ? '' : out[0].json.site_url;
};
(async () => {
  const cases = [
    ['Caixa Geral de Depósitos', ['https://www.idealista.pt/news/cgd', 'https://www.cgd.pt/Particulares/Credito-Habitacao/Pages/x.aspx'], 'https://www.cgd.pt/'],
    ['Millennium bcp', ['https://ind.millenniumbcp.pt/pt/Particulares/Pages/x.aspx'], 'https://ind.millenniumbcp.pt/'],
    ['Banco Santander Totta', ['https://www.bancobpi.pt/particulares', 'https://www.santander.pt/credito-habitacao'], 'https://www.santander.pt/', { own: 'bancobpi.pt' }],
    ['Novo Banco', ['https://www.novobanco.pt/particulares'], 'https://www.novobanco.pt/'],
    ['Crédito Agrícola', ['https://www.creditoagricola.pt/'], 'https://www.creditoagricola.pt/'],
    ['North American Savings Bank', ['https://www.bankrate.com/x', 'https://www.nasb.com/lending'], 'https://www.nasb.com/'],
    ['Veterans United Home Loans', ['https://www.veterans.com/x', 'https://www.veteransunited.com/'], 'https://www.veteransunited.com/'],
    ['Ueofen Ultrasonic Retainer Cleaner', ['https://www.amazon.com/dp/B0X', 'https://www.forbes.com/best'], ''],
    ['Ueofen', ['https://www.amazon.com/dp/B0X', 'https://ueofen.com/products/x'], 'https://ueofen.com/'],
    ['Amazon', ['https://www.amazon.com/'], 'https://www.amazon.com/'],
    ['Pursonic Ultrasonic Cleaner Pod', ['https://pursonicusa.com/products/pod'], 'https://pursonicusa.com/'],          // a product name still leads to the brand's site, through its distinctive word
    ['Pursonic', ['https://pursonicusa.com/products/pod'], 'https://pursonicusa.com/'],
    ['iSonic', ['https://www.isonicinc.com/'], 'https://www.isonicinc.com/'],
    ['Missive', ['https://mail.missiveapp.com/login', 'https://missiveapp.com/pricing'], 'https://missiveapp.com/'],
    ['Reclaim.ai', ['https://reclaim.ai/'], 'https://reclaim.ai/'],
    ['Superhuman Mail', ['https://superhuman.com/'], 'https://superhuman.com/'],
    ['Make', ['https://www.makeuseof.com/x', 'https://www.make.com/en'], 'https://www.make.com/'],
    ['Make', ['https://www.makeuseof.com/x'], ''],
    ['Bio em Casa', ['https://bioemcasa.wixsite.com/loja/cabazes'], 'https://bioemcasa.wixsite.com/loja'],
    ['Google Calendar', ['https://workspace.google.com/products/calendar/'], 'https://workspace.google.com/'],
    ['Zapier', ['https://zapier.com/blog/x'], 'https://zapier.com/'],
    ['Prove', ['https://www.prove.com/', 'https://www.prove.pt/'], 'https://www.prove.pt/', { home: 'Portugal' }],
    ['Prove', ['https://www.prove.com/', 'https://www.prove.pt/'], 'https://www.prove.com/'],
    ['Client Rival', ['https://www.client.pt/rival'], ''],                                          // the client's own site never counts
    ['Some Brand', ['https://www.linkedin.com/company/some-brand', 'https://en.wikipedia.org/wiki/Some_Brand'], ''],
    ['Odd Name', ['https://unrelated.com/'], 'https://oddsite.com/', { site: 'https://oddsite.com/about' }],   // linked from the page: taken when the search finds nothing better
    ['Odd Name', ['https://oddname.com/'], 'https://oddname.com/', { site: 'https://oddsite.com/about' }],     // ... a matching address wins over a link that does not match
  ];
  for (const [name, urls, want, o] of cases) { const got = await pick(name, urls, o); ok('site of ' + name + ' from ' + urls.join(' '), got === want, got); }

  // ---- A Portuguese bank: the whole chain ----
  const q0 = { company: 'Banco BPI', category: 'home mortgage loan for individuals', markets: [], markets_text: 'not public', claims: [{ n: 1, claim: 'The company presents itself as the bank with the fastest mortgage approval.' }], claims_text: '1. The company presents itself as the bank with the fastest mortgage approval.', own_host: 'bancobpi.pt', home_country: 'Portugal', home_code: 'PT', country_basis: 'its web address ends in .pt', purpose: 'the category in Portugal', q: 'home mortgage loan for individuals companies Portugal', country: 'PT' };
  const p1 = { url: 'https://www.comparaja.pt/credito-habitacao/bancos', title: 'Bancos em Portugal', text: 'Os maiores bancos em Portugal no crédito habitação. A Caixa Geral de Depósitos lidera com 25 mil milhões de euros de crédito concedido em 2025. O Millennium bcp é o maior banco privado português no crédito à habitação. O Banco Santander Totta tem uma quota de 18 por cento no crédito à habitação. O Novobanco ([novobanco.pt](https://www.novobanco.pt)) oferece spreads desde 0,85 por cento. O Banco BPI é outro dos grandes bancos. Compre na [Amazon](https://www.amazon.es/x) o livro do Banco CTT, o banco dos correios com crédito habitação. O UCI é um especialista em crédito habitação em Portugal e Espanha. O Bankinter tem uma oferta de taxa mista muito procurada em Portugal.' };
  const p2 = { url: 'https://www.forbes.com/advisor/mortgages/best-lenders/', title: 'Best Mortgage Lenders', text: 'Best mortgage lenders in the United States for 2026. Veterans United Home Loans originated 82,764 loans in 2025 for American veterans. Santander is also a large lender in Portugal and Spain with mortgage products. Doutor Finanças is a broker that compares mortgage offers for free in Portugal. Crédito Agrícola is a cooperative bank group with mortgage loans.' };
  const C = (name, sells, quote, o) => Object.assign({ name, type: 'Direct', hq_country: '', sells_there: sells, site: '', measure: 'none', value: 0, unit: '', as_of: '', quote, markets: [] }, o || {});
  const out1 = { output: { companies: [
    C('Caixa Geral de Depósitos', 'yes', 'A Caixa Geral de Depósitos lidera com 25 mil milhões de euros de crédito concedido em 2025', { measure: 'customers', value: 25000000000, unit: 'EUR credit granted', as_of: '2025', hq_country: 'Portugal' }),
    C('Millennium bcp (BCP)', 'yes', 'O Millennium bcp é o maior banco privado português no crédito à habitação'),
    C('Banco Santander Totta', 'yes', 'O Banco Santander Totta tem uma quota de 18 por cento no crédito à habitação'),
    C('Novobanco', 'yes', 'O Novobanco ([novobanco.pt](https://www.novobanco.pt)) oferece spreads desde 0,85 por cento', { site: 'https://www.novobanco.pt' }),
    C('Banco BPI', 'yes', 'O Banco BPI é outro dos grandes bancos'),
    C('BPI', 'yes', 'O Banco BPI é outro dos grandes bancos'),
    C('Banco CTT', 'yes', 'o livro do Banco CTT, o banco dos correios com crédito habitação', { site: 'https://www.amazon.es/x' }),
    C('UCI', 'yes', 'O UCI é um especialista em crédito habitação em Portugal e Espanha'),
    C('Bankinter', 'yes', 'O Bankinter tem uma oferta de taxa mista muito procurada em Portugal'),
    C('Invented Bank', 'yes', 'This sentence is not on the page at all, anywhere'),
  ] } };
  const out2 = { output: { companies: [
    C('Veterans United Home Loans', 'no', 'Veterans United Home Loans originated 82,764 loans in 2025 for American veterans', { measure: 'customers', value: 82764, unit: 'loans originated', as_of: '2025', hq_country: 'United States' }),
    C('Santander', 'yes', 'Santander is also a large lender in Portugal and Spain with mortgage products'),
    C('Doutor Finanças', 'yes', 'Doutor Finanças is a broker that compares mortgage offers for free in Portugal', { type: 'Substitute' }),
    C('Crédito Agrícola', 'unknown', 'Crédito Agrícola is a cooperative bank group with mortgage loans', { measure: 'revenue', value: 900000000, unit: 'EUR' }),
  ] } };
  const outs = { Start: J([{ run_id: 'r1', company: 'Banco BPI', started_at: new Date().toISOString() }]), Queries: J([q0, q0]), Sources: J([{ url: p1.url }, { url: p2.url }]), Pages: J([p1, p2]) };          // two searches: eight candidates fit the budget of 10
  let rank = await run('rank.js', { outs, input: J([out1, out2]) });
  outs.Rank = rank;
  const R = rank.map(i => i.json);
  const names = R.map(x => x.name);
  ok('rank: the client is never listed', !names.some(n => /BPI/.test(n)), names);
  ok('rank: a quote that is not on the page is dropped', !names.includes('Invented Bank') && R[0].quotes_dropped === 1, R[0].quotes_dropped);
  ok('rank: a company the page shows does not sell in the country is left out', !names.includes('Veterans United Home Loans') && R[0].not_selling.join() === 'Veterans United Home Loans', R[0].not_selling);
  ok('rank: brackets leave the name', names.includes('Millennium bcp'), names);
  ok('rank: a size figure first; a company that sells there goes before one the page says nothing about, even with revenue', names[0] === 'Caixa Geral de Depósitos' && R[0].also_named.join() === 'Doutor Finanças,Crédito Agrícola', [names, R[0].also_named]);
  ok('rank: eight go on', R.length === 8 && R[0].candidates === 11, [R.length, R[0].candidates]);
  ok('rank: a site written on the page is kept', R.find(x => x.name === 'Novobanco').site === 'https://www.novobanco.pt', R.find(x => x.name === 'Novobanco').site);
  ok('rank: a shop is not a site', R.find(x => x.name === 'Banco CTT').site === '', R.find(x => x.name === 'Banco CTT').site);
  const sq = await run('site_queries.js', { outs, input: [] });
  outs['Site queries'] = sq;
  ok('site search: name, category, country', sq[0].json.q === 'Caixa Geral de Depósitos home mortgage loan for individuals Portugal official website' && sq[0].json.site_country === 'PT', sq[0].json.q);
  const RES = { 'Caixa Geral de Depósitos': ['https://www.cgd.pt/Particulares/x'], 'Millennium bcp': ['https://www.millennium-investimentos.pt/x'], 'Banco Santander Totta': ['https://www.santander.pt/credito'], 'Novobanco': ['https://www.idealista.pt/x'], 'Banco CTT': ['https://www.bancoctt.pt/'], 'UCI': ['https://www.idealista.pt/news/uci'], 'Bankinter': ['https://www.bankinter.pt/'], 'Santander': ['https://www.santander.pt/'], 'Doutor Finanças': ['https://www.doutorfinancas.pt/'], 'Crédito Agrícola': ['https://www.creditoagricola.pt/'] };
  const ss = await run('site_sources.js', { outs, input: sq.map(i => ({ json: brave(RES[i.json.name] || []) })) });
  outs['Site sources'] = ss;
  const S = ss.map(i => i.json);
  ok('sites: a name with no site of its own is left out', S[0]._sites.left_out.length === 1 && S[0]._sites.left_out[0].name === 'UCI', S[0]._sites.left_out);
  const santander = S.find(x => /Santander/.test(x.name));
  ok('sites: two names on one site are one company', S.filter(x => /Santander/.test(x.name)).length === 1 && S[0]._sites.merged.length === 1 && santander.mentions === 2 && santander.name === 'Banco Santander Totta' && santander.aliases.join() === 'Santander' && santander.rank === 2, [S.map(x => x.name), S[0]._sites.merged]);
  ok('sites: ranks renumbered without gaps', S.map(x => x.rank).join() === S.map((x, i) => i + 1).join(), S.map(x => x.rank));
  ok('sites: the address from the page is used when the search finds none', S.find(x => x.name === 'Novobanco').site_url === 'https://www.novobanco.pt/' && /linked/.test(S.find(x => x.name === 'Novobanco').site_found), S.find(x => x.name === 'Novobanco'));
  console.log('after the site step:', S.map(x => x.rank + ' ' + x.name + ' ' + x.site_url).join(' | '));
  const md = (t) => ({ data: { markdown: (t + ' ').repeat(30) } });
  const fetched = S.map(c => c.name === 'Bankinter' ? { error: 'timeout' } : md('Crédito habitação com as melhores condições. Somos o banco de confiança dos portugueses há muitos anos. ' + c.name));
  const sp = await run('site_pages.js', { outs, input: J(fetched) });
  outs['Site pages'] = sp;
  ok('home pages: the one that failed is not read', sp.length === S.length - 1 && sp.every(i => i.json.category === q0.category), sp.length);
  const LC = (o) => ({ output: Object.assign({ hq_country: 'Portugal', page_company: '', is_competitor_site: true, same_need: true, reason: '', advantages: [{ claim: 'The company presents itself as the trusted bank of the Portuguese.', quote: 'Somos o banco de confiança dos portugueses há muitos anos' }, { claim: 'The company presents itself as invented.', quote: 'words that are not on the page at all' }], price: { amount: 0, currency: '', buys: '', quote: '' }, same_claims: [1, 7] }, o || {}) });
  const lightOut = sp.map(i => i.json.name === 'Millennium bcp' ? LC({ is_competitor_site: false, page_company: 'Another Company' }) : (i.json.name === 'Banco CTT' ? LC({ is_competitor_site: false, reason: 'The page is a shop.' }) : LC()));          // Banco CTT's address is exactly its name, so it stays
  const be = await run('build.js', { outs, input: J(lightOut) });
  outs['Build entries'] = be;
  const B = be.map(i => i.json);
  const sum = B[0]._summary;
  const K = B.filter(r => /^B2-K\d$/.test(r.entry_id));
  console.log('final:', sum.competitors.map(c => c.rank + ' ' + c.name + (c.home_page_read ? '' : ' (not read)')).join(' | '));
  console.log('left out:', sum.left_out.map(x => x.name + ' — ' + x.why).join(' | '));
  ok('build: five at most, numbered 1 to 5', K.length === 5 && K.map(r => r.entry_id).join() === 'B2-K1,B2-K2,B2-K3,B2-K4,B2-K5', K.map(r => r.entry_id));
  ok('build: the wrong site is left out with the reason', sum.left_out.length === 2 && sum.left_out.find(x => x.name === 'Millennium bcp').why === 'the site found, millennium-investimentos.pt, is not its own (it is the page of Another Company)', sum.left_out);
  const RX = /^(.*?):\s*([^.,]*?)(?:,\s*based in\s+([^.]*))?\.\s*Ranking measure:\s*(.*)$/;          // the pattern the slide values stage reads
  ok('build: the entry keeps the format the slide stage reads', K.every(r => RX.test(r.statement)) && K[0].statement === 'Caixa Geral de Depósitos: Direct competitor, based in Portugal. Ranking measure: customers 25000000000 EUR credit granted (2025).', K[0].statement);
  ok('build: merged names are noted', /Also named as: Santander\.$/.test(K.find(r => /^Banco Santander Totta/.test(r.statement)).check_note), K.find(r => /^Banco Santander Totta/.test(r.statement)).check_note);
  const bk = K.find(r => /^Bankinter/.test(r.statement));
  ok('build: a site that did not load stays, with a note', bk && /Site not loaded: https:\/\/www\.bankinter\.pt\/\./.test(bk.check_note) && !B.some(r => r.entry_id === bk.entry_id + '-S'), bk && bk.check_note);
  ok('build: an advantage is kept only with its quote on the page', B.filter(r => /-A\d$/.test(r.entry_id)).length === 4 && B.filter(r => /-A2$/.test(r.entry_id)).length === 0 && sum.quotes_dropped_light_check === 4, [B.filter(r => /-A\d$/.test(r.entry_id)).length, sum.quotes_dropped_light_check]);
  ok('build: same-claim count over the pages read', B.find(r => r.entry_id === 'B2-CLAIM-1').statement === 'Claim 1 is also made by 4 of the 4 competitors whose home page was read.', B.find(r => r.entry_id === 'B2-CLAIM-1').statement);
  ok('build: no gap entry when five are found', !B.some(r => r.entry_id === 'B2-COUNT'));
  ok('build: summary', sum.home_country === 'Portugal' && sum.candidates === 11 && sum.home_pages_read === 4 && sum.light_checks === 5 && sum.checked === 7 && sum.not_selling.length === 1, sum);
  const ro = await run('rows_only.js', { outs, input: be });
  ok('rows only: nothing but table columns', ro.every(i => !('_summary' in i.json) && !('_list' in i.json)) && ro.length === B.length, Object.keys(ro[0].json));
  const lr = await run('list_rows.js', { outs, input: ro });
  ok('list: the final five, with the site read or not', lr.length === 5 && lr[0].json.run_id === 'r1' && lr[0].json.rank === 1 && lr.find(i => i.json.name === 'Bankinter').json.site_loaded === false && lr[0].json.site_loaded === true && Object.keys(lr[0].json).sort().join() === 'market,measure,measure_source,measure_value,name,rank,run_id,site_loaded', lr.map(i => i.json));
  const su = await run('summary.js', { outs, input: lr });
  const SU = su[0].json;
  console.log('note:', SU.note);
  ok('summary', SU.outcome === 'ok' && SU.searches === 10 && SU.model_calls === 7 && SU.pages_fetched === 7 && /^10 searches run in Portugal \(its web address ends in \.pt\), 2 pages read; 11 companies named, 5 of 5 listed/.test(SU.note) && /left out: UCI \(no website of its own was found\)/.test(SU.note) && /not selling in Portugal: Veterans United Home Loans$/.test(SU.note) && SU.home_country === 'Portugal', SU);

  // ---- Fewer than five pass ----
  const few = S.slice(0, 3);
  outs['Site sources'] = J(few.map((c, i) => i === 0 ? { ...c, _sites: S[0]._sites } : c));
  outs['Site pages'] = J(few.map(c => ({ rank: c.rank, name: c.name, site_url: c.site_url, text: 'Somos o banco de confiança dos portugueses há muitos anos' })));
  const be2 = await run('build.js', { outs, input: J(few.map((c, i) => i === 1 ? LC({ same_need: false, reason: 'It sells car insurance.' }) : LC())) });
  const gap = be2.map(i => i.json).find(r => r.entry_id === 'B2-COUNT');
  ok('build: an unrelated offer is left out with the reason, and the next one moves up', be2[0].json._summary.left_out.some(x => x.name === 'Banco Santander Totta' && x.why === 'its home page shows it sells something else: It sells car insurance') && be2.map(i => i.json).find(r => r.entry_id === 'B2-K2').statement.indexOf('Millennium bcp:') === 0, be2[0].json._summary.left_out);
  ok('build: gap entry when fewer than five pass', gap && gap.statement === '2 of 5 found.' && /Searched in Portugal\./.test(gap.check_note) && /Left out: UCI \(no website of its own was found\); /.test(gap.check_note) && /Not selling in Portugal on the pages read: Veterans United Home Loans\./.test(gap.check_note), gap);
  // ---- No site for anyone ----
  outs['Site sources'] = J([{ _none: true, _sites: { left_out: [{ name: 'A', why: 'no website of its own was found' }], merged: [] } }]);
  delete outs['Site pages'];
  const be3 = await run('build.js', { outs, input: J([{ _none: true, _sites: {} }]) });
  const B3 = be3.map(i => i.json);
  ok('build: no site at all: only the counts', B3.length === 2 && B3[0].entry_id === 'B2-CLAIM-1' && B3[1].statement === '0 of 5 found.' && B3[0]._list.length === 0, B3.map(r => r.entry_id + ' ' + r.statement));
  outs['Build entries'] = be3;
  const lr3 = await run('list_rows.js', { outs, input: be3 });
  ok('list: nothing to save', lr3.length === 1 && lr3[0].json._none === true, lr3);

  // ---- No country: as before, by measure then mentions ----
  const g0 = { ...q0, company: 'n8n', own_host: 'n8n.io', home_country: '', home_code: 'ALL', country_basis: '', category: 'workflow automation platform' };
  const g1 = { url: 'https://a.com/x', title: 'a', text: 'Zapier has 3 million users as of 2025 and is the largest. Make is a visual tool with many scenarios to build. Gumloop raised 20 million dollars in funding last year.' };
  const g2 = { url: 'https://b.com/y', title: 'b', text: 'Make is a visual tool with many scenarios to build. Workato reported revenue of 200 million dollars for 2025.' };
  const go1 = { output: { companies: [C('Zapier', 'unknown', 'Zapier has 3 million users as of 2025 and is the largest', { measure: 'customers', value: 3000000, unit: 'users' }), C('Make (formerly Integromat)', 'no', 'Make is a visual tool with many scenarios to build'), C('Gumloop', 'unknown', 'Gumloop raised 20 million dollars in funding last year', { measure: 'funding', value: 20000000, unit: 'USD' })] } };
  const go2 = { output: { companies: [C('Make', 'unknown', 'Make is a visual tool with many scenarios to build'), C('Workato', 'yes', 'Workato reported revenue of 200 million dollars for 2025', { measure: 'revenue', value: 200000000, unit: 'USD' })] } };
  const gr = await run('rank.js', { outs: { Queries: J([g0]), Pages: J([g1, g2]) }, input: J([go1, go2]) });
  ok('no country: nobody is left out for where it sells, order by measure then mentions', gr.map(i => i.json.name).join() === 'Workato,Zapier,Gumloop,Make' && gr[0].json.not_selling.length === 0 && gr[3].json.mentions === 2, gr.map(i => [i.json.name, i.json.sells]));
  // ---- Everything named sells elsewhere ----
  const nr = await run('rank.js', { outs: { Queries: J([q0]), Pages: J([p2]) }, input: J([{ output: { companies: [out2.output.companies[0]] } }]) });
  ok('country: all named sell elsewhere -> none, with the names', nr.length === 1 && nr[0].json._none === true && nr[0].json.candidates === 1 && nr[0].json.not_selling.length === 1, nr[0].json);
  const su2 = await run('summary.js', { outs: { Start: outs.Start, Queries: J([q0, q0, q0]), Sources: J([{ url: p2.url }]), Pages: J([p2]), Rank: nr }, input: nr });
  ok('summary: none kept', su2[0].json.outcome === 'partial' && /1 companies named, none kept: the pages show they do not sell in Portugal\.$/.test(su2[0].json.note), su2[0].json.note);
  // ---- Round 2: accents and spacing in names, the search budget, www, and two sites of one company ----
  const a1 = { url: 'https://a.pt/x', title: 'a', text: 'A Caixa Geral de Depósitos é o maior banco do país em crédito. O Millennium bcp é o maior banco privado em Portugal.' };
  const a2 = { url: 'https://b.pt/y', title: 'b', text: 'Caixa Geral de Depositos is the largest bank in Portugal. Millenniumbcp is the largest private bank in Portugal.' };
  const ar = await run('rank.js', { outs: { Queries: J([q0, q0, q0]), Pages: J([a1, a2]) }, input: J([{ output: { companies: [C('Caixa Geral de Depósitos', 'yes', 'A Caixa Geral de Depósitos é o maior banco do país em crédito'), C('Millennium bcp', 'yes', 'O Millennium bcp é o maior banco privado em Portugal')] } }, { output: { companies: [C('Caixa Geral de Depositos', 'yes', 'Caixa Geral de Depositos is the largest bank in Portugal'), C('Millenniumbcp', 'yes', 'Millenniumbcp is the largest private bank in Portugal')] } }]) });
  ok('rank: an accent or a space does not make a second company', ar.length === 2 && ar.every(i => i.json.mentions === 2) && ar[0].json.name === 'Caixa Geral de Depósitos', ar.map(i => [i.json.name, i.json.mentions]));
  const many = { output: { companies: 'ABCDEFGHIJ'.split('').map(x => C('Company ' + x + x + x, 'yes', 'Company ' + x + x + x + ' is one of the banks on this page')) } };
  const mp = { url: 'https://c.pt/z', title: 'c', text: 'ABCDEFGHIJ'.split('').map(x => 'Company ' + x + x + x + ' is one of the banks on this page.').join(' ') };
  const pool = async (n) => (await run('rank.js', { outs: { Queries: J(Array(n).fill(q0)), Pages: J([mp]) }, input: J([many]) })).length;
  ok('rank: candidates passed on keep the stage at 10 searches', (await pool(3)) === 7 && (await pool(2)) === 8 && (await pool(5)) === 5, [await pool(3), await pool(2), await pool(5)]);
  ok('site: www is kept when the address found has it', (await pick('Caixa Geral de Depósitos', ['https://www.cgd.pt/Particulares/x'])) === 'https://www.cgd.pt/' && (await pick('Novo Banco', ['https://novobanco.pt/particulares'])) === 'https://novobanco.pt/' && (await pick('Missive', ['https://mail.missiveapp.com/login'])) === 'https://missiveapp.com/', [await pick('Caixa Geral de Depósitos', ['https://www.cgd.pt/Particulares/x'])]);
  const two = [{ name: 'Santander Totta', rank: 1, type: 'Direct', hq: '', measure: 'none', value: 0, unit: '', as_of: '', quote: 'q', source_url: 'https://a.pt/x', source_title: 't', mentions: 2, markets: [], sells: 'yes', site_url: 'https://www.santandertotta.pt/', site_found: 's', aliases: [], _sites: { left_out: [], merged: [], empty_searches: 0 } }, { name: 'Banco Santander Portugal', rank: 2, type: 'Direct', hq: '', measure: 'none', value: 0, unit: '', as_of: '', quote: 'q', source_url: 'https://a.pt/x', source_title: 't', mentions: 1, markets: [], sells: 'yes', site_url: 'https://www.santander.pt/', site_found: 's', aliases: [] }, { name: 'Novo Banco', rank: 3, type: 'Direct', hq: '', measure: 'none', value: 0, unit: '', as_of: '', quote: 'q', source_url: 'https://a.pt/x', source_title: 't', mentions: 1, markets: [], sells: 'yes', site_url: 'https://www.novobanco.pt/', site_found: 's', aliases: [] }];
  const fetched2 = [{ data: { markdown: ('Somos o banco de confiança dos portugueses há muitos anos ').repeat(20), metadata: { sourceURL: 'https://www.santandertotta.pt/', url: 'https://www.santander.pt/particulares' } } }, { data: { markdown: ('Somos o banco de confiança dos portugueses há muitos anos ').repeat(20), metadata: { sourceURL: 'https://www.santander.pt/', url: 'https://www.santander.pt/' } } }, { data: { markdown: ('Somos o banco de confiança dos portugueses há muitos anos ').repeat(20), metadata: { sourceURL: 'https://www.novobanco.pt/' } } }];
  const o2 = { Start: outs.Start, Queries: J([q0]), Rank: J([{ candidates: 3, quotes_dropped: 0, also_named: [], not_selling: [] }]), 'Site sources': J(two) };
  o2['Site pages'] = await run('site_pages.js', { outs: o2, input: J(fetched2) });
  ok('home pages: where the page landed is kept', o2['Site pages'][0].json.landed_on === 'https://www.santander.pt/particulares' && o2['Site pages'][2].json.landed_on === 'https://www.novobanco.pt/', o2['Site pages'].map(i => i.json.landed_on));
  let b4 = (await run('build.js', { outs: o2, input: J([LC({ page_company: 'Santander' }), LC({ page_company: 'Banco Santander' }), LC({ page_company: 'novobanco' })]) })).map(i => i.json);
  ok('build: two names whose pages land on one site are one company', b4[0]._summary.competitors.length === 2 && b4[0]._summary.competitors[0].name === 'Santander Totta' && b4[0]._summary.competitors[0].mentions === 3 && b4[0]._summary.competitors[0].also_named_as.join() === 'Banco Santander Portugal' && b4[0]._summary.competitors[1].name === 'Novo Banco' && b4[0]._summary.competitors[1].rank === 2 && b4[0]._summary.merged.length === 1, b4[0]._summary.competitors);
  o2['Site pages'] = J(o2['Site pages'].map(i => ({ ...i.json, landed_on: '' })));
  b4 = (await run('build.js', { outs: o2, input: J([LC({ page_company: 'Santander' }), LC({ page_company: 'SANTANDER' }), LC({ page_company: 'novobanco' })]) })).map(i => i.json);
  ok('build: ... or name the same company', b4[0]._summary.competitors.length === 2 && b4[0]._summary.merged.length === 1, b4[0]._summary.competitors.map(c => c.name));
  b4 = (await run('build.js', { outs: o2, input: J([LC({ page_company: '' }), LC({ page_company: '' }), LC({ page_company: 'novobanco' })]) })).map(i => i.json);
  ok('build: an empty page name merges nothing', b4[0]._summary.competitors.length === 3, b4[0]._summary.competitors.map(c => c.name));
  // ---- Round 3: which spelling of a name is kept, direct before substitute on a tie, app addresses, any strong word of the name ----
  const ar2 = await run('rank.js', { outs: { Queries: J([q0, q0, q0]), Pages: J([a2, a1]) }, input: J([{ output: { companies: [C('Caixa Geral de Depositos', 'yes', 'Caixa Geral de Depositos is the largest bank in Portugal'), C('Millenniumbcp', 'yes', 'Millenniumbcp is the largest private bank in Portugal')] } }, { output: { companies: [C('Caixa Geral de Depósitos', 'yes', 'A Caixa Geral de Depósitos é o maior banco do país em crédito'), C('Millennium bcp', 'yes', 'O Millennium bcp é o maior banco privado em Portugal')] } }]) });
  ok('rank: the spelling with the accent or the space is kept, whatever the order of the pages', ar2.map(i => i.json.name).sort().join() === 'Caixa Geral de Depósitos,Millennium bcp', ar2.map(i => i.json.name));
  const t1 = { url: 'https://d.pt/x', title: 'd', text: 'Upscore is an app that compares mortgage offers for you. Banco CTT is a bank that sells mortgage loans to families.' };
  const tr = await run('rank.js', { outs: { Queries: J([q0, q0, q0]), Pages: J([t1]) }, input: J([{ output: { companies: [C('Upscore', 'yes', 'Upscore is an app that compares mortgage offers for you', { type: 'Substitute' }), C('Banco CTT', 'yes', 'Banco CTT is a bank that sells mortgage loans to families')] } }]) });
  ok('rank: when nothing else separates two names, the direct competitor goes first', tr.map(i => i.json.name).join() === 'Banco CTT,Upscore', tr.map(i => i.json.name));
  ok('site: an app address gives the home page', (await pick('Upscore', ['https://unrelated.com/'], { site: 'https://v2.app.upscoreapp.com/login' })) === 'https://upscoreapp.com/', await pick('Upscore', ['https://unrelated.com/'], { site: 'https://v2.app.upscoreapp.com/login' }));
  ok('site: any distinctive word of the name can be the address', (await pick('Associação Mutualista Montepio', ['https://www.montepio.org/'])) === 'https://www.montepio.org/', await pick('Associação Mutualista Montepio', ['https://www.montepio.org/']));
  ok('site: a name with an apostrophe and a trade word', (await pick("Barbearia Figaro's", ['https://www.figaroslisboa.pt/'])) === 'https://www.figaroslisboa.pt/' && (await pick('Barbearia Oliveira', ['https://www.barbeariacampos.pt/'])) === '', [await pick("Barbearia Figaro's", ['https://www.figaroslisboa.pt/']), await pick('Barbearia Oliveira', ['https://www.barbeariacampos.pt/'])]);
  ok('site: a word added to the name in the address', (await pick('Remi', ['https://www.amazon.com/x', 'https://shopremi.com/products/x'])) === 'https://shopremi.com/' && (await pick('Remi', ['https://www.remington.com/'])) === '', [await pick('Remi', ['https://shopremi.com/products/x']), await pick('Remi', ['https://www.remington.com/'])]);
  ok('site: two letters added to a short name prove nothing', (await pick('Cred', ['https://www.credit.com/'])) === '' && (await pick('Zima Dental', ['https://zimadentalnl.com/'], { own: 'x.com' })) === 'https://zimadentalnl.com/', [await pick('Cred', ['https://www.credit.com/'])]);
  const fits = [['Creditas', 'https://www.credit.com/', ''], ['Prove', 'https://www.improve.com/', ''], ['Slack AI', 'https://slack.com/', 'https://slack.com/'], ['Microsoft Outlook', 'https://www.microsoft.com/en/outlook', 'https://www.microsoft.com/'], ['Ventyx Biosciences', 'https://ventyxbio.com/', 'https://ventyxbio.com/'], ['Lindy AI', 'https://www.lindy.ai/', 'https://www.lindy.ai/'], ['Sonic Dental', 'https://nl.sonicdental.co/products', 'https://nl.sonicdental.co/'], ['Veterans United Home Loans', 'https://www.veterans.com/', 'https://www.veterans.com/'], ['Eli Lilly', 'https://www.lilly.com/', 'https://www.lilly.com/'], ['Banco Santander Portugal', 'https://www.santander.pt/', 'https://www.santander.pt/']];
  for (const [n, u, want] of fits) { const got = await pick(n, [u], { own: 'x.com' }); ok('site of ' + n + ' from ' + u, got === want, got); }
  ok('site: with no country, the .com site goes before a national one; with a country, the national one', (await pick('Pfizer', ['https://www.pfizer.at/', 'https://www.pfizer.com/'], { own: 'x.com' })) === 'https://www.pfizer.com/' && (await pick('Pfizer', ['https://www.pfizer.com/', 'https://www.pfizer.pt/'], { own: 'x.com', home: 'Portugal' })) === 'https://www.pfizer.pt/', [await pick('Pfizer', ['https://www.pfizer.at/', 'https://www.pfizer.com/'], { own: 'x.com' })]);
  o2['Site pages'] = J([{ rank: 1, name: 'Santander Totta', site_url: 'https://www.santandertotta.pt/', landed_on: 'https://www.santander.at/', text: 'Somos o banco de confiança dos portugueses há muitos anos' }, { rank: 3, name: 'Novo Banco', site_url: 'https://www.novobanco.pt/', landed_on: 'https://www.novobanco.pt/particulares', text: 'Somos o banco de confiança dos portugueses há muitos anos' }]);
  b4 = (await run('build.js', { outs: o2, input: J([LC({ hq_country: 'Austria', page_company: 'a' }), LC({ hq_country: 'Portugal', page_company: 'b' })]) })).map(i => i.json);
  ok('build: the country of a page that answered from another address is not used', b4.find(r => r.entry_id === 'B2-K1').statement.indexOf('based in') === -1 && b4.find(r => /^Novo Banco/.test(r.statement)).statement.indexOf('based in Portugal') !== -1, b4.filter(r => /^B2-K\d$/.test(r.entry_id)).map(r => r.statement));
  // ---- With a country known, only companies that something read shows sell there ----
  const nl = { ...q0, company: 'Zima Dental', own_host: 'zimadental.nl', home_country: 'Netherlands', home_code: 'NL', claims: [], claims_text: 'none listed' };
  const cand = (rank, name, site, sells) => ({ name, rank, type: 'Direct', hq: '', measure: 'none', value: 0, unit: '', as_of: '', quote: 'q', source_url: 'https://a.com/x', source_title: 't', mentions: 1, markets: [], sells, site_url: site, site_found: 's', site_fit: 100, aliases: [] });
  const seven = [cand(1, 'Oral-B', 'https://www.oralb.nl/', 'unknown'), cand(2, 'Sonic Dental', 'https://nl.sonicdental.co/', 'unknown'), cand(3, 'Voraiya', 'https://voraiya.com/', 'unknown'), cand(4, 'Ueofen', 'https://www.ueofen.com/', 'unknown'), cand(5, 'Remi', 'https://shopremi.com/', 'unknown'), cand(6, 'Pursonic', 'https://pursonicusa.com/', 'unknown'), cand(7, 'Philips', 'https://www.philips.com/', 'yes')];
  seven[0]._sites = { left_out: [], merged: [], empty_searches: 0 };
  const o3 = { Start: outs.Start, Queries: J([nl]), Rank: J([{ candidates: 7, quotes_dropped: 0, also_named: [], not_selling: [] }]), 'Site sources': J(seven) };
  o3['Site pages'] = J(seven.filter(c => c.name !== 'Pursonic' && c.name !== 'Philips').map(c => ({ rank: c.rank, name: c.name, site_url: c.site_url, landed_on: c.site_url, text: 'Somos o banco de confiança dos portugueses há muitos anos' })));
  const says = { 'Oral-B': 'unknown', 'Sonic Dental': 'yes', Voraiya: 'yes', Ueofen: 'unknown', Remi: 'no' };
  let b5 = (await run('build.js', { outs: o3, input: J(o3['Site pages'].map(i => LC({ page_company: i.json.name, sells_there: says[i.json.name] }))) })).map(i => i.json);
  const s5 = b5[0]._summary;
  ok('country: kept only with proof, in rank order', s5.competitors.map(c => c.name).join() === 'Oral-B,Sonic Dental,Voraiya,Philips' && s5.competitors.map(c => c.sells_in_country).join('|') === 'its own site is a site of that country|its own site is a site of that country|its home page shows it|a page that names it says so', s5.competitors.map(c => [c.name, c.sells_in_country]));
  const why5 = Object.fromEntries(s5.left_out.map(x => [x.name, x.why]));
  ok('country: left out with the reason', why5.Ueofen === 'nothing read shows it sells in Netherlands' && why5.Remi === 'its home page shows it does not sell in Netherlands' && why5.Pursonic === 'nothing read shows it sells in Netherlands', why5);
  ok('country: the proof is in the entry, the count says four of five', /Sells in Netherlands: its own site is a site of that country\.$/.test(b5.find(r => r.entry_id === 'B2-K1').check_note) && /Site not loaded: https:\/\/www\.philips\.com\/\. Sells in Netherlands: a page that names it says so\.$/.test(b5.find(r => r.entry_id === 'B2-K4').check_note) && b5.find(r => r.entry_id === 'B2-COUNT').statement === '4 of 5 found.', [b5.find(r => r.entry_id === 'B2-K1').check_note, b5.find(r => r.entry_id === 'B2-K4').check_note]);
  o3.Queries = J([{ ...nl, home_country: '', home_code: 'ALL' }]);
  b5 = (await run('build.js', { outs: o3, input: J(o3['Site pages'].map(i => LC({ page_company: i.json.name, sells_there: 'unknown' }))) })).map(i => i.json);
  ok('no country: nobody is left out for where it sells, no proof line', b5[0]._summary.competitors.length === 5 && b5[0]._summary.left_out.length === 0 && b5.find(r => r.entry_id === 'B2-K1').check_note.indexOf('Sells in') === -1, b5[0]._summary.competitors.map(c => c.name));
  const sp5 = await run('site_pages.js', { outs: { Queries: J([nl]), 'Site sources': J(seven.slice(0, 1)) }, input: J([{ data: { markdown: ('Somos o banco de confiança dos portugueses há muitos anos ').repeat(20), metadata: {} } }]) });
  ok('home pages: the client country goes to the check', sp5[0].json.home_country === 'Netherlands', sp5[0].json);
  console.log(pass + ' passed, ' + fail + ' failed (chain)');
  process.exit(fail ? 1 : 0);
})();
