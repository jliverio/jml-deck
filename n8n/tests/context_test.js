"use strict";
// Template 1.4 (Scenario 1) checks for Prepare context -> Context Writer (replayed answer) -> Check context
// -> Assemble drafts, outside n8n with mocked $() lookups.
// Usage: node n8n/tests/context_test.js <nodes.json> <plan.json> [writer_answer.json]
//   nodes.json   {Config, "Brief Organizer", checkProfiler, "Assemble market"} node outputs from a real run
//   plan.json    a compiled plan (Validate plan output, or a render payload's `workplan`)
//   writer.json  the Context Writer's answer to replay ({output: {...}} or {error: ...}); default: none
// Writes n8n/tests/out/ctx_<name>.json: the Assemble drafts output, and prints the checks.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const code = f => fs.readFileSync(path.join(ROOT, "n8n", "code", f), "utf8");
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, "variables", "template_variables.json"), "utf8"));

function run(file, { nodes = {}, json = {} } = {}) {
  const $ = name => {
    if (!(name in nodes)) throw new Error(`mock: node "${name}" not provided`);
    const j = nodes[name];
    return { first: () => ({ json: j }), item: { json: j }, all: () => [{ json: j }] };
  };
  const fn = new Function("$", "$json", "$input", "$runIndex", code(file));
  const out = fn($, json, { all: () => [{ json }], item: { json } }, 0);
  return Array.isArray(out) ? out[0].json : out.json;
}

const [nodesFile, planFile, writerFile, name = "case"] = process.argv.slice(2);
const nodes = JSON.parse(fs.readFileSync(nodesFile, "utf8"));
const planRaw = JSON.parse(fs.readFileSync(planFile, "utf8"));
const plan = planRaw.workplan || planRaw.output || planRaw;
const writer = writerFile && writerFile !== "-" ? JSON.parse(fs.readFileSync(writerFile, "utf8")) : { error: "not run" };
const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

nodes["Template rules"] = { _rules: RULES };
const prep = run("prepare_context.js", { nodes, json: nodes["Assemble market"] });
nodes["Prepare context"] = prep;
check("prepare: passes Assemble market through", prep.market_slides && prep.market_findings);
check("prepare: findings listed", Array.isArray(prep.context_input.findings));
const ctx = run("check_context.js", { nodes, json: writer });
nodes["Check context"] = ctx;
check("check: passes Assemble market through", ctx.market_slides && !ctx.context_input);
const drafts = run("assemble_drafts.js", { nodes, json: { output: plan } });
const items = Object.fromEntries(drafts.items.map(i => [i.variable, i]));
check("template 1.4", drafts.template === "1.4");
check("sections renamed", drafts.values.section_01 === "Executive Summary" && drafts.values.section_02 === "Context" && drafts.values.section_04 === "Approach");
check("no key question or criteria drafted (slide removed Oct 18)",
  !Object.keys(items).some(v => /^(key_question|criterion|criteria_basis)_/.test(v)) && !("criteria_basis_01" in drafts.values));
check("check: no criteria in the result", !("criteria" in ctx.context_result) && !("criteria_basis" in ctx.context_result));
check("prepare: no stated_criteria sent to the writer", !("stated_criteria" in prep.context_input) && !("criterion" in prep.context_input.limits));
fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "out", `ctx_${name}.json`), JSON.stringify({ prepare: prep.context_input, check: ctx.context_result, drafts }, null, 1));
for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + r.n + (r.ok || !r.d ? "" : "  " + JSON.stringify(r.d)));
console.log("situation:", JSON.stringify(ctx.context_result.situation_title), ctx.context_result.situation.length, "lines");
console.log("warnings:", JSON.stringify(ctx.context_result.warnings));
process.exitCode = results.every(r => r.ok) ? 0 : 1;
