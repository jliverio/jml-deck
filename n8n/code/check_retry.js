// --- shared checker (kept identical in Check copy and Check retry) ---
const cleanText = s => String(s == null ? '' : s)
  .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, '')   // citations are added by code, never by the model
  .replace(/\s+/g, ' ').trim();
const figures = s => (String(s).match(/\d[\d.,]*%?/g) || []).map(x => x.replace(/[.,]+$/, ''));
const normNum = s => String(s).replace(/(\d),(?=\d{3}\b)/g, '$1');
const problemsOf = (it, text) => {
  const p = [];
  if (!text) { p.push('missing'); return p; }
  if (it.max_chars && text.length > it.max_chars) p.push(`too long: ${text.length} characters, limit ${it.max_chars}`);
  for (const f of figures(it.draft)) {
    if (!normNum(text).includes(normNum(f))) p.push(`dropped or changed the figure "${f}"`);
  }
  return p;
};
const answers = j => {
  const got = {};
  const list = (j && j.output && Array.isArray(j.output.items)) ? j.output.items : [];
  list.forEach(o => { if (o && o.variable) got[o.variable] = cleanText(o.text); });
  return got;
};
// Cut at a word, inside the limit, with an ellipsis (citations are added after this).
const cutToFit = (t, n) => {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  if (!n || t.length <= n) return t;
  let c = t.slice(0, n - 1);
  const sp = c.lastIndexOf(' ');
  if (sp > n * 0.6) c = c.slice(0, sp);
  return c.replace(/[\s,.;:]+$/, '') + '\u2026';
};
const apiError = j => (j && j.error ? String(j.error.message || j.error) : '');
// --- end shared checker ---
// Check retry (Code, run once for each item). Input: Copywriter retry.
// Whatever still fails after one retry gets a safe fallback, never a third call.
// Fallback text is cut here, inside the limit, so the citation added later always survives.
const prev = $('Check copy').first().json;
const err = apiError($json);
const got = answers($json);
const final = { ...prev.final };
const warnings = [...(prev.warnings || [])];
if (err) warnings.push('Copywriter unavailable on the retry too: ' + err + '. The researchers\' drafts were cut to fit by code.');
for (const it of prev.failed || []) {
  const t = got[it.variable];
  const probs = err ? ['copywriter unavailable'] : problemsOf(it, t);
  if (!probs.length) { final[it.variable] = t; continue; }
  if (t && probs.every(p => p.startsWith('too long'))) {
    final[it.variable] = cutToFit(t, it.max_chars);
    warnings.push(`${it.variable}: still too long after the retry; cut at a word.`);
  } else {
    final[it.variable] = cutToFit(it.draft, it.max_chars);
    if (!err) warnings.push(`${it.variable}: the copywriter failed twice (${probs.join('; ')}); the researcher's draft was cut to fit.`);
  }
}
return { json: { final, failed: [], attempt: 2, warnings } };
