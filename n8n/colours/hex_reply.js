// Does a partner's reply ask for the deck in a colour? Returns the HEX code found in the new text of the reply.
// Counted as a code: "#E60000" or "#e60" anywhere; or six HEX digits with no "#" when the line names a colour
// (hex, colour, color, cor) or holds nothing else. Quoted history (lines starting with ">", and everything from
// "On ... wrote:" or "... escreveu:" on) is not read, so the example in our own email is never taken as the answer.
const text = String(($input.first() && $input.first().json && $input.first().json.text) || '');
let fresh = [];
for (const line of text.split(/\r?\n/)) {
  if (/^\s*(On\b.*\bwrote:|Em\b.*\bescreveu:|-----\s*Original Message|De:\s|From:\s)/i.test(line)) break;
  if (/^\s*>/.test(line)) continue;
  fresh.push(line);
}
const found = [];
const add = (h) => { const x = (h.length === 3 ? h.split('').map(c => c + c).join('') : h).toUpperCase(); if (!found.includes(x)) found.push(x); };
for (const line of fresh) {
  let m; const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
  while ((m = re.exec(line))) add(m[1]);
  const bare = /(?:^|[^0-9a-zA-Z#])([0-9a-fA-F]{6})(?![0-9a-zA-Z])/g;
  const names = /\b(hex|colour|color|cor|cores|colours|colors)\b/i.test(line);
  const alone = /^\s*[0-9a-fA-F]{6}\s*[.!]?\s*$/.test(line);
  if (names || alone) while ((m = bare.exec(line))) add(m[1]);
}
return [{ json: { hex: found.length === 1 ? found[0] : '', codes_found: found.length, note: found.length === 0 ? 'No HEX code in the reply.' : (found.length === 1 ? '' : 'The reply holds ' + found.length + ' different HEX codes (' + found.map(c => '#' + c).join(', ') + '): ask which one.') } }];
