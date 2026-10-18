// Architect input (Code, run once for each item). Input: Assemble market.
// Builds the Phase Architect v2 user message. Passes Assemble market's output through untouched.
// METHOD_LIBRARY is the firm's engagement archetypes (phase_architect/method_library.json).
// Replace the week ranges with the firm's own history; only new_venture_build is calibrated.
const METHOD_LIBRARY = [{"id": "new_venture_build", "use_when": "The client wants something new built and launched: a venture, digital product, platform or new business model.", "phases": [{"name": "Design", "typical_weeks": [5, 8], "workstreams": [{"name": "Scope & hypotheses", "share": "first 1 week", "deliverables": ["Hypotheses on each blueprint component"]}, {"name": "Analyze", "share": "middle, about 60%", "deliverables": ["Customer and market evidence on the hypotheses", "Wireframe prototype"]}, {"name": "Plan", "share": "last 1-2 weeks", "deliverables": ["Blueprint with tested hypotheses", "Detailed plan for the pilot phase"]}], "governance": "Kick-off in week 1; mid-phase check-in; go/no-go on the pilot at phase end."}, {"name": "Pilot", "typical_weeks": [12, 20], "workstreams": [{"name": "Enable", "share": "from phase start to about 85%", "deliverables": ["KPIs agreed with key stakeholders", "Key internal hires identified"]}, {"name": "Validate", "share": "first 15-20%", "deliverables": ["First customer target group identified"]}, {"name": "Build", "share": "from about 10% to about 85%", "deliverables": ["First version launched to a small group of users"]}, {"name": "Plan scale-up", "share": "last 30%", "deliverables": ["Business case with implementation plan and roadmap"]}], "governance": "Two steering workshops at about 30% and 70%; go/no-go on the next phase at phase end."}]}, {"id": "market_entry_assessment", "use_when": "The client asks whether and how to enter a market, segment or geography, without building yet.", "phases": [{"name": "Research", "typical_weeks": [4, 8], "workstreams": [{"name": "Market attractiveness", "share": "first 60%", "deliverables": ["Market sizing and growth by segment"]}, {"name": "Competitive position", "share": "from 20% to end", "deliverables": ["Competitor profiles and customer needs"]}, {"name": "Capability to win", "share": "from 40% to end", "deliverables": ["Gap assessment of the client's assets"]}], "governance": "Kick-off; steering workshop on findings near 60% when the phase is 8 weeks or more; findings sign-off at phase end."}, {"name": "Design", "typical_weeks": [3, 6], "workstreams": [{"name": "Entry options", "share": "first 60%", "deliverables": ["Entry options compared on agreed criteria"]}, {"name": "Business case & roadmap", "share": "from 40% to end", "deliverables": ["Business case for the preferred option", "Entry roadmap"]}], "governance": "Final decision meeting at phase end."}]}, {"id": "operating_model_redesign", "use_when": "The client wants to change how it is organized or how work flows: structure, roles, processes, governance, shared services.", "phases": [{"name": "Diagnostic", "typical_weeks": [4, 8], "workstreams": [{"name": "Current-state mapping", "share": "first 70%", "deliverables": ["Process and organization baseline"]}, {"name": "Stakeholder interviews", "share": "first 60%", "deliverables": ["Interview synthesis of pain points"]}, {"name": "Baseline & opportunities", "share": "from 40% to end", "deliverables": ["Cost and performance baseline", "Prioritized improvement areas"]}], "governance": "Kick-off; diagnostic readout at phase end."}, {"name": "Design", "typical_weeks": [6, 10], "workstreams": [{"name": "Target model options", "share": "first 40%", "deliverables": ["Target operating model options"]}, {"name": "Detailed design", "share": "from 30% to 90%", "deliverables": ["Detailed design of the chosen model"]}, {"name": "Transition plan", "share": "last 30%", "deliverables": ["Transition roadmap and change plan"]}], "governance": "Design workshop to choose the option near 40%; sign-off at phase end."}]}, {"id": "performance_improvement", "use_when": "The client wants to cut cost, raise productivity or improve a measurable result in existing operations.", "phases": [{"name": "Diagnostic", "typical_weeks": [3, 6], "workstreams": [{"name": "Baseline", "share": "first 50%", "deliverables": ["Performance baseline"]}, {"name": "Opportunity sizing", "share": "from 30% to end", "deliverables": ["Sized opportunity list"]}], "governance": "Kick-off; go/no-go on initiatives at phase end."}, {"name": "Implementation", "typical_weeks": [8, 16], "workstreams": [{"name": "Initiative delivery", "share": "whole phase", "deliverables": ["Initiatives implemented in waves"]}, {"name": "Results tracking", "share": "from 20% to end", "deliverables": ["Results tracker against the baseline"]}, {"name": "Capability building", "share": "from 50% to end", "deliverables": ["Trained client team owning the initiatives"]}], "governance": "Steering workshop on wave results near 50%; handover decision at phase end."}]}, {"id": "technology_selection_implementation", "use_when": "The client wants to choose and put in place a system or software platform (ERP, CRM, data platform).", "phases": [{"name": "Diagnostic", "typical_weeks": [3, 6], "workstreams": [{"name": "Requirements", "share": "whole phase", "deliverables": ["Business requirements"]}, {"name": "Process fit", "share": "from 30% to end", "deliverables": ["Process fit-gap"]}], "governance": "Kick-off; requirements sign-off at phase end."}, {"name": "Design", "typical_weeks": [4, 8], "workstreams": [{"name": "Vendor selection", "share": "first 70%", "deliverables": ["Vendor shortlist and scoring"]}, {"name": "Business case", "share": "from 50% to end", "deliverables": ["Business case and selection recommendation"]}], "governance": "Vendor demo workshop near 50%; selection decision at phase end."}]}];
const bo = $('Brief Organizer').first().json.output;
const prof = ($('checkProfiler').first().json.output) || {};
const cfg = $('Config').first().json;
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
    soft_fields: { deliverable_format: sf.deliverable_format, timeline: sf.timeline, prior_attempts: sf.prior_attempts, success_criteria: sf.success_criteria, out_of_scope: sf.out_of_scope, workstreams: sf.workstreams || null } },
  success_criteria_list,
  profile: { problem_focus: prof.problem_focus || null, topic: prof.topic || null, current_state: prof.current_state || null, market: prof.market || null },
  market_findings: ($json.market_findings || []).map(f => ({ actor: f.actor, summary: f.summary, scope_risk: f.scope_risk })),
  weeks_available,
  method_library: METHOD_LIBRARY
};
return { json: { ...$json, architect_input } };
