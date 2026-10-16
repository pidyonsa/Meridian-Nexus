'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const Zip = require('../functions/node_modules/jszip');
const { api, json, fnUrl, hash, fileHashes, once } = require('./release-multi-admin.cjs');
const { connect } = require('./release-chat-etl-portal.cjs');
const root = path.resolve(__dirname, '..'), stage = path.join(root, '.tmp/etl-repair-20260922');
const project = 'meridain-nexus', site = 'meridian-nexus', name = 'meridianEtl';
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
const hostingUrl = `https://firebasehosting.googleapis.com/v1beta1`;
const live = () => json(`${hostingUrl}/projects/${project}/sites/${site}/channels/live`);
const assets = ['etls.js', 'index.html', 'service-worker.js'];
async function prepare() {
  assert.equal((await live()).release.version.name, read('hosting.before.json').release.version.name);
  assert.equal((await json(fnUrl(name))).serviceConfig.revision, read('function.before.json').serviceConfig.revision);
  const source = path.join(stage, 'source'), deploy = path.join(stage, 'deploy');
  fs.cpSync(source, deploy, { recursive: true });
  fs.copyFileSync(path.join(root, 'functions/meridian-etl.js'), path.join(deploy, 'meridian-etl.js'));
  const before = fileHashes(source), after = fileHashes(deploy);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const file of Object.keys(before)) if (file !== 'meridian-etl.js') assert.equal(after[file], before[file], file);
  const html = fs.readFileSync(path.join(stage, 'hosting/index.html'), 'utf8');
  const files = read('hosting-files.before.json').files;
  const required = new Set([...html.matchAll(/(?:src|href)="([^":?#]+\.(?:js|css))(?:\?[^"]*)?"/g)].map(m => m[1]).filter(file => files.some(f => f.path === '/' + file)));
  for (const file of required) {
    const dest = path.join(stage, 'hosting', file);
    if (fs.existsSync(dest)) continue;
    const response = await fetch(`https://${site}.web.app/${file}?baseline=${Date.now()}`);
    assert.ok(response.ok, file); const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), files.find(f => f.path === '/' + file).hash, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
    console.log('Staged unchanged browser dependency: ' + file);
  }
  fs.cpSync(path.join(stage, 'hosting'), path.join(stage, 'portal'), { recursive: true });
  fs.copyFileSync(path.join(root, 'public/etls.js'), path.join(stage, 'portal/etls.js'));
  for (const file of ['index.html', 'service-worker.js']) {
    let text = fs.readFileSync(path.join(stage, 'hosting', file), 'utf8');
    text = once(text, 'etls.js?v=20260910-channels-chat', 'etls.js?v=20260922-etl-status');
    if (file === 'service-worker.js') text = once(text, 'const CACHE = "meridian-nexus-20260916-attendance-exclusions";', 'const CACHE = "meridian-nexus-20260922-etl-status";');
    fs.writeFileSync(path.join(stage, 'portal', file), text);
  }
  save('prepared.json', { at: new Date().toISOString(), source: after, assets: Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(stage, 'portal', file)))])) });
}
function test() {
  const expected = read('prepared.json'); assert.deepEqual(fileHashes(path.join(stage, 'deploy')), expected.source);
  assert.equal(hash(fs.readFileSync(path.join(root, 'functions/meridian-etl.js'))), expected.source['meridian-etl.js']);
  execFileSync(process.execPath, ['--test', 'etl-worker/test/engine.test.cjs', 'scripts/tests/etl-api.test.cjs', 'scripts/tests/etl-references.test.cjs', 'scripts/tests/etl-pipelines.test.cjs', 'scripts/tests/resource-storage-error.test.cjs'], { cwd: root, stdio: 'inherit', windowsHide: true });
  execFileSync(process.execPath, ['scripts/tests/etls-browser.cjs'], { cwd: root, stdio: 'inherit', windowsHide: true, env: {
    ...process.env, NEXUS_PORTAL_STAGE: path.join(stage, 'portal'), NEXUS_ETL_TEST_OUTPUT: path.join(stage, 'browser'), NEXUS_ETL_CHANNELS: '1', NEXUS_ETL_APPROVAL_CHECK: '1', NEXUS_ETL_LABEL: 'No-ETLs'
  } });
  for (const file of assets) assert.equal(hash(fs.readFileSync(path.join(stage, 'portal', file))), expected.assets[file]);
  save('tested.json', { ...expected, testedAt: new Date().toISOString() });
}
async function deployApi() {
  assert.ok(!fs.existsSync(path.join(stage, 'api-operation.json')), 'Inspect existing operation before another deployment');
  const before = read('function.before.json'), tested = read('tested.json');
  assert.equal((await json(fnUrl(name))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage, 'deploy')), tested.source);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read('function-iam.before.json'));
  const zip = new Zip();
  for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, 'deploy', file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, 'POST', {});
  const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) });
  assert.ok(response.ok, 'Source upload failed');
  const operation = await json(fnUrl(name) + '?updateMask=buildConfig.source', 'PATCH', { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
  save('api-operation.json', operation); console.log('No-ETLs API source-only build started');
  await waitApi();
}
async function waitApi() {
  const operation = read('api-operation.json');
  for (let i = 0; i < 120; i++) {
    const result = await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
    if (result.done) { save('api-result.json', result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
    assert.ok(i < 119, 'Build still running; resume with wait-api');
    await new Promise(r => setTimeout(r, 10000));
  }
  const before = read('function.before.json'), after = await json(fnUrl(name));
  assert.equal(after.state, 'ACTIVE');
  for (const field of ['timeoutSeconds', 'environmentVariables', 'secretEnvironmentVariables', 'maxInstanceCount', 'minInstanceCount', 'ingressSettings', 'serviceAccountEmail', 'availableMemory', 'availableCpu', 'maxInstanceRequestConcurrency']) assert.deepEqual(after.serviceConfig[field], before.serviceConfig[field], field);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read('function-iam.before.json'));
  save('function.after.json', after); console.log(JSON.stringify({ revision: after.serviceConfig.revision, runtimeAndIamPreserved: true }));
}
async function deployHosting() {
  assert.ok(!fs.existsSync(path.join(stage, 'hosting-created.json')), 'Inspect existing Hosting version before creating another');
  assert.equal(read('function.after.json').state, 'ACTIVE');
  const before = read('hosting.before.json'), current = await live(), tested = read('tested.json');
  assert.equal(current.release.version.name, before.release.version.name);
  const files = Object.fromEntries(read('hosting-files.before.json').files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) {
    const content = fs.readFileSync(path.join(stage, 'portal', file)); assert.equal(hash(content), tested.assets[file]);
    const bytes = zlib.gzipSync(content, { level: 9 }), digest = hash(bytes); files['/' + file] = digest; uploads.set(digest, bytes);
  }
  const version = await json(`${hostingUrl}/sites/${site}/versions`, 'POST', { config: current.release.version.config });
  save('hosting-created.json', { version, files });
  const upload = await json(`${hostingUrl}/${version.name}:populateFiles`, 'POST', { files });
  const { Client, hosting } = await connect();
  const uploader = new Client({ urlPrefix: upload.uploadUrl, auth: true });
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest), 'Unexpected asset upload requested');
    const response = await uploader.request({ method: 'POST', path: '/' + digest, body: Readable.from([uploads.get(digest)]), resolveOnHTTPError: true, responseType: 'stream' });
    response.body.resume(); assert.equal(response.status, 200, 'Asset upload failed');
  }
  await hosting.updateVersion(site, version.name.split('/').at(-1), { status: 'FINALIZED' });
  assert.equal((await live()).release.version.name, before.release.version.name, 'Live Hosting changed during staging');
  await hosting.createRelease(site, 'live', version.name, { message: 'No-ETLs approval/history synchronization; preserve all other portal assets' });
  console.log('Released ' + version.name);
}
async function verify() {
  const created = read('hosting-created.json'), current = await live();
  assert.equal(current.release.version.name.split('/').at(-1), created.version.name.split('/').at(-1));
  assert.deepEqual(current.release.version.config, read('hosting.before.json').release.version.config);
  const listed = await json(`${hostingUrl}/${current.release.version.name}/files?pageSize=1000`);
  assert.ok(!listed.nextPageToken);
  assert.deepEqual(Object.fromEntries(listed.files.map(f => [f.path, f.hash])), created.files);
  for (const file of assets) {
    let matched = false;
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (response.ok && hash(Buffer.from(await response.arrayBuffer())) === read('tested.json').assets[file]) { matched = true; break; }
      await new Promise(r => setTimeout(r, 5000));
    }
    assert.ok(matched, 'Live asset not propagated: ' + file);
  }
  const fn = await json(fnUrl(name)), expected = read('function.after.json');
  assert.equal(fn.serviceConfig.revision, expected.serviceConfig.revision);
  const source = fn.buildConfig.source.storageSource;
  const zip = await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
  for (const [file, digest] of Object.entries(read('tested.json').source)) assert.equal(hash(await zip.file(file).async('nodebuffer')), digest, 'Deployed source mismatch: ' + file);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`), read('function-iam.before.json'));
  const job = await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`);
  assert.deepEqual(job.template, read('job.before.json').template, 'Worker configuration changed');
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${job.name}:getIamPolicy`), read('job-iam.before.json'));
  const anonymous = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { action: 'catalogue' } }) });
  assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).error.status, 'UNAUTHENTICATED');
  const report = { verifiedAt: new Date().toISOString(), revision: fn.serviceConfig.revision, hosting: current.release.version.name, changedAssets: assets, anonymousDenied: true, workerAndIamPreserved: true, businessOutputsApproved: false };
  save('verified.json', report); console.log(JSON.stringify(report, null, 2));
}
const actions = { prepare, test, 'deploy-api': deployApi, 'wait-api': waitApi, 'deploy-hosting': deployHosting, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
