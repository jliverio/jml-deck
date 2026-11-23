
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/position_prepare.js', 'utf8');
const mk = (focus) => {
  const nodes = { 'Log start': { run_id: 'r1', stage: 'position_product' }, 'Start': { run_id: 'r1', product_in_focus: focus } };
  const $ = (n) => ({ first: () => ({ json: nodes[n] }) });
  const rows = [{ json: { run_id: 'r1', question: 'A3', quote: 'Crédito para empresas', url: 'https://x.pt/empresas', position: 1 } }];
  const $input = { all: () => rows };
  return new Function('$', '$input', code)($, $input)[0].json;
};
let a = mk('Bank credit for small businesses in Portugal');
if (a.focus_line !== 'Product in focus named in the request: Bank credit for small businesses in Portugal') throw new Error(a.focus_line);
let b = mk('');
if (b.focus_line !== 'The request names no product in focus.') throw new Error(b.focus_line);
console.log('Prepare: 2 checks passed');
