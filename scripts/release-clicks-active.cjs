"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip"), { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/clicks-active-release-20260925"), prior = path.join(root, ".tmp/etl-feedback-release-20260925");
const project = "meridain-nexus", region = "us-central1", jobUrl = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260925-clicks-active`;
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file))), text = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const live = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
async function source(fn) {
  const s = fn.buildConfig.source.storageSource;
  return JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function audit() {
  const fn = await json(fnUrl("meridianEtl")); save("function.before.json", fn);
  save("function.iam.json", await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`));
  for (const entry of Object.values((await source(fn)).files)) if (!entry.dir) save("source/" + entry.name, await entry.async("nodebuffer"));
  const job = await json(jobUrl); assert.deepEqual(job.template, JSON.parse(fs.readFileSync(path.join(prior, "job.after.json"))).template);
  save("job.before.json", job); save("job.iam.json", await json(jobUrl + ":getIamPolicy"));
  save("hosting.before.json", await live());
  const others = {};
  for (const name of ["processExtraction", "startExtraction", "submitAutomationPrompt", "getOperationsWorkspace", "getPortalResourceDownload"]) others[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("unchanged.json", others); console.log("Captured live API and worker baselines. No customer data or jobs changed.");
}
function prepare() {
  const sourceRoot = path.join(stage, "source"), deploy = path.join(stage, "deploy"), worker = path.join(stage, "worker");
  const addition = '      if (context?.transformerVersion === "clicks-inventory-v1") context.articleStatusDefault = "Active";\n';
  const before = text(path.join(sourceRoot, "meridian-etl.js")), after = text(path.join(root, "functions/meridian-etl.js"));
  assert.equal(after.split(addition).length, 2); assert.equal(after.replace(addition, ""), before, "Only the Clicks default may change in the live API");
  fs.cpSync(sourceRoot, deploy, { recursive: true }); fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(deploy, "meridian-etl.js"));
  const originalWorker = JSON.parse(fs.readFileSync(path.join(prior, "tested.json"))).worker;
  assert.deepEqual(fileHashes(path.join(prior, "worker")), originalWorker);
  fs.cpSync(path.join(prior, "worker"), worker, { recursive: true });
  for (const file of ["clicks-inventory.cjs", "test/feedback-worker.test.cjs"]) fs.copyFileSync(path.join(root, "etl-worker", file), path.join(worker, file));
  const currentWorker = fileHashes(worker), sourceBefore = fileHashes(sourceRoot), sourceAfter = fileHashes(deploy);
  assert.deepEqual(Object.keys(sourceBefore), Object.keys(sourceAfter));
  for (const file of Object.keys(sourceBefore)) if (file !== "meridian-etl.js") assert.equal(sourceBefore[file], sourceAfter[file]);
  assert.deepEqual(Object.keys(originalWorker), Object.keys(currentWorker));
  for (const file of Object.keys(originalWorker)) if (!["clicks-inventory.cjs", "test/feedback-worker.test.cjs"].includes(file)) assert.equal(originalWorker[file], currentWorker[file]);
  save("prepared.json", { source: sourceAfter, worker: currentWorker });
  save("build-config.json", { steps: [{ name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] }, { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "-v", "/workspace/test:/app/test:ro", image, "node", "--test", "test/worker.test.cjs", "test/shared-worker.test.cjs", "test/shared-layout.test.cjs", "test/feedback.test.cjs", "test/feedback-worker.test.cjs"] }], images: [image], timeout: "1200s" });
  console.log("Prepared a Clicks-only transformer/default change; no Hosting or reference changes.");
}
function test() {
  const prepared = read("prepared.json"); assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source); assert.deepEqual(fileHashes(path.join(stage, "worker")), prepared.worker);
  execFileSync(process.execPath, ["--test", "etl-worker/test/engine.test.cjs", "etl-worker/test/worker.test.cjs", "etl-worker/test/shared-worker.test.cjs", "etl-worker/test/shared-layout.test.cjs", "etl-worker/test/feedback.test.cjs", "etl-worker/test/feedback-worker.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  const real = JSON.parse(fs.readFileSync(path.join(root, ".tmp/clicks-active-validation-20260925/verified.json")));
  assert.equal(real.transformerSha256, prepared.worker["clicks-inventory.cjs"]); assert.ok(real.outputRows > 0 && real.allOtherColumnsUnchanged && real.exceptionsUnchanged);
  save("tested.json", { ...prepared, at: new Date().toISOString(), realValidation: real });
}
function build() {
  assert.deepEqual(fileHashes(path.join(stage, "worker")), read("tested.json").worker);
  save("build.started.json", JSON.parse(gc("builds", "submit", path.join(stage, "worker"), `--config=${path.join(stage, "build-config.json")}`, `--project=${project}`, `--region=${region}`, "--async", "--format=json", "--quiet")));
}
async function poll(url) {
  for (let n = 0; n < 180; n++) { const r = await json(url); if (r.done) { assert.ok(!r.error, JSON.stringify(r.error)); return r; } await new Promise(resolve => setTimeout(resolve, 5000)); }
  throw Error("Operation still running. Inspect the saved operation before retrying.");
}
async function deployWorker() {
  const build = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${read("build.started.json").id}`); assert.equal(build.status, "SUCCESS"); save("build.result.json", build);
  const current = await json(jobUrl), before = read("job.before.json"); assert.deepEqual(current.template, before.template); assert.equal(current.generation, before.generation); assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  const template = structuredClone(before.template); template.template.containers[0].image = image.split(":")[0] + "@" + build.results.images.find(i => i.name === image).digest;
  const op = await json(jobUrl, "PATCH", { name: current.name, etag: current.etag, template }); save("worker.operation.json", op); await poll("https://run.googleapis.com/v2/" + op.name);
  const after = await json(jobUrl); assert.deepEqual(after.template, template); assert.equal(after.terminalCondition.state, "CONDITION_SUCCEEDED"); save("job.after.json", after); console.log("Worker deployed; historical manifests retain blank statuses.");
}
async function deployApi() {
  const before = read("function.before.json"), tested = read("tested.json");
  assert.deepEqual((await json(jobUrl)).template, read("job.after.json").template); assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read("function.iam.json")); assert.deepEqual(fileHashes(path.join(stage, "deploy")), tested.source);
  const zip = new JSZip(); for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${region}/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
  const op = await json(fnUrl("meridianEtl") + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } }); save("function.operation.json", op);
  save("function.result.json", await poll("https://cloudfunctions.googleapis.com/v2/" + op.name)); save("function.after.json", await json(fnUrl("meridianEtl"))); console.log("New Clicks inventory runs now pin Active as the default status.");
}
async function verify() {
  const before = read("function.before.json"), after = await json(fnUrl("meridianEtl")), tested = read("tested.json");
  assert.equal(after.state, "ACTIVE"); assert.equal(after.serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key]);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  const zip = await source(after); for (const [file, digest] of Object.entries(tested.source)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest);
  assert.deepEqual((await json(jobUrl)).template, read("job.after.json").template); assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  for (const [name, revision] of Object.entries(read("unchanged.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  assert.equal((await live()).release.version.name, read("hosting.before.json").release.version.name);
  const response = await fetch(`https://${region}-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) }); assert.ok([401,403].includes(response.status));
  save("verified.json", { at: new Date().toISOString(), api: after.serviceConfig.revision, image: read("job.after.json").template.template.containers[0].image, hostingUnchanged: true, otherFunctionsUnchanged: true, iamAndRuntimePreserved: true, noBusinessJobsStarted: true });
  console.log("Live Clicks Active default verified; other pipelines, access controls and portal files unchanged.");
}
const actions = { audit, prepare, test, build, deployWorker, deployApi, verify };
Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
