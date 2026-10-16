const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process'),{json,liveHosting,hash,once,fileHashes,source}=require('./release-multi-admin.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/job-status-release-20260911'),base='https://firebasehosting.googleapis.com/v1beta1',tag='20260911-job-status';
const assets=['index.html','app.js','service-worker.js','job-status.js','job-status.css'];
const baseline=['index.html','app.js','service-worker.js','styles.css','meridian-support.js','meridian-support.css'];
const save=(name,value)=>{const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
const get=name=>source(path.join(stage,name));
const block=(s,re)=>{const v=s.match(re)?.[0];assert.ok(v,`Missing ${re}`);return v;};
const fn=name=>new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'before.json')),'Preserve the production baseline');
  const current=await liveHosting(),files=await json(`${base}/${current.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);save('before.json',current);save('files.json',files);
  for(const file of baseline){const response=await fetch(`https://meridian-nexus.web.app/${file}?audit=${Date.now()}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);save('baseline/'+file,bytes);}
  console.log('Captured '+current.release.version.name+'; no production changes.');
}
function prepare(){
  read('before.json');const local=source(path.join(root,'public/app.js'));let app=get('baseline/app.js');
  for(const name of ['renderExtractionRun','syncNexusNavigationAccess'])app=once(app,block(app,fn(name)),block(local,fn(name)));
  app=once(app,'async function configureAdminSession(user) {','async function configureAdminSession(user) {\n  window.NexusJobStatus?.identity(null);');
  app=once(app,'  state.isAdmin = role === "admin";','  state.isAdmin = role === "admin";\n  window.NexusJobStatus?.identity(user.uid);');
  app=once(app,'    state.extractionRunning = false;\n    elements.extractionStatus.hidden = true;','    state.extractionRunning = false;\n    window.NexusJobStatus?.update(null);');save('portal/app.js',app);
  const html=source(path.join(root,'public/index.html'));let index=get('baseline/index.html');
  const section=/<section[^\n]*id="extractionStatus"[^]*?<\/section>/;index=once(index,block(index,section),block(html,section));
  const links=block(html,/    <link rel="stylesheet" href="job-status.css[^]*?<script defer src="job-status.js[^\n]+/);index=once(index,'    <link rel="stylesheet" href="meridian-support.css',links+'\n    <link rel="stylesheet" href="meridian-support.css');
  index=index.replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`);save('portal/index.html',index);
  let sw=get('baseline/service-worker.js');sw=sw.replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`).replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`);sw=once(sw,'const SHELL = [',`const SHELL = [\n  "/job-status.js?v=${tag}",\n  "/job-status.css?v=${tag}",`);save('portal/service-worker.js',sw);
  for(const file of ['job-status.js','job-status.css'])save('portal/'+file,fs.readFileSync(path.join(root,'public',file)));
  for(const file of ['styles.css','meridian-support.js','meridian-support.css'])save('portal/'+file,fs.readFileSync(path.join(stage,'baseline',file)));
  for(const file of ['app.js','job-status.js','service-worker.js'])execFileSync(process.execPath,['--check',path.join(stage,'portal',file)],{windowsHide:true});
  save('manifest.json',fileHashes(path.join(stage,'portal')));console.log('Prepared five scoped Hosting assets; backend and security rules untouched.');
}
function tests(){
  const manifest=read('manifest.json');assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest);
  const env={...process.env,NEXUS_PORTAL_STAGE:path.join(stage,'portal'),NEXUS_JOB_STATUS_TEST:'1'};
  for(const script of ['scripts/tests/franchise-orders-browser.cjs','scripts/tests/meridian-support-browser.cjs']){const log=execFileSync(process.execPath,[script],{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:5*1024*1024});save('tests/'+path.basename(script)+'.log',log);console.log(log.slice(-1500));}
  assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest);save('tested.json',{at:new Date().toISOString(),manifest});
}
async function publish(){
  const manifest=read('manifest.json');assert.deepEqual(manifest,read('tested.json').manifest);assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest);
  const current=await liveHosting();assert.equal(current.release.version.name,read('before.json').release.version.name);
  const files=Object.fromEntries(read('files.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of assets){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('created.json',{version,files});const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('released.json',await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Collapsible job status: explicit sidebar toggle, compact non-modal panel, no dashboard reflow, no automatic reopening, and session cleanup. Backend unchanged.'}));
  assert.equal((await liveHosting()).release.version.name.split('/').at(-1),version.name.split('/').at(-1));
  const actual=await json(`${base}/${version.name}/files?pageSize=1000`);assert.ok(!actual.nextPageToken);assert.deepEqual(Object.fromEntries(actual.files.map(f=>[f.path,f.hash])),files);
  for(const file of assets){const response=await fetch(`https://meridian-nexus.web.app/${file}?verify=${Date.now()}`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest[file]);}
  save('verified.json',{at:new Date().toISOString(),version:version.name,assets});console.log('Published and verified '+version.name);
}
if(require.main===module)Promise.resolve().then(()=>({audit,prepare,tests,publish})[process.argv[2]]()).catch(error=>{console.error(error.stack);process.exitCode=1;});
