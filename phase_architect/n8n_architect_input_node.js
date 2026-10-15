// n8n Code node "Architect input" (Run Once for Each Item) — place between "Assemble market" and "Phase Architect".
// Builds the Phase Architect v2 user message. Paste method_library.json's "archetypes" array into Config as `method_library`.
const bo = $('Brief Organizer').item.json.output;
const prof = ($('checkProfiler').item.json.output) || {};
const cfg = $('Config').item.json;
const sf = bo.soft_fields || {};
const sc = sf.success_criteria || {};
const success_criteria_list = (sc.source === 'stated' && sc.value)
  ? String(sc.value).split(';').map(s => s.trim().replace(/\.$/, '')).filter(Boolean) : [];

// deadline -> weeks available (two weeks allowed to contract and start)
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
function parseDeadline(t) {
  t = String(t || '');
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = new RegExp('(' + MONTHS.join('|') + ')\\s+(\\d{1,2}),?\\s+(\\d{4})', 'i').exec(t);
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]));
  m = new RegExp('(\\d{1,2})\\s+(' + MONTHS.join('|') + ')\\s+(\\d{4})', 'i').exec(t);
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1]));
  return null;
}
let weeks_available = null;
const tl = sf.timeline || {};
if (tl.source === 'stated' && tl.value) {
  const d = parseDeadline(tl.value);
  if (d) weeks_available = Math.max(0, Math.floor((d - new Date(cfg.today + 'T00:00:00Z')) / (7 * 864e5)) - 2);
}

const architect_input = {
  brief: { hard_fields: bo.hard_fields, required: bo.required,
    soft_fields: { deliverable_format: sf.deliverable_format, timeline: sf.timeline, prior_attempts: sf.prior_attempts, success_criteria: sf.success_criteria, out_of_scope: sf.out_of_scope } },
  success_criteria_list,
  profile: { problem_focus: prof.problem_focus || null, topic: prof.topic || null, current_state: prof.current_state || null, market: prof.market || null },
  market_findings: ($json.market_findings || []).map(f => ({ actor: f.actor, summary: f.summary, scope_risk: f.scope_risk })),
  weeks_available,
  method_library: cfg.method_library || []
};
return { json: { ...$json, architect_input } };
