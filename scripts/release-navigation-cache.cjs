"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { json, hash } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/navigation-cache-20260924");
const host = "https://firebasehosting.googleapis.com/v1beta1", site = "meridian-nexus", project = "meridain-nexus";
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
function save(name, value) {
  const file = path.resolve(stage, name); assert.ok(file.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const policy = source => source.slice(source.indexOf('self.addEventListener("fetch",'), source.indexOf('\nfunction chatIdentity('));
async function prepare() {
  const before = await live(), manifest = await json(`${host}/${before.release.version.name}/files?pageSize=1000`);
  assert.ok(!manifest.nextPageToken); save("hosting.before.json", before); save("manifest.before.json", manifest);
  const response = await fetch(`https://${site}.web.app/service-worker.js?audit=${Date.now()}`, { cache: "no-store" }); assert.ok(response.ok);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), manifest.files.find(f => f.path === "/service-worker.js").hash);
  save("service-worker.before.js", bytes);
  const original = bytes.toString("utf8").replace(/\r\n/g, "\n"), local = fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8").replace(/\r\n/g, "\n");
  assert.match(original, /hit \|\| await network/); assert.ok(!policy(original).includes("if (navigation) {"));
  assert.ok(policy(local).includes("if (navigation) {")); assert.ok(policy(local).length > 1500);
  const updated = original.replace(policy(original), () => policy(local)).replace(/const CACHE = "[^"]+";/, 'const CACHE = "meridian-nexus-20260924-fresh-navigation";');
  assert.equal(updated.slice(updated.indexOf("function chatIdentity(")), original.slice(original.indexOf("function chatIdentity(")));
  assert.equal(updated.slice(updated.indexOf("const SHELL"), updated.indexOf('self.addEventListener("fetch",')), original.slice(original.indexOf("const SHELL"), original.indexOf('self.addEventListener("fetch",')));
  save("service-worker.js", updated); save("prepared.json", { hash: hash(Buffer.from(updated)), at: new Date().toISOString() });
  console.log("Exact live service worker staged; shell assets, notifications and all other Hosting files preserved.");
}
function test() {
  assert.equal(hash(fs.readFileSync(path.join(stage, "service-worker.js"))), read("prepared.json").hash);
  execFileSync(process.execPath, ["--check", path.join(stage, "service-worker.js")], { stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["--test", "scripts/tests/service-worker.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env, NEXUS_SW_FILE: path.join(stage, "service-worker.js") } });
  execFileSync(process.execPath, ["scripts/tests/service-worker-browser.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  save("tested.json", { ...read("prepared.json"), realBrowser: true });
}
async function publish() {
  const bytes = fs.readFileSync(path.join(stage, "service-worker.js")); assert.equal(hash(bytes), read("tested.json").hash);
  const before = read("hosting.before.json"); assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), zipped = zlib.gzipSync(bytes, { level: 9 }), digest = hash(zipped);
  files["/service-worker.js"] = digest;
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  for (const required of upload.uploadRequiredHashes || []) {
    assert.equal(required, digest);
    const result = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: zipped });
    await result.arrayBuffer(); assert.equal(result.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "Serve current portal HTML first; retain offline fallback without interrupting open tabs" });
  console.log("Published " + version.name);
}
async function verify() {
  const current = await live(), created = read("hosting.created.json"), before = read("hosting.before.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files); assert.deepEqual(current.release.version.config, before.release.version.config);
  for (const origin of [`https://${site}.web.app`, `https://${site}.firebaseapp.com`]) {
    const response = await fetch(`${origin}/service-worker.js?verify=${Date.now()}`, { cache: "no-store" }); assert.ok(response.ok);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), read("tested.json").hash);
    const page = await (await fetch(origin + "/?verify=" + Date.now(), { cache: "no-store" })).text(); assert.match(page, /etls\.js\?v=20260924-shared-etls/);
  }
  save("verified.json", { at: new Date().toISOString(), version: current.release.version.name, changedFiles: ["/service-worker.js"], otherHostingFilesPreserved: true, backendOrBusinessDataChanged: false });
  console.log("Both live domains verified. Only the service worker changed; shared ETLs and business data untouched.");
}
const actions = { prepare, test, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
