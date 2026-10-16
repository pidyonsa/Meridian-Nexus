const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {api,json,fnUrl,liveHosting,hash,fileHashes,once,source}=require('./release-multi-admin.cjs');
const JSZip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/channels-chat-20260910'),tag='20260910-channels-chat';
const names=['meridianEtl','meridianChat'],assets=['app.js','index.html','service-worker.js','etls.js','etls.css','meridian-chat.js','meridian-chat.css'];
const modules={meridianEtl:['meridian-etl.js','etl-pipelines.js'],meridianChat:['meridian-chat.js']};
const save=(file,value)=>{const target=path.join(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2));};
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'audit.json')),'Preserve the captured baseline');
  const hosting=await liveHosting();save('hosting.before.json',hosting);
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);save('files.before.json',files);
  for(const file of assets){const response=await fetch(`https://meridian-nexus.web.app/${file}?audit=${Date.now()}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);save('baseline/'+file,bytes);}
  for(const name of names){
    const config=await json(fnUrl(name));save(name+'.before.json',config);save(name+'.iam.json',await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    const s=config.buildConfig.source.storageSource,zip=await JSZip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    const dest=path.join(stage,'sources',name);
    for(const file of Object.values(zip.files)){if(file.dir)continue;const target=path.resolve(dest,file.name);assert.ok(target.startsWith(dest+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await file.async('nodebuffer'));}
    console.log(JSON.stringify({audited:name,revision:config.serviceConfig.revision}));
  }
  save('audit.json',{at:new Date().toISOString(),hosting:hosting.release.version.name});
}
function prepare(){
  read('audit.json');
  for(const name of names){
    const from=path.join(stage,'sources',name),dest=path.join(stage,'deploy',name);
    for(const file of Object.keys(fileHashes(from))){const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(from,file),target);}
    for(const file of modules[name])fs.copyFileSync(path.join(root,'functions',file),path.join(dest,file));
    const before=fileHashes(from),after=fileHashes(dest);for(const file of Object.keys(before))if(!modules[name].includes(file))assert.equal(after[file],before[file],`Unrelated source change: ${file}`);
  }
  let app=source(path.join(stage,'baseline/app.js')),local=source(path.join(root,'public/app.js'));
  for(const name of ['syncMeridianChat','syncMeridianEtls']){const re=new RegExp(`function ${name}\\(\\) \\{[^]*?\\n\\}`);assert.ok(app.match(re));assert.ok(local.match(re));app=once(app,app.match(re)[0],local.match(re)[0]);}
  app=once(app,'let meridianChatIdleTimer = null;','');
  const old='  for (const key of ["createGroups", "assignTasks", "moderateMessages"]) document.getElementById(`adminChat${key[0].toUpperCase()}${key.slice(1)}`).checked = !clientAccount && (user.chatAccess?.[key] ?? role === "admin");';
  app=once(app,old,local.split('\n').find(line=>line.includes('document.getElementById(`adminChat${key[0]')&&line.includes('.checked =')));save('portal/app.js',app);
  for(const file of ['etls.js','etls.css','meridian-chat.js','meridian-chat.css'])save('portal/'+file,fs.readFileSync(path.join(root,'public',file)));
  for(const file of ['index.html','service-worker.js']){
    let value=source(path.join(stage,'baseline',file));
    for(const asset of ['app.js','etls.js','etls.css','meridian-chat.js','meridian-chat.css']){const expression=new RegExp(`${asset.replace('.','\\.')}\\?v=[^"']+`,'g');assert.equal([...value.matchAll(expression)].length,1);value=value.replace(expression,`${asset}?v=${tag}`);}
    if(file==='service-worker.js')value=value.replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`);
    save('portal/'+file,value);
  }
  for(const file of assets.filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',path.join(stage,'portal',file)],{windowsHide:true});
  save('manifest.json',{at:new Date().toISOString(),functions:Object.fromEntries(names.map(n=>[n,fileHashes(path.join(stage,'deploy',n))])),portal:fileHashes(path.join(stage,'portal'))});
  console.log('Prepared two backend modules and seven scoped Hosting assets.');
}
function tests(){
  const r=execFileSync(process.execPath,['--test','scripts/tests/etl-pipelines.test.cjs','scripts/tests/etl-api.test.cjs','scripts/tests/etl-references.test.cjs','scripts/tests/resource-storage-error.test.cjs','etl-worker/test/engine.test.cjs'],{cwd:root,windowsHide:true,encoding:'utf8'});save('etl-tests.log',r);console.log(r);
  execFileSync(process.execPath,['scripts/tests/etls-browser.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,NEXUS_PORTAL_STAGE:path.join(stage,'portal'),NEXUS_ETL_LABEL:'No-ETLs',NEXUS_ETL_CHANNELS:'1'}});
  save('etl-tested.json',{at:new Date().toISOString(),portal:fileHashes(path.join(stage,'portal'))});
}
function verified(){
  const manifest=read('manifest.json');for(const name of names)assert.deepEqual(fileHashes(path.join(stage,'deploy',name)),manifest.functions[name]);assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest.portal);
  assert.deepEqual(read('etl-tested.json').portal,manifest.portal);assert.deepEqual(read('chat-tested.json').portal,manifest.portal);
  return manifest;
}
function chatTests(){
  for(const command of [['scripts/test-meridian-chat.cjs'],['--test','scripts/tests/chat-warm-session.test.cjs']]){
    try { const log=execFileSync(process.execPath,command,{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,NEXUS_PORTAL_STAGE:path.join(stage,'portal')}});save(command.length===1?'chat-backend-tests.log':'chat-warm-tests.log',log);console.log(log.slice(-900)); }
    catch(e){console.error(e.stdout?.toString().slice(-6000));throw e;}
  }
  execFileSync(process.execPath,['scripts/tests/chat-app-browser.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,NEXUS_CHAT_WARM:'1'}});
  save('chat-tested.json',{at:new Date().toISOString(),portal:fileHashes(path.join(stage,'portal'))});
}
async function deploy(){
  const manifest=verified();
  for(const name of names){
    const before=read(name+'.before.json');
    if(fs.existsSync(path.join(stage,name+'.after.json'))){assert.equal((await json(fnUrl(name))).serviceConfig.revision,read(name+'.after.json').serviceConfig.revision);continue;}
    assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision,'Live function changed');
    const zip=new JSZip();for(const file of Object.keys(manifest.functions[name]))zip.file(file,fs.readFileSync(path.join(stage,'deploy',name,file)));
    const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
    const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(put.ok);
    const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save(name+'.operation.json',operation);console.log('Building '+name);
    for(;;){const result=await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);if(result.done){save(name+'.result.json',result);assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(r=>setTimeout(r,15000));}
    const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');for(const key of ['timeoutSeconds','environmentVariables','secretEnvironmentVariables','maxInstanceCount','minInstanceCount','ingressSettings','serviceAccountEmail','availableMemory','availableCpu','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[key],before.serviceConfig[key],`Runtime changed: ${key}`);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read(name+'.iam.json'));save(name+'.after.json',after);console.log(JSON.stringify({name,revision:after.serviceConfig.revision}));
  }
}
async function hosting(){
  const manifest=verified(),current=await liveHosting();assert.equal(current.release.version.name,read('hosting.before.json').release.version.name);
  for(const name of names)assert.equal((await json(fnUrl(name))).serviceConfig.revision,read(name+'.after.json').serviceConfig.revision);
  const files=Object.fromEntries(read('files.before.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of assets){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const base='https://firebasehosting.googleapis.com/v1beta1',version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('hosting.created.json',{version,files});
  const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('hosting.after.json',await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Multi-channel No-ETLs setup and warm staff chat; default groups/tasks; no changes to data, rules, workers or attendance.'}));
  const live=await liveHosting();assert.equal(live.release.version.name.split('/').at(-1),version.name.split('/').at(-1));
  const published=await json(`${base}/${version.name}/files?pageSize=1000`);assert.ok(!published.nextPageToken);assert.deepEqual(Object.fromEntries(published.files.map(f=>[f.path,f.hash])),files);
  for(const file of assets){const response=await fetch(`https://meridian-nexus.web.app/${file}?verify=${Date.now()}`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.portal[file]);}
  save('verified.json',{at:new Date().toISOString(),hosting:version.name,assets,rulesChanged:false,workerChanged:false});console.log('Published and verified '+version.name);
}
const actions={audit,prepare,tests,'chat-tests':chatTests,deploy,hosting};
if(require.main===module)Promise.resolve().then(()=>actions[process.argv[2]]()).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={root,stage,save,read};
