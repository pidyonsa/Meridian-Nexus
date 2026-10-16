'use strict';
// meridianEtl → Azure ETL switch-over (approved 4 October 2026).
//   deploy-code       : add etl-azure-launcher.js and the entry wiring; executor stays Google (no behaviour change)
//   executor <google|azure> : flip ETL_EXECUTOR (and the Azure settings) without changing code
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),name='meridianEtl',stage=path.join(root,'.tmp/etl-azure-cutover-20261004');
const AZURE={AZURE_TENANT_ID:'cbe83df2-b350-4dab-8d5f-f78d21fe7d27',AZURE_ETL_LAUNCHER_CLIENT_ID:'99f25773-43a8-4b36-8b08-175ab7126ed7',AZURE_ETL_JOB_ID:'/subscriptions/02b268fe-e01a-453e-b287-eec83ccc0676/resourceGroups/rg-meridian-nexus-automations/providers/Microsoft.App/jobs/job-nexus-etl'};
const save=(file,value)=>fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2));
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));
async function wait(op){for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));return;}await new Promise(r=>setTimeout(r,15000));}}
async function verify(before,after,{env}={}){
  assert.equal(after.state,'ACTIVE');
  for(const field of ['secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],field);
  if(env)assert.deepEqual(after.serviceConfig.environmentVariables,env);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.json'));
}
async function deployCode(){
  const before=await json(fnUrl(name));const saved=read('before.json');
  assert.equal(before.serviceConfig.revision,saved.serviceConfig.revision,'Live function changed since the reviewed snapshot');
  save('iam.json',await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`));
  const live=path.join(stage,'live'),baseline=fileHashes(live);
  // The live bundle's index.js is etl-entry.js; only it changes, plus the new launcher file.
  const files={...Object.fromEntries(Object.keys(baseline).map(f=>[f,fs.readFileSync(path.join(live,f))])),'index.js':fs.readFileSync(path.join(root,'functions/etl-entry.js')),'etl-azure-launcher.js':fs.readFileSync(path.join(root,'functions/etl-azure-launcher.js'))};
  for(const f of Object.keys(baseline))if(!['index.js'].includes(f))assert.equal(hash(files[f]),baseline[f]);
  for(const f of ['meridian-etl.js','etl-pipelines.js','admin-access.js','resource-storage-error.js'])assert.equal(hash(fs.readFileSync(path.join(root,'functions',f))),baseline[f],f+' differs from live');
  const zip=new Zip();for(const [f,b] of Object.entries(files))zip.file(f,b);
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('code-operation.json',op);
  console.log('Building meridianEtl with the Azure launcher (executor unchanged: Google).');await wait(op);
  const after=await json(fnUrl(name));await verify(before,after,{env:before.serviceConfig.environmentVariables});save('code-after.json',after);
  console.log(`Verified ${after.serviceConfig.revision}; executor ${after.serviceConfig.environmentVariables?.ETL_EXECUTOR||'google (default)'}; runtime and IAM unchanged.`);
}
async function executor(target){
  assert.ok(['google','azure'].includes(target),'Use executor google|azure');
  const before=await json(fnUrl(name));
  const env={...(before.serviceConfig.environmentVariables||{}),ETL_EXECUTOR:target,...(target==='azure'?AZURE:{})};
  const op=await json(`${fnUrl(name)}?updateMask=serviceConfig.environmentVariables`,'PATCH',{name:before.name,serviceConfig:{environmentVariables:env}});save(`executor-${target}-operation.json`,op);
  console.log(`Switching meridianEtl executor to ${target}.`);await wait(op);
  const after=await json(fnUrl(name));await verify(before,after,{env});save(`executor-${target}-after.json`,after);
  console.log(`Verified ${after.serviceConfig.revision}; ETL_EXECUTOR=${after.serviceConfig.environmentVariables.ETL_EXECUTOR}.`);
}
const [action,arg]=process.argv.slice(2);
const actions={'deploy-code':deployCode,executor:()=>executor(arg)};
if(!actions[action])throw Error('Use deploy-code or executor <google|azure>');
actions[action]().catch(e=>{console.error(e.stack);process.exitCode=1;});
