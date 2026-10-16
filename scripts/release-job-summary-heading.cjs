'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), zlib = require('node:zlib'), {Readable} = require('node:stream');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), stage = path.join(root, '.tmp/job-summary-heading-20260916');
const site = 'meridian-nexus', project = 'meridain-nexus', tag = '20260916-job-summary-heading';
const cliPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const cli = require(cliPath), hosting = require(path.join(cliPath, 'lib/hosting/api')), {Client} = require(path.join(cliPath, 'lib/apiv2'));
const assets = ['index.html', 'app.js', 'service-worker.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => value.replace('projects/730011371323/', `projects/${project}/`);
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
function save(name, value) {
  const file = path.join(stage, name); fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2));
}
function once(text, before, after) {
  assert.equal(text.split(before).length, 2, `Expected exactly one patch anchor: ${before}`);
  return text.replace(before, () => after);
}
async function connect() {
  await cli.hosting.channel.list({project, site, nonInteractive:true});
  return new Client({urlPrefix:'https://firebasehosting.googleapis.com', apiVersion:'v1beta1', auth:true});
}
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, 'before.json')), 'Preserve the reviewed baseline');
  const client = await connect(), current = await hosting.getChannel(project, site, 'live');
  const {body} = await client.get(`/${current.release.version.name}/files`, {queryParams:{pageSize:1000}});
  assert.ok(!body.nextPageToken);
  const updated = {};
  for (const name of assets) {
    const response = await fetch(`https://${site}.web.app/${name}?review=${Date.now()}`, {headers:{'Cache-Control':'no-cache'}});
    assert.ok(response.ok); const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(zlib.gzipSync(bytes, {level:9})), body.files.find(f => f.path === '/' + name)?.hash, `Live baseline mismatch: ${name}`);
    save('baseline/' + name, bytes); updated[name] = bytes.toString('utf8');
  }
  const anchor = '  elements.attendanceDashboardView.classList.toggle("attendance-jobs-active", showAttendanceJobs);';
  updated['app.js'] = once(updated['app.js'], anchor, anchor + '\n  document.getElementById("attendanceStandardHeader").hidden = showAttendanceJobs;\n  document.getElementById("attendanceStandardControls").hidden = showAttendanceJobs;');
  updated['index.html'] = once(updated['index.html'], '<section id="attendanceStandardHeader" class="attendance-callcycle-header">', '<section id="attendanceStandardHeader" class="attendance-callcycle-header" hidden>');
  updated['index.html'] = once(updated['index.html'], '<header class="job-summary-heading"><div><p class="eyebrow">Time &amp; Attendance</p><h1>Job Summaries</h1>', '<header class="job-summary-heading"><div><h1>Job Summaries</h1>');
  for (const name of ['index.html', 'service-worker.js']) {
    const old = updated[name].match(/app\.js\?v=[^"']+/)?.[0]; assert.ok(old);
    updated[name] = once(updated[name], old, `app.js?v=${tag}`);
  }
  const cache = updated['service-worker.js'].match(/^const CACHE = "[^"]+";/)?.[0]; assert.ok(cache);
  updated['service-worker.js'] = once(updated['service-worker.js'], cache, `const CACHE = "meridian-nexus-${tag}";`);
  for (const name of assets) save('assets/' + name, updated[name]);
  for (const name of ['app.js', 'service-worker.js']) execFileSync(process.execPath, ['--check', path.join(stage, 'assets', name)], {windowsHide:true});
  save('before.json', {current, files:body.files});
  save('manifest.json', Object.fromEntries(assets.map(name => [name, hash(Buffer.from(updated[name]))])));
  console.log(JSON.stringify({baseline:current.release.version.name, changed:assets, rulesChanged:0, functionsChanged:0}));
}
async function deploy() {
  const before = read('before.json'), manifest = read('manifest.json'), client = await connect();
  const current = await hosting.getChannel(project, site, 'live');
  assert.equal(canonical(current.release.version.name), canonical(before.current.release.version.name), 'Production changed since review');
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const name of assets) {
    const bytes = fs.readFileSync(path.join(stage, 'assets', name)); assert.equal(hash(bytes), manifest[name]);
    const gzip = zlib.gzipSync(bytes, {level:9}), digest = hash(gzip); files['/' + name] = digest; uploads.set(digest, gzip);
  }
  const version = await hosting.createVersion(site, {config:current.release.version.config}); save('created.json', {version, files});
  const populated = await client.post(`/${version}:populateFiles`, {files}), uploader = new Client({urlPrefix:populated.body.uploadUrl, auth:true});
  for (const digest of populated.body.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest));
    const response = await uploader.request({method:'POST', path:`/${digest}`, body:Readable.from([uploads.get(digest)]), resolveOnHTTPError:true, responseType:'stream'});
    response.body.resume(); assert.equal(response.status, 200);
  }
  await hosting.updateVersion(site, version.split('/').at(-1), {status:'FINALIZED'});
  assert.equal(canonical((await hosting.getChannel(project, site, 'live')).release.version.name), canonical(current.release.version.name));
  await hosting.createRelease(site, 'live', version, {message:'Job Summaries heading only; hide shared attendance banner, preserve report data and other pages'});
  await verify();
}
async function verify() {
  const {version, files} = read('created.json'), client = await connect();
  assert.equal(canonical((await hosting.getChannel(project, site, 'live')).release.version.name), canonical(version));
  const {body} = await client.get(`/${version}/files`, {queryParams:{pageSize:1000}}); assert.ok(!body.nextPageToken);
  assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), files);
  for (const name of assets) {
    let matched = false; const expected = fs.readFileSync(path.join(stage, 'assets', name));
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, {headers:{'Cache-Control':'no-cache'}});
      if (response.ok && Buffer.from(await response.arrayBuffer()).equals(expected)) { matched = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(matched, `Propagation not verified: ${name}`);
  }
  const result = {version, changed:assets, preservedAssets:read('before.json').files.length-assets.length, verifiedAt:new Date().toISOString()};
  save('verified.json', result); console.log(JSON.stringify(result));
}
const actions = {prepare, deploy, verify};
if (!actions[process.argv[2]]) throw Error('Use prepare, deploy or verify');
actions[process.argv[2]]().catch(error => {console.error(error.message); process.exitCode=1;});
