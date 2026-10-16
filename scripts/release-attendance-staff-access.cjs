"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/attendance-staff-access"), project = "meridain-nexus";
const rulesBase = `https://firebaserules.googleapis.com/v1/projects/${project}`;
const docsBase = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name)));
const save = (name, value) => { fs.mkdirSync(stage, { recursive: true }); fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2)); };
const normalise = value => value.replace(/\r\n/g, "\n");
const gcloud = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
let token;
async function api(url, method = "GET", body) {
  token ||= gcloud("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${method} ${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}
function decode(v) { return v.stringValue ?? v.booleanValue ?? (v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k,decode(x)])) : v.arrayValue ? (v.arrayValue.values || []).map(decode) : null); }
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Preserve existing backup");
  const release = await api(`${rulesBase}/releases/cloud.firestore`), rules = await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  assert.equal(rules.source.files.length, 1);
  const baseline = normalise(rules.source.files[0].content), local = normalise(fs.readFileSync(path.join(root, "firestore.rules"), "utf8"));
  let restored = local.replace(/\n    function canReadAttendance\(\) \{[^]*?\n    \}\n/, "");
  for (const name of ["geoRepAttendanceCoverage", "attendanceBlueprintUpdates", "salesforceAttendanceWorkbookSnapshots"]) restored = restored.replace(new RegExp(`    match /${name}/[^]*?(?=    match /salesforceAttendanceMasters|    match /attendanceBlueprintUpdates|    match /salesforceAttendanceWorkbookSnapshots|    match /geoRepAttendanceCoverage)`), "");
  restored = restored.replace(/    match \/geoRepAttendanceDashboard\/\{snapshotId\} \{\n      allow read: if isAdmin\(\) \|\| canReadAttendance\(\);/, "    match /geoRepAttendanceDashboard/{snapshotId} {\n      allow read: if isAdmin();");
  assert.equal(restored, baseline, "Only attendance read rules may change");
  const result = await api(`${docsBase}:runQuery`, "POST", { structuredQuery: { from: [{ collectionId: "adminUsers" }], limit: 2001 } });
  const users = result.filter(r => r.document).map(r => r.document); assert.ok(users.length < 2001);
  const changes = [];
  for (const document of users) {
    const p = Object.fromEntries(Object.entries(document.fields || {}).map(([k,v]) => [k,decode(v)]));
    if (p.role !== "normal" || p.disabled || p.accountType === "client" || p.chatAccess?.audience === "external" || p.chatAccess?.workRole === "Client") continue;
    const allowed = p.permissions?.allowedNavigationIds;
    if (Array.isArray(allowed) && allowed.includes("attendance")) continue;
    changes.push({ before: document, allowed: [...new Set([...(Array.isArray(allowed) ? allowed : ["automation"]), "attendance"])] });
  }
  save("before.json", { release, rules, source: { files: [{ name: rules.source.files[0].name, content: local }] }, changes, totalProfiles: users.length });
  console.log(JSON.stringify({ prepared: true, totalProfiles: users.length, normalStaffToEnable: changes.length, clientsUnchanged: true }));
}
async function rules() {
  const before = read("before.json"), url = `${rulesBase}/releases/cloud.firestore`;
  assert.equal((await api(url)).rulesetName, before.release.rulesetName);
  const created = await api(`${rulesBase}/rulesets`, "POST", { source: before.source }); save("rules.created.json", created);
  assert.equal((await api(url)).rulesetName, before.release.rulesetName);
  const released = await api(url, "PATCH", { release: { name: before.release.name, rulesetName: created.name }, updateMask: "rulesetName" }); save("rules.after.json", released);
  assert.equal((await api(url)).rulesetName, created.name); console.log(JSON.stringify({ attendanceReadRules: created.name }));
}
async function profiles() {
  const before = read("before.json"); assert.ok(fs.existsSync(path.join(stage, "rules.after.json")));
  assert.ok(before.changes.length <= 450, "Review larger backfills before applying");
  if (before.changes.length) {
    const writes = before.changes.map(({ before: document, allowed }) => ({ update: { name: document.name, fields: { permissions: { mapValue: { fields: { allowedNavigationIds: { arrayValue: { values: allowed.map(stringValue => ({ stringValue })) } } } } } } }, updateMask: { fieldPaths: ["permissions.allowedNavigationIds"] }, currentDocument: { updateTime: document.updateTime } }));
    const result = await api(`${docsBase}:commit`, "POST", { writes }); save("profiles.after.json", result);
  } else save("profiles.after.json", { unchanged: true });
  for (const entry of before.changes) {
    const after = await api(`https://firestore.googleapis.com/v1/${entry.before.name}`), current = structuredClone(after.fields), old = structuredClone(entry.before.fields);
    assert.deepEqual(decode(current.permissions).allowedNavigationIds, entry.allowed);
    delete current.permissions.mapValue.fields.allowedNavigationIds;
    if (old.permissions?.mapValue?.fields) delete old.permissions.mapValue.fields.allowedNavigationIds;
    if (!Object.keys(current.permissions.mapValue.fields).length && !old.permissions) delete current.permissions;
    assert.deepEqual(current, old, "No other profile fields may change");
  }
  console.log(JSON.stringify({ normalStaffEnabled: before.changes.length, otherPermissionsPreserved: true }));
}
const names = ["getGeoRepAttendanceDashboard", "getGeoRepAttendanceWorksheetView"];
const describe = name => JSON.parse(gcloud("functions", "describe", name, "--gen2", "--region=us-central1", `--project=${project}`, "--format=json"));
async function functionsPrepare() {
  assert.ok(!fs.existsSync(path.join(stage, "functions.json")), "Preserve existing staged functions");
  const manifest = [];
  for (const name of names) {
    if (fs.existsSync(path.join(stage, `${name}.before.json`))) {
      // The source-only first attempt may have staged an earlier permission fix.
      const original = await JSZip.loadAsync(fs.readFileSync(path.join(stage, `${name}.zip`)));
      const baseline = await original.file("index.js").async("string");
      const index = path.join(stage, name, "index.js"), previous = fs.readFileSync(index, "utf8");
      const old = /  await requireRetailerPermission\(request, geoRepRepAttendanceRetailerId\);\r?\n/;
      const start = baseline.indexOf(`exports.${name} =`), removed = old.exec(baseline.slice(start));
      assert.ok(removed);
      const expected = baseline.slice(0, start + removed.index) + baseline.slice(start + removed.index + removed[0].length);
      assert.ok(previous === baseline || previous === expected, "Unexpected staged changes");
      fs.writeFileSync(index, baseline);
    }
    const before = describe(name), source = before.buildConfig.source.storageSource, directory = path.join(stage, name), zip = path.join(stage, `${name}.zip`);
    if (!fs.existsSync(zip)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zip, `--project=${project}`);
    const archive = await JSZip.loadAsync(fs.readFileSync(zip));
    for (const entry of Object.values(archive.files)) { if (entry.dir) continue; const dest = path.resolve(directory, entry.name); assert.ok(dest.startsWith(directory + path.sep)); const content = await entry.async("nodebuffer"); if (fs.existsSync(dest)) assert.ok(fs.readFileSync(dest).equals(content), "Do not overwrite edited staged files"); else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, content); } }
    const index = path.join(directory, "index.js"), baseline = fs.readFileSync(index, "utf8");
    const start = baseline.indexOf(`exports.${name} =`), closing = /^\}\);/m.exec(baseline.slice(start)), end = closing ? start + closing.index : -1;
    assert.ok(start >= 0 && end > start);
    const handler = baseline.slice(start, end), old = handler.match(/  await requireRetailerPermission\(request, geoRepRepAttendanceRetailerId\);\r?\n/)?.[0];
    assert.ok(old && handler.includes(old));
    const helper = fs.readFileSync(path.join(root, "functions/index.js"), "utf8").match(/async function requireAttendanceViewPermission\(request\) \{[^]*?\r?\n\}/)?.[0];
    assert.ok(helper && !baseline.includes("function requireAttendanceViewPermission("));
    const eol = old.endsWith("\r\n") ? "\r\n" : "\n";
    const oldNavigation = handler.match(/  await requireNavigationPermission\(request, "attendance"\);\r?\n/)?.[0] || "";
    const replacement = `  await requireAttendanceViewPermission(request);${eol}`;
    const updatedHandler = (oldNavigation ? handler.replace(oldNavigation, "") : handler).replace(old, replacement);
    const updated = baseline.slice(0, start) + helper + eol + eol + updatedHandler + baseline.slice(end);
    assert.equal(updated.length, baseline.length + helper.length + eol.length * 2 - old.length - oldNavigation.length + replacement.length);
    fs.writeFileSync(index, updated);
    if (!fs.existsSync(path.join(directory, "node_modules"))) fs.symlinkSync(path.join(root, "functions/node_modules"), path.join(directory, "node_modules"), "junction");
    if (!fs.existsSync(path.join(directory, ".gcloudignore"))) fs.writeFileSync(path.join(directory, ".gcloudignore"), ".gcloudignore\n.git\nnode_modules/\nfirebase-debug.log\n");
    execFileSync(process.execPath, ["--check", index]);
    save(`${name}.before.json`, before); manifest.push({ name, revision: before.serviceConfig.revision }); console.log(JSON.stringify({ staged: name, removedAutomationGateOnly: true }));
  }
  save("functions.json", manifest);
}
async function functionsDeploy() {
  for (const entry of read("functions.json")) {
    const before = read(`${entry.name}.before.json`), current = describe(entry.name), afterFile = `${entry.name}.after.json`;
    if (fs.existsSync(path.join(stage, afterFile))) { assert.equal(current.serviceConfig.revision, read(afterFile).serviceConfig.revision); continue; }
    assert.equal(current.serviceConfig.revision, entry.revision, "Live function changed since review");
    console.log(`Deploying ${entry.name}; no automation handler or job is changed.`);
    gcloud("functions", "deploy", entry.name, "--gen2", "--region=us-central1", `--project=${project}`, `--source=${path.join(stage, entry.name)}`, `--entry-point=${before.buildConfig.entryPoint}`, `--runtime=${before.buildConfig.runtime}`, "--quiet", "--format=json");
    const after = describe(entry.name); save(afterFile, after); assert.equal(after.state, "ACTIVE");
    for (const field of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "environmentVariables", "secretEnvironmentVariables", "ingressSettings", "vpcConnector", "vpcConnectorEgressSettings"]) assert.deepEqual(after.serviceConfig[field], before.serviceConfig[field], field);
    assert.deepEqual(after.eventTrigger, before.eventTrigger);
    console.log(JSON.stringify({ deployed: entry.name, revision: after.serviceConfig.revision, runtimeConfigurationPreserved: true }));
  }
}
async function verify() {
  const released = read("rules.after.json"); assert.equal((await api(`${rulesBase}/releases/cloud.firestore`)).rulesetName, released.rulesetName);
  const checks = {};
  for (const name of [...names, "getSalesforceAttendanceDashboard", "getSalesforceAttendanceWorkbookSnapshotRows"]) {
    const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"data":{}}' });
    assert.ok([401,403].includes(response.status)); checks[name] = response.status;
  }
  for (const name of names) assert.equal(describe(name).serviceConfig.revision, read(`${name}.after.json`).serviceConfig.revision);
  const result = { verifiedAt: new Date().toISOString(), ruleset: released.rulesetName, normalStaffEnabled: read("before.json").changes.length, anonymousDenied: checks, writePermissionsChanged: false, automationPermissionsChanged: false };
  save("verified.json", result); console.log(JSON.stringify(result));
}
async function auditSalesforceReaders() {
  for (const name of ["getSalesforceAttendanceDashboard", "getSalesforceAttendanceWorkbookSnapshotRows"]) {
    const current = describe(name), source = current.buildConfig.source.storageSource, zip = path.join(stage, `${name}-${source.generation}.zip`);
    if (!fs.existsSync(zip)) gcloud("storage", "cp", `gs://${source.bucket}/${source.object}#${source.generation}`, zip, `--project=${project}`);
    const archive = await JSZip.loadAsync(fs.readFileSync(zip)), code = await archive.file("index.js").async("string");
    const start = code.indexOf(`exports.${name} =`), handler = code.slice(start).split(/\r?\n\}\);/)[0];
    assert.ok(start >= 0);
    const guards = handler.split(/\r?\n/).slice(1, 6).filter(line => /require[A-Z]/.test(line));
    const menuGuard = handler.includes('await requireNavigationPermission(request, "attendance");');
    const supported = (menuGuard || handler.includes("requireOperator(request);")) && !handler.includes("requireAdmin(request)") && !handler.includes("requireRetailerPermission");
    assert.ok(supported, `${name} still blocks normal attendance viewers`);
    save(`${name}.access-audit.json`, { revision: current.serviceConfig.revision, attendanceNavigationGuard: menuGuard, normalAttendanceViewerSupported: supported, guards });
    console.log(JSON.stringify({ reader: name, normalAttendanceViewerSupported: supported, guards, unchanged: true }));
  }
}
const actions = { prepare, rules, profiles, "functions-prepare": functionsPrepare, "functions-deploy": functionsDeploy, "audit-salesforce": auditSalesforceReaders, verify };
if (!actions[process.argv[2]]) throw new Error("Choose a release phase");
actions[process.argv[2]]().catch(e => { console.error(e.message.slice(0, 1800)); process.exitCode = 1; });
