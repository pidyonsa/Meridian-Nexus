"use strict";
const fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const project="meridain-nexus",base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const gcloud=(...args)=>execFileSync("powershell.exe",["-NoProfile","-File","C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1",...args],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","pipe"],maxBuffer:12*1024*1024});
const unpack=v=>v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)])):v.arrayValue?(v.arrayValue.values||[]).map(unpack):null));
const decode=d=>({id:d.name.split("/").at(-1),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]))});
async function main(){
  const token=gcloud("auth","print-access-token",`--project=${project}`,"--quiet").trim();
  async function api(url,method="GET",body){const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,"x-goog-user-project":project,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error(`Read-only audit HTTP ${r.status}: ${new URL(url).pathname}`);return r.json();}
  const report={checkedAt:new Date().toISOString(),schedules:[],runs:[]};
  const ids=["sales-force-p-g","sales-force-p-g-monthly"];
  for(const id of ids){
    const p=decode(await api(`${base}/retailers/${id}`));
    const s=p.reportSchedule||{};
    report.schedules.push({id,name:p.name,extractionProfileId:p.extractionProfileId,workflowMode:p.workflowMode,stepCount:p.steps?.length||0,schedule:Object.fromEntries(["enabled","frequency","time","daysOfWeek","businessDaysOnly","dayOfMonth","monthlyRunCadence","dateMode","reportStartDate","reportEndDate","monthlyActualWeek","monthlyReconcileAllWeeks","monthlyWeekStartDate","monthlyWeekEndDate","lastRunKey","lastQueuedRunId","lastQueuedAt","ownerUid","ownerName"].map(k=>[k,s[k]]).filter(([,v])=>v!==undefined))});
  }
  const fields=["retailerId","status","message","error","createdAt","startedAt","completedAt","updatedAt","heartbeatAt","lastActivityAt","reportStartDate","reportEndDate","trigger","scheduleRunKey","scheduleFrequency","createdByName","parentRunId","retryOfRunId","workflowMode","attendanceReportType","monthlyActualWeek","monthlyReconcileAllWeeks","sourceSharePoint","sourceFileId","resultFileId","fileIds","attendanceBlueprintUpdateId","executionTimeline","workerExecutionName","cancelRequested","failureDiagnosis"];
  const cutoff=new Date(Date.now()-5*86400000).toISOString();
  let cursor;
  for(let page=0;page<20;page++){
    const structuredQuery={from:[{collectionId:"extractionRuns"}],select:{fields:fields.map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:"createdAt"},op:"GREATER_THAN_OR_EQUAL",value:{timestampValue:cutoff}}},orderBy:[{field:{fieldPath:"createdAt"},direction:"DESCENDING"},{field:{fieldPath:"__name__"},direction:"DESCENDING"}],limit:300,...(cursor?{startAt:cursor}:{})};
    const result=await api(`${base}:runQuery`,"POST",{structuredQuery}),documents=result.filter(x=>x.document).map(x=>x.document);
    report.runs.push(...documents.map(decode).filter(r=>ids.includes(r.retailerId)));
    if(documents.length<300)break;
    if(page===19)throw new Error("Run history scan exceeded its bounded limit; not complete");
    const last=documents.at(-1);cursor={before:false,values:[last.fields.createdAt,{referenceValue:last.name}]};
  }
  const jobs=await api(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-central1/jobs?pageSize=500`);
  if(jobs.nextPageToken)throw new Error("Incomplete scheduler listing");
  report.scheduler=jobs.jobs.filter(j=>/runScheduledExtractions/i.test(j.name)).map(j=>({name:j.name,state:j.state,schedule:j.schedule,timeZone:j.timeZone,lastAttemptTime:j.lastAttemptTime,status:j.status,scheduleTime:j.scheduleTime}));
  const out=path.resolve(__dirname,"../.tmp/attendance-diagnostics");fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,`audit-${Date.now()}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,runs:report.runs.map(r=>({...r,executionTimeline:r.executionTimeline?.slice(-6)}))},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
