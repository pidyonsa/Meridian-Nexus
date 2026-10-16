"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const root = path.resolve(__dirname, "..");
const release = path.join(root, ".tmp/attendance-raw-release");
const normalize = text => text.replace(/\r\n/g, "\n");
const read = file => normalize(fs.readFileSync(file, "utf8"));
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024 });
const describe = name => JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", "--project=meridain-nexus", "--format=json"));
const fn = (code, name) => {
  const match = code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, name);
  return match[0];
};
const trigger = value => value ? { ...value, eventFilters: [...(value.eventFilters || [])].sort((a, b) => a.attribute.localeCompare(b.attribute)) } : value;

async function prepare() {
  assert.ok(!fs.existsSync(path.join(release, "manifest.json")), "Preserve the existing release backup.");
  fs.mkdirSync(release, { recursive: true });
  const manifest = [];
  for (const name of ["processExtraction", "askNexusAssistant"]) {
    const before = describe(name);
    const source = before.buildConfig.source.storageSource;
    const zipPath = path.join(release, `${name}-${source.generation}.zip`);
    if (!fs.existsSync(zipPath)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zipPath, "--project=meridain-nexus");
    const archive = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const stage = path.join(release, name);
    assert.ok(!fs.existsSync(stage), "Do not overwrite a staged source.");
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      const target = path.resolve(stage, entry.name);
      assert.ok(target.startsWith(stage + path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async("nodebuffer"));
    }
    fs.writeFileSync(path.join(release, `${name}.before.json`), JSON.stringify(before, null, 2));
    const index = path.join(stage, "index.js");
    const baseline = read(index);
    const local = read(path.join(root, "functions/index.js"));
    let updated = baseline;
    const changed = ["automation-playbooks.js: attendance instructions only"];
    const liveBooks = require(path.join(stage, "automation-playbooks.js"));
    const localBooks = require(path.join(root, "functions/automation-playbooks.js"));
    for (const retailerId of ["geo-rep", "salesforce-display-compliance-automation", "powerbi-perfect-store"]) {
      const stripVersion = value => { const { version, ...rest } = value; return rest; };
      assert.deepEqual(stripVersion(liveBooks.automationPlaybookForRun({ retailerId })), stripVersion(localBooks.automationPlaybookForRun({ retailerId })), `${name}: unrelated playbook changed`);
    }
    // Replace only the two attendance blocks and their revision marker in each
    // deployed playbook, leaving all other function-specific source untouched.
    const liveBookText = read(path.join(stage, "automation-playbooks.js"));
    const localBookText = read(path.join(root, "functions/automation-playbooks.js"));
    let books = liveBookText.replace(/const PLAYBOOK_VERSION = "[^"]+";/, localBookText.match(/const PLAYBOOK_VERSION = "[^"]+";/)[0]);
    for (const key of ["salesforce-attendance-daily", "salesforce-attendance-monthly"]) {
      const pattern = new RegExp(`  "${key}": \\{[^]*?\\n  \\},`);
      assert.ok(pattern.test(books) && pattern.test(localBookText), key);
      books = books.replace(pattern, () => localBookText.match(pattern)[0]);
    }
    fs.writeFileSync(path.join(stage, "automation-playbooks.js"), books);
    if (name === "processExtraction") {
      const importPattern = /^const \{[^\n]+\} = require\("\.\/attendance-sharepoint-source"\);$/m;
      const oldImport = baseline.match(importPattern)?.[0];
      const newImport = local.match(importPattern)?.[0];
      assert.ok(oldImport && newImport);
      updated = updated.replace(oldImport, () => newImport);
      for (const helper of ["resolveSalesforceAttendanceSharePointSource", "readSalesforceAttendanceSharePointSource"]) updated = updated.replace(fn(baseline, helper), () => fn(local, helper));
      let restored = updated.replace(newImport, () => oldImport);
      for (const helper of ["resolveSalesforceAttendanceSharePointSource", "readSalesforceAttendanceSharePointSource"]) restored = restored.replace(fn(local, helper), () => fn(baseline, helper));
      assert.equal(restored, baseline, "Only acquisition helpers/import may change; extraction and workbook handlers are preserved.");
      fs.writeFileSync(index, updated);
      fs.copyFileSync(path.join(root, "functions/attendance-sharepoint-source.js"), path.join(stage, "attendance-sharepoint-source.js"));
      changed.push("index.js: source import and two acquisition helpers only", "attendance-sharepoint-source.js");
    }
    const dependencyPath = path.join(stage, "node_modules");
    if (!fs.existsSync(dependencyPath)) fs.symlinkSync(path.join(root, "functions/node_modules"), dependencyPath, "junction");
    if (!fs.existsSync(path.join(stage, ".gcloudignore"))) fs.writeFileSync(path.join(stage, ".gcloudignore"), ".gcloudignore\n.git\n.gitignore\nnode_modules/\nfirebase-debug.log\n");
    execFileSync(process.execPath, ["--check", index], { stdio: "inherit" });
    manifest.push({ name, revisionBefore: before.serviceConfig.revision, changed });
    console.log(JSON.stringify(manifest.at(-1)));
  }
  fs.writeFileSync(path.join(release, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function verifyConfiguration(before, after) {
  assert.equal(after.state, "ACTIVE");
  assert.notEqual(after.serviceConfig.revision, before.serviceConfig.revision);
  for (const field of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings", "vpcConnector", "vpcConnectorEgressSettings"]) assert.deepEqual(after.serviceConfig[field], before.serviceConfig[field], `Deployment changed ${field}`);
  assert.deepEqual(trigger(after.eventTrigger), trigger(before.eventTrigger), "Event trigger must be preserved.");
}

async function deploy() {
  const manifest = JSON.parse(fs.readFileSync(path.join(release, "manifest.json"), "utf8"));
  const results = [];
  for (const entry of manifest) {
    const before = JSON.parse(fs.readFileSync(path.join(release, `${entry.name}.before.json`), "utf8"));
    const completedPath = path.join(release, `${entry.name}.after.json`);
    if (fs.existsSync(completedPath)) {
      const after = JSON.parse(fs.readFileSync(completedPath, "utf8"));
      assert.equal(describe(entry.name).serviceConfig.revision, after.serviceConfig.revision, "Production changed since the completed deployment.");
      verifyConfiguration(before, after);
      results.push({ name: entry.name, revision: after.serviceConfig.revision, state: after.state, configurationPreserved: true, verifiedAt: new Date().toISOString() });
      continue;
    }
    assert.equal(describe(entry.name).serviceConfig.revision, entry.revisionBefore, "Production changed after staging; stop for review.");
    console.log(`Deploying ${entry.name}: source-only, existing trigger, secrets, identity and scaling retained.`);
    gcloud("functions", "deploy", entry.name, "--gen2", "--region=us-central1", "--project=meridain-nexus", `--source=${path.join(release, entry.name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, "--quiet", "--format=json");
    const after = describe(entry.name);
    fs.writeFileSync(path.join(release, `${entry.name}.after.json`), JSON.stringify(after, null, 2));
    verifyConfiguration(before, after);
    results.push({ name: entry.name, revision: after.serviceConfig.revision, state: after.state, configurationPreserved: true, verifiedAt: new Date().toISOString() });
    fs.writeFileSync(path.join(release, "deployment.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
  }
}

async function verify() {
  const manifest = JSON.parse(fs.readFileSync(path.join(release, "manifest.json"), "utf8"));
  for (const entry of manifest) {
    const before = JSON.parse(fs.readFileSync(path.join(release, `${entry.name}.before.json`), "utf8"));
    const after = describe(entry.name);
    const saved = JSON.parse(fs.readFileSync(path.join(release, `${entry.name}.after.json`), "utf8"));
    assert.equal(after.serviceConfig.revision, saved.serviceConfig.revision);
    verifyConfiguration(before, after);
    const source = after.buildConfig.source.storageSource;
    const zipPath = path.join(release, `${entry.name}-verified-${source.generation}.zip`);
    if (!fs.existsSync(zipPath)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zipPath, "--project=meridain-nexus");
    const archive = await JSZip.loadAsync(fs.readFileSync(zipPath));
    for (const file of ["index.js", "automation-playbooks.js", ...(entry.name === "processExtraction" ? ["attendance-sharepoint-source.js"] : [])]) {
      assert.equal(normalize(await archive.file(file).async("string")), read(path.join(release, entry.name, file)), `Deployed ${entry.name}/${file} differs from reviewed source`);
    }
    console.log(JSON.stringify({ name: entry.name, revision: after.serviceConfig.revision, reviewedSourceVerified: true, configurationPreserved: true }));
  }
}

const action = process.argv[2];
(action === "prepare" ? prepare() : action === "deploy" ? deploy() : action === "verify" ? verify() : Promise.reject(new Error("Use prepare, deploy or verify"))).catch(error => {
  console.error(String(error.message).slice(0, 1200));
  process.exitCode = 1;
});
