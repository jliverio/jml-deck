// Attachments (Code, run once for all items). Step 6 (23 Nov): what the reply carries and what it says.
//   binary.deck        the deck, as "Name attachment" named it
//   binary.report      the market research report (PDF), when the research filled the slides and Drive returned the file
//   reply_attach       the files for the reply: "deck,report" or "deck"
//   reply_note_html    the notes of the email: the flow's own notes, without the sentence about the old market slide
//                      (template 1.5), plus the lines about the research, the report and the colours
//   review_report_html a link to the report for the email that holds a draft for review (José has the Drive)
const base = $('Name attachment').first();
const get = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const R = get('Assemble market').research || {};
const email = get('Build render payload').email || {};
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const binary = { deck: base.binary.deck };
const hasSlides = !!(R.slides && (R.slides.profile || R.slides.compare));
let report_attached = false;
if (hasSlides && R.pdf_file_id) {
  try {
    const d = $('Download report').first();
    if (d && d.binary && d.binary.report && !(d.json && d.json.error)) {
      binary.report = Object.assign({}, d.binary.report, { fileName: R.pdf_name || 'Market_Research.pdf', fileExtension: 'pdf', mimeType: 'application/pdf' });
      report_attached = true;
    }
  } catch (e) { report_attached = false; }
}
const lines = [];
if (hasSlides) {
  lines.push(report_attached ? 'The market research behind the two research slides is attached as a PDF, with its sources.'
    : 'The market research report could not be attached this time. The two research slides name their sources.');
  if (Array.isArray(R.thin) && R.thin.length) lines.push('The research was thin on some points: where a slide says "Not public", no public source was found.');
} else if (R.state === 'timeout') lines.push('The market research was still running when this draft had to leave, so the deck has no market research slides.');
else if (R.state === 'failed') lines.push("The client's website could not be read, so the deck has no market research slides.");
else if (R.asked) lines.push('The market research found nothing it could source, so the deck has no market research slides.');
else lines.push('No market research was run, so the deck has no market research slides.' + (R.why && email.client_verified !== false ? ' ' + R.why : ''));
if (!R.colour_applied) lines.push(R.colour_note || "This deck is in JML colours. Reply with the client's main colour as a HEX code (for example #E60000) and the same deck comes back in that colour.");
const flowNotes = String(email.note_html || '').replace(/<p>No market finding passed the source checks[^<]*<\/p>/g, '');
const reply_note_html = flowNotes + lines.map(l => '<p>' + esc(l) + '</p>').join('');
const review_report_html = R.pdf_url ? '<p>Market research report (PDF): <a href="' + esc(R.pdf_url) + '">' + esc(R.pdf_name || 'open the report') + '</a></p>' : '';
return [{ json: Object.assign({}, base.json, { report_attached, reply_attach: report_attached ? 'deck,report' : 'deck', research_lines: lines, reply_note_html, review_report_html }), binary }];
