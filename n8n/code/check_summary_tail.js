// Check summary (Code, run once for each item). Input: Summary Writer (run 1) or Summary Writer retry (run 2).
// Summary OK? sends run 1 failures to the retry and everything else to Final summary.
const input = $('Prepare summary').first().json.summary_input;
const attempt = $runIndex + 1;
const err = $json && $json.error ? String($json.error.message || $json.error) : '';
const out = $json && $json.output ? $json.output : null;
if (err || !out) {
  return { json: { ok: false, attempt, model_error: err || 'no output', out: null, violations: [], warnings: [],
    retry_message: 'Your previous answer could not be read. Return the whole JSON object.' } };
}
const r = checkSummary(out, input);
return { json: { ok: r.ok, attempt, model_error: '', out, violations: r.violations, warnings: r.warnings,
  retry_message: r.ok ? null : retryMessage(r.violations, out) } };
