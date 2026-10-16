const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process'),{Readable}=require('node:stream');
const root=path.resolve(__dirname,'..'), stage=path.join(root,'.tmp/franchise-release');
const cliPath=path.join(process.env.APPDATA,'npm/node_modules/firebase-tools');
const cli=require(cliPath),hosting=require(path.join(cliPath,'lib/hosting/api')),{Client}=require(path.join(cliPath,'lib/apiv2'));
const JSZip=require(path.join(root,'functions/node_modules/jszip'));
const assets=['index.html','app.js','service-worker.js','franchise-orders.js','franchise-orders.css'];
const names=['saveAdminUser'];
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name)));
const save=(name,value)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2));
const normal=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const gcloud=(...args)=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:10*1024*1024,windowsHide:true});
const describe=name=>JSON.parse(gcloud('functions','describe',name,'--gen2','--region=us-central1','--project=meridain-nexus','--format=json'));
async function connect(){await cli.hosting.channel.list({project:'meridain-nexus',site:'meridian-nexus',nonInteractive:true});return new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});}
async function prepare(){
  assert.ok(!fs.existsSync(path.join(stage,'manifest.json')),'Release baseline already exists');fs.mkdirSync(stage,{recursive:true});
  const client=await connect();const current=await hosting.getChannel('meridain-nexus','meridian-nexus','live');
  if(fs.existsSync(path.join(stage,'hosting.before.json')))assert.equal(current.release.version.name,read('hosting.before.json').release.version.name);else save('hosting.before.json',current);
  const {body}=await client.get(`/${current.release.version.name}/files`,{queryParams:{pageSize:1000}});assert.ok(!body.nextPageToken);
  if(fs.existsSync(path.join(stage,'hosting-files.before.json')))assert.deepEqual(body.files,read('hosting-files.before.json').files);else save('hosting-files.before.json',body);
  for(const name of assets.slice(0,3)){if(fs.existsSync(path.join(stage,`live-${name}`)))continue;const res=await fetch(`https://meridian-nexus.web.app/${name}`);assert.ok(res.ok);fs.writeFileSync(path.join(stage,`live-${name}`),Buffer.from(await res.arrayBuffer()));}
  const permissionLine=normal(path.join(root,'functions/index.js')).match(/^const navigationPermissionIds = new Set\(.*\);$/m)[0];
  const manifest=[];
  for(const name of names){
    const before=describe(name);if(fs.existsSync(path.join(stage,`${name}.before.json`)))assert.equal(before.serviceConfig.revision,read(`${name}.before.json`).serviceConfig.revision);else save(`${name}.before.json`,before);const source=before.buildConfig.source.storageSource;
    const zipPath=path.join(stage,`${name}.zip`);if(!fs.existsSync(zipPath))gcloud('storage','cp',`gs://${source.bucket}/${source.object}#${source.generation}`,zipPath,'--project=meridain-nexus');
    const dir=path.join(stage,name);fs.mkdirSync(dir,{recursive:true});const archive=await JSZip.loadAsync(fs.readFileSync(zipPath));
    for(const entry of Object.values(archive.files)){if(entry.dir)continue;const target=path.resolve(dir,entry.name);assert.ok(target.startsWith(dir+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await entry.async('nodebuffer'));}
    const file=path.join(dir,'index.js'),baseline=normal(file),old=baseline.match(/^const navigationPermissionIds = new Set\(.*\);$/m)[0];
    assert.equal(permissionLine.replace(', "franchiseorder"',''),old,'Only the Franchise Order grant may be added');
    const next=baseline.replace(old,permissionLine);assert.equal(next.replace(permissionLine,old),baseline);fs.writeFileSync(file,next);
    fs.writeFileSync(path.join(stage,`${name}.before.js`),baseline);execFileSync(process.execPath,['--check',file]);
    manifest.push({name,revision:before.serviceConfig.revision,change:'One navigation permission constant only'});
  }
  const dir=path.join(stage,'getFranchiseOrderDashboard');fs.mkdirSync(dir,{recursive:true});
  for(const name of ['franchise-orders.js','package.json','package-lock.json'])fs.copyFileSync(path.join(root,'functions',name),path.join(dir,name));
  fs.copyFileSync(path.join(root,'functions/franchise-entry.js'),path.join(dir,'index.js'));
  manifest.push({name:'getFranchiseOrderDashboard',change:'New read-only callable, existing Nexus service account'});save('manifest.json',manifest);
  console.log(JSON.stringify({baseline:current.release.version.name,functions:manifest,hostingChanges:assets}));
}
async function deployFunctions(){
  const results=fs.existsSync(path.join(stage,'functions.after.json'))?read('functions.after.json'):[];
  for(const entry of read('manifest.json')){
    if(results.some(r=>r.name===entry.name))continue;
    const before=entry.revision?describe(entry.name):null;if(before)assert.equal(before.serviceConfig.revision,entry.revision);
    const args=['functions','deploy',entry.name,'--gen2','--region=us-central1','--project=meridain-nexus',`--source=${path.join(stage,entry.name)}`,`--entry-point=${entry.name}`,'--runtime=nodejs22','--quiet','--format=json'];
    if(!before){
      fs.copyFileSync(path.join(root,'functions/franchise-entry.js'),path.join(stage,entry.name,'index.js'));
      args.push('--trigger-http','--allow-unauthenticated','--service-account=730011371323-compute@developer.gserviceaccount.com','--memory=512Mi','--cpu=1','--timeout=120s','--max-instances=3','--concurrency=20');
    }
    console.log(`Deploying ${entry.name}`);fs.writeFileSync(path.join(stage,`${entry.name}.deploy.json`),gcloud(...args));const after=describe(entry.name);assert.equal(after.state,'ACTIVE');
    if(before){for(const key of ['serviceAccountEmail','availableMemory','availableCpu','timeoutSeconds','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency','environmentVariables','secretEnvironmentVariables','ingressSettings','vpcConnector','vpcConnectorEgressSettings'])assert.deepEqual(after.serviceConfig[key],before.serviceConfig[key],`${entry.name} ${key} changed`);assert.deepEqual(after.eventTrigger,before.eventTrigger);}
    save(`${entry.name}.after.json`,after);results.push({name:entry.name,revision:after.serviceConfig.revision,state:after.state,configurationPreserved:!!before});save('functions.after.json',results);console.log(JSON.stringify(results.at(-1)));
  }
}
async function deployHosting(){
  assert.equal(read('functions.after.json').length,2,'Complete the reader and permission update first');
  const client=await connect(),current=await hosting.getChannel('meridain-nexus','meridian-nexus','live');
  const canonical=value=>value.replace('projects/730011371323/','projects/meridain-nexus/');
  const previous=fs.existsSync(path.join(stage,'hosting.after.json'))?read('hosting.after.json'):null;
  assert.equal(canonical(current.release.version.name),canonical(previous?.version||read('hosting.before.json').release.version.name),'Live Hosting changed; review before release');
  const {body}=await client.get(`/${current.release.version.name}/files`,{queryParams:{pageSize:1000}});
  if(previous){assert.deepEqual(Object.fromEntries(body.files.map(f=>[f.path,f.hash])),read('hosting.created.json').files);save(`hosting.previous-${current.release.version.name.split('/').at(-1)}.json`,{release:current,files:body});}
  else assert.deepEqual(body.files,read('hosting-files.before.json').files);
  const files=Object.fromEntries(body.files.map(f=>[f.path,f.hash])),uploads=new Map();
  const dir=path.join(stage,'hosting-assets');fs.mkdirSync(dir,{recursive:true});
  for(const name of assets){const content=fs.readFileSync(path.join(root,'public',name)),gz=zlib.gzipSync(content,{level:9}),hash=crypto.createHash('sha256').update(gz).digest('hex');files[`/${name}`]=hash;uploads.set(hash,gz);fs.writeFileSync(path.join(dir,name),content);}
  const version=await hosting.createVersion('meridian-nexus',{config:current.release.version.config});save('hosting.created.json',{version,files});
  const populated=await client.post(`/${version}:populateFiles`,{files}),uploader=new Client({urlPrefix:populated.body.uploadUrl,auth:true});
  for(const hash of populated.body.uploadRequiredHashes||[]){assert.ok(uploads.has(hash));const result=await uploader.request({method:'POST',path:`/${hash}`,body:Readable.from([uploads.get(hash)]),resolveOnHTTPError:true,responseType:'stream'});result.body.resume();assert.equal(result.status,200);}
  await hosting.updateVersion('meridian-nexus',version.split('/').pop(),{status:'FINALIZED'});
  assert.equal((await hosting.getChannel('meridain-nexus','meridian-nexus','live')).release.version.name,current.release.version.name);
  await hosting.createRelease('meridian-nexus','live',version,{message:'Franchise Order: Geo Rep order reporting with Insights styling and assigned Nexus navigation'});
  const {body:verified}=await client.get(`/${version}/files`,{queryParams:{pageSize:1000}});assert.deepEqual(Object.fromEntries(verified.files.map(f=>[f.path,f.hash])),files);
  await verifyHosting();
}
async function verifyHosting(){
  const {version,files}=read('hosting.created.json'),client=await connect();
  const canonical=value=>value.replace('projects/730011371323/','projects/meridain-nexus/');
  assert.equal(canonical((await hosting.getChannel('meridain-nexus','meridian-nexus','live')).release.version.name),canonical(version));
  const {body}=await client.get(`/${version}/files`,{queryParams:{pageSize:1000}});assert.deepEqual(Object.fromEntries(body.files.map(f=>[f.path,f.hash])),files);
  for(const name of assets){
    const expected=fs.readFileSync(path.join(stage,'hosting-assets',name));let verified=false;
    for(let attempt=0;attempt<12;attempt++){
      const response=await fetch(`https://meridian-nexus.web.app/${name}?verify=${Date.now()}`,{headers:{'Cache-Control':'no-cache'}});
      if(response.ok && Buffer.from(await response.arrayBuffer()).equals(expected)){verified=true;break;}
      console.log(`Waiting for Hosting propagation: ${name}`);await new Promise(resolve=>setTimeout(resolve,5000));
    }
    assert.ok(verified,`${name} is not yet serving the reviewed version`);
  }
  const checks={};
  for(const [name,status] of [['getFranchiseOrderDashboard',401],['saveAdminUser',403],['meridianChat',401]]){
    const response=await fetch(`https://us-central1-meridain-nexus.cloudfunctions.net/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"data":{}}'});assert.equal(response.status,status,`${name}: unsigned access must fail`);checks[name]=response.status;
  }
  const response=await fetch('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents/salesTransactions?pageSize=1');assert.equal(response.status,403);checks.salesTransactions=response.status;
  const result={version,changes:assets,preservedAssets:read('hosting-files.before.json').files.filter(f=>!assets.includes(f.path.slice(1))).length,unsignedChecks:checks,verifiedAt:new Date().toISOString()};save('hosting.after.json',result);console.log(JSON.stringify(result));
}
const actions={prepare,functions:deployFunctions,hosting:deployHosting,verify:verifyHosting};
if(!actions[process.argv[2]])throw new Error('Specify prepare, functions, or hosting');
actions[process.argv[2]]().catch(e=>{console.error(e.message.slice(0,1400));process.exitCode=1;});
