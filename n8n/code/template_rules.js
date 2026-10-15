// Template rules (Code, run once for all items).
// Input: the rows of the n8n data table `template_variables` (one item per row).
// Output: one item = the checkProfiler item, plus
//   _rules     every table row (the renderer and the copywriter use them)
//   _research  what the market researchers need: max_rows and field_rules
const rows = $input.all().map(i => i.json).filter(r => r && r.variable);
if (!rows.length) throw new Error('The template_variables data table is empty or could not be read.');

const prof = $('checkProfiler').first().json;
const focus = (prof.output || {}).problem_focus;
const isResearcher = r => String(r.fills_from || '').startsWith('researcher:');

// Finding slots = finding_NN_headline rows filled by the researchers.
const slots = rows.filter(r => /^finding_\d+_headline$/.test(r.variable) && isResearcher(r)).length;
// When both researchers run, each brings a little over half; the assembly keeps the strongest.
const max_rows = focus === 'both' ? Math.ceil((slots + 1) / 2) : slots;

// The rules for one finding apply to every finding; take finding_01's rows.
const fieldRow = f => rows.find(r => r.fills_from === 'researcher:' + f && /^finding_01_/.test(r.variable))
  || rows.find(r => r.fills_from === 'researcher:' + f);
const field_rules = ['summary', 'context', 'action', 'result'].map(f => {
  const r = fieldRow(f) || {};
  return {
    field: f,
    variable_pattern: r.variable ? r.variable.replace(/^finding_01_/, 'finding_NN_') : null,
    draft_chars: Number(r.draft_chars) || Number(r.max_chars) || null,
    writing_rule: r.writing_rule || '',
    example: r.example || '',
  };
});

return [{ json: { ...prof, _rules: rows, _research: { max_rows, finding_slots: slots, field_rules } }, pairedItem: { item: 0 } }];
