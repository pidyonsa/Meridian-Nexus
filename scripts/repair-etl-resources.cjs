const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {api,json,fnUrl,liveHosting,hash,fileHashes,source,once}=require('./release-multi-admin.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/etl-resource-repair-20260910');
const names=['savePortalResource','getPortalResourceDownload','deletePortalResource','meridianEtl'];
const bucket='meridain-nexus.firebasestorage.app';
const repairNames=['savePortalResource','meridianEtl'];
const {execFileSync}=require('node:child_process');
const save=(name,value)=>{const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'audit.json')),'Preserve the current baseline');
  const hosting=await liveHosting();save('hosting.before.json',hosting);
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);save('files.before.json',files);
  for(const file of ['app.js','index.html','service-worker.js','etls.js','etl-references.js']){const r=await fetch(`https://meridian-nexus.web.app/${file}?audit=${Date.now()}`);assert.ok(r.ok);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);save('baseline/'+file,bytes);}
  const JSZip=require('../functions/node_modules/jszip');
  for(const name of names){
    const config=await json(fnUrl(name));save(name+'.before.json',config);save(name+'.iam.json',await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    const s=config.buildConfig.source.storageSource,r=await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`),zip=await JSZip.loadAsync(await r.arrayBuffer()),dest=path.join(stage,'sources',name);
    for(const file of Object.values(zip.files)){if(file.dir)continue;const target=path.resolve(dest,file.name);assert.ok(target.startsWith(dest+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await file.async('nodebuffer'));}
    console.log(JSON.stringify({name,revision:config.serviceConfig.revision,serviceAccount:config.serviceConfig.serviceAccountEmail,bucket:JSON.parse(config.serviceConfig.environmentVariables?.FIREBASE_CONFIG||'{}').storageBucket}));
  }
  const logs=await json('https://logging.googleapis.com/v2/entries:list','POST',{resourceNames:['projects/meridain-nexus'],filter:'resource.type="cloud_run_revision" AND (resource.labels.service_name="meridianetl" OR resource.labels.service_name="saveportalresource") AND severity>=ERROR AND timestamp>="2026-09-09T00:00:00Z"',orderBy:'timestamp desc',pageSize:60});save('errors.json',logs);
  for(const entry of logs.entries||[])console.log(JSON.stringify({at:entry.timestamp,service:entry.resource?.labels?.service_name,status:entry.httpRequest?.status,error:entry.textPayload||entry.jsonPayload?.message||entry.jsonPayload}));
  save('bucket.iam.before.json',await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam?optionsRequestedPolicyVersion=3`));
  save('audit.json',{at:new Date().toISOString(),hosting:hosting.release.version.name});
}
async function repairAccess(){
  const url=`https://storage.googleapis.com/storage/v1/b/${bucket}/iam`;
  const current=await json(url+'?optionsRequestedPolicyVersion=3');
  assert.deepEqual(current,read('bucket.iam.before.json'),'Bucket policy changed; re-audit before merging');
  const binding={role:'roles/storage.objectViewer',members:['serviceAccount:730011371323-compute@developer.gserviceaccount.com'],condition:{title:'NexusPortalResourceReads',description:'Read uploaded resource workbooks for catalogue validation and private ETL snapshots only',expression:`resource.name.startsWith('projects/_/buckets/${bucket}/objects/portal-resources/')`}};
  assert.ok(!current.bindings.some(b=>b.condition?.title===binding.condition.title));
  const desired={...current,version:3,bindings:[...current.bindings,binding]};save('bucket.iam.desired.json',desired);
  await json(url,'PUT',desired);
  const after=await json(url+'?optionsRequestedPolicyVersion=3');
  assert.deepEqual(normalPolicy(after),normalPolicy(desired));save('bucket.iam.after.json',after);
  console.log('Read-only access restored to portal-resources/ for the Nexus compute service account. All other bindings preserved.');
}
const normalPolicy=p=>p.bindings.map(b=>JSON.stringify({role:b.role,members:[...b.members].sort(),condition:b.condition?{expression:b.condition.expression,title:b.condition.title,description:b.condition.description}:undefined})).sort();
async function verifyAccess(){const after=await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam?optionsRequestedPolicyVersion=3`);assert.deepEqual(normalPolicy(after),normalPolicy(read('bucket.iam.desired.json')));save('bucket.iam.after.json',after);console.log('Verified: the only IAM change is read-only access to portal-resources/.');}
function prepare(){
  read('bucket.iam.after.json');
  for(const name of repairNames){
    const from=path.join(stage,'sources',name),dest=path.join(stage,'deploy',name);
    for(const file of Object.keys(fileHashes(from))){const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(from,file),target);}
    fs.copyFileSync(path.join(root,'functions/resource-storage-error.js'),path.join(dest,'resource-storage-error.js'));
    if(name==='meridianEtl')fs.copyFileSync(path.join(root,'functions/meridian-etl.js'),path.join(dest,'meridian-etl.js'));
    else{
      let index=source(path.join(dest,'index.js'));
      index=once(index,'  const [metadata] = await file.getMetadata().catch(() => {\n    throw new HttpsError("not-found", "Upload the resource file before saving it to the catalogue.");\n  });','  const [metadata] = await file.getMetadata().catch(error => {\n    throw require("./resource-storage-error").resourceStorageError(error,HttpsError,"the uploaded resource file","Upload the resource file before saving it to the catalogue.");\n  });');
      fs.writeFileSync(path.join(dest,'index.js'),index);
    }
    const before=fileHashes(from),after=fileHashes(dest);
    for(const file of Object.keys(before))if(file!==(name==='meridianEtl'?'meridian-etl.js':'index.js'))assert.equal(after[file],before[file],`Unrelated source change: ${file}`);
    execFileSync(process.execPath,['--check',path.join(dest,'index.js')],{windowsHide:true});
  }
  execFileSync(process.execPath,['--test','scripts/tests/resource-storage-error.test.cjs','scripts/tests/etl-api.test.cjs','scripts/tests/etl-references.test.cjs','etl-worker/test/engine.test.cjs'],{cwd:root,windowsHide:true,stdio:'inherit'});
  save('tested.json',{at:new Date().toISOString(),tests:26,functions:Object.fromEntries(repairNames.map(name=>[name,fileHashes(path.join(stage,'deploy',name))]))});console.log('Prepared two source-only fixes; all 26 tests passed.');
}
async function deploy(){
  const tested=read('tested.json'),JSZip=require('../functions/node_modules/jszip');
  for(const name of repairNames){
    const before=read(name+'.before.json'),current=await json(fnUrl(name));
    assert.equal(current.serviceConfig.revision,before.serviceConfig.revision,'Function revision changed; re-audit');
    const files=fileHashes(path.join(stage,'deploy',name));assert.deepEqual(files,tested.functions[name]);
    const zip=new JSZip();for(const file of Object.keys(files))zip.file(file,fs.readFileSync(path.join(stage,'deploy',name,file)));
    const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
    const response=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(response.ok);
    const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save(name+'.operation.json',operation);console.log('Building '+name);
    for(;;){const result=await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);if(result.done){save(name+'.result.json',result);assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(r=>setTimeout(r,15000));}
    const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
    for(const field of ['timeoutSeconds','environmentVariables','secretEnvironmentVariables','maxInstanceCount','minInstanceCount','ingressSettings','serviceAccountEmail','availableMemory','availableCpu','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],`Runtime changed: ${field}`);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read(name+'.iam.json'));save(name+'.after.json',after);console.log(JSON.stringify({name,revision:after.serviceConfig.revision,runtimeAndIamPreserved:true}));
  }
  assert.equal((await liveHosting()).release.version.name,read('hosting.before.json').release.version.name,'Hosting changed outside this repair');
  await verifyAccess();
}
const actions={audit,'repair-access':repairAccess,'verify-access':verifyAccess,prepare,deploy};
if(require.main===module)Promise.resolve().then(()=>actions[process.argv[2]]()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={root,stage,names,bucket,save,read};
