// Final summary (Code, run once for each item). Input: Summary OK? (true branch): a checked answer from
// the first or the second attempt, or a second failure. Returns the copy results unchanged plus
// summary_values for slide 4. After two failures the slide is built by code (buildFallback), never a third call.
const P = $('Prepare summary').first().json;
const input = P.summary_input;
const c = $json || {};
const notes = [];
let out = null, source = c.attempt === 2 ? 'retry' : 'first';
if (c.ok && c.out) {
  out = c.out;
} else {
  notes.push(c.model_error
    ? `Summary slide: the Summary Writer was unavailable (${c.model_error}); built by code instead.`
    : `Summary slide: the Summary Writer failed twice (${(c.violations || []).slice(0, 5).map(x => x.where + ' ' + x.rule).join('; ')}); built by code instead.`);
  out = buildFallback(input);
  source = 'fallback';
}
const pass = P.pass || {};
return { json: { ...pass, summary_values: toValues(out, input), summary_source: source,
  warnings: [...(pass.warnings || []), ...notes] } };
