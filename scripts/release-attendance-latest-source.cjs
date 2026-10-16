"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const root = path.resolve(__dirname, "..");
const release = path.join(root, ".tmp/attendance-latest-release-v2");
const normalize = text => text.replace(/\r\n/g, "\n");
const read = file => normalize(fs.readFileSync(file, "utf8"));
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 12 * 1024 * 1024 });
const describe = name => JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", "--project=meridain-nexus", "--format=json"));
const fn = (code, name) => { const match = code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`)); assert.ok(match, name); return match[0]; };
function once(code, before, after) {
  assert.ok(before && code.includes(before), "Expected production source fragment is missing.");
  assert.equal(code.split(before).length, 2, "Source fragment must be unique.");
  return code.replace(before, () => after);
}

async function prepare() {
  assert.ok(!fs.existsSync(path.join(release, "manifest.json")), "Preserve the release backup.");
  fs.mkdirSync(release, { recursive: true });
  const manifest = [];
  const local = read(path.join(root, "functions/index.js"));
  for (const name of ["startExtraction", "runScheduledExtractions", "retrySalesforceAttendanceReportLoadFailures", "processExtraction", "askNexusAssistant"]) {
    const before = describe(name);
    const source = before.buildConfig.source.storageSource;
    const zipPath = path.join(release, `${name}-${source.generation}.zip`);
    gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zipPath, "--project=meridain-nexus");
    const archive = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const stage = path.join(release, name);
    assert.ok(!fs.existsSync(stage), "Do not overwrite a staged function.");
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      const target = path.resolve(stage, entry.name);
      assert.ok(target.startsWith(stage + path.sep), "Archive path must stay inside staging.");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async("nodebuffer"));
    }
    fs.writeFileSync(path.join(release, `${name}.before.json`), JSON.stringify(before, null, 2));
    const index = path.join(stage, "index.js");
    const baseline = read(index);
    fs.writeFileSync(path.join(release, `${name}.baseline.js`), baseline);
    let updated = baseline;
    const changes = [];
    const replace = (old, next) => { updated = once(updated, old, next); changes.push({ old, next }); };
    if (name !== "askNexusAssistant") {
      const pattern = /^const \{[^\n]+\} = require\("\.\/attendance-sharepoint-source"\);$/m;
      const old = updated.match(pattern)?.[0];
      if (old) replace(old, old.replace(" } = require", ", completedAttendanceMonthRange, attendanceSourceRetryPlan } = require"));
      else {
        const anchor = 'const { automationPlaybookForRun } = require("./automation-playbooks");';
        replace(anchor, anchor + '\nconst { completedAttendanceMonthRange, attendanceSourceRetryPlan } = require("./attendance-sharepoint-source");');
      }
      fs.copyFileSync(path.join(root, "functions/attendance-sharepoint-source.js"), path.join(stage, "attendance-sharepoint-source.js"));
    }
    if (name === "startExtraction") {
      replace("    const monthToDate = monthToDateRange();", "    const monthToDate = completedAttendanceMonthRange(localDateParts(new Date(), \"Africa/Johannesburg\").date);");
      replace("  const { reportStartDate, reportEndDate } = defaultReportDatesForRetailer(", "  const { startDate: reportStartDate, endDate: reportEndDate } = defaultReportDatesForRetailer(");
    }
    if (name === "runScheduledExtractions") replace(fn(baseline, "scheduledReportDates"), fn(local, "scheduledReportDates"));
    if (name === "retrySalesforceAttendanceReportLoadFailures") replace(fn(baseline, "queueSalesforceReportLoadRetry"), fn(local, "queueSalesforceReportLoadRetry"));
    if (name === "processExtraction") {
      const marker = '      await runRef.set({ status: "running", reportSource: "sharepoint-attendance",';
      const prefix = local.slice(local.indexOf("      // Freeze the run's date anchor"), local.indexOf(marker));
      assert.ok(prefix.startsWith("      // Freeze"));
      replace(marker, prefix + marker);
      const segment = code => {
        const start = code.indexOf("    const salesforceAutoRetry =", code.indexOf("exports.processExtraction ="));
        const end = code.indexOf("    const failureMessage =", start);
        assert.ok(start > 0 && end > start);
        return code.slice(start, end);
      };
      replace(segment(baseline), segment(local));
    }
    let restored = updated;
    for (const change of changes.slice().reverse()) restored = once(restored, change.next, change.old);
    assert.equal(restored, baseline, "Only explicitly reviewed index fragments may change.");
    fs.writeFileSync(index, updated);
    const files = ["index.js", ...(name === "askNexusAssistant" ? [] : ["attendance-sharepoint-source.js"])];
    if (["processExtraction", "askNexusAssistant"].includes(name)) {
      const bookFile = path.join(stage, "automation-playbooks.js");
      const books = read(bookFile), current = read(path.join(root, "functions/automation-playbooks.js"));
      let result = books.replace(/const PLAYBOOK_VERSION = "[^"]+";/, current.match(/const PLAYBOOK_VERSION = "[^"]+";/)[0]);
      for (const key of ["salesforce-attendance-daily", "salesforce-attendance-monthly"]) {
        const pattern = new RegExp(`  "${key}": \\{[^]*?\\n  \\},`);
        assert.ok(pattern.test(result) && pattern.test(current), key);
        result = result.replace(pattern, () => current.match(pattern)[0]);
      }
      fs.writeFileSync(bookFile, result);
      files.push("automation-playbooks.js");
    }
    fs.writeFileSync(path.join(release, `${name}.review.json`), JSON.stringify(changes, null, 2));
    if (!fs.existsSync(path.join(stage, "node_modules"))) fs.symlinkSync(path.join(root, "functions/node_modules"), path.join(stage, "node_modules"), "junction");
    if (!fs.existsSync(path.join(stage, ".gcloudignore"))) fs.writeFileSync(path.join(stage, ".gcloudignore"), ".gcloudignore\n.git\n.gitignore\nnode_modules/\nfirebase-debug.log\n");
    execFileSync(process.execPath, ["--check", index], { stdio: "inherit" });
    manifest.push({ name, revisionBefore: before.serviceConfig.revision, files, indexFragments: changes.length });
    console.log(JSON.stringify(manifest.at(-1)));
  }
  fs.writeFileSync(path.join(release, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function verifyConfiguration(before, after) {
  assert.equal(after.state, "ACTIVE");
  assert.notEqual(before.serviceConfig.revision, after.serviceConfig.revision);
  for (const field of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings", "vpcConnector", "vpcConnectorEgressSettings"]) assert.deepEqual(after.serviceConfig[field], before.serviceConfig[field], `Configuration changed: ${field}`);
  const trigger = value => value ? { ...value, eventFilters: [...(value.eventFilters || [])].sort((a, b) => a.attribute.localeCompare(b.attribute)) } : value;
  assert.deepEqual(trigger(after.eventTrigger), trigger(before.eventTrigger));
}

async function deploy() {
  for (const entry of JSON.parse(read(path.join(release, "manifest.json")))) {
    const before = JSON.parse(read(path.join(release, `${entry.name}.before.json`)));
    const completed = path.join(release, `${entry.name}.after.json`);
    if (fs.existsSync(completed)) {
      const saved = JSON.parse(read(completed)), live = describe(entry.name);
      assert.equal(saved.serviceConfig.revision, live.serviceConfig.revision);
      verifyConfiguration(before, live);
      console.log(JSON.stringify({ name: entry.name, revision: live.serviceConfig.revision, alreadyDeployed: true }));
      continue;
    }
    assert.equal(describe(entry.name).serviceConfig.revision, entry.revisionBefore, "Production changed after review.");
    console.log(`Deploying ${entry.name}: scoped source only; existing IAM, secrets, triggers and scaling retained.`);
    gcloud("functions", "deploy", entry.name, "--gen2", "--project=meridain-nexus", "--region=us-central1", `--source=${path.join(release, entry.name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, "--quiet", "--format=json");
    const after = describe(entry.name);
    fs.writeFileSync(completed, JSON.stringify(after, null, 2));
    verifyConfiguration(before, after);
    console.log(JSON.stringify({ name: entry.name, revision: after.serviceConfig.revision, state: after.state, configurationPreserved: true }));
  }
}

async function verify() {
  for (const entry of JSON.parse(read(path.join(release, "manifest.json")))) {
    const before = JSON.parse(read(path.join(release, `${entry.name}.before.json`))), saved = JSON.parse(read(path.join(release, `${entry.name}.after.json`)));
    const live = describe(entry.name);
    assert.equal(live.serviceConfig.revision, saved.serviceConfig.revision);
    verifyConfiguration(before, live);
    const source = live.buildConfig.source.storageSource;
    const zipPath = path.join(release, `${entry.name}-verified-${source.generation}.zip`);
    gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zipPath, "--project=meridain-nexus");
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    for (const file of entry.files) assert.equal(normalize(await zip.file(file).async("string")), read(path.join(release, entry.name, file)), `${entry.name}/${file} does not match reviewed code.`);
    console.log(JSON.stringify({ name: entry.name, revision: live.serviceConfig.revision, sourceVerified: true, configurationPreserved: true }));
  }
}

const action = process.argv[2];
(action === "prepare" ? prepare() : action === "deploy" ? deploy() : action === "verify" ? verify() : Promise.reject(new Error("Use prepare, deploy or verify"))).catch(error => { console.error(String(error.message).slice(0, 1600)); process.exitCode = 1; });
