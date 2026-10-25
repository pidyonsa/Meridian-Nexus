'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {memoryFirestore, memoryStorage, NOW} = require('./helpers/memory-firestore.cjs');
const {resourceService, safeName} = require('../server/resources/service.cjs');
const {etlService} = require('../server/etl/service.cjs');
const {pipelineId, defaults} = require('../server/etl/pipelines.cjs');

const admin = {email: 'jpinto@meridiangroup.co.za', name: 'Jeorge Pinto'};
const audits = fs => [...fs.docs].filter(([k]) => k.startsWith('accessAuditLogs/')).map(([, v]) => v);

test('resources: upload then save keeps versions, replaces files, refuses to delete a shared ETL reference', async () => {
  const fs = memoryFirestore({'adminUsers/uid-jp': {email: 'jpinto@meridiangroup.co.za'}});
  const storage = memoryStorage();
  const service = resourceService({fs, storage});
  assert.equal(safeName('a/b\\c.xlsx'), 'a_b_c.xlsx');
  await assert.rejects(service.upload(admin, {name: 'x.xlsx', data: Buffer.alloc(0)}), /Choose a file/);
  const up = await service.upload(admin, {name: 'Store Master.xlsx', type: 'application/vnd.ms-excel', data: Buffer.from('v1')});
  assert.match(up.id, /^resource-/); assert.ok(up.storagePath.startsWith(`portal-resources/${up.id}/`));
  await assert.rejects(service.save(admin, up.id, {title: ''}), /name is required/);
  let r = (await service.save(admin, up.id, {title: 'Store master', category: 'Meridian Store Master', tags: ['etl-anchor-stores', 'etl-anchor-stores', ''], storagePath: up.storagePath, sourceName: up.sourceName})).resource;
  assert.equal(r.category, 'Meridian Store Master'); assert.deepEqual(r.tags, ['etl-anchor-stores']); assert.equal(r.versionCount, 1);
  assert.equal(fs.docs.get(`portalResources/${up.id}`).createdBy, 'uid-jp');
  assert.equal(audits(fs).at(-1).event, 'resource-file-replaced');
  r = (await service.save(admin, up.id, {title: 'Store master (Sept)', category: 'nonsense'})).resource;
  assert.equal(r.category, 'Other'); assert.equal(r.versionCount, 1); assert.equal(audits(fs).at(-1).event, 'resource-saved');
  for (let i = 2; i <= 14; i++) {
    const next = await service.upload(admin, {id: up.id, name: `v${i}.xlsx`, data: Buffer.from(`v${i}`)});
    r = (await service.save(admin, up.id, {title: 'Store master', storagePath: next.storagePath, sourceName: next.sourceName})).resource;
  }
  assert.equal(r.versionCount, 12); assert.equal(r.sourceName, 'v14.xlsx');
  assert.equal([...storage.objects.keys()].filter(k => k.startsWith(`portal-resources/${up.id}/`)).length, 12, 'versions beyond twelve leave Storage');
  await assert.rejects(service.save(admin, up.id, {title: 'x', storagePath: 'portal-resources/other/x.xlsx'}), /path is invalid/);
  fs.docs.set('etlReferenceSets/anchor-pnp-v1', {resources: {stores: up.id}, revision: 1});
  await assert.rejects(service.remove(admin, up.id), /shared ETL reference/);
  fs.docs.delete('etlReferenceSets/anchor-pnp-v1');
  assert.equal((await service.remove(admin, up.id)).deletedFiles, 12);
  assert.equal(fs.docs.has(`portalResources/${up.id}`), false);
  assert.equal([...storage.objects.keys()].length, 0);
});

// Shared masters and a raw export in Resources, ready for the validated Anchor / Pick n Pay pipeline.
function etlWorld({invokeJob = async id => ({name: `azure:exec-${id.slice(0, 4)}`})} = {}) {
  const seed = {'adminUsers/uid-jp': {email: 'jpinto@meridiangroup.co.za'}}, files = {};
  for (const role of ['products', 'stores', 'staffing', 'dc', 'status', 'inventorySample', 'raw', 'raw-other']) {
    seed[`portalResources/${role}`] = {title: role, sourceName: `${role}.xlsx`, storagePath: `portal-resources/${role}/1_${role}.xlsx`, active: true, size: 10};
    files[`portal-resources/${role}/1_${role}.xlsx`] = `${role} bytes`;
  }
  seed['etlReferenceSets/anchor-pnp-v1'] = {resources: {products: 'products', stores: 'stores', staffing: 'staffing', dc: 'dc', status: 'status', inventorySample: 'inventorySample'}, revision: 3};
  const fs = memoryFirestore(seed), storage = memoryStorage(files);
  const jobs = [];
  const service = etlService({fs, storage, invokeJob: async id => { jobs.push(id); return invokeJob(id); }, now: () => Date.parse(NOW)});
  return {fs, storage, service, jobs};
}
const rules = {salesDays: 30, openPO: 'unknown', bannerColumn: 'D', reportDate: 'as-of', productFamily: 'PICK N PAY CORPORATE', confirmed: true};

