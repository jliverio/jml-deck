// Test harness for the four-agent chain. Agents run outside (sub-agents in tests, n8n in production);
// this script writes each agent's run prompt and checks each answer.
//   node run.js prompt  <dir> <stage> [retry]   -> <dir>/<stage>[_r]_prompt.txt (system prompt, schema, input)
//   node run.js check   <dir> <stage>           -> prints that stage's violations; writes the retry input when any
//   node run.js compile <dir>                   -> <dir>/compiled.json (same plan format as v2), prints a summary
//   node run.js baseline <dir>                  -> checks <dir>/v2.json, the single-agent answer, -> v2_compiled.json
// <dir> holds input.json (the Phase Architect input, as n8n/code/architect_input.js builds it) and the answers:
// lead.json, ws.json, del.json, gov.json, and <stage>_r.json after a retry (the retry answer wins).
const fs = require('fs');
const path = require('path');
const C = require('./chain.js');
const { validatePlan } = require('../validate_plan_v2.js');

const HERE = __dirname;
const FILES = { lead: ['prompt_lead.md', 'schema_lead.json'], ws: ['prompt_workstreams.md', 'schema_workstreams.json'], del: ['prompt_deliverables.md', 'schema_deliverables.json'], gov: ['prompt_governance.md', 'schema_governance.json'], review: ['prompt_reviewer.md', 'schema_reviewer.json'] };
const ORDER = ['lead', 'ws', 'del', 'gov'];
const JARGON = ['leverage', 'synergy', 'best practice', 'best-in-class', 'value-add', 'holistic', 'end-to-end', 'hit the ground running', 'world-class', 'proven', 'tried-and-tested', 'mission-critical', 'north star', 'step change', 'deep dive', 'learnings', 'unlock', 'drive (for outcomes)', 'robust', 'actionable', 'scalable', 'transformation', 'transform', 'passionate', 'MVP', 'compare notes'];

const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const has = f => fs.existsSync(f);
// the short client name the deck prints, as n8n/code/assemble_drafts.js derives it
const shortClient = inp => String(((inp.brief.hard_fields || {}).client || {}).value || 'the client').split(',')[0].trim();

function answer(dir, stage) {
  const r = path.join(dir, `${stage}_r.json`), f = path.join(dir, `${stage}.json`);
  return has(r) ? rd(r) : (has(f) ? rd(f) : null);
}
function loadState(dir, upto) {
  const state = { input: rd(path.join(dir, 'input.json')) };
  if (has(path.join(dir, 'review_feedback.json'))) state.review_feedback = rd(path.join(dir, 'review_feedback.json'));
  for (const s of ORDER) {
    const a = answer(dir, s);
    if (!a) break;
    state[s] = a;
    if (s === 'lead') state.calendar = C.meetingCalendar(a.phases || []);
    if (s === 'del') { const r = C.renumberDeliverables(state); state.del = { deliverables: r.deliverables, notes: r.notes }; state.delRepairs = r.repairs; }
    if (s === upto) break;
  }
  return state;
}

function runPrompt(file, out) {
  return `You are executing one test run of a production LLM agent. The file ${file} holds its SYSTEM PROMPT, SCHEMA and INPUT. Read that file with the Read tool, treat SYSTEM PROMPT as your complete instructions and INPUT as the user message, exactly as the production model would. Think it through, then produce exactly the JSON object the system prompt asks for, matching SCHEMA. Save that JSON (and nothing else) with the Write tool to ${out}. Do not read, list or open any other file, do not search, and use no tool other than Read (for that one file) and Write. After saving, reply with the single word: done.`;
}

function writePrompt(dir, stage, retry) {
  let inp;
  if (stage === 'review') inp = C.reviewInput(loadState(dir));
  else {
    const state = loadState(dir, ORDER[ORDER.indexOf(stage) - 1]);
    inp = C.stageInput(stage, state);
  }
  if (retry) {
    const prev = rd(path.join(dir, `${stage}.json`));
    const v = rd(path.join(dir, `${stage}_violations.json`));
    inp = { ...inp, previous_output: prev, violations: v };
  } else if (has(path.join(dir, `${stage}_prev.json`))) {
    // revision round: the agent that owns the reviewer's issues fixes its previous answer
    const fb = rd(path.join(dir, 'review_feedback.json'));
    inp = { ...inp, previous_output: rd(path.join(dir, `${stage}_prev.json`)), violations: fb[stage] || [] };
    delete inp.review_feedback;
  }
  const [p, s] = FILES[stage];
  const txt = `=== SYSTEM PROMPT ===\n${fs.readFileSync(path.join(HERE, p), 'utf8')}\n=== SCHEMA ===\n${fs.readFileSync(path.join(HERE, s), 'utf8')}\n=== INPUT ===\n${JSON.stringify(inp)}\n`;
  const pf = path.join(dir, `${stage}${retry ? '_r' : ''}_prompt.txt`);
  fs.writeFileSync(pf, txt);
  const out = path.join(dir, `${stage}${retry ? '_r' : ''}.json`);
  fs.writeFileSync(pf.replace('_prompt.txt', '_agent_task.txt'), runPrompt(pf, out));
  return { pf, chars: txt.length };
}

