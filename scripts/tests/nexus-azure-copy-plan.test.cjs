'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPlan,objectDestination,target}=require('../nexus-azure-copy-plan.cjs');
const bucket='meridain-nexus.firebasestorage.app';
const object={name:'private/../file #1.xlsx',generation:'123',size:'8',md5Hash:'hash'};
function fixture() {
  return {project:'meridain-nexus',mode:'metadata-only',completedAt:'2026-09-22T00:00:00Z',at:'2026-09-22T00:00:00Z',errors:[],
    collections:[{id:'parent',rootDocuments:2}],storage:[{businessData:true,objects:1,bytes:8}],
    functions:[{name:'function',source:{storageSource:{bucket:'source',object:'file',generation:'1'}}}],
    hosting:[],runServices:[],runJobs:[],schedules:[{name:'daily',state:'ENABLED'}],retailerSchedules:[],secrets:[],authSummary:{users:2}};
}
test('plan keeps Firebase authoritative and every Azure writer disabled',()=>{
  const plan=buildPlan(fixture(),{bucket,objects:[object]});
  assert.equal(plan.source.firebaseRemainsAuthoritative,true);
  for(const key of ['schedulesEnabled','externalWritesEnabled','firebaseWritesEnabled','notificationsEnabled','productionCutover'])assert.equal(plan.target[key],false);
  assert.equal(plan.automation.schedules[0].sourceState,'ENABLED');
  assert.equal(plan.automation.schedules[0].destinationState,'disabled');
  assert.equal(plan.automation.retailerSchedulesEnabledInAzure,false);
  assert.equal(plan.portal.includesAdmin,true);assert.equal(plan.portal.azureExecutable,false);
  assert.equal(plan.database.includeAllSubcollections,true);assert.equal(plan.database.exported,false);
  assert.equal(plan.auth.passwordsCopied,false);assert.equal(plan.secrets.valuesCopied,false);
});
test('object keys preserve generations without interpreting source paths',()=>{
  const first=objectDestination(bucket,object);
  assert.match(first,/^files\/[a-f0-9]{64}\/123$/);
  assert.notEqual(first,objectDestination(bucket,{...object,generation:'124'}));
  assert.notEqual(first,objectDestination(bucket,{...object,name:'other'}));
});
test('refuses incomplete inventories and mismatched manifests',()=>{
  for(const patch of [{completedAt:null},{errors:[{step:'jobs'}]},{project:'other-project'}]) {
    assert.throws(()=>buildPlan({...fixture(),...patch},{bucket,objects:[object]}));
  }
  assert.throws(()=>buildPlan(fixture(),{bucket,objects:[]}));
  assert.throws(()=>buildPlan(fixture(),{bucket,objects:[{...object,size:'9'}]}));
});
test('refuses missing checksums, duplicate generations and unpinned sources',()=>{
  assert.throws(()=>objectDestination(bucket,{...object,md5Hash:null}));
  assert.throws(()=>objectDestination(bucket,{...object,generation:'../escape'}));
  assert.throws(()=>buildPlan(fixture(),{bucket,objects:[object,object]}));
  const input=fixture();delete input.functions[0].source.storageSource.generation;
  assert.throws(()=>buildPlan(input,{bucket,objects:[object]}));
});
test('destination does not reuse the live dashboard resource group',()=>{
  assert.equal(target.resourceGroup,'rg-meridian-nexus-copy');
  assert.equal(target.location,'southafricanorth');assert.ok(Object.isFrozen(target));
});
test('draft plans retain discovery errors and cannot pass the full-copy gate',()=>{
  const input=fixture(); input.errors=[{step:'run-jobs',region:'unavailable'}];
  const plan=buildPlan(input,{bucket,objects:[object]},{allowIncomplete:true});
  assert.equal(plan.status,'draft-incomplete-inventory');
  assert.deepEqual(plan.inventoryErrors,input.errors);
  assert.equal(plan.gates.inventoryComplete,false);
  assert.equal(plan.gates.dataTransferred,false);
});
