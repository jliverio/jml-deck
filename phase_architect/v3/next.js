// For each scenario folder under <root>: check the newest answer and write the next run prompt.
// Prints one line per agent run to launch: "LAUNCH <dir> <stage>[_r]". Retries once on violations, then moves on.
// After the four agents: compile, then the Plan Reviewer (unless --no-review); on 'revise', one revision round
// runs in <dir>/rev (the owner of the first issue reruns from its previous answer, later agents rerun fresh),
// and the reviewer reads the revised plan once more, to report only.
//   node next.js <root> [--no-review] [--upto=lead|ws|del] [key ...]
const fs = require('fs');
const path = require('path');
const run = require('./run.js');
const ORDER = ['lead', 'ws', 'del', 'gov'];
const args = process.argv.slice(2);
const root = args[0];
const noReview = args.includes('--no-review');
const upto = (args.find(a => a.startsWith('--upto=')) || '').split('=')[1] || null;  // e.g. --upto=lead: stop after that agent
const named = args.slice(1).filter(a => !a.startsWith('--'));
const keys = named.length ? named : fs.readdirSync(root).filter(k => fs.existsSync(path.join(root, k, 'input.json')));
const todo = [];
const log = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = log; } };

function step(dir, isRev) {
  const f = s => fs.existsSync(path.join(dir, s));
  const k = path.relative(root, dir);
  for (const s of ORDER) {
    if (!f(`${s}.json`)) { if (!f(`${s}_prompt.txt`)) run.writePrompt(dir, s, false); todo.push(`${dir} ${s}`); return; }
    if (f(`${s}.copied`)) continue;
    const retried = f(`${s}_r.json`);
    if (f(`${s}_r_prompt.txt`) && !retried) { todo.push(`${dir} ${s}_r`); return; }
    const r = quiet(() => run.check(dir, s));
    if (r.violations.length && !retried) { run.writePrompt(dir, s, true); todo.push(`${dir} ${s}_r`); log(`${k} ${s}: ${r.violations.length} violations -> retry ${JSON.stringify(r.violations)}`); return; }
    if (s === upto) return;
  }
  if (!f('compiled.json')) { quiet(() => run.compile(dir)); log(`${k}: compiled`); }
  if (noReview) return;
  if (!f('review.json')) { if (!f('review_prompt.txt')) run.writePrompt(dir, 'review', false); todo.push(`${dir} review`); return; }
  const retried = f('review_r.json');
  if (f('review_r_prompt.txt') && !retried) { todo.push(`${dir} review_r`); return; }
  const r = quiet(() => run.check(dir, 'review'));
  if (r.violations.length && !retried) { run.writePrompt(dir, 'review', true); todo.push(`${dir} review_r`); return; }
  if (isRev) return;
  if (!f('rev') && !f('review.done')) {
    const route = run.revise(dir);
    fs.writeFileSync(path.join(dir, 'review.done'), route ? 'revise' : 'send');
  }
  if (f('rev')) step(path.join(dir, 'rev'), true);
}

for (const k of keys) step(path.join(root, k), false);
// a run is launched once: next.js marks it, and lists only runs not yet launched
for (const t of todo) {
  const [d, st] = t.split(' ');
  const m = path.join(d, `${st}.launched`);
  if (fs.existsSync(m)) continue;
  fs.writeFileSync(m, new Date().toISOString());
  log('LAUNCH ' + t);
}
