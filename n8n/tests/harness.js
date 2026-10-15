"use strict";
// Runs the n8n Code-node files in n8n/code/ outside n8n, with mocked $() lookups.
// Usage: node n8n/tests/harness.js  -> prints checks, writes n8n/tests/out/payload_<case>.json
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const code = f => fs.readFileSync(path.join(ROOT, "n8n", "code", f), "utf8");
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, "variables", "template_variables.json"), "utf8"));
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

// Run a Code-node body. nodes: {name: json} for $(), json: $json, input: $input.all() items
function run(file, { nodes = {}, json = {}, input = [] } = {}) {
  const $ = name => {
    if (!(name in nodes)) throw new Error(`mock: node "${name}" not provided`);
    const j = nodes[name];
    return { first: () => ({ json: j }), item: { json: j }, all: () => [{ json: j }] };
  };
  const $input = { all: () => input.map(j => ({ json: j })), item: { json } };
  const fn = new Function("$", "$json", "$input", code(file));
  return fn($, json, $input);
}

const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });

// ---------- fixtures ----------
const profileOut = { client_name: "MetalCo", problem_focus: "both", summary: "Iberian steel distributor." };
const checkProfiler = { output: profileOut, _validation: { valid: true, violations: [] } };
const briefOut = { hard_fields: { client: { value: "MetalCo SA, a steel distributor" },
  problem_statement: { value: "MetalCo asks how to launch a digital marketplace for construction materials without losing distributor margins." } } };

const offering = {
  slide: { slide_id: "market_context_offering", title: "Two Iberian distributors launched marketplaces", not_covered: [], rows: [
    { actor: "Hierros García", actor_type: "company", dimension: "direct_competitors", scope_risk: "high",
      summary: "A direct competitor already sells online in the construction-steel channel MetalCo wants to enter in Spain.",
      context: { text: "Spanish contractors moved a growing share of their steel purchasing to online channels during 2024.", refs: [1] },
      action: { text: "Hierros García launched an online marketplace for construction steel in Spain in March 2025.", refs: [2] },
      result: { text: "Hierros García reported 1,200 registered contractors on the marketplace by June 2025.", refs: [2] },
      why_it_matters_to_scope: "Adds a competitive-timing dimension." },
    { actor: "Ferro Norte", actor_type: "company", dimension: "direct_competitors", scope_risk: "medium",
      summary: "Shows that distributor resistance can stall a manufacturer's direct online channel.",
      context: { text: "Portuguese steel distributors depend on exclusive regional supply agreements.", refs: [3] },
      action: { text: "Ferro Norte paused its online pilot in 2024 after two regional distributors objected.", refs: [3] },
      result: { text: "Not yet reported", refs: [] },
      why_it_matters_to_scope: "Channel conflict risk." } ] },
  sources: [
    { ref: 1, source_name: "Instituto Nacional de Estadística", source_title: "E-commerce in construction 2024", source_url: "https://ine.es/x", source_date: "2025-02" },
    { ref: 2, source_name: "Hierros García", source_title: "Hierros García opens its online steel marketplace", source_url: "https://hg.es/news", source_date: "2025-06-30" },
    { ref: 3, source_name: "Jornal de Negócios", source_title: "Ferro Norte suspende piloto online", source_url: "https://jn.pt/y", source_date: "2024-11-12" } ],
  search_quality: "good" };
