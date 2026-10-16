"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const crypto = require("node:crypto"), zlib = require("node:zlib"), { Readable } = require("node:stream");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."), project = "meridain-nexus", site = "meridian-nexus-drop";
const bucket = `${project}.firebasestorage.app`, stage = path.join(root, ".tmp/launch-readiness/drop-release");
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name)));
const save = (name, value) => { fs.mkdirSync(stage, { recursive: true }); fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2)); };
const cliPath = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools");
const cli = require(cliPath), hosting = require(path.join(cliPath, "lib/hosting/api")), { Client } = require(path.join(cliPath, "lib/apiv2"));
const canonical = name => name.replace("projects/730011371323/", `projects/${project}/`);
let token;
async function api(url, method = "GET", body) {
  token ||= execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", `--project=${project}`, "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${method} ${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}
async function connect() {
  await cli.hosting.channel.list({ project, site, nonInteractive: true });
  return new Client({ urlPrefix: "https://firebasehosting.googleapis.com", apiVersion: "v1beta1", auth: true });
}
function block(source, prefix) {
  const start = source.indexOf(`    match /${prefix}/`);
  assert.ok(start >= 0 && source.indexOf(`    match /${prefix}/`, start + 1) < 0);
  const end = source.indexOf("    match /", start + 1);
  assert.ok(end > start);
  return { start, end, content: source.slice(start, end) };
}
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Keep the original backup");
  const summary = JSON.parse(fs.readFileSync(path.join(root, ".tmp/launch-readiness/security-summary.json")));
  assert.ok(summary.listingComplete && summary.objects === 0 && summary.metadataRows === 0, "Review existing data before retiring sharing");
  const rules = {};
  for (const [kind, prefix] of [["firestore", "fileDrops"], ["storage", "file-drops"]]) {
    const baseline = JSON.parse(fs.readFileSync(path.join(root, `.tmp/launch-readiness/${kind}.before.json`)));
    assert.equal(baseline.rules.source.files.length, 1);
    const previous = baseline.rules.source.files[0].content;
    const local = fs.readFileSync(path.join(root, `${kind}.rules`), "utf8");
    const oldBlock = block(previous, prefix), newBlock = block(local, prefix);
    assert.match(newBlock.content, /allow read, write: if false;/);
    assert.equal((previous.slice(0, oldBlock.start) + previous.slice(oldBlock.end)).replace(/\r/g, ""), (local.slice(0, newBlock.start) + local.slice(newBlock.end)).replace(/\r/g, ""), "Unrelated local rules changes must not be released");
    rules[kind] = { baseline, source: { files: [{ name: baseline.rules.source.files[0].name, content: previous.slice(0, oldBlock.start) + newBlock.content + previous.slice(oldBlock.end) }] } };
  }
  const client = await connect(), current = await hosting.getChannel(project, site, "live");
  const { body } = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } });
  assert.ok(!body.nextPageToken);
  const main = await hosting.getChannel(project, "meridian-nexus", "live");
  const assets = Object.fromEntries(["index.html", "app.js"].map(name => [name, fs.readFileSync(path.join(root, "public-drop", name), "utf8")]));
  save("before.json", { current, files: body.files, mainVersion: main.release.version.name, rules, assets });
  console.log(JSON.stringify({ prepared: true, site, rules: Object.keys(rules), files: Object.keys(assets), existingObjects: 0 }));
}
async function deployRules() {
  const before = read("before.json");
  for (const kind of ["firestore", "storage"]) {
    const { baseline, source } = before.rules[kind], url = `https://firebaserules.googleapis.com/v1/${baseline.release.name}`;
    const current = await api(url);
    const afterFile = `${kind}.after.json`;
    if (fs.existsSync(path.join(stage, afterFile))) { assert.equal(current.rulesetName, read(afterFile).rulesetName); continue; }
    assert.equal(current.rulesetName, baseline.release.rulesetName, "Live rules changed since review");
    const ruleset = await api(`https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`, "POST", { source });
    save(`${kind}.created.json`, ruleset);
    assert.equal((await api(url)).rulesetName, baseline.release.rulesetName);
    const release = await api(url, "PATCH", { release: { name: baseline.release.name, rulesetName: ruleset.name }, updateMask: "rulesetName" });
    save(afterFile, release);
    assert.equal((await api(url)).rulesetName, ruleset.name);
    console.log(JSON.stringify({ rules: kind, released: ruleset.name }));
  }
}
async function deployHosting() {
  const before = read("before.json"), client = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(before.current.release.version.name));
  for (const kind of ["firestore", "storage"]) assert.ok(fs.existsSync(path.join(stage, `${kind}.after.json`)), "Retire access before publishing notice");
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(before.assets)) { const gz = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(gz).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, gz); }
  const config = structuredClone(current.release.version.config || {});
  const headers = { "Content-Security-Policy": "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
  config.headers = [...(config.headers || []).filter(h => h.glob !== "**"), { glob: "**", headers }];
  const version = await hosting.createVersion(site, { config }); save("hosting.created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const response = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); response.body.resume(); assert.equal(response.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(current.release.version.name));
  await hosting.createRelease(site, "live", version, { message: "Retire anonymous file drops; direct authorised users to Nexus Resources" });
  console.log(JSON.stringify({ site, version }));
}
async function verify() {
  const before = read("before.json"), { version, files } = read("hosting.created.json"), client = await connect();
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(version));
  assert.equal(canonical((await hosting.getChannel(project, "meridian-nexus", "live")).release.version.name), canonical(before.mainVersion));
  const { body } = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } });
  assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), files);
  for (const [name, expected] of Object.entries(before.assets)) {
    let matched = false;
    for (let attempt = 0; attempt < 12; attempt++) { const r = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`); if (r.ok && await r.text() === expected) { assert.equal(r.headers.get("referrer-policy"), "no-referrer"); matched = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(matched, `Hosting propagation not verified: ${name}`);
  }
  for (const kind of ["firestore", "storage"]) { const after = read(`${kind}.after.json`); assert.equal((await api(`https://firebaserules.googleapis.com/v1/${after.name}`)).rulesetName, after.rulesetName); }
  const objects = await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=file-drops%2F&maxResults=1000&fields=items(name,generation),nextPageToken`);
  assert.ok(!objects.nextPageToken && !(objects.items || []).length, "New historical objects require token revocation review");
  const denied = {};
  for (const [name, url] of Object.entries({ firestore: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/fileDrops`, storage: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?prefix=file-drops%2F` })) { const response = await fetch(url); assert.equal(response.status, 403, `${name} must reject anonymous listing`); denied[name] = response.status; }
  save("verified.json", { verifiedAt: new Date().toISOString(), version, anonymousListing: denied, historicalObjects: 0, mainHostingUnchanged: true });
  console.log(JSON.stringify(read("verified.json")));
}
const actions = { prepare, rules: deployRules, hosting: deployHosting, verify };
if (!actions[process.argv[2]]) throw new Error("Use prepare, rules, hosting or verify");
actions[process.argv[2]]().catch(e => { console.error(e.message); process.exitCode = 1; });
