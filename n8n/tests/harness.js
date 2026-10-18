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
function run(file, { nodes = {}, json = {}, input = [], runIndex = 0 } = {}) {
  const $ = name => {
    if (!(name in nodes)) throw new Error(`mock: node "${name}" not provided`);
    const j = nodes[name];
    return { first: () => ({ json: j }), item: { json: j }, all: () => [{ json: j }] };
  };
  const $input = { all: () => input.map(j => ({ json: j })), item: { json } };
  const fn = new Function("$", "$json", "$input", "$runIndex", code(file));
  return fn($, json, $input, runIndex);
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
check("rules: all 55 rows kept (50 + 5 for template 1.4's situation slide)", tr._rules.length === RULES.length && RULES.length === 55, tr._rules.length);
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
const nodesA = { "Template rules": tr, checkProfiler, "Brief Organizer": { output: briefOut }, "Assemble market": assembleMarket };
const A = run("assemble_drafts.js", { nodes: nodesA, json: {} }).json;
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
check("assemble: fixed text and client name; 1.4 section names", A.values.cover_subtitle_01 === "A proposal for MetalCo" && A.values.section_01 === "Executive Summary" && A.values.section_02 === "Context", [A.values.cover_subtitle_01, A.values.section_01, A.values.section_02]);
check("assemble: copy budget leaves room for the citation", A.items.find(i => i.variable === "finding_01_context").max_chars === 90 - " [1]".length, A.items.find(i => i.variable === "finding_01_context").max_chars);
check("assemble: headlines carry no citation budget", A.items.find(i => i.variable === "finding_01_headline").max_chars === 80);
const Aempty = run("assemble_drafts.js", { nodes: { ...nodesA, "Assemble market": { market_slides: [] } }, json: {} }).json;
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

{ // Phase Architect block (scoped so its names do not clash with the Summary Writer block)
// ---------- 5. Phase Architect v2: input, validation, Context slide, payload ----------
const PA = path.join(ROOT, "phase_architect");
const jl = f => JSON.parse(fs.readFileSync(path.join(PA, f), "utf8"));
const briefB = jl("tests/scenario_B_brief.json");
const cfg = { today: "2026-10-16", jargon_never: ["leverage", "deep dive", "MVP", "transformation", "best practice", "end-to-end"] };
const nodesP = { "Brief Organizer": { output: briefB }, checkProfiler: { output: { problem_focus: "topic", topic: "claims operating model", market: "Non-life insurance, Portugal" } }, Config: cfg };
const AI = run("architect_input.js", { nodes: nodesP, json: { market_findings: [{ actor: "ASF", summary: "New guidance", scope_risk: "high", dimension: "constraints", why_it_matters_to_scope: "x" }] } }).json;
const ai = AI.architect_input;
check("architect input: weeks available to the Board date (Mar 15, 2027, minus 2 to start)", ai.weeks_available === 19, ai.weeks_available);
check("architect input: success criteria split into items", ai.success_criteria_list.length === 2, ai.success_criteria_list);
check("architect input: method library embedded", Array.isArray(ai.method_library) && ai.method_library.length === 5);
check("architect input: findings trimmed to actor/summary/scope_risk", Object.keys(ai.market_findings[0]).join() === "actor,summary,scope_risk");
check("architect input: market output passed through", Array.isArray(AI.market_findings));
const nodesV = { "Architect input": AI, Config: cfg };
const VB = run("validate_plan.js", { nodes: nodesV, json: { output: jl("runs/r5_B.json") } }).json;
check("validate: tested plan B passes", VB.valid && VB.retry_input === null, VB.violations);
const VBad = run("validate_plan.js", { nodes: nodesV, json: { output: jl("runs/r2_B2.json") } }).json;
check("validate: plan over the deadline fails and carries a retry input", !VBad.valid && VBad.violations.some(v => /weeks_available/.test(v)) && VBad.retry_input.previous_output && VBad.retry_input.violations.length === VBad.violations.length, VBad.violations);
// Oct 16 token work: never_presented is repaired by code; long partner notes warn instead of forcing a retry.
{
  const raw = jl("runs/r5_B.json");
  const drop = JSON.parse(JSON.stringify(raw));
  (drop.governance.events || []).forEach(e => { if (e.type === "gate" || e.type === "workshop") e.presents = (e.presents || []).slice(0, 1); });
  drop.architect_notes = [...(drop.architect_notes || []).slice(0, 5), "This note is deliberately written to run well past the twenty-five word limit so that the validator reports it as a warning and does not ask for a retry at all."];
  const VR = run("validate_plan.js", { nodes: nodesV, json: { output: drop } }).json;
  check("plan: unpresented deliverables are placed at their phase gate by code", !VR.violations.some(x => /never_presented/.test(x)) && VR.repairs.some(x => /presented at/.test(x)), [VR.violations, VR.repairs.filter(x => /presented/.test(x))]);
  check("plan: an over-long partner note is a warning, not a retry", VR.warnings.some(x => /^note_\d+:over_25_words$/.test(x)) && !VR.violations.some(x => /^note_/.test(x)), [VR.violations, VR.warnings]);
}
const VErr = run("validate_plan.js", { nodes: nodesV, json: { error: { message: "Payment required" } } }).json;
check("validate: agent error -> invalid, named, no phases", !VErr.valid && /Payment required/.test(VErr.agent_error) && VErr.output.phases.length === 0, VErr.violations.slice(0, 2));
const trPending = { ...tr, _rules: tr._rules.map(r => /^summary_writer:(solution|outcomes)/.test(r.fills_from || "") ? { ...r, fills_from: "pending:phase_architect" } : r) };
const APpending = run("assemble_drafts.js", { nodes: { ...nodesA, "Template rules": trPending }, json: VB }).json;
check("context slide: rows still pending in the table are not drafted", !APpending.items.some(i => /^(solution|outcome)_/.test(i.variable)) && APpending.workplan);
check("context slide: pending rows named in the run log", APpending.warnings.some(w => /still marked pending:phase_architect/.test(w)), APpending.warnings);
// Same run with the table rows switched on (fills_from phase_architect:plan), as after the template gets the variables.
const trOn = { ...tr, _rules: tr._rules.map(r => /^summary_writer:(solution|outcomes)/.test(r.fills_from || "") ? { ...r, fills_from: "phase_architect:plan" } : r) };
const AP = run("assemble_drafts.js", { nodes: { ...nodesA, "Template rules": trOn }, json: VB }).json;
const sol = AP.items.filter(i => /^solution_/.test(i.variable));
const out = AP.items.filter(i => /^outcome_/.test(i.variable));
check("context slide: 5 solution lines and 4 outcome lines drafted", sol.length === 5 && out.length === 4, AP.items.filter(i => /^(solution|outcome)_/.test(i.variable)).map(i => i.variable + ": " + i.draft));
check("context slide: phase names and weeks come from the plan", VB.output.phases.every(p => sol.some(i => i.draft.startsWith(p.name + " ("))), sol.map(i => i.draft));
check("context slide: outcomes are plan deliverables", out.every(i => VB.output.deliverables.some(d => i.draft.startsWith(d.name))), out.map(i => i.draft));
check("assemble: workplan carried with the client name", AP.workplan && AP.workplan.client === "MetalCo" && AP.workplan.phases.length === 2);
const trSW = tr; // the seed table gives slide 4 to the Summary Writer
const APsw = run("assemble_drafts.js", { nodes: { ...nodesA, "Template rules": trSW }, json: VB }).json;
check("context slide owned by the Summary Writer: no approach drafts, no warning", !APsw.items.some(i => /^(solution|outcome)_/.test(i.variable)) && !APsw.warnings.some(w => /solution\/outcome|pending/.test(w)), APsw.warnings);
const APx = run("assemble_drafts.js", { nodes: nodesA, json: VErr }).json;
check("assemble: no plan -> no approach drafts, no workplan, a warning naming the agent error", !APx.items.some(i => /^(solution|outcome)_/.test(i.variable)) && APx.workplan === null && APx.warnings.some(w => /No phase plan.*Payment required/.test(w)) && !APx.warnings.some(w => /plan kept/.test(w)), APx.warnings);
const cleanP = { output: { items: AP.items.map(it => ({ variable: it.variable, text: it.draft.length <= (it.max_chars || 1e9) ? it.draft : it.draft.slice(0, it.max_chars) })) } };
const CP = run("check_copy.js", { nodes: { "Assemble drafts": AP }, json: cleanP }).json;
const PP = run("build_render_payload.js", { nodes: { "Assemble drafts": AP, "Template rules": trOn }, json: CP }).json;
fs.writeFileSync(path.join(OUT, "payload_workplan.json"), JSON.stringify(PP, null, 1));
check("payload: workplan sent to the renderer", PP.workplan && PP.workplan.deliverables.length > 0);
check("payload: template 1.4 requested and Approach section named", PP.template === "1.4" && PP.values.section_04 === "Approach", [PP.template, PP.values.section_04]);
}
// ---------- Summary Writer chain (slide 4) ----------
const FX = f => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"));
const brief06 = FX("doc06_brief.json"), plan06 = FX("doc06_plan.json");
const good = FX("summary_out_doc06.json"), goodNoPlan = FX("summary_out_noplan.json");
const cfgS = { jargon_never: ["leverage", "learnings", "MVP", "proven", "scalable"] };
const passIn = { final: { finding_01_headline: "x" }, failed: [], attempt: 1, warnings: ["copy note"] };
const baseNodes = { "Brief Organizer": { output: brief06 }, "Config": cfgS, "Template rules": tr };

const PS0 = run("prepare_summary.js", { nodes: baseNodes, json: passIn }).json;
check("summary prep: no plan while the Architect does not run", PS0.summary_input.plan === null);
check("summary prep: limits from the table", JSON.stringify(PS0.summary_input.limits) === JSON.stringify({ title_max_chars: 90,
  objectives: { min: 2, max: 4, item_max_chars: 127 }, solution: { min: 2, max: 5, item_max_chars: 95 }, outcomes: { min: 2, max: 4, item_max_chars: 127 } }), PS0.summary_input.limits);
check("summary prep: copy results carried through", PS0.pass.final.finding_01_headline === "x");
const PS1 = run("prepare_summary.js", { nodes: { ...baseNodes, "Validate plan": { output: plan06 } }, json: passIn }).json;
check("summary prep: plan read from Validate plan", PS1.summary_input.plan && PS1.summary_input.plan.phases.length === 2);
check("summary prep: only the scope note reaches the slide", JSON.stringify(PS1.summary_input.plan.scope_notes) === JSON.stringify(["The rollout after the pilot is not in these phases."]), PS1.summary_input.plan.scope_notes);

const planV2 = FX("doc06_plan_v2.json");
const PSv2 = run("prepare_summary.js", { nodes: { ...baseNodes, "Assemble drafts": { workplan: planV2 } }, json: passIn }).json;
check("summary prep: Phase Architect v2 plan read from Assemble drafts.workplan", PSv2.summary_input.plan && PSv2.summary_input.plan.phases.length === planV2.phases.length);
check("summary prep: v2 deliverables grouped under their phase", PSv2.summary_input.plan.phases[0].macro_deliverables[0] === planV2.deliverables.filter(d => d.phase_order === 1).sort((a, b) => a.due_week - b.due_week)[0].name, PSv2.summary_input.plan.phases[0].macro_deliverables);
const CS1 = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: good } }).json;
check("summary check: real model output passes", CS1.ok && CS1.attempt === 1, CS1.violations);
const bad = JSON.parse(JSON.stringify(good));
bad.solution[0].text = "We will run a 24-week project using our proven methodology and experienced team.";
bad.objectives[0].text = "[Client] wants a new business model centered on a digital marketplace.";
bad.outcomes[0].text = "A de-risked marketplace ready for wider roll-out";
const CS2 = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: bad } }).json;
check("summary check: firm claim, subject and promise caught", !CS2.ok && ["firm_claim", "objective_frame", "promise"].every(r => CS2.violations.some(v => v.rule === r)), CS2.violations.map(v => v.rule));
check("summary check: retry message in plain words", /claim about the firm/.test(CS2.retry_message), CS2.retry_message);
const CS3 = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { error: { message: "Your Gateway credits have been depleted" } } }).json;
check("summary check: model error goes to the retry path", !CS3.ok && /credits/.test(CS3.model_error));
const CS2b = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: good }, runIndex: 1 }).json;
check("summary check: second run is marked attempt 2", CS2b.ok && CS2b.attempt === 2, CS2b.attempt);

