'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json}=require('./release-multi-admin.cjs');
const dir=path.resolve(__dirname,'../.tmp/public-dashboard-billing-recovery-20260921');
const service='projects/meridain-nexus/locations/us-central1/services/publicmeridiandashboards';
const url='https://run.googleapis.com/v2/'+service;
const save=(name,data)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(data,null,2));
async function main(){
  fs.mkdirSync(dir,{recursive:true});
  const billing=await json('https://cloudbilling.googleapis.com/v1/billingAccounts/01611A-E4D3B9-996A37');
  assert.equal(billing.open,true,'Billing must be open before restarting.');
  assert.ok(!fs.existsSync(path.join(dir,'operation.json')),'Restart already requested; poll the saved operation instead.');
  const before=await json(url),revision=await json('https://run.googleapis.com/v2/'+before.latestReadyRevision);
  const image=revision.containers?.[0]?.image;
  assert.ok(image?.includes('@sha256:'),'Pin the running image digest, never a mutable image tag.');
  save('before.json',before);save('revision-before.json',revision);
  const containers=before.template.containers.map((c,i)=>({...c,image:revision.containers[i].image}));
  const body={name:service,etag:before.etag,template:{revision:'publicmeridiandashboards-bill-'+Date.now().toString(36),annotations:{...before.template.annotations,'meridian-group.co.za/billing-recovery':new Date().toISOString()},containers}};
  save('restart-request.json',body);
  const operation=await json(url+'?updateMask=template.revision,template.annotations,template.containers','PATCH',body);
  save('operation.json',operation);
  console.log(JSON.stringify({operation:operation.name,previousRevision:before.latestReadyRevision,imagePinned:true,capacityUnchanged:true}));
  await poll();
}
async function poll(){
  let op=JSON.parse(fs.readFileSync(path.join(dir,'operation.json')));
  for(let i=0;i<60&&!op.done;i++){
    await new Promise(resolve=>setTimeout(resolve,5000));
    op=await json('https://run.googleapis.com/v2/'+op.name);
    if(i%6===0)console.log('Waiting for restarted dashboard revision...');
  }
  save('operation-result.json',op);
  assert.ok(op.done,'Restart is still pending.');assert.ok(!op.error,JSON.stringify(op.error));
  const after=await json(url),before=JSON.parse(fs.readFileSync(path.join(dir,'before.json')));
  const beforeRevision=JSON.parse(fs.readFileSync(path.join(dir,'revision-before.json')));
  const afterRevision=await json('https://run.googleapis.com/v2/'+after.latestReadyRevision);
  save('after.json',after);save('revision-after.json',afterRevision);
  assert.notEqual(after.latestReadyRevision,before.latestReadyRevision);
  for(const key of ['scaling','ingress','invokerIamDisabled','defaultUriDisabled','traffic'])assert.deepEqual(after[key],before[key],key);
  const normal=template=>{const t=structuredClone(template);delete t.annotations;delete t.revision;for(const c of t.containers)delete c.image;return t;};
  assert.deepEqual(normal(after.template),normal(before.template),'Runtime configuration must be preserved.');
  assert.deepEqual(afterRevision.containers.map(c=>c.image),beforeRevision.containers.map(c=>c.image),'Deployed code must be identical.');
  console.log(JSON.stringify({ready:after.terminalCondition?.state,revision:after.latestReadyRevision,identicalImage:true,runtimePreserved:true}));
}
(process.argv[2]==='poll'?poll():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
