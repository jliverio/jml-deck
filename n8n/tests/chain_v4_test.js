"use strict";
// Replays the v4 chain (Oct 24: the lead frames, the Workstream agent sizes, deliverables trace to done items) through
// n8n/code/chain_check_v4.js with mocked node lookups, as chain_test.js does for v3. The saved v3 answers from
// phase_architect/runs/ are converted to the v4 shapes (sizing moves to the Workstream agent, done items on the gates,
// done_ref on the deliverables), so every v4 check runs on real plans.
// Usage: node n8n/tests/chain_v4_test.js
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const CODE = fs.readFileSync(path.join(ROOT, "n8n", "code", "chain_check_v4.js"), "utf8");
const RUNS = path.join(ROOT, "phase_architect", "runs", "oct19_checks_formats");
const rd = f => JSON.parse(fs.readFileSync(f, "utf8"));
const JARGON = ['leverage', 'synergy', 'best practice', 'best-in-class', 'value-add', 'holistic', 'end-to-end', 'hit the ground running', 'world-class', 'proven', 'tried-and-tested', 'mission-critical', 'north star', 'step change', 'deep dive', 'learnings', 'unlock', 'drive (for outcomes)', 'robust', 'actionable', 'scalable', 'transformation', 'transform', 'passionate', 'MVP', 'compare notes'];
const METHOD = rd(path.join(ROOT, "phase_architect", "method_library.json"));
const clip = (s, n) => String(s).split(/\s+/).slice(0, n).join(" ");

function chainRun(input) {
  const runs = { Config: [[{ jargon_never: JARGON }]], "Architect input": [[{ architect_input: input }]] };
  const $ = name => {
    const r = runs[name];
    if (!r || !r.length) throw new Error(`Referenced node is unexecuted: ${name}`);
    return {
      first: () => ({ json: r[r.length - 1][0] }),
      all: (b, k) => { const kk = k === undefined ? r.length - 1 : k; if (kk >= r.length) throw new Error(`Run ${kk} of node "${name}" not found`); return r[kk].map(j => ({ json: j })); },
    };
  };
  return function answer(agent, json) {
    (runs[agent] = runs[agent] || []).push([json]);
    const prev = { name: agent, runIndex: runs[agent].length - 1, outputIndex: 0 };
    const fn = new Function("$", "$json", "$prevNode", CODE);
    return fn($, json, prev).json;
  };
}

// v3 answers -> v4 shapes
function toV4(dir) {
  const lead3 = rd(path.join(dir, "lead.json")), ws3 = rd(path.join(dir, "ws.json")), del3 = rd(path.join(dir, "del.json")), gov = rd(path.join(dir, "gov.json"));
  const sz = lead3.sizing || {};
  const wsByPhase = {};
  for (const w of ws3.workstreams) (wsByPhase[w.phase_order] = wsByPhase[w.phase_order] || []).push(w);
  // done items: the names of up to 4 deliverables of the phase (v3 deliverables are named as things)
  const delByPhase = {};
  for (const d of del3.deliverables) { const w = ws3.workstreams.find(x => x.id === d.workstream_id); if (w) (delByPhase[w.phase_order] = delByPhase[w.phase_order] || []).push(d); }
  const lead = {
    basis: lead3.basis, length_basis: sz.length_basis, sub_questions: sz.sub_questions || [],
    phases: lead3.phases.map((p, i) => ({ ...p, gate: { ...p.gate, done: (delByPhase[i + 1] || []).slice(0, 4).map(d => clip(d.name, 12)) } })),
    // v4: the lead has no estimate to quote, so v3 notes that quoted one are left out of the fixture
    architect_notes: (lead3.architect_notes || []).filter(n => !/\d+\s*(?:-|–|to)\s*\d+[\s-]*weeks?/i.test(n)),
  };
  const phase_work = (sz.phase_work || []).map(e => {
    const streams = (wsByPhase[e.phase_order] || []).slice().sort((a, b) => (b.duration || 0) - (a.duration || 0));
    return { ...e, work: (e.work || []).map(w => ({ ...w, workstream_id: (streams[0] || {}).id || "W1" })) };
  });
  const ws = { ...ws3, sizing: { drivers: sz.drivers || [], phase_work, levers: sz.levers || "" } };
  const del = { ...del3, deliverables: del3.deliverables.map(d => {
    const w = ws3.workstreams.find(x => x.id === d.workstream_id);
    const items = w ? lead.phases[w.phase_order - 1].gate.done : [];
    const k = items.indexOf(clip(d.name, 12));
    return { ...d, done_ref: k >= 0 ? `${w.phase_order}.${k + 1}` : null };
  }) };
  return { lead, ws, del, gov };
}
const fullInput = dir => ({ ...rd(path.join(dir, "input.json")), method_library: METHOD.archetypes, sizing_common: METHOD.sizing_common });

