// Offline check of the two colour rules prepared for the proposal flow (plan step 5). Run: node n8n/colours/t_colours.js
const fs = require('fs'); const assert = require('assert');
const run = (file, json) => new Function('$input', fs.readFileSync(__dirname + '/' + file, 'utf8'))({ first: () => ({ json }) })[0].json;
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
// the colour reading
let r = run('colour_result.js', { primary: '#e60000', confidence: 'high', apply: true, note: 'buttons and links' });
ok(r.brand && r.brand.primary === 'E60000' && r.colour_applied === true && r.colour_note === '' && r.colour_confidence === 'high');
r = run('colour_result.js', { primary: '635BFF', confidence: 'medium', apply: false, note: 'too little evidence' });
ok(r.brand === null && r.colour_applied === false && r.colour_note.includes('HEX code') && r.colour_confidence === 'medium', JSON.stringify(r));
r = run('colour_result.js', { primary: null, confidence: 'none', apply: false });
ok(r.brand === null && r.colour_note.includes('#E60000'));
r = run('colour_result.js', { error: { message: 'The site refused the request (403)' } });
ok(r.brand === null && r.colour_confidence === 'not read' && r.colour_detail.includes('403') && r.colour_note.length > 0);
r = run('colour_result.js', { primary: 'E60000', confidence: 'high', apply: 'true' });
ok(r.brand === null, 'apply must be the boolean the renderer sends');
r = run('colour_result.js', { primary: 'red', confidence: 'high', apply: true });
ok(r.brand === null, 'a colour that is not six HEX digits is never handed on');
r = run('colour_result.js', {});
ok(r.brand === null && r.colour_confidence === 'none');
// the reply with a HEX code
const hex = (text) => run('hex_reply.js', { text });
ok(hex('#E60000').hex === 'E60000'); ok(hex('Use #e60000 please').hex === 'E60000'); ok(hex('The colour is #E60.').hex === 'EE6600');
ok(hex('E60000').hex === 'E60000'); ok(hex('  0058a3.  ').hex === '0058A3');
ok(hex('Hex: 0058A3').hex === '0058A3'); ok(hex('A cor do cliente é 00843D').hex === '00843D');
ok(hex('Thanks, the deck is fine.').hex === '' && hex('Thanks').codes_found === 0);
ok(hex('Order 123456 was shipped, call 918273 today').hex === '', 'six digits in ordinary text are not a colour');
ok(hex('The deadline moved to week 12, budget 250000').hex === '');
ok(hex('face it, we decide in March').hex === '' && hex('Please add the decade view').hex === '', 'words made of HEX letters are not codes');
ok(hex('Thanks!\n\nOn Mon, 23 Nov 2026, JML wrote:\n> Reply with the colour as a HEX code (for example #E60000)').hex === '', 'our own example in the quoted email is not the answer');
ok(hex('#0058A3\n> for example #E60000').hex === '0058A3');
ok(hex('Obrigado, #00843D\nEm seg, 23 nov 2026, JML escreveu:\n#E60000').hex === '00843D');
let two = hex('Either #E60000 or #0058A3');
ok(two.hex === '' && two.codes_found === 2 && two.note.includes('ask which one'));
ok(hex('#E60000 and again #e60000').hex === 'E60000', 'the same code twice is one code');
ok(hex('#E600001').hex === '' && hex('#GG0000').hex === '', 'seven digits or letters past F are not a code');
ok(hex('').hex === '' && run('hex_reply.js', {}).hex === '');
console.log(n + ' checks passed');
