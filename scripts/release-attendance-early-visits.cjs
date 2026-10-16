const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {api,json,fnUrl,liveHosting,hash,fileHashes,source}=require('./release-multi-admin.cjs');
const JSZip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/attendance-early-visits-20260910'),name='getGeoRepAttendanceDashboard';
const save=(file,value)=>{const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));};
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'audit.json')),'Preserve the captured baseline');
  const before=await json(fnUrl(name)),hosting=await liveHosting();
  save('function.before.json',before);save('hosting.before.json',hosting);
  save('iam.before.json',await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`));
  const s=before.buildConfig.source.storageSource;
  const archive=await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const dest=path.join(stage,'sources',name);
  for(const entry of Object.values(archive.files)){
    if(entry.dir)continue;
    const target=path.resolve(dest,entry.name);assert.ok(target.startsWith(dest+path.sep),'Invalid source archive path');
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await entry.async('nodebuffer'));
  }
  assert.equal(source(path.join(dest,'attendance-analytics.js')),source(path.join(root,'.tmp/attendance-analytics-20260910-v4/deploy',name,'attendance-analytics.js')),'Live attendance analytics changed; review before editing');
  save('audit.json',{at:new Date().toISOString(),revision:before.serviceConfig.revision,files:fileHashes(dest)});
  console.log(JSON.stringify({audited:name,revision:before.serviceConfig.revision,productionChanged:false}));
}
function prepare(){
  const from=path.join(stage,'sources',name),dest=path.join(stage,'deploy',name),baseline=read('audit.json').files;
  assert.deepEqual(fileHashes(from),baseline);
  for(const file of Object.keys(baseline)){
    const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(from,file),target);
  }
  fs.copyFileSync(path.join(root,'functions/attendance-analytics.js'),path.join(dest,'attendance-analytics.js'));
  const files=fileHashes(dest);assert.deepEqual(Object.keys(files),Object.keys(baseline));
  for(const file of Object.keys(files))if(file!=='attendance-analytics.js')assert.equal(files[file],baseline[file],`Unexpected change: ${file}`);
  execFileSync(process.execPath,['--check',path.join(dest,'attendance-analytics.js')],{windowsHide:true,stdio:'inherit'});
  execFileSync(process.execPath,['--test','scripts/tests/attendance-analytics.test.cjs'],{cwd:root,env:{...process.env,NEXUS_ATTENDANCE_STAGE:stage},windowsHide:true,stdio:'inherit'});
  save('tested.json',{at:new Date().toISOString(),files,changedFiles:['attendance-analytics.js'],tests:16});
  console.log('Prepared one analytics-module change; original handler and permissions preserved.');
}
async function deploy(){
  const before=read('function.before.json'),tested=read('tested.json'),dest=path.join(stage,'deploy',name);
  assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision,'Live revision changed');
  assert.deepEqual(fileHashes(dest),tested.files);assert.equal(hash(fs.readFileSync(path.join(root,'functions/attendance-analytics.js'))),tested.files['attendance-analytics.js']);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`),read('iam.before.json'));
  const zip=new JSZip();for(const file of Object.keys(tested.files))zip.file(file,fs.readFileSync(path.join(dest,file)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(put.ok,`Upload failed: ${put.status}`);
  const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',operation);console.log('Building attendance early-visit classification update');
  for(;;){
    const result=await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
    if(result.done){save('result.json',result);assert.ok(!result.error,JSON.stringify(result.error));break;}
    await new Promise(resolve=>setTimeout(resolve,15000));
  }
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['timeoutSeconds','environmentVariables','secretEnvironmentVariables','maxInstanceCount','minInstanceCount','ingressSettings','serviceAccountEmail','availableMemory','availableCpu','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],`Runtime changed: ${field}`);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.before.json'));
  assert.equal((await liveHosting()).release.version.name,read('hosting.before.json').release.version.name);
  save('function.after.json',after);console.log(JSON.stringify({deployed:name,revision:after.serviceConfig.revision,runtimeAndIamPreserved:true,hostingUnchanged:true}));
}
const actions={audit,prepare,deploy};
if(require.main===module)Promise.resolve().then(()=>actions[process.argv[2]]()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={stage,save,read};
