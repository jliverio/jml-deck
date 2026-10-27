// Table build (Code, run once for all items). Input: the loop's done output. Reads every Cell check, builds the
// comparison table (attributes x companies), marks each row comparable or not (same unit, basis and country across
// its filled cells), and prepares the Comparison Challenger's input. No headline in v0.
const cfg = $('Research method').first().json;
// $('Cell check').all() returns the last run only; the loop ran it once per company, so every run is read.
const checks = []; for (let k = 0; k < 40; k++) { let a; try { a = $('Cell check').all(0, k); } catch (e) { break; } if (!a || !a.length) break; for (const i of a) checks.push(i.json); }
const companies = $('Company list').all().map(i => i.json.company);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const byName = {}; for (const c of checks) byName[norm(c.company)] = c;
const cols = companies.map(c => ({ name: c.name, role: c.role, domain: c.domain, status: c.status || null }));
const findCheck = name => byName[norm(name)] || checks.find(c => norm(c.company).includes(norm(name).split(' ')[0]) || norm(name).includes(norm(c.company).split(' ')[0]));
const rows = cfg.method.attributes.map(a => {
  const cells = cols.map(col => {
    const ck = findCheck(col.name);
    const cell = ck ? (ck.cells || []).find(x => x.attribute === a.id && x.ok) : null;
    const faulty = ck ? (ck.cells || []).filter(x => x.attribute === a.id && !x.ok) : [];
    return cell ? { value: cell.value, unit: cell.unit, basis: cell.basis, country: cell.country, scope: cell.scope, as_of: cell.as_of, url: cell.url, passage: cell.passage } : { value: null, faulty: faulty.map(f => f.faults) };
  });
  const filled = cells.filter(c => c.value != null);
  const same = k => new Set(filled.map(c => norm(c[k]))).size <= 1;
  const comparable = filled.length >= 2 && same('unit') && same('basis') && same('country');
  return { attribute: a.id, label: a.label, cells, filled: filled.length, comparable };
});
const totalCells = rows.length * cols.length, filledCells = rows.reduce((s, r) => s + r.filled, 0);
const perCompany = cols.map((c, i) => ({ name: c.name, filled: rows.filter(r => r.cells[i].value != null).length, pages: (findCheck(c.name) || {}).pages_opened || [] }));
const thin = cols.filter((c, i) => c.role === 'competitor' && rows.filter(r => r.cells[i].value != null).length < 3).map(c => c.name);
const violations = [];
for (const ck of checks) for (const cell of (ck.cells || [])) if (!cell.ok) violations.push(`${ck.company}:${cell.attribute}:${cell.faults.join('+')}`);
const table = { columns: cols, rows, coverage: { cells: totalCells, filled: filledCells, pct: totalCells ? Math.round(100 * filledCells / totalCells) : 0 }, per_company: perCompany, thin_companies: thin };
const _challenger_input = { layer: 'L3', questions: cfg.method.questions.L3, brief: { client: cfg.brief.hard_fields.client.value, problem_statement: cfg.brief.hard_fields.problem_statement.value }, frame: ($('L1 result').first().json.records || {}).frame || null, records: table, violations, budget_left: { searches: 0, reads: 0 } };
return [{ json: { table, violations, _challenger_input } }];
