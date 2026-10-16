const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { isDeepStrictEqual } = require("node:util");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stage = path.join(root, ".tmp/chat-release");
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 10 * 1024 * 1024 });
const describe = name => JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", "--project=meridain-nexus", "--format=json"));
function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(stage, "function-manifest.json")));
  const results = [];
  for (const entry of manifest) {
    const before = describe(entry.name);
    const completedPath = path.join(stage, `${entry.name}.after.json`);
    if (fs.existsSync(completedPath)) {
      const completed = JSON.parse(fs.readFileSync(completedPath));
      assert.equal(before.serviceConfig.revision, completed.serviceConfig.revision, "Completed function changed during release");
      assert.equal(before.state, "ACTIVE");
      results.push({ name: entry.name, revision: before.serviceConfig.revision, state: before.state, configurationPreserved: true });
      console.log(`Already verified: ${entry.name} ${before.serviceConfig.revision}`);
      continue;
    }
    assert.equal(before.serviceConfig.revision, entry.revisionBefore, "Live function changed after staging");
    console.log(`Deploying ${entry.name}: existing configuration retained.`);
    const result = gcloud("functions", "deploy", entry.name, "--gen2", "--region=us-central1", "--project=meridain-nexus", `--source=${path.join(stage, entry.name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, "--quiet", "--format=json");
    fs.writeFileSync(path.join(stage, `${entry.name}.deploy-result.json`), result);
    const after = describe(entry.name);
    fs.writeFileSync(path.join(stage, `${entry.name}.after.json`), JSON.stringify(after, null, 2));
    assert.equal(after.state, "ACTIVE");
    for (const key of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings", "vpcConnector", "vpcConnectorEgressSettings"]) {
      assert.ok(isDeepStrictEqual(before.serviceConfig[key], after.serviceConfig[key]), `${key} unexpectedly changed`);
    }
    assert.deepEqual(after.eventTrigger, before.eventTrigger);
    results.push({ name: entry.name, revision: after.serviceConfig.revision, state: after.state, configurationPreserved: true });
    fs.writeFileSync(path.join(stage, "functions.after.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
  }
  const list = JSON.parse(gcloud("functions", "list", "--v2", "--regions=us-central1", "--project=meridain-nexus", "--filter=name:meridianChat", "--format=json"));
  assert.equal(list.length, 0, "Chat already exists; inspect before updating");
  console.log("Creating meridianChat: Auth-protected callable, 256MiB, maximum 8 instances, no secrets or Storage access added.");
  const result = gcloud("functions", "deploy", "meridianChat", "--gen2", "--region=us-central1", "--project=meridain-nexus", `--source=${path.join(stage, "meridianChat")}`, "--entry-point=meridianChat", "--runtime=nodejs22", "--trigger-http", "--allow-unauthenticated", "--service-account=730011371323-compute@developer.gserviceaccount.com", "--memory=256Mi", "--cpu=1", "--concurrency=40", "--max-instances=8", "--timeout=60s", "--ingress-settings=all", "--quiet", "--format=json");
  fs.writeFileSync(path.join(stage, "meridianChat.deploy-result.json"), result);
  const after = describe("meridianChat");
  fs.writeFileSync(path.join(stage, "meridianChat.after.json"), JSON.stringify(after, null, 2));
  assert.equal(after.state, "ACTIVE");
  assert.equal(after.serviceConfig.maxInstanceCount, 8);
  assert.equal(after.serviceConfig.serviceAccountEmail, "730011371323-compute@developer.gserviceaccount.com");
  assert.ok(!after.serviceConfig.secretEnvironmentVariables?.length);
  results.push({ name: "meridianChat", revision: after.serviceConfig.revision, state: after.state });
  fs.writeFileSync(path.join(stage, "functions.after.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
try { main(); } catch (error) { console.error(error.message.slice(0, 1600)); process.exitCode = 1; }
