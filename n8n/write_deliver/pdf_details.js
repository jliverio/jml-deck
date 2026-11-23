// Name and place of the PDF copy of the report. The file name carries the date researched and the client name,
// e.g. 20261123_Equal_Food_Market_Research.pdf. The date is the one the report shows: the day the research ended.
const start = $('Start').first().json;
let doc = {}; let up = {}; let rec = {};
try { doc = $('Create the Google Doc').first().json || {}; } catch (e) { doc = {}; }
try { up = $('Upload request').first().json || {}; } catch (e) { up = {}; }
try { rec = $('Number the entries').first().json || {}; } catch (e) { rec = {}; }
const ends = (Array.isArray(rec.log) ? rec.log : []).map(r => r.ended_at).filter(Boolean).sort();
let d = new Date(ends.length ? ends[ends.length - 1] : Date.now());
if (isNaN(d.getTime())) d = new Date();
const two = (n) => String(n).padStart(2, '0');
const pdf_date = d.getUTCFullYear() + two(d.getUTCMonth() + 1) + two(d.getUTCDate());
// Plain letters and digits only, so the name survives every mail program: accents are dropped, anything else becomes "_".
const clean = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60).replace(/_+$/g, '');
const pdf_name = pdf_date + '_' + (clean(start.company) || 'Company') + '_Market_Research.pdf';
return [{ json: { doc_id: doc.id && !doc.error ? doc.id : '', folder_id: up.folder_id || '', pdf_name, pdf_date } }];
