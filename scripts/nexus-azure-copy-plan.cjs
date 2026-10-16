'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const target = Object.freeze({
  tenant:'cbe83df2-b350-4dab-8d5f-f78d21fe7d27',
  subscription:'02b268fe-e01a-453e-b287-eec83ccc0676',
  resourceGroup:'rg-meridian-nexus-copy',location:'southafricanorth',
  mode:'isolated-copy',schedulesEnabled:false,externalWritesEnabled:false,
  firebaseWritesEnabled:false,notificationsEnabled:false,productionCutover:false
});
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function objectDestination(bucket, object) {
  assert.equal(bucket,'meridain-nexus.firebasestorage.app');
  assert.equal(typeof object.name,'string'); assert.ok(object.name.length);
  assert.match(String(object.generation),/^\d+$/);
  assert.match(String(object.size),/^\d+$/);
  assert.ok(object.md5Hash || object.crc32c,'A source checksum is required.');
  // Content names never become local paths; each generation has its own immutable key.
  return `files/${hash(bucket + '\0' + object.name)}/${object.generation}`;
}
function buildPlan(inventory, manifest, {allowIncomplete=false}={}) {
  assert.equal(inventory.project,'meridain-nexus');
  assert.equal(inventory.mode,'metadata-only');
  assert.ok(inventory.completedAt,'Inventory has not finished.');
  if(!allowIncomplete) assert.equal(inventory.errors.length,0,'Resolve inventory failures before planning a complete copy.');
  assert.equal(manifest.bucket,'meridain-nexus.firebasestorage.app');
  const destinations=new Set();
  let bytes=0n;
  const files=manifest.objects.map(object=>{
    const destination=objectDestination(manifest.bucket,object);
    assert.ok(!destinations.has(destination),'Duplicate source generation.');
    destinations.add(destination); bytes+=BigInt(object.size);
    return {source:{bucket:manifest.bucket,...object},destination};
  });
  const business=inventory.storage.find(b=>b.businessData);
  assert.equal(business.objects,files.length,'Storage manifest count mismatch.');
  assert.equal(String(business.bytes),bytes.toString(),'Storage manifest byte count mismatch.');
  const functions=inventory.functions.map(f=>{
    const source=f.source?.storageSource;
    assert.ok(source?.bucket && source.object && /^\d+$/.test(String(source.generation)),`Unpinned function source: ${f.name}`);
    return {...f,destinationState:'disabled',azureExecutable:false};
  });
  return {
    schema:1,createdAt:new Date().toISOString(),status:inventory.errors.length?'draft-incomplete-inventory':'planned-not-transferred',target,
    inventoryErrors:inventory.errors,
    source:{project:inventory.project,inventoryAt:inventory.at,inventorySha256:hash(JSON.stringify(inventory)),
      firebaseRemainsAuthoritative:true},
    database:{strategy:'managed-export-all-documents',includeAllSubcollections:true,
      rootCollections:inventory.collections.length,rootDocuments:inventory.collections.reduce((n,c)=>n+c.rootDocuments,0),
      requiresConsistentReadTime:true,exported:false,azureRuntimeDatabaseRestored:false},
    files:{objects:files.length,bytes:bytes.toString(),manifestSha256:hash(JSON.stringify(manifest)),entries:files},
    portal:{sites:inventory.hosting,includesAdmin:true,azureExecutable:false},
    automation:{functions,services:inventory.runServices,jobs:inventory.runJobs,
      schedules:inventory.schedules.map(s=>({...s,sourceState:s.state,destinationState:'disabled'})),
      retailerSchedules:inventory.retailerSchedules,retailerSchedulesEnabledInAzure:false,
      replaySourceEvents:false,dispatchSourceQueues:false},
    secrets:{references:inventory.secrets,destination:'separate-key-vault',valuesCopied:false},
    auth:{source:inventory.authSummary,passwordsCopied:false,sessionTokensCopied:false,
      entraApplicationId:'748c496f-5033-415d-9d3f-f2bb85de1d71',roleMigrationValidated:false},
    gates:{inventoryComplete:inventory.errors.length===0,temporarySourceReadAccess:false,isolatedInfrastructureDeployed:false,dataTransferred:false,
      allChecksumsVerified:false,allModulesPorted:false,adminAccessValidated:false,
      shadowAutomationsValidated:false,restoreTestPassed:false,productionCutoverApproved:false}
  };
}
async function main() {
  const input=path.resolve(process.argv[2] || '');
  assert.ok(input.startsWith(path.resolve(__dirname,'../.tmp/nexus-azure-migration')+path.sep),'Use a captured inventory directory.');
  const inventory=JSON.parse(await fs.readFile(path.join(input,'inventory.json'),'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(input,'storage-object-manifest.json'),'utf8'));
  const plan=buildPlan(inventory,manifest,{allowIncomplete:process.argv.includes('--draft')});
  const output=path.resolve(__dirname,'../.tmp/nexus-azure-copy',path.basename(input));
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
  console.log(JSON.stringify({output,target,files:plan.files.objects,bytes:plan.files.bytes,
    functions:plan.automation.functions.length,jobs:plan.automation.jobs.length,
    schedules:plan.automation.schedules.length,transferred:false}));
}
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildPlan,objectDestination,target,hash};
