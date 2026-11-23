// What was written and where it is, for run_log and for the parent.
const start = $('Start').first().json;
let rep = null; let up = {}; let doc = {}; let setup = {};
try { rep = $('Assemble the report').first().json; } catch (e) { rep = null; }
try { up = $('Upload request').first().json || {}; } catch (e) { up = {}; }
try { doc = $('Create the Google Doc').first().json || {}; } catch (e) { doc = {}; }
try { setup = $('Page setup').first().json || {}; } catch (e) { setup = {}; }
let pdfd = {}; let exp = {}; let pdf = {};
try { pdfd = $('PDF details').first().json || {}; } catch (e) { pdfd = {}; }
try { exp = $('Export as PDF').first().json || {}; } catch (e) { exp = {}; }
try { pdf = $('Save the PDF').first().json || {}; } catch (e) { pdf = {}; }
let read = {};
try { read = $('Read the PDF').first().json || {}; } catch (e) { read = {}; }
const ended = new Date();
const duration_s = Math.round((ended.getTime() - new Date(start.started_at).getTime()) / 100) / 10;
const doc_url = doc.id ? 'https://docs.google.com/document/d/' + doc.id + '/edit' : '';
// The PDF copy of the report: the proposal flow attaches it by its file id.
const errText = (o) => (o && o.error ? String(o.error.message || o.error).slice(0, 160) : '');
const pdf_file_id = pdf.id && !pdf.error ? pdf.id : '';
const pdf_name = pdf_file_id ? (pdf.name || pdfd.pdf_name || '') : '';
const pdf_url = pdf_file_id ? 'https://drive.google.com/file/d/' + pdf_file_id + '/view' : '';
// The PDF is read back: its pages and words are counted and compared with the report, so a cut or empty PDF is caught here.
const pdf_pages = read.error ? 0 : (Number(read.numpages) || 0);
const pdf_words = read.error || !read.text ? 0 : String(read.text).split(/\s+/).filter(Boolean).length;
const pdf_size_kb = pdf_file_id && Number(pdf.size) ? Math.round(Number(pdf.size) / 1024) : 0;
const pdf_short = !!(pdf_file_id && rep && pdf_pages && pdf_words < 0.8 * rep.words);
const pdf_check = !pdf_file_id ? '' : (!pdf_pages ? 'The PDF could not be read back, so its content was not checked.' : (pdf_short ? 'The PDF holds ' + pdf_words + ' words against ' + rep.words + ' in the report: open it before it is sent.' : pdf_pages + ' page' + (pdf_pages === 1 ? '' : 's') + ', ' + pdf_words + ' words read back.'));
const pdf_note = !doc.id ? '' : (pdf_file_id ? 'PDF: ' + pdf_name + ' (' + pdf_check + ')' : 'The PDF was not made' + ((errText(exp) || errText(pdf)) ? ': ' + (errText(exp) || errText(pdf)) : '.'));
const not_applied = ['Page numbers in the footer: add them with Insert > Page numbers.'];
if (!doc.id || setup.error || !setup.documentId) not_applied.push('A4 page size and the margins (0.63, 0.63, 0.63 and 1.44 cm).');
let outcome = 'ok';
let note = '';
if (!rep) { outcome = 'error'; note = 'The report was not assembled.'; }
else if (!doc.id) { outcome = 'error'; note = 'The report was written (' + rep.words + ' words) but the Google Doc was not created' + (doc.error ? ': ' + String(doc.error.message || doc.error).slice(0, 200) : '.'); }
else {
  if (rep.sections_not_written.length || rep.uncited || rep.figure_misses || rep.over_limit) outcome = 'partial';
  note = rep.words + ' words, ' + rep.sources + ' sources, ' + rep.entries_used + ' entries used, ' + rep.entries_failed + ' left out; ' + rep.uncited + ' units with no citation; ' + rep.figure_misses + ' figures not in the cited entries; ' + rep.unknown_citations + ' citations removed' + (rep.sections_not_written.length ? '; sections not written: ' + rep.sections_not_written.join(', ') : '') + '; ' + (up.folder_note || '') + (pdf_note ? ' ' + pdf_note : '');
  if (!pdf_file_id || pdf_short) outcome = 'partial';
}
const out = rep ? Object.assign({}, rep) : {};
delete out.html; delete out.text;
return [{ json: Object.assign({ run_id: start.run_id, stage: 'write', ended_at: ended.toISOString(), duration_s, model_calls: 6, outcome, note: note.slice(0, 900), doc_url, doc_id: doc.id || '', pdf_file_id, pdf_name, pdf_url, pdf_pages, pdf_words, pdf_size_kb, pdf_note, folder_note: up.folder_note || '', format_settings_not_applied: not_applied }, out) }];