const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {api,json,liveHosting,hash,once,fileHashes,source}=require('./release-multi-admin.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/support-release-20260911');
const project='meridain-nexus',bucket=project+'.firebasestorage.app',tag='20260911-support';
const base='https://firebasehosting.googleapis.com/v1beta1';
const indexUrl=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/supportTickets/indexes`;
const assets=['index.html','app.js','service-worker.js','meridian-support.js','meridian-support.css'];
const save=(name,value)=>{const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
const get=name=>source(path.join(stage,name));
const block=(s,re)=>{const value=s.match(re)?.[0];assert.ok(value,`Missing ${re}`);return value;};
const fn=name=>new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'before.json')),'Preserve the production baseline');
  const current=await liveHosting(),files=await json(`${base}/${current.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  save('before.json',current);save('files.json',files);
  for(const file of ['index.html','app.js','service-worker.js']){
    const response=await fetch(`https://meridian-nexus.web.app/${file}?audit=${Date.now()}`);assert.ok(response.ok);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);save('baseline/'+file,bytes);
  }
  const releases=await json(`https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=100`);assert.ok(!releases.nextPageToken);
  for(const release of releases.releases.filter(r=>/\/cloud.firestore$|\/firebase.storage\/meridain-nexus.firebasestorage.app$/.test(r.name))){
    const rules=await json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`),kind=release.name.endsWith('/cloud.firestore')?'firestore':'storage';
    assert.equal(rules.source.files.length,1);save(kind+'.before.json',{release,rules});save(kind+'.before.rules',rules.source.files[0].content);
  }
  save('iam.before.json',await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam?optionsRequestedPolicyVersion=3`));
  const functions=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions?pageSize=1000`);assert.ok(!functions.nextPageToken);
  assert.ok(!functions.functions.some(f=>/\/(meridianSupport|cleanupMeridianSupportUploads)$/.test(f.name)),'Support functions already exist; review before changing');save('functions.before.json',functions);
  save('indexes.before.json',await json(indexUrl));
  console.log('Captured live baseline '+current.release.version.name+'; no production changes.');
}
function prepare(){
  read('before.json');const local=source(path.join(root,'public/app.js'));
  let app=get('baseline/app.js');
  for(const name of ['normalUserNavigationIds','operatorCanAccessNavigation','syncNexusNavigationAccess','setViewFromHash','ensureWorkspaceNavigation','activateAdminTab'])app=once(app,block(app,fn(name)),block(local,fn(name)));
  app=once(app,block(app,/const NAVIGATION_OPTIONS = \{[^]*?\n\};/),block(local,/const NAVIGATION_OPTIONS = \{[^]*?\n\};/));
  const controller=block(local,/let supportSession = null;[^]*?\n\}\n/);
  app=once(app,'let franchiseOrderSession = null;',controller+'\nlet franchiseOrderSession = null;');
  app=once(app,'["#automation", "#chat", "#franchiseorder", "#attendance-jobs"]','["#automation", "#chat", "#support", "#franchiseorder", "#attendance-jobs"]');
  const toggle=block(local,/document.getElementById\("supportNavToggle"\).addEventListener\("click", event => \{[^]*?\n\}\);/);
  app=once(app,'ensureWorkspaceNavigation();','ensureWorkspaceNavigation();\n'+toggle);
  const handler=block(local,/  else if \(target === "support"\) \{[^\n]+/);
  app=once(app,'  else if (target === "chat")',handler+'\n  else if (target === "chat")');
  save('portal/app.js',app);
  const html=source(path.join(root,'public/index.html'));let index=get('baseline/index.html');
  const links=block(html,/    <link rel="stylesheet" href="meridian-support.css[^]*?<script defer src="meridian-support.js[^\n]+/);
  index=once(index,'    <link rel="stylesheet" href="franchise-orders.css',links+'\n    <link rel="stylesheet" href="franchise-orders.css');
  const adminButton=block(html,/[^\n]*<button data-admin-tab="support"[^\n]+/);
  const userButton=block(index,/[^\n]*<button data-admin-tab="users"[^\n]+/);index=once(index,userButton,userButton+'\n'+adminButton);
  const panel=block(html,/              <section class="admin-tab-panel" data-admin-panel="support"[^]*?<\/section>/);
  index=once(index,'              <section class="admin-tab-panel active" data-admin-panel="overview"',panel+'\n              <section class="admin-tab-panel active" data-admin-panel="overview"');
  const view=block(html,/      <main id="supportView"[^]*?<\/main>/);
  index=once(index,'      <main id="chatView"',view+'\n\n      <main id="chatView"');
  index=index.replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`);save('portal/index.html',index);
  let sw=get('baseline/service-worker.js');sw=sw.replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`).replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`);
  sw=once(sw,'const SHELL = [','const SHELL = [\n  "./meridian-support.js?v='+tag+'",\n  "./meridian-support.css?v='+tag+'",');save('portal/service-worker.js',sw);
  for(const file of ['meridian-support.js','meridian-support.css'])save('portal/'+file,fs.readFileSync(path.join(root,'public',file)));
  for(const file of ['app.js','service-worker.js','meridian-support.js'])execFileSync(process.execPath,['--check',path.join(stage,'portal',file)],{windowsHide:true});
  for(const file of ['meridian-support.js','admin-access.js','chat-media.js'])save('functions/'+file,fs.readFileSync(path.join(root,'functions',file)));
  save('functions/index.js',fs.readFileSync(path.join(root,'functions/support-entry.js')));
  save('functions/package.json',{name:'meridian-nexus-support',private:true,version:'1.0.0',main:'index.js',engines:{node:'22'},dependencies:{'firebase-admin':'14.4.0','firebase-functions':'7.3.2'}});
  save('firebase.json',{functions:[{source:'functions',codebase:'support',runtime:'nodejs22',ignore:['node_modules','.git','firebase-debug.log','firebase-debug.*.log']}]});
  save('indexes.json',JSON.parse(fs.readFileSync(path.join(root,'firestore.indexes.json'))).indexes.filter(i=>i.collectionGroup==='supportTickets'));
  save('manifest.json',{portal:fileHashes(path.join(stage,'portal')),functions:fileHashes(path.join(stage,'functions'))});
  console.log('Prepared Support-only Hosting and isolated backend assets; inspect diff before release.');
}
async function infrastructure(){
  const prior=read('iam.before.json'),current=await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam?optionsRequestedPolicyVersion=3`);
  const binding={role:'roles/storage.objectAdmin',members:['serviceAccount:730011371323-compute@developer.gserviceaccount.com'],condition:{title:'nexus-support-private-attachments',description:'Support can manage only its private ticket attachment objects',expression:`resource.name.startsWith('projects/_/buckets/${bucket}/objects/support-ticket-attachments/')`}};
  const canonical=b=>JSON.stringify([b.role,[...b.members].sort(),b.condition?.title,b.condition?.description,b.condition?.expression]);
  if(!current.bindings.some(b=>canonical(b)===canonical(binding))){
    assert.equal(current.etag,prior.etag,'Bucket IAM changed since audit');
    const policy={...current,version:3,bindings:[...current.bindings,binding]};save('iam.after.json',await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam`,'PUT',policy));
  }
  const actual=await json(`https://storage.googleapis.com/storage/v1/b/${bucket}/iam?optionsRequestedPolicyVersion=3`);
  assert.deepEqual(actual.bindings.map(canonical).sort(),[...prior.bindings,binding].map(canonical).sort());
  const fields=i=>i.fields.filter(f=>f.fieldPath!=='__name__');
  for(const index of read('indexes.json')){
    const existing=(await json(indexUrl)).indexes||[];
    if(!existing.some(i=>JSON.stringify(fields(i))===JSON.stringify(fields(index))))save('index-create-'+hash(JSON.stringify(index)).slice(0,8)+'.json',await json(indexUrl,'POST',{queryScope:'COLLECTION',fields:index.fields}));
  }
  const until=Date.now()+15*60000;
  while(Date.now()<until){const result=await json(indexUrl);if(read('indexes.json').every(want=>result.indexes?.some(i=>i.state==='READY'&&JSON.stringify(fields(i))===JSON.stringify(fields(want))))){save('indexes.ready.json',result);console.log('Private attachment prefix IAM and all five indexes verified.');return;}await new Promise(r=>setTimeout(r,10000));}
  throw new Error('Indexes still building; do not publish yet.');
}
function tests(){
  prepare();const manifest=read('manifest.json');
  const env={...process.env,NEXUS_PORTAL_STAGE:path.join(stage,'portal'),SUPPORT_TEST_RULES:path.join(stage,'firestore.before.rules'),SUPPORT_FUNCTIONS_ROOT:path.join(stage,'functions')};
  for(const script of ['scripts/test-meridian-support.cjs','scripts/tests/meridian-support-browser.cjs','scripts/tests/franchise-orders-browser.cjs']){
    const log=execFileSync(process.execPath,[script],{cwd:root,encoding:'utf8',windowsHide:true,env,maxBuffer:5*1024*1024});save('tests/'+path.basename(script)+'.log',log);console.log(log.slice(-500));
  }
  assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest.portal);assert.deepEqual(fileHashes(path.join(stage,'functions')),manifest.functions);
  save('tested.json',{at:new Date().toISOString(),manifest});
}
async function verifyBackend(){
  const functions=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions?pageSize=1000`);assert.ok(!functions.nextPageToken);
  for(const before of read('functions.before.json').functions){const now=functions.functions.find(f=>f.name===before.name);assert.ok(now);assert.equal(now.serviceConfig?.revision,before.serviceConfig?.revision,'Unrelated function changed: '+before.name);}
  const added=functions.functions.filter(f=>!read('functions.before.json').functions.some(b=>b.name===f.name));assert.deepEqual(added.map(f=>f.name.split('/').at(-1)).sort(),['cleanupMeridianSupportUploads','meridianSupport']);
  const JSZip=require(path.join(root,'functions/node_modules/jszip'));
  for(const fn of added){
    assert.equal(fn.state,'ACTIVE');assert.equal(fn.labels['firebase-functions-codebase'],'support');assert.equal(fn.serviceConfig.serviceAccountEmail,'730011371323-compute@developer.gserviceaccount.com');
    const src=fn.buildConfig.source.storageSource,archive=await JSZip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${src.bucket}/o/${encodeURIComponent(src.object)}?alt=media&generation=${src.generation}`)).arrayBuffer());
    for(const [name,digest] of Object.entries(read('tested.json').manifest.functions))assert.equal(hash(await archive.file(name).async('nodebuffer')),digest,'Deployed backend source differs: '+name);
    const iam=await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`);
    if(fn.name.endsWith('/meridianSupport'))assert.ok(iam.bindings.some(b=>b.role==='roles/run.invoker'&&b.members.includes('allUsers')));
    else {assert.ok(!iam.bindings.some(b=>b.members.some(m=>m==='allUsers'||m==='allAuthenticatedUsers')));assert.ok(iam.bindings.some(b=>b.role==='roles/run.invoker'&&b.members.includes('serviceAccount:730011371323-compute@developer.gserviceaccount.com')));}
    save(fn.name.split('/').at(-1)+'.after.json',{fn,iam});
  }
  const scheduler=await json(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-central1/jobs/firebase-schedule-cleanupMeridianSupportUploads-us-central1`);assert.equal(scheduler.state,'ENABLED');assert.equal(scheduler.timeZone,'Africa/Johannesburg');save('scheduler.after.json',scheduler);
  for(const kind of ['firestore','storage']){const before=read(kind+'.before.json').release,now=await json(`https://firebaserules.googleapis.com/v1/${before.name}`);assert.equal(now.rulesetName,before.rulesetName,'Security rules changed');}
  save('backend-verified.json',{at:new Date().toISOString(),revisions:added.map(f=>f.serviceConfig.revision),unrelatedFunctionsUnchanged:true,rulesUnchanged:true});console.log('Verified deployed source, callable/scheduler IAM, runtime identity, and unchanged existing functions/rules.');
}
async function publish(){
  const manifest=read('manifest.json');assert.deepEqual(manifest,read('tested.json').manifest);assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest.portal);assert.deepEqual(fileHashes(path.join(stage,'functions')),manifest.functions);read('indexes.ready.json');read('smoke.json');read('backend-verified.json');
  const current=await liveHosting();assert.equal(current.release.version.name,read('before.json').release.version.name);
  const files=Object.fromEntries(read('files.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of assets){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('created.json',{version,files});
  const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('released.json',await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Support: staff issue tickets and private attachments; Admin queue, assignment, replies and resolution history.'}));
  assert.equal((await liveHosting()).release.version.name.split('/').at(-1),version.name.split('/').at(-1));
  const actual=await json(`${base}/${version.name}/files?pageSize=1000`);assert.ok(!actual.nextPageToken);assert.deepEqual(Object.fromEntries(actual.files.map(f=>[f.path,f.hash])),files);
  for(const file of assets){const response=await fetch(`https://meridian-nexus.web.app/${file}?verify=${Date.now()}`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest.portal[file]);}
  save('verified.json',{at:new Date().toISOString(),version:version.name,assets});console.log('Published and verified '+version.name);
}
if(require.main===module)Promise.resolve().then(()=>({audit,prepare,infrastructure,tests,verifyBackend,publish})[process.argv[2]]()).catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={stage,save,read};
