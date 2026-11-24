// A price or a ranking figure stored as a number must appear in its quote.
// A figure written with a scale word in the quote (1.2 billion, 3 million) is matched on its leading digits; without a scale word the whole figure must be there.
// Batch A (22 Nov): a price of 0 is also accepted when the quote says the offer is free (free, gratis, grátis, gratuito), as in "Free self-hosting". "Sugar-free" and the like do not count.
// 24 Nov: Portuguese, Spanish and French scale words count too (mil, milhões, mil milhões, bilhões, millones, milliards). Only English ones did, so a
// quote such as "3,5 milhões de clientes" or "81,462 mil milhões de dólares" failed: the rule dropped Caixa Geral de Depósitos (rank 1, two Millennium
// bcp runs) and Tesla and ChargePoint (ranks 1 and 3, Galp re-run of 23 Nov). Same test as for English: the leading digits only.
const j = $input.first().json;
const FREE = /(^|[^a-zÀ-ɏ-])(free|gratis|grátis|gratuit[oa]s?)([^a-zÀ-ɏ]|$)/;
const SCALE = /(thousand|million|billion|trillion|milh(ão|ões|ao|oes)|bilh(ão|ões|ao|oes)|mill(ón|on|ones)|milliard|(^|[^a-zÀ-ɏ])mil([^a-zÀ-ɏ]|$)|[0-9] ?(k|m|mn|bn|b)\b)/;
let checked = 0;
let free = 0;
for (const e of j.entries) {
  if (e.value === null || e.value === undefined || !e.quote) continue;
  const id = String(e.entry_id || '');
  const isFigure = id.indexOf('A4-O') === 0 || (id.indexOf('B2-K') === 0 && id.slice(-2) === '-P') || (e.measurement_base && e.measurement_base !== 'none');
  if (!isFigure) continue;
  checked += 1;
  const quote = String(e.quote).normalize('NFC').toLowerCase();
  if (Number(e.value) === 0 && FREE.test(quote)) { free += 1; continue; }
  const digits = quote.replace(/[^0-9]/g, '');
  const v = String(Number(e.value)).replace('.', '');
  if (digits.indexOf(v) !== -1) continue;
  const short = v.replace(/0+$/, '');
  const scaled = SCALE.test(quote);
  if (scaled && short.length >= 1 && digits.indexOf(short) !== -1) continue;
  j.fails.push({ id: e.id, entry_id: e.entry_id, rule: 'figure in the quote', why: 'the figure ' + e.value + ' is not in the quote' });
}
j.notes.push(checked + ' figures checked against their quotes' + (free ? '; ' + free + ' priced at 0 on a quote that says free' : ''));
return [{ json: j }];
