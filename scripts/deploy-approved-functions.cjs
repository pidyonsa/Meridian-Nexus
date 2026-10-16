const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/approved-admin-chat-etl-20260909');
const JSZip=require(path.join(root,'functions/node_modules/jszip'));
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
const save=(name,data)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(data,null,2));
const gc=(...args)=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,stdio:['ignore','pipe','inherit']});
let token='',tokenAt=0;
async function api(url,method='GET',body) {
 if(Date.now()-tokenAt>2400000){token=gc('auth','print-access-token','--project=meridain-nexus','--quiet').trim();tokenAt=Date.now();}
 const r=await fetch(`https://cloudfunctions.googleapis.com/v2/${url}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-goog-user-project':'meridain-nexus'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(`${r.status} ${data.error?.message||url}`);return data;
}
async function archive(name) {
 const zip=new JSZip(),base=path.join(stage,'deploy',name);
 function add(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(['node_modules','.git','.gcloudignore'].includes(entry.name))continue;const target=path.join(folder,entry.name);if(entry.isDirectory())add(target);else if(entry.isFile())zip.file(path.relative(base,target).replaceAll('\\','/'),fs.readFileSync(target));else throw new Error('Unexpected source symlink');}}
 add(base);return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
}
async function main() {
 const baseline=read('functions.before.json'),all=read('functions.manifest.json');
 const names=process.argv.slice(2);const entries=names.length?all.filter(x=>names.includes(x.name)):all.filter(x=>!['saveAdminUser','deleteAdminUser'].includes(x.name));
 if(names.length)assert.equal(entries.length,names.length);
 const stateFile=path.join(stage,'function-deployments.json');const states=fs.existsSync(stateFile)?read('function-deployments.json'):{};
 const persist=()=>save('function-deployments.json',states);
 const active=new Map();const failed=[];
 async function poll() {
  for(const [name,operation] of active) {
   const status=await api(operation);if(!status.done)continue;active.delete(name);
   if(status.error){states[name]={...states[name],error:status.error};failed.push(name);console.log(`FAILED ${name}: ${status.error.message}`);persist();continue;}
   const after=await api(`projects/meridain-nexus/locations/us-central1/functions/${name}`),before=baseline.find(x=>x.name.endsWith('/'+name));
   assert.equal(after.state,'ACTIVE');
   for(const key of ['serviceAccountEmail','availableMemory','availableCpu','timeoutSeconds','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency','environmentVariables','secretEnvironmentVariables','ingressSettings','vpcConnector','vpcConnectorEgressSettings'])assert.deepEqual(after.serviceConfig[key],before.serviceConfig[key],`${name}: ${key} changed`);
   assert.deepEqual(after.eventTrigger,before.eventTrigger);
   save(`${name}.after.json`,after);states[name]={...states[name],done:true,revision:after.serviceConfig.revision};persist();console.log(`ACTIVE ${name} ${after.serviceConfig.revision}`);
  }
 }
 for(const item of entries) {
  if(states[item.name]?.done){const current=await api(`projects/meridain-nexus/locations/us-central1/functions/${item.name}`);assert.equal(current.serviceConfig.revision,states[item.name].revision);continue;}
  if(states[item.name]?.operation&&!states[item.name]?.error){active.set(item.name,states[item.name].operation);continue;}
  while(active.size>=6){await new Promise(r=>setTimeout(r,12000));await poll();}
  if(failed.length)break;
  const before=baseline.find(x=>x.name.endsWith('/'+item.name)),current=await api(before.name);assert.equal(current.serviceConfig.revision,item.revision,`${item.name} changed since audit`);
  const upload=await api('projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await archive(item.name)});assert.ok(put.ok,`Source upload failed: ${put.status}`);
  const operation=await api(`${before.name}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});
  states[item.name]={operation:operation.name,startedAt:new Date().toISOString()};persist();active.set(item.name,operation.name);console.log(`BUILDING ${item.name}`);
  await poll();
 }
 while(active.size){await new Promise(r=>setTimeout(r,15000));await poll();}
 assert.equal(failed.length,0,`Failed deployments: ${failed.join(', ')}`);
 console.log(JSON.stringify({completed:entries.filter(x=>states[x.name]?.done).length,selected:entries.length,configurationPreserved:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
