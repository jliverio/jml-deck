// Build MIME (Code, all items). Input: Get original (Gmail API, message metadata), or, for a test brief, the request itself.
// Step 6 (23 Nov): the live "Build MIME" of "JML send reply" with two changes:
//  - every file in `attachments` is attached (the deck and the market research PDF), not one file;
//  - a test brief has no email to answer: the message goes to `test_to` only and is saved as a Gmail draft, never sent.
// Email plan, Oct 25:
//  - M2: every reply carries Reply-To: jose.liverio+proposals@jml-ops.com, so the partner's answer comes back to the
//    address the intake watches (the Gmail node cannot set Reply-To; this sends through the Gmail API instead).
//  - E8 (José, 25 Oct: reply to all, minus our addresses): To = the sender (or the Reply-To they set); Cc = everyone
//    else on the To and Cc lines; never one of our own addresses. recipients 'sender' keeps only the To.
//  - Threading: threadId plus In-Reply-To, References and "Re:" subject, as Gmail requires.
// Output: one binary `upload` (multipart/related: JSON metadata + the message) for the Gmail upload endpoint,
// which takes messages up to 35 MB (a 1.5 deck is about 4 MB; the plain send endpoint would refuse it).
const OURS = /^jose\.liverio(\+[^@]*)?@jml-ops\.com$/i;
const REPLY_TO = 'jose.liverio+proposals@jml-ops.com';
function header(msg, name) {
  const hs = ((msg.payload || {}).headers) || [];
  const h = hs.find(x => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? String(h.value) : '';
}
function addresses(list) {
  // "A B" <a@b.com>, c@d.com, "Last, First" <e@f.com>
  const out = [];
  const s = String(list || '');
  let cur = '', q = false, angle = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === '<') angle = true;
    if (ch === '>') angle = false;
    if (ch === ',' && !q && !angle) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => { const m = /<([^>]+)>/.exec(x); return (m ? m[1] : x).trim().replace(/^mailto:/i, ''); })
    .filter(a => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
}
function uniq(list) {
  const seen = new Set(), out = [];
  for (const a of list) { const k = a.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(a); } }
  return out;
}
function enc(s) {   // RFC 2047 for a non-ASCII subject
  return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
}
function wrap(b64) { return b64.replace(/(.{76})/g, '$1\r\n'); }
const items = $input.all();
const reqs = $('Read attachments').all();
const out = [];
for (let i = 0; i < items.length; i++) {
  const req = reqs[i].json;
  const hasOrig = !!(items[i].json && items[i].json.payload);
  const orig = hasOrig ? items[i].json : {};
  if (!hasOrig && !req.test_to) throw new Error('send reply: the email to answer could not be read');
  const from = addresses(header(orig, 'Reply-To')).length ? addresses(header(orig, 'Reply-To')) : addresses(header(orig, 'From'));
  let to = uniq(from.filter(a => !OURS.test(a)));
  let cc = req.recipients === 'sender' ? [] : uniq([...addresses(header(orig, 'To')), ...addresses(header(orig, 'Cc'))]
    .filter(a => !OURS.test(a) && !to.some(t => t.toLowerCase() === a.toLowerCase())));
  if (!to.length && cc.length) { to = [cc[0]]; cc = cc.slice(1); }
  const computed = { to: [...to], cc: [...cc] };
  if (req.test_to) { to = [String(req.test_to)]; cc = []; }   // test: only this address receives it
  if (!to.length) throw new Error('send reply: no recipient outside our own addresses');
  const subj0 = header(orig, 'Subject') || String(req.subject || '');
  const subject = /^\s*re\s*:/i.test(subj0) ? subj0 : 'Re: ' + subj0;
  const mid = header(orig, 'Message-ID') || header(orig, 'Message-Id');
  const refs = [header(orig, 'References'), mid].filter(Boolean).join(' ').trim();
  const mixed = 'jml_mixed_' + Date.now().toString(36) + i;
  const lines = [
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    `Reply-To: ${REPLY_TO}`,
    `Subject: ${enc(subject)}`,
    ...(mid ? [`In-Reply-To: ${mid}`] : []),
    ...(refs ? [`References: ${refs}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(String(req.html || ''), 'utf8').toString('base64')),
  ];
  const files = Array.isArray(req.attachments) ? req.attachments.filter(f => f && f.b64) : [];
  if (!files.length && req.attach_b64) files.push({ b64: req.attach_b64, name: req.attach_name, mime: req.attach_mime });
  for (const f of files) {
    const name = String(f.name || 'attachment').replace(/["\r\n]/g, '');
    lines.push(`--${mixed}`, `Content-Type: ${f.mime || 'application/octet-stream'}; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`, 'Content-Transfer-Encoding: base64', '', wrap(f.b64));
  }
  lines.push(`--${mixed}--`, '');
  const message = lines.join('\r\n');
  const rel = 'jml_related_' + Date.now().toString(36) + i;
  // With an email to answer: the message and its thread, for the Gmail send endpoint. Without one (a test brief):
  // the message alone, for the Gmail drafts endpoint.
  const upload = hasOrig ? [`--${rel}`, 'Content-Type: application/json; charset=UTF-8', '',
    JSON.stringify(orig.threadId ? { threadId: orig.threadId } : {}),
    `--${rel}`, 'Content-Type: message/rfc822', '', message, `--${rel}--`, ''].join('\r\n') : message;
  const content_type = hasOrig ? `multipart/related; boundary=${rel}` : 'message/rfc822';
  const bin = await this.helpers.prepareBinaryData(Buffer.from(upload, 'utf8'), 'reply.eml', content_type);
  out.push({
    json: { thread_id: orig.threadId || null, to, cc, computed, subject, bytes: upload.length, content_type,
      attached: files.length > 0, attachment_names: files.map(f => String(f.name || '')), draft: !hasOrig, test: !!req.test_to },
    binary: { upload: bin }, pairedItem: i,
  });
}
return out;
