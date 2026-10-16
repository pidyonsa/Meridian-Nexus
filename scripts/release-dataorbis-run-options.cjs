"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { json, hash, once } = require("./release-multi-admin.cjs");
const promptRepair = ["1", "2"].includes(process.env.NEXUS_PROMPT_REPAIR), promptRaceRepair = process.env.NEXUS_PROMPT_REPAIR === "2";
const root = path.resolve(__dirname, ".."), stage = path.join(root, promptRaceRepair ? ".tmp/dataorbis-otp-race-20260923" : promptRepair ? ".tmp/dataorbis-otp-repair-20260923" : ".tmp/dataorbis-run-options-20260923"), portal = path.join(stage, "portal");
const host = "https://firebasehosting.googleapis.com/v1beta1", site = "meridian-nexus";
const assets = ["app.js", "index.html", "service-worker.js"], tag = promptRaceRepair ? "20260923-otp-retry-2" : promptRepair ? "20260923-otp-retry" : "20260923-dataorbis-run-options";
const save = (name, value) => { const file = path.join(stage, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: "wx" }); };
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
const live = () => json(`${host}/projects/meridain-nexus/sites/${site}/channels/live`);
async function prepare() {
  const before = await live(), manifest = await json(`${host}/${before.release.version.name}/files?pageSize=1000`);
  assert.ok(!manifest.nextPageToken);
  save("before.json", before); save("files.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const data = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(data, { level: 9 })), item.hash);
    save("before" + item.path, data); save("portal" + item.path, data);
  }
  const source = fs.readFileSync(path.join(root, "public/app.js"), "utf8").replace(/\r\n/g, "\n");
  let app = fs.readFileSync(path.join(portal, "app.js"), "utf8").replace(/\r\n/g, "\n");
  const fn = name => new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
  if (promptRepair) {
    for (const name of ["subscribeOwnerPrompts", "handleAutomationPrompt", "syncAutomationPromptModal", "submitAutomationPromptValue"]) {
      const old = app.match(fn(name))?.[0], next = source.match(fn(name))?.[0]; assert.ok(old && next);
      app = once(app, old, next);
    }
  } else {
  assert.ok(!app.includes("function operationsProfiles("));
  app = once(app, "function currentOperationsProfile() {", source.match(fn("operationsProfiles"))[0] + "\n\nfunction currentOperationsProfile() {");
  for (const name of ["renderOperationsSchedule", "renderRetailerRunDetails", "currentOperationsProfile", "renderOperationsWorkspace"]) {
    const old = app.match(fn(name))?.[0], next = source.match(fn(name))?.[0]; assert.ok(old && next);
    app = once(app, old, next);
  }
  const old = 'elements.operationsRunExtraction.addEventListener("click", async () => {\n  const profile = currentOperationsProfile();\n  if (!profile) return;';
  app = once(app, old, old.replace("if (!profile)", "if (!profile || profile.setupRequired === true)"));
  }
  fs.writeFileSync(path.join(portal, "app.js"), app);
  for (const file of ["index.html", "service-worker.js"]) {
    const content = fs.readFileSync(path.join(portal, file), "utf8");
    const previousTag = promptRaceRepair ? "20260923-otp-retry" : promptRepair ? "20260923-dataorbis-run-options" : "20260923-admin-profiles";
    assert.ok(content.includes(previousTag));
    fs.writeFileSync(path.join(portal, file), content.replaceAll(previousTag, tag));
  }
  assert.equal((await live()).release.version.name, before.release.version.name);
  save("prepared.json", { before: before.release.version.name, assets: Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(portal, file)))])) });
  console.log(JSON.stringify({ prepared: assets, baseline: before.release.version.name, productionChanges: 0 }));
}
async function publish() {
  const before = read("before.json"), prepared = read("browser-passed.json");
  assert.ok(fs.existsSync(path.join(stage, "browser-passed.json")), "Browser verification is required.");
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("files.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) {
    const data = fs.readFileSync(path.join(portal, file)); assert.equal(hash(data), prepared.assets[file]);
    const compressed = zlib.gzipSync(data, { level: 9 }), digest = hash(compressed);
    files["/" + file] = digest; uploads.set(digest, compressed);
  }
  let version;
  if (fs.existsSync(path.join(stage, "created.json"))) {
    const existing = read("created.json"); assert.deepEqual(existing.files, files);
    version = await json(`${host}/${existing.version.name}`);
    assert.equal(version.status, "CREATED", "Only an unreleased preparation can be resumed.");
  } else {
    version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config });
    save("created.json", { version, files });
  }
  const result = await json(`${host}/${version.name}:populateFiles`, "POST", { files });
  const uploadUrl = new URL(result.uploadUrl);
  assert.equal(uploadUrl.protocol, "https:");
  assert.equal(uploadUrl.hostname, "upload-firebasehosting.googleapis.com");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  for (const digest of result.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest));
    const response = await fetch(result.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) });
    await response.arrayBuffer(); assert.equal(response.status, 200, "Hosting upload failed.");
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: promptRepair ? "Repair Nexus OTP popup state, submission feedback and owner-only HTTP status polling" : "Show admin DataOrbis setup profiles in Run Job without enabling unvalidated jobs" });
  console.log("Released " + version.name);
}
async function verify() {
  const current = await live(), created = read("created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("before.json").release.version.config);
  for (const file of assets) {
    let matched = false;
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
      if (response.ok && hash(Buffer.from(await response.arrayBuffer())) === read("browser-passed.json").assets[file]) { matched = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(matched, file);
  }
  const result = { at: new Date().toISOString(), version: current.release.version.name, changedAssets: assets, functionsDeployed: 0, schedulesChanged: 0, credentialsChanged: 0 };
  save("verified.json", result); console.log(JSON.stringify(result));
}
const actions = { prepare, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { stage, portal };
