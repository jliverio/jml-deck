// Offline test of "Rule 3: figure in the quote" (JML research: 5 Code checks, kUZvSlrkzDpndm73), on real entries of 23 Nov.
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/rule3_figure_in_quote.js', 'utf8');
const run = (entries) => { const j = { entries, fails: [], notes: [] }; return new Function('$input', code)({ first: () => ({ json: j }) })[0].json; };
const cases = [
  // must pass: the figure is in the quote, written with a Portuguese scale word or in full
  ['pass', 'Tesla (Galp re-run)', 'B2-K1', 81462000000, 'revenue', 'As receitas anuais da empresa atingiram 81,462 mil milhões de dólares em 2022'],
  ['pass', 'ChargePoint (Galp re-run)', 'B2-K3', 153000000, 'revenue', 'A sua influência reflecte-se nos seus impressionantes 153 milhões de dólares em Q1 2023'],
  ['pass', 'Caixa Geral de Depósitos (Millennium bcp)', 'B2-K1', 3500000, 'customers', 'fundada em 1876 e detida exclusivamente pelo Estado português, a CGD tem atualmente mais de 3,5 milhões de clientes ativos'],
  ['pass', 'EDP (written in full)', 'B2-K4', 175000, 'customers', 'With more than **175,000 active EDP Charge cards** and an expanding presence'],
  ['pass', 'Iberdrola price (decimal comma)', 'B2-K5-P', 24.39, '', 'Painéis Solares 24,39€ x 36 meses'],
  ['pass', 'English scale word, as before', 'B2-K2', 1200000000, 'revenue', 'Revenue reached $1.2 billion last year'],
  ['pass', 'Spanish scale word', 'B2-K2', 54900000000, 'revenue', 'unos ingresos de 54.900 millones de euros'],
  ['pass', 'Portuguese "mil" (thousand)', 'B2-K2', 2000, 'customers', 'mais de 2 mil clientes empresariais'],
  ['pass', 'free offer at 0, as before', 'A4-O1', 0, '', 'Plano grátis para sempre'],
  // must fail: the figure is not in the quote (real failures of 23 Nov, and planted ones)
  ['fail', 'Shell (Galp step 7, rocketreach)', 'B2-K1', 302000000000, 'revenue', 'around 33 million customers daily at our Shell-branded retail service stations.'],
  ['fail', 'Chevron (Galp step 7)', 'B2-K2', 197000000000, 'revenue', "View Galp's top competitors like Chevron, ConocoPhillips, and Eni."],
  ['fail', 'Equal Food box price', 'A4-O1', 13.5, '', 'Produtos locais, sazonais e com entrega gratuita à tua porta, mais barato do que nos supermercados.'],
  ['fail', 'Equal Food basket price', 'A4-O5', 21.5, '', 'Free shipping on all subscriptions'],
  ['fail', 'Horta à Porta price', 'B2-K3-P', 15, '', '4 a 5 variedades de legumes'],
  ['fail', 'planted: price raised by 1', 'A4-O2', 25.39, '', 'Painéis Solares 24,39€ x 36 meses'],
  ['fail', 'planted: 9999', 'A4-O3', 9999, '', 'Plano Mais Casa a partir de 40€'],
  ['fail', '"mil" inside a word is no scale word', 'B2-K2', 3500000, 'customers', 'apoio à família: 3,5 por cento das famílias'],
  ['fail', '"milhas" (miles) is no scale word', 'B2-K2', 1500000, 'customers', 'ganhe 1,5 milhas por cada euro'],
];
let n = 0;
for (const [want, name, entry_id, value, measurement_base, quote] of cases) {
  const out = run([{ id: 1, entry_id, value, measurement_base, quote }]);
  const got = out.fails.length ? 'fail' : 'pass';
  if (got !== want) throw new Error(name + ': expected ' + want + ', got ' + got);
  n += 1;
}
console.log('Rule 3: ' + n + ' checks passed');
