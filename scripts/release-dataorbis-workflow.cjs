"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const JSZip = require("../functions/node_modules/jszip");
const { json, api, fnUrl, hash, once, fileHashes } = require("./release-multi-admin.cjs");
const { execFileSync } = require("node:child_process");
const stage = path.resolve(__dirname, "../.tmp/dataorbis-workflow-20260923"), project = "meridain-nexus", site = "meridian-nexus";
const functions = ["startExtraction", "processExtraction", "getOperationsWorkspace"];
const modules = ["dataorbis-runtime.js", "dataorbis-portal.js", "dataorbis-sales.js", "dataorbis-workbook.js"];
const assets = ["app.js", "index.html", "service-worker.js"];
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
const host = "https://firebasehosting.googleapis.com/v1beta1";
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
async function audit() {
  for (const name of functions) {
    const config = await json(fnUrl(name)); save(`${name}/before.json`, config);
    save(`${name}/iam.before.json`, await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    const source = config.buildConfig.source.storageSource;
    const zip = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
    for (const entry of Object.values(zip.files)) if (!entry.dir) save(`${name}/source/${entry.name}`, await entry.async("nodebuffer"));
    console.log(JSON.stringify({ audited: name, revision: config.serviceConfig.revision }));
  }
  const host = "https://firebasehosting.googleapis.com/v1beta1";
  const live = await json(`${host}/projects/${project}/sites/${site}/channels/live`);
  const manifest = await json(`${host}/${live.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  save("hosting.before.json", live); save("hosting.files.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const data = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(data, { level: 9 })), item.hash);
    save("portal" + item.path, data);
  }
  for (const id of ["dataorbis-game-sales", "dataorbis-makro-sales"]) {
    const query = new URLSearchParams();
    for (const field of ["name", "webAddress", "salesProcedure", "extractionProfileId", "extractionName", "steps", "reportSchedule", "restoration", "credentialsUpdatedAt"]) query.append("mask.fieldPaths", field);
    save(`profiles/${id}.before.json`, await json(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/retailers/${id}?${query}`));
  }
  save("audit-complete.json", { at: new Date().toISOString(), hosting: live.release.version.name, functions, productionChanges: 0 });
  console.log("DataOrbis workflow baseline recorded. No production changes.");
}
async function prepare() {
  assert.equal((await live()).release.version.name, read("hosting.before.json").release.version.name);
  const prepared = { sources: {}, assets: {} };
  for (const name of functions) {
    assert.equal((await json(fnUrl(name))).serviceConfig.revision, read(`${name}/before.json`).serviceConfig.revision);
    const source = path.join(stage, name, "source"), deploy = path.join(stage, name, "deploy");
    assert.ok(!fs.existsSync(deploy)); fs.cpSync(source, deploy, { recursive: true });
    for (const module of modules) fs.copyFileSync(path.resolve(__dirname, "../functions", module), path.join(deploy, module));
    const file = path.join(deploy, "index.js");
    let code = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const profile = code.match(/function safeOperationsProfile\([^]*?\n\}/)[0];
    code = once(code, profile, once(profile, 'ready: Boolean(data.extractionProfileId || (Array.isArray(data.steps) && data.steps.length)),', 'ready: require("./dataorbis-runtime").isProfile(document.id) ? data.salesProcedure?.automationReady === true : Boolean(data.extractionProfileId || (Array.isArray(data.steps) && data.steps.length)),'));
    const anchor = '  const retailerData = retailer.data();\n  const monthlyAttendance = scheduleFrequencyForRetailer(retailerId, retailerData) === "monthly";';
    const branch = '  if (require("./dataorbis-runtime").isProfile(retailerId)) {\n    const queued = await require("./dataorbis-runtime").queue({ db, FieldValue, HttpsError, request, retailerId, retailerData });\n    await recordAccessAudit(requestActor(request), "run-queued", { runId: queued.runId, retailerId, retailerName: retailerData.name, result: queued.reused ? "reused" : "queued", message: "DataOrbis monthly sales run requested." });\n    return queued;\n  }\n';
    code = once(code, anchor, anchor.replace('  const monthlyAttendance', branch + '  const monthlyAttendance'));
    const worker = '  const run = event.data.data();\n  if (run.workflowMode === "salesforce-session-warmup") {';
    code = once(code, worker, '  const run = event.data.data();\n  if (run.workflowMode === "dataorbis-monthly-sales") {\n    if (!await claimQueuedExtractionRun(runRef, event.id)) return;\n    await require("./dataorbis-runtime").processRun(event, { db, FieldValue, getStorage, decryptPassword, launchAutomationBrowser, ensureExtractionActive, appendRunTimeline, waitForAutomationPromptValue });\n    return;\n  }\n  if (run.workflowMode === "salesforce-session-warmup") {');
    fs.writeFileSync(file, code);
    const before = fileHashes(source), after = fileHashes(deploy);
    for (const [file, digest] of Object.entries(before)) if (!["index.js", ...modules].includes(file)) assert.equal(after[file], digest, file);
    assert.deepEqual(Object.keys(after).sort(), [...new Set([...Object.keys(before), ...modules])].sort());
    prepared.sources[name] = after;
  }
  for (const file of ["index.html", "service-worker.js"]) {
    const target = path.join(stage, "portal", file), before = fs.readFileSync(target, "utf8");
    assert.ok(before.includes("20260923-otp-retry-2"));
    fs.writeFileSync(target, before.replaceAll("20260923-otp-retry-2", "20260923-dataorbis-workflow"));
  }
  for (const file of assets) prepared.assets[file] = hash(fs.readFileSync(path.join(stage, "portal", file)));
  save("prepared.json", prepared);
  console.log("Prepared source-only function patches and three portal assets. No production changes.");
}
function test() {
  const prepared = read("prepared.json");
  for (const name of functions) {
    assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), prepared.sources[name]);
    execFileSync(process.execPath, ["--check", path.join(stage, name, "deploy/index.js")], { stdio: "inherit", windowsHide: true });
  }
  for (const module of modules) assert.equal(hash(fs.readFileSync(path.resolve(__dirname, "../functions", module))), prepared.sources.processExtraction[module]);
  execFileSync(process.execPath, ["--test", "scripts/tests/dataorbis-workflow.test.cjs", "scripts/tests/dataorbis-transform.test.cjs", "scripts/tests/dataorbis-runtime.test.cjs"], { cwd: path.resolve(__dirname, ".."), stdio: "inherit", windowsHide: true });
  for (const file of assets) assert.equal(hash(fs.readFileSync(path.join(stage, "portal", file))), prepared.assets[file]);
  assert.ok(fs.existsSync(path.join(stage, "live-validation/final-verification.json")), "Full live extraction and workbook verification are required.");
  assert.ok(fs.existsSync(path.join(stage, "browser-passed.json")), "Browser checks are required.");
  assert.deepEqual(read("browser-passed.json").assets, prepared.assets);
  assert.deepEqual(read("otp-browser-passed.json").assets, prepared.assets);
  for (const name of functions) assert.ok(!fs.existsSync(path.join(stage, name, "operation.json")), "Do not change a tested deployment in progress.");
  fs.writeFileSync(path.join(stage, "tested.json"), JSON.stringify({ ...prepared, at: new Date().toISOString() }, null, 2));
}
function refreshPrepared() {
  const prepared = read("prepared.json");
  for (const name of functions) {
    assert.ok(!fs.existsSync(path.join(stage, name, "operation.json")));
    assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), prepared.sources[name]);
  }
  for (const file of assets) prepared.assets[file] = hash(fs.readFileSync(path.join(stage, "portal", file)));
  fs.writeFileSync(path.join(stage, "prepared.json"), JSON.stringify(prepared, null, 2));
}
async function deploy() {
  const tested = read("tested.json");
  for (const name of ["processExtraction", "startExtraction", "getOperationsWorkspace"]) {
    const before = read(`${name}/before.json`);
    assert.equal((await json(fnUrl(name))).serviceConfig.revision, before.serviceConfig.revision);
    assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), tested.sources[name]);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read(`${name}/iam.before.json`));
    assert.ok(!fs.existsSync(path.join(stage, `${name}/operation.json`)), "Inspect the existing deployment before retrying.");
    const zip = new JSZip();
    for (const file of Object.keys(tested.sources[name])) zip.file(file, fs.readFileSync(path.join(stage, name, "deploy", file)));
    const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, "POST", {});
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) });
    assert.ok(response.ok);
    const operation = await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
    save(`${name}/operation.json`, operation); console.log(`Building ${name}.`);
    for (let i = 0; i < 120; i++) {
      const result = await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
      if (result.done) { save(`${name}/result.json`, result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
      assert.ok(i < 119, "Build is still running."); await new Promise(r => setTimeout(r, 10000));
    }
    const after = await json(fnUrl(name)); assert.equal(after.state, "ACTIVE");
    for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], key);
    assert.deepEqual(after.eventTrigger, before.eventTrigger);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read(`${name}/iam.before.json`));
    save(`${name}/after.json`, after); console.log(`${name} active: ${after.serviceConfig.revision}`);
  }
}
async function publish() {
  const tested = read("tested.json"), before = read("hosting.before.json");
  for (const name of functions) assert.equal(read(`${name}/after.json`).state, "ACTIVE");
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("hosting.files.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) {
    const bytes = fs.readFileSync(path.join(stage, "portal", file)); assert.equal(hash(bytes), tested.assets[file]);
    const compressed = zlib.gzipSync(bytes, { level: 9 }), digest = hash(compressed); files["/" + file] = digest; uploads.set(digest, compressed);
  }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config });
  save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files });
  assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest));
    const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) });
    await response.arrayBuffer(); assert.equal(response.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "DataOrbis monthly sales workflow and admin Run controls; preserve OTP repair and all unrelated portal assets" });
  console.log("Released " + version.name);
}
async function verify() {
  const tested = read("tested.json"), current = await live(), created = read("hosting.created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`);
  assert.ok(!manifest.nextPageToken); assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) {
    const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
    assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), tested.assets[file], file);
  }
  for (const name of functions) {
    const repaired = name === "processExtraction" && fs.existsSync(path.join(stage, name, "repair-after.json"));
    const expected = repaired ? read(`${name}/repair-tested.json`).source : tested.sources[name];
    const fn = await json(fnUrl(name)); assert.equal(fn.serviceConfig.revision, read(`${name}/${repaired ? "repair-after" : "after"}.json`).serviceConfig.revision);
    const s = fn.buildConfig.source.storageSource;
    const zip = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    for (const [file, digest] of Object.entries(expected)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest, file);
    if (name !== "processExtraction") {
      const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: {} }) });
      assert.ok([401, 403].includes(response.status), "Anonymous access must remain blocked.");
      const denied = await response.json();
      assert.ok(["UNAUTHENTICATED", "PERMISSION_DENIED"].includes(denied.error?.status), "Expected the application's own access rejection.");
    }
  }
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, functions, changedAssets: assets, permissionsUnchanged: true });
  console.log("Deployed sources, Hosting manifest and anonymous access checks verified.");
}
async function repairWorker() {
  const name = "processExtraction", before = await json(fnUrl(name));
  assert.equal(before.serviceConfig.revision, read(`${name}/after.json`).serviceConfig.revision);
  assert.ok(!fs.existsSync(path.join(stage, name, "repair-operation.json")));
  execFileSync(process.execPath, ["--test", "scripts/tests/dataorbis-runtime.test.cjs"], { cwd: path.resolve(__dirname, ".."), stdio: "inherit", windowsHide: true });
  const source = { ...read("tested.json").sources[name] }, zip = new JSZip();
  assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), source);
  const runtime = fs.readFileSync(path.resolve(__dirname, "../functions/dataorbis-runtime.js"));
  source["dataorbis-runtime.js"] = hash(runtime);
  for (const file of Object.keys(source)) zip.file(file, file === "dataorbis-runtime.js" ? runtime : fs.readFileSync(path.join(stage, name, "deploy", file)));
  save(`${name}/repair-tested.json`, { source, previousRevision: before.serviceConfig.revision, at: new Date().toISOString() });
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) });
  assert.ok(response.ok);
  const operation = await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
  save(`${name}/repair-operation.json`, operation); console.log("Building worker-only cancellation guard.");
  for (let i = 0; i < 120; i++) {
    const result = await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
    if (result.done) { save(`${name}/repair-result.json`, result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
    assert.ok(i < 119); await new Promise(r => setTimeout(r, 10000));
  }
  const after = await json(fnUrl(name)); assert.equal(after.state, "ACTIVE");
  for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key]);
  assert.deepEqual(after.eventTrigger, before.eventTrigger);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read(`${name}/iam.before.json`));
  save(`${name}/repair-after.json`, after); console.log("Worker cancellation guard active: " + after.serviceConfig.revision);
}
const actions = { audit, prepare, "refresh-prepared": refreshPrepared, test, deploy, publish, verify, "repair-worker": repairWorker };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { stage, save, functions };