const topic = {
  slide: { slide_id: "market_context_topic", title: "B2B e-commerce keeps growing", not_covered: [], rows: [
    { actor: "Eurostat", actor_type: "statistics_office", dimension: "topic_adoption", scope_risk: "none",
      summary: "Sets the size of the online shift in the wholesale market MetalCo sells into.",
      context: { text: "EU wholesale firms have digitised ordering since 2020.", refs: [1] },
      action: { text: "Eurostat reported online B2B sales at 23% of EU wholesale turnover in 2024.", refs: [1] },
      result: { text: "Not yet reported", refs: [] }, why_it_matters_to_scope: "Context only; no effect on scope." },
    { actor: "European Commission", actor_type: "regulator", dimension: "drivers", scope_risk: "high",
      summary: "New e-invoicing rules change what a B2B marketplace must support from launch.",
      context: { text: "Member states adopted different e-invoicing formats for business-to-business trade.", refs: [1] },
      action: { text: "The European Commission adopted the ViDA package requiring B2B e-invoicing from July 2030.", refs: [2] },
      result: { text: "The Commission projects savings of 4.1 billion euros a year for EU businesses.", refs: [2] },
      why_it_matters_to_scope: "Adds a compliance requirement." },
    { actor: "Saint-Gobain", actor_type: "company", dimension: "peer_moves", scope_risk: "medium",
      summary: "A large building-materials group already runs a digital channel to small contractors.",
      context: { text: "Small contractors in France buy in small, frequent orders.", refs: [3] },
      action: { text: "Saint-Gobain extended its contractor app to 12,000 French tradespeople in 2025.", refs: [3] },
      result: { text: "Saint-Gobain reported that 18% of contractor orders came through the app in 2025.", refs: [3] },
      why_it_matters_to_scope: "Peer precedent." } ] },
  sources: [
    { ref: 1, source_name: "Eurostat", source_title: "E-commerce sales of enterprises", source_url: "https://ec.europa.eu/eurostat/z", source_date: "2025" },
    { ref: 2, source_name: "European Commission", source_title: "VAT in the Digital Age", source_url: "https://taxation.ec.europa.eu/vida", source_date: "2025-03-11" },
    { ref: 3, source_name: "Saint-Gobain", source_title: "Annual report 2025", source_url: "https://saint-gobain.com/ar", source_date: "2026-02" } ],
  search_quality: "good" };

// ---------- 1. Template rules ----------
const tr = run("template_rules.js", { nodes: { checkProfiler }, input: RULES })[0].json;
check("rules: all 49 rows kept", tr._rules.length === 49, tr._rules.length);
check("rules: 5 finding slots", tr._research.finding_slots === 5, tr._research.finding_slots);
check("rules: both researchers -> 3 rows each", tr._research.max_rows === 3, tr._research.max_rows);
check("rules: field_rules carry draft_chars 2x", tr._research.field_rules.find(f => f.field === "context").draft_chars === 180, tr._research.field_rules);
check("rules: profile passes through for the IF nodes", tr.output && tr.output.problem_focus === "both");
const trOne = run("template_rules.js", { nodes: { checkProfiler: { output: { ...profileOut, problem_focus: "offering" } } }, input: RULES })[0].json;
check("rules: one researcher -> 5 rows", trOne._research.max_rows === 5, trOne._research.max_rows);
let threw = false;
try { run("template_rules.js", { nodes: { checkProfiler }, input: [] }); } catch (e) { threw = /empty/.test(e.message); }
check("rules: empty table stops the run with a clear error", threw);

// ---------- 2. Assemble drafts ----------
const assembleMarket = { market_slides: [{ slide: offering.slide, sources: offering.sources }, { slide: topic.slide, sources: topic.sources }] };
const nodesA = { "Template rules": tr, checkProfiler, "Brief Organizer": { output: briefOut } };
const A = run("assemble_drafts.js", { nodes: nodesA, json: assembleMarket }).json;
fs.writeFileSync(path.join(OUT, "assembled.json"), JSON.stringify(A, null, 1));
const heads = A.items.filter(i => /_headline$/.test(i.variable)).map(i => i.variable);
check("assemble: 5 findings kept of 5 candidates", heads.length === 5, heads);
check("assemble: high-risk findings first", A.items.find(i => i.variable === "finding_01_action_taken").draft.startsWith("Hierros")
  && A.items.find(i => i.variable === "finding_02_action_taken").draft.startsWith("The European Commission"),
  A.items.filter(i => /action/.test(i.variable)).map(i => i.draft.slice(0, 25)));
