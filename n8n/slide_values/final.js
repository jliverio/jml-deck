// The values that go to the deck. A text that failed a check, even after the rewrite, is left out here.
// A box the renderer still measures as too full is left to the renderer, which drops the last point or trims the text and says so.
const F = $('Build the request').first().json;
const C = $('Check the values').last().json;
const D = $('Decide').last().json;
const values = C.values_strict;
const left_out = C.bad.map(slot => ({ slot, text: (C.slots[slot] || {}).text || '', why: C.problems.filter(p => p.slot === slot).map(p => p.problem).join(' ') }));
const notes = (C.notes || []).slice();
if (left_out.length) notes.push(left_out.length + ' text' + (left_out.length === 1 ? ' was' : 's were') + ' left out because ' + (left_out.length === 1 ? 'it' : 'they') + ' failed the checks: ' + left_out.map(x => x.slot).join(', ') + '.');
if (D.boxes_over.length) notes.push(D.boxes_over.length + ' box' + (D.boxes_over.length === 1 ? ' is' : 'es are') + ' still too full after the rewrite (' + D.boxes_over.map(b => b.box).join(', ') + '); the renderer trims ' + (D.boxes_over.length === 1 ? 'it' : 'them') + '.');
if (!D.fit_checked) notes.push('The fit check could not be run (' + D.fit_error + ').');
if (C.writer_failed) notes.push('The writer gave no answer; only the values code fills are present.');
// What the research did not find, in plain words, for the email.
const thin = [];
if (!F.found.products) thin.push('no product was found');
if (!F.found.layers) thin.push('the value chain could not be placed');
if (!F.claims.length) thin.push('no claim by the company was found');
if (!F.competitors.length) thin.push('no competitor was found');
else if (C.shown.length < 4) thin.push('only ' + C.shown.length + ' competitor' + (C.shown.length === 1 ? ' was' : 's were') + ' found');
// Where to look for each logo: the client's site and the home page of each competitor on the slide, when the research read it.
const site = (h) => (h ? (/^https?:/i.test(h) ? h : 'https://' + h) : '');
const logo_sites = {};
if (site(F.website)) logo_sites.client = site(F.website);
C.shown.forEach((s, i) => { const c = F.competitors.find(x => x.entry === s.entry); if (c && c.home) logo_sites['competitor_0' + (i + 1)] = site(c.home); });
const filled = Object.keys(values).filter(k => values[k]).length;
const rows = Object.keys(values).sort().map(k => ({ run_id: F.run_id, variable: k, value: values[k], slot: C.from[k] || 'code', entry_ids: C.from[k] && C.slots[C.from[k]] ? (C.slots[C.from[k]].cites || []).join(', ') : '' }));
return [{ json: { run_id: F.run_id, company: F.company, values, filled, variables: rows.length, rows, left_out, notes, thin, slides: { profile: C.profile, compare: C.compare }, competitors_shown: C.shown, rounds: C.round + 1, fit_checked: D.fit_checked, boxes_over: D.boxes_over, logo_sites } }];
