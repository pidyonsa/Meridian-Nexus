const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stageName = process.argv[3] || "staff-defaults";
assert.ok(["staff-defaults", "chat-tasks"].includes(stageName));
const stage = path.join(root, ".tmp/chat-release", stageName);
const previousStage = path.join(root, ".tmp/chat-release", stageName === "chat-tasks" ? "staff-defaults" : "");
const JSZip = require(path.join(root, "functions/node_modules/jszip"));
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 10 * 1024 * 1024 });
const describe = name => JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", "--project=meridain-nexus", "--format=json"));
const handler = code => code.match(/exports\.saveAdminUser = onCall\(async \(request\) => \{[^]*?\n\}\);/)[0];
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "function-manifest.json")), "Staging already exists; do not overwrite release baselines");
  const manifest = [];
  for (const name of ["meridianChat", "saveAdminUser"]) {
    const before = describe(name);
    const previous = JSON.parse(fs.readFileSync(path.join(previousStage, `${name}.after.json`)));
    assert.equal(before.serviceConfig.revision, previous.serviceConfig.revision, "Live function changed after the previous release");
    fs.writeFileSync(path.join(stage, `${name}.before.json`), JSON.stringify(before, null, 2));
    const source = before.buildConfig.source.storageSource;
    const zip = path.join(stage, `${name}-${source.generation}.zip`);
    if (!fs.existsSync(zip)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zip, "--project=meridain-nexus");
    const destination = path.join(stage, name);
    fs.mkdirSync(destination, { recursive: true });
    const archive = await JSZip.loadAsync(fs.readFileSync(zip));
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      const target = path.resolve(destination, entry.name);
      assert.ok(target.startsWith(destination + path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async("nodebuffer"));
    }
    const baseline = read(path.join(destination, "index.js"));
    fs.writeFileSync(path.join(stage, `${name}.before.js`), baseline);
    assert.equal(read(path.join(destination, "meridian-chat.js")), read(path.join(previousStage, name, "meridian-chat.js")), "Unexpected deployed Chat module");
    if (name === "saveAdminUser") {
      const next = handler(read(path.join(root, "functions/index.js")));
      const updated = baseline.replace(handler(baseline), () => next);
      assert.equal(updated.replace(next, () => handler(baseline)), baseline, "Only the user settings handler may change");
      fs.writeFileSync(path.join(destination, "index.js"), updated);
    }
    fs.copyFileSync(path.join(root, "functions/meridian-chat.js"), path.join(destination, "meridian-chat.js"));
    if (!fs.existsSync(path.join(destination, ".gitignore"))) fs.writeFileSync(path.join(destination, ".gitignore"), "node_modules/\n.env*\n");
    execFileSync(process.execPath, ["--check", path.join(destination, "index.js")]);
    manifest.push({ name, revisionBefore: before.serviceConfig.revision, changed: name === "saveAdminUser" ? ["user settings handler", "Chat access module"] : ["Chat access module"] });
  }
  fs.writeFileSync(path.join(stage, "function-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}
function deploy() {
  const manifest = JSON.parse(fs.readFileSync(path.join(stage, "function-manifest.json")));
  const completePath = path.join(stage, "functions.after.json");
  const results = fs.existsSync(completePath) ? JSON.parse(fs.readFileSync(completePath)) : [];
  for (const entry of manifest) {
    const before = describe(entry.name), completed = results.find(result => result.name === entry.name);
    if (completed) { assert.equal(before.serviceConfig.revision, completed.revision); continue; }
    assert.equal(before.serviceConfig.revision, entry.revisionBefore, "Function changed after staging");
    console.log(`Deploying ${entry.name}: ${stageName}, no runtime/IAM changes.`);
    const output = gcloud("functions", "deploy", entry.name, "--gen2", "--region=us-central1", "--project=meridain-nexus", `--source=${path.join(stage, entry.name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, "--quiet", "--format=json");
    fs.writeFileSync(path.join(stage, `${entry.name}.deploy-result.json`), output);
    const after = describe(entry.name);
    assert.equal(after.state, "ACTIVE");
    for (const key of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings", "vpcConnector", "vpcConnectorEgressSettings"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], `${key} unexpectedly changed`);
    assert.deepEqual(after.eventTrigger, before.eventTrigger);
    fs.writeFileSync(path.join(stage, `${entry.name}.after.json`), JSON.stringify(after, null, 2));
    const result = { name: entry.name, revision: after.serviceConfig.revision, state: after.state, configurationPreserved: true };
    results.push(result); fs.writeFileSync(completePath, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(result));
  }
}
async function main() {
  if (process.argv[2] === "prepare") return prepare();
  if (process.argv[2] === "deploy") return deploy();
  throw new Error("Specify prepare or deploy");
}
main().catch(error => { console.error(error.message.slice(0, 1400)); process.exitCode = 1; });
