// After the checks and the fit check: is a rewrite needed? One rewrite at most.
// It lists every text that failed a check and every box the renderer measured as too full, with what is wrong and what the text may use.
const F = $('Build the request').first().json;
const C = $('Check the values').last().json;
const r = $input.first().json || {};
const fitOk = !r.error && Array.isArray(r.boxes);
const over = fitOk ? r.boxes.filter(b => b.over) : [];
const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
const safe = (s) => clean(s).replace(/\{/g, '(').replace(/\}/g, ')');
const E = F.entries || {};
const line = (id) => { const e = E[id]; if (!e) return ''; return '[' + id + '] ' + e.kind + ' | ' + safe(e.statement) + (e.value !== null && e.value !== undefined && e.unit ? ' | value: ' + e.value + ' ' + safe(e.unit) : '') + (e.quote ? ' | quote: "' + safe(e.quote).slice(0, 320) + '"' : ''); };
// About how many characters one line of each box holds (measured on template 1.5.4).
const perLine = (box) => (box === 'client_points' ? 23 : (/^competitor_\d+_points$/.test(box) ? Math.round(21 * 4 / Math.max(C.shown.length, 1)) : (/^value_layer/.test(box) ? 52 : (/^product_\d+_text$/.test(box) ? 50 : (/title/.test(box) ? 55 : 100)))));
const want = {};   // slot -> list of reasons
const add = (slot, why) => { if (!C.slots[slot]) return; (want[slot] = want[slot] || []).push(why); };
for (const p of C.problems) add(p.slot, p.problem);
const boxes = [];
for (const b of over) {
  const slots = [...new Set((b.variables || []).map(v => C.from[v]).filter(Boolean))];
  if (!slots.length) continue;
  const n = b.over_by_lines || 1;
  if (b.kind === 'title') { for (const s of slots) add(s, 'The title runs to ' + b.lines + ' lines; it may take 2. Shorten it by about ' + (n * perLine(b.box)) + ' characters.'); continue; }
  if (b.kind === 'line') continue;   // a name is never rewritten
  boxes.push(b.box + ' (' + n + ' line' + (n === 1 ? '' : 's') + ' too long)');
  for (const s of slots) add(s, 'Its box is ' + n + ' line' + (n === 1 ? '' : 's') + ' too long. A line holds about ' + perLine(b.box) + ' characters. Shorten the texts of this box (' + slots.join(', ') + ') so that together they lose at least ' + n + ' line' + (n === 1 ? '' : 's') + '.');
}
// The points each competitor shows, so a rewritten title does not deny a claim the slide itself prints.
const pointsOf = () => C.shown.map(sh => { const c = F.competitors.find(x => x.entry === sh.entry); const pts = c ? c.points.map(id => (C.slots['comp:' + id] || {}).text).filter(Boolean) : []; return pts.length ? safe(sh.name) + ': ' + pts.map(safe).join(' | ') : ''; }).filter(Boolean).join('\n');
const list = Object.keys(want);
const again = C.round === 0 && list.length > 0;
let prompt = '';
if (again) {
  const blocks = list.map(slot => {
    const s = C.slots[slot];
    const isPrice = slot.indexOf('price:') === 0;
    const extra = isPrice ? F.offers : [];
    const ids = [...new Set((s.cites || []).concat(isPrice ? [slot.slice(6)] : []).concat(extra))].filter(id => E[id]);
    return 'SLOT ' + slot + '\nCurrent text: ' + safe(s.text) + '\nLimit: ' + s.limit + ' characters\nWhat is wrong: ' + want[slot].join(' ') + (slot === 'compare_title' ? '\nCompetitors on the slide: ' + C.shown.map(c => safe(c.name)).join(', ') + '\nTable:\n' + C.table.join('\n') + '\nPoints on the slide:\n' + pointsOf() + '\nIf a point plainly makes one of the claims although the table says that competitor does not, leave that claim out of the sentence. Use names rather than counts.' : '\nEntries it may use:\n' + ids.map(line).filter(Boolean).join('\n')) + (isPrice ? '\nFor a price, put the id of the entry it comes from in cites. To give no price, return an empty text.' : '');
  });
  prompt = 'Company: ' + safe(F.company) + '\n\nThese texts need a second version. Rewrite only the slots listed, keeping the same meaning and the same format. A shorter text is always acceptable; an empty text is acceptable when the entries do not support one.\n\n' + blocks.join('\n\n');
}
return [{ json: { again, round: C.round, prompt, asked: list, boxes_over: over.map(b => ({ box: b.box, lines: b.lines, room_lines: b.room_lines, over_by_lines: b.over_by_lines })), fit_checked: fitOk, fit_error: fitOk ? '' : String((r.error && (r.error.message || r.error)) || 'no answer from the renderer').slice(0, 200) } }];
