'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.resolve(root, '../firebase-dashboards/backend');
const files = ['service.cjs', 'product-clients.cjs', 'order-regions.cjs', 'order-regional-analytics.cjs', 'attendance-overview.cjs', 'report-cache.cjs', 'vendor/attendance.cjs', 'vendor/orders.cjs', 'vendor/attendance-exclusions-core.js', 'vendor/hierarchy.json', 'vendor/source-reader.cjs'];
function build() {
  const manifest = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(source, file));
    const target = path.join(root, 'server/report-engine', file);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, bytes);
    manifest.push({path:file, sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  fs.writeFileSync(path.join(root, 'server/report-engine/manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
if (require.main === module) console.log(`Copied ${build().length} unchanged report-engine files; no Google SDK or entry point.`);
module.exports = {build};