function check(dir, stage) {
  if (stage === 'review') {
    const rv = answer(dir, 'review');
    const v = C.checkReview(rv);
    const tag = has(path.join(dir, 'review_r.json')) ? ' (retry)' : '';
    if (v.length && !tag) fs.writeFileSync(path.join(dir, 'review_violations.json'), JSON.stringify(v));
    console.log(`${path.basename(dir)} review${tag}: ${rv.verdict}, ${rv.issues.length} issues ${JSON.stringify(rv.issues.map(x => x.owner + ':' + x.target))}${v.length ? ' VIOLATIONS ' + JSON.stringify(v) : ''}`);
    return { violations: v, calendar: [] };
  }
  const state = loadState(dir, stage);
  const r = C.checkStage(stage, state, { jargon_never: JARGON });
  const tag = has(path.join(dir, `${stage}_r.json`)) ? ' (retry)' : '';
  if (r.violations.length && !tag) fs.writeFileSync(path.join(dir, `${stage}_violations.json`), JSON.stringify(r.violations));
  const extra = stage === 'del' && state.delRepairs.length ? ` renumbered: ${state.delRepairs.join(', ')}` : '';
  console.log(`${path.basename(dir)} ${stage}${tag}: ${r.violations.length} violations ${JSON.stringify(r.violations)}${r.calendar.length ? ' CALENDAR BUG ' + JSON.stringify(r.calendar) : ''}${extra}`);
  if (stage === 'lead') console.log(`  phases ${state.lead.phases.map(p => `${p.name} ${p.duration_weeks.min}-${p.duration_weeks.max}w`).join(', ')} | meetings ${state.calendar.map(e => e.type[0].toUpperCase() + e.week).join(' ')}`);
  if (stage === 'ws') console.log(`  ${state.ws.workstreams.length} workstreams: ${(state.lead.phases || []).map((p, i) => p.name + ' ' + state.ws.workstreams.filter(w => w.phase_order === i + 1).length).join(', ')}`);
  if (stage === 'del') console.log(`  ${state.del.deliverables.length} deliverables; per workstream ${state.ws.workstreams.map(w => state.del.deliverables.filter(d => d.workstream_id === w.id).length).join('')}`);
  return r;
}

function summarize(key, plan, violations, repairs) {
  const hard = violations.filter(x => !/^(note_\d+:over_\d+_words|notes:over_6|basis:governing_question_too_long)$/.test(x));
  console.log(`${key}: ${hard.length} violations ${JSON.stringify(hard)} | ${repairs.length} repairs${repairs.length ? ' ' + JSON.stringify(repairs.filter(x => /presented at/.test(x))) : ''}`);
  console.log(`  ${plan.total_duration_weeks.min}-${plan.total_duration_weeks.max} wk | ${plan.phases.map(x => x.name + ' ' + x.duration_weeks.max + 'w/' + x.workstream_ids.length + 'ws').join(', ')} | ${plan.deliverables.length} del | meetings ${plan.governance.events.map(e => e.type[0].toUpperCase() + e.week).join(' ')}`);
}

function compile(dir) {
  const state = loadState(dir);
  const r = C.compile(state, { jargon_never: JARGON });
  fs.writeFileSync(path.join(dir, 'compiled.json'), JSON.stringify({ client: shortClient(state.input), ...r.plan }, null, 1));
  summarize(path.basename(dir) + ' chain', r.plan, r.violations, r.repairs);
  return r;
}

// After the review: set up one revision round in <dir>/rev (null when the verdict is send).
function revise(dir) {
  const rv = answer(dir, 'review');
  const route = C.routeReview(rv, process.env.REVIEW_MODE || 'local');
  if (route && route.for_partner.length) fs.writeFileSync(path.join(dir, 'for_partner.json'), JSON.stringify(route.for_partner, null, 1));
  if (!route || !route.from) { console.log(`${path.basename(dir)}: ${route ? 'lead issues to the partner only' : 'send'}`); return null; }
  const rdir = path.join(dir, 'rev');
  fs.mkdirSync(rdir, { recursive: true });
  fs.copyFileSync(path.join(dir, 'input.json'), path.join(rdir, 'input.json'));
  for (const st of ORDER) {
    if (st === route.from) { fs.writeFileSync(path.join(rdir, `${st}_prev.json`), JSON.stringify(answer(dir, st))); break; }
    fs.writeFileSync(path.join(rdir, `${st}.json`), JSON.stringify(answer(dir, st)));
    fs.writeFileSync(path.join(rdir, `${st}.copied`), 'kept from the first round');
  }
  const fb = { ...route.feedback };
  fs.writeFileSync(path.join(rdir, 'review_feedback.json'), JSON.stringify(fb));
  console.log(`${path.basename(dir)}: revise from ${route.from} ${JSON.stringify(Object.fromEntries(Object.entries(fb).map(([k, x]) => [k, x.length])))}`);
  return route;
}

function baseline(dir) {
  const inp = rd(path.join(dir, 'input.json'));
  const f = has(path.join(dir, 'v2_r.json')) ? 'v2_r.json' : 'v2.json';
  const arch = rd(path.join(dir, f));
  const r = validatePlan(arch, { brief: inp.brief, success_criteria_list: inp.success_criteria_list || [], jargon_never: JARGON, weeks_available: inp.weeks_available });
  fs.writeFileSync(path.join(dir, 'v2_compiled.json'), JSON.stringify({ client: shortClient(inp), ...r.plan }, null, 1));
  summarize(path.basename(dir) + ' v2' + (f === 'v2_r.json' ? ' (retry)' : ''), r.plan, r.violations, r.repairs);
  return r;
}

if (require.main === module) {
  const [cmd, dir, stage, retry] = process.argv.slice(2);
  if (cmd === 'prompt') { const r = writePrompt(dir, stage, retry === 'retry'); console.log(`${r.pf} (${r.chars} chars)`); }
  else if (cmd === 'check') check(dir, stage);
  else if (cmd === 'compile') compile(dir);
  else if (cmd === 'baseline') baseline(dir);
  else if (cmd === 'revise') revise(dir);
  else console.log('usage: node run.js prompt|check|compile|baseline <dir> [stage] [retry]');
}
module.exports = { loadState, writePrompt, check, compile, baseline, revise, answer, JARGON };
