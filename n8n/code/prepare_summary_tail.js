// Prepare summary (Code, run once for each item). Input: Check copy (via Needs retry?) or Check retry.
// Builds the Summary Writer's input and carries the copy results through untouched (`pass`).
const b = $('Brief Organizer').first().json.output;
const cfg = $('Config').first().json;
const rules = ($('Template rules').first().json._rules) || [];
// The plan: Assemble drafts carries it as `workplan` (Phase Architect v2); else Validate plan's output.
// Both lookups throw or come back empty while the Phase Architect does not run -> no plan.
let planNode = null;
try { planNode = $('Assemble drafts').first().json.workplan || null; } catch (e) { planNode = null; }
if (!planNode) {
  try { const v = $('Validate plan').first().json; planNode = v && v.output ? v.output : null; } catch (e) { planNode = null; }
}
return { json: { summary_input: buildSummaryInput(b, planNode, cfg, rules), pass: $json } };
