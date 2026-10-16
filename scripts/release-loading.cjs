"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { Readable } = require("node:stream"), { execFileSync } = require("node:child_process");
const { connect } = require("./release-chat-etl-portal.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/loading-20260910"), portal = path.join(stage, "portal");
const site = "meridian-nexus", project = "meridain-nexus";
const names = ["app.js", "index.html", "service-worker.js", "meridian-chat.js"];
const read = name => fs.readFileSync(name, "utf8").replace(/\r\n/g, "\n");
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
const json = name => JSON.parse(read(path.join(stage, name)));
const canonical = name => name.replace("projects/730011371323/", `projects/${project}/`);
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json"))); fs.mkdirSync(portal, { recursive: true });
  const { hosting, client } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(current.release.version.name.split("/").at(-1), "28cb9f9bb7f6e532", "Production changed: review before preparing.");
  const r = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!r.body.nextPageToken);
  save("before.json", { current, files: r.body.files });
  for (const name of names) {
    const response = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(response.ok);
    const content = await response.text();
    const hash = crypto.createHash("sha256").update(zlib.gzipSync(content, { level: 9 })).digest("hex");
    assert.equal(hash, r.body.files.find(f => f.path === `/${name}`).hash, `Live bytes: ${name}`);
    fs.writeFileSync(path.join(stage, `before-${name}`), content); fs.writeFileSync(path.join(portal, name), content);
  }
  console.log(portal);
}
async function publish() {
  const { hosting, client, Client } = await connect(), before = json("before.json");
  const guard = async () => assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(before.current.release.version.name)); await guard();
  const checked = json("browser-verified.json"); assert.equal(checked.ok, true);
  const assets = Object.fromEntries([...names, "nexus-load-cache.js"].map(name => [name, read(path.join(portal, name))]));
  for (const [name, value] of Object.entries(assets)) assert.equal(crypto.createHash("sha256").update(value).digest("hex"), checked.hashes[name], `Tested bytes: ${name}`);
  execFileSync(process.execPath, ["--test", "scripts/tests/loading-cache.test.cjs", "scripts/tests/loading-worker.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) {
    const bytes = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(bytes).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, bytes);
  }
  const version = await hosting.createVersion(site, { config: before.current.release.version.config }); save("created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const r = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), responseType: "stream", resolveOnHTTPError: true }); r.body.resume(); assert.equal(r.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" }); await guard();
  await hosting.createRelease(site, "live", version, { message: "Faster shell/startup; scoped report cache; retained staff chat; no backend, rules, IAM or automation changes" });
  const listed = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!listed.body.nextPageToken); assert.deepEqual(Object.fromEntries(listed.body.files.map(f => [f.path, f.hash])), files);
  for (const [name, content] of Object.entries(assets)) {
    let matched = false;
    for (let i = 0; i < 12; i++) { const r = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (r.ok && (await r.text()).replace(/\r\n/g, "\n") === content) { matched = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(matched, name);
  }
  save("verified.json", { version, at: new Date().toISOString(), assets: Object.keys(assets), rulesChanged: false, backendChanged: false }); console.log(version);
}
module.exports = { stage, portal };
if (require.main === module) Promise.resolve().then(() => ({ prepare, publish }[process.argv[2]])()).catch(error => { console.error(error); process.exitCode = 1; });
