"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createApi, REFERENCE_ROLES } = require("../../functions/meridian-etl");
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const rules = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true };
const selection = Object.fromEntries(REFERENCE_ROLES.map(r => [r, r]));
const request = data => ({ auth: { uid: "admin", token: { admin: true } }, data });
function fixture(storageError) {
  const records = new Map([["adminUsers/admin", { role: "admin" }]]), objects = new Map(), jobs = [];
  for (const role of ["raw", ...REFERENCE_ROLES, "inventorySample", "salesSample", "gln", "dcStock", "periodSales", "weekly2"]) {
    const storagePath = `portal-resources/${role}/v1.xlsx`;
    records.set(`portalResources/${role}`, { active: true, sourceName: `${role}.xlsx`, title: role, storagePath });
    objects.set(storagePath, { size: "100", generation: "1" });
  }
  const doc = key => ({ key, get: async () => ({ exists: records.has(key), data: () => records.get(key) }), update: async patch => records.set(key, { ...records.get(key), ...patch }) });
  const db = { collection: name => ({ doc: id => doc(`${name}/${id}`) }), runTransaction: async fn => fn({ get: ref => ref.get(), set: (ref, v) => records.set(ref.key, v), create: (ref, v) => { assert.ok(!records.has(ref.key)); records.set(ref.key, v); } }) };
  const bucket = { file: (path, options = {}) => ({ path, getMetadata: async () => {if(storageError)throw storageError;return [objects.get(path)];}, copy: async target => {
    assert.equal(options.generation, objects.get(path).generation, "Copy must pin the source version"); objects.set(target.path, { ...objects.get(path), metadata: {} }); return [target];
  }, save: async value => { objects.set(path, JSON.parse(value)); } }) };
  const handler = createApi({ db, bucket, HttpsError, getAuth: () => ({ getUser: async () => ({ uid: "admin", email: "admin@example.test", customClaims: { admin: true } }) }), invokeJob: async id => { jobs.push(id); return { name: "fixture-job" }; } });
  return { handler, records, objects, jobs };
}
test("reference set saves all six roles with revision and actor; rejects incomplete, duplicate or stale saves", async () => {
  const f = fixture();
  await assert.rejects(f.handler(request({ action: "saveReferences", resources: {}, revision: 0 })), { code: "invalid-argument" });
  await assert.rejects(f.handler(request({ action: "saveReferences", resources: { ...selection, dc: "stores" }, revision: 0 })), { code: "invalid-argument" });
  const result = await f.handler(request({ action: "saveReferences", resources: selection, revision: 0 }));
  assert.deepEqual(result.referenceSet.resources, selection); assert.equal(result.referenceSet.revision, 1); assert.equal(result.referenceSet.updatedBy.uid, "admin");
  await assert.rejects(f.handler(request({ action: "saveReferences", resources: selection, revision: 0 })), { code: "aborted" }); assert.equal(f.jobs.length, 0);
});

