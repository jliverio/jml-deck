const out = $json.output || {};
const subject = $('Config').item.json.subject || '';
const body = $('Config').item.json.body || '';
const haystack = subject + '\n' + body;
const ORDER = ['client','problem_statement','engagement_type','engagement_length','stakeholders','deliverable_format','timeline','prior_attempts','success_criteria','out_of_scope','client_url'];
const FIELDS = [['hard_fields','client'],['hard_fields','problem_statement'],['required','engagement_type'],['required','engagement_length'],['required','stakeholders'],['soft_fields','deliverable_format'],['soft_fields','timeline'],['soft_fields','prior_attempts'],['soft_fields','success_criteria'],['soft_fields','out_of_scope'],['soft_fields','workstreams'],['soft_fields','budget_range'],['contracting_parties'],['relationship_stage']];
const get = (o, path) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
const errors = [];
for (const path of FIELDS) {
  const f = get(out, path);
  if (f && typeof f === 'object' && f.source === 'stated') {
    const label = path.join('.');
    if (f.quote == null) errors.push('checkA:' + label + ':null_quote');
    else if (!haystack.includes(f.quote)) errors.push('checkA:' + label + ':quote_not_substring');
  }
}
const qs = Array.isArray(out.questions) ? out.questions.map(q => q && q.field) : [];
const seen = new Set(); let last = -1;
for (const field of qs) {
  const idx = ORDER.indexOf(field);
  if (idx === -1) { errors.push('checkB:unknown:' + field); continue; }
  if (seen.has(field)) { errors.push('checkB:dup:' + field); continue; }
  seen.add(field); if (idx < last) errors.push('checkB:order:' + field); last = idx;
}
// the partner's workstreams: a count only with a value, and a whole number from 1 when given
const wsf = ((out.soft_fields || {}).workstreams) || null;
if (wsf && wsf.value == null && wsf.count != null) errors.push('checkC:workstreams:count_without_value');
if (wsf && wsf.count != null && !(Number.isInteger(wsf.count) && wsf.count >= 1)) errors.push('checkC:workstreams:count_not_whole');
return { json: { output: out, _validation: { valid: errors.length === 0, errors } } };