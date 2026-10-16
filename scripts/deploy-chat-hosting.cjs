const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const root = path.resolve(__dirname, "..");
const stageName = process.argv[2] || "";
assert.ok(["", "staff-defaults", "chat-tasks"].includes(stageName));
const stage = path.join(root, ".tmp/chat-release", stageName);
const cliPath = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools");
const cli = require(cliPath);
const api = require(path.join(cliPath, "lib/hosting/api"));
const { Client } = require(path.join(cliPath, "lib/apiv2"));
const readJson = name => JSON.parse(fs.readFileSync(path.join(stage, name)));
const changes = ["app.js", "index.html", "service-worker.js", "meridian-chat.js", "meridian-chat.css"];
async function main() {
  assert.ok(readJson("functions.after.json").some(entry => entry.name === "meridianChat" && entry.state === "ACTIVE"));
  const indexes = stageName === "staff-defaults" ? JSON.parse(fs.readFileSync(path.join(stage, "../chat-indexes.after.json"))) : readJson("chat-indexes.after.json");
  assert.equal(indexes.indexes.filter(entry => entry.name.includes(stageName === "chat-tasks" ? "/meridianChatTasks/" : "/meridianChatRooms/") && entry.state === "READY").length, 2);
  assert.ok(readJson("firestore-release.after.json").rulesetName);
  const { channels } = await cli.hosting.channel.list({ project: "meridain-nexus", site: "meridian-nexus", nonInteractive: true });
  const original = channels.find(channel => channel.name.endsWith("/live")).release.version;
  assert.equal(original.name, readJson("hosting.before.json").release.version.name, "Another Hosting release occurred; review before overwriting");
  const client = new Client({ urlPrefix: "https://firebasehosting.googleapis.com", apiVersion: "v1beta1", auth: true });
  const { body } = await client.get(`/${original.name}/files`, { queryParams: { pageSize: 1000 } });
  assert.ok(!body.nextPageToken);
  const files = Object.fromEntries(body.files.map(file => [file.path, file.hash]));
  assert.deepEqual(files, Object.fromEntries(readJson("hosting-files.before.json").files.map(file => [file.path, file.hash])));
  const uploads = new Map();
  const assets = path.join(stage, "hosting-assets"); fs.mkdirSync(assets, { recursive: true });
  for (const name of changes) {
    const content = fs.readFileSync(path.join(root, "public", name));
    fs.writeFileSync(path.join(assets, name), content);
    const compressed = zlib.gzipSync(content, { level: 9 });
    const hash = crypto.createHash("sha256").update(compressed).digest("hex");
    files[`/${name}`] = hash; uploads.set(hash, compressed);
  }
  const version = await api.createVersion("meridian-nexus", { config: original.config });
  fs.writeFileSync(path.join(stage, "hosting.created.json"), JSON.stringify({ version, files, changes }, null, 2));
  const populated = await client.post(`/${version}:populateFiles`, { files });
  const uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) {
    assert.ok(uploads.has(hash), "Untouched assets must retain their existing hashes");
    const response = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" });
    response.body.resume(); assert.equal(response.status, 200);
  }
  await api.updateVersion("meridian-nexus", version.split("/").pop(), { status: "FINALIZED" });
  const current = await api.getChannel("meridain-nexus", "meridian-nexus", "live");
  assert.equal(current.release.version.name, original.name, "Live changed while uploading");
  await api.createRelease("meridian-nexus", "live", version, { message: stageName === "chat-tasks" ? "Meridian Chat: reactions, emoji, assigned tasks and delegated responsibilities" : stageName ? "Meridian Chat: staff-only, default-on with administrator opt-out and private Nexus Assistant" : "Meridian Chat: assigned staff/client conversations and protected staff metadata" });
  const { body: verified } = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } });
  assert.ok(!verified.nextPageToken);
  assert.deepEqual(Object.fromEntries(verified.files.map(file => [file.path, file.hash])), files);
  const result = { version, changes, unchangedAssets: body.files.filter(file => !changes.includes(file.path.slice(1))).length, verifiedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(stage, "hosting.after.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message.slice(0, 1500)); process.exitCode = 1; });
