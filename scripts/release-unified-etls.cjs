"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const { json, api, fnUrl, hash, once, fileHashes } = require("./release-multi-admin.cjs");
const stage = path.resolve(__dirname, "../.tmp/unified-etls-20260923");
const project = "meridain-nexus", site = "meridian-nexus", host = "https://firebasehosting.googleapis.com/v1beta1";
const assets = ["app.js", "index.html", "service-worker.js", "etls.js", "etls.css", "etl-portals.js"];
const modules = ["etl-pipelines.js", "meridian-etl.js"];
const tag = "20260923-unified-etls";
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
const text = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const fn = (code, name) => { const found = code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`)); assert.ok(found, name); return found[0]; };
function save(name, value) {
  const target = path.resolve(stage, name); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
async function source(config) {
  const s = config.buildConfig.source.storageSource;
  return JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function audit() {
  const config = await json(fnUrl("meridianEtl")); save("function.before.json", config);
  save("function.iam.json", await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
  for (const entry of Object.values((await source(config)).files)) if (!entry.dir) save("source/" + entry.name, await entry.async("nodebuffer"));
  const unchanged = {};
  for (const name of ["processExtraction", "startExtraction", "getOperationsWorkspace", "getPortalResourceDownload", "submitAutomationPrompt"]) unchanged[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("unchanged.json", unchanged);
  save("job.before.json", await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`));
  const hosting = await live(); save("hosting.before.json", hosting);
  const files = await json(`${host}/${hosting.release.version.name}/files?pageSize=1000`); assert.ok(!files.nextPageToken); save("manifest.before.json", files);
  for (const item of files.files.filter(f => /^\/[^/]+\.(js|css|html)$/.test(f.path))) {
    const r = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(r.ok);
    const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), item.hash);
    save("baseline" + item.path, bytes);
  }
  console.log("Captured live ETL API and portal baseline; no business data or jobs changed.");
}
function prepare() {
  fs.cpSync(path.join(stage, "source"), path.join(stage, "deploy"), { recursive: true });
  fs.cpSync(path.join(stage, "baseline"), path.join(stage, "portal"), { recursive: true });
  let expectedApi = text(path.join(stage, "source/meridian-etl.js"));
  expectedApi = once(expectedApi, 'async function resourceInput(role, id) {', 'async function resourceInput(role, id, { setup = false } = {}) {');
  expectedApi = once(expectedApi,
    '    if (!resource || resource.active === false || !resource.storagePath?.startsWith(`portal-resources/${id}/`) || !/\\.xlsx$/i.test(resource.sourceName || "")) fail("failed-precondition", `${role}: select an active XLSX resource.`);',
    '    const extension = setup && role === "raw" ? /\\.(xlsx|txt|csv)$/i : /\\.xlsx$/i;\n    if (!resource || resource.active === false || !resource.storagePath?.startsWith(`portal-resources/${id}/`) || !extension.test(resource.sourceName || "")) fail("failed-precondition", `${role}: select an active ${setup && role === "raw" ? "XLSX, TXT or CSV" : "XLSX"} resource.`);');
  expectedApi = once(expectedApi, 'r.active !== false && /\\.xlsx$/i.test(r.sourceName || "")', 'r.active !== false && /\\.(xlsx|txt|csv)$/i.test(r.sourceName || "")');
  assert.equal(expectedApi, text("functions/meridian-etl.js"), "ETL API must contain only the three scoped setup changes.");
  for (const name of modules) fs.copyFileSync("functions/" + name, path.join(stage, "deploy", name));
  const before = fileHashes(path.join(stage, "source")), after = fileHashes(path.join(stage, "deploy"));
  assert.deepEqual(Object.keys(before).sort(), Object.keys(after).sort());
  for (const key of Object.keys(before)) if (!modules.includes(key)) assert.equal(before[key], after[key], key);
  const appFile = path.join(stage, "portal/app.js"); let app = text(appFile);
  app = once(app, fn(app, "syncMeridianEtls"), fn(text("public/app.js"), "syncMeridianEtls"));
  app = once(app, 'function renderOperationsWorkspace() {\n  const workspace = state.operationsWorkspace;', 'function renderOperationsWorkspace() {\n  const workspace = state.operationsWorkspace;\n  if (workspace && state.isAdmin && meridianEtlSession?.uid === auth?.currentUser?.uid) meridianEtlSession.updatePortal({ ...workspace, profiles: operationsProfiles(workspace) });');
  app = app.replaceAll("No-ETLs", "ETLs"); fs.writeFileSync(appFile, app);
  for (const name of ["etls.js", "etls.css", "etl-portals.js"]) fs.copyFileSync("public/" + name, path.join(stage, "portal", name));
  const indexFile = path.join(stage, "portal/index.html"), swFile = path.join(stage, "portal/service-worker.js");
  let index = text(indexFile).replaceAll("No-ETLs", "ETLs"), sw = text(swFile);
  for (const name of ["app.js", "etls.js", "etls.css"]) {
    const re = new RegExp(name.replaceAll(".", "\\.") + "\\?v=[\\w-]+", "g");
    assert.ok(index.match(re)); assert.ok(sw.match(re)); index = index.replace(re, `${name}?v=${tag}`); sw = sw.replace(re, `${name}?v=${tag}`);
  }
  index = once(index, `    <script defer src="etls.js?v=${tag}"></script>`, `    <script defer src="etl-portals.js?v=${tag}"></script>\n    <script defer src="etls.js?v=${tag}"></script>`);
  sw = sw.replace(/const CACHE = "[^"]+";/, `const CACHE = "meridian-nexus-${tag}";`);
  sw = once(sw, 'const SHELL = [', `const SHELL = ["/etl-portals.js?v=${tag}",`);
  fs.writeFileSync(indexFile, index); fs.writeFileSync(swFile, sw);
  save("prepared.json", { source: after, assets: Object.fromEntries(assets.map(n => [n, hash(fs.readFileSync(path.join(stage, "portal", n)))])) });
  console.log("Prepared isolated combined ETLs workspace and setup catalogue. No worker or extraction changes.");
}
function test() {
  const prepared = read("prepared.json");
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source);
  for (const name of assets) { assert.equal(hash(fs.readFileSync(path.join(stage, "portal", name))), prepared.assets[name]); if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(stage, "portal", name)], { stdio: "inherit", windowsHide: true }); }
  for (const name of modules) assert.equal(prepared.source[name], hash(fs.readFileSync("functions/" + name)));
  execFileSync(process.execPath, ["--test", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs", "scripts/tests/operations-reports.test.cjs"], { stdio: "inherit", windowsHide: true });
  save("tested.json", { ...prepared, at: new Date().toISOString() });
}
async function deploy() {
  assert.ok(read("browser-passed.json").passed);
  const before = read("function.before.json"), tested = read("tested.json");
  assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), tested.source);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  const zip = new JSZip(); for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
  const op = await json(fnUrl("meridianEtl") + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } }); save("function.operation.json", op);
  for (let i = 0; i < 120; i++) {
    const result = await json(`https://cloudfunctions.googleapis.com/v2/${op.name}`);
    if (result.done) { save("function.result.json", result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
    assert.ok(i < 119, "Deployment still running"); await new Promise(r => setTimeout(r, 10000));
  }
  save("function.after.json", await json(fnUrl("meridianEtl"))); console.log("ETL setup API deployed.");
}
async function publish() {
  assert.ok(read("browser-passed.json").passed);
  const tested = read("tested.json"), before = read("hosting.before.json");
  assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const name of assets) { const bytes = fs.readFileSync(path.join(stage, "portal", name)); assert.equal(hash(bytes), tested.assets[name]); const compressed = zlib.gzipSync(bytes, { level: 9 }), digest = hash(compressed); files["/" + name] = digest; uploads.set(digest, compressed); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest)); const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) }); await response.arrayBuffer(); assert.equal(response.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "Combined ETLs workspace: separate DataOrbis portal jobs, eight-client file setup catalogue; no schedules or worker changes" });
  console.log("Published " + version.name);
}
async function verify() {
  const tested = read("tested.json"), current = await live(), created = read("hosting.created.json"), before = read("function.before.json"), after = await json(fnUrl("meridianEtl"));
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), tested.assets[file]); }
  assert.equal(after.state, "ACTIVE"); assert.equal(after.serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], key);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  const zip = await source(after); for (const [file, digest] of Object.entries(tested.source)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest);
  for (const [name, revision] of Object.entries(read("unchanged.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  const job = await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`);
  assert.deepEqual(job.template, read("job.before.json").template);
  const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) });
  assert.ok([401, 403].includes(response.status));
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, api: after.serviceConfig.revision, workerAndOtherFunctionsUnchanged: true, iamAndRuntimePreserved: true, noJobsStartedByRelease: true });
  console.log("Live combined ETLs release verified. Other jobs, workers and access controls preserved.");
}
if (require.main === module) Promise.resolve().then(() => ({ audit, prepare, test, deploy, publish, verify }[process.argv[2]] || (() => { throw Error("Choose audit, prepare, test, deploy, publish or verify"); }))()).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { stage };
