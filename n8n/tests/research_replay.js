// Replays Research brief and Check research on saved n8n executions.
// usage: node harness.js <exec_research.json> <exec_chain.json or -> [runIndex]
const fs = require('fs');
const [,, researchFile, chainFile, runIndexArg] = process.argv;
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8')).data.resultData.runData;
const R = rd(researchFile);
const C = chainFile && chainFile !== '-' ? rd(chainFile) : {};
const first = (name, runs) => { const r = runs[name]; if (!r) return null; return r[r.length - 1].data.main[0][0].json; };
// the brief: Brief Organizer when saved, else Validate brief's output
let briefOut = first('Brief Organizer', R) || first('Brief Organizer', C);
if (!briefOut) { const vb = first('Validate brief', C); briefOut = vb && (vb.output ? { output: vb.output } : null); }
const profilerOut = first('checkProfiler', R) || { output: (first('Client Profiler', R) || {}).output };
const templ = first('Template rules', R) || first('Template rules', C) || JSON.parse(fs.readFileSync(__dirname + "/fixtures/template_rules_1707.json", 'utf8'));
const config = { today: '2026-10-24', researcher_max_searches: 10 };

function run(code, $json, nodes, runIndex) {
  const $ = name => ({ first: () => ({ json: nodes[name] }), item: { json: nodes[name] } });
  const fn = new Function('$json', '$', '$runIndex', code);
  return fn($json, $, runIndex);
}
const rbCode = fs.readFileSync(__dirname + "/../code/research_brief.js", 'utf8');
const ckCode = fs.readFileSync(__dirname + "/../code/check_research.js", 'utf8');

const templItem = { ...templ, output: profilerOut.output };
const rb = run(rbCode, templItem, { 'Brief Organizer': briefOut, 'Config': config }, 0).json;
console.log('RESEARCH BRIEF', JSON.stringify(rb._research_brief, null, 1));

const resOut = first('Topic researcher', R) || first('Offering researcher', R);
const ck = run(ckCode, resOut, { 'Template rules': templ, 'Research brief': rb, 'checkProfiler': profilerOut, 'Config': config }, Number(runIndexArg || 0)).json;
console.log('CHECK', JSON.stringify({ v: ck._research_validation, route: ck._route, retry: ck._retry && { ...ck._retry, previous_output: '(omitted)' } }, null, 1));