const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });

// 1. n2b converted: the four answers pass each stage -> compiled plan with sizing, done items and done_refs
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const v = toV4(dir);
  const ans = chainRun(fullInput(dir));
  const a = ans("Phase Architect", { output: v.lead });
  check("v4 lead -> ws", a.route === "ws", a.route + " " + JSON.stringify(a.violations));
  check("v4 ws input carries the whole state", a.agent_input && a.agent_input.profile !== undefined && a.agent_input.sub_questions && a.agent_input.sizing_common && a.agent_input.archetype && a.agent_input.phases[0].gate.done, Object.keys(a.agent_input || {}).join(","));
  check("v4 ws input has no sizing yet", a.agent_input && a.agent_input.sizing === undefined, "");
  const b = ans("Workstream agent", { output: v.ws });
  check("v4 ws -> del", b.route === "del", b.route + " " + JSON.stringify(b.violations));
  check("v4 del input carries workstreams and sizing", b.agent_input && b.agent_input.workstreams && b.agent_input.sizing && b.agent_input.sizing.estimate_total, Object.keys(b.agent_input || {}).join(","));
  const c = ans("Deliverable agent", { output: v.del });
  check("v4 del -> gov", c.route === "gov", c.route + " " + JSON.stringify(c.violations));
  check("v4 gov input carries answers, activities, done_ref", c.agent_input && c.agent_input.workstreams[0].answers && c.agent_input.workstreams[0].activities && c.agent_input.deliverables.some(d => d.done_ref) && c.agent_input.meetings.some(m => m.done), "");
  const d = ans("Governance agent", { output: v.gov });
  check("v4 gov -> done with a plan", d.route === "done" && d.output && d.output.phases.length === v.lead.phases.length, d.route + " " + JSON.stringify(d.violations));
  check("v4 plan carries the sizing from the ws agent", d.output && d.output.sizing && d.output.sizing.phases.length && d.output.sizing.sub_questions.length >= 3 && d.output.sizing.more_time_weeks !== undefined, "");
  check("v4 plan gates carry done items", d.output && d.output.phases.every(p => p.gate.done && p.gate.done.length >= 2), "");
  check("v4 compiled has no unmet hard checks", d.valid === true, JSON.stringify(d.violations));
}

// 2. the lead's frame checks: a gate with one done item, a sub-question in no phase
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const v = toV4(dir);
  const bad = JSON.parse(JSON.stringify(v.lead));
  bad.phases[0].gate.done = ["Only one"];
  bad.sub_questions[0].phase_order = 9;
  const ans = chainRun(fullInput(dir));
  const a = ans("Phase Architect", { output: bad });
  check("v4 lead frame fails -> lead retry", a.route === "lead" && a.violations.some(x => /^frame:phase_1:done_1_items/.test(x)) && a.violations.some(x => /^frame:Q1:unknown_phase_9/.test(x)), JSON.stringify(a.violations));
}

