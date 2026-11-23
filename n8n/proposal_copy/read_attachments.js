// Read attachments (Code, all items). Input: the reply request.
// Step 6 (23 Nov): "Read attachment" of the live "JML send reply", for more than one file. `attach` names one binary
// property ("deck") or several, separated by commas ("deck,report"). Each file is kept as base64, so the later HTTP
// step (which drops binaries) does not lose it. A named file that is not on the item is skipped.
const items = $input.all();
const out = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const j = { ...it.json };
  const props = String(j.attach || '').split(',').map(s => s.trim()).filter(Boolean);
  const files = [];
  for (const prop of props) {
    if (!(it.binary && it.binary[prop])) continue;
    const buf = await this.helpers.getBinaryDataBuffer(i, prop);
    files.push({ b64: buf.toString('base64'), name: it.binary[prop].fileName || 'proposal_draft.pptx', mime: it.binary[prop].mimeType || 'application/octet-stream', bytes: buf.length });
  }
  j.attachments = files;
  if (!j.reply_to_id) throw new Error('send reply: reply_to_id is missing');
  out.push({ json: j, pairedItem: i });
}
return out;