check("assemble: 'Not yet reported' becomes no result line", !A.items.some(i => /result/.test(i.variable) && /not yet reported/i.test(i.draft)));
check("assemble: sources renumbered across both researchers", A.sources.length === 6 && A.sources[0].source_name === "Instituto Nacional de Estadística" && A.sources[2].source_name === "Eurostat", A.sources.map(s => s.ref + " " + s.source_name));
check("assemble: refs point at the merged list", JSON.stringify(A.refs.finding_02_action_taken) === "[4]", A.refs);
check("assemble: footer built without URLs", A.values.sources_market_01 && !/https?:/.test(A.values.sources_market_01), A.values.sources_market_01);
check("assemble: footer fits its limit", A.values.sources_market_01.length <= 204, A.values.sources_market_01.length);
check("assemble: fixed text and client name", A.values.cover_subtitle_01 === "A proposal for MetalCo" && A.values.section_02 === "Market Research", A.values.cover_subtitle_01);
check("assemble: copy budget leaves room for the citation", A.items.find(i => i.variable === "finding_01_context").max_chars === 90 - " [1]".length, A.items.find(i => i.variable === "finding_01_context").max_chars);
check("assemble: headlines carry no citation budget", A.items.find(i => i.variable === "finding_01_headline").max_chars === 80);
const Aempty = run("assemble_drafts.js", { nodes: nodesA, json: { market_slides: [] } }).json;
check("assemble: no research -> no items, no footer", Aempty.items.length === 0 && !Aempty.values.sources_market_01);

// A faithful copywriter: shortens wording, keeps every figure, name and place.
const FAITHFUL = {
  finding_01_headline: "A direct competitor already sells online in MetalCo's target channel in Spain.",
  finding_01_context: "Spanish contractors moved more of their steel purchasing online during 2024.",
  finding_01_action_taken: "Hierros García launched an online steel marketplace in Spain in March 2025.",
  finding_02_action_taken: "The European Commission adopted ViDA, requiring B2B e-invoicing from July 2030.",
  finding_03_headline: "Distributor resistance can stall a manufacturer's direct online channel.",
  finding_04_headline: "A building-materials group already runs a digital channel to small contractors.",
};
// ---------- 3. Copywriter answers: good, too long, dropped figure, missing ----------
const fit = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, ""));
const first = { output: { items: A.items.map(it => {
  if (it.variable === "finding_01_result_achieved") return { variable: it.variable, text: "Hierros García reported many registered contractors by June 2025." }; // dropped 1,200
  if (it.variable === "finding_03_context") return { variable: it.variable, text: it.draft + " and this sentence keeps going far past the limit of the box." }; // too long
  if (it.variable === "finding_04_headline") return null; // missing
  return { variable: it.variable, text: (FAITHFUL[it.variable] || it.draft) + (it.variable === "finding_02_context" ? " [7]" : "") }; // stray citation stripped
}).filter(Boolean) } };
const C1 = run("check_copy.js", { nodes: { "Assemble drafts": A }, json: first }).json;
check("check: good answers accepted", Object.keys(C1.final).length === A.items.length - 3, Object.keys(C1.final).length);
check("check: dropped figure caught", C1.failed.some(f => f.variable === "finding_01_result_achieved" && f.problems.some(p => /1,200/.test(p))), C1.failed.map(f => f.variable + ": " + f.problems.join("|")));
check("check: too long caught", C1.failed.some(f => f.variable === "finding_03_context" && /too long/.test(f.problems[0])));
check("check: missing caught", C1.failed.some(f => f.variable === "finding_04_headline" && f.problems[0] === "missing"));
check("check: stray citation stripped", !/\[7\]/.test(C1.final.finding_02_context || ""), C1.final.finding_02_context);

