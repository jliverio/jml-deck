"use strict";
// Replays the four-agent chain through n8n/code/chain_check.js outside n8n, with mocked node lookups:
// every agent node keeps its runs, so $(name).first() is the latest run and $(name).all(0, k) throws for a run
// that did not happen, as in n8n. Answers come from the Oct 19 test runs in phase_architect/runs/.
// Usage: node n8n/tests/chain_test.js
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const CODE = fs.readFileSync(path.join(ROOT, "n8n", "code", "chain_check.js"), "utf8");
const RUNS = path.join(ROOT, "phase_architect", "runs", "oct19_checks_formats");
const rd = f => JSON.parse(fs.readFileSync(f, "utf8"));
const JARGON = ['leverage', 'synergy', 'best practice', 'best-in-class', 'value-add', 'holistic', 'end-to-end', 'hit the ground running', 'world-class', 'proven', 'tried-and-tested', 'mission-critical', 'north star', 'step change', 'deep dive', 'learnings', 'unlock', 'drive (for outcomes)', 'robust', 'actionable', 'scalable', 'transformation', 'transform', 'passionate', 'MVP', 'compare notes'];
const METHOD = rd(path.join(ROOT, "phase_architect", "method_library.json"));

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
  // an agent answers: record its run, then run Chain check on it
  return function answer(agent, json) {
    (runs[agent] = runs[agent] || []).push([json]);
    const prev = { name: agent, runIndex: runs[agent].length - 1, outputIndex: 0 };
    const fn = new Function("$", "$json", "$prevNode", CODE);
    return fn($, json, prev).json;
  };
}

const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });
const fullInput = dir => ({ ...rd(path.join(dir, "input.json")), method_library: METHOD.archetypes, sizing_common: METHOD.sizing_common });

// 1. fmt/n2b: four answers, each passes first time -> ws, del, gov, done with a compiled plan carrying formats
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const ans = chainRun(fullInput(dir));
  const a = ans("Phase Architect", { output: rd(path.join(dir, "lead.json")) });
  check("n2b lead -> ws", a.route === "ws" && a.agent_input && a.agent_input.sub_questions, a.route + " " + JSON.stringify(a.violations));
  const b = ans("Workstream agent", { output: rd(path.join(dir, "ws.json")) });
  check("n2b ws -> del", b.route === "del" && b.agent_input && b.agent_input.workstreams, b.route + " " + JSON.stringify(b.violations));
  const c = ans("Deliverable agent", { output: rd(path.join(dir, "del.json")) });
  check("n2b del -> gov", c.route === "gov" && c.agent_input && c.agent_input.deliverables, c.route + " " + JSON.stringify(c.violations));
  check("n2b gov input shows formats", c.agent_input.deliverables.every(d => d.format), "");
  const d = ans("Governance agent", { output: rd(path.join(dir, "gov.json")) });
  check("n2b gov -> done with a plan", d.route === "done" && d.output && d.output.phases.length === 2, d.route);
  check("n2b plan carries formats", d.output && d.output.deliverables.every(x => x.format) && d.output.deliverables.some(x => x.format === "training"), "");
  check("n2b plan carries sizing", d.output && d.output.sizing, "");
  check("n2b compiled has no unmet hard checks", d.valid === true, JSON.stringify(d.violations));
  fs.writeFileSync(path.join(__dirname, "out", "chain_n2b_done.json"), JSON.stringify(d, null, 1));
}

// 2. chk/n1b: the workstream agent fails a check, retries, then the chain goes on
{
  const dir = path.join(RUNS, "chk", "n1b");
  const ans = chainRun(fullInput(dir));
  ans("Phase Architect", { output: rd(path.join(dir, "lead.json")) });
  const first = rd(path.join(dir, "ws_violations.json"));
  // the first workstream answer is not kept in the runs folder: rebuild a failing one by breaking the retry answer
  const wsr = rd(path.join(dir, "ws_r.json"));
  const broken = JSON.parse(JSON.stringify(wsr));
  broken.workstreams[0].phase_order = 9;
  const b1 = ans("Workstream agent", { output: broken });
  check("n1b ws fails -> ws retry", b1.route === "ws" && b1.pass === 0 && b1.agent_input.previous_output && b1.agent_input.violations.length, JSON.stringify(b1.violations).slice(0, 200));
  check("n1b retry input keeps the stage input", b1.agent_input.phases && b1.agent_input.meetings, "");
  const b2 = ans("Workstream agent", { output: wsr });
  check("n1b ws retry -> del, pass 1", b2.route === "del" && b2.pass === 1, b2.route + " pass " + b2.pass + " " + JSON.stringify(b2.violations));
  void first;
}

