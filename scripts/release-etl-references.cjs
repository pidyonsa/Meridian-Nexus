"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { execFileSync } = require("node:child_process"), { Readable } = require("node:stream");
const { connect } = require("./release-chat-etl-portal.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/etl-references-20260910"), portal = path.join(stage, "portal");
const project = "meridain-nexus", site = "meridian-nexus", region = "us-central1", tag = "20260910-shared-files";
const image = `${region}-docker.pkg.dev/${project}/nexus-etl/worker:${tag}`;
const read = p => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"), json = name => JSON.parse(read(path.join(stage, name)));
const save = (name, value) => fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2));
const canonical = value => value.replace("projects/730011371323/", `projects/${project}/`);
function once(s, from, to) { assert.equal(s.split(from).length, 2, `Ambiguous anchor ${from.slice(0, 80)}`); return s.replace(from, () => to); }
async function prepare() {
  assert.ok(!fs.existsSync(path.join(stage, "before.json")), "Preserve the staged baseline."); fs.mkdirSync(portal, { recursive: true });
  const { hosting, client } = await connect(), current = await hosting.getChannel(project, site, "live");
  assert.equal(current.release.version.name.split("/").at(-1), "63396e1623332313", "Review a changed production baseline first.");
  const listed = await client.get(`/${current.release.version.name}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!listed.body.nextPageToken);
  save("before.json", { current, files: listed.body.files });
  const assets = {};
  for (const name of ["app.js", "index.html", "service-worker.js"]) {
    const r = await fetch(`https://${site}.web.app/${name}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(r.ok);
    assets[name] = (await r.text()).replace(/\r\n/g, "\n"); fs.writeFileSync(path.join(stage, `before-${name}`), assets[name]);
  }
  save("api.before.json", JSON.parse(gc("functions", "describe", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, "--format=json")));
  assert.equal(json("api.before.json").serviceConfig.revision, "meridianetl-00002-sux");
  save("job.before.json", JSON.parse(gc("run", "jobs", "describe", "nexus-inventory-etl", `--region=${region}`, `--project=${project}`, "--format=json")));
  const local = read(path.join(root, "public/app.js"));
  const block = local.match(/let etlReferenceSession = null;[^]*?(?=function syncMeridianEtls\(\))/)?.[0]; assert.ok(block);
  assets["app.js"] = once(assets["app.js"], "function syncMeridianEtls() {", `${block}function syncMeridianEtls() {\n  syncEtlReferenceFiles();`);
  assets["app.js"] = once(assets["app.js"], "function renderPortalResources() {\n  if (!elements.resourceRows) return;", "function renderPortalResources() {\n  if (!elements.resourceRows) return;\n  etlReferenceSession?.refresh();");
  assets["index.html"] = once(assets["index.html"], '<section class="resources-workspace-grid">', '<section id="etlReferenceFiles" aria-label="Shared inventory reference files"></section>\n            <section class="resources-workspace-grid">');
  for (const name of ["index.html", "service-worker.js"]) {
    assets[name] = once(assets[name], "app.js?v=20260909-pnp-setup", `app.js?v=${tag}`);
    assets[name] = once(assets[name], "etls.js?v=20260909-no-etls", `etls.js?v=${tag}`);
    assets[name] = once(assets[name], "etls.css?v=20260909-etls1", `etls.css?v=${tag}`);
  }
  assets["index.html"] = once(assets["index.html"], `<script defer src="etls.js?v=${tag}"></script>`, `<script defer src="etls.js?v=${tag}"></script>\n    <link rel="stylesheet" href="etl-references.css?v=${tag}" />\n    <script defer src="etl-references.js?v=${tag}"></script>`);
  assets["service-worker.js"] = once(assets["service-worker.js"], "meridian-nexus-v57-pnp-setup", "meridian-nexus-v58-shared-files");
  const shell = assets["service-worker.js"].match(/const SHELL = (\[[^]*?\]);/); assert.ok(shell);
  assets["service-worker.js"] = once(assets["service-worker.js"], shell[0], `const SHELL = ${JSON.stringify([...JSON.parse(shell[1]), `/etl-references.css?v=${tag}`, `/etl-references.js?v=${tag}`])};`);
  for (const name of ["etls.js", "etls.css", "etl-references.js", "etl-references.css"]) assets[name] = read(path.join(root, "public", name));
  for (const [name, value] of Object.entries(assets)) { fs.writeFileSync(path.join(portal, name), value); if (name.endsWith(".js")) execFileSync(process.execPath, ["--check", path.join(portal, name)]); }
  save("assets.json", assets);
  const api = path.join(stage, "api"), worker = path.join(stage, "worker"); fs.mkdirSync(api); fs.mkdirSync(worker);
  for (const name of ["index.js", "admin-access.js", "package.json", "package-lock.json"]) fs.copyFileSync(path.join(root, ".tmp/etl-release-20260909/api", name), path.join(api, name));
  fs.copyFileSync(path.join(root, "functions/meridian-etl.js"), path.join(api, "meridian-etl.js"));
  for (const name of ["engine.cjs", "worker.cjs", "package.json", "package-lock.json", "Dockerfile", ".dockerignore"]) fs.copyFileSync(path.join(root, "etl-worker", name), path.join(worker, name));
  console.log(`Staged ETL references only in ${stage}`);
}
async function build() {
  execFileSync(process.execPath, ["--test", "scripts/tests/etl-api.test.cjs", "scripts/tests/etl-references.test.cjs", "etl-worker/test/engine.test.cjs"], { cwd: root, stdio: "inherit", windowsHide: true });
  fs.writeFileSync(path.join(stage, "build.json"), gc("builds", "submit", path.join(stage, "worker"), `--tag=${image}`, `--project=${project}`, `--region=${region}`, "--format=json", "--quiet"));
}
async function deploy() {
  const builds = JSON.parse(gc("builds", "list", `--project=${project}`, `--region=${region}`, "--limit=10", "--format=json"));
  const build = builds.find(b => b.images?.includes(image) && b.status === "SUCCESS"); assert.ok(build, "The ETL image must have a successful build.");
  const digest = build.results?.images?.find(i => i.name === image)?.digest; assert.match(digest || "", /^sha256:[a-f0-9]{64}$/);
  const pinnedImage = `${image.split(":")[0]}@${digest}`; save("build.verified.json", build);
  const before = json("job.before.json");
  const current = JSON.parse(gc("run", "jobs", "describe", "nexus-inventory-etl", `--region=${region}`, `--project=${project}`, "--format=json"));
  assert.deepEqual(current.spec, before.spec);
  const desiredSpec = structuredClone(before.spec); desiredSpec.template.spec.template.spec.containers[0].image = pinnedImage;
  gc("run", "jobs", "update", "nexus-inventory-etl", `--image=${pinnedImage}`, `--region=${region}`, `--project=${project}`, "--quiet");
  const afterJob = JSON.parse(gc("run", "jobs", "describe", "nexus-inventory-etl", `--region=${region}`, `--project=${project}`, "--format=json"));
  // gcloud updates operation annotations; the task configuration is otherwise identical.
  assert.deepEqual(afterJob.spec.template.spec, desiredSpec.template.spec); save("job.after.json", afterJob);
  const beforeApi = json("api.before.json");
  const currentApi = JSON.parse(gc("functions", "describe", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, "--format=json"));
  assert.equal(currentApi.serviceConfig.revision, beforeApi.serviceConfig.revision);
  gc("functions", "deploy", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, `--source=${path.join(stage, "api")}`, "--entry-point=meridianEtl", "--runtime=nodejs22", "--quiet");
  const afterApi = JSON.parse(gc("functions", "describe", "meridianEtl", "--gen2", `--region=${region}`, `--project=${project}`, "--format=json"));
  for (const k of ["serviceAccountEmail", "availableMemory", "availableCpu", "timeoutSeconds", "maxInstanceCount", "maxInstanceRequestConcurrency", "ingressSettings", "secretEnvironmentVariables", "environmentVariables"]) assert.deepEqual(afterApi.serviceConfig[k], beforeApi.serviceConfig[k], `Runtime setting changed: ${k}`);
  assert.equal(afterApi.state, "ACTIVE"); save("api.after.json", afterApi);
  const r = await fetch(`https://${region}-${project}.cloudfunctions.net/meridianEtl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { action: "catalogue" } }) }); assert.equal(r.status, 401);
  save("denied.json", { anonymous: r.status }); console.log(`ETL API ${afterApi.serviceConfig.revision} and template-capable worker deployed; no job was run.`);
}
async function publish() {
  assert.equal(json("api.after.json").state, "ACTIVE");
  const { hosting, client, Client } = await connect(), before = json("before.json"), assets = json("assets.json");
  const guard = async () => assert.equal(canonical((await hosting.getChannel(project, site, "live")).release.version.name), canonical(before.current.release.version.name)); await guard();
  execFileSync(process.execPath, ["scripts/tests/etls-browser.cjs"], { cwd: root, stdio: "inherit", windowsHide: true, env: { ...process.env, NEXUS_PORTAL_STAGE: portal, NEXUS_ETL_LABEL: "No-ETLs" } });
  const files = Object.fromEntries(before.files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const [name, content] of Object.entries(assets)) {
    assert.equal(read(path.join(portal, name)), content);
    const bytes = zlib.gzipSync(content, { level: 9 }), hash = crypto.createHash("sha256").update(bytes).digest("hex"); files[`/${name}`] = hash; uploads.set(hash, bytes);
  }
  const version = await hosting.createVersion(site, { config: before.current.release.version.config }); save("created.json", { version, files });
  const populated = await client.post(`/${version}:populateFiles`, { files }), uploader = new Client({ urlPrefix: populated.body.uploadUrl, auth: true });
  for (const hash of populated.body.uploadRequiredHashes || []) { assert.ok(uploads.has(hash)); const r = await uploader.request({ method: "POST", path: `/${hash}`, body: Readable.from([uploads.get(hash)]), resolveOnHTTPError: true, responseType: "stream" }); r.body.resume(); assert.equal(r.status, 200); }
  await hosting.updateVersion(site, version.split("/").at(-1), { status: "FINALIZED" }); await guard();
  await hosting.createRelease(site, "live", version, { message: "Resources shared inventory masters/template; raw-only No-ETLs runs; unchanged auth/sidebar and other dashboards" });
  const listed = await client.get(`/${version}/files`, { queryParams: { pageSize: 1000 } }); assert.ok(!listed.body.nextPageToken); assert.deepEqual(Object.fromEntries(listed.body.files.map(f => [f.path, f.hash])), files);
  for (const [name, content] of Object.entries(assets)) {
    let matched = false;
    for (let i = 0; i < 12; i++) { const r = await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); if (r.ok && (await r.text()).replace(/\r\n/g, "\n") === content) { matched = true; break; } await new Promise(resolve => setTimeout(resolve, 5000)); }
    assert.ok(matched, name);
  }
  save("verified.json", { version, verifiedAt: new Date().toISOString(), assets: Object.keys(assets), api: json("api.after.json").serviceConfig.revision, image, rulesChanged: 0, iamChanged: 0 }); console.log(version);
}
module.exports = { stage, gc };
const actions = { prepare, build, deploy, publish };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]], "Choose prepare/build/deploy/publish"); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
