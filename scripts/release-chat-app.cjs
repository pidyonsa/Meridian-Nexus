const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {api,json,fnUrl,liveHosting,hash,fileHashes,once,source}=require('./release-multi-admin.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/chat-app-20260910');
const names=['meridianChat','notifyMeridianChatMessage','deliverMeridianChatReminders'];
const assets=['app.js','index.html','service-worker.js','manifest.webmanifest','meridian-chat.js','meridian-chat.css','chat-tools.js'];
const tag='20260910-chat-app';
const changedModules=['meridian-chat.js','chat-notifications.js','chat-workflow.js','chat-activity.js'];
const {execFileSync}=require('node:child_process');
const save=(name,value)=>{const f=path.join(stage,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'audit.json')),'Preserve the captured baseline');
  const hosting=await liveHosting();save('hosting.before.json',hosting);
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);save('files.before.json',files);
  for(const name of assets){const response=await fetch(`https://meridian-nexus.web.app/${name}?baseline=${Date.now()}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+name).hash);save('baseline/'+name,bytes);}
  const JSZip=require('../functions/node_modules/jszip');
  for(const name of names){
    const config=await json(fnUrl(name));save(name+'.before.json',config);
    save(name+'.iam.json',await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    const s=config.buildConfig.source.storageSource,zip=await JSZip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    const dest=path.join(stage,'sources',name);
    for(const item of Object.values(zip.files)){if(item.dir)continue;const f=path.resolve(dest,item.name);assert.ok(f.startsWith(dest+path.sep));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,await item.async('nodebuffer'));}
    console.log(JSON.stringify({name,revision:config.serviceConfig.revision,pushConfigured:!!config.serviceConfig.environmentVariables?.CHAT_WEB_PUSH_PUBLIC_KEY}));
  }
  save('audit.json',{at:new Date().toISOString(),hosting:hosting.release.version.name});
}
function prepare(){
  read('audit.json');
  for(const name of names){
    const original=path.join(stage,'sources',name),dest=path.join(stage,'deploy',name);
    for(const file of Object.keys(fileHashes(original))){const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(original,file),target);}
    for(const file of changedModules)fs.copyFileSync(path.join(root,'functions',file),path.join(dest,file));
    const before=fileHashes(original),after=fileHashes(dest);
    for(const file of Object.keys(before))if(!changedModules.includes(file))assert.equal(after[file],before[file],`Unrelated backend change: ${file}`);
  }
  let app=source(path.join(stage,'baseline/app.js'));
  app=once(app,'let deferredInstallPrompt = null;','');
  app=once(app,'  const uid = permitted ? auth?.currentUser?.uid : null;','  const uid = permitted ? auth?.currentUser?.uid : null;\n  window.NexusComms?.sync({uid:database ? uid : null,database,call:callFunction,toast:showToast});');
  const install=app.match(/window.addEventListener\("beforeinstallprompt",[^]*?\nelements.installButton\?\.addEventListener\("click",[^]*?\n\}\);/);assert.ok(install);
  app=once(app,install[0],'elements.installButton?.addEventListener("click", () => window.NexusComms?.install());');save('portal/app.js',app);
  let html=source(path.join(stage,'baseline/index.html'));
  for(const file of ['app.js','meridian-chat.js','meridian-chat.css','chat-tools.js']){const expression=new RegExp(`${file.replace('.','\\.')}\\?v=[^"']+`,'g');assert.equal([...html.matchAll(expression)].length,1);html=html.replace(expression,`${file}?v=${tag}`);}
  const marker=`    <script defer src="chat-tools.js?v=${tag}"></script>`;
  html=once(html,marker,`${marker}\n    <link rel="stylesheet" href="nexus-comms.css?v=${tag}" />\n    <script defer src="nexus-comms.js?v=${tag}"></script>`);save('portal/index.html',html);
  for(const file of ['meridian-chat.js','meridian-chat.css','chat-tools.js','nexus-comms.js','nexus-comms.css','manifest.webmanifest'])save('portal/'+file,fs.readFileSync(path.join(root,'public',file)));
  let sw=source(path.join(root,'public/service-worker.js'));
  const baseline=source(path.join(stage,'baseline/service-worker.js'));
  assert.equal(sw.slice(0,sw.indexOf('function chatIdentity')),baseline.slice(0,baseline.indexOf('function chatIdentity')),'Unrelated worker/cache changes');
  sw=sw.replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`);
  for(const file of ['app.js','meridian-chat.js','meridian-chat.css','chat-tools.js'])sw=sw.replace(new RegExp(`/${file.replace('.','\\.')}\\?v=[^"']+`,'g'),`/${file}?v=${tag}`);
  sw=once(sw,'const SHELL = [',`const SHELL = ["/nexus-comms.js?v=${tag}","/nexus-comms.css?v=${tag}",`);save('portal/service-worker.js',sw);
  const manifest={at:new Date().toISOString(),functions:Object.fromEntries(names.map(name=>[name,fileHashes(path.join(stage,'deploy',name))])),portal:fileHashes(path.join(stage,'portal'))};save('manifest.json',manifest);
  for(const name of ['app.js','meridian-chat.js','chat-tools.js','nexus-comms.js','service-worker.js'])execFileSync(process.execPath,['--check',path.join(stage,'portal',name)],{windowsHide:true});
  console.log(JSON.stringify({prepared:true,functions:names,assets:Object.keys(manifest.portal),rulesChanged:false}));
}
function tested(){
  const manifest=read('manifest.json'),logBytes=fs.readFileSync(path.join(stage,'backend-tests.log'));
  const log=logBytes.toString(logBytes[0]===255&&logBytes[1]===254?'utf16le':'utf8');assert.ok(log.includes('pass 57'));assert.ok(log.includes('fail 0'));
  const evidence=read('browser-verified.json');assert.ok(evidence.ok);
  for(const name of names){assert.deepEqual(fileHashes(path.join(stage,'deploy',name)),manifest.functions[name]);for(const file of changedModules)assert.equal(hash(fs.readFileSync(path.join(root,'functions',file))),manifest.functions[name][file]);}
  assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest.portal);assert.deepEqual(evidence.portal,manifest.portal);
  return manifest;
}
async function deployFunctions(){
  const manifest=tested(),JSZip=require('../functions/node_modules/jszip');
  for(const name of names){
    const before=read(name+'.before.json'),current=await json(fnUrl(name));
    if(fs.existsSync(path.join(stage,name+'.after.json'))){assert.equal(current.serviceConfig.revision,read(name+'.after.json').serviceConfig.revision);continue;}
    const resultFile=path.join(stage,name+'.result.json');
    const completed=fs.existsSync(resultFile)?read(name+'.result.json'):null;
    if(completed?.done&&!completed.error&&completed.response?.serviceConfig?.revision===current.serviceConfig.revision){await checkFunction(name,before,current);continue;}
    assert.equal(current.serviceConfig.revision,before.serviceConfig.revision,'Live function changed');
    const zip=new JSZip();for(const file of Object.keys(manifest.functions[name]))zip.file(file,fs.readFileSync(path.join(stage,'deploy',name,file)));
    const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
    const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(put.ok);
    const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save(name+'.operation.json',operation);console.log('Building '+name);
    for(;;){const result=await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);if(result.done){save(name+'.result.json',result);assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(r=>setTimeout(r,15000));}
    await checkFunction(name,before,await json(fnUrl(name)));
  }
}
async function checkFunction(name,before,after){
  assert.equal(after.state,'ACTIVE');
  for(const field of ['timeoutSeconds','environmentVariables','secretEnvironmentVariables','maxInstanceCount','minInstanceCount','ingressSettings','serviceAccountEmail','availableMemory','availableCpu','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],`Runtime changed: ${field}`);
  const trigger=value=>value?{...value,eventFilters:[...(value.eventFilters||[])].sort((a,b)=>a.attribute.localeCompare(b.attribute))}:value;
  assert.deepEqual(trigger(after.eventTrigger),trigger(before.eventTrigger));assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read(name+'.iam.json'));
  save(name+'.after.json',after);console.log(JSON.stringify({deployed:name,revision:after.serviceConfig.revision,runtimeAndIamPreserved:true}));
}
async function hosting(){
  const manifest=tested(),before=read('hosting.before.json'),current=await liveHosting();assert.equal(current.release.version.name,before.release.version.name,'Live Hosting changed');
  for(const name of names)assert.equal((await json(fnUrl(name))).serviceConfig.revision,read(name+'.after.json').serviceConfig.revision);
  const files=Object.fromEntries(read('files.before.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of Object.keys(manifest.portal)){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const base='https://firebasehosting.googleapis.com/v1beta1',version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('hosting.created.json',{version,files});
  const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('hosting.after.json',await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Staff Chat unread badge, app installation and sound settings, direct tasks, checklist completion and filtered task views. Existing dashboards, permissions and automation retained.'}));await verify();
}
async function verify(){
  const manifest=read('manifest.json'),created=read('hosting.created.json'),live=await liveHosting();assert.equal(live.release.version.name.split('/').at(-1),created.version.name.split('/').at(-1));
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${live.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);assert.deepEqual(Object.fromEntries(files.files.map(f=>[f.path,f.hash])),created.files);
  for(const file of Object.keys(manifest.portal)){const response=await fetch(`https://meridian-nexus.web.app/${file}?verify=${Date.now()}`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.portal[file]);}
  const denied=await fetch('https://us-central1-meridain-nexus.cloudfunctions.net/meridianChat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{action:'activity'}})});assert.ok([401,403].includes(denied.status));
  const result={at:new Date().toISOString(),hosting:live.release.version.name,anonymousDenied:denied.status,functions:names.map(name=>read(name+'.after.json').serviceConfig.revision),assets:Object.keys(manifest.portal),rulesChanged:false,pushConfigured:!!read('meridianChat.after.json').serviceConfig.environmentVariables?.CHAT_WEB_PUSH_PUBLIC_KEY};save('verified.json',result);console.log(JSON.stringify(result));
}
const actions={audit,prepare,'deploy-functions':deployFunctions,hosting,verify};
if(require.main===module)Promise.resolve().then(()=>actions[process.argv[2]]()).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={root,stage,names,assets,save,read};
