"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), Module = require("node:module");
const { execFileSync } = require("node:child_process");
const { json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/etl-mapping-diagnostics-20260923"), previous = path.join(root, ".tmp/etl-worker-repair-20260923");
const project = "meridain-nexus", region = "us-central1", jobUrl = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260923-mapping-diagnostics`;
const files = ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"];
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const prior = file => JSON.parse(fs.readFileSync(path.join(previous, file), "utf8"));
const live = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
function save(file, value) { const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" }); }
async function baseline() {
  const job = await json(jobUrl); assert.equal(job.template.template.containers[0].image, prior("job.after.json").template.template.containers[0].image);
  const build = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${prior("build.result.json").id}`);
  assert.equal(build.status, "SUCCESS"); assert.equal(job.template.template.containers[0].image.split("@")[1], build.results.images[0].digest);
  for (const file of files) assert.equal(hash(fs.readFileSync(path.join(previous, "worker", file))), prior("tested.json").worker[file]);
  save("job.before.json", job); save("job.iam.json", await json(jobUrl + ":getIamPolicy"));
  save("hosting.before.json", await live());
  const revisions = {};
  for (const name of ["meridianEtl", "processExtraction", "startExtraction", "getOperationsWorkspace", "getPortalResourceDownload"]) revisions[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("functions.before.json", revisions);
  console.log("Current worker verified against its recorded build. No production changes.");
}
function prepare() {
  const worker = path.join(stage, "worker"); assert.ok(!fs.existsSync(worker)); fs.mkdirSync(worker, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(previous, "worker", file), path.join(worker, file));
  fs.copyFileSync(path.join(root, "etl-worker/engine.cjs"), path.join(worker, "engine.cjs"));
  for (const file of files.filter(file => file !== "engine.cjs")) assert.equal(hash(fs.readFileSync(path.join(worker, file))), prior("tested.json").worker[file]);
  fs.mkdirSync(path.join(worker, "test"));
  for (const file of ["worker.test.cjs", "inventory-fixture.cjs"]) fs.copyFileSync(path.join(root, "etl-worker/test", file), path.join(worker, "test", file));
  save("build-config.json", { steps: [
    { name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] },
    { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "-v", "/workspace/test:/app/test:ro", image, "node", "--test", "test/worker.test.cjs"] }
  ], images: [image], timeout: "1200s" });
  save("prepared.json", { worker: fileHashes(worker) });
}
async function test() {
  assert.deepEqual(fileHashes(path.join(stage, "worker")), read("prepared.json").worker);
  for (const file of ["worker.test.cjs", "inventory-fixture.cjs"]) fs.copyFileSync(path.join(root, "etl-worker/test", file), path.join(stage, "worker/test", file));
  assert.equal(hash(fs.readFileSync("etl-worker/engine.cjs")), read("prepared.json").worker["engine.cjs"]);
  execFileSync(process.execPath, ["--test", "etl-worker/test/engine.test.cjs", "etl-worker/test/worker.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  const oldPath = path.join(previous, "worker/engine.cjs"), baseline = new Module(oldPath); baseline.filename = oldPath;
  baseline.paths = Module._nodeModulePaths(path.join(root, "etl-worker")); baseline._compile(fs.readFileSync(oldPath, "utf8"), oldPath);
  const engine = require("../etl-worker/engine.cjs"), { folder, files: inputs } = require("./test-anchor-etl-real.cjs"), data = {};
  for (const [role, name] of Object.entries(inputs)) data[role] = await engine.readWorkbook(fs.readFileSync(path.join(folder, name)), role);
  const rules = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true };
  const before = baseline.exports.transform(data, rules, inputs.raw), after = engine.transform(data, rules, inputs.raw);
  for (const key of ["facts", "totals", "assignments", "dcFacts", "status", "reconciled", "referenceCellErrors"]) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.exceptions.map(row => row.line), before.exceptions.map(row => row.line));
  for (const key of Object.keys(before.issueCounts).filter(key => key !== "REGION_MAPPING")) assert.equal(after.issueCounts[key], before.issueCounts[key]);
  save("real-regression.json", { source: inputs.raw, inventoryFactsUnchanged: true, totals: after.totals, beforeIssues: before.issueCounts, afterIssues: after.issueCounts, liquorEligible: true });
  save("tested.json", { worker: fileHashes(path.join(stage, "worker")), at: new Date().toISOString() });
  console.log("Historical real-data replay preserves every inventory fact, stock total, assignment and unresolved row.");
}
function build() {
  assert.deepEqual(fileHashes(path.join(stage, "worker")), read("tested.json").worker); assert.ok(!fs.existsSync(path.join(stage, "build.started.json")));
  save("build.started.json", JSON.parse(gc("builds", "submit", path.join(stage, "worker"), `--config=${path.join(stage, "build-config.json")}`, `--project=${project}`, `--region=${region}`, "--async", "--format=json", "--quiet")));
  console.log("Submitted isolated worker image and offline container tests.");
}
async function waitBuild() {
  for (let i = 0; i < 120; i++) {
    const result = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${read("build.started.json").id}`);
    if (!["QUEUED", "WORKING", "STATUS_UNKNOWN"].includes(result.status)) { save("build.result.json", result); assert.equal(result.status, "SUCCESS"); assert.ok(result.steps.every(step => step.status === "SUCCESS")); console.log("Build and offline ready/missing/conflicting-store worker tests passed."); return; }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw Error("Build still running; resume wait-build.");
}
async function deploy() {
  const before = read("job.before.json"), current = await json(jobUrl); assert.deepEqual(current.template, before.template); assert.equal(current.generation, before.generation);
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  const build = read("build.result.json"); assert.equal(build.status, "SUCCESS");
  const digest = build.results.images.find(item => item.name === image).digest; assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  const template = structuredClone(before.template); template.template.containers[0].image = image.split(":")[0] + "@" + digest;
  assert.ok(!fs.existsSync(path.join(stage, "job.operation.json")));
  const operation = await json(jobUrl, "PATCH", { name: before.name, etag: current.etag, template }); save("job.operation.json", operation);
  for (let i = 0; i < 120; i++) {
    const result = await json("https://run.googleapis.com/v2/" + operation.name);
    if (result.done) { save("job.result.json", result); assert.ok(!result.error, JSON.stringify(result.error)); break; }
    assert.ok(i < 119); await new Promise(resolve => setTimeout(resolve, 10000));
  }
  const after = await json(jobUrl); assert.deepEqual(after.template, template); assert.equal(after.executionCount, before.executionCount);
  save("job.after.json", after); console.log("Diagnostic-only worker repair deployed; no inventory run started.");
}
async function verify() {
  const job = await json(jobUrl); assert.deepEqual(job.template, read("job.after.json").template); assert.equal(job.terminalCondition.state, "CONDITION_SUCCEEDED");
  assert.equal(job.executionCount, read("job.before.json").executionCount); assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  assert.equal((await live()).release.version.name, read("hosting.before.json").release.version.name);
  for (const [name, revision] of Object.entries(read("functions.before.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  save("verified.json", { at: new Date().toISOString(), workerImage: job.template.template.containers[0].image, unchangedInventoryMappingDecisions: true,
    liquorEligible: true, hostingAndFunctionsUnchanged: true, iamAndRuntimePreserved: true, noInventoryRunStarted: true });
  console.log("Live worker verified; mapping policy, all other automations, runtime and access controls preserved.");
}
const actions = { baseline, prepare, test, build, "wait-build": waitBuild, deploy, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
