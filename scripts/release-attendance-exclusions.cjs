'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {api,json,fnUrl,liveHosting,hash,once,source,fileHashes}=require('./release-multi-admin.cjs');
const JSZip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/attendance-exclusions-20260916');
const names=['getGeoRepAttendanceDashboard','publicMeridianDashboards'],tag='20260916-attendance-exclusions';
const assets=['index.html','app.js','service-worker.js','attendance-exclusions.js','attendance-exclusions.css'];
const save=(name,value)=>{const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
const get=name=>source(path.join(stage,name));
const hostingBase='https://firebasehosting.googleapis.com/v1beta1';
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'audit.json')),'Preserve the existing baseline');
  for(const name of names){
    const config=await json(fnUrl(name));save(`functions/${name}.before.json`,config);
    save(`functions/${name}.iam.json`,await json(`https://run.googleapis.com/v2/${config.serviceConfig.service}:getIamPolicy`));
    const s=config.buildConfig.source.storageSource;
    const zip=await JSZip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    for(const file of Object.values(zip.files)){if(file.dir)continue;const target=path.resolve(stage,'baseline-functions',name,file.name);assert.ok(target.startsWith(path.resolve(stage,'baseline-functions',name)+path.sep));save(path.relative(stage,target),await file.async('nodebuffer'));}
  }
  const hosting=await liveHosting(),files=await json(`${hostingBase}/${hosting.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  save('hosting.before.json',hosting);save('hosting.files.json',files);
  for(const name of assets.slice(0,3)){
    const response=await fetch(`https://meridian-nexus.web.app/${name}?audit=${Date.now()}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+name)?.hash);save('baseline/'+name,bytes);
  }
  save('audit.json',{at:new Date().toISOString(),hosting:hosting.release.version.name,functions:names});console.log('Captured live hosting and two attendance-reader baselines; no production changes.');
}
async function prepare(){
  read('audit.json');
  for(const name of names)fs.cpSync(path.join(stage,'baseline-functions',name),path.join(stage,'deploy',name),{recursive:true});
  for(const [file,target] of [['functions/attendance-analytics.js','getGeoRepAttendanceDashboard/attendance-analytics.js'],['functions/attendance-exclusions-core.js','getGeoRepAttendanceDashboard/attendance-exclusions-core.js'],['firebase-dashboards/backend/service.cjs','publicMeridianDashboards/service.cjs'],['firebase-dashboards/backend/vendor/attendance.cjs','publicMeridianDashboards/vendor/attendance.cjs'],['functions/attendance-exclusions-core.js','publicMeridianDashboards/vendor/attendance-exclusions-core.js']])save('deploy/'+target,fs.readFileSync(path.join(root,file)));
  for(const file of ['attendance-exclusions-admin.js','attendance-exclusions-core.js','attendance-analytics.js','attendance-hierarchy.json','admin-access.js'])save('admin/'+file,fs.readFileSync(path.join(root,'functions',file)));
  save('admin/index.js',fs.readFileSync(path.join(root,'functions/attendance-exclusions-entry.js')));
  save('admin/package.json',{name:'meridian-attendance-exclusions',private:true,version:'1.0.0',main:'index.js',engines:{node:'22'},dependencies:{'firebase-admin':'13.10.0','firebase-functions':'7.2.5',exceljs:'4.4.0',jszip:'3.10.1'}});
  save('firebase.json',{functions:[{source:'admin',codebase:'attendance-exclusions-admin',runtime:'nodejs22',ignore:['node_modules','.git','firebase-debug.log']}]});
  let app=get('baseline/app.js');const local=source(path.join(root,'public/app.js'));
  const controller=local.match(/let attendanceExclusionsSession = null;[^]*?(?=let supportSession = null;)/)?.[0];assert.ok(controller);
  app=once(app,'let supportSession = null;',controller+'let supportSession = null;');
  app=once(app,'  window.NexusJobStatus?.identity(state.isOperator','  syncAttendanceExclusions();\n  window.NexusJobStatus?.identity(state.isOperator');
  app=once(app,'  syncAttendanceJobSummaries();\n  if (elements.stockFixView)','  syncAttendanceJobSummaries();\n  syncAttendanceExclusions();\n  if (elements.stockFixView)');
  app=once(app,'  if (tabName === "integration-inventory" && state.isAdmin) loadSharePointInventory({ quiet: true });','  if (tabName === "integration-inventory" && state.isAdmin) loadSharePointInventory({ quiet: true });\n  syncAttendanceExclusions();');save('portal/app.js',app);
  let html=get('baseline/index.html');html=once(html,'  <script defer src="app.js?',`  <link rel="stylesheet" href="attendance-exclusions.css?v=${tag}" />\n  <script defer src="attendance-exclusions.js?v=${tag}"></script>\n  <script defer src="app.js?`);
  html=once(html,'              <section class="admin-tab-panel" data-admin-panel="geo-attendance" hidden>','              <section class="admin-tab-panel" data-admin-panel="geo-attendance" hidden>\n                <div id="attendanceExclusionsAdmin" class="aex" tabindex="-1"></div>');
  save('portal/index.html',html.replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`));
  let sw=get('baseline/service-worker.js').replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`).replace(/app\.js\?v=[^"']+/,`app.js?v=${tag}`);
  sw=once(sw,'const SHELL = [',`const SHELL = ["/attendance-exclusions.js?v=${tag}","/attendance-exclusions.css?v=${tag}",`);save('portal/service-worker.js',sw);
  for(const name of assets.slice(3))save('portal/'+name,fs.readFileSync(path.join(root,'public',name)));
  for(const file of ['app.js','service-worker.js','attendance-exclusions.js'])execFileSync(process.execPath,['--check',path.join(stage,'portal',file)],{windowsHide:true});
  save('manifest.json',{portal:fileHashes(path.join(stage,'portal')),functions:Object.fromEntries(names.map(n=>[n,fileHashes(path.join(stage,'deploy',n))])),admin:fileHashes(path.join(stage,'admin'))});
  console.log('Prepared two reader updates, one admin-only callable and five portal assets. No rule or automation changes.');
}
async function readers(){
  const manifest=read('manifest.json');
  for(const name of names){
    const before=read(`functions/${name}.before.json`);assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision);
    assert.deepEqual(fileHashes(path.join(stage,'deploy',name)),manifest.functions[name]);
    const zip=new JSZip();for(const file of Object.keys(manifest.functions[name]))zip.file(file,fs.readFileSync(path.join(stage,'deploy',name,file)));
    const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
    const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(put.ok);
    const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save(`functions/${name}.operation.json`,op);console.log('Building '+name);
    for(;;){const result=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(result.done){assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(resolve=>setTimeout(resolve,15000));}
    const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
    for(const field of ['serviceAccountEmail','environmentVariables','secretEnvironmentVariables','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','maxInstanceRequestConcurrency','ingressSettings'])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field]);
    assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read(`functions/${name}.iam.json`));
    save(`functions/${name}.after.json`,after);console.log('Verified '+name+' '+after.serviceConfig.revision);
  }
}
async function hosting(){
  for(const name of names)assert.equal((await json(fnUrl(name))).serviceConfig.revision,read(`functions/${name}.after.json`).serviceConfig.revision);
  assert.equal((await json(fnUrl('manageSyndicatedAttendanceExclusions'))).state,'ACTIVE');
  const before=read('hosting.before.json'),current=await liveHosting();assert.equal(current.release.version.name,before.release.version.name);
  assert.deepEqual(fileHashes(path.join(stage,'portal')),read('manifest.json').portal);
  const files=Object.fromEntries(read('hosting.files.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of assets){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const version=await json(`${hostingBase}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('hosting.created.json',{version,files});
  const populated=await json(`${hostingBase}/${version.name}:populateFiles`,'POST',{files});
  const cliPath=path.join(process.env.APPDATA,'npm/node_modules/firebase-tools'),cli=require(cliPath),{Client}=require(path.join(cliPath,'lib/apiv2'));
  await cli.hosting.channel.list({project:'meridain-nexus',site:'meridian-nexus',nonInteractive:true});
  const uploader=new Client({urlPrefix:populated.uploadUrl,auth:true});
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const r=await uploader.request({method:'POST',path:'/'+digest,body:require('node:stream').Readable.from([uploads.get(digest)]),resolveOnHTTPError:true,responseType:'stream'});r.body.resume();assert.equal(r.status,200);}
  await json(`${hostingBase}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('hosting.after.json',await json(`${hostingBase}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Admin-managed syndicated attendance exclusions with reviewed Excel import; source data and Call Cycle unchanged'}));await verify();
}
async function verify(){
  const {version,files}=read('hosting.created.json'),live=await liveHosting();assert.equal(live.release.version.name.split('/').at(-1),version.name.split('/').at(-1));
  const actual=await json(`${hostingBase}/${live.release.version.name}/files?pageSize=1000`);assert.ok(!actual.nextPageToken);assert.deepEqual(Object.fromEntries(actual.files.map(f=>[f.path,f.hash])),files);
  for(const name of assets){let matched=false;for(let i=0;i<12;i++){const r=await fetch(`https://meridian-nexus.web.app/${name}?verify=${Date.now()}`);if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===read('manifest.json').portal[name]){matched=true;break;}await new Promise(resolve=>setTimeout(resolve,5000));}assert.ok(matched,name);}
  const result={version:version.name,changed:assets,verifiedAt:new Date().toISOString(),rulesChanged:0};save('verified.json',result);console.log(JSON.stringify(result));
}
const actions={audit,prepare,readers,hosting,verify};if(!actions[process.argv[2]])throw Error('Use audit, prepare, readers, hosting or verify');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
