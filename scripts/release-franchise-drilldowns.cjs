const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {api,json,fnUrl,liveHosting,hash,once,fileHashes}=require('./release-multi-admin.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/franchise-drilldowns-20260911');
const base='https://firebasehosting.googleapis.com/v1beta1',tag='20260911-franchise-drilldowns';
const assets=['index.html','service-worker.js','franchise-orders.js','franchise-orders.css'];
const save=(name,value)=>{const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2));};
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'before.json')),'Preserve the captured production baseline');
  const current=await liveHosting(),files=await json(`${base}/${current.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  save('before.json',current);save('files.json',files);
  for(const file of [...assets,'app.js','styles.css']){
    const response=await fetch(`https://meridian-nexus.web.app/${file}?audit=${Date.now()}`);assert.ok(response.ok);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);
    save('baseline/'+file,bytes);
  }
  await auditBackend();
  console.log('Captured '+current.release.version.name);
}
function prepare(){
  read('before.json');
  for(const file of ['franchise-orders.js','franchise-orders.css'])save('portal/'+file,fs.readFileSync(path.join(root,'public',file)));
  save('portal/app.js',fs.readFileSync(path.join(stage,'baseline/app.js')));
  for(const file of ['index.html','service-worker.js']){
    const before=fs.readFileSync(path.join(stage,'baseline',file),'utf8');let value=before;
    for(const asset of ['franchise-orders.js','franchise-orders.css']){
      const matches=[...value.matchAll(new RegExp(`${asset.replace('.','\\.')}\\?v=[^"']+`,'g'))];assert.equal(matches.length,1);
      value=once(value,matches[0][0],`${asset}?v=${tag}`);
    }
    if(file==='service-worker.js')value=value.replace(/^const CACHE = "[^"]+";/,`const CACHE = "meridian-nexus-${tag}";`);
    save('portal/'+file,value);
  }
  for(const file of ['franchise-orders.js','app.js','service-worker.js'])execFileSync(process.execPath,['--check',path.join(stage,'portal',file)],{windowsHide:true});
  save('portal/styles.css',fs.readFileSync(path.join(stage,'baseline/styles.css')));
  prepareBackend();
  save('manifest.json',fileHashes(path.join(stage,'portal')));
  console.log('Prepared four Hosting assets and one read-only reporting module; auth, rules, shell and other functions unchanged.');
}
function tests(){
  const manifest=read('manifest.json');assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest);
  const log=execFileSync(process.execPath,['--test','scripts/tests/franchise-orders.test.cjs','scripts/tests/franchise-orders-ui.test.cjs'],{cwd:root,encoding:'utf8',windowsHide:true});save('unit-tests.log',log);console.log(log.slice(-250));
  execFileSync(process.execPath,['scripts/tests/franchise-orders-browser.cjs'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,NEXUS_PORTAL_STAGE:path.join(stage,'portal')}});
  save('tested.json',{at:new Date().toISOString(),manifest,backendManifest:read('backend.manifest.json')});
}
async function publish(){
  const manifest=read('manifest.json');assert.deepEqual(manifest,read('tested.json').manifest);assert.deepEqual(fileHashes(path.join(stage,'portal')),manifest);
  assert.ok(read('backend.verified.json').revision);
  const current=await liveHosting();assert.equal(current.release.version.name,read('before.json').release.version.name);
  const files=Object.fromEntries(read('files.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const file of assets){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',file)),{level:9}),digest=hash(bytes);files['/'+file]=digest;uploads.set(digest,bytes);}
  const version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('created.json',{version,files});
  const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes||[]){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  save('released.json',await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Franchise orders: daily KPI activity, selectable chart granularity and reconciled line drilldowns throughout all seven pages. Auth, rules, source ledger and other modules unchanged.'}));
  assert.equal((await liveHosting()).release.version.name.split('/').at(-1),version.name.split('/').at(-1));
  const actual=await json(`${base}/${version.name}/files?pageSize=1000`);assert.ok(!actual.nextPageToken);assert.deepEqual(Object.fromEntries(actual.files.map(f=>[f.path,f.hash])),files);
  for(const file of assets){const response=await fetch(`https://meridian-nexus.web.app/${file}?verify=${Date.now()}`);assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),manifest[file]);}
  save('verified.json',{at:new Date().toISOString(),version:version.name,assets});console.log('Published and verified '+version.name);
}

