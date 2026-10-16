"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs");
const { gc } = require("./release-etls.cjs");
const Zip = require("../functions/node_modules/jszip");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/etl-worker-repair-20260923");
const project = "meridain-nexus", region = "us-central1", name = "meridianEtl";
const jobUrl = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260923-template-repair`;
const workerFiles = ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"];
const live = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
function save(file, data) {
  const target = path.join(stage, file); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(data) || typeof data === "string" ? data : JSON.stringify(data, null, 2), { flag: "wx" });
}
async function sourceArchive(config) {
  const s = config.buildConfig.source.storageSource;
  return Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function baseline() {
  const fn = await json(fnUrl(name)); save("function.before.json", fn);
  const archive = await sourceArchive(fn);
  for (const e of Object.values(archive.files)) {
    if (e.dir) continue;
    assert.ok(path.resolve(stage, "source", e.name).startsWith(path.join(stage, "source") + path.sep));
    save("source/" + e.name, await e.async("nodebuffer"));
  }
  save("function.iam.before.json", await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`));
  const job = await json(jobUrl); save("job.before.json", job);
  save("job.iam.before.json", await json(jobUrl + ":getIamPolicy"));
  const prior = JSON.parse(fs.readFileSync(path.join(root, ".tmp/etl-references-20260910/build.verified.json")));
  const build = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${prior.id}`);
  assert.equal(build.status, "SUCCESS");
  assert.equal(job.template.template.containers[0].image.split("@")[1], build.results.images[0].digest);
  save("worker.build.before.json", build);
  const s = build.sourceProvenance.resolvedStorageSource;
  const bytes = Buffer.from(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const expected = Object.values(build.sourceProvenance.fileHashes).flatMap(v => v.fileHash).find(v => v.type === "SHA256");
  assert.equal(hash(bytes), Buffer.from(expected.value, "base64url").toString("hex"));
  save("worker.before.tgz", bytes);
  const entries = execFileSync("tar.exe", ["-tzf", path.join(stage, "worker.before.tgz")], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
  for (const entry of entries) assert.ok(!path.isAbsolute(entry) && !entry.split(/[\\/]/).includes(".."), "Unsafe source archive path");
  fs.mkdirSync(path.join(stage, "worker-before"));
  execFileSync("tar.exe", ["-xzf", path.join(stage, "worker.before.tgz"), "-C", path.join(stage, "worker-before")], { windowsHide: true });
  for (const file of workerFiles) assert.equal(hash(fs.readFileSync(path.join(stage, "worker-before", file))), hash(fs.readFileSync(path.join(root, ".tmp/etl-references-20260910/worker", file))), file);
  const hosting = await live(); save("hosting.before.json", hosting);
  const manifest = await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);
  assert.ok(!manifest.nextPageToken); save("hosting.files.before.json", manifest);
  for (const file of manifest.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://meridian-nexus.web.app${file.path}?baseline=${Date.now()}`); assert.ok(response.ok);
    const content = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(content, { level: 9 })), file.hash);
    save("portal" + file.path, content);
  }
  console.log(JSON.stringify({ baseline: fn.serviceConfig.revision, worker: job.template.template.containers[0].image, hosting: hosting.release.version.name }));
}
function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "prepared.json")));
  const source = path.join(stage, "source"), deploy = path.join(stage, "deploy"), worker = path.join(stage, "worker");
  fs.cpSync(source, deploy, { recursive: true });
  fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(deploy, "meridian-etl.js"));
  const before = fileHashes(source), after = fileHashes(deploy);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const file of Object.keys(before)) if (file !== "meridian-etl.js") assert.equal(after[file], before[file], file);
  fs.mkdirSync(worker);
  for (const file of workerFiles) fs.copyFileSync(path.join(root, "etl-worker", file), path.join(worker, file));
  for (const file of workerFiles.filter(f => !["engine.cjs", "worker.cjs"].includes(f))) assert.equal(hash(fs.readFileSync(path.join(worker, file))), hash(fs.readFileSync(path.join(stage, "worker-before", file))), file);
  fs.mkdirSync(path.join(worker, "test"));
  for (const file of ["worker.test.cjs", "inventory-fixture.cjs"]) fs.copyFileSync(path.join(root, "etl-worker/test", file), path.join(worker, "test", file));
  const build = { steps: [
    { name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] },
    { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "-v", "/workspace/test:/app/test:ro", image, "node", "--test", "test/worker.test.cjs"] }
  ], images: [image], timeout: "1200s" };
  save("build-config.json", build);
  save("prepared.json", { source: after, worker: fileHashes(worker), at: new Date().toISOString() });
}
async function test() {
  const prepared = read("prepared.json");
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source);
  assert.deepEqual(fileHashes(path.join(stage, "worker")), prepared.worker);
  assert.equal(hash(fs.readFileSync(path.join(root, "functions/meridian-etl.js"))), prepared.source["meridian-etl.js"]);
  for (const file of workerFiles) assert.equal(hash(fs.readFileSync(path.join(root, "etl-worker", file))), prepared.worker[file]);
  const Module = require("node:module"), baselinePath = path.join(stage, "worker-before/engine.cjs");
  const archived = new Module(baselinePath); archived.filename = baselinePath;
  archived.paths = Module._nodeModulePaths(path.join(root, "etl-worker"));
  archived._compile(fs.readFileSync(baselinePath, "utf8"), baselinePath);
  const fixture = await require("../etl-worker/test/inventory-fixture.cjs").inventoryFixture("c".repeat(32));
  const data = {};
  for (const [role, input] of Object.entries(fixture.manifest.inputs)) {
    data[role] = role === "template" ? await archived.exports.readTemplate(fixture.objects.get(input.path)) : await archived.exports.readWorkbook(fixture.objects.get(input.path), role);
  }
  assert.throws(() => archived.exports.transform(data, fixture.manifest.rules, fixture.manifest.inputs.raw.name), /rows\.flatMap is not a function/);
  const repaired = require("../etl-worker/engine.cjs").transform(data, fixture.manifest.rules, fixture.manifest.inputs.raw.name);
  assert.equal(repaired.status, "ready"); assert.equal(repaired.reconciled, true); assert.equal(repaired.totals.sourceStoreSOH, 115);
  save("reproduction.json", { source: "hash-verified deployed worker build archive", baselineError: "rows.flatMap is not a function", repairedStatus: repaired.status, reconciled: repaired.reconciled, fixture: "synthetic, no business data" });
  execFileSync(process.execPath, ["--test", "etl-worker/test/engine.test.cjs", "etl-worker/test/worker.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs", "scripts/tests/resource-storage-error.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env, NEXUS_PORTAL_STAGE: path.join(stage, "portal"), NEXUS_ETL_TEST_OUTPUT: path.join(stage, "browser"), NEXUS_ETL_CHANNELS: "1", NEXUS_ETL_APPROVAL_CHECK: "1", NEXUS_ETL_LABEL: "No-ETLs" } });
  save("tested.json", { ...prepared, at: new Date().toISOString() });
}
function build() {
  assert.deepEqual(fileHashes(path.join(stage, "worker")), read("tested.json").worker);
  assert.ok(!fs.existsSync(path.join(stage, "build.started.json")), "Resume the existing build instead");
  const output = gc("builds", "submit", path.join(stage, "worker"), `--config=${path.join(stage, "build-config.json")}`, `--project=${project}`, `--region=${region}`, "--async", "--format=json", "--quiet");
  save("build.started.json", JSON.parse(output)); console.log("Submitted isolated worker build and offline container tests");
}
async function waitBuild() {
  const started = read("build.started.json");
  for (let i = 0; i < 120; i++) {
    const build = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${started.id}`);
    if (!["QUEUED", "WORKING", "STATUS_UNKNOWN"].includes(build.status)) {
      save("build.result.json", build); assert.equal(build.status, "SUCCESS", `Build ${build.id}: ${build.status}`);
      assert.equal(build.steps.length, 2); assert.ok(build.steps.every(step => step.status === "SUCCESS"));
      assert.match(build.results.images.find(item => item.name === image)?.digest || "", /^sha256:[a-f0-9]{64}$/);
      console.log("Image built; offline worker tests passed inside the deployment container"); return;
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error("Build still running; resume wait-build");
}
async function waitOperation(url, label) {
  const operation = read(label + ".operation.json");
  for (let i = 0; i < 120; i++) {
    const result = await json(url + operation.name);
    if (result.done) { save(label + ".result.json", result); assert.ok(!result.error, JSON.stringify(result.error)); return; }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error("Operation still running; inspect before retrying");
}
async function deployWorker() {
  const before = read("job.before.json"), current = await json(jobUrl);
  assert.deepEqual(current.template, before.template); assert.equal(current.generation, before.generation);
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.before.json"));
  const build = read("build.result.json"); assert.equal(build.status, "SUCCESS");
  const digest = build.results.images.find(item => item.name === image).digest;
  const template = structuredClone(before.template); template.template.containers[0].image = image.split(":")[0] + "@" + digest;
  assert.ok(!fs.existsSync(path.join(stage, "job.operation.json")));
  save("job.operation.json", await json(jobUrl, "PATCH", { name: before.name, etag: current.etag, template }));
  await waitOperation("https://run.googleapis.com/v2/", "job");
  const after = await json(jobUrl); assert.deepEqual(after.template, template);
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.before.json"));
  assert.equal(after.executionCount, before.executionCount, "No job should start during deployment");
  save("job.after.json", after); console.log("Repaired worker deployed; runtime and IAM unchanged; no inventory run started");
}
async function deployApi() {
  const before = read("function.before.json"), tested = read("tested.json");
  assert.equal((await json(fnUrl(name))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), tested.source);
  assert.ok(!fs.existsSync(path.join(stage, "api.operation.json")));
  const zip = new Zip();
  for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${region}/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
  save("api.operation.json", await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } }));
  await waitOperation("https://cloudfunctions.googleapis.com/v2/", "api");
  const after = await json(fnUrl(name)); assert.equal(after.state, "ACTIVE");
  for (const field of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "minInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[field], before.serviceConfig[field], field);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("function.iam.before.json"));
  save("function.after.json", after); console.log("No-ETLs status API deployed: " + after.serviceConfig.revision);
}
async function verify() {
  const fn = await json(fnUrl(name)); assert.equal(fn.state, "ACTIVE");
  assert.equal(fn.serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  const zip = await sourceArchive(fn);
  for (const [file, digest] of Object.entries(read("tested.json").source)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest, file);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`), read("function.iam.before.json"));
  const job = await json(jobUrl); assert.deepEqual(job.template, read("job.after.json").template);
  assert.equal(job.terminalCondition.state, "CONDITION_SUCCEEDED");
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.before.json"));
  assert.equal(job.executionCount, read("job.before.json").executionCount);
  const hosting = await live(); assert.equal(hosting.release.version.name, read("hosting.before.json").release.version.name);
  const anonymous = await fetch(`https://${region}-${project}.cloudfunctions.net/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) });
  assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).error.status, "UNAUTHENTICATED");
  const report = { at: new Date().toISOString(), apiRevision: fn.serviceConfig.revision, workerImage: job.template.template.containers[0].image, offlineContainerTestsPassed: true, hostingUnchanged: true, runtimeAndIamPreserved: true, noProductionJobStarted: true, anonymousDenied: true };
  save("verified.json", report); console.log(JSON.stringify(report, null, 2));
}
const actions = { baseline, prepare, test, build, "wait-build": waitBuild, "deploy-worker": deployWorker, "deploy-api": deployApi, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
