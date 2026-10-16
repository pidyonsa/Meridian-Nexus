"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { Readable } = require("node:stream"), { execFileSync } = require("node:child_process");
const { connect } = require("./release-chat-etl-portal.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/picknpay-restoration-20260909/hosting"), portal = path.join(stage, "portal");
const site = "meridian-nexus", project = "meridain-nexus", tag = "20260909-pnp-setup";
const normal = s => s.replace(/\r\n/g, "\n"), read = f => normal(fs.readFileSync(f, "utf8"));
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
const json = name => JSON.parse(read(path.join(stage, name)));
const canonical = name => name.replace("projects/730011371323/", `projects/${project}/`);
function once(value, from, to) { assert.equal(value.split(from).length, 2, `Ambiguous anchor: ${from.slice(0, 60)}`); return value.replace(from, () => to); }
function updateApp(value) {
  const helper = read(path.join(root, "public/app.js")).match(/function renderRetailerSetupStatus\(retailer = null\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(helper);
  value = once(value, "function resetRetailerForm() {", `${helper}\n\nfunction resetRetailerForm() {`);
  value = once(value, "  syncSalesforceConnectedAppFields();\n}", "  syncSalesforceConnectedAppFields();\n  renderRetailerSetupStatus();\n}");
  return once(value, "  syncSalesforceConnectedAppFields(retailer);\n  elements.retailerList", "  syncSalesforceConnectedAppFields(retailer);\n  renderRetailerSetupStatus(retailer);\n  elements.retailerList");
}
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Review existing staging before preparing again.");
  fs.mkdirSync(portal, { recursive: true });
  const { hosting, client } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(current.release.version.name.split("/").at(-1), "613508f64db201e4", "Production changed; review before staging.");
  const { body } = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken);
  save("before.json", { current, files: body.files });
  const assets = {};
  for (const name of ["app.js", "index.html", "service-worker.js"]) {
    const response = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(response.ok);
    const before = normal(await response.text()); fs.writeFileSync(path.join(stage, `before-${name}`), before);
    if (name === "app.js") assets[name] = updateApp(before);
    else if (name === "index.html") assets[name] = once(before, '<form class="management-panel" id="retailerForm">', '<form class="management-panel" id="retailerForm">\n                    <p class="management-note" id="retailerSetupStatus" role="status" hidden></p>');
    else assets[name] = once(before, "meridian-nexus-v56-no-etls", "meridian-nexus-v57-pnp-setup");
    if (name !== "app.js") assets[name] = once(assets[name], "app.js?v=20260909-no-etls", `app.js?v=${tag}`);
    fs.writeFileSync(path.join(portal, name), assets[name]);
    if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(portal, name)]);
  }
  save("assets.json", assets);
  console.log(`Prepared only the Pick n Pay setup notice: ${portal}`);
}
async function publish() {
  const before = json("before.json"), assets = json("assets.json");
  execFileSync(process.execPath, ["--test", "scripts/tests/picknpay-restoration.test.cjs"], { cwd: root, windowsHide: true, stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/tests/picknpay-setup-browser.cjs"], { cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env, NEXUS_PORTAL_STAGE: portal } });
  const { hosting, client, Client } = await connect();
  const unchanged = async () => assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(before.current.release.version.name), "Live release changed while testing.");
  await unchanged();
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) {
    assert.equal(read(path.join(portal, name)), content);
    const bytes = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(bytes).digest("hex");
    files[`/${name}`] = hash; uploads.set(hash, bytes);
  }
  const version = await hosting.createVersion(site, { config: before.current.release.version.config }); save("created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) {
    assert.ok(uploads.has(hash), "Unrelated production asset must already exist.");
    const r = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); r.body.resume(); assert.equal(r.status, 200);
  }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" }); await unchanged();
  await hosting.createRelease(site, "live", version, { message: "Pick n Pay connection setup status only; no runnable workflow, role/rule changes or schedules" });
  const { body } = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken);
  assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), files);
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(version));
  for (const [name, content] of Object.entries(assets)) {
    let matched = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
      if (r.ok && normal(await r.text()) === content) { matched = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(matched, `Unverified live asset: ${name}`);
  }
  const evidence = { version, verifiedAt: new Date().toISOString(), changedAssets: Object.keys(assets), functionsChanged: 0, rulesChanged: 0, schedulesEnabled: 0 };
  save("verified.json", evidence); console.log(JSON.stringify(evidence));
}
module.exports = { updateApp };
if (require.main === module) (process.argv[2] === "prepare" ? prepare() : process.argv[2] === "publish" ? publish() : Promise.reject(new Error("Specify prepare or publish"))).catch(e => { console.error(e.stack); process.exitCode = 1; });
