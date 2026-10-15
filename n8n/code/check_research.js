const out = $json.output || {};
// Limits come from the template_variables table (via Template rules): draft_chars per field.
const R = ($('Template rules').item.json._research) || {};
const fr = f => (R.field_rules || []).find(x => x.field === f) || {};
const limits = { title: 90, actor: 60, summary: fr('summary').draft_chars || null,
  bullet: Math.max(fr('context').draft_chars || 0, fr('action').draft_chars || 0, fr('result').draft_chars || 0) || null,
  not_covered: 100, max_rows: R.max_rows || 5 };
const prof = ($('checkProfiler').item.json.output) || {};
const ctx = { today: $('Config').item.json.today, client_name: prof.client_name, max_rows: limits.max_rows || 5, limits: limits };

const VAGUE = ['lots','many','most','several','numerous','various','majority','few','some','a lot'];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasWord = (t, w) => (' ' + norm(t) + ' ').includes(' ' + w + ' ');
const mentions = (t, n) => { const x = norm(n); return x.length > 2 && (' ' + norm(t) + ' ').includes(' ' + x + ' '); };
const words = s => String(s || '').split(/\s+/).filter(Boolean).length;
const dateAfter = (d, today) => { if (!d) return false; const ds = String(d); return ds > String(today).slice(0, ds.length); };

const slide = out.slide || {};
const rows = Array.isArray(slide.rows) ? slide.rows : [];
const sources = Array.isArray(out.sources) ? out.sources : [];
const qq = out.search_quality;
const v = [];

if (rows.length === 0) {
  if (qq !== 'none') v.push('quality:empty_rows_not_none');
  if (slide.title !== null) v.push('quality:empty_rows_title_not_null');
} else if (qq === 'none') {
  v.push('quality:rows_present_but_none');
}
if (rows.length > ctx.max_rows) v.push('rows:over_max');

if (rows.length > 0) {
  const t = slide.title;
  if (t === null || t === undefined || t === '') v.push('title:missing');
  else {
    if (ctx.limits.title && t.length > ctx.limits.title) v.push('title:over_limit');
    if (VAGUE.some(w => hasWord(t, w))) v.push('title:vague_quantifier');
  }
}

const srcRefs = sources.map(s => s.ref);
const appearance = [];
const pushRef = r => { if (!appearance.includes(r)) appearance.push(r); };
rows.forEach(r => { ['context','action','result'].forEach(part => { const p = r && r[part]; if (p && Array.isArray(p.refs)) p.refs.forEach(pushRef); }); });
appearance.forEach(r => { if (!srcRefs.includes(r)) v.push('refs:unresolved_' + r); });
srcRefs.forEach((r, i) => { if (r !== i + 1) v.push('refs:source_not_sequential_' + r); });
appearance.forEach((r, i) => { if (r !== i + 1) v.push('refs:appearance_out_of_order_' + r); });
srcRefs.forEach(r => { if (!appearance.includes(r)) v.push('refs:source_unused_' + r); });

rows.forEach((r, i) => {
  const tag = 'row' + i;
  if (mentions(r.actor, ctx.client_name)) v.push(tag + ':actor_is_client');
  if (ctx.limits.actor && r.actor && r.actor.length > ctx.limits.actor) v.push(tag + ':actor_over_limit');
  if (ctx.limits.summary && r.summary && r.summary.length > ctx.limits.summary) v.push(tag + ':summary_over_limit');
  ['context','action','result'].forEach(part => { const p = r && r[part]; if (!p) { v.push(tag + ':' + part + '_missing'); return; } if (ctx.limits.bullet && p.text && p.text.length > ctx.limits.bullet) v.push(tag + ':' + part + '_over_limit'); });
  ['context','action'].forEach(part => { const p = r[part]; if (p && (!Array.isArray(p.refs) || p.refs.length === 0)) v.push(tag + ':' + part + '_no_refs'); });
  const res = r.result || {};
  const noRefs = !Array.isArray(res.refs) || res.refs.length === 0;
  const nyr = res.text === 'Not yet reported';
  if (noRefs !== nyr) v.push(tag + ':result_nyr_mismatch');
  if (words(r.why_it_matters_to_scope) > 25) v.push(tag + ':why_over_25_words');
});

const nc = Array.isArray(slide.not_covered) ? slide.not_covered : [];
if (nc.length > 3) v.push('not_covered:over_3');
nc.forEach((line, i) => { if (ctx.limits.not_covered && line.length > ctx.limits.not_covered) v.push('not_covered_over_limit_' + i); });
sources.forEach(s => { if (dateAfter(s.source_date, ctx.today)) v.push('source_date_after_today_' + s.ref); });

return { json: { output: out, _research_validation: { ok: v.length === 0, violations: v } } };