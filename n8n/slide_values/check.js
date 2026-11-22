// Checks every text the writer returned, in code, and builds the slide values from the texts that pass.
// Runs once after the writer and once more after the rewrite. Rules: within the character limit, every figure present
// in an entry the text rests on, no advice words, the point format, supplier and place names present in the entries.
// A text that still fails after the rewrite is left out and the slide's own rule for an empty box applies.
const F = $('Build the request').first().json;
let o = {};
try { o = $('Write the values').first().json.output || {}; } catch (e) { o = {}; }
let fixes = null;
try { const r = $('Rewrite what failed').first().json; fixes = Array.isArray(r.output && r.output.fixes) ? r.output.fixes : []; } catch (e) { fixes = null; }
const round = fixes === null ? 0 : 1;
const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
const safe = (s) => clean(s).replace(/\{/g, '(').replace(/\}/g, ')');
const num = (id) => Number((String(id).match(/(\d+)(?!.*\d)/) || [0, 0])[1]);
const plainOf = (s) => String(s || '').replace(/\*\*|__/g, '').replace(/\s*\n\s*/g, ' ').trim();
const E = F.entries || {};
const arr = (x) => (Array.isArray(x) ? x : []);

// 1. The writer's texts, one slot each. A rewrite replaces the slot it names.
const slots = {};
const put = (id, text, cites, limit, opts) => { slots[id] = Object.assign({ text: clean(text), cites: arr(cites).map(String).filter(c => E[c]), limit }, opts || {}); };
const pt = o.profile_title || {};
put('profile_title', pt.text, pt.cites, 90, { title: true, defaults: Object.keys(E).filter(k => /^(A1-|A2-|A3-FOCUS|A4-M)/.test(k)) });
for (const l of F.layers) {
  if (l.mode === 'none') continue;
  const x = arr(o.layers).find(y => Number(y && y.layer) === l.n) || {};
  put('layer_' + l.n, x.text, [l.entry], 150, { names: l.mode === 'buys', nobold: true, status: l.mode === 'operates' ? l.status : '' });
}
for (const p of F.products) {
  const x = arr(o.products).find(y => y && y.entry === p.entry) || {};
  put('product:' + p.entry, x.text, [p.entry], 120, { nobold: true });
  put('price:' + p.entry, x.price, [x.price_entry], 45, { price: true, product: p, nobold: true });
}
const mk = o.markets || {};
const mdef = Object.keys(E).filter(k => /^A4-(M\d+|NOMARKET|KI\d+)$/.test(k));
put('markets', mk.text, arr(mk.cites).filter(c => mdef.includes(c)), F.noMarket ? 70 : 110, { names: true, defaults: mdef, nobold: F.noMarket });
const rg = o.regulatory || {};
put('regulatory', F.regulator.length ? rg.text : '', arr(rg.cites).filter(c => F.regulator.includes(c)), 40, { defaults: F.regulator, nobold: true });
for (const id of F.claims) { const x = arr(o.client_points).find(y => y && y.entry === id) || {}; put('client:' + id, x.text, [id], 95, { point: true }); }
const fitsBusiness = {};
const shownName = {};   // the company's own name without product words, when the writer gave one made of the entry's words
const foldName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
for (const c of F.competitors) {
  const x = arr(o.competitors).find(y => y && y.entry === c.entry) || {};
  const nm = clean(x.name).replace(/\*\*|__/g, '');
  shownName[c.entry] = nm.length >= 2 && nm.length <= c.name.length && foldName(c.name).includes(foldName(nm)) ? nm : c.name;
  fitsBusiness[c.entry] = !(x.same_business === false && c.points.length > 0);
  if (!fitsBusiness[c.entry]) fitsBusiness[c.entry + ':why'] = clean(x.why);
  for (const id of c.points) { const y = arr(x.points).find(z => z && z.entry === id) || {}; put('comp:' + id, y.text, [id], 80, { point: true }); }
}
const ct = o.compare_title || {};
put('compare_title', ct.text, [], 90, { title: true, compare: true });
let fixed = 0;
if (fixes) for (const f of fixes) {
  const s = f && slots[String(f.slot)];
  if (!s) continue;
  s.text = clean(f.text);
  const c = arr(f.cites).map(String).filter(x => E[x]);
  if (s.price) s.cites = c.slice(0, 1); else if (c.length && (s.defaults || []).length) s.cites = c.filter(x => s.defaults.includes(x));
  fixed += 1;
}
// Tidy what needs no judgement: line breaks, stray markup, a title's final period.
for (const id of Object.keys(slots)) {
  const s = slots[id];
  s.text = s.text.replace(/__/g, '').replace(/`|#/g, '').replace(/\s*\[[A-Z0-9-]+(?:,\s*[A-Z0-9-]+)*\]/g, '').trim();
  if (s.nobold || s.title) s.text = s.text.replace(/\*\*/g, '');
  if (s.title || s.point) s.text = s.text.replace(/[.\s]+$/, '');
  if (s.price) s.text = s.text.replace(/[.\s]+$/, '');
  if (s.status) {   // the status word is printed above the text; a text that opens with it would say it twice
    const t = s.text.replace(new RegExp('^' + s.status.replace(/[-\s]+/g, '[-\\s]+') + '\\b[\\s:,.-]*', 'i'), '');
    if (t && t !== s.text) s.text = t.charAt(0).toUpperCase() + t.slice(1);
  }
}

// The title is written from the names as the research stores them; it prints the short ones.
for (const c of F.competitors) if (shownName[c.entry] !== c.name && slots.compare_title.text.includes(c.name)) slots.compare_title.text = slots.compare_title.text.split(c.name).join(shownName[c.entry]);

// 2. Which competitors go on the slide: the first four in the research's rank whose business matches.
const shown = F.competitors.filter(c => fitsBusiness[c.entry]).slice(0, 4);
const dropped = F.competitors.filter(c => !fitsBusiness[c.entry]);
const comparable = (list) => list.filter(c => c.same !== null && c.points.length > 0);
const table = (list) => {
  const comp = comparable(list);
  const rows = F.claims.map(id => { const n = num(id); const yes = comp.filter(c => c.same.includes(n)); const no = comp.filter(c => !c.same.includes(n)); return { n, id, yes: yes.length, no: no.length, line: 'Claim ' + n + ' [' + id + ']: ' + safe(E[id].statement) + ' Also made by: ' + (yes.length ? yes.map(c => safe(c.name)).join(', ') : 'none') + '. Not made by: ' + (no.length ? no.map(c => safe(c.name)).join(', ') : 'none') + '.' }; });
  const blank = list.filter(c => !comp.includes(c));
  if (blank.length) rows.push({ yes: 0, no: 0, line: 'No claims were captured for ' + blank.map(c => safe(c.name)).join(', ') + ': say nothing about ' + (blank.length === 1 ? 'it' : 'them') + '.' });
  return rows;
};
const tab = table(shown);
const comp = comparable(shown);
const sameShown = shown.map(c => c.entry).join(',') === arr(F.shown0).join(',');

// 3. The checks.
const numsOf = (s) => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []);
const canon = (t) => t.replace(/[.,]/g, '');
const entryNums = (list) => {
  const set = new Set();
  for (const id of list) {
    const e = E[id]; if (!e) continue;
    for (const t of numsOf(e.statement + ' ' + e.quote)) { set.add(canon(t)); const m = t.match(/^(\d+)[.,]0+$/); if (m) set.add(m[1]); const d = t.match(/^(\d+)[.,](\d)0$/); if (d) set.add(d[1] + d[2]); }
    if (e.value !== null && e.value !== undefined && e.value !== '') { const v = Number(e.value); if (isFinite(v)) { set.add(canon(String(v))); set.add(canon(v.toFixed(2))); set.add(String(Math.round(v))); } }
  }
  return set;
};
const textOf = (list) => list.map(id => (E[id] ? E[id].statement + ' ' + E[id].quote : '')).join(' ');
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ADVICE = /\b(should|must|recommend(s|ed)?|ought|needs? to|advis(e|es|ed))\b/i;
const FREE = /(^|[^a-z\u00c0-\u024f-])(free|gratis|gr\u00e1tis|gratuit[oa]s?)([^a-z\u00c0-\u024f]|$)/i;
const WORDS = { one: 1, two: 2, both: 2, three: 3, four: 4, five: 5 };
const problems = [];
const bad = new Set();
const fail = (id, what, hard) => { problems.push({ slot: id, problem: what }); if (hard !== false) bad.add(id); };
for (const id of Object.keys(slots)) {
  const s = slots[id];
  if (!s.text) continue;
  const plain = plainOf(s.text);
  const src = s.cites.length ? s.cites : (s.defaults || []);
  // Length is a target, not a wall: the renderer measures the box. A text up to a quarter over is asked to be shortened but kept.
  if (plain.length > s.limit) fail(id, 'It has ' + plain.length + ' characters; aim for ' + s.limit + ' or fewer. Cut at least ' + (plain.length - s.limit + 3) + ' characters.', plain.length > s.limit * 1.25);
  if (ADVICE.test(plain)) fail(id, 'It advises (should, must, recommend). Report only.');
  if ((s.text.match(/\*\*/g) || []).length % 2) fail(id, 'The bold markers do not pair up.');
  if (s.point && !/^\*\*[^*:]{2,26}:\*\*\s+\S/.test(s.text)) fail(id, 'Format: a label of one or two words in bold, a colon, then the claim. Example: **Price:** up to **40%** cheaper than supermarkets');
  if (s.point && /presents itself as/i.test(plain)) fail(id, 'Leave out the words "presents itself as".');
  if (id === 'profile_title' && fold(plain).indexOf(fold(F.company)) !== 0) fail(id, 'It must start with "' + F.company + '".');
  if (s.price) {
    const own = s.product.entry;
    const pe = s.cites[0];
    if (!pe || !(F.offers.includes(pe) || pe === own)) { fail(id, 'price_entry must be the id of an offer entry or of the product\'s own entry.'); continue; }
    const have = entryNums([pe]);
    const miss = numsOf(plain).map(canon).filter(n => !have.has(n));
    if (miss.length) fail(id, 'The figure ' + miss.join(', ') + ' is not in [' + pe + '].');
    else if (!numsOf(plain).length && !(FREE.test(plain.toLowerCase()) && (Number(E[pe].value) === 0 || FREE.test(textOf([pe]).toLowerCase())))) fail(id, 'A price needs its figure from the entry, or the word Free when the entry says so.');
    else if (pe !== own && F.products.length > 2) {
      const words = fold(s.product.name).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      const hay = fold(textOf([pe]));
      if (words.length && !words.some(w => hay.includes(w))) fail(id, '[' + pe + '] does not name this product. Give a price only when the entry is about this very product; otherwise leave the price empty.');
    }
    continue;
  }
  if (s.compare) {
    const allowed = new Set([shown.length, comp.length, F.claims.length].concat(tab.map(t => t.yes), tab.map(t => t.no)).map(String));
    const inClaims = entryNums(F.claims);      // a claim's own figure may be named ("none claims the 40% saving")
    const miss = numsOf(plain).map(canon).filter(n => !allowed.has(n) && !inClaims.has(n));
    const low = fold(plain);
    for (const w of Object.keys(WORDS)) if (new RegExp('\\b' + w + '\\b').test(low) && !allowed.has(String(WORDS[w]))) miss.push(w);
    if (miss.length) fail(id, 'It uses a count the table does not give (' + miss.join(', ') + ').');
    const said = (c) => low.includes(fold(c.name)) || low.includes(fold(shownName[c.entry]));
    const gone = F.competitors.filter(c => !shown.includes(c) && said(c));
    if (gone.length) fail(id, 'It names ' + gone.map(c => c.name).join(', ') + ', which is not on the slide.');
    const blank = shown.filter(c => !comp.includes(c) && said(c));
    if (blank.length) fail(id, 'It speaks about ' + blank.map(c => c.name).join(', ') + ', for which no claims were captured.');
    if (!gone.length && !sameShown && round === 0) fail(id, 'The competitors on the slide changed. Write it again from the table given.');
    continue;
  }
  const have = entryNums(src);
  const miss = numsOf(plain).map(canon).filter(n => !have.has(n));
  if (miss.length) fail(id, 'The figure ' + [...new Set(miss)].join(', ') + ' is not in the ' + (src.length === 1 ? 'entry [' + src[0] + ']' : 'entries it rests on') + '. Keep figures exactly as the entry gives them, and do not count or add up.');
  if (s.names) {
    // Supplier and place names must be in the entries. A word that only opens a sentence is not a name.
    const hay = fold(textOf(src));
    const lost = [];
    const re = /(^|[.!?]\s+|[\s(;,·])([A-Z\u00c0-\u00de][\w\u00c0-\u024f'’-]{2,})/g;
    let m;
    while ((m = re.exec(plain)) !== null) {
      const opens = m[1] === '' || /[.!?]\s+$/.test(m[1]);
      if (opens && id === 'markets' && F.noMarket) continue;
      if (!hay.includes(fold(m[2]))) lost.push(m[2]);
    }
    if (lost.length) fail(id, 'These names are not in the entries: ' + [...new Set(lost)].join(', ') + '. Use only names the entries give.');
  }
}

// 4. The slide values. "strict" leaves out every text that failed; the first pass keeps them so the fit check sees real lengths.
const short = (s, n) => { s = clean(s); if (s.length <= n) return s; const cut = s.slice(0, n + 1); const i = cut.lastIndexOf(' '); return (i > n * 0.6 ? cut.slice(0, i) : s.slice(0, n)).replace(/[\s,;:·-]+$/, ''); };
const build = (strict) => {
  const v = {}; const from = {}; const used = new Set();
  const T = (id) => { const s = slots[id]; if (!s || !s.text || (strict && bad.has(id))) return ''; used.add(id); return s.text; };
  const set = (name, value, slot) => { v[name] = value || ''; if (slot && value) from[name] = slot; };
  const profile = !!(F.found.layers || F.products.length || !F.noMarket || F.offerType);
  const compare = F.claims.length > 0 || shown.length > 0;
  let title = profile ? T('profile_title') : '';
  if (profile && !title) title = short('What ' + F.company + ' sells and where it sells it', 90);
  set('section_02', profile || compare ? 'Market Research' : '');
  set('profile_title_01', title, 'profile_title');
  for (const n of [1, 2, 3, 4]) {
    const l = F.layers.find(x => x.n === n);
    let val = '';
    if (l && l.mode === 'operates') { const t = T('layer_' + n); val = '**' + l.status + '**' + (t ? '\n' + t : ''); }
    else if (l && l.mode === 'buys') { const t = T('layer_' + n); val = t ? '__Buys from: ' + t + '__' : ''; }
    set('value_layer_0' + n, val, 'layer_' + n);
  }
  let list = F.products.slice();
  const focus = String(o.focus_product || '');
  const fi = list.findIndex(p => p.entry === focus);
  if (fi > 0) list.unshift(list.splice(fi, 1)[0]);
  const many = list.length >= 7;
  const main = many ? list.slice(0, 5) : list.slice(0, 6);
  main.forEach((p, i) => {
    const k = '0' + (i + 1);
    const t = T('product:' + p.entry); const pr = T('price:' + p.entry);
    set('product_' + k + '_name', short(p.name, 40));
    set('product_' + k + '_text', [t, pr ? '**' + pr + '**' : ''].filter(Boolean).join('\n'), 'product:' + p.entry);
  });
  if (many) {
    const rest = list.slice(5).map(p => short(p.name, 40));
    let names = []; let left = rest.length;
    for (const nme of rest) { const more = left - 1; const tail = more ? ' · and ' + more + ' more' : ''; if ((names.concat([nme]).join(' · ') + tail).length > 170) break; names.push(nme); left -= 1; }
    set('product_06_name', 'Multi-product company');
    set('product_06_text', names.join(' · ') + (left ? ' · __and ' + left + ' more__' : ''));
  }
  for (let i = main.length + (many ? 1 : 0) + 1; i <= 6; i += 1) { set('product_0' + i + '_name', ''); set('product_0' + i + '_text', ''); }
  if (!profile) { set('details_01', ''); set('details_02', ''); }
  else {
    const m = T('markets');
    if (F.noMarket) set('details_01', '__Markets: not public.__' + (m ? ' ' + m : ''), 'markets');
    else set('details_01', m || F.markets.map(id => '**' + clean(E[id].statement).replace(/^Market:\s*/i, '').replace(/\.$/, '') + '**').join(' · ').slice(0, 130), 'markets');
    const known = (x) => x && x.toLowerCase() !== 'not public';
    const reg = T('regulatory');
    let d2 = 'Offer type: ' + (known(F.offerType) ? '**' + F.offerType + '**' : '__not public__') + ' · Pricing: ' + (F.pricing ? '**' + F.pricing + '**' : '__not public__');
    if (reg && plainOf(d2 + ' · Regulatory: ' + reg).length <= 110) d2 += ' · Regulatory: **' + reg + '**';
    if (plainOf(d2).length > 110 && F.pricing) d2 = 'Offer type: ' + (known(F.offerType) ? '**' + F.offerType + '**' : '__not public__') + ' · Pricing: **' + short(F.pricing, 110 - plainOf('Offer type: ' + (known(F.offerType) ? F.offerType : 'not public') + ' · Pricing: ').length) + '**';
    set('details_02', d2, 'regulatory');
  }
  set('sources_profile_01', profile ? '[1] ' + F.company + ', company website, ' + F.year : '');
  let ctitle = '';
  if (compare) {
    const nc = F.claims.length + ' claim' + (F.claims.length === 1 ? '' : 's');
    if (!shown.length) ctitle = short(F.company + ' makes ' + nc + '; the research found no competitor to compare ' + (F.claims.length === 1 ? 'it' : 'them') + ' with', 90);
    else if (!comp.length && F.claims.length) ctitle = short(F.company + ' makes ' + nc + '; no claims were captured from its competitors\u2019 home pages', 90);
    else ctitle = T('compare_title') || short(F.company + '’s claims next to those of ' + (shown.length === 1 ? shownName[shown[0].entry] : 'its competitors'), 90);
  }
  set('compare_title_01', ctitle, 'compare_title');
  set('client_name_01', compare ? F.company : '');
  for (let i = 0; i < 5; i += 1) { const id = F.claims[i]; set('client_point_0' + (i + 1), compare && id ? T('client:' + id) : '', id ? 'client:' + id : ''); }
  for (let k = 0; k < 4; k += 1) {
    const c = compare ? shown[k] : null; const kk = '0' + (k + 1);
    set('competitor_' + kk + '_name', c ? short(shownName[c.entry], 30) : '');
    set('competitor_' + kk + '_fact_01', c ? c.fact : '');
    for (let j = 0; j < 3; j += 1) { const id = c ? c.points[j] : ''; set('competitor_' + kk + '_point_0' + (j + 1), id ? T('comp:' + id) : '', id ? 'comp:' + id : ''); }
  }
  let src = '';
  if (compare) { src = [F.company].concat(shown.map(c => shownName[c.entry])).map((n, i) => '[' + (i + 1) + '] ' + n).join('; ') + '; company website' + (shown.length ? 's' : '') + ', ' + F.year; if (src.length > 135) src = 'Websites of ' + F.company + ' and the ' + shown.length + ' competitors named, ' + F.year; }
  set('sources_compare_01', src);
  return { v, from, used, profile, compare };
};
const loose = build(false);
const strict = build(true);
const live = problems.filter(p => loose.used.has(p.slot));
const notes = [];
for (const c of dropped) notes.push(shownName[c.entry] + ' is left out of the comparison: its home page describes a different business' + (fitsBusiness[c.entry + ':why'] ? ' (' + fitsBusiness[c.entry + ':why'].replace(/\.$/, '') + ')' : '') + '.');
return [{ json: { run_id: F.run_id, round, fixed, values: loose.v, values_strict: strict.v, from: loose.from, problems: live, bad: [...bad].filter(id => loose.used.has(id)),
  slots: Object.fromEntries(Object.keys(slots).filter(id => loose.used.has(id)).map(id => [id, { text: slots[id].text, cites: slots[id].cites.length ? slots[id].cites : (slots[id].defaults || []).slice(0, 12), limit: slots[id].limit }])),
  shown: shown.map(c => ({ entry: c.entry, name: shownName[c.entry] })), table: tab.map(t => t.line), same_shown: sameShown, profile: loose.profile, compare: loose.compare, notes,
  writer_failed: !Object.keys(o).length, fit_body: { values: Object.assign({ client_name: F.company }, loose.v), template: '1.5.4' } } }];
