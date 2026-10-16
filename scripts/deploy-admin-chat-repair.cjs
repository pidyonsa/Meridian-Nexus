const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process'), { Readable } = require('node:stream');
const root = path.resolve(__dirname, '..'), stage = path.join(root, '.tmp/admin-chat-repair-20260909');
const project = 'meridain-nexus', site = 'meridian-nexus';
const gc = (...args) => execFileSync('powershell.exe', ['-NoProfile', '-File', 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1', ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
async function functionDeploy(name) {
  assert.ok(['saveAdminUser', 'askNexusAssistant'].includes(name));
  const before = read(`${name}.before.json`);
  const current = JSON.parse(gc('functions', 'describe', name, '--gen2', '--region=us-central1', `--project=${project}`, '--format=json'));
  assert.equal(current.serviceConfig.revision, before.serviceConfig.revision, 'Live function changed; review first.');
  gc('functions', 'deploy', name, '--gen2', '--region=us-central1', `--project=${project}`, `--source=${path.join(stage, name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, '--quiet', '--format=json');
  const after = JSON.parse(gc('functions', 'describe', name, '--gen2', '--region=us-central1', `--project=${project}`, '--format=json'));
  save(`${name}.after.json`, after);
  assert.equal(after.state, 'ACTIVE');
  for (const key of ['serviceAccountEmail', 'availableMemory', 'availableCpu', 'timeoutSeconds', 'maxInstanceCount', 'minInstanceCount', 'maxInstanceRequestConcurrency', 'environmentVariables', 'secretEnvironmentVariables', 'ingressSettings', 'vpcConnector', 'vpcConnectorEgressSettings']) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], `${key} changed unexpectedly`);
  assert.deepEqual(after.eventTrigger, before.eventTrigger);
  console.log(JSON.stringify({ function: name, revision: after.serviceConfig.revision, configurationPreserved: true }));
}
async function hostingDeploy(kind) {
  assert.ok(['admin', 'chat'].includes(kind));
  assert.equal(read('saveAdminUser.after.json').state, 'ACTIVE');
  if (kind === 'chat') throw new Error('Chat activation needs approved infrastructure and post-deployment checks before publishing.');
  const cliPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
  const cli = require(cliPath), api = require(path.join(cliPath, 'lib/hosting/api')), { Client } = require(path.join(cliPath, 'lib/apiv2'));
  await cli.hosting.channel.list({ project, site, nonInteractive: true });
  const current = await api.getChannel(project, site, 'live'), original = read('hosting.before.json').release.version;
  assert.equal(current.release.version.name.split('/').at(-1), original.name.split('/').at(-1), 'Hosting changed; review first.');
  const client = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true });
  const { body } = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } });
  assert.ok(!body.nextPageToken);
  const files = Object.fromEntries(body.files.map(file => [file.path, file.hash]));
  assert.deepEqual(files, Object.fromEntries(read('hosting-files.before.json').files.map(file => [file.path, file.hash])));
  const uploads = new Map(), changes = ['app.js', 'index.html', 'service-worker.js'];
  for (const name of changes) {
    const data = zlib.gzipSync(fs.readFileSync(path.join(stage, `${kind}-hosting`, name)), { level: 9 });
    const hash = crypto.createHash('sha256').update(data).digest('hex'); files[`/${name}`] = hash; uploads.set(hash, data);
  }
  const version = await api.createVersion(site, { config: current.release.version.config });
  save(`${kind}-hosting.created.json`, { version, files, changes });
  const { body: populated } = await client.post(`/${version}:populateFiles`, { files });
  const uploader = new Client({ urlPrefix: populated.uploadUrl, auth: true });
  for (const hash of populated.uploadRequiredHashes || []) {
    assert.ok(uploads.has(hash), 'Unchanged assets must retain existing hashes.');
    const result = await uploader.request({ method: 'POST', path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: 'stream' }); result.body.resume(); assert.equal(result.status, 200);
  }
  await api.updateVersion(site, version.split('/').at(-1), { status: 'FINALIZED' });
  assert.equal((await api.getChannel(project, site, 'live')).release.version.name, current.release.version.name);
  await api.createRelease(site, 'live', version, { message: 'Admin user saves: keyboard support, clear errors and partial-save recovery. No access-policy changes.' });
  const { body: verified } = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } });
  assert.ok(!verified.nextPageToken); assert.deepEqual(Object.fromEntries(verified.files.map(file => [file.path, file.hash])), files);
  const result = { version, changes, unchangedAssets: body.files.length - changes.length, verifiedAt: new Date().toISOString() };
  save(`${kind}-hosting.after.json`, result); console.log(JSON.stringify(result));
}
const [command, name] = process.argv.slice(2);
Promise.resolve().then(() => command === 'function' ? functionDeploy(name) : command === 'hosting' ? hostingDeploy(name) : Promise.reject(new Error('Use function <saveAdminUser|askNexusAssistant> or hosting admin.'))).catch(error => { console.error(error.message.slice(0, 2000)); process.exitCode = 1; });
