"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs");
const Zip = require("../functions/node_modules/jszip");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/dataorbis-subtotals-20260923");
const name = "processExtraction", project = "meridain-nexus", modules = ["dataorbis-sales.js", "dataorbis-portal.js"];
const prior = path.join(root, ".tmp/dataorbis-workflow-20260923/live-validation");
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const live = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
function save(file, value) {
  const dest = path.resolve(stage, file); assert.ok(dest.startsWith(stage + path.sep));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
async function source(config) {
  const s = config.buildConfig.source.storageSource;
  return Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function audit() {
  const config = await json(fnUrl(name)); save("before.json", config);
  save("iam.before.json", await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
  const zip = await source(config);
  for (const entry of Object.values(zip.files)) if (!entry.dir) save("source/" + entry.name, await entry.async("nodebuffer"));
  save("hosting.before.json", await live());
  const revisions = {};
  for (const fn of ["startExtraction", "getOperationsWorkspace", "meridianEtl"]) revisions[fn] = (await json(fnUrl(fn))).serviceConfig.revision;
  save("unchanged-functions.json", revisions);
  const deploy = path.join(stage, "deploy"); fs.cpSync(path.join(stage, "source"), deploy, { recursive: true });
  for (const file of modules) fs.copyFileSync(path.join(root, "functions", file), path.join(deploy, file));
  const before = fileHashes(path.join(stage, "source")), after = fileHashes(deploy);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const file of Object.keys(before)) if (!modules.includes(file)) assert.equal(after[file], before[file], file);
  save("prepared.json", { source: after, modules, at: new Date().toISOString() });
  console.log("Staged Game subtotal changes only; all other deployed source retained.");
}
async function test() {
  const prepared = read("prepared.json"); assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source);
  for (const file of modules) assert.equal(hash(fs.readFileSync(path.join(root, "functions", file))), prepared.source[file]);
  execFileSync(process.execPath, ["--test", "scripts/tests/dataorbis-transform.test.cjs", "scripts/tests/dataorbis-workflow.test.cjs", "scripts/tests/dataorbis-runtime.test.cjs", "scripts/tests/dataorbis-run-options.test.cjs", "scripts/tests/dataorbis-connection-check.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  const sales = require("../functions/dataorbis-sales");
  const inputs = ["game", "wholesale"].map(channel => JSON.parse(fs.readFileSync(path.join(prior, `${channel}-verified.json`), "utf8")));
  const references = await sales.readReferences("C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/SALES DATA STORE NAME CLEAN UP .xlsx", "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/National_Call_Cycle_Masters 01.09.2026.xlsx");
  const rows = inputs.flatMap(input => input.rows.map((v, i) => ({ sheet: input.channel === "game" ? "Game Raw Data" : "Makro Raw Data", line: i + 2, v })));
  const result = sales.transform(rows, references, { month: "2026-08", client: "WILMAR", numericConvention: "literal-confirmed", sourceComplete: true, referencesApproved: true, excludeGameOnlineAndNonSa: true });
  const original = JSON.parse(fs.readFileSync(path.join(prior, "transform-result.json"), "utf8"));
  assert.equal(result.status, "validated-local"); assert.equal(result.batchDigest, original.batchDigest);
  assert.deepEqual(result.records, original.records); assert.deepEqual(result.totals, original.totals);
  assert.equal(result.removedTotals.length, 619);
  const workbook = path.join(prior, "Aug26- ALL Clients by SKU.xlsx");
  const verification = JSON.parse(fs.readFileSync(path.join(prior, "final-verification.json"), "utf8"));
  const template = await sales.inspectTemplate(workbook, { month: "2026-08", client: "WILMAR" });
  assert.equal(template.sha256, verification.sha256); assert.equal(template.rows, 180453);
  assert.equal(template.conflictingRows, 1516);
  // inspectTemplate rejects any non-date in column A, including Total.
  const evidence = { removedGameSubtotals: 619, finalRows: template.rows, wilmarRows: template.conflictingRows, finalDateColumnTotalRows: 0, workbookSha256: template.sha256, batchDigest: result.batchDigest, salesOutputUnchanged: true, newPortalRunStarted: false };
  save("workbook-check.json", evidence);
  save("tested.json", { ...prepared, at: new Date().toISOString() });
  console.log(JSON.stringify(evidence));
}
async function deploy() {
  const before = read("before.json"), tested = read("tested.json");
  assert.equal((await json(fnUrl(name))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), tested.source);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read("iam.before.json"));
  assert.ok(!fs.existsSync(path.join(stage, "operation.json")), "Resume the existing operation instead");
  const zip = new Zip();
  for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
  save("operation.json", await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } }));
  console.log("Deploying Game subtotal exclusion in the extraction worker.");
  await wait();
}
async function wait() {
  const operation = read("operation.json");
  for (let i = 0; i < 120; i++) {
    const result = await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
    if (result.done) { save("result.json", result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
    assert.ok(i < 119, "Deployment still running; resume wait"); await new Promise(resolve => setTimeout(resolve, 10000));
  }
  const after = await json(fnUrl(name)); assert.equal(after.state, "ACTIVE");
  save("after.json", after); console.log("Active worker: " + after.serviceConfig.revision);
}
async function verify() {
  const before = read("before.json"), fn = await json(fnUrl(name));
  assert.equal(fn.state, "ACTIVE"); assert.equal(fn.serviceConfig.revision, read("after.json").serviceConfig.revision);
  for (const field of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "minInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(fn.serviceConfig[field], before.serviceConfig[field], field);
  assert.deepEqual(fn.eventTrigger, before.eventTrigger);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`), read("iam.before.json"));
  const zip = await source(fn), hashes = read("tested.json").source;
  for (const [file, digest] of Object.entries(hashes)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest, file);
  assert.equal((await live()).release.version.name, read("hosting.before.json").release.version.name);
  for (const [name, revision] of Object.entries(read("unchanged-functions.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision, name);
  save("verified.json", { at: new Date().toISOString(), revision: fn.serviceConfig.revision, modules, hostingAndOtherFunctionsUnchanged: true, runtimeAndIamPreserved: true, ...read("workbook-check.json") });
  console.log("Game subtotal exclusion deployed and verified. Existing August workbook is unchanged and contains no Total dates.");
}
const actions = { audit, test, deploy, wait, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