test('Storage permissions, missing workbooks and outages produce distinct errors without creating a run',async()=>{
  for(const [code,expected] of [[403,'failed-precondition'],[404,'not-found'],[503,'unavailable']]){
    const f=fixture(Object.assign(new Error('Provider response with a private path'),{code}));
    await assert.rejects(f.handler(request({action:'saveReferences',resources:selection,revision:0})),error=>error.code===expected&&!error.message.includes('private path'));
    assert.equal(f.jobs.length,0);assert.equal(f.records.has('etlReferenceSets/anchor-pnp-v1'),false);
    await assert.rejects(f.handler(request({action:'run',resources:{...selection,raw:'raw'},rules})),{code:expected});
    assert.equal([...f.records.keys()].some(k=>k.startsWith('etlRuns/')),false);
  }
});
test("raw-only runs resolve shared files and pin template; replacements affect new runs only", async () => {
  const f = fixture(); await f.handler(request({ action: "saveReferences", resources: selection, revision: 0 }));
  const data = { action: "run", resources: { raw: "raw" }, referenceRevision: 1, rules };
  const first = await f.handler(request(data));
  assert.equal(f.jobs.length, 1); assert.equal(f.objects.get(`etl-run-inputs/${first.id}/manifest.json`).inputs.template.resourceId, "template");
  assert.equal((await f.handler(request(data))).reused, true); assert.equal(f.jobs.length, 1);
  f.records.get("portalResources/products").storagePath = "portal-resources/products/v2.xlsx";
  f.objects.set("portal-resources/products/v2.xlsx", { size: "200", generation: "2" });
  const second = await f.handler(request(data)); assert.notEqual(first.id, second.id);
  assert.equal(f.objects.get(`etl-run-inputs/${first.id}/manifest.json`).inputs.products.sourceGeneration, "1");
  assert.equal(f.objects.get(`etl-run-inputs/${second.id}/manifest.json`).inputs.products.sourceGeneration, "2");
});
test("stale revisions, archived/deleted files and individual reference overrides cannot run", async () => {
  const f = fixture(); await f.handler(request({ action: "saveReferences", resources: selection, revision: 0 }));
  const data = { action: "run", resources: { raw: "raw" }, referenceRevision: 1, rules };
  await assert.rejects(f.handler(request({ ...data, referenceRevision: 0 })), { code: "failed-precondition" });
  await assert.rejects(f.handler(request({ ...data, resources: { raw: "raw", products: "other" } })), { code: "invalid-argument" });
  f.records.get("portalResources/stores").active = false;
  await assert.rejects(f.handler(request(data)), { code: "failed-precondition" });
  f.records.delete("portalResources/stores"); await assert.rejects(f.handler(request(data)), { code: "failed-precondition" }); assert.equal(f.jobs.length, 0);
});

