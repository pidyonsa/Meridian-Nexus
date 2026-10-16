'use strict';
// Narrow release of refreshPublicFranchiseOrders: only order-workbook.cjs changes, so an R0 line
// with no product is skipped and counted instead of blocking the whole Orders publication.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {api,json,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),name='refreshPublicFranchiseOrders',changed=['order-workbook.cjs'];
const stage=path.join(root,'.tmp/orders-refresh-blank-lines-20261001/function'),local=path.join(root,'firebase-dashboards/refresh');
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
  const baseline=fileHashes(dest);
  // Every unchanged live file must equal the local reviewed source.
  for(const file of Object.keys(baseline))if(!changed.includes(file))assert.equal(hash(fs.readFileSync(path.join(local,file))),baseline[file],'Live source differs from local: '+file);
  for(const file of changed)save('source/'+file,fs.readFileSync(path.join(local,file)));
  const files=fileHashes(dest);assert.deepEqual(Object.keys(files).sort(),Object.keys(baseline).sort());
  save('prepared.json',{at:new Date().toISOString(),baseline,files,changed});console.log(`Prepared ${changed.join(', ')}; all other live code and IAM preserved.`);
}
async function deploy(){
  const before=read('before.json'),prepared=read('prepared.json');
  assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage,'source')),prepared.files);
  for(const file of changed)assert.equal(hash(fs.readFileSync(path.join(local,file))),prepared.files[file]);
  const zip=new Zip();for(const file of Object.keys(prepared.files))zip.file(file,fs.readFileSync(path.join(stage,'source',file)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const response=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(response.ok);
  const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',operation);
  console.log('Building Orders refresh with blank R0 line handling.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+operation.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field]);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.json'));
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; runtime and IAM unchanged.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
