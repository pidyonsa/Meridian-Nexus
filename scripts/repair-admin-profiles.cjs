"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { json, hash, once } = require("./release-multi-admin.cjs");
const { Readable } = require("node:stream");
const { execFileSync } = require("node:child_process");
const { connect } = require("./release-chat-etl-portal.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const stage = path.resolve(__dirname, "../.tmp/admin-profiles-20260923");
const site = "meridian-nexus", project = "meridain-nexus";
const host = "https://firebasehosting.googleapis.com/v1beta1";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const root = path.resolve(__dirname, ".."), portal = path.join(stage, "portal"), tag = "20260923-admin-profiles";
const assets = ["app.js", "index.html", "service-worker.js", "admin-profile-loader.js"];
const save = (name, value) => { const file = path.join(stage, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: "wx" }); };
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
async function live() { return json(`${host}/projects/${project}/sites/${site}/channels/live`); }
async function audit() {
  const before = await live();
  const files = await json(`${host}/${before.release.version.name}/files?pageSize=1000`); assert.ok(!files.nextPageToken);
  save("hosting.before.json", before); save("hosting.files.before.json", files);
  for (const file of files.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://${site}.web.app${file.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), file.hash, file.path);
    save("before" + file.path, bytes);
  }
  const q = new URLSearchParams({ pageSize: "1000" });
  for (const name of ["name", "extractionProfileId", "reportSchedule.enabled"]) q.append("mask.fieldPaths", name);
  const retailers = await json(`${base}/retailers?${q}`); assert.ok(!retailers.nextPageToken);
  const profiles = (retailers.documents || []).map(d => ({ id: d.name.split("/").at(-1), ...decode({ mapValue: { fields: d.fields } }) }));
  save("profiles.metadata.json", profiles);
  const releases = await json(`https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=100`);
  const release = releases.releases.find(r => r.name.endsWith("/cloud.firestore")); assert.ok(release);
  const rules = await json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  save("firestore.rules.before.json", { release, rules });
  const aq = new URLSearchParams({ pageSize: "1000" });
  for (const name of ["role", "disabled", "accountType", "chatAccess.audience", "chatAccess.workRole"]) aq.append("mask.fieldPaths", name);
  const users = await json(`${base}/adminUsers?${aq}`); assert.ok(!users.nextPageToken);
  const roles = (users.documents || []).map(d => ({ uid: d.name.split("/").at(-1), ...decode({ mapValue: { fields: d.fields } }) }));
  save("admin-access.metadata.json", roles);
  assert.equal((await live()).release.version.name, before.release.version.name);
  console.log(JSON.stringify({ version: before.release.version.name, profiles: profiles.map(p => ({ id: p.id, name: p.name })), activeAdminProfiles: roles.filter(u => u.role === "admin" && u.disabled !== true && u.accountType !== "client" && u.chatAccess?.audience !== "external" && u.chatAccess?.workRole !== "Client").length, secretsRead: false }));
}
function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "hosting.created.json")), "Do not restage a deployment already started.");
  fs.mkdirSync(portal, { recursive: true });
  for (const file of fs.readdirSync(path.join(stage, "before"))) fs.copyFileSync(path.join(stage, "before", file), path.join(portal, file));
  const local = fs.readFileSync(path.join(root, "public/app.js"), "utf8").replace(/\r\n/g, "\n");
  let app = fs.readFileSync(path.join(portal, "app.js"), "utf8").replace(/\r\n/g, "\n");
  app = once(app, "  retailers: [],", '  retailers: [],\n  retailerLoadStatus: "idle",\n  retailerLoadError: "",');
  const optionFunction = /function syncExtractionProfileOptions\([^]*?\n\}/;
  const oldOptions = app.match(optionFunction)?.[0], newOptions = local.match(optionFunction)?.[0]; assert.ok(oldOptions && newOptions);
  app = once(app, oldOptions, newOptions);
  const renderer = /function renderRetailers\(\) \{\n  elements\.retailerList\.innerHTML = [^\n]+\n  elements\.retailerCount\.textContent = [^\n]+/g;
  assert.equal([...app.matchAll(renderer)].length, 2);
  app = app.replace(renderer, "function renderRetailers() {\n  renderRetailerList();");
  const helpers = local.slice(local.indexOf("let retailerProfilesStop = null;"), local.indexOf("function clearAdminSubscriptions("));
  assert.ok(helpers.includes("function subscribeRetailerProfiles()"));
  app = once(app, "function clearAdminSubscriptions({ preserveAdmin = false } = {}) {", helpers + "function clearAdminSubscriptions({ preserveAdmin = false } = {}) {\n  stopRetailerProfiles();");
  const subscription = app.match(/  adminUnsubscribers\.push\(database\.collection\("retailers"\)\.onSnapshot\([^]*?\n  \}, \(error\) => showToast\(`Could not load extraction profiles:[^\n]+/)?.[0];
  assert.ok(subscription); app = once(app, subscription, "  subscribeRetailerProfiles();");
  app = once(app, "async function configureAdminSession(user) {", "async function configureAdminSession(user) {\n  stopRetailerProfiles();");
  const oldListener = app.match(/^elements\.retailerList\.addEventListener\([^\n]+/m)?.[0];
  const newListener = local.match(/^elements\.retailerList\.addEventListener\([^]*?\n\}\);/m)?.[0];
  assert.ok(oldListener && newListener); app = once(app, oldListener, newListener);
  app = once(app, '    showToast("Extraction profile saved.");', '    showToast("Extraction profile saved.");\n    subscribeRetailerProfiles();');
  fs.writeFileSync(path.join(portal, "app.js"), app);
  let html = fs.readFileSync(path.join(portal, "index.html"), "utf8").replace(/\r\n/g, "\n");
  const script = html.match(/<script defer src="app\.js\?v=[^"]+"><\/script>/)?.[0]; assert.ok(script);
  html = once(html, script, `<script defer src="admin-profile-loader.js?v=${tag}"></script>\n  <script defer src="app.js?v=${tag}"></script>`);
  fs.writeFileSync(path.join(portal, "index.html"), html);
  let worker = fs.readFileSync(path.join(portal, "service-worker.js"), "utf8").replace(/\r\n/g, "\n");
  worker = once(worker, worker.match(/^const CACHE = "[^"]+";/)[0], `const CACHE = "meridian-nexus-${tag}";`);
  worker = once(worker, worker.match(/app\.js\?v=[\w-]+/)[0], "app.js?v=" + tag);
  worker = once(worker, "const SHELL = [", `const SHELL = ["/admin-profile-loader.js?v=${tag}",`);
  fs.writeFileSync(path.join(portal, "service-worker.js"), worker);
  fs.copyFileSync(path.join(root, "public/admin-profile-loader.js"), path.join(portal, "admin-profile-loader.js"));
  for (const file of assets.filter(f => f.endsWith(".js"))) execFileSync(process.execPath, ["--check", path.join(portal, file)], { windowsHide: true });
  fs.writeFileSync(path.join(stage, "prepared.json"), JSON.stringify({ at: new Date().toISOString(), assets: Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(portal, file)))])) }, null, 2));
  console.log("Prepared four targeted assets from the exact live baseline; no production writes.");
}
function test() {
  const env = { ...process.env, NEXUS_PROFILE_PORTAL: portal };
  execFileSync(process.execPath, ["--test", "scripts/tests/admin-profile-loader.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["scripts/tests/admin-profiles-browser.cjs"], { cwd: root, env, stdio: "inherit", windowsHide: true });
  const prepared = read("prepared.json");
  for (const file of assets) assert.equal(hash(fs.readFileSync(path.join(portal, file))), prepared.assets[file]);
  fs.writeFileSync(path.join(stage, "tested.json"), JSON.stringify({ ...prepared, testedAt: new Date().toISOString() }, null, 2));
}
async function publish() {
  assert.ok(!fs.existsSync(path.join(stage, "hosting.created.json")));
  const before = read("hosting.before.json"), tested = read("tested.json");
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("hosting.files.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) {
    const bytes = fs.readFileSync(path.join(portal, file)); assert.equal(hash(bytes), tested.assets[file]);
    const compressed = zlib.gzipSync(bytes, { level: 9 }), digest = hash(compressed);
    files["/" + file] = digest; uploads.set(digest, compressed);
  }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config });
  save("hosting.created.json", { version, files });
  const result = await json(`${host}/${version.name}:populateFiles`, "POST", { files });
  const { Client, hosting } = await connect(); const uploader = new Client({ urlPrefix: result.uploadUrl, auth: true });
  for (const digest of result.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest), "Unexpected unrelated asset upload.");
    const response = await uploader.request({ method: "POST", path: "/" + digest, body: Readable.from([uploads.get(digest)]), resolveOnHTTPError: true, responseType: "stream" });
    response.body.resume(); assert.equal(response.status, 200);
  }
  await hosting.updateVersion(site, version.name.split("/").at(-1), { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await hosting.createRelease(site, "live", version.name, { message: "Recover admin extraction profile loading; retain Firestore authorization and credential handling" });
  console.log("Released " + version.name);
}
async function verify() {
  const current = await live(), created = read("hosting.created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const files = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!files.nextPageToken);
  assert.deepEqual(Object.fromEntries(files.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) {
    let matched = false;
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
      if (response.ok && hash(Buffer.from(await response.arrayBuffer())) === read("tested.json").assets[file]) { matched = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(matched, file + " live asset mismatch");
  }
  const rules = await json(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`);
  assert.equal(rules.rulesetName, read("firestore.rules.before.json").release.rulesetName);
  const result = { verifiedAt: new Date().toISOString(), version: current.release.version.name, assets, firestoreRulesUnchanged: true, credentialChanges: 0, functionsDeployed: 0, schedulesChanged: 0 };
  save("verified.json", result); console.log(JSON.stringify(result));
}
const actions = { audit, prepare, test, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { stage, site, project, host, save, read, live };
