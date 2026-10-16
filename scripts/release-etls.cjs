"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), { Readable } = require("node:stream");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/etl-release-20260909"), project = "meridain-nexus", site = "meridian-nexus", region = "us-central1";
const bucket = "meridain-nexus.firebasestorage.app", worker = `nexus-inventory-etl@${project}.iam.gserviceaccount.com`, compute = "730011371323-compute@developer.gserviceaccount.com";
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260909-v1`, tag = "20260909-etls1";
const cliPath = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools");
let cli, hosting, Client;
const gc = (...args) => execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 15 * 1024 * 1024, windowsHide: true });
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
const save = (name, value) => { fs.mkdirSync(stage, { recursive: true }); fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2)); };
const normal = value => value.replace(/\r\n/g, "\n");
const canonical = value => value.replace("projects/730011371323/", `projects/${project}/`);
function replaceOnce(source, before, after) { assert.equal(source.split(before).length, 2, `Expected one integration anchor: ${before.slice(0, 110)}`); return source.replace(before, () => after); }
async function connect() {
  cli ||= require(cliPath); hosting ||= require(path.join(cliPath, "lib/hosting/api")); Client ||= require(path.join(cliPath, "lib/apiv2")).Client;
  await cli.hosting.channel.list({ project, site, nonInteractive: true }); return new Client({ urlPrefix: "https://firebasehosting.googleapis.com", apiVersion: "v1beta1", auth: true });
}
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "hosting.before.json")), "Preserve the existing release baseline.");
  const client = await connect(); const current = await hosting.getChannel(project, site, "live");
  assert.equal(current.release.version.name.split("/").at(-1), "054d98408fcbd781", "Review any newer production release first.");
  const { body } = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!body.nextPageToken);
  const before = {};
  for (const name of ["index.html", "app.js", "service-worker.js"]) {
    const response = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(response.ok); before[name] = await response.text();
  }
  save("hosting.before.json", { current, files: body.files, assets: before });
  await assemble();
  const source = path.join(stage, "api"); fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ name: "nexus-etl-api", private: true, version: "1.0.0", main: "index.js", engines: { node: "22" }, dependencies: { "firebase-admin": "13.10.0", "firebase-functions": "7.2.5", "google-auth-library": "10.7.0" }, overrides: { uuid: "11.1.1", qs: "6.16.0" } }, null, 2));
  fs.copyFileSync(path.join(root, "functions/etl-entry.js"), path.join(source, "index.js")); fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(source, "meridian-etl.js"));
  const workerDir = path.join(stage, "worker"); fs.mkdirSync(workerDir, { recursive: true });
  for (const name of ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) fs.copyFileSync(path.join(root, "etl-worker", name), path.join(workerDir, name));
  save("manifest.json", { project, site, worker, compute, image, tag, changes: ["new meridianEtl callable", "new nexus-inventory-etl job and scoped service account", "ETLs frontend only", "no existing function/rules replacement"] });
  console.log(JSON.stringify({ prepared: stage, baseline: current.release.version.name, existingFunctionsChanged: 0 }));
}
function integrateAssets(input, options = {}) {
  const assets = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, normal(value)]));
  const local = normal(fs.readFileSync(path.join(root, "public/app.js"), "utf8"));
  let app = assets["app.js"];
  const sync = local.match(/let meridianEtlSession = null;[\s\S]*?(?=function setViewFromHash\(\))/); assert.ok(sync);
  app = replaceOnce(app, "function setViewFromHash() {", `${sync[0]}function setViewFromHash() {`);
  const changes = [
    ["  document.querySelectorAll('[data-open-view=\"resources\"]').forEach((button) => { button.hidden = !hasAdminAccess; });", "  document.querySelectorAll('[data-open-view=\"resources\"]').forEach((button) => { button.hidden = !hasAdminAccess; });\n  document.querySelectorAll('[data-open-view=\"etls\"]').forEach((button) => { button.hidden = !hasAdminAccess; });"],
    ["  syncMeridianChat();\n  syncFranchiseOrders();\n  syncAttendanceJobSummaries();", "  syncMeridianChat();\n  syncFranchiseOrders();\n  syncAttendanceJobSummaries();\n  syncMeridianEtls();"],
    ['  const showResources = window.location.hash === "#resources";', '  const showResources = window.location.hash === "#resources";\n  const showEtls = window.location.hash === "#etls";'],
    ['  if (showResources && state.authResolved && state.isOperator && !state.isAdmin) {', '  if ((showResources || showEtls) && state.authResolved && state.isOperator && !state.isAdmin) {'],
    ['  if ((showFranchiseOrder || showChat || showAdmin || showResources', '  if ((showEtls || showFranchiseOrder || showChat || showAdmin || showResources'],
    ['  elements.homeView.hidden = showFranchiseOrder ||', '  elements.homeView.hidden = showEtls || showFranchiseOrder ||'],
    ['  document.getElementById("franchiseOrderView").hidden = !showFranchiseOrder;', '  document.getElementById("etlsView").hidden = !showEtls;\n  syncMeridianEtls();\n  document.getElementById("franchiseOrderView").hidden = !showFranchiseOrder;'],
    ['  const activeView = showFranchiseOrder ?', '  const activeView = showEtls ? "etls" : showFranchiseOrder ?'],
    ['  if (showAttendanceJobs) { document.title = "Job Summaries | Meridian Nexus"; elements.skipLink.href = "#attendanceJobSummaries"; }', local.match(/  if \(showAttendanceJobs\) \{ document.title[^\n]+\n  if \(showEtls\) \{[^]*?\n  \}/)[0]],
    ['  const items = [\n    { view: "franchiseorder"', '  const items = [\n    { view: "etls", markup: `<i class="ph ph-flow-arrow" aria-hidden="true"></i><span>ETLs</span>` },\n    { view: "franchiseorder"'],
    ['directButton("chat"), directButton("resources"), automation,', 'directButton("chat"), directButton("resources"), directButton("etls"), automation,'],
    ['ensureWorkspaceNavigation();\ndocument.getElementById("franchiseNavToggle")', 'ensureWorkspaceNavigation();\n' + local.match(/document.getElementById\("etlNavToggle"\).addEventListener\("click", event => \{[^]*?\n\}\);/)[0] + '\ndocument.getElementById("franchiseNavToggle")'],
    ['  else if (target === "sales") openSalesDashboard();', '  else if (target === "etls") { window.location.hash = "etls"; setViewFromHash(); }\n  else if (target === "sales") openSalesDashboard();']
  ];
  for (const [from, to] of changes) app = replaceOnce(app, from, to);
  assets["app.js"] = app;
  const localIndex = normal(fs.readFileSync(path.join(root, "public/index.html"), "utf8"));
  const shell = localIndex.match(/      <main id="etlsView"[\s\S]*?(?=      <main id="franchiseOrderView")/)[0];
  assets["index.html"] = replaceOnce(assets["index.html"], '      <main id="franchiseOrderView"', shell + '      <main id="franchiseOrderView"');
  assets["index.html"] = replaceOnce(assets["index.html"], '    <script defer src="franchise-orders.js?v=20260909-franchise-order"></script>', '    <script defer src="franchise-orders.js?v=20260909-franchise-order"></script>\n    <link rel="stylesheet" href="etls.css?v=20260909-etls1" />\n    <script defer src="etls.js?v=20260909-etls1"></script>');
  for (const name of ["index.html", "service-worker.js"]) {
    const from = `app.js?v=${options.appTagBefore || "20260909-attendance-staff-access"}`;
    assert.ok(assets[name].includes(from)); assets[name] = assets[name].replaceAll(from, `app.js?v=${options.appTagAfter || tag}`);
  }
  assets["service-worker.js"] = replaceOnce(assets["service-worker.js"], `const CACHE = "${options.cacheBefore || "meridian-nexus-v52"}";`, `const CACHE = "${options.cacheAfter || "meridian-nexus-v53"}";`);
  for (const name of ["etls.js", "etls.css"]) assets[name] = fs.readFileSync(path.join(root, "public", name), "utf8");
  return assets;
}
async function assemble() {
  const assets = integrateAssets(read("hosting.before.json").assets);
  save("hosting.assets.json", assets);
  for (const [name, content] of Object.entries(assets)) fs.writeFileSync(path.join(stage, `preview-${name}`), content);
  execFileSync(process.execPath, ["--check", path.join(stage, "preview-app.js")]);
  if (fs.existsSync(path.join(stage, "worker"))) for (const name of ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) fs.copyFileSync(path.join(root, "etl-worker", name), path.join(stage, "worker", name));
  if (fs.existsSync(path.join(stage, "api"))) { fs.copyFileSync(path.join(root, "functions/etl-entry.js"), path.join(stage, "api/index.js")); fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(stage, "api/meridian-etl.js")); fs.copyFileSync(path.join(root, "functions/admin-access.js"), path.join(stage, "api/admin-access.js")); }
}
async function infrastructure() {
  const token = gc("auth", "print-access-token").trim();
  async function get(url) { const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); if (response.status === 404) return null; if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`); return response.json(); }
  const sa = await get(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${worker}`);
  if (!sa) gc("iam", "service-accounts", "create", "nexus-inventory-etl", "--display-name=Nexus inventory ETL worker", `--project=${project}`, "--quiet");
  const repository = await get(`https://artifactregistry.googleapis.com/v1/projects/${project}/locations/${region}/repositories/nexus-etl`);
  if (!repository) gc("artifacts", "repositories", "create", "nexus-etl", "--repository-format=docker", `--location=${region}`, `--project=${project}`, "--quiet");
  const policy = JSON.parse(gc("storage", "buckets", "get-iam-policy", `gs://${bucket}`, "--format=json", `--project=${project}`));
  if (!fs.existsSync(path.join(stage, "bucket-iam.before.json"))) save("bucket-iam.before.json", policy);
  const grants = [[worker, "roles/storage.objectViewer", "etl-run-inputs/"], [worker, "roles/storage.objectAdmin", "etl-results/"], [compute, "roles/storage.objectAdmin", "etl-run-inputs/"], [compute, "roles/storage.objectViewer", "etl-results/"]];
  const updated = structuredClone(policy); updated.version = 3;
  for (const [account, role, prefix] of grants) {
    const title = `Nexus_ETL_${account === worker ? "worker" : "api"}_${prefix.replaceAll(/[^a-z]/g, "_")}`;
    const expression = `resource.name.startsWith('projects/_/buckets/${bucket}/objects/${prefix}')`;
    const existing = updated.bindings.find(b => b.condition?.title === title);
    const binding = { role, members: [`serviceAccount:${account}`], condition: { title, expression, description: "Nexus Anchor/PnP ETL only; no access outside this pipeline prefix" } };
    if (existing) assert.deepEqual(existing, binding); else updated.bindings.push(binding);
  }
  save("bucket-iam.desired.json", updated);
  if (JSON.stringify(policy) !== JSON.stringify(updated)) gc("storage", "buckets", "set-iam-policy", `gs://${bucket}`, path.join(stage, "bucket-iam.desired.json"), `--project=${project}`, "--quiet");
  const after = JSON.parse(gc("storage", "buckets", "get-iam-policy", `gs://${bucket}`, "--format=json", `--project=${project}`));
  for (const binding of policy.bindings) assert.ok(after.bindings.some(b => JSON.stringify(b) === JSON.stringify(binding)), "An existing IAM binding changed");
  save("bucket-iam.after.json", after); console.log("ETL-only identities and prefix grants configured; existing bucket grants preserved.");
}
async function build() {
  console.log("Building the isolated ETL worker image");
  fs.writeFileSync(path.join(stage, "build.json"), gc("builds", "submit", path.join(stage, "worker"), `--tag=${image}`, `--project=${project}`, `--region=${region}`, "--format=json", "--quiet"));
}
async function deployJob() {
  fs.writeFileSync(path.join(stage, "job.deploy.txt"), gc("run", "jobs", "deploy", "nexus-inventory-etl", `--image=${image}`, `--service-account=${worker}`, "--memory=2Gi", "--cpu=1", "--tasks=1", "--parallelism=1", "--max-retries=0", "--task-timeout=1800s", `--region=${region}`, `--project=${project}`, "--quiet"));
  gc("run", "jobs", "add-iam-policy-binding", "nexus-inventory-etl", `--member=serviceAccount:${compute}`, "--role=roles/run.jobsExecutorWithOverrides", `--region=${region}`, `--project=${project}`, "--quiet");
  save("job.after.json", JSON.parse(gc("run", "jobs", "describe", "nexus-inventory-etl", `--region=${region}`, `--project=${project}`, "--format=json")));
}
async function deployApi() {
  fs.writeFileSync(path.join(stage, "api.deploy.json"), gc("functions", "deploy", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, `--source=${path.join(stage, "api")}`, "--entry-point=meridianEtl", "--runtime=nodejs22", "--trigger-http", "--allow-unauthenticated", `--service-account=${compute}`, "--memory=512Mi", "--cpu=1", "--timeout=180s", "--max-instances=3", "--concurrency=10", "--format=json", "--quiet"));
  save("api.after.json", JSON.parse(gc("functions", "describe", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, "--format=json")));
  const response = await fetch(`https://${region}-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "history" } }) });
  const body = await response.json(); assert.equal(response.status, 401); assert.equal(body.error.status, "UNAUTHENTICATED"); save("anonymous-denial.json", body);
}
async function deployHosting() {
  assert.equal(read("api.after.json").state, "ACTIVE"); assert.ok(read("job.after.json"));
  const before = read("hosting.before.json"), assets = read("hosting.assets.json"), client = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(before.current.release.version.name), "Live hosting changed; review before deploying.");
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) { const gzip = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(gzip).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, gzip); }
  const version = await hosting.createVersion(site, { config: current.release.version.config }); save("hosting.created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const result = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); result.body.resume(); assert.equal(result.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" });
  assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(current.release.version.name));
  await hosting.createRelease(site, "live", version, { message: "Add admin-only Anchor/PnP ETLs: background jobs, canonical mapping, reconciliation and controlled output approval" });
  console.log(JSON.stringify({ released: version }));
}
async function verify() {
  const client = await connect(), created = read("hosting.created.json"), current = await hosting.getChannel(project, site, "live");
  assert.equal(canonical(current.release.version.name), canonical(created.version));
  const { body } = await client.get(`/${created.version}/files`, { queryParams: { pageSize: 1000 } });
  assert.deepEqual(Object.fromEntries(body.files.map(f => [f.path, f.hash])), created.files);
  for (const [name, expected] of Object.entries(read("hosting.assets.json"))) {
    let matched = false;
    for (let attempt = 0; attempt < 12; attempt++) { const response = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (response.ok && await response.text() === expected) { matched = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(matched, `Not yet propagated: ${name}`);
  }
  const result = { hosting: created.version, apiRevision: read("api.after.json").serviceConfig.revision, worker, tag, verifiedAt: new Date().toISOString(), preservedAssets: read("hosting.before.json").files.filter(f => !Object.hasOwn(read("hosting.assets.json"), f.path.slice(1))).length };
  save("verified.json", result); console.log(JSON.stringify(result));
}
const actions = { prepare, assemble, infrastructure, build, deployJob, deployApi, deployHosting, verify };
if (require.main === module) { assert.ok(actions[process.argv[2]], "Select a release phase"); actions[process.argv[2]]().catch(error => { console.error(error.stack); process.exitCode = 1; }); }
module.exports = { stage, gc, save, read, root, project, bucket, integrateAssets };
