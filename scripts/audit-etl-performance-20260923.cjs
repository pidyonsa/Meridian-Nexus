"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const { json, api, fnUrl, hash } = require("./release-multi-admin.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const Zip = require("../functions/node_modules/jszip");
const project = "meridain-nexus", stage = path.resolve(__dirname, "../.tmp/etl-performance-20260923");
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const unpack = doc => ({ id: doc.name.split("/").at(-1), ...decode({ mapValue: { fields: doc.fields || {} } }) });
function save(name, data) { const target = path.join(stage, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2), { flag: "wx" }); }
async function status() {
  const fields = ["id", "status", "pipelineId", "createdAt", "startedAt", "completedAt", "updatedAt", "error", "execution", "totals", "retryOf", "sourceName"];
  const runs = (await json(base + ":runQuery", "POST", { structuredQuery: { from: [{ collectionId: "etlRuns" }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }], limit: 50 } })).filter(item => item.document).map(item => unpack(item.document));
  const job = await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`);
  const executions = await json(`https://run.googleapis.com/v2/${job.name}/executions?pageSize=30`);
  const logItems = []; let token;
  for (let page = 0; page < 30; page++) {
    const logs = await json("https://logging.googleapis.com/v2/entries:list", "POST", { resourceNames: [`projects/${project}`], filter: 'timestamp >= "2026-09-23T00:00:00Z" AND (resource.labels.service_name="meridianetl" OR resource.labels.job_name="nexus-inventory-etl")', orderBy: "timestamp desc", pageSize: 200, ...(token ? { pageToken: token } : {}) });
    logItems.push(...(logs.entries || []).map(e => ({ at: e.timestamp, severity: e.severity, service: e.resource?.labels?.service_name || e.resource?.labels?.job_name, execution: e.labels?.["run.googleapis.com/execution_name"], status: e.httpRequest?.status, latency: e.httpRequest?.latency, message: String(e.jsonPayload?.message || e.jsonPayload?.error || e.textPayload || "").slice(0, 1500) })));
    token = logs.nextPageToken; if (!token) break;
  }
  const report = { at: new Date().toISOString(), runs, job: { template: job.template, latest: job.latestCreatedExecution }, executions: executions.executions?.map(e => ({ name: e.name.split("/").at(-1), createTime: e.createTime, startTime: e.startTime, completionTime: e.completionTime, conditions: e.conditions, failedCount: e.failedCount, succeededCount: e.succeededCount })), logs: logItems, logsTruncated: !!token };
  save(`status-${Date.now()}.json`, report);
  console.log(JSON.stringify({ ...report, logs: logItems.filter(e => e.message || e.status >= 400).slice(0, 50), requestLatency: logItems.filter(e => e.latency).map(e => ({ at: e.at, latency: e.latency, status: e.status })).slice(0, 30) }, null, 2));
}
async function baseline() {
  const config = await json(fnUrl("meridianEtl")); save("function.before.json", config);
  const s = config.buildConfig.source.storageSource;
  const archive = await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue; const target = path.resolve(stage, "source", entry.name);
    assert.ok(target.startsWith(path.join(stage, "source") + path.sep)); save(path.relative(stage, target), await entry.async("nodebuffer"));
  }
  const job = await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`); save("job.before.json", job);
  save("job.iam.before.json", await json(`https://run.googleapis.com/v2/${job.name}:getIamPolicy`));
  save("function.iam.before.json", await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
  const live = await json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`); save("hosting.before.json", live);
  const manifest = await json(`https://firebasehosting.googleapis.com/v1beta1/${live.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("hosting.files.before.json", manifest);
  for (const item of manifest.files.filter(f => /^\/[^/]+\.(?:js|css|html)$/.test(f.path))) {
    const response = await fetch(`https://meridian-nexus.web.app${item.path}?audit=${Date.now()}`); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), item.hash); save("portal" + item.path, bytes);
  }
  console.log(JSON.stringify({ apiRevision: config.serviceConfig.revision, jobImage: job.template.template.containers[0].image, hosting: live.release.version.name, copiedLiveSources: true }));
}
if (require.main === module) ({ status, baseline }[process.argv[2]] || status)().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { stage, save };
