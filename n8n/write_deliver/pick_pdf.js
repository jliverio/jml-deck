// The PDF that is saved: the one with page numbers when the renderer returned it, otherwise the PDF as Google exported it.
// Google's API cannot put page numbers in a Doc, so the renderer writes "3 / 10" on the exported PDF (23 Nov).
const sent = $input.first() || { json: {} };
let plain = null;
try { plain = $('Export as PDF').first(); } catch (e) { plain = null; }
const isPdf = (it) => !!(it && it.binary && it.binary.data && String(it.binary.data.mimeType || '').toLowerCase().includes('pdf'));
const failed = !!(sent.json && sent.json.error);
const numbered = isPdf(sent) && !failed;
const src = numbered ? sent : plain;
const err = failed ? String(sent.json.error.message || sent.json.error) : '';
const number_note = numbered ? '' : 'No page numbers: ' + (err ? err.slice(0, 160) : 'the renderer sent no PDF back');
const out = { json: { numbered, number_note } };
if (isPdf(src)) out.binary = { data: src.binary.data };
return [out];
