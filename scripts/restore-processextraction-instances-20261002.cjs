'use strict';
// Restore processExtraction to 4 max instances: the 1 October raise to 8 was approved as temporary,
// to be reverted once Attendance was published (done 1 October). Only serviceConfig.maxInstanceCount changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,fnUrl}=require('./release-multi-admin.cjs');
const name='processExtraction',stage=path.resolve(__dirname,'../.tmp/processextraction-instances-20261002');
const save=(file,value)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2));};
async function main(){
  const before=await json(fnUrl(name));save('before.json',before);
  assert.equal(before.state,'ACTIVE');assert.equal(before.serviceConfig.maxInstanceCount,8,'Expected the temporary 8-instance setting');
  const iam=await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`);save('iam.json',iam);
  const operation=await json(`${fnUrl(name)}?updateMask=serviceConfig.maxInstanceCount`,'PATCH',{name:before.name,serviceConfig:{maxInstanceCount:4}});save('operation.json',operation);
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+operation.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));save('after.json',after);
  assert.equal(after.state,'ACTIVE');assert.equal(after.serviceConfig.maxInstanceCount,4);
  // A serviceConfig change rebuilds and stores a new source generation; its file contents were verified identical (12 files) on 2 October.
  assert.equal(after.buildConfig.source.storageSource.object,before.buildConfig.source.storageSource.object);
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],field);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),iam);
  console.log(`processExtraction max instances 8 -> 4 (${after.serviceConfig.revision}); source, runtime settings and IAM unchanged.`);
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
