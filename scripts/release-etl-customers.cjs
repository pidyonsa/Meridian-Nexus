"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { json, fnUrl, hash } = require("./release-multi-admin.cjs");
const stage = path.resolve(__dirname, "../.tmp/etl-customers-20260923");
const project = "meridain-nexus", site = "meridian-nexus", host = "https://firebasehosting.googleapis.com/v1beta1";
const assets = ["etls.js", "etls.css", "index.html", "service-worker.js"], tag = "20260923-etl-customers";
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
function save(name, value, exclusive = true) {
  const target = path.resolve(stage, name); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: exclusive ? "wx" : "w" });
}
function hashes() { return Object.fromEntries(assets.map(name => [name, hash(fs.readFileSync(path.join(stage, "portal", name)))])); }
async function audit() {
  const before = await live(); save("hosting.before.json", before);
  const manifest = await json(`${host}/${before.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("manifest.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(js|css|html)$/.test(f.path))) {
    const r = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(r.ok);
    const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), item.hash);
    save("baseline" + item.path, bytes);
  }
  const revisions = {};
  for (const name of ["meridianEtl", "processExtraction", "startExtraction", "getOperationsWorkspace", "submitAutomationPrompt", "getPortalResourceDownload"]) revisions[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("functions.before.json", revisions);
  console.log("Read-only release baseline captured.");
}
function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "hosting.created.json")), "Do not restage a published release.");
  fs.cpSync(path.join(stage, "baseline"), path.join(stage, "portal"), { recursive: true });
  for (const name of ["etls.js", "etls.css"]) fs.copyFileSync("public/" + name, path.join(stage, "portal", name));
  for (const name of ["index.html", "service-worker.js"]) {
    let text = fs.readFileSync(path.join(stage, "baseline", name), "utf8");
    for (const asset of ["etls.js", "etls.css"]) {
      const re = new RegExp(asset.replaceAll(".", "\\.") + "\\?v=[\\w-]+", "g"); assert.ok(text.match(re)); text = text.replace(re, `${asset}?v=${tag}`);
    }
    if (name === "service-worker.js") text = text.replace(/const CACHE = "[^"]+";/, `const CACHE = "meridian-nexus-${tag}";`);
    fs.writeFileSync(path.join(stage, "portal", name), text);
  }
  save("prepared.json", { assets: hashes(), at: new Date().toISOString() }, false);
  console.log("Prepared customer-dropdown UI only. No backend changes.");
}
function test() {
  assert.deepEqual(hashes(), read("prepared.json").assets);
  for (const name of ["etls.js", "service-worker.js"]) execFileSync(process.execPath, ["--check", path.join(stage, "portal", name)], { stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["--test", "scripts/tests/etl-pipelines.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-portals.test.cjs"], { stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { stdio: "inherit", windowsHide: true, env: { ...process.env,
    NEXUS_PORTAL_STAGE: path.join(stage, "portal"), NEXUS_ETL_TEST_OUTPUT: path.join(stage, "browser"), NEXUS_ETL_LABEL: "ETLs", NEXUS_ETL_CHANNELS: "1", NEXUS_ETL_APPROVAL_CHECK: "1" } });
  save("tested.json", { assets: hashes(), at: new Date().toISOString(), syntheticBrowser: true }, false);
}
async function publish() {
  const tested = read("tested.json"), before = read("hosting.before.json"); assert.deepEqual(hashes(), tested.assets);
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const name of assets) { const bytes = zlib.gzipSync(fs.readFileSync(path.join(stage, "portal", name)), { level: 9 }); const digest = hash(bytes); files["/" + name] = digest; uploads.set(digest, bytes); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest)); const r = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) }); await r.arrayBuffer(); assert.equal(r.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "File-based ETLs: channel-first customer dropdowns and customer creation; no backend or automation changes" });
  console.log("Published " + version.name);
}
async function verify() {
  const tested = read("tested.json"), current = await live(), created = read("hosting.created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const r = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(r.ok); assert.equal(hash(Buffer.from(await r.arrayBuffer())), tested.assets[file]); }
  for (const [name, revision] of Object.entries(read("functions.before.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, assetsChanged: assets, backendUnchanged: true, noRealJobsStarted: true });
  console.log("Live customer selectors verified. Backend and portal automations unchanged.");
}
Promise.resolve().then(() => ({ audit, prepare, test, publish, verify }[process.argv[2]] || (()=>{throw Error("Choose audit, prepare, test, publish or verify");}))()).catch(error=>{console.error(error.message);process.exitCode=1;});