// 3. the ws sizing checks: a piece in a stream of the wrong phase; a stream shorter than its work
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const v = toV4(dir);
  const ans = chainRun(fullInput(dir));
  ans("Phase Architect", { output: v.lead });
  const bad = JSON.parse(JSON.stringify(v.ws));
  const lastPhase = Math.max(...bad.workstreams.map(w => w.phase_order));
  const other = bad.workstreams.find(w => w.phase_order === lastPhase).id;
  bad.sizing.phase_work[0].work[0].workstream_id = other;
  const b = ans("Workstream agent", { output: bad });
  check("v4 piece in a stream of another phase -> ws retry", b.route === "ws" && b.violations.some(x => /workstream_W\d+_is_in_phase_/.test(x)), JSON.stringify(b.violations));
  const ans2 = chainRun(fullInput(dir));
  ans2("Phase Architect", { output: v.lead });
  const bad2 = JSON.parse(JSON.stringify(v.ws));
  const w0 = bad2.sizing.phase_work[0].work[0];
  const stream = bad2.workstreams.find(w => w.id === w0.workstream_id);
  stream.duration = 1; w0.weeks_each = { min: 5, max: 6 }; w0.from_library = false; w0.count = 1; w0.at_once = 1;
  bad2.sizing.phase_work[0].estimate = null;   // recomputed below
  const C = { workEstimate: e => { let mn = e.fixed_weeks || 0, mx = mn; for (const w of e.work) { const k = Math.ceil(w.count / w.at_once); mn += k * w.weeks_each.min; mx += k * w.weeks_each.max; } return { min: mn, max: mx }; } };
  bad2.sizing.phase_work[0].estimate = C.workEstimate(bad2.sizing.phase_work[0]);
  const b2 = ans2("Workstream agent", { output: bad2 });
  check("v4 stream shorter than its work -> ws retry", b2.route === "ws" && b2.violations.some(x => new RegExp(`^sizing:${stream.id}:duration_1_under_its_work_`).test(x)), JSON.stringify(b2.violations));
}

// 4. done traces: a done item with no deliverable, a done_ref that points nowhere
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const v = toV4(dir);
  const ans = chainRun(fullInput(dir));
  ans("Phase Architect", { output: v.lead });
  ans("Workstream agent", { output: v.ws });
  const bad = JSON.parse(JSON.stringify(v.del));
  const first = bad.deliverables.find(d => d.done_ref === "1.1");
  first.done_ref = "1.9";
  const c = ans("Deliverable agent", { output: bad });
  check("v4 done item without a deliverable and a bad done_ref -> del retry", c.route === "del" && c.violations.some(x => /^done:phase_1:item_1_has_no_deliverable$/.test(x)) && c.violations.some(x => /done_ref_1\.9_unknown/.test(x)), JSON.stringify(c.violations));
}

// 5. the fit note (José, Oct 24): the plan fits the time given; the work listed would take more
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const v = toV4(dir);
  const inp = fullInput(dir);
  const ans = chainRun(inp);
  ans("Phase Architect", { output: v.lead });
  const big = JSON.parse(JSON.stringify(v.ws));
  // double every piece's weeks so the estimate outruns the planned weeks
  for (const e of big.sizing.phase_work) { for (const w of e.work) { w.from_library = false; w.weeks_each = { min: w.weeks_each.min * 3, max: w.weeks_each.max * 3 }; } let mn = e.fixed_weeks || 0, mx = mn; for (const w of e.work) { const k = Math.ceil(w.count / w.at_once); mn += k * w.weeks_each.min; mx += k * w.weeks_each.max; } e.estimate = { min: mn, max: mx }; }
  for (const w of big.workstreams) w.duration = Math.max(w.duration, 1);
  const b = ans("Workstream agent", { output: big });
  const dur = b.violations.filter(x => /duration_\d+_under_its_work/.test(x));
  check("v4 big estimate: streams are checked against their work", dur.length > 0, JSON.stringify(b.violations).slice(0, 200));
  // the fit note is written by code at compile time, whatever the retry did
  ans("Workstream agent", { output: big });
  ans("Deliverable agent", { output: v.del });
  const d = ans("Governance agent", { output: v.gov });
  const note = (d.output && d.output.architect_notes || [])[0] || "";
  check("v4 fit note: plan fits, work would benefit from more weeks", /^The plan fits the \d+ weeks given; the work listed takes \d+-\d+ weeks, so we think it would benefit from \d+ more\.$/.test(note), note);
  check("v4 more_time_weeks > 0", d.output && d.output.sizing.more_time_weeks > 0, String(d.output && d.output.sizing.more_time_weeks));
}

for (const r of results) console.log((r.ok ? "ok   " : "FAIL ") + r.name + (r.ok ? "" : "  " + r.detail));
const n = results.filter(r => r.ok).length;
console.log(`${n}/${results.length} passed`);
process.exit(n === results.length ? 0 : 1);
