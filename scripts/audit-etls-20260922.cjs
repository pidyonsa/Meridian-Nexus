'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const Zip = require('../functions/node_modules/jszip');
const { api, json, fnUrl } = require('./release-multi-admin.cjs');
const { decode } = require('../azure-field-dashboards/attendance-publisher/index.cjs');
const project = 'meridain-nexus';
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const dir = path.resolve(__dirname, '../.tmp/etl-repair-20260922');
const data = doc => ({ ...decode({ mapValue: { fields: doc.fields || {} } }), documentId: doc.name.split('/').at(-1) });
async function save(name, value) {
  const file = path.join(dir, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value, null, 2), { flag: 'wx' });
}
async function query(collection, fields, limit = 100) {
  const response = await json(base + ':runQuery', 'POST', { structuredQuery: {
    from: [{ collectionId: collection }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, limit
  } });
  const rows = response.filter(r => r.document).map(r => data(r.document));
  return { rows, truncated: rows.length === limit };
}
async function main() {
  const summary = { checkedAt: new Date().toISOString(), readOnly: true };
  for (const [collection, fields] of Object.entries({
    etlRuns: ['id', 'status', 'version', 'pipelineId', 'client', 'channel', 'createdAt', 'startedAt', 'completedAt', 'updatedAt', 'error', 'execution', 'totals', 'retryOf'],
    etlReferenceSets: ['revision', 'resources', 'updatedAt'],
    etlPipelineSetups: ['id', 'customer', 'channelId', 'reportName', 'resources', 'revision', 'updatedAt']
  })) {
    const result = await query(collection, fields);
    await save(collection + '.json', result);
    summary[collection] = result;
  }
  const config = await json(fnUrl('meridianEtl'));
  await save('function.before.json', config);
  summary.function = { state: config.state, revision: config.serviceConfig.revision, updatedAt: config.updateTime };
  const s = config.buildConfig.source.storageSource;
  const bytes = Buffer.from(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  await save('source.before.zip', bytes);
  const archive = await Zip.loadAsync(bytes);
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;
    const target = path.resolve(dir, 'source', entry.name);
    assert.ok(target.startsWith(path.join(dir, 'source') + path.sep), 'Invalid source archive path');
    await save(path.relative(dir, target), await entry.async('nodebuffer'));
  }
  const job = await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl`);
  await save('job.before.json', job);
  summary.job = { updatedAt: job.updateTime, conditions: job.conditions, executionCount: job.executionCount, latest: job.latestCreatedExecution };
  const executions = await json(`https://run.googleapis.com/v2/${job.name}/executions?pageSize=30`);
  await save('executions.json', executions);
  summary.executions = (executions.executions || []).map(e => ({ name: e.name.split('/').at(-1), startTime: e.startTime, completionTime: e.completionTime, conditions: e.conditions }));
  const logs = await json('https://logging.googleapis.com/v2/entries:list', 'POST', {
    resourceNames: [`projects/${project}`],
    filter: 'timestamp >= "2026-09-09T00:00:00Z" AND severity>=ERROR AND (resource.labels.service_name="meridianetl" OR resource.labels.service_name="saveportalresource" OR resource.labels.job_name="nexus-inventory-etl")',
    orderBy: 'timestamp desc', pageSize: 100
  });
  const errors = (logs.entries || []).map(e => ({ at: e.timestamp, service: e.resource?.labels?.service_name || e.resource?.labels?.job_name, status: e.httpRequest?.status, message: String(e.jsonPayload?.message || e.jsonPayload?.error || e.textPayload || '').slice(0, 1000) }));
  await save('errors.json', { errors, truncated: !!logs.nextPageToken });
  summary.errors = { count: errors.length, truncated: !!logs.nextPageToken, examples: errors.slice(0, 12) };
  const hosting = await json(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/meridian-nexus/channels/live`);
  await save('hosting.before.json', hosting);
  const files = await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);
  assert.ok(!files.nextPageToken, 'Incomplete Hosting manifest');
  await save('hosting-files.before.json', files);
  for (const name of ['etls.js', 'etls.css', 'etl-references.js', 'index.html', 'service-worker.js']) {
    const r = await fetch(`https://meridian-nexus.web.app/${name}?audit=${Date.now()}`);
    assert.ok(r.ok, name);
    const value = Buffer.from(await r.arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(zlib.gzipSync(value, { level: 9 })).digest('hex'), files.files.find(f => f.path === '/' + name)?.hash, 'Live asset/version mismatch: ' + name);
    await save('hosting/' + name, value);
  }
  summary.hosting = hosting.release.version.name;
  await save('audit.json', summary);
  console.log(JSON.stringify(summary, null, 2));
}
async function checks() {
  const summary = { checkedAt: new Date().toISOString(), readOnly: true, resources: [], errors: [] };
  const reference = data(await json(base + '/etlReferenceSets/anchor-pnp-v1'));
  for (const [role, id] of Object.entries(reference.resources)) {
    const resource = data(await json(base + '/portalResources/' + id));
    assert.ok(resource.active !== false && resource.storagePath.startsWith(`portal-resources/${id}/`));
    try {
      const meta = await json(`https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/o/${encodeURIComponent(resource.storagePath)}?fields=name,generation,size,updated`);
      summary.resources.push({ role, id, name: resource.sourceName, bytes: Number(meta.size), generation: meta.generation });
    } catch (error) {
      if (!error.message.startsWith('GET 403:')) throw error;
      summary.resources.push({ role, id, name: resource.sourceName, metadataCheck: 'Operator cannot read this private object; this does not establish a runtime access failure.' });
    }
  }
  const policy = await json('https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/iam?optionsRequestedPolicyVersion=3');
  await save('bucket-iam.before.json', policy);
  const config = JSON.parse(await fs.readFile(path.join(dir, 'function.before.json'), 'utf8'));
  await save('function-iam.before.json', await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
  await save('job-iam.before.json', await json(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl:getIamPolicy`));
  summary.runtimeStorageGrants = policy.bindings.filter(b => b.members?.includes('serviceAccount:' + config.serviceConfig.serviceAccountEmail)).map(b => ({ role: b.role, condition: b.condition?.expression }));
  let token;
  for (let page = 0; page < 30; page++) {
    const logs = await json('https://logging.googleapis.com/v2/entries:list', 'POST', {
      resourceNames: [`projects/${project}`],
      filter: 'timestamp >= "2026-09-18T00:00:00Z" AND severity>=ERROR AND (resource.labels.service_name="meridianetl" OR resource.labels.service_name="saveportalresource" OR resource.labels.job_name="nexus-inventory-etl")',
      orderBy: 'timestamp desc', pageSize: 100, ...(token ? { pageToken: token } : {})
    });
    summary.errors.push(...(logs.entries || []).map(e => ({ at: e.timestamp, service: e.resource?.labels?.service_name || e.resource?.labels?.job_name, status: e.httpRequest?.status, message: String(e.jsonPayload?.message || e.jsonPayload?.error || e.textPayload || '').slice(0, 1000) })));
    token = logs.nextPageToken;
    if (!token) break;
  }
  summary.logsTruncated = !!token;
  await save('checks.json', summary);
  console.log(JSON.stringify(summary, null, 2));
}
(process.argv[2] === 'checks' ? checks() : main()).catch(e => { console.error(e.message); process.exitCode = 1; });
