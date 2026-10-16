"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), JSZip = require("../functions/node_modules/jszip");
const { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/shared-etls-release-20260924");
const prior = path.join(root, ".tmp/pnp-raw-site-name-20260924");
const project = "meridain-nexus", region = "us-central1", site = "meridian-nexus";
const host = "https://firebasehosting.googleapis.com/v1beta1", jobUrl = `https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260924-shared-etls`, tag = "20260924-shared-etls";
const assets = ["etls.js", "etl-references.js", "index.html", "service-worker.js"];
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const text = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const assetHashes = () => Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(stage, "portal", file)))]));
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
  save("unchanged.json", unchanged);
  const hosting = await live(); save("hosting.before.json", hosting);
  const manifest = await json(`${host}/${hosting.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("manifest.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://${site}.web.app${item.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), item.hash);
    save("baseline" + item.path, bytes);
  }
  console.log("Live API, worker and Hosting baselines captured. No business data changed.");
}
function prepare() {
  fs.cpSync(path.join(stage, "source"), path.join(stage, "deploy"), { recursive: true });
  const modules = ["meridian-etl.js", "etl-pipelines.js"];
  for (const file of modules) fs.copyFileSync(path.join(root, "functions", file), path.join(stage, "deploy", file));
  const before = fileHashes(path.join(stage, "source")), after = fileHashes(path.join(stage, "deploy"));
  assert.deepEqual(Object.keys(before), Object.keys(after));
  for (const file of Object.keys(before)) if (!modules.includes(file)) assert.equal(before[file], after[file]);
  fs.cpSync(path.join(stage, "baseline"), path.join(stage, "portal"), { recursive: true });
  for (const file of ["etls.js", "etl-references.js"]) fs.copyFileSync(path.join(root, "public", file), path.join(stage, "portal", file));
  for (const file of ["index.html", "service-worker.js"]) {
    let content = text(path.join(stage, "baseline", file)); assert.match(content, /etls\.js\?v=[\w-]+/);
    content = content.replace(/(etls|etl-references)\.js\?v=[\w-]+/g, (_, name) => `${name}.js?v=${tag}`);
    if (file === "service-worker.js") content = content.replace(/const CACHE = "[^"]+";/, `const CACHE = "meridian-nexus-${tag}";`);
    fs.writeFileSync(path.join(stage, "portal", file), content);
  }
  const worker = path.join(stage, "worker"); fs.mkdirSync(worker, { recursive: true });
  const priorFiles = JSON.parse(fs.readFileSync(path.join(prior, "tested.json"))).worker;
  for (const file of ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) {
    assert.equal(hash(fs.readFileSync(path.join(prior, "worker", file))), priorFiles[file]);
    fs.copyFileSync(path.join(prior, "worker", file), path.join(worker, file));
  }
  for (const file of ["engine.cjs", "worker.cjs", "shared-layout.cjs", "sales.cjs"]) fs.copyFileSync(path.join(root, "etl-worker", file), path.join(worker, file));
  fs.mkdirSync(path.join(worker, "test"));
  for (const file of ["worker.test.cjs", "inventory-fixture.cjs", "shared-layout.test.cjs"]) fs.copyFileSync(path.join(root, "etl-worker/test", file), path.join(worker, "test", file));
  save("prepared.json", { source: after, assets: assetHashes(), worker: fileHashes(worker) });
  save("build-config.json", { steps: [{ name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] },
    { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "-v", "/workspace/test:/app/test:ro", image, "node", "--test", "test/worker.test.cjs", "test/shared-layout.test.cjs"] }], images: [image], timeout: "1200s" });
  console.log("Prepared isolated worker, ETL API policy and review UI.");
}
function test() {
  const prepared = read("prepared.json"); assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.source);
  assert.deepEqual(assetHashes(), prepared.assets); assert.deepEqual(fileHashes(path.join(stage, "worker")), prepared.worker);
  for (const file of ["etls.js", "service-worker.js"]) execFileSync(process.execPath, ["--check", path.join(stage, "portal", file)], { stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["--test", "etl-worker/test/shared-layout.test.cjs", "etl-worker/test/engine.test.cjs", "etl-worker/test/worker.test.cjs", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "scripts/tests/etl-pipelines.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env,
    NEXUS_PORTAL_STAGE: path.join(stage, "portal"), NEXUS_ETL_TEST_OUTPUT: path.join(stage, "browser"), NEXUS_ETL_LABEL: "ETLs", NEXUS_ETL_CHANNELS: "1", NEXUS_ETL_APPROVAL_CHECK: "1", NEXUS_ETL_MAPPING_POLICY: "1", NEXUS_ETL_SHARED: "1" } });
  assert.ok(fs.existsSync(path.join(root, ".tmp/shared-etls-20260924/validation/results.json")), "Run real-source validation first");
  save("tested.json", { ...prepared, at: new Date().toISOString(), syntheticBrowser: true });
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
  save("job.after.json", after); console.log("Worker deployed; old manifests retain their original policy.");
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
  save("function.after.json", await json(fnUrl("meridianEtl"))); console.log("API deployed; new runs pin the approved mapping policy.");
}
async function publish() {
  const tested = read("tested.json"), before = read("hosting.before.json"); assert.deepEqual(assetHashes(), tested.assets);
  assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  assert.equal((await live()).release.version.name, before.release.version.name);
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) { const bytes = zlib.gzipSync(fs.readFileSync(path.join(stage, "portal", file)), { level: 9 }), digest = hash(bytes); files["/" + file] = digest; uploads.set(digest, bytes); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest)); const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) }); await response.arrayBuffer(); assert.equal(response.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "ETLs: shared master files and transformed samples; client-aware inventory and sales setup" });
  console.log("Published " + version.name);
}
async function verify() {
  const tested = read("tested.json"), current = await live(), created = read("hosting.created.json");
  assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), tested.assets[file]); }
  const before = read("function.before.json"), after = await json(fnUrl("meridianEtl"));
  assert.equal(after.state, "ACTIVE"); assert.equal(after.serviceConfig.revision, read("function.after.json").serviceConfig.revision);
  for (const key of ["timeoutSeconds", "environmentVariables", "secretEnvironmentVariables", "maxInstanceCount", "ingressSettings", "serviceAccountEmail", "availableMemory", "availableCpu", "maxInstanceRequestConcurrency"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], key);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("function.iam.json"));
  const zip = await source(after); for (const [file, digest] of Object.entries(tested.source)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest);
  for (const [name, revision] of Object.entries(read("unchanged.json"))) assert.equal((await json(fnUrl(name))).serviceConfig.revision, revision);
  assert.deepEqual((await json(jobUrl)).template, read("job.after.json").template);
  assert.deepEqual(await json(jobUrl + ":getIamPolicy"), read("job.iam.json"));
  const response = await fetch(`https://${region}-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) }); assert.ok([401, 403].includes(response.status));
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, api: after.serviceConfig.revision, image: read("job.after.json").template.template.containers[0].image,
    otherFunctionsUnchanged: true, iamAndRuntimePreserved: true, noBusinessJobsStarted: true });
  console.log("Live shared ETL release verified. Access controls, schedules and other automation functions preserved.");
}
const actions = { audit, prepare, test, build, deployWorker, deployApi, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
