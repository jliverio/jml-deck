// Offline check of the step 6 reply code: the time limit, the attachments, the email lines and the message itself.
// Run: node n8n/proposal_copy/t_reply.js
const fs = require('fs'); const assert = require('assert');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = async (file, nodes, input, helpers) => {
  const $ = (n) => { if (!(n in nodes)) throw new Error('no node ' + n); return { first: () => nodes[n][0], all: () => nodes[n] }; };
  const $input = { first: () => input[0], all: () => input };
  return await new AsyncFunction('$', '$input', fs.readFileSync(__dirname + '/' + file, 'utf8')).call({ helpers }, $, $input);
};
const J = (o) => [{ json: o }];
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
(async () => {
  // 1. the time limit
  const now = Date.now();
  const inp = { research_go: true, run_id: 'run-par-equal-food-1', research_started_at: new Date(now - 100000).toISOString(), research_limit_s: 720 };
  const row = (o) => ({ json: Object.assign({ run_id: 'run-par-equal-food-1' }, o) });
  let r = (await run('research_state.js', { 'Research input': J(inp) }, [row({ stage: 'parent', outcome: 'running' }), row({ stage: 'crawl', outcome: 'ok', ended_at: 'x' })]))[0].json;
  ok(r.state === 'wait' && r.waited_s >= 99 && r.waited_s <= 102 && r.pdf_file_id === '' && r.run_id === 'run-par-equal-food-1', JSON.stringify(r));
  r = (await run('research_state.js', { 'Research input': J(inp) }, [{ json: {} }]))[0].json;
  ok(r.state === 'wait', 'no rows yet: wait');
  const result = { outcome: 'partial', reasons: ['1 entry failed the checks and is left out of the report'], doc_url: 'https://docs/d', pdf_file_id: 'PDF9', pdf_name: '20261123_Equal_Food_Market_Research.pdf', pdf_url: 'https://drive/p', duration_s: 230.7 };
  r = (await run('research_state.js', { 'Research input': J(inp) }, [row({ stage: 'crawl', outcome: 'ok', ended_at: 'x' }), row({ stage: 'parent', outcome: 'partial', ended_at: '2026-11-23T19:56:45Z', duration_s: 230.7, result_json: JSON.stringify(result) })]))[0].json;
  ok(r.state === 'done' && r.outcome === 'partial' && r.pdf_file_id === 'PDF9' && r.pdf_name.endsWith('.pdf') && r.doc_url === 'https://docs/d' && r.reasons.length === 1 && r.duration_s === 230.7, JSON.stringify(r));
  r = (await run('research_state.js', { 'Research input': J(inp) }, [row({ stage: 'parent', outcome: 'error', ended_at: 'x', duration_s: 40, result_json: 'not json' })]))[0].json;
  ok(r.state === 'done' && r.outcome === 'error' && r.pdf_file_id === '' && r.duration_s === 40, 'a result that cannot be read still ends the wait');
  r = (await run('research_state.js', { 'Research input': J(inp) }, [row({ stage: 'parent', outcome: 'running' }), row({ stage: 'crawl', outcome: 'error', ended_at: 'x', note: 'HTTP 403' })]))[0].json;
  ok(r.state === 'failed' && r.why.includes('could not be read') && r.outcome === '');
  r = (await run('research_state.js', { 'Research input': J({ ...inp, research_started_at: new Date(now - 721000).toISOString() }) }, [row({ stage: 'parent', outcome: 'running' })]))[0].json;
  ok(r.state === 'timeout' && r.why.includes('12 minutes') && r.pdf_file_id === '');
  r = (await run('research_state.js', { 'Research input': J({ ...inp, research_started_at: '' }) }, [row({ stage: 'parent', outcome: 'running' })]))[0].json;
  ok(r.state === 'timeout', 'a start time that cannot be read never waits for ever');
  r = (await run('research_state.js', { 'Research input': J(inp) }, [{ json: { run_id: 'run-par-other-2', stage: 'parent', outcome: 'ok', ended_at: 'x' } }]))[0].json;
  ok(r.state === 'wait', 'rows of another run are not read');

  // 2. what the reply carries and says
  const deck = { data: 'DECK', fileName: 'Equal_Food_proposal_draft.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  const pdf = { data: 'PDF', fileName: 'file.pdf', mimeType: 'application/octet-stream' };
  const flowNote = '<p>Kept note.</p><p>No market finding passed the source checks (a dated source on a comparable organization), so this draft has no market slide.</p><p>Still open.</p>';
  const R = { asked: true, ran: true, state: 'done', slides: { profile: true, compare: true }, thin: [], pdf_file_id: 'PDF9', pdf_name: '20261123_Equal_Food_Market_Research.pdf', pdf_url: 'https://drive/p', colour_applied: false, colour_note: 'This deck is in JML colours: low. Reply with a HEX code (for example #E60000).' };
  const nodes = (research, extra) => Object.assign({ 'Name attachment': [{ json: { a: 1 }, binary: { deck } }], 'Assemble market': J({ research }), 'Build render payload': J({ email: { note_html: flowNote, client_verified: true } }) }, extra || {});
  let a = (await run('attachments.js', nodes(R, { 'Download report': [{ json: {}, binary: { report: pdf } }] }), []))[0];
  ok(a.json.report_attached === true && a.json.reply_attach === 'deck,report' && a.binary.deck === deck && a.binary.report.fileName === '20261123_Equal_Food_Market_Research.pdf' && a.binary.report.mimeType === 'application/pdf' && a.json.a === 1);
  ok(!a.json.reply_note_html.includes('no market slide') && a.json.reply_note_html.startsWith('<p>Kept note.</p><p>Still open.</p>') && a.json.reply_note_html.includes('attached as a PDF') && a.json.reply_note_html.includes('HEX code'), a.json.reply_note_html);
  ok(a.json.review_report_html.includes('href="https://drive/p"') && a.json.research_lines.length === 2);
  a = (await run('attachments.js', nodes({ ...R, colour_applied: true, colour_note: '', thin: ['only 1 competitor was found'] }, { 'Download report': [{ json: { error: 'not found' } }] }), []))[0];
  ok(a.json.report_attached === false && a.json.reply_attach === 'deck' && !a.binary.report && a.json.reply_note_html.includes('could not be attached') && a.json.reply_note_html.includes('&quot;') === false && a.json.reply_note_html.includes('"Not public"') && !a.json.reply_note_html.includes('HEX'), a.json.reply_note_html);
  a = (await run('attachments.js', nodes(R), []))[0];
  ok(a.json.report_attached === false && a.json.reply_attach === 'deck', 'the download did not run: the deck alone');
  a = (await run('attachments.js', nodes({ asked: true, ran: false, state: 'timeout', slides: { profile: false, compare: false }, colour_applied: false, colour_note: 'JML colours. HEX.' }), []))[0];
  ok(a.json.reply_note_html.includes('still running') && !a.json.reply_note_html.includes('attached as a PDF') && a.json.review_report_html === '' && !a.binary.report);
  a = (await run('attachments.js', nodes({ asked: true, ran: false, state: 'failed', slides: {}, colour_applied: false }), []))[0];
  ok(a.json.reply_note_html.includes('website could not be read') && a.json.reply_note_html.includes('HEX code'));
  a = (await run('attachments.js', nodes({ asked: true, ran: true, state: 'done', slides: { profile: false, compare: false }, pdf_file_id: 'PDF9', colour_applied: true }, { 'Download report': [{ json: {}, binary: { report: pdf } }] }), []))[0];
  ok(a.json.reply_note_html.includes('found nothing it could source') && a.json.report_attached === false, 'no slides: the report is not attached');
  a = (await run('attachments.js', nodes({ asked: false, ran: false, state: 'not asked', why: 'No website was found for Atrium.', slides: {}, colour_applied: false, colour_note: 'This deck is in JML colours. Reply with HEX.' }), []))[0];
  ok(a.json.reply_note_html.includes('No market research was run, so the deck has no market research slides. No website was found for Atrium.'));
  const unverified = nodes({ asked: false, state: 'not asked', why: 'Chips4all could not be confirmed online, so its website was not researched.', slides: {}, colour_applied: false });
  unverified['Build render payload'] = J({ email: { note_html: '<p>We could not confirm Chips4all from published sources.</p>', client_verified: false } });
  a = (await run('attachments.js', unverified, []))[0];
  ok(a.json.reply_note_html.includes('No market research was run') && !a.json.reply_note_html.includes('not researched'), 'the flow already says the client was not confirmed');
  a = (await run('attachments.js', { 'Name attachment': [{ json: {}, binary: { deck } }] }, []))[0];
  ok(a.json.reply_attach === 'deck' && a.json.reply_note_html.includes('No market research was run'), 'nothing else ran: the deck still goes');

  // 3. the files, read for the message
  const bufs = { deck: Buffer.from('PK-deck-bytes-' + 'x'.repeat(300)), report: Buffer.from('%PDF-1.7 report ' + 'y'.repeat(200)) };
  const helpers = { getBinaryDataBuffer: async (i, prop) => bufs[prop], prepareBinaryData: async (buf, name, mime) => ({ buf, fileName: name, mimeType: mime }) };
  const reqItem = (o) => [{ json: Object.assign({ reply_to_id: 'test-123', html: '<p>Hi,</p><p>Olá, notes.</p>', recipients: 'all', attach: 'deck,report', subject: 'Proposta Equal Food', test_to: 'joseliverio@jml-ops.com' }, o), binary: { deck: { fileName: 'Equal_Food_proposal_draft.pptx', mimeType: deck.mimeType }, report: { fileName: '20261123_Equal_Food_Market_Research.pdf', mimeType: 'application/pdf' } } }];
  let ra = await run('read_attachments.js', {}, reqItem({}), helpers);
  ok(ra.length === 1 && ra[0].json.attachments.length === 2 && ra[0].json.attachments[0].name.endsWith('.pptx') && ra[0].json.attachments[1].mime === 'application/pdf' && Buffer.from(ra[0].json.attachments[1].b64, 'base64').equals(bufs.report) && ra[0].json.attachments[0].bytes === bufs.deck.length);
  let one = await run('read_attachments.js', {}, reqItem({ attach: 'deck' }), helpers);
  ok(one[0].json.attachments.length === 1 && one[0].json.attachments[0].name.endsWith('.pptx'), 'one file, as today');
  let none = await run('read_attachments.js', {}, reqItem({ attach: '' }), helpers);
  ok(none[0].json.attachments.length === 0);
  let miss = await run('read_attachments.js', {}, [{ json: { reply_to_id: 'x', attach: 'deck,report' }, binary: { deck: { fileName: 'd.pptx' } } }], helpers);
  ok(miss[0].json.attachments.length === 1, 'a file that is not there is skipped');
  let threw = false; try { await run('read_attachments.js', {}, [{ json: { attach: 'deck' } }], helpers); } catch (e) { threw = /reply_to_id/.test(e.message); }
  ok(threw, 'no email to answer: stop');

  // 4. the message: a test brief becomes a draft to one address
  const parts = (msg, boundary) => msg.split('--' + boundary).slice(1, -1).map(p => { const [head, ...body] = p.replace(/^\r\n/, '').split('\r\n\r\n'); return { head, body: body.join('\r\n\r\n').replace(/\r\n$/, '') }; });
  let m = await run('build_mime.js', { 'Read attachments': ra }, ra, helpers);
  let msg = m[0].binary.upload.buf.toString('utf8');
  ok(m[0].json.draft === true && m[0].json.test === true && m[0].json.content_type === 'message/rfc822' && m[0].binary.upload.mimeType === 'message/rfc822' && m[0].json.to.length === 1 && m[0].json.to[0] === 'joseliverio@jml-ops.com' && m[0].json.cc.length === 0);
  ok(msg.startsWith('To: joseliverio@jml-ops.com\r\n') && msg.includes('\r\nReply-To: jose.liverio+proposals@jml-ops.com\r\n') && msg.includes('\r\nSubject: Re: Proposta Equal Food\r\n') && !msg.includes('In-Reply-To') && !msg.includes('Cc:'));
  let b = /boundary="([^"]+)"/.exec(msg)[1];
  let ps = parts(msg, b);
  ok(ps.length === 3 && ps[0].head.includes('text/html') && Buffer.from(ps[0].body.replace(/\r\n/g, ''), 'base64').toString('utf8') === '<p>Hi,</p><p>Olá, notes.</p>', 'the text, then two files');
  ok(ps[1].head.includes('filename="Equal_Food_proposal_draft.pptx"') && ps[1].head.includes('presentationml') && Buffer.from(ps[1].body.replace(/\r\n/g, ''), 'base64').equals(bufs.deck));
  ok(ps[2].head.includes('filename="20261123_Equal_Food_Market_Research.pdf"') && ps[2].head.includes('Content-Type: application/pdf') && Buffer.from(ps[2].body.replace(/\r\n/g, ''), 'base64').equals(bufs.report));
  ok(ps.every(p => p.body.split('\r\n').every(l => l.length <= 76)) && msg.endsWith('--' + b + '--\r\n') && m[0].json.attachment_names.length === 2, 'lines of 76 characters, closed message');
  // 5. the message: a real email is answered in its thread, to everyone but us
  const orig = { threadId: 'T1', payload: { headers: [{ name: 'From', value: 'Ana Partner <ana@firm.pt>' }, { name: 'To', value: 'jose.liverio+proposals@jml-ops.com, "Silva, Rui" <rui@firm.pt>' }, { name: 'Cc', value: 'cfo@firm.pt' }, { name: 'Subject', value: 'Brief: Equal Food' }, { name: 'Message-ID', value: '<abc@mail>' }] } };
  const real = await run('read_attachments.js', {}, reqItem({ reply_to_id: '18c0ffee', test_to: '' }), helpers);
  m = await run('build_mime.js', { 'Read attachments': real }, [{ json: orig }], helpers);
  msg = m[0].binary.upload.buf.toString('utf8');
  ok(m[0].json.draft === false && m[0].json.test === false && m[0].json.thread_id === 'T1' && m[0].json.content_type.startsWith('multipart/related; boundary=') && m[0].json.to.join() === 'ana@firm.pt' && m[0].json.cc.join() === 'rui@firm.pt,cfo@firm.pt', JSON.stringify(m[0].json.cc));
  ok(msg.includes('{"threadId":"T1"}') && msg.includes('Content-Type: message/rfc822') && msg.includes('\r\nIn-Reply-To: <abc@mail>\r\n') && msg.includes('\r\nSubject: Re: Brief: Equal Food\r\n') && !/jose\.liverio\+proposals@jml-ops\.com,/.test(msg.split('\r\nReply-To')[0]), 'in the thread; our own address is not a recipient');
  ok((msg.match(/Content-Disposition: attachment/g) || []).length === 2 && m[0].json.attached === true);
  // the request of today (one file, old field names) still gives the same message
  m = await run('build_mime.js', { 'Read attachments': J({ reply_to_id: '18c0ffee', html: '<p>x</p>', recipients: 'sender', attach_b64: bufs.deck.toString('base64'), attach_name: 'd.pptx', attach_mime: 'application/x-test' }) }, [{ json: orig }], helpers);
  msg = m[0].binary.upload.buf.toString('utf8');
  ok((msg.match(/Content-Disposition: attachment/g) || []).length === 1 && msg.includes('filename="d.pptx"') && m[0].json.cc.length === 0 && m[0].json.attachment_names[0] === 'd.pptx');
  m = await run('build_mime.js', { 'Read attachments': J({ reply_to_id: '18c0ffee', html: '<p>x</p>', recipients: 'all' }) }, [{ json: orig }], helpers);
  ok(m[0].json.attached === false && !(m[0].binary.upload.buf.toString('utf8').includes('Content-Disposition')), 'a reply with no file');
  threw = false; try { await run('build_mime.js', { 'Read attachments': J({ reply_to_id: 'x', html: '' }) }, [{ json: {} }], helpers); } catch (e) { threw = /could not be read/.test(e.message); }
  ok(threw, 'no email to answer and no test address: nothing is built');
  for (const f of ['research_state.js', 'attachments.js', 'read_attachments.js', 'build_mime.js', 'research_input.js', 'assemble_market.js', 'research_into_payload.js']) ok(!/\\u[0-9a-fA-F]{4}/.test(fs.readFileSync(__dirname + '/' + f, 'utf8')), f + ' holds no \\u escapes');
  console.log(n + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
// The research parent's "Start": the caller's run id is used when it has the right shape, else one is made.
(async () => {
  const start = async (j) => (await run('parent_start.js', {}, [{ json: j }]))[0].json;
  let s = await start({ company: 'Equal Food', url: 'www.equalfood.co', run_id: 'run-par-equal-food-1795465000000' });
  assert(s.run_id === 'run-par-equal-food-1795465000000' && s.url === 'https://www.equalfood.co' && s.max_pages === 60);
  s = await start({ company: 'Equal Food', url: 'https://www.equalfood.co' });
  assert(/^run-par-equal-food-\d{13}$/.test(s.run_id));
  s = await start({ company: 'Equal Food', url: 'https://www.equalfood.co', run_id: 'DROP TABLE; x' });
  assert(/^run-par-equal-food-\d{13}$/.test(s.run_id), 'a run id of another shape is not used');
  console.log('3 checks passed (research parent start)');
})().catch(e => { console.error(e); process.exit(1); });
