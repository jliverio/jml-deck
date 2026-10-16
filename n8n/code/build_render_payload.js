// Build render payload (Code, run once for each item). Input: Final summary (it passes the Check copy /
// Check retry result through and adds summary_values for slide 4).
// Adds the citations back and sends the renderer the values plus the table rules.
const A = $('Assemble drafts').first().json;
const rules = $('Template rules').first().json._rules || [];
const final = $json.final || {};
const values = { ...(A.values || {}) };
for (const [v, t] of Object.entries(final)) {
  const refs = (A.refs || {})[v] || [];
  values[v] = t + (refs.length ? ' [' + refs.join(', ') + ']' : '');
}
// Slide 4 (summary): final text from the Summary Writer chain, never through the Copywriter.
Object.assign(values, $json.summary_values || {});
const slug = String(A.client_name || 'client').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'client';
return {
  json: {
    values,
    rules: rules.map(r => ({ variable: r.variable, max_chars: r.max_chars, if_empty: r.if_empty })),
    meta: { filename: `${slug}_proposal_draft.pptx` },
    workplan: A.workplan || null,
    template: A.template || null,
    warnings: [...(A.warnings || []), ...($json.warnings || [])],
  },
};
