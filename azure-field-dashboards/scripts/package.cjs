'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const archiver = require('archiver');
const root = path.resolve(__dirname, '..');
const engine = require('./build-data-engine.cjs').build();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/asset-manifest.json'), 'utf8'));
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
const file = path.join(root, 'dist/meridian-field-dashboards.zip'), output = fs.createWriteStream(file);
const archive = archiver('zip', {zlib: {level: 9}});
archive.on('error', error => { throw error; });
archive.pipe(output);
for (const entry of manifest.files) {
  const source = path.join(root, 'public', entry.path);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), entry.sha256);
  archive.file(source, {name: 'public/' + entry.path});
}
const serverFiles = ['public/asset-manifest.json', 'server/main.cjs', 'server/nexus-portal.cjs', 'server/azure-reports.cjs', 'server/snapshot-data.cjs', 'server/report-engine/manifest.json', 'package-lock.json', ...engine.map(file => 'server/report-engine/' + file.path)];
for (const relative of serverFiles) archive.file(path.join(root, relative), {name: relative});
// The full Nexus portal (/nexus/), checked against its manifest from scripts/fetch-nexus-portal.cjs.
const portal = JSON.parse(fs.readFileSync(path.join(root, 'nexus-portal/manifest.json'), 'utf8'));
for (const entry of portal.files) {
  const source = path.join(root, 'nexus-portal', entry.path);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), entry.sha256, entry.path);
  archive.file(source, {name: 'nexus-portal' + entry.path});
}
archive.file(path.join(root, 'nexus-portal/manifest.json'), {name: 'nexus-portal/manifest.json'});
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
pkg.scripts = {start: pkg.scripts.start};
delete pkg.devDependencies;
archive.append(JSON.stringify(pkg, null, 2), {name: 'package.json'});
output.on('close', () => console.log(`${file}: ${archive.pointer()} bytes; ${manifest.files.length + serverFiles.length + portal.files.length + 2} allowlisted files; no source workbooks, snapshots or credentials.`));
archive.finalize();
