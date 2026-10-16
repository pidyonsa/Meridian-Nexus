"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const { json, api, fnUrl, hash, once, fileHashes } = require("./release-multi-admin.cjs");
const stage = path.resolve(__dirname, "../.tmp/operations-reports-20260923-chunks");
const names = ["getOperationsWorkspace", "getPortalResourceDownload"], assets = ["app.js", "index.html", "service-worker.js"];
const project = "meridain-nexus", site = "meridian-nexus", host = "https://firebasehosting.googleapis.com/v1beta1";
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
function save(name, value) {
  const target = path.resolve(stage, name); assert.ok(target.startsWith(stage + path.sep));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
async function source(config) {
  const s = config.buildConfig.source.storageSource;
  return JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function audit() {
  for (const name of names) {
    const fn = await json(fnUrl(name)); save(`${name}/before.json`, fn);
    save(`${name}/iam.json`, await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`));
    const zip = await source(fn);
    for (const entry of Object.values(zip.files)) if (!entry.dir) save(`${name}/source/${entry.name}`, await entry.async("nodebuffer"));
  }
  const unchanged = {};
  for (const name of ["processExtraction", "startExtraction", "meridianEtl"]) unchanged[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("unchanged.json", unchanged);
  const hosting = await live(); save("hosting.before.json", hosting);
  const manifest = await json(`${host}/${hosting.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("manifest.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), item.hash);
    save("portal" + item.path, bytes);
  }
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  for (const [collection, id] of [["extractionRuns", "dataorbis-wilmar-2026-08-verified-e49d82a7b0b7"], ["files", "1bb9cb1a-82a4-48f5-8fd9-0319abff3091"], ["files", "8d632fa2-5525-4a14-8707-c17d50ee438f"]]) {
    save(`records/${collection}-${id}.json`, await json(`${base}/${collection}/${id}`));
  }
  console.log("Live sources and verified report records captured; no production changes.");
}
function fn(code, name) { const match = code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`)); assert.ok(match, name); return match[0]; }
function prepare() {
  const module = fs.readFileSync(path.resolve(__dirname, "../functions/operations-reports.js"));
  const local = fs.readFileSync(path.resolve(__dirname, "../public/app.js"), "utf8");
  for (const name of names) {
    const dest = path.join(stage, name, "deploy");
    if (fs.existsSync(dest)) assert.equal(hash(fs.readFileSync(path.join(dest, "index.js"))), hash(fs.readFileSync(path.join(stage, name, "source/index.js"))), "Only an untouched partial stage can be resumed.");
    fs.cpSync(path.join(stage, name, "source"), dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "operations-reports.js"), module);
    const target = path.join(dest, "index.js"); let code = fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
    if (name === "getPortalResourceDownload") code = once(code,
      '    return require("./operations-reports").download({ db, uid: request.auth.uid, id: request.data.id, HttpsError, sign: signedStorageReadUrl });',
      '    const reports = require("./operations-reports");\n    return reports.download({ db, uid: request.auth.uid, id: request.data.id, start: request.data.start, generation: request.data.generation, HttpsError,\n      read: options => reports.readChunk({ bucket: getStorage().bucket(), HttpsError, ...options }) });');
    const runs = '  const uniqueRuns = [...new Map(runDocuments.map((document) => [document.id, document])).values()];';
    if (name === "getOperationsWorkspace") assert.ok(code.includes('const reportDelivery = await require("./operations-reports").list'), "The listing fix must be retained.");
    const scope = '    historyScope: role === "admin" ? "lifetime" : "last-14-days",';
    fs.writeFileSync(target, code);
    const before = fileHashes(path.join(stage, name, "source")), after = fileHashes(dest);
    for (const [file, digest] of Object.entries(before)) if (!["index.js", "operations-reports.js"].includes(file)) assert.equal(after[file], digest, file);
    assert.deepEqual(Object.keys(after).sort(), [...new Set([...Object.keys(before), "operations-reports.js"])].sort());
  }
  const target = path.join(stage, "portal/app.js"); let app = fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  for (const name of ["getDownloadUrl", "triggerDownload", "downloadFiles"]) app = once(app, fn(app, name), fn(local, name));
  assert.equal(fn(app, "reportFiles"), fn(local, "reportFiles"));
  assert.equal(fn(app, "renderReportDeliveries"), fn(local, "renderReportDeliveries"));
  fs.writeFileSync(target, app);
  const index = path.join(stage, "portal/index.html"); let html = fs.readFileSync(index, "utf8");
  assert.ok(html.includes('id="automationReportsState"'));
  const tag = html.match(/app\.js\?v=([\w-]+)/)[1]; assert.ok(tag);
  fs.writeFileSync(index, html.replaceAll(tag, "20260923-latest-reports-2"));
  const sw = path.join(stage, "portal/service-worker.js"), content = fs.readFileSync(sw, "utf8"); assert.ok(content.includes(tag));
  fs.writeFileSync(sw, content.replaceAll(tag, "20260923-latest-reports-2"));
  save("prepared.json", { sources: Object.fromEntries(names.map(name => [name, fileHashes(path.join(stage, name, "deploy"))])),
    assets: Object.fromEntries(assets.map(name => [name, hash(fs.readFileSync(path.join(stage, "portal", name)))])) });
  console.log("Prepared isolated report listing/download patch. Other portal assets and automations preserved.");
}
function test() {
  const prepared = read("prepared.json");
  for (const name of names) {
    assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), prepared.sources[name]);
    assert.equal(prepared.sources[name]["operations-reports.js"], hash(fs.readFileSync("functions/operations-reports.js")));
    execFileSync(process.execPath, ["--check", path.join(stage, name, "deploy/index.js")], { stdio: "inherit", windowsHide: true });
  }
  for (const name of assets) assert.equal(hash(fs.readFileSync(path.join(stage, "portal", name))), prepared.assets[name]);
  execFileSync(process.execPath, ["--check", path.join(stage, "portal/app.js")], { stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["--test", "scripts/tests/operations-reports.test.cjs"], { stdio: "inherit", windowsHide: true,
    env: { ...process.env, REPORTS_APP: path.join(stage, "portal/app.js") } });
  save("tested.json", { ...prepared, at: new Date().toISOString() });
}
async function deploy() {
  const tested = read("tested.json");
  assert.ok(fs.existsSync(path.join(stage, "browser-passed.json")), "Browser validation is required.");
  for (const name of names) {
    const before = read(`${name}/before.json`); assert.equal((await json(fnUrl(name))).serviceConfig.revision, before.serviceConfig.revision);
    assert.deepEqual(fileHashes(path.join(stage, name, "deploy")), tested.sources[name]);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read(`${name}/iam.json`));
    assert.ok(!fs.existsSync(path.join(stage, name, "operation.json")));
    const zip = new JSZip(); for (const file of Object.keys(tested.sources[name])) zip.file(file, fs.readFileSync(path.join(stage, name, "deploy", file)));
    const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, "POST", {});
    const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
    const operation = await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
    save(`${name}/operation.json`, operation); console.log(`Deploying ${name}.`);
    for (let i = 0; i < 120; i++) {
      const result = await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
      if (result.done) { save(`${name}/result.json`, result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
      assert.ok(i < 119, "Deployment still running."); await new Promise(resolve => setTimeout(resolve, 10000));
    }
    const after = await json(fnUrl(name)); assert.equal(after.state, "ACTIVE"); save(`${name}/after.json`, after); console.log(after.serviceConfig.revision);
  }
}
async function publish() {
  const tested = read("tested.json"), before = read("hosting.before.json");
  for (const name of names) assert.equal((await json(fnUrl(name))).serviceConfig.revision, read(`${name}/after.json`).serviceConfig.revision);
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const name of assets) { const bytes = fs.readFileSync(path.join(stage, "portal", name)); assert.equal(hash(bytes), tested.assets[name]);
    const compressed = zlib.gzipSync(bytes, { level: 9 }), digest = hash(compressed); files["/" + name] = digest; uploads.set(digest, compressed); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files });
  assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  for (const digest of upload.uploadRequiredHashes || []) { assert.ok(uploads.has(digest)); const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest,
    { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) }); await response.arrayBuffer(); assert.equal(response.status, 200); }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "Latest reports: authenticated range downloads without signed URLs or extra IAM; no extraction or storage rule changes" }); console.log("Published " + version.name);
}
async function verify() {
  const tested = read("tested.json"), current = await live(), created = read("hosting.created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), tested.assets[file]); }
  for (const name of names) {
    const current = await json(fnUrl(name)), before = read(`${name}/before.json`); assert.equal(current.state, "ACTIVE");
    assert.equal(current.serviceConfig.revision, read(`${name}/after.json`).serviceConfig.revision);
    for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(current.serviceConfig[key], before.serviceConfig[key], key);
    assert.deepEqual(current.eventTrigger, before.eventTrigger);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${current.serviceConfig.service}:getIamPolicy`), read(`${name}/iam.json`));
    const zip = await source(current); for (const [file, digest] of Object.entries(tested.sources[name])) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest);
    const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { kind: "extraction-report", id: "1bb9cb1a-82a4-48f5-8fd9-0319abff3091" } }) });
    assert.ok([401, 403].includes(response.status), "Anonymous downloads must stay blocked.");
    assert.ok(["UNAUTHENTICATED", "PERMISSION_DENIED"].includes((await response.json()).error?.status), "Expected the callable's own authentication rejection.");
  }
  for (const [name, revision] of Object.entries(read("unchanged.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  for (const file of fs.readdirSync(path.join(stage, "records"))) {
    const before = read("records/" + file), after = await json(`https://firestore.googleapis.com/v1/${before.name}`);
    assert.equal(after.updateTime, before.updateTime, "Saved report records must remain unchanged.");
  }
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, iamAndRuntimePreserved: true, otherAutomationsUnchanged: true, newExtractions: 0 });
  console.log("Report listing/download release verified; other automations and access policies unchanged.");
}
if (require.main === module) Promise.resolve().then(() => ({ audit, prepare, test, deploy, publish, verify }[process.argv[2]] || (() => { throw Error("Choose audit, prepare, test, deploy, publish or verify"); }))()).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { stage, fn };
