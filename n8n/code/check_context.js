// Check context (Code, run once for each item). Input: Context Writer. Template 1.4, Scenario 1.
// Keeps what the Context Writer wrote only when code can stand behind it, and hands the result on with
// Assemble market's output, so Architect input sees the same $json as before:
//   situation  needs write_situation, a title and at least two lines; a line or title with a figure the
//              findings do not hold is dropped (an uncited number reads as invented); belief must start
//              "We believe" and hold no figure.
//   criteria   stated by the client: the writer's split must keep every figure of the stated text, else
//              the stated text is used as written. Not stated: criteria with figures are dropped
//              (a target the client never gave reads as invented).
// Lengths are left to the Copywriter, which fits every draft to its box.
const inp = $('Prepare context').first().json.context_input || {};
const market = $('Assemble market').first().json || {};
const out = ($json && $json.output) || {};
const err = $json && $json.error ? String($json.error.message || $json.error) : '';
const warnings = [];
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const figures = s => (String(s).match(/\d[\d.,]*%?/g) || []).map(x => x.replace(/[.,]+$/, ''));
const plain = s => String(s).replace(/(\d),(?=\d{3}\b)/g, '$1');
const findingText = plain((inp.findings || []).map(f => [f.headline, f.context, f.action, f.result].join(' ')).join(' '));
const supported = s => figures(s).every(f => findingText.includes(plain(f)));

let situation_title = '', situation = [], belief = '';
if (err) warnings.push('Context Writer unavailable: ' + err + '. Situation slide left out.');
if (!err && inp.write_situation) {
  const t = norm(out.situation_title);
  const lines = (Array.isArray(out.situation) ? out.situation : []).map(norm).filter(Boolean);
  const kept = lines.filter(l => supported(l));
  if (kept.length < lines.length) warnings.push(`Situation: ${lines.length - kept.length} line(s) dropped for a figure the findings do not hold.`);
  const heads = new Set((inp.findings || []).map(f => norm(f.headline).toLowerCase()));
  if (kept.some(l => heads.has(l.toLowerCase()))) warnings.push('Situation: a line repeats a finding headline word for word.');
  if (t && supported(t) && kept.length >= 2) {
    situation_title = t;
    situation = kept.slice(0, 3);
    const b = norm(out.belief);
    if (/^we believe\b/i.test(b) && !figures(b).length) belief = b;
    else if (b) warnings.push('Situation: the "We believe" line was dropped (it did not start with "We believe" or held a figure).');
  } else {
    warnings.push('Situation slide left out: no usable title or fewer than two usable lines.');
  }
} else if (!inp.write_situation) {
  warnings.push(`Situation slide left out: ${(inp.findings || []).length} cited finding(s), fewer than 3.`);
}

const stated = inp.stated_criteria ? norm(inp.stated_criteria) : '';
let criteria = (!err && Array.isArray(out.criteria) ? out.criteria : []).map(norm).filter(Boolean).slice(0, 4);
let criteria_basis = '';
if (stated) {
  const all = plain(criteria.join(' '));
  const lost = figures(stated).filter(f => !all.includes(plain(f)));
  const extra = criteria.filter(c => !figures(c).every(f => plain(stated).includes(plain(f))));
  if (!criteria.length || lost.length || extra.length) {
    if (criteria.length) warnings.push('Criteria: the restated criteria changed or lost a figure; the stated text is used as written.');
    criteria = stated.split(/;\s*/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean).slice(0, 4)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
  }
  criteria_basis = 'As stated in your request';
} else {
  const before = criteria.length;
  criteria = criteria.filter(c => !figures(c).length);
  if (criteria.length < before) warnings.push(`Criteria: ${before - criteria.length} dropped for a figure the client never gave.`);
  criteria_basis = criteria.length ? 'Our reading of your request, to confirm at kick-off' : 'To agree with you at kick-off';
}

return { json: { ...market, context_result: { situation_title, situation, belief, criteria, criteria_basis, warnings } } };
