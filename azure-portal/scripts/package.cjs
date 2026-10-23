'use strict';
// Builds dist/meridian-nexus-portal.zip: an allowlisted copy of the runtime (server/, public/, migrations/,
// package files) with production dependencies only. Tests, scripts, dev tools and local data are never packaged.
//   node scripts/package.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const stage = path.join(dist, 'stage');
const zip = path.join(dist, 'meridian-nexus-portal.zip');
// Windows' own bsdtar writes zip files (Git's GNU tar on PATH cannot).
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const INCLUDE = ['server', 'public', 'migrations', 'package.json', 'package-lock.json'];

fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(stage, {recursive: true});
for (const entry of INCLUDE) fs.cpSync(path.join(root, entry), path.join(stage, entry), {recursive: true});

// The deployed package.json keeps only what App Service needs to start.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({name: pkg.name, private: true, engines: pkg.engines, scripts: {start: pkg.scripts.start}, dependencies: pkg.dependencies}, null, 2));
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {cwd: stage, stdio: 'inherit', shell: process.platform === 'win32'});

execFileSync(TAR, ['-a', '-c', '-f', zip, '-C', stage, '.'], {stdio: 'inherit'});
const files = execFileSync(TAR, ['-t', '-f', zip], {encoding: 'utf8'}).split(/\r?\n/).filter(f => f && !f.endsWith('/'));
for (const banned of [/^\.\/tests\//, /^\.\/test-results\//, /^\.\/scripts\//, /\.env$/, /node_modules\/playwright/]) {
  if (files.some(f => banned.test(f))) throw new Error(`package contains a forbidden path: ${banned}`);
}
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
console.log(JSON.stringify({zip: path.relative(root, zip), files: files.length, bytes: fs.statSync(zip).size, sha256}));
