// What the stage did, for run_log and for the parent: the values, what was left out and what the email should say.
const start = $('Start').first().json;
let b = {}; let f = null;
try { b = $('Build the request').first().json || {}; } catch (e) { b = {}; }
try { f = $('Final values').first().json; } catch (e) { f = null; }
let lg = {};
try { lg = $('Fetch logos').first().json || {}; } catch (e) { lg = {}; }
const logos = lg.logos && typeof lg.logos === 'object' ? lg.logos : {};
const ended = new Date();
const duration_s = Math.round((ended.getTime() - new Date(start.started_at).getTime()) / 100) / 10;
const NAMES = ['section_02', 'profile_title_01', 'value_layer_01', 'value_layer_02', 'value_layer_03', 'value_layer_04', 'details_01', 'details_02', 'sources_profile_01', 'compare_title_01', 'client_name_01', 'sources_compare_01'];
for (let i = 1; i <= 6; i += 1) { NAMES.push('product_0' + i + '_name'); NAMES.push('product_0' + i + '_text'); }
for (let i = 1; i <= 5; i += 1) NAMES.push('client_point_0' + i);
for (let k = 1; k <= 4; k += 1) { NAMES.push('competitor_0' + k + '_name'); NAMES.push('competitor_0' + k + '_fact_01'); for (let j = 1; j <= 3; j += 1) NAMES.push('competitor_0' + k + '_point_0' + j); }
const values = {};
for (const n of NAMES) values[n] = f && f.values[n] ? f.values[n] : '';
let outcome = 'ok'; let note = '';
if (!f) {
  outcome = b._none ? 'partial' : 'error';
  note = b._none ? 'The research holds nothing to put on the two slides (' + (b.entries_read || 0) + ' entries read); both slides are left out.' : 'The slide values were not written.';
} else {
  const writerFailed = f.notes.some(n => /writer gave no answer/.test(n));
  if (writerFailed) outcome = 'error';
  else if (f.left_out.length || f.boxes_over.length || !f.fit_checked) outcome = 'partial';
  note = f.filled + ' of ' + NAMES.length + ' values filled; ' + f.rounds + ' model call' + (f.rounds === 1 ? '' : 's') + '; ' + f.competitors_shown.length + ' competitors on the slide' + (f.notes.length ? '; ' + f.notes.join(' ') : '') + (f.thin.length ? ' Thin: ' + f.thin.join('; ') + '.' : '');
}
return [{ json: { run_id: start.run_id, stage: 'slide_values', ended_at: ended.toISOString(), duration_s, model_calls: f ? f.rounds : 0, outcome, note: note.slice(0, 900), values,
  filled: f ? f.filled : 0, slides: f ? f.slides : { profile: false, compare: false }, thin: f ? f.thin : ['the research found nothing for the two slides'], notes: f ? f.notes : [], left_out: f ? f.left_out : [],
  competitors_shown: f ? f.competitors_shown : [], boxes_over: f ? f.boxes_over : [], fit_checked: f ? f.fit_checked : false,
  logos, logos_found: Object.keys(logos), logo_notes: lg.notes || {} } }];
