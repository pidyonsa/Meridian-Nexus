const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.tmp/multi-admin-20260910');
const project = 'meridain-nexus', site = 'meridian-nexus';
const JSZip = require(path.join(root, 'functions/node_modules/jszip'));
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
const source = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const save = (name, value) => { const file = path.join(stage, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
let token = '', tokenAt = 0;
async function api(url, method = 'GET', body, refreshed = false) {
  if (Date.now() - tokenAt > 2400000) {
    token = execFileSync('powershell.exe', ['-NoProfile', '-File', 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1', 'auth', 'print-access-token', `--project=${project}`, '--quiet'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] }).trim();
    tokenAt = Date.now();
  }
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': project }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 401 && !refreshed) {
    await response.arrayBuffer(); tokenAt = 0;
    return api(url, method, body, true);
  }
  if (!response.ok) throw new Error(`${method} ${response.status}: ${(await response.text()).slice(0, 1500)}`);
  return response;
}
const json = async (...args) => (await api(...args)).json();
const fnUrl = name => `https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions/${name}`;
async function listFunctions() {
  const items = []; let next = '';
  do { const data = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions?pageSize=1000${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`); items.push(...data.functions || []); next = data.nextPageToken; } while (next);
  return items;
}
const liveHosting = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${site}/channels/live`);
async function audit() {
  assert.ok(!fs.existsSync(path.join(stage, 'audit-complete.json')), 'Audit already completed; preserve its baseline.');
  const functions = await listFunctions(); save('functions.before.json', functions);
  const manifest = [];
  for (const config of functions) {
    if (config.eventTrigger) continue;
    const name = config.name.split('/').at(-1), s = config.buildConfig.source?.storageSource;
    if (!s || /^(runScheduled|detectStalled|retryLocked|retryFailedGeoRep|finalizeExpired|retrySalesforceAttendanceReportLoadFailures|deliverMeridianChatReminders)/.test(name)) continue;
    const archive = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    if (!archive.file('index.js')) continue;
    const index = await archive.file('index.js').async('string');
    const callable = new RegExp(`exports\\.${name}\\s*=\\s*(?:onCall|callable)\\b`).test(index);
    if (!callable) { console.log(`SKIP non-callable ${name}`); continue; }
    const dest = path.join(stage, 'sources', name);
    for (const e of Object.values(archive.files)) {
      if (e.dir) continue;
      const target = path.resolve(dest, e.name); assert.ok(target.startsWith(dest + path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, await e.async('nodebuffer'));
    }
    const iam = await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`);
    save(`iam/${name}.before.json`, iam);
    manifest.push({ name, revision: config.serviceConfig.revision });
    console.log(`AUDITED ${name} ${config.serviceConfig.revision}`);
  }
  save('callables.before.json', manifest);
  const hosting = await liveHosting(); save('hosting.before.json', hosting);
  const files = await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);
  assert.ok(!files.nextPageToken); save('hosting-files.before.json', files);
  for (const name of ['app.js', 'index.html', 'service-worker.js', 'styles.css', 'user-management.css']) {
    const response = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`); assert.ok(response.ok);
    const data = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(zlib.gzipSync(data, { level: 9 })), files.files.find(f => f.path === '/' + name)?.hash, `Public asset differs from release: ${name}`);
    save(`live-${name}`, data.toString('utf8'));
  }
  const releases = await json(`https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=100`);
  assert.ok(!releases.nextPageToken); save('rules-releases.before.json', releases);
  for (const release of releases.releases.filter(r => /\/cloud.firestore$|\/firebase.storage\/meridain-nexus.firebasestorage.app$/.test(r.name))) {
    const rules = await json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
    const kind = release.name.endsWith('/cloud.firestore') ? 'firestore' : 'storage';
    assert.equal(rules.source.files.length, 1); save(`${kind}.before.json`, { release, rules }); save(`${kind}.before.rules`, rules.source.files[0].content);
  }
  save('audit-complete.json', { at: new Date().toISOString(), callables: manifest.length, hosting: hosting.release.version.name });
  console.log(`Audit complete: ${manifest.length} callables. No production changes.`);
}
function once(text, from, to) { assert.equal(text.split(from).length, 2, `Expected one anchor: ${from.slice(0, 100)}`); return text.replace(from, () => to); }
function block(text, re) { const found = text.match(re)?.[0]; assert.ok(found, `Missing ${re}`); return found; }
const fn = name => new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
const ruleFn = name => new RegExp(`    function ${name}\\(\\) \\{[^]*?\\n    \\}`);
function fileHashes(base) {
  const result = {};
  function walk(folder) { for (const e of fs.readdirSync(folder, { withFileTypes: true })) {
    if (['node_modules', '.git', '.gcloudignore'].includes(e.name)) continue;
    const file = path.join(folder, e.name); if (e.isDirectory()) walk(file); else { assert.ok(e.isFile()); result[path.relative(base, file).replaceAll('\\', '/')] = hash(fs.readFileSync(file)); }
  } }
  walk(base); return result;
}
async function auditBuiltCallables() {
  const manifest = read('callables.before.json');
  for (const name of ['meridianChat', 'meridianChatMedia', 'getFranchiseOrderDashboard']) {
    if (manifest.some(x => x.name === name)) continue;
    const config = read('functions.before.json').find(x => x.name.endsWith('/' + name)); assert.ok(config);
    assert.equal((await json(fnUrl(name))).serviceConfig.revision, config.serviceConfig.revision);
    const s = config.buildConfig.source.storageSource;
    const archive = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    const dest = path.join(stage, 'sources', name);
    for (const e of Object.values(archive.files)) {
      if (e.dir) continue;
      const target = path.resolve(dest, e.name); assert.ok(target.startsWith(dest + path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, await e.async('nodebuffer'));
    }
    save(`iam/${name}.before.json`, await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    manifest.push({ name, revision: config.serviceConfig.revision }); console.log(`AUDITED ${name} ${config.serviceConfig.revision}`);
  }
  save('callables.before.json', manifest);
  save('audit-complete.json', { ...read('audit-complete.json'), callables: manifest.length, builderCallablesAudited: true });
}
function prepare() {
  assert.equal(read('audit-complete.json').builderCallablesAudited, true);
  const local = file => source(path.join(root, file));
  const full = local('functions/index.js'), helper = local('functions/admin-access.js');
  const manifest = [];
  for (const item of read('callables.before.json')) {
    const original = path.join(stage, 'sources', item.name), dest = path.join(stage, 'deploy', item.name);
    fs.mkdirSync(dest, { recursive: true }); fs.cpSync(original, dest, { recursive: true });
    const before = source(path.join(original, 'index.js')); let index = before;
    const changes = [], replacements = [];
    const replace = (from, to) => { if (from === to) return; index = once(index, from, to); replacements.push([from, to]); };
    if (/function requestRole\(/.test(index)) {
      replace(block(index, fn('requestRole')), block(full, fn('requestRole')));
      if (!index.includes('guardCallables(firebaseOnCall')) {
        replace('const { onCall, HttpsError } = require("firebase-functions/v2/https");', 'const { onCall: firebaseOnCall, HttpsError } = require("firebase-functions/v2/https");');
        replace('initializeApp();', 'const onCall = require("./admin-access").guardCallables(firebaseOnCall, { db: () => getFirestore(), getAuth, HttpsError });\ninitializeApp();');
      }
      if (['saveAdminUser', 'deleteAdminUser'].includes(item.name)) {
        const re = new RegExp(`exports\\.${item.name} = onCall\\([^]*?\\n\\}\\);`);
        replace(block(index, re), block(full, re));
        fs.writeFileSync(path.join(dest, 'admin-user-errors.js'), local('functions/admin-user-errors.js'));
      }
      fs.writeFileSync(path.join(dest, 'admin-access.js'), helper);
      let reversed = index; for (const [from, to] of [...replacements].reverse()) reversed = once(reversed, to, from);
      assert.equal(reversed, before, 'Unrelated handlers must be identical.');
      fs.writeFileSync(path.join(dest, 'index.js'), index);
    } else if (item.name === 'getFranchiseOrderDashboard') {
      const file = path.join(dest, 'franchise-orders.js'), old = source(file);
      const from = 'const admin = claims.admin === true && user.email?.toLowerCase() === "admin@nexus.co.za";';
      const to = 'const admin = claims.admin === true && request.auth.token?.admin === true && require("./admin-access").isAdminProfile(profile);';
      fs.writeFileSync(file, old.includes(from) ? once(old, from, to) : old);
      assert.ok(source(file).includes(to)); fs.writeFileSync(path.join(dest, 'admin-access.js'), helper);
    } else {
      assert.ok(['meridianChat', 'meridianChatMedia', 'meridianEtl'].includes(item.name), `Review unfamiliar callable: ${item.name}`);
      for (const file of Object.keys(fileHashes(original)).filter(x => x.endsWith('.js'))) {
        assert.ok(!source(path.join(original, file)).includes('admin@nexus.co.za'), `Unexpected reserved email in ${item.name}/${file}`);
      }
    }
    const beforeHashes = fileHashes(original), afterHashes = fileHashes(dest);
    for (const file of Object.keys(afterHashes)) if (beforeHashes[file] !== afterHashes[file]) changes.push(file);
    for (const file of Object.keys(beforeHashes)) assert.ok(afterHashes[file], `File removed: ${file}`);
    for (const file of changes.filter(x => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', path.join(dest, file)]);
    manifest.push({ ...item, changes, files: afterHashes });
  }
  save('functions.manifest.json', manifest);
  for (const kind of ['firestore', 'storage']) {
    const baseline = source(path.join(stage, `${kind}.before.rules`)), current = local(`${kind}.rules`);
    assert.ok(!baseline.includes('function activeAdminProfile()'));
    const before = block(baseline, ruleFn('isAdmin')), after = block(current, ruleFn('isAdmin')) + '\n' + block(current, ruleFn('activeAdminProfile'));
    let rules = once(baseline, before, after); assert.equal(once(rules, after, before), baseline);
    if (kind === 'storage') {
      rules = once(rules, block(rules, ruleFn('isOperationsUser')), block(current, ruleFn('isOperationsUser')));
      rules = once(rules, '&& (request.auth.token.admin == true\n', '&& (isAdmin()\n');
      assert.ok(!rules.includes('request.auth.token.admin'));
    }
    save(`${kind}.rules`, rules);
  }
  const appBefore = source(path.join(stage, 'live-app.js')), localApp = local('public/app.js');
  let app = appBefore; const replacements = [];
  for (const re of [fn('editAdminUser'), fn('renderAdminUsers'), /elements\.adminUserForm\.addEventListener\("submit", async \(event\) => \{[^]*?\n\}\);/]) {
    const from = block(app, re), to = block(localApp, re); app = once(app, from, to); replacements.push([from, to]);
  }
  const from = 'const role = email === "admin@nexus.co.za" && token.claims.admin === true';
  const to = 'const role = token.claims.admin === true && token.claims.chatClient !== true && token.claims.nexusRole !== "client"';
  app = once(app, from, to); replacements.push([from, to]);
  const eventFrom = block(app, /elements\.adminUserRole\.addEventListener\("change", [^]*?\);\n/);
  const eventTo = 'elements.adminUserRole.addEventListener("change", () => {\n  renderAdminUserNavigation([...elements.adminUserNavigation].filter(input => input.checked).map(input => input.value), elements.adminUserRole.value, [...elements.adminUserNavigation].some(input => input.value === "chat" && input.checked));\n  syncAdminChatFields();\n});\n';
  app = once(app, eventFrom, eventTo); replacements.push([eventFrom, eventTo]);
  let reversed = app; for (const [old, updated] of [...replacements].reverse()) reversed = once(reversed, updated, old); assert.equal(reversed, appBefore);
  assert.ok(!app.includes('admin@nexus.co.za')); save('portal/app.js', app);
  const index = once(source(path.join(stage, 'live-index.html')), 'app.js?v=20260910-fast-pages', 'app.js?v=20260910-multi-admin');
  let worker = once(source(path.join(stage, 'live-service-worker.js')), 'app.js?v=20260910-fast-pages', 'app.js?v=20260910-multi-admin');
  worker = once(worker, 'meridian-nexus-v59-fast-pages', 'meridian-nexus-v60-multi-admin');
  save('portal/index.html', index); save('portal/service-worker.js', worker);
  for (const name of ['app.js', 'service-worker.js']) execFileSync(process.execPath, ['--check', path.join(stage, 'portal', name)]);
  save('prepared.json', { callablesChanged: manifest.filter(x => x.changes.length).length, callablesUnchanged: manifest.filter(x => !x.changes.length).map(x => x.name), portal: fileHashes(path.join(stage, 'portal')), rules: Object.fromEntries(['firestore', 'storage'].map(k => [k, hash(fs.readFileSync(path.join(stage, k + '.rules')))])), at: new Date().toISOString() });
  console.log(JSON.stringify(read('prepared.json'), null, 2));
}
function checkPrepared() {
  const prepared = read('prepared.json');
  assert.deepEqual(fileHashes(path.join(stage, 'portal')), prepared.portal);
  for (const kind of ['firestore', 'storage']) assert.equal(hash(fs.readFileSync(path.join(stage, `${kind}.rules`))), prepared.rules[kind]);
  for (const item of read('functions.manifest.json')) assert.deepEqual(fileHashes(path.join(stage, 'deploy', item.name)), item.files, `Staged source changed: ${item.name}`);
  return prepared;
}
function testRelease() {
  const prepared = checkPrepared();
  const env = { ...process.env, ADMIN_TEST_APP: path.join(stage, 'portal/app.js'), ADMIN_TEST_RULES: path.join(stage, 'firestore.rules'), ADMIN_TEST_FUNCTIONS: path.join(stage, 'deploy/saveAdminUser/index.js'), CHAT_EMULATOR_PORT: '8193', NEXUS_MULTI_ADMIN_TEST: '1', NEXUS_PORTAL_STAGE: path.join(stage, 'portal'), ADMIN_TEST_CSS: path.join(stage, 'live-styles.css'), ADMIN_TEST_EVIDENCE: stage };
  for (const [name, args] of [
    ['unit', ['--test', 'scripts/tests/admin-access.test.cjs', 'scripts/tests/admin-user-save.test.cjs']],
    ['emulator', ['scripts/test-meridian-chat.cjs']],
    ['browser', ['scripts/tests/admin-user-browser.cjs']]
  ]) {
    const output = execFileSync(process.execPath, args, { cwd: root, env, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    save(`tests/${name}.log`, output); console.log(`${name}: passed`);
  }
  assert.deepEqual(checkPrepared(), prepared);
  save('tested.json', { prepared, functions: hash(fs.readFileSync(path.join(stage, 'functions.manifest.json'))), at: new Date().toISOString() });
}
function requireTested() {
  assert.deepEqual(checkPrepared(), read('tested.json').prepared);
  assert.equal(hash(fs.readFileSync(path.join(stage, 'functions.manifest.json'))), read('tested.json').functions);
}
async function verifyFunction(item, before, states) {
  const after = await json(fnUrl(item.name)); assert.equal(after.state, 'ACTIVE');
  for (const key of ['serviceAccountEmail', 'availableMemory', 'availableCpu', 'timeoutSeconds', 'maxInstanceCount', 'minInstanceCount', 'maxInstanceRequestConcurrency', 'environmentVariables', 'secretEnvironmentVariables', 'ingressSettings', 'vpcConnector', 'vpcConnectorEgressSettings', 'securityLevel']) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], `${item.name}: ${key} changed`);
  for (const key of ['runtime', 'entryPoint', 'environmentVariables', 'serviceAccount', 'workerPool', 'dockerRepository']) assert.deepEqual(after.buildConfig[key], before.buildConfig[key], `${item.name}: build ${key} changed`);
  assert.deepEqual(after.eventTrigger, before.eventTrigger);
  const iam = await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`);
  assert.deepEqual(iam, read(`iam/${item.name}.before.json`), `${item.name}: IAM changed`);
  save(`${item.name}.after.json`, after);
  states[item.name] = { ...states[item.name], done: true, revision: after.serviceConfig.revision, verifiedAt: new Date().toISOString() };
  save('function-deployments.json', states); console.log(`ACTIVE ${item.name} ${after.serviceConfig.revision}`);
}
async function deployFunctions() {
  requireTested();
  const baseline = read('functions.before.json'), manifest = read('functions.manifest.json');
  const entries = manifest.filter(x => x.changes.length).sort((a, b) => Number(['saveAdminUser', 'deleteAdminUser'].includes(a.name)) - Number(['saveAdminUser', 'deleteAdminUser'].includes(b.name)));
  const states = fs.existsSync(path.join(stage, 'function-deployments.json')) ? read('function-deployments.json') : {};
  const active = new Map(), errors = [];
  async function poll() {
    for (const [name, operation] of active) {
      let result;
      try { result = await json(`https://cloudfunctions.googleapis.com/v2/${operation}`); }
      catch (error) { console.log(`Polling deferred for ${name}: ${error.message.slice(0, 150)}`); continue; }
      if (!result.done) continue;
      active.delete(name);
      if (result.error) { states[name] = { ...states[name], error: result.error }; errors.push(`${name}: ${result.error.message}`); save('function-deployments.json', states); continue; }
      try { await verifyFunction(manifest.find(x => x.name === name), baseline.find(x => x.name.endsWith('/' + name)), states); }
      catch (error) { states[name] = { ...states[name], verificationError: error.message }; save('function-deployments.json', states); errors.push(error.message); }
    }
  }
  try {
    for (const item of entries) {
      if (states[item.name]?.done) { assert.equal((await json(fnUrl(item.name))).serviceConfig.revision, states[item.name].revision); continue; }
      assert.ok(!states[item.name]?.error && !states[item.name]?.verificationError, `Review previous error for ${item.name} before resuming.`);
      if (states[item.name]?.operation) { active.set(item.name, states[item.name].operation); continue; }
      while (active.size >= 6) { await new Promise(r => setTimeout(r, 12000)); await poll(); }
      if (errors.length) break;
      const before = baseline.find(x => x.name.endsWith('/' + item.name));
      assert.equal((await json(fnUrl(item.name))).serviceConfig.revision, item.revision, `${item.name}: changed since audit`);
      const archive = new JSZip(), directory = path.join(stage, 'deploy', item.name);
      for (const [file, expected] of Object.entries(item.files)) { const bytes = fs.readFileSync(path.join(directory, file)); assert.equal(hash(bytes), expected); archive.file(file, bytes); }
      const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, 'POST', {});
      const put = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) }); assert.ok(put.ok, `Upload failed: ${put.status}`);
      const operation = await json(`${fnUrl(item.name)}?updateMask=buildConfig.source`, 'PATCH', { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
      states[item.name] = { operation: operation.name, startedAt: new Date().toISOString() }; save('function-deployments.json', states);
      active.set(item.name, operation.name); console.log(`BUILDING ${item.name}`); await poll();
    }
  } catch (error) { errors.push(error.message); }
  while (active.size) { await new Promise(r => setTimeout(r, 15000)); await poll(); }
  assert.deepEqual(errors, [], 'Rollout stopped; existing builds were drained.');
  assert.ok(entries.every(x => states[x.name]?.done));
  save('functions-complete.json', { count: entries.length, at: new Date().toISOString(), configurationAndIamPreserved: true });
  console.log(`All ${entries.length} source-only callable updates verified.`);
}
async function deployRules() {
  requireTested(); assert.ok(read('functions-complete.json').count);
  for (const kind of ['firestore', 'storage']) {
    const before = read(`${kind}.before.json`), url = `https://firebaserules.googleapis.com/v1/${before.release.name}`;
    if (fs.existsSync(path.join(stage, `${kind}.after.json`))) { assert.equal((await json(url)).rulesetName, read(`${kind}.after.json`).rulesetName); continue; }
    assert.equal((await json(url)).rulesetName, before.release.rulesetName, 'Rules changed since audit.');
    const created = await json(`https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`, 'POST', { source: { files: [{ name: before.rules.source.files[0].name, content: source(path.join(stage, `${kind}.rules`)) }] } });
    save(`${kind}.created.json`, created);
    assert.equal((await json(url)).rulesetName, before.release.rulesetName);
    const after = await json(url, 'PATCH', { release: { name: before.release.name, rulesetName: created.name }, updateMask: 'rulesetName' });
    save(`${kind}.after.json`, after); assert.equal((await json(url)).rulesetName, created.name);
    console.log(`${kind}: rules published and verified`);
  }
}
async function validateRules() {
  requireTested();
  for (const kind of ['firestore', 'storage']) {
    const before = read(`${kind}.before.json`);
    const result = await json(`https://firebaserules.googleapis.com/v1/projects/${project}:test`, 'POST', { source: { files: [{ name: before.rules.source.files[0].name, content: source(path.join(stage, `${kind}.rules`)) }] } });
    save(`tests/${kind}-compiler.json`, result);
    assert.ok(!(result.issues || []).some(x => x.severity === 'ERROR'), `${kind}: ${JSON.stringify(result.issues)}`);
    console.log(`${kind}: server-side validation passed`);
  }
}
async function ensureCrossServiceIam() {
  const role = 'roles/firebaserules.firestoreServiceAgent';
  const member = 'serviceAccount:service-730011371323@gcp-sa-firebasestorage.iam.gserviceaccount.com';
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const before = await json(`${url}:getIamPolicy`, 'POST', { options: { requestedPolicyVersion: 3 } });
  const bindings = p => p.bindings.map(b => ({ ...b, members: [...b.members].sort() })).sort((a, b) => (a.role + JSON.stringify(a.condition || {})).localeCompare(b.role + JSON.stringify(b.condition || {})));
  const withGrant = original => {
    const expected = structuredClone(original), binding = expected.bindings.find(b => b.role === role && !b.condition);
    if (binding) { if (!binding.members.includes(member)) binding.members.push(member); }
    else expected.bindings.push({ role, members: [member] });
    return expected;
  };
  if ((before.bindings || []).some(b => b.role === role && !b.condition && b.members?.includes(member))) {
    const priorAttempt = fs.existsSync(path.join(stage, 'storage-cross-service-iam.before.json'));
    if (priorAttempt) {
      const original = read('storage-cross-service-iam.before.json');
      assert.deepEqual(bindings(before), bindings(withGrant(original)), 'Only the requested managed-service binding may change.');
      assert.deepEqual(before.auditConfigs, original.auditConfigs);
      save('storage-cross-service-iam.after.json', before);
    }
    const result = { role, member, existing: !priorAttempt, added: priorAttempt, allOtherBindingsPreserved: true, at: new Date().toISOString() };
    save('storage-cross-service-iam.verified.json', result); console.log(JSON.stringify(result)); return;
  }
  const definition = await json(`https://iam.googleapis.com/v1/${role}`);
  assert.ok(definition.includedPermissions.includes('datastore.entities.get'));
  assert.ok(definition.includedPermissions.every(p => /\.(get|list)$/.test(p)), 'Unexpected write permission in managed read role.');
  assert.ok(!fs.existsSync(path.join(stage, 'storage-cross-service-iam.before.json')), 'Review the previous IAM attempt before retrying.');
  save('storage-cross-service-iam.before.json', before);
  save('storage-cross-service-iam.role.json', definition);
  const policy = withGrant(before);
  const after = await json(`${url}:setIamPolicy`, 'POST', { policy });
  assert.deepEqual(bindings(after), bindings(policy), 'Unexpected IAM binding changes.');
  assert.deepEqual(after.auditConfigs, before.auditConfigs);
  save('storage-cross-service-iam.after.json', after);
  const verified = await json(`${url}:getIamPolicy`, 'POST', { options: { requestedPolicyVersion: 3 } });
  assert.deepEqual(bindings(verified), bindings(policy));
  save('storage-cross-service-iam.verified.json', { role, member, permissions: definition.includedPermissions, added: true, at: new Date().toISOString() });
  console.log(JSON.stringify(read('storage-cross-service-iam.verified.json')));
}
async function deployHosting() {
  requireTested(); assert.ok(read('functions-complete.json').count);
  assert.ok(read('storage-cross-service-iam.verified.json').role);
  for (const kind of ['firestore', 'storage']) assert.equal((await json(`https://firebaserules.googleapis.com/v1/${read(`${kind}.before.json`).release.name}`)).rulesetName, read(`${kind}.after.json`).rulesetName);
  const current = await liveHosting(), before = read('hosting.before.json');
  assert.equal(current.release.version.name, before.release.version.name, 'Hosting changed since audit.');
  const oldFiles = Object.fromEntries(read('hosting-files.before.json').files.map(f => [f.path, f.hash]));
  const files = { ...oldFiles }, uploads = new Map();
  for (const file of ['app.js', 'index.html', 'service-worker.js']) {
    const bytes = zlib.gzipSync(fs.readFileSync(path.join(stage, 'portal', file)), { level: 9 }), digest = hash(bytes); files['/' + file] = digest; uploads.set(digest, bytes);
  }
  const base = 'https://firebasehosting.googleapis.com/v1beta1';
  const version = await json(`${base}/projects/-/sites/${site}/versions`, 'POST', { config: current.release.version.config });
  save('hosting.created.json', { version, files });
  const populate = await json(`${base}/${version.name}:populateFiles`, 'POST', { files });
  for (const digest of populate.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest), 'Unchanged assets must already exist.');
    const response = await fetch(`${populate.uploadUrl}/${digest}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: uploads.get(digest) });
    assert.ok(response.ok, `Hosting upload failed: ${response.status}`);
  }
  await json(`${base}/${version.name}?updateMask=status`, 'PATCH', { status: 'FINALIZED' });
  assert.equal((await liveHosting()).release.version.name, current.release.version.name);
  const released = await json(`${base}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, 'POST', { message: 'Approved staff multi-admin access; existing dashboard, Chat, ETL and automation assets preserved.' });
  save('hosting.after.json', released);
  const check = await json(`${base}/${version.name}/files?pageSize=1000`); assert.ok(!check.nextPageToken);
  assert.deepEqual(Object.fromEntries(check.files.map(f => [f.path, f.hash])), files);
  assert.equal((await liveHosting()).release.version.name.split('/').at(-1), version.name.split('/').at(-1));
  save('hosting.verified.json', { version: version.name, changed: [...uploads.keys()].length, unchangedAssets: Object.keys(oldFiles).length - 3, at: new Date().toISOString() });
  console.log(`Hosting verified: ${version.name}`);
}
async function verifyRelease() {
  requireTested();
  const deployments = read('function-deployments.json'), before = read('functions.before.json'), after = await listFunctions();
  const names = list => list.map(x => x.name).sort(); assert.deepEqual(names(after), names(before), 'Unexpected function creation or deletion.');
  for (const old of before) {
    const name = old.name.split('/').at(-1), current = after.find(x => x.name === old.name);
    assert.equal(current.serviceConfig.revision, deployments[name]?.revision || old.serviceConfig.revision, `Unexpected revision: ${name}`);
    assert.equal(current.state, 'ACTIVE', name);
  }
  for (const kind of ['firestore', 'storage']) {
    const release = await json(`https://firebaserules.googleapis.com/v1/${read(`${kind}.before.json`).release.name}`);
    assert.equal(release.rulesetName, read(`${kind}.after.json`).rulesetName);
    const ruleset = await json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
    assert.equal(ruleset.source.files[0].content, source(path.join(stage, `${kind}.rules`)));
  }
  const hosting = await liveHosting(), created = read('hosting.created.json');
  assert.equal(hosting.release.version.name.split('/').at(-1), created.version.name.split('/').at(-1));
  assert.deepEqual(hosting.release.version.config, read('hosting.before.json').release.version.config);
  const assets = await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);
  assert.ok(!assets.nextPageToken); assert.deepEqual(Object.fromEntries(assets.files.map(x => [x.path, x.hash])), created.files);
  for (const name of ['app.js', 'index.html', 'service-worker.js']) {
    const response = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), hash(fs.readFileSync(path.join(stage, 'portal', name))), `Published bytes differ: ${name}`);
  }
  const anonymous = {};
  for (const name of ['saveAdminUser', 'deleteAdminUser', 'getOperationsWorkspace', 'getAdminExtractionRunHistory', 'getPortalResources', 'getStockFixDashboard', 'getSalesInsightsRoute', 'getFranchiseOrderDashboard']) {
    const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}' });
    anonymous[name] = response.status; assert.ok([401, 403].includes(response.status), `Anonymous access was not denied: ${name}`);
  }
  save('verified.json', { at: new Date().toISOString(), hosting: hosting.release.version.name, updatedFunctions: Object.keys(deployments).length, otherFunctionsUnchanged: before.length - Object.keys(deployments).length, anonymousDenied: anonymous, totalHostingAssets: assets.files.length, changedHostingAssets: 3, rulesVerified: true, realUserSignInNotImpersonated: true });
  console.log(JSON.stringify(read('verified.json'), null, 2));
}

if (require.main === module) {
  const command = process.argv[2];
  Promise.resolve().then(() => {
    if (command === 'audit') return audit();
    if (command === 'audit-built') return auditBuiltCallables();
    if (command === 'prepare') return prepare();
    if (command === 'test') return testRelease();
    if (command === 'functions') return deployFunctions();
    if (command === 'rules') return deployRules();
    if (command === 'validate-rules') return validateRules();
    if (command === 'storage-iam') return ensureCrossServiceIam();
    if (command === 'hosting') return deployHosting();
    if (command === 'verify') return verifyRelease();
    throw new Error('Use audit, audit-built, prepare, test, functions, rules or hosting.');
  }).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { root, stage, read, source, save, hash, api, json, fnUrl, listFunctions, liveHosting, once, block, fn, ruleFn, fileHashes };
