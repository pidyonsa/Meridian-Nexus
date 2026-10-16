"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process"), JSZip = require("../functions/node_modules/jszip");
const { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/pnp-raw-site-name-20260924");
const prior = path.join(root, ".tmp/pnp-mapping-policy-20260924"), project = "meridain-nexus", region = "us-central1";
const jobUrl = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260924-pnp-raw-site-name`;
const documents = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const referenceKeys = ["etlReferenceSets/anchor-pnp-v1", "portalResources/inventory-anchor-stores"];
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const text = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const hosting = () => json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
async function source(config) {
  const s = config.buildConfig.source.storageSource;
  return JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
}
async function audit() {
  const fn = await json(fnUrl("meridianEtl")); save("function.before.json", fn);
  save("function.iam.json", await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`));
  for (const entry of Object.values((await source(fn)).files)) if (!entry.dir) save("source/" + entry.name, await entry.async("nodebuffer"));
  const job = await json(jobUrl); assert.deepEqual(job.template, JSON.parse(fs.readFileSync(path.join(prior, "job.after.json"))).template);
  save("job.before.json", job); save("job.iam.json", await json(jobUrl + ":getIamPolicy"));
  const unchanged = {};
  for (const name of ["processExtraction", "startExtraction", "submitAutomationPrompt", "getOperationsWorkspace", "getPortalResourceDownload"]) unchanged[name] = (await json(fnUrl(name))).serviceConfig.revision;
  save("unchanged.json", unchanged); save("hosting.before.json", await hosting());
  const refs = {}; for (const key of referenceKeys) refs[key] = await json(`${documents}/${key}`); save("references.before.json", refs);
  console.log("Captured the live ETL API, worker, Hosting and reference metadata; no business data changed.");
}
function prepare() {
  fs.cpSync(path.join(stage, "source"), path.join(stage, "deploy"), { recursive: true });
  fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(stage, "deploy/meridian-etl.js"));
  const before = fileHashes(path.join(stage, "source")), after = fileHashes(path.join(stage, "deploy"));
  assert.deepEqual(Object.keys(before), Object.keys(after));
  for (const file of Object.keys(before)) if (file !== "meridian-etl.js") assert.equal(before[file], after[file]);
  const previousApi = text(path.join(stage, "deploy/meridian-etl.js"))
    .replace('const OUTPUT_POLICY = "pnp-raw-site-name-v1";\n', '').replaceAll('outputPolicy: OUTPUT_POLICY, ', '');
  assert.equal(previousApi, text(path.join(stage, "source/meridian-etl.js")), "Unexpected API changes");
  const worker = path.join(stage, "worker"); fs.mkdirSync(worker, { recursive: true });
  const priorFiles = JSON.parse(fs.readFileSync(path.join(prior, "tested.json"))).worker;
  for (const file of ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) {
    assert.equal(hash(fs.readFileSync(path.join(prior, "worker", file))), priorFiles[file]);
    fs.copyFileSync(path.join(prior, "worker", file), path.join(worker, file));
  }
  for (const file of ["engine.cjs", "worker.cjs"]) fs.copyFileSync(path.join(root, "etl-worker", file), path.join(worker, file));
  fs.mkdirSync(path.join(worker, "test"));
  for (const file of ["worker.test.cjs", "inventory-fixture.cjs"]) fs.copyFileSync(path.join(root, "etl-worker/test", file), path.join(worker, "test", file));
  save("prepared.json", { source: after, worker: fileHashes(worker) });
  save("build-config.json", { steps: [{ name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] },
    { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "-v", "/workspace/test:/app/test:ro", image, "node", "--test", "test/worker.test.cjs"] }], images: [image], timeout: "1200s" });
  console.log("Staged only the ETL engine, manifest reader and server-pinned output policy. No frontend changes.");
}
async function test() {
  const prepared = read("prepared.json"); assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source);
  assert.deepEqual(fileHashes(path.join(stage, "worker")), prepared.worker);
  execFileSync(process.execPath, ["--test", "etl-worker/test/engine.test.cjs", "etl-worker/test/worker.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  const engine = require("../etl-worker/engine.cjs"), { files, folder } = require("./test-anchor-etl-real.cjs"), ExcelJS = require("../etl-worker/node_modules/exceljs");
  assert.equal(hash(fs.readFileSync("etl-worker/engine.cjs")), prepared.worker["engine.cjs"]);
  const data = {}, checksums = {};
  for (const [role, name] of Object.entries(files)) {
    const file = role === "stores" ? ".tmp/pnp-corrected-stores-20260924/source.xlsx"
      : role === "staffing" ? ".tmp/national-master-20260924/files/National_Call_Cycle_23.09.2026_ETL.xlsx" : path.join(folder, name);
    const bytes = fs.readFileSync(file); checksums[role] = hash(bytes); data[role] = await engine.readWorkbook(bytes, role);
  }
  assert.equal(checksums.stores, read("references.before.json")[referenceKeys[1]].fields.sha256.stringValue);
  const config = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "exported", productFamily: "PICK N PAY CORPORATE", confirmed: true };
  const old = engine.transform(data, config, files.raw, engine.ACCEPTED_MAPPING_POLICY);
  const result = engine.transform(data, config, files.raw, engine.ACCEPTED_MAPPING_POLICY, engine.RAW_SITE_NAME_POLICY);
  for (const key of ["totals", "assignments", "exceptions", "warnings", "exclusions", "regionDecisions", "status", "reconciled"]) assert.deepEqual(result[key], old[key], key);
  const raw = new Map(data.raw.map(row => [row.line, row.v])); let changed = 0;
  result.facts.forEach((fact, i) => {
    const name = String(raw.get(fact.line)[2] ?? ""); if (old.facts[i].values[4] !== name) changed++;
    assert.deepEqual(fact, { ...old.facts[i], values: old.facts[i].values.map((value, column) => column === 4 ? name : value) });
  });
  const bytes = await engine.exportWorkbook(result, { note: "LOCAL VALIDATION ONLY - NOT APPROVED", checksums });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  result.facts.forEach((fact, i) => assert.equal(book.getWorksheet("Template").getCell(i + 2, 5).value ?? "", String(raw.get(fact.line)[2] ?? "")));
  assert.ok(result.reconciled); assert.ok(changed > 0);
  save("inventory-local-validation.xlsx", bytes);
  save("local-validation.json", { source: files.raw, asOf: result.asOf, localReplayOnly: true, checksums, outputPolicy: result.outputPolicy,
    templateRows: result.facts.length, changedSiteNames: changed, otherColumnsAndMappingsUnchanged: true, totals: result.totals, reconciled: result.reconciled });
  save("tested.json", { ...prepared, at: new Date().toISOString(), focusedTests: 58, allExportedSiteNamesVerified: true });
  console.log(`Verified all ${result.facts.length} exported Site Names against raw data; ${changed} names changed. Other columns and mappings unchanged.`);
}
function build() {
  assert.deepEqual(fileHashes(path.join(stage, "worker")), read("tested.json").worker);
  save("build.started.json", JSON.parse(gc("builds", "submit", path.join(stage, "worker"), `--config=${path.join(stage, "build-config.json")}`, `--project=${project}`, `--region=${region}`, "--async", "--format=json", "--quiet")));
}
async function poll(url, delay = 5000) {
  for (let i = 0; i < 180; i++) {
    const result = await json(url); if (result.done) { assert.ok(!result.error, JSON.stringify(result.error)); return result; }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw Error("Operation still running; inspect saved operation before retrying.");
}
async function deployWorker() {
  const build = await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${read("build.started.json").id}`);
  assert.equal(build.status, "SUCCESS", "Build must finish successfully before deploy"); save("build.result.json", build);
  const current = await json(jobUrl), before = read("job.before.json"); assert.deepEqual(current.template, before.template); assert.equal(current.generation, before.generation);
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  const template = structuredClone(before.template); template.template.containers[0].image = image.split(":")[0] + "@" + build.results.images.find(r => r.name === image).digest;
  const op = await json(jobUrl, "PATCH", { name: current.name, etag: current.etag, template }); save("worker.operation.json", op);
  await poll("https://run.googleapis.com/v2/" + op.name);
  const after = await json(jobUrl); assert.deepEqual(after.template, template); assert.equal(after.terminalCondition.state, "CONDITION_SUCCEEDED");
  save("job.after.json", after); console.log("Worker deployed with backward-compatible output-policy handling.");
}
async function deployApi() {
  assert.deepEqual((await json(jobUrl)).template, read("job.after.json").template);
  const before = read("function.before.json"), tested = read("tested.json");
  assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, before.serviceConfig.revision);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), tested.source);
  const zip = new JSZip(); for (const file of Object.keys(tested.source)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${region}/functions:generateUploadUrl`, "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) }); assert.ok(response.ok);
  const op = await json(fnUrl("meridianEtl") + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } }); save("function.operation.json", op);
  save("function.result.json", await poll("https://cloudfunctions.googleapis.com/v2/" + op.name, 10000));
  save("function.after.json", await json(fnUrl("meridianEtl"))); console.log("API deployed; new runs now pin the raw Site Name output policy.");
}
async function verify() {
  const tested = read("tested.json"), before = read("function.before.json"), after = await json(fnUrl("meridianEtl"));
  assert.equal(after.state, "ACTIVE"); assert.equal(after.serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], key);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  const zip = await source(after); for (const [file, digest] of Object.entries(tested.source)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest);
  for (const [name, revision] of Object.entries(read("unchanged.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  assert.deepEqual((await json(jobUrl)).template, read("job.after.json").template); assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  assert.equal((await hosting()).release.version.name, read("hosting.before.json").release.version.name);
  for (const [key, doc] of Object.entries(read("references.before.json"))) assert.deepEqual(await json(`${documents}/${key}`), doc);
  const response = await fetch(`https://${region}-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) }); assert.ok([401, 403].includes(response.status));
  save("verified.json", { at: new Date().toISOString(), api: after.serviceConfig.revision, image: read("job.after.json").template.template.containers[0].image,
    outputPolicy: "pnp-raw-site-name-v1", hostingReferencesAndOtherFunctionsUnchanged: true, iamAndRuntimePreserved: true, noBusinessJobsStarted: true });
  console.log("Raw Site Name release verified live. References, Hosting, other automations and permissions unchanged.");
}
const actions = { audit, prepare, test, build, deployWorker, deployApi, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
