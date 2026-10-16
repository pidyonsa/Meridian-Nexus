"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), { Readable } = require("node:stream");
const { integrateAssets, gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/approved-admin-chat-etl-20260909");
const portal = path.join(stage, "chat-etl-portal"), ai = path.join(stage, "ai-feature");
const project = "meridain-nexus", site = "meridian-nexus", region = "us-central1", tag = "20260909-chat-etl";
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const json = name => JSON.parse(read(path.join(stage, name)));
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
function once(text, before, after) { assert.equal(text.split(before).length, 2, `Ambiguous anchor: ${before.slice(0, 90)}`); return text.replace(before, () => after); }
function block(text, re) { const value = text.match(re)?.[0]; assert.ok(value, `Missing source block: ${re}`); return value; }
function assemble() {
  fs.mkdirSync(portal, { recursive: true });
  const baseline = Object.fromEntries(["index.html", "app.js", "service-worker.js"].map(name => [name, read(path.join(stage, `live-${name}`))]));
  const assets = integrateAssets(baseline, { appTagBefore: "20260909-admin-user-repair", appTagAfter: tag, cacheBefore: "meridian-nexus-v53-admin", cacheAfter: "meridian-nexus-v54-chat-etl" });
  assets["app.js"] = once(assets["app.js"], "function syncMeridianChat() {", 'function syncMeridianChat() {\n  if (state.authResolved) window.MeridianChatTools?.identity(state.isOperator && operatorCanAccessNavigation("chat") ? auth?.currentUser?.uid || null : null).catch(() => {});');
  const adminSubmit = /elements\.adminUserForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?\n\}\);/;
  assert.equal(block(assets["app.js"], adminSubmit), block(baseline["app.js"], adminSubmit), "Do not activate the separately pending full Admin rollout.");
  assets["index.html"] = once(assets["index.html"], '<script defer src="meridian-chat.js?v=20260908-chat-tasks"></script>', `<script defer src="chat-tools.js?v=${tag}"></script>\n    <script defer src="meridian-chat.js?v=${tag}"></script>`);
  assets["index.html"] = once(assets["index.html"], "meridian-chat.css?v=20260908-chat-tasks", `meridian-chat.css?v=${tag}`);
  for (const name of ["meridian-chat.js", "meridian-chat.css", "chat-tools.js"]) assets[name] = read(path.join(root, "public", name));
  const localWorker = read(path.join(root, "public/service-worker.js"));
  const shell = JSON.parse(block(assets["service-worker.js"], /const SHELL = \[[^]*?\];/).slice("const SHELL = ".length, -1));
  for (let i = 0; i < shell.length; i++) shell[i] = shell[i].replace("meridian-chat.js?v=20260908-chat-tasks", `meridian-chat.js?v=${tag}`).replace("meridian-chat.css?v=20260908-chat-tasks", `meridian-chat.css?v=${tag}`);
  shell.push(`/chat-tools.js?v=${tag}`, "/etls.js?v=20260909-etls1", "/etls.css?v=20260909-etls1");
  assets["service-worker.js"] = `const CACHE = "meridian-nexus-v54-chat-etl";\nconst SHELL = ${JSON.stringify(shell)};\n\n${localWorker.slice(localWorker.indexOf('self.addEventListener("install"'))}`;
  for (const [name, content] of Object.entries(assets)) {
    fs.writeFileSync(path.join(portal, name), content);
    if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(portal, name)]);
  }
  save("chat-etl-hosting.assets.json", assets);
  fs.mkdirSync(ai, { recursive: true });
  const source = path.join(stage, "sources/askNexusAssistant");
  fs.cpSync(source, ai, { recursive: true, filter: name => !name.split(path.sep).includes("node_modules") });
  const before = read(path.join(source, "index.js")), local = read(path.join(root, "functions/index.js"));
  let updated = before; const replacements = [];
  for (const re of [/(?:async )?function askGemini\([^]*?\n\}/, /(?:async )?function nexusAssistantWorkspaceContext\([^]*?\n\}/, /exports\.askNexusAssistant = onCall\([^]*?\n\}\);/]) {
    const from = block(updated, re), to = block(local, re); updated = once(updated, from, to); replacements.push([from, to]);
  }
  let reversed = updated; for (const [from, to] of replacements.reverse()) reversed = once(reversed, to, from); assert.equal(reversed, before);
  // Only the AI implementation changes here. The shared role policy stays at its live baseline.
  fs.writeFileSync(path.join(ai, "index.js"), updated);
  for (const name of ["assistant-access.js", "assistant-memory.js", "meridian-chat.js", "chat-media.js", "chat-notifications.js", "admin-access.js"]) fs.copyFileSync(path.join(root, "functions", name), path.join(ai, name));
  fs.writeFileSync(path.join(ai, ".gcloudignore"), "node_modules\n.git\n");
  execFileSync(process.execPath, ["--check", path.join(ai, "index.js")]);
  console.log(JSON.stringify({ portal, changedAssets: Object.keys(assets), adminFormUnchanged: true, aiSharedRolePolicyUnchanged: true }));
}
async function deployAi() {
  const before = JSON.parse(gc("functions", "describe", "askNexusAssistant", "--gen2", `--project=${project}`, `--region=${region}`, "--format=json"));
  const baseline = json("functions.before.json").find(f => f.name.endsWith("/askNexusAssistant"));
  assert.equal(before.serviceConfig.revision, baseline.serviceConfig.revision);
  gc("functions", "deploy", "askNexusAssistant", "--gen2", `--project=${project}`, `--region=${region}`, `--source=${ai}`, "--entry-point=askNexusAssistant", "--runtime=nodejs22", "--quiet", "--format=json");
  const after = JSON.parse(gc("functions", "describe", "askNexusAssistant", "--gen2", `--project=${project}`, `--region=${region}`, "--format=json"));
  for (const key of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key]);
  assert.equal(after.state, "ACTIVE"); save("askNexusAssistant.feature-after.json", after); console.log(after.serviceConfig.revision);
}
async function connect() {
  const cliPath = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools"), cli = require(cliPath);
  const hosting = require(path.join(cliPath, "lib/hosting/api")), { Client } = require(path.join(cliPath, "lib/apiv2"));
  await cli.hosting.channel.list({ project, site, nonInteractive: true });
  return { hosting, Client, client: new Client({ urlPrefix: "https://firebasehosting.googleapis.com", apiVersion: "v1beta1", auth: true }) };
}
const canonical = value => value.replace("projects/730011371323/", `projects/${project}/`);
async function deployHosting() {
  for (const name of ["meridianChat", "meridianChatMedia", "notifyMeridianChatMessage", "deliverMeridianChatReminders", "askNexusAssistant"]) assert.equal(json(`${name}.feature-after.json`).state, "ACTIVE");
  assert.equal(JSON.parse(read(path.join(root, ".tmp/etl-release-20260909/api.after.json"))).state, "ACTIVE");
  assert.equal(JSON.parse(read(path.join(root, ".tmp/etl-release-20260909/cloud-smoke.verified.json"))).status, "ready");
  const { hosting, client, Client } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(json("hosting.before.json").release.version.name), "Live Hosting changed; review first.");
  assert.ok(fs.existsSync(path.join(stage, "chat-etl-browser-verified.json")), "Run the staged browser checks first.");
  const verified = json("chat-etl-browser-verified.json");
  const assets = json("chat-etl-hosting.assets.json"), files = Object.fromEntries(json("hosting-files.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) {
    assert.equal(read(path.join(portal, name)), content);
    assert.equal(crypto.createHash("sha256").update(content).digest("hex"), verified.hashes[name], `Asset changed after browser checks: ${name}`);
    const buffer = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(buffer).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, buffer);
  }
  const version = await hosting.createVersion(site, { config: current.release.version.config }); save("chat-etl-hosting.created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) {
    assert.ok(uploads.has(hash)); const response = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); response.body.resume(); assert.equal(response.status, 200);
  }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(current.release.version.name));
  await hosting.createRelease(site, "live", version, { message: "Staff chat media, voice, offline queue and reviewed AI tasks; admin-only ETLs. Preserve current Admin role policy and all dashboards." });
  console.log(version);
}
async function verify() {
  const { hosting, client } = await connect(), expected = json("chat-etl-hosting.created.json"), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(expected.version));
  const { body } = await client.get(`/${expected.version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken);
  assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), expected.files);
  for (const [name, content] of Object.entries(json("chat-etl-hosting.assets.json"))) {
    let matched = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
      if (response.ok && normal(await response.text()) === content) { matched = true; break; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.ok(matched, `Asset not propagated: ${name}`);
  }
  const result = { version: expected.version, tag, verifiedAt: new Date().toISOString(), adminRoleRollout: "pending explicit production approval", push: "pending project public VAPID key" };
  save("chat-etl-hosting.verified.json", result); console.log(JSON.stringify(result));
}
const normal = value => value.replace(/\r\n/g, "\n");
const actions = { assemble, deployAi, deployHosting, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { stage, portal, tag, connect };