const FS1 = run("final_summary.js", { nodes: { "Prepare summary": PS1 }, json: CS1 }).json;
check("summary final: first answer used", FS1.summary_source === "first" && FS1.summary_values.summary_title_01 === good.title);
check("summary final: copy results and warnings kept", FS1.final.finding_01_headline === "x" && FS1.warnings[0] === "copy note");
check("summary final: 14 slide-4 variables", Object.keys(FS1.summary_values).length === 14, Object.keys(FS1.summary_values));
check("summary final: unused lines sent empty", FS1.summary_values.solution_05 === "", FS1.summary_values.solution_05);
const FS2 = run("final_summary.js", { nodes: { "Prepare summary": PS1 }, json: CS2b }).json;
check("summary final: a good retry is used", FS2.summary_source === "retry");
const CS2c = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: bad }, runIndex: 1 }).json;
const FS3 = run("final_summary.js", { nodes: { "Prepare summary": PS1 }, json: CS2c }).json;
check("summary final: failed twice -> failing parts built by code, with a warning", FS3.summary_source === "partial" && FS3.warnings.some(w => /failed twice.*built by code: objectives, solution, outcomes/.test(w)), [FS3.summary_source, FS3.warnings]);
check("summary final: a part that passed is kept (title)", FS3.summary_values.summary_title_01 === bad.title, FS3.summary_values.summary_title_01);
check("summary final: fallback objectives are the client's conditions", /^Develop and scale the marketplace/.test(FS3.summary_values.objective_01), FS3.summary_values.objective_01);
check("summary final: fallback solution names the phases with weeks", FS3.summary_values.solution_02 === "Design (6 weeks)" && FS3.summary_values.solution_03 === "Pilot (18 weeks)", [FS3.summary_values.solution_02, FS3.summary_values.solution_03]);
const fbLines = Object.entries(FS3.summary_values).filter(([k, v]) => v && v.length > (/^solution/.test(k) ? 95 : /^summary/.test(k) ? 90 : 127));
check("summary final: every fallback line fits its box", !fbLines.length, fbLines);
// Live run 26 (Oct 16): the retry failed only because one Solution line was 96 characters (limit 95).
const long = JSON.parse(JSON.stringify(good));
long.solution[1].text = long.solution[1].text.replace(/\.$/, '') + ' ' + 'x'.repeat(Math.max(1, 96 - long.solution[1].text.length));
long.solution[1].text = long.solution[1].text.slice(0, 95) + '.';
const CS26 = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: long }, runIndex: 1 }).json;
const FS26 = run("final_summary.js", { nodes: { "Prepare summary": PS1 }, json: CS26 }).json;
check("summary final: only Solution over its limit -> only Solution built by code", !CS26.ok && FS26.summary_source === "partial" && FS26.summary_values.objective_01 === good.objectives[0].text && FS26.summary_values.outcome_01 === good.outcomes[0].text && FS26.summary_values.solution_02 === "Design (6 weeks)", [CS26.violations, FS26.summary_values]);
check("summary prep: the model sees limits 4 characters under the boxes", PS1.model_input.limits.solution.item_max_chars === 91 && PS1.model_input.limits.title_max_chars === 86 && PS1.summary_input.limits.solution.item_max_chars === 95, PS1.model_input.limits);
const lose = JSON.parse(JSON.stringify(good));
const scIdx = lose.objectives.findIndex(o => o.source === "success_criteria");
lose.objectives[scIdx].text = lose.objectives[scIdx].text.replace(/\.$/, '') + " without losing speed.";
const CSlose = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: lose } }).json;
check("summary check: 'losing' matches the client's 'losing'/'loss' (no false not_in_source)", !CSlose.violations.some(v => v.rule === "not_in_source"), CSlose.violations);
// Live run 75 (Oct 16): "go/no-go" copied from a deliverable was flagged as shorthand.
const PSgo = JSON.parse(JSON.stringify(PS1));
PSgo.summary_input.plan.phases[1].macro_deliverables[0] = "Pilot plan with go/no-go criteria";
const goOut = JSON.parse(JSON.stringify(good));
goOut.outcomes[0] = { text: "Pilot plan with go/no-go criteria", from: [{ phase_order: 2, deliverable: 1 }] };
const CSgo = run("check_summary.js", { nodes: { "Prepare summary": PSgo }, json: { output: goOut } }).json;
check("summary check: shorthand copied from the plan is allowed", !CSgo.violations.some(v => v.rule === "shorthand"), CSgo.violations);
const goNew = JSON.parse(JSON.stringify(good));
goNew.outcomes[0].text = goNew.outcomes[0].text + " and KPI/target sheet";
const CSgo2 = run("check_summary.js", { nodes: { "Prepare summary": PS1 }, json: { output: goNew } }).json;
check("summary check: new shorthand still caught", CSgo2.violations.some(v => v.rule === "shorthand"), CSgo2.violations);
const CS4 = run("check_summary.js", { nodes: { "Prepare summary": PS0 }, json: { error: { message: "credits" } }, runIndex: 1 }).json;
const FS4 = run("final_summary.js", { nodes: { "Prepare summary": PS0 }, json: CS4 }).json;
check("summary final: model down, no plan -> placeholders in Solution and Outcomes", FS4.summary_values.solution_01.startsWith("[Firm to complete]") && FS4.summary_values.outcome_01.startsWith("[Firm to complete]") && FS4.summary_values.solution_02 === "" && FS4.warnings.some(w => /unavailable/.test(w)));
const PS5 = run("prepare_summary.js", { nodes: baseNodes, json: passIn }).json;
const CS5 = run("check_summary.js", { nodes: { "Prepare summary": PS5 }, json: { output: goodNoPlan } }).json;
check("summary check: no-plan model output passes", CS5.ok, CS5.violations);
const FS5 = run("final_summary.js", { nodes: { "Prepare summary": PS5 }, json: CS5 }).json;
const PP = run("build_render_payload.js", { nodes: { "Assemble drafts": A, "Template rules": tr }, json: FS1 }).json;
check("payload: slide 4 values merged", PP.values.summary_title_01 === good.title && PP.values.objective_04 === good.objectives[3].text && PP.values.finding_01_headline !== undefined);
check("payload: slide 4 values carry no citation", !/\[\d/.test(PP.values.objective_01));
const PP5 = run("build_render_payload.js", { nodes: { "Assemble drafts": A, "Template rules": tr }, json: FS5 }).json;
fs.writeFileSync(path.join(OUT, "payload_summary_doc06.json"), JSON.stringify(PP, null, 1));
fs.writeFileSync(path.join(OUT, "payload_summary_noplan.json"), JSON.stringify(PP5, null, 1));

const failed = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.ok ? "" : "  -> " + JSON.stringify(r.detail))));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
