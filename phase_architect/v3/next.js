// For each scenario folder under <root>: check the newest answer and write the next run prompt.
// Prints one line per agent run to launch: "<dir> <stage>[_r]". Retries once on violations, then moves on.
//   node next.js <root> [key ...]
const fs = require('fs');
const path = require('path');
const run = require('./run.js');
const ORDER = ['lead', 'ws', 'del', 'gov'];
const root = process.argv[2];
const keys = process.argv.length > 3 ? process.argv.slice(3) : fs.readdirSync(root).filter(k => fs.existsSync(path.join(root, k, 'input.json')));
const todo = [];
const log = console.log;
for (const k of keys) {
  const dir = path.join(root, k);
  const f = s => fs.existsSync(path.join(dir, s));
  if (f('compiled.json')) continue;
  for (const s of ORDER) {
    if (!f(`${s}.json`)) { if (!f(`${s}_prompt.txt`)) { run.writePrompt(dir, s, false); } todo.push(`${dir} ${s}`); break; }
    const retried = f(`${s}_r.json`);
    if (f(`${s}_r_prompt.txt`) && !retried) { todo.push(`${dir} ${s}_r`); break; }
    console.log = () => {};
    const r = run.check(dir, s);
    console.log = log;
    if (r.violations.length && !retried) { run.writePrompt(dir, s, true); todo.push(`${dir} ${s}_r`); log(`${k} ${s}: ${r.violations.length} violations -> retry ${JSON.stringify(r.violations)}`); break; }
    if (s === 'gov') { console.log = () => {}; run.compile(dir); console.log = log; log(`${k}: compiled`); }
  }
}
// a run is launched once: next.js marks it, and lists only runs not yet launched
for (const t of todo) {
  const [d, st] = t.split(' ');
  const m = path.join(d, `${st}.launched`);
  if (fs.existsSync(m)) continue;
  fs.writeFileSync(m, new Date().toISOString());
  log('LAUNCH ' + t);
}