// ---------- 4. Retry: fixes one, still too long one, fails one ----------
const retry = { output: { items: [
  { variable: "finding_01_result_achieved", text: "Hierros García reported 1,200 registered contractors by June 2025." },
  { variable: "finding_03_context", text: C1.failed.find(f => f.variable === "finding_03_context").first_try },
] } };
const C2 = run("check_retry.js", { nodes: { "Check copy": C1 }, json: retry }).json;
check("retry: fixed answer accepted", C2.final.finding_01_result_achieved.includes("1,200"));
check("retry: still too long kept, with warning", C2.final.finding_03_context && C2.warnings.some(w => /finding_03_context.*too long/.test(w)));
const d4 = A.items.find(i => i.variable === "finding_04_headline");
check("retry: missing twice falls back to the draft, cut to fit", C2.final.finding_04_headline.length <= d4.max_chars && d4.draft.startsWith(C2.final.finding_04_headline.replace(/\u2026$/, "")), C2.final.finding_04_headline);
check("retry: every item has final text", A.items.every(i => C2.final[i.variable]), A.items.filter(i => !C2.final[i.variable]).map(i => i.variable));

// ---------- 5. Payload ----------
const P = run("build_render_payload.js", { nodes: { "Assemble drafts": A, "Template rules": tr }, json: C2 }).json;
check("payload: citations added back", /\[2\]$/.test(P.values.finding_01_action_taken), P.values.finding_01_action_taken);
check("payload: headline has no citation", !/\[\d/.test(P.values.finding_01_headline));
check("payload: rules slimmed to 3 fields", Object.keys(P.rules[0]).join() === "variable,max_chars,if_empty");
check("payload: filename from client", P.meta.filename === "MetalCo_proposal_draft.pptx", P.meta.filename);
fs.writeFileSync(path.join(OUT, "payload_both.json"), JSON.stringify(P, null, 1));

// ---------- 6. Copywriter unavailable (the live failure of Oct 15: "Payment required") ----------
const down = { error: "Payment required - perhaps check your payment details?" };
const D1 = run("check_copy.js", { nodes: { "Assemble drafts": A }, json: down }).json;
check("api error: every item marked failed with the cause", D1.failed.length === A.items.length && D1.failed.every(f => /unavailable: Payment required/.test(f.problems[0])), D1.failed[0] && D1.failed[0].problems);
const D2 = run("check_retry.js", { nodes: { "Check copy": D1 }, json: down }).json;
const PD = run("build_render_payload.js", { nodes: { "Assemble drafts": A, "Template rules": tr }, json: D2 }).json;
const maxOf = v => tr._rules.find(r => r.variable === v).max_chars;
const over = Object.entries(PD.values).filter(([v, t]) => maxOf(v) && t.length > maxOf(v));
check("api error: every line fits its box before the renderer", over.length === 0, over.map(([v, t]) => v + " " + t.length));
const lostRef = Object.entries(A.refs).filter(([v, r]) => r.length && !/\[\d+(, \d+)*\]$/.test(PD.values[v]));
check("api error: no line loses its citation", lostRef.length === 0, lostRef.map(([v]) => v));
check("api error: the run log names the cause", PD.warnings.some(w => /Payment required/.test(w)), PD.warnings);
fs.writeFileSync(path.join(OUT, "payload_copywriter_down.json"), JSON.stringify(PD, null, 1));

// Clean path (no retry) for the render test
const clean = { output: { items: A.items.map(it => ({ variable: it.variable, text: FAITHFUL[it.variable] || it.draft })) } };
const C1c = run("check_copy.js", { nodes: { "Assemble drafts": A }, json: clean }).json;
check("clean copy: nothing to retry", C1c.failed.length === 0, C1c.failed.map(f => f.variable + ": " + f.problems));
const Pc = run("build_render_payload.js", { nodes: { "Assemble drafts": A, "Template rules": tr }, json: C1c }).json;
fs.writeFileSync(path.join(OUT, "payload_clean.json"), JSON.stringify(Pc, null, 1));
const Pe = run("build_render_payload.js", { nodes: { "Assemble drafts": Aempty, "Template rules": tr }, json: { final: {} } }).json;
fs.writeFileSync(path.join(OUT, "payload_empty.json"), JSON.stringify(Pe, null, 1));

const failed = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.ok ? "" : "  -> " + JSON.stringify(r.detail))));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
