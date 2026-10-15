// Build render payload (Code, run once for each item). Input: Check copy or Check retry.
// Adds the citations back and sends the renderer the values plus the table rules.
const A = $('Assemble drafts').first().json;
const rules = $('Template rules').first().json._rules || [];
const final = $json.final || {};
const values = { ...(A.values || {}) };
for (const [v, t] of Object.entries(final)) {
  const refs = (A.refs || {})[v] || [];
  values[v] = t + (refs.length ? ' [' + refs.join(', ') + ']' : '');
}
const slug = String(A.client_name || 'client').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'client';
return {
  json: {
    values,
    rules: rules.map(r => ({ variable: r.variable, max_chars: r.max_chars, if_empty: r.if_empty })),
    meta: { filename: `${slug}_proposal_draft.pptx` },
    warnings: [...(A.warnings || []), ...($json.warnings || [])],
  },
};
