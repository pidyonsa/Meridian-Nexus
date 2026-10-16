const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {patch} = require('./attendance-portal-patch.cjs');
const {once, hash} = require('./release-multi-admin.cjs');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.tmp/attendance-analytics-20260910-v4');
const backup = path.join(stage, 'local-before');
const tag = '20260910-attendance-analytics4';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const normal = text => text.replace(/\r\n/g, '\n');
const plans = [];
function add(file, after) { plans.push({file, before:read(file), after}); }

// Apply the tested migration to current local files, never replace them with a
// deployed snapshot: local Chat, Admin and ETL changes must remain intact.
const app = read('public/app.js');
assert.ok(!app.includes('window.NexusAttendance.render('), 'Local integration already applied');
add('public/app.js', patch(normal(app)));
let index = read('functions/index.js');
const handler = index.match(/exports\.getGeoRepAttendanceDashboard = onCall\([^]*?\n\}\);/)[0];
index = once(index, handler, read('functions/attendance-analytics-entry.txt').trim());
const reader = index.match(/async function readGeoRepAttendanceSource\([^]*?\n\}/)[0];
const eol = reader.includes('\r\n') ? '\r\n' : '\n';
let enhanced = once(reader, '  const rows = [];', '  const rows = [];'+eol+'  const sourceRowNumbers = [];');
enhanced = once(enhanced, '    rows.push(values);', '    rows.push(values);'+eol+'    sourceRowNumbers.push(rowNumber);');
enhanced = once(enhanced, '    salesRepRows: selectedRows,', '    salesRepRows: selectedRows,'+eol+'    sourceRowNumbers: sourceRowNumbers.filter((_, i) => roleIndex >= 0 && geoRepAttendanceRoleGroup(rows[i][roleIndex]) === audience),');
add('functions/index.js', once(index, reader, enhanced));
let html = read('public/index.html');
html = once(html, '  <script defer src="app.js?v=20260910-fast-pages"></script>', `  <link rel="stylesheet" href="attendance-analytics.css?v=${tag}" />\n  <script defer src="attendance-analytics.js?v=${tag}"></script>\n  <script defer src="app.js?v=${tag}"></script>`);
add('public/index.html', html);
let sw = read('public/service-worker.js');
sw = once(sw, 'meridian-nexus-v59-fast-pages', `meridian-nexus-${tag}`);
sw = once(sw, '/app.js?v=20260910-fast-pages', `/app.js?v=${tag}`);
sw = once(sw, 'const SHELL = [', `const SHELL = ["/attendance-analytics.js?v=${tag}","/attendance-analytics.css?v=${tag}",`);
add('public/service-worker.js', sw);

assert.ok(!fs.existsSync(backup), 'Preserve local integration backup');
for (const plan of plans) {
  const dest = path.join(backup, plan.file);
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.writeFileSync(dest, plan.before);
  fs.writeFileSync(path.join(root, plan.file), plan.after);
}
const hierarchy = JSON.parse(fs.readFileSync(path.join(stage, 'hierarchy.json'), 'utf8'));
assert.ok(!fs.existsSync(path.join(root, 'functions/attendance-hierarchy.json')));
fs.writeFileSync(path.join(root, 'functions/attendance-hierarchy.json'), JSON.stringify({sourceName:hierarchy.sourceName, sha256:hierarchy.sha256, rows:hierarchy.rows}, null, 2)+'\n');
for (const file of ['public/app.js', 'public/attendance-analytics.js', 'public/service-worker.js', 'functions/index.js', 'functions/attendance-analytics.js']) execFileSync(process.execPath, ['--check', file], {cwd:root, stdio:'inherit', windowsHide:true});
fs.writeFileSync(path.join(stage, 'local-integrated.json'), JSON.stringify({at:new Date().toISOString(), files:plans.map(p=>({file:p.file, before:hash(p.before), after:hash(p.after)})), privateHierarchyRows:hierarchy.rows.length, deployedFromLocal:false}, null, 2));
console.log('Scoped attendance changes integrated; other local work preserved. Syntax checks passed.');
