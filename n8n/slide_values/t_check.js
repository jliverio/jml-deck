const { run } = require('./harness');
const fs = require('fs');
let pass = 0, total = 0;
const ok = (name, cond, detail) => { total += 1; if (cond) pass += 1; else console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600)); };
const good = () => ({
  profile_title: { text: 'Equal Food sells subscription baskets of imperfect fruit and vegetables in Portugal', cites: ['A1-L4', 'A4-M1'] },
  layers: [
    { layer: 1, text: 'regional farmers and small Portuguese producers (produce); Aquela Kombucha, Oatly, Why Not and Flor do Alentejo (add-ons)', cites: ['A1-L1'] },
    { layer: 4, text: 'Sells subscription and one-off delivery of fruit and vegetable baskets to homes and offices.', cites: ['A1-L4'] },
  ],
  focus_product: '',
  products: [
    { entry: 'A3-P1', text: 'Basket of about 12 to 13 kg with over 18 varieties of imperfect fruit and vegetables.', price: '€27.78 a box', price_entry: 'A4-O3' },
    { entry: 'A3-P2', text: 'Basket of 8 to 9 kg of fruit and vegetables for 1 to 2 people.', price: '€19.44 a box', price_entry: 'A4-O2' },
    { entry: 'A3-P3', text: 'Vegetables-only basket of 9 to 10 kg.', price: '€23.33 a box', price_entry: 'A4-O4' },
    { entry: 'A3-P4', text: 'Fruit-only basket of 8.5 to 9.5 kg.', price: '', price_entry: '' },
    { entry: 'A3-P5', text: 'Small basket with four weekly deliveries.', price: '', price_entry: '' },
    { entry: 'A3-P6', text: 'Office fruit basket of 40 pieces.', price: '€14.95 a week', price_entry: 'A3-P6' },
    { entry: 'A3-P7', text: 'Extras sold separately, such as eggs, olive oil, kombucha, sodas and plant drinks.', price: '', price_entry: '' },
    { entry: 'A3-P8', text: 'Sourdough bread add-on that only subscribers can order.', price: '', price_entry: '' },
  ],
  markets: { text: '**Portugal** · Lisboa, Porto, Setúbal, Leiria, Coimbra, Santarém and Braga', cites: ['A4-M1'] },
  regulatory: { text: '', cites: [] },
  client_points: [
    { entry: 'B1-C1', text: '**Price:** up to **40%** cheaper than the supermarket' },
    { entry: 'B1-C2', text: '**Quality:** the same produce as the supermarket, only imperfect in look.' },
    { entry: 'B1-C3', text: '**Reach:** more than **10,000** families have tried the basket' },
  ],
  competitors: [
    { entry: 'B2-K1', name: 'Imperfect Foods', same_business: true, why: '', points: [
      { entry: 'B2-K1-A1', text: '**Savings:** cuts the grocery bill and food waste together' },
      { entry: 'B2-K1-A2', text: '**Price:** exclusive savings on groceries saved from waste' },
      { entry: 'B2-K1-A3', text: '**Guarantee:** makes things right if a delivery falls short' } ] },
    { entry: 'B2-K2', same_business: true, why: '', points: [
      { entry: 'B2-K2-A1', text: '**Taste:** groceries sourced for flavor, not appearance' },
      { entry: 'B2-K2-A2', text: '**Quality:** better taste, quality and impact in each box' },
      { entry: 'B2-K2-A3', text: '**Flexibility:** a grocery subscription with no commitment' } ] },
    { entry: 'B2-K3', same_business: true, why: '', points: [] },
    { entry: 'B2-K4', same_business: false, why: 'Its claims are about identity verification, not food delivery.', points: [
      { entry: 'B2-K4-A1', text: '**Trust:** identity as a lasting foundation of trust' },
      { entry: 'B2-K4-A2', text: '**Speed:** onboards users up to **79%** faster' },
      { entry: 'B2-K4-A3', text: '**Journey:** trust across the whole customer journey' } ] },
    { entry: 'B2-K5', same_business: true, why: '', points: [] },
  ],
  compare_title: { text: 'Only Imperfect Foods also claims supermarket-grade produce; none claims a 40% saving', cites: [] },
});
(async () => {
  const F = JSON.parse(fs.readFileSync(__dirname + '/build_EqualFood.json', 'utf8'));
  const base = { 'Build the request': [{ json: F }] };
  // A. a clean answer
  let outs = Object.assign({}, base, { 'Write the values': [{ json: { output: good() } }] });
  let c = (await run('check.js', { outs, input: [] }))[0].json;
  const v = c.values;
  console.log(JSON.stringify(c.problems));
  ok('A round 0', c.round === 0);
  ok('A Prove is dropped, Bio em Casa moves up', c.shown.map(s => s.name).join('|') === 'Imperfect Foods|Misfits Market|FarmBox Direct|Bio em Casa', c.shown);
  ok('A the note says why Prove is out', c.notes.length === 1 && /Prove is left out/.test(c.notes[0]) && /identity/.test(c.notes[0]), c.notes);
  ok('A the only problem is the comparison title (competitors changed, and 40 is not a count)', c.problems.length >= 1 && c.problems.every(p => p.slot === 'compare_title'), c.problems);
  ok('A layer 1 is the grey Buys from line', v.value_layer_01.indexOf('__Buys from: regional farmers') === 0 && v.value_layer_01.endsWith('__'), v.value_layer_01);
  ok('A layers 2 and 3 are empty', v.value_layer_02 === '' && v.value_layer_03 === '');
  ok('A layer 4 has the status in bold on its own line', v.value_layer_04.indexOf('**Sells**\nSubscription') === 0, v.value_layer_04);
  ok('A eight products: five, then the multi-product box', v.product_05_name === 'Cabaz Individual - 4 entregas semanais' && v.product_06_name === 'Multi-product company' && v.product_06_text === 'Cabaz Fruits Escritório · Add-on products · Micro-bakery bread', [v.product_05_name, v.product_06_text]);
  ok('A price in bold on its own line', v.product_01_text.endsWith('\n**€27.78 a box**'), v.product_01_text);
  ok('A product without price has no price line', v.product_04_text === 'Fruit-only basket of 8.5 to 9.5 kg.', v.product_04_text);
  ok('A details', v.details_01.indexOf('**Portugal** · Lisboa') === 0 && v.details_02 === 'Offer type: **B2C and B2B** · Pricing: **subscription**', [v.details_01, v.details_02]);
  ok('A client points without final period', v.client_point_02 === '**Quality:** the same produce as the supermarket, only imperfect in look' && v.client_point_04 === '' && v.client_name_01 === 'Equal Food', v.client_point_02);
  ok('A competitor columns', v.competitor_01_name === 'Imperfect Foods' && v.competitor_01_fact_01 === 'United States' && v.competitor_03_name === 'FarmBox Direct' && v.competitor_03_point_01 === '' && v.competitor_04_name === 'Bio em Casa' && v.competitor_04_fact_01 === 'Portugal', v);
  ok('A source lines', v.sources_profile_01 === '[1] Equal Food, company website, ' + F.year && v.sources_compare_01.indexOf('[1] Equal Food; [2] Imperfect Foods; [3] Misfits Market; [4] FarmBox Direct; [5] Bio em Casa; company websites, ') === 0, v.sources_compare_01);
  ok('A 49 variables', Object.keys(v).length === 49, Object.keys(v).length);
  ok('A fit body carries the values and the template', c.fit_body.template === '1.5.4' && c.fit_body.values.profile_title_01 === v.profile_title_01);
  ok('A strict values fall back on a plain comparison title', c.values_strict.compare_title_01 === 'Equal Food’s claims next to those of its competitors', c.values_strict.compare_title_01);

  // B. deliberate faults
  const bad = good();
  bad.layers[0].text = 'regional farmers (produce); Oatly, Why Not and Nestlé (add-ons)';
  bad.products[1].price = '€18.44 a box';
  bad.products[3].price = '€21.50 a box'; bad.products[3].price_entry = 'A4-O4';
  bad.products[4].text = 'Small basket with 6 weekly deliveries.';
  bad.client_points[0].text = 'Up to 40% cheaper than the supermarket';
  bad.client_points[2].text = '**Reach:** you should try the basket more than **10,000** families chose';
  bad.markets.text = '**Portugal** · Lisboa, Porto and Faro';
  bad.profile_title.text = 'A subscription for baskets of imperfect fruit and vegetables in Portugal that is longer than ninety characters';
  bad.competitors[0].points[0].text = '**Savings:** cuts the grocery bill by **30%**';
  outs = Object.assign({}, base, { 'Write the values': [{ json: { output: bad } }] });
  c = (await run('check.js', { outs, input: [] }))[0].json;
  const P = (slot) => c.problems.filter(p => p.slot === slot).map(p => p.problem).join(' | ');
  ok('B invented supplier caught', /Nestl/.test(P('layer_1')), P('layer_1'));
  ok('B wrong price figure caught', /1844/.test(P('price:A3-P2')), P('price:A3-P2'));
  ok('B price of another product caught (figure not in the entry)', /2150|does not name/.test(P('price:A3-P4')), P('price:A3-P4'));
  ok('B invented figure in a product text caught', /figure 6/.test(P('product:A3-P5')), P('product:A3-P5'));
  ok('B point without a label caught', /Format/.test(P('client:B1-C1')), P('client:B1-C1'));
  ok('B advice word caught', /advises/.test(P('client:B1-C3')), P('client:B1-C3'));
  ok('B place not in the entries caught', /Faro/.test(P('markets')) && !/Lisboa|Porto\b/.test(P('markets')), P('markets'));
  ok('B title: too long and does not start with the name', /aim for 90 or fewer\. Cut at least/.test(P('profile_title')) && /must start with/.test(P('profile_title')), P('profile_title'));
  ok('B invented figure in a competitor point caught', /30/.test(P('comp:B2-K1-A1')), P('comp:B2-K1-A1'));
  const s = c.values_strict;
  ok('B strict: failed texts are out, code values stay', s.value_layer_01 === '' && s.product_02_text === 'Basket of 8 to 9 kg of fruit and vegetables for 1 to 2 people.' && s.client_point_01 === '' && s.competitor_01_point_01 === '' && s.product_02_name === 'Cabaz Essencial' && s.profile_title_01 === 'What Equal Food sells and where it sells it', s);
  ok('B strict: markets fall back on the countries of the entries', s.details_01 === '**Portugal**', s.details_01);

  // C. the decision and the rewrite
  outs['Check the values'] = [{ json: c }];
  const fit = { fits: false, boxes: [{ box: 'client_points', kind: 'points', variables: ['client_point_01', 'client_point_02', 'client_point_03', 'client_point_04', 'client_point_05'], lines: 15, room_lines: 13, over: true, over_by_lines: 2 }, { box: 'profile_title_01', kind: 'title', variables: ['profile_title_01'], lines: 3, room_lines: 2, over: true, over_by_lines: 1 }, { box: 'details', kind: 'text', variables: ['details_01', 'details_02'], lines: 2, room_lines: 3, over: false, over_by_lines: 0 }], over: [], warnings: [] };
  let d = (await run('decide.js', { outs, input: [{ json: fit }] }))[0].json;
  ok('C a rewrite is asked', d.again === true && d.fit_checked === true && d.asked.includes('client:B1-C2') && d.asked.includes('layer_1') && d.asked.includes('compare_title'), d.asked);
  ok('C the request names the box and its lines', /SLOT client:B1-C2[\s\S]*2 lines too long/.test(d.prompt) && /SLOT compare_title[\s\S]*Table:\nClaim 1 \[B1-C1\][\s\S]*Also made by: none\. Not made by: Imperfect Foods, Misfits Market\.[\s\S]*No claims were captured for FarmBox Direct, Bio em Casa/.test(d.prompt) && /SLOT price:A3-P2[\s\S]*\[A4-O2\]/.test(d.prompt), d.prompt.slice(0, 400));
  ok('C no braces in the request (the chain reads them as variables)', !/[{}]/.test(d.prompt));
  ok('C the title rewrite sees the points on the slide', /Points on the slide:\nImperfect Foods: \*\*Savings:\*\*[^\n]*\nMisfits Market: /.test(d.prompt) && /leave that claim out/.test(d.prompt), d.prompt.slice(-700));
  fs.writeFileSync(__dirname + '/rewrite_prompt_example.txt', d.prompt);
  outs.Decide = [{ json: d }];
  outs['Rewrite what failed'] = [{ json: { output: { fixes: [
    { slot: 'layer_1', text: 'regional farmers (produce); Oatly, Why Not and Flor do Alentejo (add-ons)', cites: ['A1-L1'] },
    { slot: 'price:A3-P2', text: '€19.44 a box', cites: ['A4-O2'] },
    { slot: 'price:A3-P4', text: '', cites: [] },
    { slot: 'product:A3-P5', text: 'Small basket with four weekly deliveries.', cites: [] },
    { slot: 'client:B1-C1', text: '**Price:** up to **40%** cheaper', cites: [] },
    { slot: 'client:B1-C3', text: '**Reach:** **10,000+** families tried it', cites: [] },
    { slot: 'markets', text: '**Portugal** · Lisboa, Porto and five more cities', cites: ['A4-M1'] },
    { slot: 'profile_title', text: 'Equal Food sells baskets of imperfect fruit and vegetables by subscription', cites: ['A1-L4'] },
    { slot: 'comp:B2-K1-A1', text: '**Savings:** cuts the grocery bill and food waste', cites: [] },
    { slot: 'compare_title', text: 'Imperfect Foods also claims supermarket-grade produce; neither claims the price saving', cites: [] },
    { slot: 'nonsense', text: 'x', cites: [] } ] } } }];
  c = (await run('check.js', { outs, input: [] }))[0].json;
  ok('C round 1 took ten fixes', c.round === 1 && c.fixed === 10, [c.round, c.fixed]);
  ok('C after the rewrite nothing fails', c.problems.length === 0, c.problems);
  ok('C fixed values are in', c.values.product_02_text.endsWith('**€19.44 a box**') && c.values.product_04_text === 'Fruit-only basket of 8.5 to 9.5 kg.' && c.values.client_point_03 === '**Reach:** **10,000+** families tried it' && c.values.compare_title_01.indexOf('Imperfect Foods also') === 0, c.values);
  outs['Check the values'].push({ json: c });
  d = (await run('decide.js', { outs, input: [{ json: { error: { message: 'timeout of 120000ms exceeded' } } }] }))[0].json;
  ok('C no second rewrite; a failed fit call is reported', d.again === false && d.fit_checked === false && /timeout/.test(d.fit_error), d);
  outs.Decide.push({ json: d });
  const f = (await run('final.js', { outs, input: [{ json: d }] }))[0].json;
  ok('C final: values, rows and notes', f.variables === 49 && f.rows.length === 49 && f.rows.find(r => r.variable === 'client_point_01').slot === 'client:B1-C1' && f.rows.find(r => r.variable === 'client_point_01').entry_ids === 'B1-C1' && f.notes.some(n => /fit check could not be run/.test(n)) && f.notes.some(n => /Prove/.test(n)), f.notes);
  ok('C final: nothing thin for Equal Food', f.thin.length === 0 && f.slides.profile && f.slides.compare, f.thin);
  // D. no competitor, and E. nothing found at all
  const rows = JSON.parse(fs.readFileSync(__dirname + '/ef_rows_1.json', 'utf8'));
  const startOut = { Start: [{ json: { run_id: rows[0].run_id, company: 'Equal Food, Lda.', website: 'https://www.equalfood.co' } }] };
  let b = (await run('build.js', { outs: startOut, input: rows.filter(r => r.branch !== 'competitors').map(r => ({ json: r })) }))[0].json;
  ok('D legal suffix removed from the name', b.company === 'Equal Food', b.company);
  ok('D part 8 asks for nothing', /PART 8\. compare_title\nNothing to compare: leave the text empty\./.test(b.prompt));
  const g = good(); g.competitors = []; g.compare_title = { text: '', cites: [] };
  c = (await run('check.js', { outs: { 'Build the request': [{ json: b }], 'Write the values': [{ json: { output: g } }] }, input: [] }))[0].json;
  ok('D the comparison slide stays, with a title written by code', c.compare === true && c.values.compare_title_01 === 'Equal Food makes 3 claims; the research found no competitor to compare them with' && c.values.competitor_01_name === '' && c.values.client_point_01 !== '' && c.values.sources_compare_01 === '[1] Equal Food; company website, ' + b.year, [c.values.compare_title_01, c.values.sources_compare_01]);
  ok('D nothing to rewrite', c.problems.length === 0, c.problems);
  let d2 = (await run('decide.js', { outs: { 'Build the request': [{ json: b }], 'Check the values': [{ json: c }] }, input: [{ json: { fits: true, boxes: [], over: [] } }] }))[0].json;
  let f2 = (await run('final.js', { outs: { 'Build the request': [{ json: b }], 'Check the values': [{ json: c }], Decide: [{ json: d2 }] }, input: [] }))[0].json;
  ok('D the email is told no competitor was found', d2.again === false && f2.thin.join() === 'no competitor was found', f2.thin);
  b = (await run('build.js', { outs: startOut, input: rows.filter(r => r.status === 'failed').map(r => ({ json: r })) }))[0].json;
  ok('E only failed entries: nothing to write', b._none === true, b);
  b = (await run('build.js', { outs: startOut, input: rows.filter(r => /^(B1-C\d+|A3-P[12])$/.test(r.entry_id)).map(r => ({ json: r })) }))[0].json;
  const g2 = good(); g2.layers = []; g2.competitors = []; g2.markets = { text: '', cites: [] }; g2.profile_title = { text: '', cites: [] }; g2.compare_title = { text: '', cites: [] };
  c = (await run('check.js', { outs: { 'Build the request': [{ json: b }], 'Write the values': [{ json: { output: g2 } }] }, input: [] }))[0].json;
  ok('E thin: two products, no market, no offer type', c.values.product_02_name === 'Cabaz Essencial' && c.values.product_03_name === '' && c.values.details_01 === '__Markets: not public.__' && c.values.details_02 === 'Offer type: __not public__ · Pricing: __not public__' && c.values.profile_title_01 === 'What Equal Food sells and where it sells it' && c.values.value_layer_04 === '', c.values);
  ok('E a price whose offer entry is gone is refused', c.problems.some(p => p.slot === 'price:A3-P1'), c.problems);
  // F. the writer gave no answer
  const F2 = JSON.parse(fs.readFileSync(__dirname + '/build_EqualFood.json', 'utf8'));
  c = (await run('check.js', { outs: { 'Build the request': [{ json: F2 }], 'Write the values': [{ json: { error: { message: 'overloaded' } } }] }, input: [] }))[0].json;
  ok('F no answer: code values only, both slides stay', c.writer_failed === true && c.values.product_01_name === 'Cabaz Clássico' && c.values.product_01_text === '' && c.values.value_layer_04 === '**Sells**' && c.values.competitor_04_name === 'Prove' && c.values.details_02.indexOf('Offer type: **B2C and B2B**') === 0, c.values);
  // G. the comparison title: counts, names and competitors with no claims
  const g3 = good(); g3.compare_title = { text: 'All five competitors claim the price saving, as FarmBox Direct does', cites: [] };
  c = (await run('check.js', { outs: { 'Build the request': [{ json: F2 }], 'Write the values': [{ json: { output: g3 } }] }, input: [] }))[0].json;
  const pc = c.problems.filter(p => p.slot === 'compare_title').map(p => p.problem).join(' | ');
  ok('G a wrong count and a competitor with no claims are caught', /count the table does not give \(five\)/.test(pc) && /FarmBox Direct, for which no claims were captured/.test(pc), pc);
  ok('G final has the logo sites of the client and of the competitors whose home page was read', JSON.stringify(f.logo_sites) === JSON.stringify({ client: 'https://www.equalfood.co', competitor_01: 'https://' + F.competitors[0].home, competitor_02: 'https://' + F.competitors[1].home }), f.logo_sites);
  const sm = (await run('summary.js', { outs: Object.assign({}, outs, { Start: [{ json: { run_id: F.run_id, started_at: new Date().toISOString() } }], 'Final values': [{ json: f }], 'Fetch logos': [{ json: { logos: { client: 'AAAA' }, notes: { competitor_01: 'no logo found' } } }] }), input: [] }))[0].json;
  ok('G summary carries the logos when the logo step ran', sm.logos.client === 'AAAA' && sm.logos_found.join() === 'client' && sm.logo_notes.competitor_01 === 'no logo found' && Object.keys(sm.values).length === 49, sm.logos_found);
  const sm2 = (await run('summary.js', { outs: Object.assign({}, outs, { Start: [{ json: { run_id: F.run_id, started_at: new Date().toISOString() } }], 'Final values': [{ json: f }] }), input: [] }))[0].json;
  ok('G summary without the logo step: no logos, no error', Object.keys(sm2.logos).length === 0 && sm2.outcome === 'partial', sm2.outcome);
  // H. length is a target: a little over is kept, far over is left out; competitor names lose their product words
  const g4 = good();
  g4.client_points[1].text = '**Quality:** the very same fruit and vegetables as the supermarket sells, only a little imperfect to look at';
  g4.competitors[0].points[0].text = '**Savings:** ' + 'cuts the grocery bill and the food waste at the same time for every household that orders a box each week';
  g4.competitors[0].name = 'Imperfect';
  g4.competitors[1].name = 'Misfits Market Inc of Delaware';
  g4.compare_title = { text: 'Imperfect Foods also claims supermarket-grade produce; Misfits Market does not', cites: [] };
  c = (await run('check.js', { outs: { 'Build the request': [{ json: F2 }], 'Write the values': [{ json: { output: g4 } }] }, input: [] }))[0].json;
  ok('H a point a few characters over is asked to shorten but kept', c.problems.some(p => p.slot === 'client:B1-C2' && /Cut at least/.test(p.problem)) && !c.bad.includes('client:B1-C2') && c.values_strict.client_point_02.indexOf('**Quality:** the very same') === 0, c.problems);
  ok('H a point far over is left out', c.bad.includes('comp:B2-K1-A1') && c.values_strict.competitor_01_point_01 === '', c.bad);
  ok('H competitor name without product words, only when made of the entry\'s words', c.values.competitor_01_name === 'Imperfect' && c.values.competitor_02_name === 'Misfits Market' && c.values.sources_compare_01.indexOf('[2] Imperfect; [3] Misfits Market') > 0, [c.values.competitor_01_name, c.values.competitor_02_name, c.values.sources_compare_01]);
  ok('H the title prints the short name too', c.slots.compare_title.text.indexOf('Imperfect also claims') === 0, c.slots.compare_title.text);
  ok('H slides are true or false', c.profile === true && c.compare === true);
  console.log(pass + '/' + total + ' passed');
})().catch(e => { console.error(e); process.exit(1); });
