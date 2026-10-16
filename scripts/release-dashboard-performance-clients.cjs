'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {api,json,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),brandClient=process.argv.includes('--brand-client'),identity=process.argv.includes('--attendance-identity'),reference=process.argv.includes('--attendance-reference'),regions=process.argv.includes('--order-regions'),name='publicMeridianDashboards';
const regionalDesign=process.argv.includes('--regional-design'),missedDates=process.argv.includes('--store-missed-dates');
assert.ok([brandClient,identity,reference,regions,regionalDesign,missedDates].filter(Boolean).length<=1,'Choose one release profile');
const stage=path.join(root,missedDates?'.tmp/dashboard-store-missed-dates-20260930/function':regionalDesign?'.tmp/dashboard-regional-design-20260921/function':regions?'.tmp/dashboard-order-regions-20260921/function':reference?'.tmp/dashboard-attendance-reference-20260918/function':identity?'.tmp/dashboard-attendance-identity-20260916/function':brandClient?'.tmp/dashboard-brand-client-20260916/function':'.tmp/dashboard-performance-clients-20260916/function');
const previousPrepared=missedDates?'.tmp/dashboard-regional-design-20260921/function/prepared.json':regionalDesign?'.tmp/dashboard-order-regions-20260921/function/prepared.json':regions?'.tmp/dashboard-attendance-reference-20260918/function/prepared.json':reference?'.tmp/dashboard-attendance-identity-20260916/function/prepared.json':identity?'.tmp/dashboard-brand-client-20260916/function/prepared.json':brandClient?'.tmp/dashboard-performance-clients-20260916/function/prepared.json':'.tmp/remove-public-exclusion-list-20260916/prepared.json';
const changed=missedDates?['vendor/attendance.cjs']:regionalDesign?['service.cjs','vendor/orders.cjs','order-regional-analytics.cjs']:regions?['service.cjs','order-regions.cjs']:reference?['service.cjs','attendance-overview.cjs']:identity?['vendor/attendance.cjs']:brandClient?['product-clients.cjs']:['index.cjs','service.cjs','vendor/attendance.cjs','product-clients.cjs','report-cache.cjs'];
const save=(file,value)=>{const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));};
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));
async function prepare(){
  assert.ok(!fs.existsSync(path.join(stage,'prepared.json')),'Preserve the release baseline');
  const before=await json(fnUrl(name));save('before.json',before);
  save('iam.json',await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`));
  const source=before.buildConfig.source.storageSource;
  const zip=await Zip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
  const dest=path.join(stage,'source');
  for(const file of Object.values(zip.files)){if(file.dir)continue;const target=path.resolve(dest,file.name);assert.ok(target.startsWith(dest+path.sep));save(path.relative(stage,target),await file.async('nodebuffer'));}
  const baseline=fileHashes(dest),previous=JSON.parse(fs.readFileSync(path.join(root,previousPrepared)));
  assert.deepEqual(baseline,previous.files,'Live source changed since the last reviewed release');
  for(const file of changed)save('source/'+file,fs.readFileSync(path.join(root,'firebase-dashboards/backend',file)));
  const files=fileHashes(dest);for(const file of Object.keys(baseline))if(!changed.includes(file))assert.equal(files[file],baseline[file]);
  assert.deepEqual(Object.keys(files).filter(f=>!baseline[f]).sort(),regionalDesign?['order-regional-analytics.cjs']:regions?['order-regions.cjs']:reference?['attendance-overview.cjs']:brandClient||identity||missedDates?[]:['product-clients.cjs','report-cache.cjs']);
  save('prepared.json',{at:new Date().toISOString(),baseline,files,changed});console.log(`Prepared ${changed.length} narrowly scoped service modules; all other live code and IAM preserved.`);
}
async function deploy(){
  const before=read('before.json'),prepared=read('prepared.json');
  assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage,'source')),prepared.files);
  for(const file of changed)assert.equal(hash(fs.readFileSync(path.join(root,'firebase-dashboards/backend',file))),prepared.files[file]);
  const zip=new Zip();for(const file of Object.keys(prepared.files))zip.file(file,fs.readFileSync(path.join(stage,'source',file)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const response=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(response.ok);
  const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',operation);console.log(missedDates?'Building store missed-dates attendance engine.':regions?'Building verified Orders region mapping service.':identity?'Building reconciled attendance grouping.':brandClient?'Building Brand = Client mapping service.':'Building dashboard caching and client mapping service.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+operation.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field]);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.json'));
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; runtime, IAM, other functions and original Nexus hosting unchanged.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