test("new mapping policy is server-pinned and cannot reuse the legacy review run", async () => {
  const f = fixture(), crypto = require("node:crypto"), engine = require("../../etl-worker/engine.cjs");
  const inputs = Object.fromEntries(["raw", ...REFERENCE_ROLES].map(role => [role, { resourceId: role, name: `${role}.xlsx`, title: role, sourcePath: `portal-resources/${role}/v1.xlsx`, sourceGeneration: "1", size: 100 }]));
  const legacyId = crypto.createHash("sha256").update(JSON.stringify({ version: engine.VERSION, config: rules, inputs })).digest("hex").slice(0, 32);
  f.records.set(`etlRuns/${legacyId}`, { id: legacyId, status: "review" });
  const priorOutputId = crypto.createHash("sha256").update(JSON.stringify({ version: engine.VERSION, mappingPolicy: engine.ACCEPTED_MAPPING_POLICY, config: rules, inputs })).digest("hex").slice(0, 32);
  f.records.set(`etlRuns/${priorOutputId}`, { id: priorOutputId, status: "approved" });
  const data = { action: "run", resources: { raw: "raw", ...selection }, rules, mappingPolicy: "skip-all-errors", outputPolicy: "client-cannot-override" };
  const result = await f.handler(request(data));
  assert.equal(result.reused, false); assert.notEqual(result.id, legacyId);
  assert.equal(f.objects.get(`etl-run-inputs/${result.id}/manifest.json`).mappingPolicy, engine.ACCEPTED_MAPPING_POLICY);
  assert.equal(f.records.get(`etlRuns/${result.id}`).mappingPolicy, engine.ACCEPTED_MAPPING_POLICY);
  assert.equal(f.records.get(`etlRuns/${legacyId}`).status, "review");
  assert.notEqual(result.id, priorOutputId); assert.equal(f.records.get(`etlRuns/${priorOutputId}`).status, "approved");
  assert.equal(f.objects.get(`etl-run-inputs/${result.id}/manifest.json`).outputPolicy, engine.RAW_SITE_NAME_POLICY);
  assert.equal(f.records.get(`etlRuns/${result.id}`).outputPolicy, engine.RAW_SITE_NAME_POLICY);
  assert.equal((await f.handler(request(data))).reused, true); assert.equal(f.jobs.length, 1);
});
test("text sources can enter validated weekly adapters but never the XLSX inventory worker or masters", async () => {
  const f = fixture();
  f.records.get("portalResources/raw").sourceName = "weekly.txt";
  const setup = await f.handler(request({ action: "savePipeline", customer: "aQuelle", channelId: "game", kind: "Sales", reportName: "Weekly TXT", revision: 0, resources: { raw: "raw" } }));
  assert.equal(setup.pipeline.runnable, true); assert.equal(setup.pipeline.resources.raw, "raw");
  await assert.rejects(f.handler(request({ action: "run", resources: { ...selection, raw: "raw" }, rules })), { code: "failed-precondition" });
  await assert.rejects(f.handler(request({ action: "saveReferences", resources: { ...selection, products: "raw" }, revision: 0 })), { code: "failed-precondition" });
  assert.equal(f.jobs.length, 0);
});
test('shared samples replace blank template, raw-only runs pin the correct layout and trusted customer',async()=>{
  const f=fixture(),{pipelineId}=require('../../functions/etl-pipelines');
  const shared=Object.fromEntries(['products','stores','staffing','dc','status','inventorySample','salesSample'].map(r=>[r,r]));
  await f.handler(request({action:'saveReferences',resources:shared,revision:0}));
  for(const [customer,channelId,kind,sample] of [['Anchor','pnp','Inventory','inventorySample'],['Penflex','pnp','Inventory','inventorySample'],['Ethica','clicks','Sales','salesSample']]){
    const id=pipelineId(customer,channelId,kind);
    const response=await f.handler(request({action:'run',pipelineId:id,customer:'Forged client',resources:{raw:'raw'},referenceRevision:1}));
    const manifest=f.objects.get(`etl-run-inputs/${response.id}/manifest.json`);
    assert.equal(manifest.context.customer,customer);assert.equal(manifest.context.kind,kind);assert.equal(manifest.inputs.expected.resourceId,sample);assert.equal(manifest.inputs.template,undefined);
    assert.equal(manifest.context.articleStatusDefault,undefined,'Clicks status default must not affect PnP inventory or sales');
    assert.equal(f.records.get(`etlRuns/${response.id}`).client,customer);
    if(kind==='Sales'){assert.equal(manifest.inputs.dc,undefined);assert.equal(manifest.inputs.status,undefined);}
    else assert.equal(manifest.rules.salesDays,30);
  }
  assert.equal(f.jobs.length,3);assert.equal(new Set(f.jobs).size,3,'Client identity is part of the fingerprint');
  await assert.rejects(f.handler(request({action:'saveReferences',revision:1,resources:selection})),{code:'failed-precondition'});
  await assert.rejects(f.handler(request({action:'run',pipelineId:'anchor-spar-v1',resources:{raw:'raw'},referenceRevision:1})),{code:'failed-precondition'});
});

