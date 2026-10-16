"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), { Readable } = require("node:stream");
const { connect } = require("./release-chat-etl-portal.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/no-etls-20260909"), portal = path.join(stage, "portal");
const site = "meridian-nexus", project = "meridain-nexus", tag = "20260909-no-etls";
const normal = value => value.replace(/\r\n/g, "\n"), canonical = value => value.replace("projects/730011371323/", `projects/${project}/`);
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
async function main() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Inspect the previous attempt before rerunning this release.");
  fs.mkdirSync(portal, { recursive: true });
  const { hosting, client, Client } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(current.release.version.name.split("/").at(-1), "3476bf28670044fe", "Review the changed production baseline first.");
  const { body } = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken);
  save("before.json", { current, files: body.files });
  const assets = {}, replacements = { "app.js": 4, "index.html": 1, "etls.js": 3 };
  for (const name of ["app.js", "index.html", "etls.js", "service-worker.js"]) {
    const response = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(response.ok);
    const before = normal(await response.text()); fs.writeFileSync(path.join(stage, `before-${name}`), before);
    if (replacements[name]) assert.equal((before.match(/\bETLs\b/g) || []).length, replacements[name], `Unexpected label count: ${name}`);
    assets[name] = replacements[name] ? before.replace(/\bETLs\b/g, "No-ETLs") : before;
    if (replacements[name]) assert.equal(assets[name].replace(/\bNo-ETLs\b/g, "ETLs"), before, "Only labels may change in application code.");
    if (["index.html", "service-worker.js"].includes(name)) {
      for (const [from, to] of [["app.js?v=20260909-chat-etl", `app.js?v=${tag}`], ["etls.js?v=20260909-etls2", `etls.js?v=${tag}`]]) { assert.ok(assets[name].includes(from)); assets[name] = assets[name].replaceAll(from, to); }
    }
    if (name === "service-worker.js") { assert.ok(assets[name].includes("meridian-nexus-v55-etl-downloads")); assets[name] = assets[name].replace("meridian-nexus-v55-etl-downloads", "meridian-nexus-v56-no-etls"); }
    fs.writeFileSync(path.join(portal, name), assets[name]);
    if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(portal, name)]);
  }
  save("assets.json", assets);
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env, NEXUS_PORTAL_STAGE: portal, NEXUS_ETL_LABEL: "No-ETLs" } });
  const files = Object.fromEntries(body.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) {
    assert.equal(normal(fs.readFileSync(path.join(portal, name), "utf8")), content);
    const bytes = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(bytes).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, bytes);
  }
  save("tested.json", { verifiedAt: new Date().toISOString(), displayName: "No-ETLs", route: "#etls", syntheticOnly: true });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(current.release.version.name));
  const version = await hosting.createVersion(site, { config: current.release.version.config }); save("created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const response = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); response.body.resume(); assert.equal(response.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(current.release.version.name));
  await hosting.createRelease(site, "live", version, { message: "Rename ETLs to No-ETLs: display labels only, existing route, permissions and processing unchanged" });
  const live = await hosting.getChannel(project, site, "live"); assert.equal(canonical(live.release.version.name), canonical(version));
  const actual = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!actual.body.nextPageToken); assert.deepEqual(Object.fromEntries(actual.body.files.map(f => [f.path, f.hash])), files);
  for (const [name, content] of Object.entries(assets)) {
    let ok = false;
    for (let n = 0; n < 12; n++) { const response = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (response.ok && normal(await response.text()) === content) { ok = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(ok, `Asset not propagated: ${name}`);
  }
  const result = { version, displayName: "No-ETLs", route: "#etls", changedAssets: 4, functionsChanged: 0, rulesChanged: 0, verifiedAt: new Date().toISOString() };
  save("verified.json", result); console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
