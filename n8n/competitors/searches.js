// The searches that are run. When the company's country has a language of its own, the last search is run in that language:
// a model translated its line (Translate the search). The other searches stay in English, and so does everything the stage writes.
// No translation, or one that came back empty or unchanged: the English line is searched, as before.
const qs = $('Queries').all().map(i => i.json);
const q0 = qs[0] || {};
let line = '';
try { const t = $('Translate the search').first().json || {}; line = String((t.output && t.output.search) || ''); } catch (e) { line = ''; }
const words = line.replace(/["“”«»„]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 40);
while (words.join(' ').length > 300) words.pop();   // the search engine takes at most 400 characters and 50 words
line = words.join(' ');
const use = !!(q0.local_language && q0.local_line && line && line.toLowerCase() !== String(q0.local_line).toLowerCase());
return qs.map((q, i) => ({ json: (use && i === qs.length - 1 && q.q === q0.local_line)
  ? { ...q, q: line, search_lang: q0.local_code || 'en', purpose: q.purpose + ', searched in ' + q0.local_language, english: q.q }
  : { ...q, search_lang: q.search_lang || 'en' } }));