test('ETL run: pinned input snapshots and a manifest, then the worker job; the same inputs are reused', async () => {
  const {fs, storage, service, jobs} = etlWorld();
  await assert.rejects(service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw'}, rules, referenceRevision: 2}), /Shared reference files changed/);
  await assert.rejects(service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw'}, rules: {...rules, confirmed: false}, referenceRevision: 3}), /Confirm the sales estimate/);
  const {id, reused} = await service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw'}, rules, referenceRevision: 3});
  assert.equal(reused, false); assert.deepEqual(jobs, [id]);
  const run = fs.docs.get(`etlRuns/${id}`);
  assert.equal(run.status, 'running'); assert.equal(run.execution, `azure:exec-${id.slice(0, 4)}`); assert.deepEqual(run.createdBy, {uid: 'uid-jp', email: 'jpinto@meridiangroup.co.za'});
  assert.equal(run.resources.expected, 'inventorySample'); assert.equal(run.client, 'Anchor'); assert.equal(run.context.transformerVersion, 'pnp-inventory-v2');
  const manifest = JSON.parse(storage.objects.get(`etl-run-inputs/${id}/manifest.json`).data);
  assert.deepEqual(Object.keys(manifest.inputs).sort(), ['dc', 'expected', 'products', 'raw', 'staffing', 'status', 'stores']);
  assert.ok(storage.objects.has(`etl-run-inputs/${id}/raw.xlsx`)); assert.deepEqual(storage.objects.get(`etl-run-inputs/${id}/raw.xlsx`).metadata, {etlRun: id, etlRole: 'raw'});
  assert.deepEqual(await service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw'}, rules, referenceRevision: 3}), {id, reused: true});
  assert.equal(jobs.length, 1);
});

test('ETL run: a worker that cannot start leaves a failed run that can be retried', async () => {
  const {fs, service} = etlWorld({invokeJob: async () => { throw new Error('Azure ETL start failed (403).'); }});
  await assert.rejects(service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw-other'}, rules, referenceRevision: 3}), /could not start/);
  const [failed] = [...fs.docs].filter(([k]) => k.startsWith('etlRuns/')).map(([, v]) => v);
  assert.equal(failed.status, 'failed'); assert.match(failed.error, /403/);
  await assert.rejects(service.retry(admin, {id: failed.id}), /could not start/);
  assert.ok([...fs.docs.values()].some(v => v.retryOf === failed.id), 'the retry is its own run');
});

test('ETL detail reconciles the worker result; approval needs a clean, reconciled output; outputs download', async () => {
  const {fs, storage, service} = etlWorld();
  const {id} = await service.run(admin, {pipelineId: 'anchor-pnp-v1', resources: {raw: 'raw'}, rules, referenceRevision: 3});
  const result = {status: 'ready', reconciled: true, completedAt: NOW, asOf: '2026-10-20', totals: {inputRows: 10, readyRows: 10, exceptionRows: 0, invalidDcRows: 0}, output: {name: 'inventory.xlsx', sha256: 'abc'}, issueCounts: {}};
  await storage.upload(`etl-results/${id}/result.json`, JSON.stringify(result));
  await storage.upload(`etl-results/${id}/inventory.xlsx`, 'xlsx');
  const d = await service.detail(id);
  assert.equal(d.run.status, 'ready'); assert.equal(fs.docs.get(`etlRuns/${id}`).totals.readyRows, 10);
  await assert.rejects(service.approve(admin, {id, confirm: false}), /fully reconciled/);
  const approved = await service.approve(admin, {id, confirm: true});
  assert.equal(approved.run.status, 'approved'); assert.equal(fs.docs.get(`etlApprovals/${id}`).outputSha256, 'abc');
  const file = await service.output(admin, id, 'workbook');
  assert.equal(file.name, 'Anchor-Pick n Pay-2026-10-20-inventory.xlsx'); assert.equal(await new Response(file.body).text(), 'xlsx');
  await assert.rejects(service.output(admin, id, '../secrets'), /valid output/);
});

test('ETL pipelines and shared files: ids as before, revision checks, distinct workbooks', async () => {
  const {fs, service} = etlWorld();
  assert.equal(pipelineId('Anchor', 'pnp'), 'anchor-pnp-v1');
  assert.ok(defaults().some(p => p.customer === 'aQuelle' && p.channelId === 'game' && p.runnable && p.rawInputs[0].multiple));
  const {pipeline} = await service.savePipeline(admin, {customer: 'Acme Foods', channelId: 'spar', kind: 'Sales', reportName: 'Spar sales', notes: '', revision: 0, resources: {raw: 'raw'}});
  assert.equal(pipeline.id, pipelineId('Acme Foods', 'spar', 'Sales')); assert.equal(pipeline.runnable, false); assert.equal(pipeline.revision, 1);
  await assert.rejects(service.savePipeline(admin, {customer: 'Acme Foods', channelId: 'spar', kind: 'Sales', reportName: 'Spar sales', revision: 0}), /changed this setup/);
  await assert.rejects(service.run(admin, {pipelineId: pipeline.id, resources: {raw: 'raw'}, referenceRevision: 3}), /needs validation/);
  await assert.rejects(service.saveReferences(admin, {revision: 3, resources: {products: 'products', stores: 'products', staffing: 'staffing', dc: 'dc', status: 'status', inventorySample: 'inventorySample', salesSample: 'raw'}}), /its own workbook/);
  const saved = await service.saveReferences(admin, {revision: 3, resources: {products: 'products', stores: 'stores', staffing: 'staffing', dc: 'dc', status: 'status', inventorySample: 'inventorySample', salesSample: 'raw-other'}});
  assert.equal(saved.referenceSet.revision, 4); assert.equal(fs.docs.get('etlReferenceSets/anchor-pnp-v1').resources.salesSample, 'raw-other');
  const c = await service.catalogue();
  assert.ok(c.pipelines.some(p => p.id === pipeline.id)); assert.equal(c.resources.length, 8);
});
