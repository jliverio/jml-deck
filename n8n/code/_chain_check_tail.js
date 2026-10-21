
// ---------------- n8n wrapper ----------------
// Chain check runs after each of the four agents (Phase Architect, Workstream agent, Deliverable agent,
// Governance agent) and decides where the run goes next; the Route node after it reads `route`:
//   lead | ws | del | gov  -> that agent, with `agent_input` (the next agent's input, or a retry of the same one)
//   done                   -> Assemble drafts, with { output: compiled plan or null, valid, violations, ... }
// Each agent gets one retry with its violations; the second answer always goes on (as v2's Plan valid? did).
// An agent that fails twice ends the chain: no work plan reaches the deck and the run log names the agent.
// The answers so far are read back from the agent nodes ($(...).first() is the latest run, so a retry wins).
const AGENT = { lead: 'Phase Architect', ws: 'Workstream agent', del: 'Deliverable agent', gov: 'Governance agent' };
const ORDER = ['lead', 'ws', 'del', 'gov'];
const SOFT = /^(note_\d+:over_\d+_words|notes:over_6|basis:governing_question_too_long)$/;   // partner-only text
const cfg = $('Config').first().json;
const JARGON = cfg.jargon_never || [];
const input = $('Architect input').first().json.architect_input;

// which agent just answered, and on which pass (0 = first answer, 1 = retry)
let prevName = null, prevRun = null;
try { prevName = $prevNode.name; prevRun = $prevNode.runIndex; } catch (e) { /* not available */ }
const out0 = ($json && $json.output) || null;
let stage = ORDER.find(s => AGENT[s] === prevName);
if (!stage) stage = out0 && out0.events ? 'gov' : out0 && out0.deliverables ? 'del' : out0 && out0.workstreams ? 'ws' : 'lead';
// $prevNode.runIndex is the agent's run (Oct 21 probe, execution 827). The fallback counts the agent's runs; it is not
// used when $prevNode works, because a pinned node returns its pin data for any run index.
const runsOf = name => { let k = 0; try { while (k < 5) { const a = $(name).all(0, k); if (!a || !a.length) break; k++; } } catch (e) { } return k; };
const pass = Number.isInteger(prevRun) ? prevRun : Math.max(0, runsOf(AGENT[stage]) - 1);

// the state so far: the Phase Architect input plus each agent's latest answer up to this one
const latest = s => { if (s === stage) return $json || {}; try { return $(AGENT[s]).first().json || {}; } catch (e) { return null; } };
const state = { input };
for (const s of ORDER) {
  const j = latest(s);
  if (j === null) break;
  state[s] = (j && j.output) || {};
  if (s === 'lead') state.calendar = C.meetingCalendar(state.lead.phases || []);
  if (s === 'del') { const r = C.renumberDeliverables(state); state.del = { deliverables: r.deliverables, notes: r.notes }; }
  if (s === stage) break;
}

const agentError = $json && $json.error ? String($json.error.message || $json.error) : (out0 ? '' : 'no answer');
let violations;
if (agentError) violations = ['agent_error: ' + agentError];
else {
  try { violations = C.checkStage(stage, state, { jargon_never: JARGON }).violations; }
  catch (e) { violations = ['check_error: ' + e.message]; }
}
const hard = violations.filter(x => !SOFT.test(x));
const base = { stage, pass, violations: hard, warnings: violations.filter(x => SOFT.test(x)) };

// 1. a failed check on the first pass: the same agent again, with its answer and what to fix
if (hard.length && pass === 0) {
  let agent_input;
  try { agent_input = { ...C.stageInput(stage, state), previous_output: out0, violations: hard }; }
  catch (e) { agent_input = { previous_output: out0, violations: hard }; }
  return { json: { ...base, route: stage, agent_input } };
}
// 2. an agent that failed twice: stop, no work plan (Assemble drafts says so and the slides say [Firm to complete])
if (agentError) {
  return { json: { ...base, route: 'done', output: null, valid: false, agent_error: `${AGENT[stage]}: ${agentError}` } };
}
// 3. the next agent
const next = ORDER[ORDER.indexOf(stage) + 1];
if (next) {
  let agent_input;
  try { agent_input = C.stageInput(next, state); }
  catch (e) { return { json: { ...base, route: 'done', output: null, valid: false, agent_error: `input for ${AGENT[next]}: ${e.message}` } }; }
  return { json: { ...base, route: next, agent_input } };
}
// 4. all four answered: compile the plan in the v2 format the deck nodes read, with every check still unmet
let r;
try { r = C.compile(state, { jargon_never: JARGON }); }
catch (e) { return { json: { ...base, route: 'done', output: null, valid: false, agent_error: 'compile: ' + e.message } }; }
const all = [...r.violations];
for (const s of ORDER) { try { all.push(...C.checkStage(s, state, { jargon_never: JARGON }).violations); } catch (e) { all.push(`check_error ${s}: ${e.message}`); } }
const uniq = [...new Set(all)];
const left = uniq.filter(x => !SOFT.test(x));
return { json: {
  route: 'done',
  stage, pass,
  output: r.plan,
  valid: left.length === 0,
  violations: left,
  warnings: uniq.filter(x => SOFT.test(x)),
  repairs: r.repairs,
  agent_error: null,
  sizing: r.plan.sizing || null,
} };
