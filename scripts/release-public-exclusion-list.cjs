'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {api,json,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs');
const Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),removing=process.argv.includes('--remove-list');
const stage=path.join(root,removing?'.tmp/remove-public-exclusion-list-20260916':'.tmp/public-exclusion-list-20260916'),name='publicMeridianDashboards';
const policyUrl='https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents/geoRepAttendanceConfig/current?mask.fieldPaths=dashboardExclusions';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const save=(file,value)=>{const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));};
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));
async function prepare(){
  assert.ok(!fs.existsSync(path.join(stage,'prepared.json')),'Keep the verified source baseline');
  const before=await json(fnUrl(name));save('before.json',before);
  save('iam.json',await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`));
  const s=before.buildConfig.source.storageSource;
  const zip=await Zip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const dest=path.join(stage,'source');
  for(const file of Object.values(zip.files)){
    if(file.dir)continue;const target=path.resolve(dest,file.name);assert.ok(target.startsWith(dest+path.sep));
    save(path.relative(stage,target),await file.async('nodebuffer'));
  }
  const baseline=fileHashes(dest);
  const previous=JSON.parse(fs.readFileSync(path.join(root,removing?'.tmp/public-exclusion-list-20260916/prepared.json':'.tmp/attendance-exclusions-20260916/manifest.json')));
  assert.equal(baseline['service.cjs'],(removing?previous.files:previous.functions[name])['service.cjs'],'Live service changed since last verified release; review first');
  if(removing){
    const original=fs.readFileSync(path.join(root,'.tmp/attendance-exclusions-20260916/deploy/publicMeridianDashboards/service.cjs'),'utf8');
    assert.equal(fs.readFileSync(path.join(root,'firebase-dashboards/backend/service.cjs'),'utf8').replace(/\r\n/g,'\n'),original.replace(/\r\n/g,'\n'),'Restore list-free service while preserving exclusion filtering');
    save('policy-before.json',{canonicalHash:hash(JSON.stringify(canonical((await json(policyUrl)).fields)))});
  }
  save('source/service.cjs',fs.readFileSync(path.join(root,'firebase-dashboards/backend/service.cjs')));
  const files=fileHashes(dest);assert.deepEqual(Object.keys(files),Object.keys(baseline));
  for(const file of Object.keys(files))if(file!=='service.cjs')assert.equal(files[file],baseline[file]);
  save('prepared.json',{at:new Date().toISOString(),baseline,files,changed:['service.cjs']});
  console.log(`Prepared ${removing?'public list removal':'read-only public list'}; existing runtime, source modules and IAM preserved.`);
}
async function deploy(){
  const before=read('before.json'),prepared=read('prepared.json');
  assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision);
  assert.deepEqual(fileHashes(path.join(stage,'source')),prepared.files);
  assert.equal(hash(fs.readFileSync(path.join(root,'firebase-dashboards/backend/service.cjs'))),prepared.files['service.cjs']);
  const zip=new Zip();for(const file of Object.keys(prepared.files))zip.file(file,fs.readFileSync(path.join(stage,'source',file)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const response=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(response.ok);
  const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',operation);
  console.log(removing?'Removing public exclusion-list endpoint; attendance filtering stays active':'Building read-only exclusion-list endpoint');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+operation.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(resolve=>setTimeout(resolve,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field]);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.json'));
  save('after.json',after);console.log('Verified '+after.serviceConfig.revision+'; no IAM, rules, data or other functions changed.');
  if(removing)await verifyPolicy();
}
async function verifyPolicy(){
  assert.ok(removing);
  const doc=await json(policyUrl),fields=doc.fields,policy=fields.dashboardExclusions.mapValue.fields;
  const previous=JSON.parse(fs.readFileSync(path.join(root,'.tmp/attendance-exclusions-20260916/refresh/exclusions-applied.json')));
  assert.equal(Number(policy.revision.integerValue),previous.revision);assert.equal(policy.updatedAt.stringValue,previous.at);
  const entries=policy.entries.arrayValue.values.map(v=>{
    const f=v.mapValue.fields;assert.equal(f.enabled.booleanValue,true);
    return Object.fromEntries(['name','userCode','type','audience'].map(k=>[k,f[k].stringValue]));
  });
  assert.deepEqual(entries,previous.added);
  const canonicalHash=hash(JSON.stringify(canonical(fields)));
  if(read('policy-before.json').canonicalHash)assert.equal(canonicalHash,read('policy-before.json').canonicalHash);
  save('policy-verified.json',{at:new Date().toISOString(),revision:previous.revision,activeEntries:entries.length,unchangedSince:previous.at,canonicalHash});
  console.log('Verified all four original staff exclusions remain enabled, with unchanged revision and update time.');
}
const actions={prepare,deploy,verifyPolicy};if(!actions[process.argv[2]])throw Error('Use prepare, deploy or verifyPolicy');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
