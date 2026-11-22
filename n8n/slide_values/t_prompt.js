const { run } = require('./harness');
(async () => {
  for (const [file, company, website] of [['ef_rows_1.json', 'Equal Food', 'https://www.equalfood.co'], ['n8n_rows_1.json', 'n8n', 'https://n8n.io']]) {
    const rows = JSON.parse(require('fs').readFileSync(__dirname + '/' + file, 'utf8'));
    const outs = { Start: [{ json: { run_id: rows[0].run_id, company, website } }] };
    const b = await run('build.js', { outs, input: rows.map(r => ({ json: r })) });
    const j = b[0].json;
    console.log('=====', company, '| prompt chars', j.prompt.length, '| found', JSON.stringify(j.found), '| offer', j.offerType, '| pricing', j.pricing);
    console.log(j.competitors.map(c => c.entry + ' ' + c.name + ' [' + c.fact + '] pts ' + c.points.length + ' same ' + JSON.stringify(c.same)).join('\n'));
    if (company === 'Equal Food') console.log(j.prompt);
    require('fs').writeFileSync(__dirname + '/build_' + company.replace(/ /g, '') + '.json', JSON.stringify(j));
  }
})().catch(e => { console.error(e); process.exit(1); });
