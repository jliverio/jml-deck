// What the stage did, for run_log and for the parent. Every search is listed.
const start = $('Start').first().json;
const get = (name) => { try { return $(name).all().map(i => i.json); } catch (e) { return []; } };
const qs = get('Queries').filter(q => !q._none);
const src = get('Sources').filter(s => !s._none);
const pg = get('Pages').filter(p => !p._none);
const rk = get('Rank');
const sq = get('Site queries');
const bld = get('Build entries');
const s = (bld[0] && bld[0]._summary) || null;
const q0 = qs[0] || {};
const where = q0.home_country ? ' in ' + q0.home_country + ' (' + q0.country_basis + ')' : '';
const ended = new Date();
const duration_s = Math.round((ended.getTime() - new Date(start.started_at).getTime()) / 100) / 10;
let outcome = 'ok';
let note = '';
if (!qs.length) { outcome = 'partial'; note = 'No product category found for this run, so nothing was searched. Run Position and product first.'; }
else if (!src.length) { outcome = 'partial'; note = qs.length + ' searches run' + where + '; no usable result came back.'; }
else if (!pg.length) { outcome = 'partial'; note = qs.length + ' searches run' + where + ', ' + src.length + ' pages chosen; none could be read.'; }
else if (!s) {
  outcome = 'partial';
  const r0 = rk[0] || {};
  note = qs.length + ' searches run' + where + ', ' + pg.length + ' pages read; ' + (r0.candidates ? r0.candidates + ' companies named, none kept' + ((r0.not_selling || []).length ? ': the pages show they do not sell in ' + q0.home_country : '') + '.' : 'no company was named with a quote.');
} else {
  if (s.competitors.length < 5) outcome = 'partial';
  note = (qs.length + sq.length) + ' searches run' + where + ', ' + pg.length + ' pages read; ' + s.candidates + ' companies named, ' + s.competitors.length + ' of 5 listed: ' + s.competitors.map(c => c.rank + ' ' + c.name + ' (' + (c.measure === 'none' ? 'no figure' : c.measure) + ')').join(', ') + '; ' + s.home_pages_read + ' home pages read' + (s.left_out.length ? '; left out: ' + s.left_out.map(x => x.name + ' (' + x.why + ')').join(', ') : '') + (s.not_selling.length ? '; not selling in ' + q0.home_country + ': ' + s.not_selling.join(', ') : '');
}
const lights = s ? s.light_checks : 0;
return [{ json: { run_id: start.run_id, stage: 'competitors', ended_at: ended.toISOString(), duration_s, searches: qs.length + sq.length, pages_fetched: pg.length + lights, model_calls: pg.length + lights, outcome, note: note.slice(0, 900), queries: qs.map(q => ({ purpose: q.purpose, q: q.q, country: q.country })), home_country: q0.home_country || '', country_basis: q0.country_basis || '', ...(s || {}) } }];
