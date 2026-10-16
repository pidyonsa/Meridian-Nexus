"use strict";
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {json}=require("./release-multi-admin.cjs"),{base,stage,fields,save}=require("./refresh-national-master-20260924.cjs");
const {hash,validate,adapters}=require("../azure-field-dashboards/server/snapshot-data.cjs"),{unpackSnapshot}=require("../azure-field-dashboards/attendance-publisher/core.cjs");
const container="https://meridianfield730011.blob.core.windows.net/dashboard-data/",live="https://meridian-field-dashboards.azurewebsites.net";
async function liveReport(route,input){const r=await fetch(live+route,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(180000)});const value=await r.json();assert.equal(r.status,200,value.error);assert.equal(value.dataHosting?.provider,"Azure");assert.equal(value.dataHosting.refreshFailed,false);return value;}
async function baseline(){
  const result={at:new Date().toISOString(),orders:(await liveReport("/api/orders",{refresh:true})).totals,attendance:{}};
  for(const audience of ["rep","merchandiser"]){const r=await liveReport("/api/attendance",{audience,refresh:true});result.attendance[audience]={metrics:r.metrics,through:r.reportEndDate,operationalWeek:r.operationalWeek};}
  save("azure-before.json",result);console.log(JSON.stringify(result,null,2));
}
async function publishRegions(){
  const raw=await json(base+"/publicDashboardSources/orderRegions"),region=fields(raw),local=JSON.parse(fs.readFileSync(path.join(stage,"order-regions.json"),"utf8"));assert.equal(region.version,local.version);
  const token=execFileSync("powershell.exe",["-NoProfile","-Command","& 'C:/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az.cmd' account get-access-token --subscription 02b268fe-e01a-453e-b287-eec83ccc0676 --resource https://storage.azure.com/ --query accessToken -o tsv"],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","inherit"]}).trim();
  async function blob(name,{method="GET",body,conditions={}}={}){
    assert.ok(name==="current.json"||/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(name));
    const r=await fetch(container+name,{method,headers:{Authorization:"Bearer "+token,"x-ms-version":"2023-11-03",...(body?{"x-ms-blob-type":"BlockBlob","Content-Type":name.endsWith(".gz")?"application/gzip":"application/json","Cache-Control":"private, no-store"}:{}),...conditions},body,signal:AbortSignal.timeout(120000)});
    assert.ok(r.ok,`Azure blob ${method} ${r.status}`);return {bytes:Buffer.from(await r.arrayBuffer()),etag:r.headers.get("etag")};
  }
  const current=await blob("current.json"),pointer=JSON.parse(current.bytes);assert.ok(current.etag);
  const before=unpackSnapshot(pointer,(await blob(pointer.blob)).bytes),next=structuredClone(before);
  const key="publicDashboardSources/orderRegions";
  next.documents[key]=Object.fromEntries(["active","regions","version","sourceName"].map(k=>[k,region[k]]));
  next.sourceUpdates[key]=raw.updateTime;next.capturedAt=new Date().toISOString();validate(next);
  assert.deepEqual(next.files,before.files);
  for(const [name,data] of Object.entries(before.documents))if(name!==key)assert.deepEqual(next.documents[name],data);
  const ExcelJS=require("../functions/node_modules/exceljs"),{createService}=require("../firebase-dashboards/backend/service.cjs");
  class ReportError extends Error {constructor(code,message){super(message);this.code=code;}}
  const oldService=createService({...adapters(before),ExcelJS,HttpsError:ReportError}),newService=createService({...adapters(next),ExcelJS,HttpsError:ReportError});
  const checks=[];
  for(const input of [{},{includeCancelled:true,export:true},{filters:{client:"aQuelle"},export:true}]){
    const old=await oldService.orders(input),result=await newService.orders(input);
    assert.deepEqual(result.totals,old.totals);
    if(input.export){assert.equal(result.table.rows.length,old.table.rows.length);for(let i=0;i<old.table.rows.length;i++)for(const field of ["id","orderNumber","orderKey","value","quantity","unitPrice","storeName","storeCode","client","brand","status"])assert.deepEqual(result.table.rows[i][field],old.table.rows[i][field]);}
    checks.push({input,totals:result.totals});
  }
  assert.equal((await json(base+"/publicDashboardSources/orderRegions?mask.fieldPaths=version")).updateTime,raw.updateTime);
  const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(next)),{level:9}),sha256=hash(bytes);assert.ok(bytes.length<=30*1024*1024);
  const name="snapshots/"+sha256+".json.gz";await blob(name,{method:"PUT",body:bytes,conditions:{"If-None-Match":"*"}});assert.equal(hash((await blob(name)).bytes),sha256);
  const updated={...pointer,blob:name,sha256,bytes:bytes.length,capturedAt:next.capturedAt,orderRegionSourceVersion:region.version};
  await blob("current.json",{method:"PUT",body:Buffer.from(JSON.stringify(updated)),conditions:{"If-Match":current.etag}});
  save("azure-regions-published.json",{at:new Date().toISOString(),previous:pointer,updated,regionVersion:region.version,checks,attendanceAndOrdersRecordsUnchanged:true});
  console.log("Azure region lookup published with verified snapshot hash and concurrency protection; order totals and attendance records unchanged.");
}
async function publishAttendance(){
  const job="projects/meridain-nexus/locations/us-central1/jobs/azure-attendance-publisher";
  const config=await json("https://cloudscheduler.googleapis.com/v1/"+job);assert.equal(config.state,"ENABLED");
  await json("https://cloudscheduler.googleapis.com/v1/"+job+":run","POST",{});
  save("attendance-publish-requested.json",{at:new Date().toISOString(),job});console.log("Requested the existing restricted Attendance publisher; no extraction or OTP requested.");
}
async function verify(){
  const before=JSON.parse(fs.readFileSync(path.join(stage,"azure-before.json"),"utf8")),results={at:new Date().toISOString(),attendance:{}};
  const orders=await liveReport("/api/orders",{refresh:true});assert.deepEqual(orders.totals,before.orders);results.orders=orders.totals;
  for(const audience of ["rep","merchandiser"]){
    const r=await liveReport("/api/attendance",{audience,refresh:true});assert.equal(r.operationalWeek,3);assert.equal(r.reportEndDate,before.attendance[audience].through);
    const lookupFile=path.join(stage,"geo-lookup-published.json");
    if(fs.existsSync(lookupFile))assert.ok(Date.parse(r.dataHosting.capturedAt)>=Date.parse(JSON.parse(fs.readFileSync(lookupFile,"utf8")).at),"Azure has not yet published the corrected Geo ID lookup");
    for(const key of ["scheduled","attended","missedVisits","unknownVisits"])assert.equal(r.metrics[key],before.attendance[audience].metrics[key],`${audience}/${key}`);
    assert.equal(r.metrics.attended+r.metrics.missedVisits+r.metrics.unknownVisits,r.metrics.scheduled);
    results.attendance[audience]={through:r.reportEndDate,operationalWeek:r.operationalWeek,metrics:r.metrics,hosting:r.dataHosting};
  }
  save("azure-verified.json",results);console.log(JSON.stringify(results,null,2));
}
const actions={baseline,regions:publishRegions,attendance:publishAttendance,verify};
if(require.main===module)Promise.resolve().then(()=>{assert.ok(actions[process.argv[2]]);return actions[process.argv[2]]();}).catch(e=>{console.error(e.stack);process.exitCode=1;});