test('feedback adapters pin multiple raw inputs and month, inherit optional GLN, reject invalid choices',async()=>{
  const f=fixture(),{pipelineId}=require('../../functions/etl-pipelines');
  const shared=Object.fromEntries(['products','stores','staffing','dc','status','inventorySample','salesSample','gln'].map(r=>[r,r]));
  await f.handler(request({action:'saveReferences',resources:shared,revision:0}));
  f.records.get('portalResources/raw').sourceName='week1.txt';
  f.records.get('portalResources/weekly2').sourceName='week2.csv';
  const data={action:'run',pipelineId:pipelineId('aQuelle','game','Sales'),resources:{raw:['raw','weekly2']},reportMonth:'2026-07',referenceRevision:1};
  for(const resources of [{raw:[]},{raw:['raw','raw']},{raw:Array(13).fill('raw')},{raw:[['raw']]}]) await assert.rejects(f.handler(request({...data,resources})),{code:'invalid-argument'});
  for(const reportMonth of ['',null,'July 2026','2026-13','../2026-07'])await assert.rejects(f.handler(request({...data,reportMonth})),{code:'invalid-argument'});
  const first=await f.handler(request(data)), manifest=f.objects.get(`etl-run-inputs/${first.id}/manifest.json`);
  assert.equal(manifest.context.reportMonth,'2026-07'); assert.equal(manifest.inputs.raw.path,`etl-run-inputs/${first.id}/raw.txt`);assert.equal(manifest.inputs.raw2.path,`etl-run-inputs/${first.id}/raw2.csv`);
  assert.equal(manifest.inputs.gln,undefined);assert.equal(manifest.inputs.expected.resourceId,'salesSample');
  const another=await f.handler(request({...data,reportMonth:'2026-08'}));assert.notEqual(first.id,another.id);
  f.records.get('portalResources/raw').sourceName='raw.xlsx';
  const stock=await f.handler(request({action:'run',pipelineId:pipelineId('Ethica','clicks','Inventory'),referenceRevision:1,resources:{raw:'raw',dcStock:'dcStock',periodSales:'periodSales'}}));
  const stockManifest=f.objects.get(`etl-run-inputs/${stock.id}/manifest.json`);assert.ok(stockManifest.inputs.dcStock);assert.ok(stockManifest.inputs.periodSales);assert.equal(stockManifest.inputs.status,undefined);assert.equal(stockManifest.rules.salesBasis,'measured');
  assert.equal(stockManifest.context.articleStatusDefault,'Active');
  const oldContext={...stockManifest.context};delete oldContext.articleStatusDefault;
  const oldInputs=Object.fromEntries(Object.entries(stockManifest.inputs).map(([role,value])=>{const {path,generation,...source}=value;return [role,source];}));
  const oldFingerprint=require('node:crypto').createHash('sha256').update(JSON.stringify({version:stockManifest.version,mappingPolicy:stockManifest.mappingPolicy,outputPolicy:stockManifest.outputPolicy,context:oldContext,config:stockManifest.rules,inputs:oldInputs})).digest('hex');
  assert.notEqual(stock.id,oldFingerprint.slice(0,32),'New default cannot reuse an earlier blank-status result');
  const repeated=await f.handler(request({action:'run',pipelineId:pipelineId('Ethica','clicks','Inventory'),referenceRevision:1,resources:{raw:'raw',dcStock:'dcStock',periodSales:'periodSales'},articleStatusDefault:'Inactive',rules:{articleStatus:'Inactive'}}));
  assert.equal(repeated.id,stock.id);assert.equal(repeated.reused,true,'Default is server-owned and identical current runs are still deduplicated');
  await assert.rejects(f.handler(request({action:'run',pipelineId:pipelineId('Ethica','clicks','Inventory'),referenceRevision:1,resources:{raw:'raw'}})),{code:'invalid-argument'});
  const shoprite=await f.handler(request({action:'run',pipelineId:pipelineId('Saldanha','shoprite','Sales'),referenceRevision:1,reportMonth:'2026-07',resources:{raw:'raw'}}));
  assert.equal(f.objects.get(`etl-run-inputs/${shoprite.id}/manifest.json`).inputs.gln.resourceId,'gln');
  const withoutGln={...shared};delete withoutGln.gln;
  await f.handler(request({action:'saveReferences',resources:withoutGln,revision:1}));assert.equal(f.records.get('etlReferenceSets/anchor-pnp-v1').resources.gln,'gln','Old Resources client cannot erase optional GLN');
  await f.handler(request({action:'saveReferences',resources:{...shared,gln:''},revision:2}));
  await assert.rejects(f.handler(request({action:'run',pipelineId:pipelineId('Saldanha','shoprite','Sales'),referenceRevision:3,reportMonth:'2026-07',resources:{raw:'raw'}})),{code:'failed-precondition'});
});
