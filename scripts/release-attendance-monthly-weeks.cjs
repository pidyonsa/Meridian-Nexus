"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const JSZip=require("../functions/node_modules/jszip");
const root=path.resolve(__dirname,".."),dir=path.join(root,".tmp/attendance-week-repair-20260914"),stage=path.join(dir,"processExtraction");
const normal=s=>s.replace(/\r\n/g,"\n"),read=p=>normal(fs.readFileSync(p,"utf8"));
const gcloud=(...args)=>execFileSync("powershell.exe",["-NoProfile","-File","C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1",...args],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024});
const describe=()=>JSON.parse(gcloud("functions","describe","processExtraction","--gen2","--region=us-central1","--project=meridain-nexus","--format=json"));
const fn=(s,n)=>{const m=s.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`));assert.ok(m,n);return m[0];};
const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2));
async function archive(config){
  const source=config.buildConfig.source.storageSource;
  const p=path.join(dir,`production-${source.generation}.zip`);
  if(!fs.existsSync(p))gcloud("storage","cp",`gs://${source.bucket}/${source.object}#${source.generation}`,p,"--project=meridain-nexus");
  return JSZip.loadAsync(fs.readFileSync(p));
}
async function prepare(){
  assert.ok(!fs.existsSync(stage),"Do not overwrite staged production source");
  fs.mkdirSync(dir,{recursive:true});
  const before=describe(),zip=await archive(before);
  for(const entry of Object.values(zip.files)){
    if(entry.dir)continue;
    const target=path.resolve(stage,entry.name);assert.ok(target.startsWith(stage+path.sep));
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await entry.async("nodebuffer"));
  }
  save("function-before.json",before);
  const p=path.join(stage,"index.js"),baseline=read(p),local=read(path.join(root,"functions/index.js"));
  fs.writeFileSync(path.join(dir,"processExtraction.baseline.js"),baseline);
  let updated=baseline;const changes=[];
  for(const name of ["attendanceCalendarWeek","populateDailyAttendanceBlueprintPlan"]){
    const old=fn(updated,name),next=fn(local,name);assert.notEqual(old,next,`${name} already changed in production`);
    assert.equal(updated.split(old).length,2);updated=updated.replace(old,()=>next);changes.push({old,next});
  }
  assert.ok(!updated.includes("function smartSellWeekReferenceDate("));
  const old=fn(updated,"smartSellWeekForAttendanceDate"),next=old+"\n\n"+fn(local,"smartSellWeekReferenceDate");
  updated=updated.replace(old,()=>next);changes.push({old,next});
  let reversed=updated;for(const c of [...changes].reverse())reversed=reversed.replace(c.next,()=>c.old);
  assert.equal(reversed,baseline,"Only reviewed attendance functions may change");
  fs.writeFileSync(p,updated);save("function-review.json",changes);
  execFileSync(process.execPath,["--check",p],{stdio:"inherit"});
  execFileSync(process.execPath,["--test",path.join(root,"scripts/tests/attendance-monthly-weeks.test.cjs")],{env:{...process.env,ATTENDANCE_BACKEND_TEST_FILE:p},stdio:"inherit"});
  console.log(JSON.stringify({prepared:true,revision:before.serviceConfig.revision,changedFunctions:["attendanceCalendarWeek","populateDailyAttendanceBlueprintPlan","smartSellWeekReferenceDate"],otherSourceUnchanged:true}));
}
function check(before,after){
  assert.equal(after.state,"ACTIVE");assert.notEqual(before.serviceConfig.revision,after.serviceConfig.revision);
  for(const field of ["serviceAccountEmail","availableMemory","availableCpu","timeoutSeconds","maxInstanceCount","minInstanceCount","maxInstanceRequestConcurrency","environmentVariables","secretEnvironmentVariables","ingressSettings","vpcConnector","vpcConnectorEgressSettings"])assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],field);
  const trigger=t=>t?{...t,eventFilters:[...(t.eventFilters||[])].sort((a,b)=>a.attribute.localeCompare(b.attribute))}:t;
  assert.deepEqual(trigger(after.eventTrigger),trigger(before.eventTrigger));
}
async function deploy(){
  const before=JSON.parse(read(path.join(dir,"function-before.json")));
  assert.equal(describe().serviceConfig.revision,before.serviceConfig.revision,"Production changed after preparation");
  gcloud("functions","deploy","processExtraction","--gen2","--project=meridain-nexus","--region=us-central1",`--source=${stage}`,`--entry-point=${before.buildConfig.entryPoint}`,`--runtime=${before.buildConfig.runtime}`,"--quiet","--format=json");
  const after=describe();save("function-after.json",after);check(before,after);
  await verify();
}
async function verify(){
  const before=JSON.parse(read(path.join(dir,"function-before.json"))),live=describe();
  const expected=JSON.parse(JSON.stringify(before));
  if(fs.existsSync(path.join(dir,"transport-after.json")))expected.serviceConfig.environmentVariables.FIRESTORE_PREFER_REST="true";
  check(expected,live);
  const zip=await archive(live),original=await archive(before);
  assert.equal(normal(await zip.file("index.js").async("string")),read(path.join(stage,"index.js")));
  for(const entry of Object.values(original.files))if(!entry.dir&&entry.name!=="index.js"&&entry.name!==".gcloudignore"){
    assert.ok(zip.file(entry.name),entry.name);assert.deepEqual(await zip.file(entry.name).async("nodebuffer"),await entry.async("nodebuffer"),entry.name);
  }
  const verification={checkedAt:new Date().toISOString(),revision:live.serviceConfig.revision,sourceMatches:true,permissionsAndCapacityPreserved:true,transport:live.serviceConfig.environmentVariables.FIRESTORE_PREFER_REST==="true"?"REST":"gRPC"};
  save("function-verified.json",verification);
  console.log(JSON.stringify(verification));
}
async function transport(){
  const before=describe();assert.equal(before.serviceConfig.revision,JSON.parse(read(path.join(dir,"function-verified.json"))).revision);
  assert.ok(!before.serviceConfig.environmentVariables.FIRESTORE_PREFER_REST,"Transport already configured");
  save("transport-before.json",before);
  const token=gcloud("auth","print-access-token","--project=meridain-nexus","--quiet").trim();
  const api=async(url,method="GET",body)=>{
    const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
    const value=await r.json();if(!r.ok)throw new Error(`Configuration API ${r.status}: ${value.error?.message||"request failed"}`);return value;
  };
  const name="projects/meridain-nexus/locations/us-central1/functions/processExtraction";
  const env={...before.serviceConfig.environmentVariables,FIRESTORE_PREFER_REST:"true"};
  let operation=await api(`https://cloudfunctions.googleapis.com/v2/${name}?updateMask=serviceConfig.environmentVariables`,"PATCH",{name,serviceConfig:{environmentVariables:env}});
  save("transport-operation.json",operation);
  for(let attempt=0;!operation.done&&attempt<60;attempt++){
    await new Promise(resolve=>setTimeout(resolve,10000));
    operation=await api(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);
  }
  if(!operation.done||operation.error)throw new Error(`Transport configuration not complete: ${JSON.stringify(operation.error||operation.name)}`);
  const after=describe();save("transport-after.json",after);
  const expected=JSON.parse(JSON.stringify(before));expected.serviceConfig.environmentVariables=env;check(expected,after);
  // Cloud Functions may publish a new source generation for a config update.
  // Verify the contents rather than treating a new generation as a code edit.
  const prior=await archive(before),current=await archive(after);
  for(const entry of Object.values(prior.files))if(!entry.dir){assert.ok(current.file(entry.name),entry.name);assert.deepEqual(await current.file(entry.name).async("nodebuffer"),await entry.async("nodebuffer"),entry.name);}
  console.log(JSON.stringify({revision:after.serviceConfig.revision,transport:"REST",codeUnchanged:true,permissionsAndCapacityPreserved:true}));
}
const action=process.argv[2];(action==="prepare"?prepare():action==="deploy"?deploy():action==="verify"?verify():action==="transport"?transport():Promise.reject(new Error("Use prepare, deploy, verify or transport"))).catch(e=>{console.error(String(e.message).slice(0,2000));process.exitCode=1;});
