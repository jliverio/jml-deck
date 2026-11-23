// "Prepare" of the research stage "3 Position and product" (faD59YwI10ucFYob), as fixed on 23 Nov.
// Builds the numbered passage list the model reads: passages marked value chain, offer type or products (A1 to A3),
// repeats removed, grouped by page, home page first. The model cites passages by number and never retypes a quote.
const start = $('Log start').first().json;
// The product in focus comes from Start: 'Log start' is the run_log row, which has no such column, so reading it there
// always gave "The request names no product in focus" (found 23 Nov, Millennium bcp re-test).
let focus = '';
try { focus = String(($('Start').first().json || {}).product_in_focus || '').trim(); } catch (e) { focus = ''; }
const rows = $input.all().map(i => i.json).filter(r => r && r.run_id === start.run_id && /^(A1|A2|A3)$/.test(r.question) && r.quote);
const LOC = /^[a-z]{2}(-[a-z]{2,4})?$/i;
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
const isHome = (u) => { const segs = pathOf(u).split('/').filter(Boolean); let k = 0; while (k < 2 && segs.length && LOC.test(segs[0])) { segs.shift(); k += 1; } return segs.length === 0; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim();
const seen = new Set();
const kept = [];
let repeats = 0;
rows.sort((a, b) => (isHome(b.url) - isHome(a.url)) || (a.url < b.url ? -1 : (a.url > b.url ? 1 : 0)) || ((a.position || 0) - (b.position || 0)));
for (const r of rows) {
  const key = r.question + '|' + norm(r.quote);
  if (seen.has(key)) { repeats += 1; continue; }
  seen.add(key);
  kept.push(r);
}
const MAX = 400;
const used = kept.slice(0, MAX);
if (!used.length) return [{ json: { _none: true } }];
const refs = used.map((r, i) => ({ n: i + 1, url: r.url, question: r.question, place: r.place || 'body', quote: r.quote, home: isHome(r.url) }));
const lines = [];
let last = '';
for (const p of refs) {
  if (p.url !== last) { lines.push(''); lines.push('PAGE ' + pathOf(p.url) + (p.home ? ' (HOME PAGE)' : '')); last = p.url; }
  lines.push('[' + p.n + '] ' + p.question + ' ' + p.place + ': ' + String(p.quote).replace(/\s+/g, ' ').slice(0, 600));
}
return [{ json: {
  list_text: lines.join('\n').trim(), refs,
  focus_line: focus ? 'Product in focus named in the request: ' + focus : 'The request names no product in focus.',
  passages_read: used.length, repeats_removed: repeats, left_out_over_limit: Math.max(0, kept.length - MAX), home_passages: refs.filter(p => p.home).length,
} }];