const functionName='getFranchiseOrderDashboard';
const backendDir=path.join(stage,'backend');
const gcloud=(...args)=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit'],maxBuffer:12*1024*1024});
async function auditBackend(){
  const before=await json(fnUrl(functionName));save('backend.before.json',before);
  save('iam.before.json',await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`));
  const source=before.buildConfig.source.storageSource;
  const archive=await require('../functions/node_modules/jszip').loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
  for(const entry of Object.values(archive.files)){
    if(entry.dir)continue;const target=path.resolve(backendDir,entry.name);assert.ok(target.startsWith(backendDir+path.sep));
    save(path.relative(stage,target),await entry.async('nodebuffer'));
  }
  save('backend.files.before.json',fileHashes(backendDir));
  save('baseline/franchise-reader.js',fs.readFileSync(path.join(backendDir,'franchise-orders.js')));
}
function prepareBackend(){
  const before=fs.readFileSync(path.join(stage,'baseline/franchise-reader.js'),'utf8').replace(/\r\n/g,'\n');
  const next=fs.readFileSync(path.join(root,'functions/franchise-orders.js'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(next.slice(next.indexOf('function createReader(')),before.slice(before.indexOf('function createReader(')),'Preserve production authorization, source reads, cache and limits');
  const current=fileHashes(backendDir), baseline=read('backend.files.before.json');
  for(const name of Object.keys(baseline))if(name!=='franchise-orders.js')assert.equal(current[name],baseline[name],name);
  save('backend/franchise-orders.js',next);save('backend.manifest.json',fileHashes(backendDir));
}
async function deployBackend(){
  const manifest=read('manifest.json');assert.deepEqual(read('tested.json').manifest,manifest);
  assert.deepEqual(fileHashes(backendDir),read('backend.manifest.json'));
  assert.deepEqual(read('tested.json').backendManifest,read('backend.manifest.json'));
  const before=read('backend.before.json'),previous=fs.existsSync(path.join(stage,'backend.verified.json'))?read('backend.verified.json'):null;
  assert.equal((await json(fnUrl(functionName))).serviceConfig.revision,previous?.revision || before.serviceConfig.revision);
  if(previous)save(`backend.${previous.revision}.verified.json`,previous);
  const result=gcloud('functions','deploy',functionName,'--gen2','--project=meridain-nexus','--region=us-central1',`--source=${backendDir}`,`--entry-point=${functionName}`,'--runtime=nodejs22','--quiet','--format=json');
  save('backend.deploy.json',result);
  const after=await json(fnUrl(functionName));assert.equal(after.state,'ACTIVE');
  for(const key of ['serviceAccountEmail','availableMemory','availableCpu','timeoutSeconds','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency','environmentVariables','secretEnvironmentVariables','ingressSettings','vpcConnector','vpcConnectorEgressSettings'])assert.deepEqual(after.serviceConfig[key],before.serviceConfig[key],key);
  assert.deepEqual(after.eventTrigger,before.eventTrigger);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),read('iam.before.json'));
  const response=await fetch(`https://us-central1-meridain-nexus.cloudfunctions.net/${functionName}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{role:'admin',granularity:'day'}})});assert.equal(response.status,401);
  save('backend.verified.json',{revision:after.serviceConfig.revision,at:new Date().toISOString(),authAndConfigurationPreserved:true});console.log('Backend verified '+after.serviceConfig.revision);
}

if(require.main===module)Promise.resolve().then(()=>({audit,prepare,tests,backend:deployBackend,publish})[process.argv[2]]()).catch(error=>{console.error(error.stack);process.exitCode=1;});
