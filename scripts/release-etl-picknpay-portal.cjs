"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { json, hash, once, fnUrl } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/etl-picknpay-portal-20260924");
const host = "https://firebasehosting.googleapis.com/v1beta1", site = "meridian-nexus", project = "meridain-nexus", tag = "20260924-pnp-portal";
const assets = ["etl-portals.js", "etls.css", "app.js", "index.html", "service-worker.js"];
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const content = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const assetHashes = () => Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(stage, "portal", file)))]));
const pnpUrl = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents/retailers/picknpay?mask.fieldPaths=name&mask.fieldPaths=extractionProfileId&mask.fieldPaths=extractionName&mask.fieldPaths=reportSchedule&mask.fieldPaths=restoration";
async function prepare() {
  const before = await live(); save("hosting.before.json", before);
  const manifest = await json(`${host}/${before.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("manifest.before.json", manifest);
  save("picknpay.before.json", await json(pnpUrl));
  const revisions = {};
  for (const name of ["startExtraction", "getOperationsWorkspace", "processExtraction", "meridianEtl"]) revisions[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("functions.before.json", revisions);
  for (const file of manifest.files.filter(f => /^\/[^/]+\.(js|css|html)$/.test(f.path))) {
    const existing = path.join(root, ".tmp/shared-etls-release-20260924/portal", file.path.slice(1));
    let bytes = fs.existsSync(existing) ? fs.readFileSync(existing) : null;
    if (!bytes || hash(zlib.gzipSync(bytes, { level: 9 })) !== file.hash) {
      const response = await fetch(`https://${site}.web.app${file.path}?audit=${Date.now()}`); assert.ok(response.ok);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), file.hash); save("baseline" + file.path, bytes);
  }
  fs.cpSync(path.join(stage, "baseline"), path.join(stage, "portal"), { recursive: true });
  let app = content(path.join(stage, "baseline/app.js"));
  app = once(app, 'if (!isDataOrbisSalesProfile({ id: data.retailerId }) || state.operationsRunPending)', 'if (!window.MeridianEtlPortals?.isProfile(data.retailerId) || state.operationsRunPending)');
  fs.writeFileSync(path.join(stage, "portal/app.js"), app);
  let css = content(path.join(stage, "baseline/etls.css"));
  css = once(css, ".etl-portal-clients { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));", ".etl-portal-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
  css = once(css, ".etl-portal-client:nth-child(2) { border-top-color: #187e80; }", ".etl-portal-client:nth-child(2) { border-top-color: #187e80; }\n.etl-portal-client:nth-child(3) { border-top-color: #3269a6; }");
  css = once(css, ".etl-portal-selector { display: flex; gap:", ".etl-portal-selector { display: flex; flex-wrap: wrap; gap:");
  assert.equal(css, content(path.join(root, "public/etls.css"))); fs.writeFileSync(path.join(stage, "portal/etls.css"), css);
  assert.equal(content(path.join(stage, "baseline/etl-portals.js")), content(path.join(root, ".tmp/shared-etls-release-20260924/portal/etl-portals.js")));
  fs.copyFileSync(path.join(root, "public/etl-portals.js"), path.join(stage, "portal/etl-portals.js"));
  for (const name of ["index.html", "service-worker.js"]) {
    let source = content(path.join(stage, "baseline", name));
    for (const asset of ["etl-portals.js", "etls.css", "app.js"]) {
      const pattern = new RegExp(asset.replaceAll(".", "\\.") + "\\?v=[\\w-]+", "g"); assert.ok(source.match(pattern));
      source = source.replace(pattern, () => `${asset}?v=${tag}`);
    }
    if (name === "service-worker.js") {
      assert.match(source, /if \(navigation\) \{/);
      source = source.replace(/const CACHE = "[^"]+";/, `const CACHE = "meridian-nexus-${tag}";`);
    }
    fs.writeFileSync(path.join(stage, "portal", name), source);
  }
  save("prepared.json", { assets: assetHashes() }); console.log("Prepared five scoped Hosting assets from the live version. No automation configuration changed.");
}
function test() {
  const prepared = read("prepared.json"); assert.deepEqual(assetHashes(), prepared.assets);
  for (const file of assets.filter(f => f.endsWith(".js"))) execFileSync(process.execPath, ["--check", path.join(stage, "portal", file)], { stdio: "inherit", windowsHide: true });
  const env = { ...process.env, ETL_PORTALS_SCRIPT: path.join(stage, "portal/etl-portals.js"), NEXUS_SW_FILE: path.join(stage, "portal/service-worker.js"),
    NEXUS_PORTAL_STAGE: path.join(stage, "portal"), NEXUS_ETL_TEST_OUTPUT: path.join(stage, "browser"), NEXUS_ETL_LABEL: "ETLs", NEXUS_ETL_CHANNELS: "1",
    NEXUS_ETL_APPROVAL_CHECK: "1", NEXUS_ETL_MAPPING_POLICY: "1", NEXUS_ETL_SHARED: "1", NEXUS_ETL_PNP_PORTAL: "1" };
  execFileSync(process.execPath, ["--test", "scripts/tests/etl-portals.test.cjs", "scripts/tests/service-worker.test.cjs"], { cwd: root, env, stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, env, stdio: "inherit", windowsHide: true });
  save("tested.json", { ...prepared, at: new Date().toISOString(), browserTestsSynthetic: true });
}
async function publish() {
  const before = read("hosting.before.json"); assert.deepEqual(assetHashes(), read("tested.json").assets);
  assert.equal((await live()).release.version.name, before.release.version.name);
  assert.deepEqual(await json(pnpUrl), read("picknpay.before.json"));
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) { const bytes = zlib.gzipSync(fs.readFileSync(path.join(stage, "portal", file)), { level: 9 }), digest = hash(bytes); files["/" + file] = digest; uploads.set(digest, bytes); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest));
    const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) });
    await response.arrayBuffer(); assert.equal(response.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "Add existing Pick n Pay Sales to ETL portal section; preserve setup readiness and current workflows" });
  console.log("Published " + version.name);
}
async function verify() {
  const current = await live(), created = read("hosting.created.json"); assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), read("tested.json").assets[file]); }
  assert.deepEqual(await json(pnpUrl), read("picknpay.before.json"));
  for (const [name, revision] of Object.entries(read("functions.before.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, changedAssets: assets, functionsAndPicknpayConfigurationUnchanged: true, noJobsStarted: true });
  console.log("Live ETL Pick n Pay entry verified; backend revisions, profile readiness and schedules preserved.");
}
const actions = { prepare, test, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
