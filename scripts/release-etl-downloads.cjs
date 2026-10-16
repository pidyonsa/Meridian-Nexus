"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), { Readable } = require("node:stream");
const { stage: parent, connect } = require("./release-chat-etl-portal.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(parent, "etl-downloads"), portal = path.join(stage, "portal"), site = "meridian-nexus", project = "meridain-nexus";
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const json = name => JSON.parse(read(path.join(stage, name)));
const save = (name, data) => fs.writeFileSync(path.join(stage, name), JSON.stringify(data, null, 2));
const canonical = name => name.replace("projects/730011371323/", `projects/${project}/`);
async function prepare() {
  fs.mkdirSync(portal, { recursive: true });
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Preserve the existing download-fix baseline.");
  const before = JSON.parse(read(path.join(parent, "chat-etl-hosting.created.json")));
  const { hosting } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(before.version)); save("before.json", { ...before, config: current.release.version.config });
  const assets = JSON.parse(read(path.join(parent, "chat-etl-hosting.assets.json")));
  assets["etls.js"] = read(path.join(root, "public/etls.js"));
  for (const name of ["index.html", "service-worker.js"]) assets[name] = assets[name].replaceAll("etls.js?v=20260909-etls1", "etls.js?v=20260909-etls2");
  assets["service-worker.js"] = assets["service-worker.js"].replace("meridian-nexus-v54-chat-etl", "meridian-nexus-v55-etl-downloads");
  for (const [name, content] of Object.entries(assets)) fs.writeFileSync(path.join(portal, name), content);
  save("assets.json", Object.fromEntries(["index.html", "service-worker.js", "etls.js"].map(name => [name, assets[name]])));
  fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(root, ".tmp/etl-release-20260909/api/meridian-etl.js"));
  save("api.before.json", JSON.parse(read(path.join(root, ".tmp/etl-release-20260909/api.after.json"))));
  console.log("Prepared three-asset download fix; no Admin, chat or dashboard changes.");
}
function test() {
  execFileSync(process.execPath, ["--test", "scripts/tests/etl-api.test.cjs"], { cwd: root, windowsHide: true, stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env, NEXUS_PORTAL_STAGE: portal } });
  save("tested.json", { verifiedAt: new Date().toISOString(), hashes: Object.fromEntries(Object.entries(json("assets.json")).map(([name, content]) => [name, crypto.createHash("sha256").update(content).digest("hex")])) });
}
async function publish() {
  const after = JSON.parse(read(path.join(root, ".tmp/etl-release-20260909/api.after.json")));
  assert.equal(after.state, "ACTIVE"); assert.notEqual(after.serviceConfig.revision, json("api.before.json").serviceConfig.revision);
  const { hosting, client, Client } = await connect(), before = json("before.json"), tested = json("tested.json"), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(before.version));
  const files = { ...before.files }, uploads = new Map();
  for (const [name, content] of Object.entries(json("assets.json"))) {
    assert.equal(crypto.createHash("sha256").update(content).digest("hex"), tested.hashes[name]);
    const bytes = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(bytes).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, bytes);
  }
  const version = await hosting.createVersion(site, { config: current.release.version.config }); save("created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const r = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); r.body.resume(); assert.equal(r.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(before.version));
  await hosting.createRelease(site, "live", version, { message: "ETL downloads use bounded authenticated reads, with generation checks and no signing or impersonation grants" }); console.log(version);
}
async function verify() {
  const { hosting, client } = await connect(), created = json("created.json"), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(created.version));
  const { body } = await client.get(`/${created.version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken); assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), created.files);
  for (const [name, content] of Object.entries(json("assets.json"))) {
    let ok = false;
    for (let n = 0; n < 12; n++) { const r = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (r.ok && (await r.text()).replace(/\r\n/g, "\n") === content) { ok = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(ok, `Not propagated: ${name}`);
  }
  const report = { version: created.version, verifiedAt: new Date().toISOString(), changedAssets: 3, signedLinksRequired: false, staffRoleChanges: false };
  save("verified.json", report); console.log(JSON.stringify(report));
}
const actions = { prepare, test, publish, verify };
Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