// 3. a retry that still fails goes on anyway (pass 1)
{
  const dir = path.join(RUNS, "chk", "n1a");
  const ans = chainRun(fullInput(dir));
  const lead = rd(path.join(dir, "lead.json"));
  const bad = JSON.parse(JSON.stringify(lead)); bad.phases = bad.phases.concat(bad.phases, bad.phases);   // 6+ phases
  const a1 = ans("Phase Architect", { output: bad });
  check("bad lead -> lead retry", a1.route === "lead" && a1.agent_input.method_library, a1.route);
  const a2 = ans("Phase Architect", { output: bad });
  check("bad lead again -> goes on to ws", a2.route === "ws" && a2.pass === 1 && a2.violations.length, a2.route + " " + a2.pass);
}

// 4. agent errors: retry once, then stop with no plan
{
  const dir = path.join(RUNS, "chk", "n1a");
  const ans = chainRun(fullInput(dir));
  const e1 = ans("Phase Architect", { error: { message: "Payment required" } });
  check("lead error -> lead retry", e1.route === "lead" && e1.violations[0].startsWith("agent_error"), e1.route);
  const e2 = ans("Phase Architect", { error: { message: "Payment required" } });
  check("lead error twice -> done, no plan", e2.route === "done" && e2.output === null && /Phase Architect/.test(e2.agent_error), e2.route + " " + e2.agent_error);
}

// 5. B (brief states 'a written report and a board presentation'): deliverables pass the format checks
{
  const dir = path.join(RUNS, "fmt", "B");
  const ans = chainRun(fullInput(dir));
  ans("Phase Architect", { output: rd(path.join(dir, "lead.json")) });
  const b = ans("Workstream agent", { output: rd(path.join(dir, "ws.json")) });
  const c = ans("Deliverable agent", { output: rd(path.join(dir, "del.json")) });
  check("B ws -> del", b.route === "del", JSON.stringify(b.violations));
  check("B del -> gov (formats ok)", c.route === "gov", JSON.stringify(c.violations));
  const bad = rd(path.join(dir, "del.json")); bad.deliverables.forEach(d => { if (d.format === "report") d.format = "presentation"; });
  const ans2 = chainRun(fullInput(dir));
  ans2("Phase Architect", { output: rd(path.join(dir, "lead.json")) });
  ans2("Workstream agent", { output: rd(path.join(dir, "ws.json")) });
  const c2 = ans2("Deliverable agent", { output: bad });
  check("B without a report -> del retry", c2.route === "del" && c2.violations.some(v => /brief_asks_for_report/.test(v)), JSON.stringify(c2.violations));
}

// 6. the Phase Architect answers as text (no parser since Oct 21): a JSON string inside {output}, a code fence,
//    an {"output": "<string>"} wrapper (live runs 830, 831, 872), or broken JSON
{
  const dir = path.join(RUNS, "fmt", "n2b");
  const lead = rd(path.join(dir, "lead.json"));
  const forms = {
    "plain string": JSON.stringify(lead),
    "code fence": "```json\n" + JSON.stringify(lead) + "\n```",
    "output-wrapped string": JSON.stringify({ output: JSON.stringify(lead) }),
    "output-wrapped object": JSON.stringify({ output: lead }),
  };
  for (const [name, text] of Object.entries(forms)) {
    const a = chainRun(fullInput(dir))("Phase Architect", { output: text });
    check(`lead as ${name} -> ws`, a.route === "ws" && a.agent_input && a.agent_input.sub_questions, a.route + " " + JSON.stringify(a.violations));
  }
  // streamed (runs 930, 931): n8n joins the chunks with a newline, inside keys, strings and numbers
  for (const size of [7, 20, 23]) {
    const flat = JSON.stringify(lead), parts = [];
    for (let i = 0; i < flat.length; i += size) parts.push(flat.slice(i, i + size));
    const a = chainRun(fullInput(dir))("Phase Architect", { output: parts.join("\n") });
    check(`lead streamed in ${size}-char chunks -> ws`, a.route === "ws" && a.agent_input && a.agent_input.sub_questions, a.route + " " + JSON.stringify(a.violations));
    if (size === 20) {
      const st = chainRun(fullInput(dir));
      st("Phase Architect", { output: parts.join("\n") });
      const c = st("Workstream agent", { output: rd(path.join(dir, "ws.json")) });
      check("ws reads the streamed lead -> del", c.route === "del", JSON.stringify(c.violations));
    }
  }
  const ans = chainRun(fullInput(dir));
  const b1 = ans("Phase Architect", { output: '{"basis": {"governing_question": "x"' });
  check("broken JSON -> lead retry with a format violation", b1.route === "lead" && /^agent_error: format:/.test(b1.violations[0]), JSON.stringify(b1.violations));
  const b2 = ans("Phase Architect", { output: JSON.stringify(lead) });
  check("then a good answer -> ws", b2.route === "ws" && b2.pass === 1, b2.route);
  // the next stages read the lead's parsed answer back from the node (string in its run data)
  const c = ans("Workstream agent", { output: rd(path.join(dir, "ws.json")) });
  check("ws reads the parsed lead -> del", c.route === "del", JSON.stringify(c.violations));
}

const bad = results.filter(r => !r.ok);
results.forEach(r => console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : "  " + r.detail}`));
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
