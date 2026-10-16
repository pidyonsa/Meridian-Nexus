'use strict';
// One-time, allowlisted extraction. Never changes or removes the original Nexus.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), original = path.dirname(root);
const manifest = [];
function write(source, destination, transform = value => value) {
  const input = fs.readFileSync(path.join(original, source));
  const output = transform(input);
  const target = path.join(root, destination);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, output);
  manifest.push({source, destination, sourceSha256:crypto.createHash('sha256').update(input).digest('hex'), sha256:crypto.createHash('sha256').update(output).digest('hex')});
}
write('functions/attendance-analytics.js', 'server/domain/attendance.cjs', b => {
  const s = b.toString();
  if (!s.includes('function createService(deps)')) throw Error('Attendance extraction boundary changed');
  return s.slice(0, s.indexOf('function createService(deps)'))
    .replace("const expected = audience === 'rep'", "if (!sourceRows.length) for (const name of planned) observed.add(name);\n  const expected = audience === 'rep'")
    .replace('issue:!observed.has(key(r.name)) ?', 'issue:sourceRows.length && !observed.has(key(r.name)) ?')
    + '\nmodule.exports = {division,resultStatus,buildDataset,dashboard,detail,excel};\n';
});
write('functions/franchise-orders.js', 'server/domain/orders.cjs', b => {
  let s = b.toString();
  if (!s.includes('function createReader(')) throw Error('Orders extraction boundary changed');
  s = s.slice(0, s.indexOf('function createReader('));
  s = s.replace('function normalise(document) {\r\n  const data = document.data();', 'function normalise(data) {')
       .replace('function normalise(document) {\n  const data = document.data();', 'function normalise(data) {')
       .replace('id: document.id', 'id: data.id')
       .replace('Nexus Firestore', 'Azure Cosmos DB');
  return s + '\nmodule.exports = {selection,normalise,report,metrics};\n';
});
write('public/attendance-analytics.js', 'public/attendance.js');
write('public/attendance-analytics.css', 'public/attendance.css', b => b.toString().split(/\r?\n/).filter(l => !l.includes('callcycle')).join('\n'));
write('public/styles.css', 'public/attendance-base.css', b => b.toString().split(/\r?\n/).filter(l => l.startsWith('.pg-source-')).join('\n'));
write('public/franchise-orders.js', 'public/orders.js', b => b.toString()
  .replace('${button("assistant","sparkle","Ask Nexus Assistant")}', '')
  .replaceAll('Nexus Firestore','Azure Cosmos DB')
  .replace('x-left>60 && width-right-x>60','x-points[0].x>95 && points.at(-1).x-x>95')
  .split(/\r?\n/).filter(l => !l.includes('action === "assistant"')).join('\n'));
write('public/franchise-orders.css', 'public/orders.css', b => b.toString().split(/\r?\n/).filter(l=>!l.includes('#franchiseOrderView') && !l.includes('data-fo-action="assistant"')).join('\n'));
write('public/sales-insights-source/assets/meridian-logo-white.png', 'public/assets/meridian-logo.png');
fs.writeFileSync(path.join(root,'PORT_MANIFEST.json'), JSON.stringify({edition:'Azure: syndicated attendance and Franchise Orders only', files:manifest}, null, 2) + '\n');
process.stdout.write(`Extracted ${manifest.length} allowlisted files; original files unchanged.\n`);
