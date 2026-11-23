// Builds the upload that turns the report into a Google Doc. The folder named in the input is used when it exists; otherwise the Doc goes to My Drive and the result says so.
const start = $('Start').first().json;
const rep = $('Assemble the report').first().json;
const match = $input.all().map(i => i.json || {}).filter(f => f.id && start.folder_name && String(f.name || '').trim().toLowerCase() === start.folder_name.toLowerCase());
const folder_id = match.length ? match[0].id : '';
const meta = { name: rep.title, mimeType: 'application/vnd.google-apps.document' };
if (folder_id) meta.parents = [folder_id];
const b = 'jmlresearchreportboundary';
const body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' + rep.html + '\r\n--' + b + '--';
const folder_note = !start.folder_name ? 'No folder was named: the Doc is in My Drive.' : (folder_id ? 'The Doc is in the folder ' + start.folder_name + '.' : 'The folder ' + start.folder_name + ' was not found: the Doc is in My Drive.');
return [{ json: { body, folder_note, folder_id } }];