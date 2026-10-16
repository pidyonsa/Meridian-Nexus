"use strict";
const fs=require("node:fs"), path=require("node:path"), vm=require("node:vm"), assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,".."), dir=path.join(root,".tmp/attendance-week-repair-20260914");
const project="meridain-nexus", base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const resource=base.split("/v1/")[1];
const gcloud=(...args)=>execFileSync("powershell.exe",["-NoProfile","-File","C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1",...args],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024});
const unpack=v=>v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)])):v.arrayValue?(v.arrayValue.values||[]).map(unpack):null));
const decode=d=>({id:d.name.split("/").at(-1),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]))});
const save=(name,data)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(data,null,2));
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),"utf8"));
const fn=(code,name)=>{const m=code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));assert.ok(m,name);return m[0];};
async function apiClient(){
  const token=gcloud("auth","print-access-token",`--project=${project}`,"--quiet").trim();
  return async(url,method="GET",body)=>{const r=await fetch(url.startsWith("https:")?url:`${base}/${url}`,{method,headers:{Authorization:`Bearer ${token}`,"x-goog-user-project":project,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error(`API ${r.status}: ${new URL(url.startsWith("https:")?url:`${base}/${url}`).pathname}`);return r.json();};
}
async function audit(){
  const api=await apiClient();
  const schedules=[];
  for(const id of ["sales-force-p-g","sales-force-p-g-monthly"]) schedules.push(await api(`retailers/${id}`));
  const config=await api("salesforceAttendanceConfig/current");
  const lastMonthly=await api("extractionRuns/snFiVhrwrJLe2RRZD1WX");
  const lastDaily=await api("extractionRuns/DfVqvyeGqlJA4HetegZh");
  const jennifer=await api(`adminUsers/${decode(lastMonthly).createdBy}`);
  const uid=decode(jennifer).id;
  const query=async(collection,field,value)=>api(`${base}:runQuery`,"POST",{structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:"EQUAL",value:{stringValue:value}}},limit:100}});
  const tasks=await query("meridianChatTasks","assigneeUid",uid);
  save("audit.json",{checkedAt:new Date().toISOString(),schedules,config,lastMonthly,lastDaily,jennifer,tasks});
  console.log(JSON.stringify({schedules:schedules.map(decode).map(r=>({id:r.id,schedule:r.reportSchedule})),config:decode(config),jennifer:{uid,name:decode(jennifer).name,surname:decode(jennifer).surname,role:decode(jennifer).role,disabled:decode(jennifer).disabled},tasks:tasks.filter(x=>x.document).map(x=>decode(x.document)).map(t=>({id:t.id,title:t.title,status:t.status}))},null,2));
}
async function source({fresh=false}={}){
  const h=require("../tmp/sharepoint_helpers"), ExcelJS=require("../functions/node_modules/exceljs");
  const token=await h.graphToken(), code=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
  const ctx=vm.createContext({...require("../functions/attendance-sharepoint-source"),fs:require("node:fs/promises"),path,ExcelJS,Date,Buffer,console,
    sharePointAccessToken:async()=>token,retryableGraphRequest:h.graphJson,graphRequest:h.graphJson,
    dateStringInZone:()=>"2026-09-14",effectiveReportDatesForRun:r=>({startDate:r.startDate,endDate:r.endDate}),
    salesforceReportType:r=>r.type==="monthly"?"Rep Attendance Monthly":"Rep Attendance Daily",
    downloadSharePointDriveItem:async(t,d,i,p)=>{await h.graphDownload(t,`/drives/${d}/items/${i}/content`,p);return fs.promises.stat(p);}});
  for(const name of ["attendanceCellValue","attendanceText","attendanceHeader","attendanceHeaderColumn","attendanceWorksheetHeader","attendanceWorksheet","salesforceDateValue","attendanceDateValue","resolveSalesforceAttendanceSharePointSource","readSalesforceAttendanceSharePointSource"]) vm.runInContext(fn(code,name),ctx);
  const downloadDir=fresh?path.join(dir,`fresh-${Date.now()}`):dir;
  fs.mkdirSync(downloadDir,{recursive:true});
  const results=[];
  for(const run of [{type:"daily",startDate:"2026-09-11",endDate:"2026-09-11"},{type:"monthly",startDate:"2026-09-01",endDate:"2026-09-11"}]){
    const selected=await ctx.resolveSalesforceAttendanceSharePointSource(run);
    try{const result=await ctx.readSalesforceAttendanceSharePointSource(selected,downloadDir,run);results.push({run,status:"validated",...result});}
    catch(error){results.push({run,status:"unavailable",selectedName:selected.item.name,error:error.message});}
  }
  save(fresh?"fresh-source.json":"source.json",{checkedAt:new Date().toISOString(),downloadDir,results});
  console.log(JSON.stringify(results,null,2));
  const config=fresh?await (await apiClient())("salesforceAttendanceConfig/current"):read("audit.json").config;
  const blueprint=decode(config).attendanceBlueprint;
  const item=await h.graphJson(token,`/drives/${blueprint.driveId}/items/${blueprint.itemId}?$select=id,eTag,name,size,lastModifiedDateTime`);
  const target=path.join(downloadDir,"blueprint-before.xlsx");
  assert.ok(!fs.existsSync(target),"Preserve original backup");
  await h.graphDownload(token,`/drives/${blueprint.driveId}/items/${blueprint.itemId}/content`,target);
  fs.writeFileSync(path.join(downloadDir,"blueprint-before.json"),JSON.stringify({...item,sha256:require("node:crypto").createHash("sha256").update(fs.readFileSync(target)).digest("hex")},null,2));
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(target);
  const sheet=book.getWorksheet(blueprint.monthlyWorksheet);
  const totals=[0,0,0,0,0];sheet.eachRow((row,n)=>{if(n>1)for(let w=1;w<=5;w++)totals[w-1]+=Number(row.getCell(33+w).value)||0;});
  console.log(JSON.stringify({blueprint:item.name,rows:sheet.rowCount,actualWeekTotals:totals,weeklyHeaders:sheet.getRow(1).values.slice(27,39),backupSaved:true}));
}
const pack=v=>v===null?{nullValue:null}:v instanceof Date?{timestampValue:v.toISOString()}:Array.isArray(v)?{arrayValue:{values:v.map(pack)}}:typeof v==="object"?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,pack(x)]))}}:typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{integerValue:String(v)}:{stringValue:String(v)};
const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,pack(x)]));
function repairChecklist(){
  return require("../functions/chat-workflow").checklist([
    "Upload a fresh MTD Salesforce export, Visit Date >= 1 September, generated after Friday 11 September ended, into Rep Attendance Raw Data.",
    "Verify Friday 11 September Daily rows, planned stores and Actual values after the bot completes.",
    "Verify Week 1 is 1-6 September and Week 2 is 7-13 September. Reconcile MTD totals against the complete source.",
    "Retain or reconcile Sunday's corrections from the complete source. Record verified daily and weekly totals in the completion note."
  ].map((text,index)=>({id:`repair-step-${index+1}`,text,done:false})),message=>{throw new Error(message);});
}
async function resume(){
  const api=await apiClient(), audit=read("audit.json"), uid=decode(audit.jennifer).id;
  const deployed=read("function-verified.json");assert.equal(deployed.sourceMatches,true);
  assert.ok(fs.existsSync(path.join(dir,"blueprint-before.xlsx")));
  const profileDoc=await api(`adminUsers/${uid}`),profile=decode(profileDoc);
  assert.equal(profile.disabled,false);assert.notEqual(profile.permissions?.chatEnabled,false);
  assert.ok(["normal","admin"].includes(profile.role));assert.notEqual(profile.accountType,"client");
  assert.equal(profile.permissions?.runJobs,true);assert.equal(profile.permissions?.manageSchedules,true);
  const rooms=read("jennifer-rooms.json").filter(x=>x.document).map(x=>decode(x.document));
  const room=rooms.find(r=>r.type==="direct"&&!r.archived&&r.memberIds.includes(uid)&&r.memberIds.includes("obJuTf8pD3gnNcH9VI0lt74XWZ33"));
  assert.ok(room,"Use Jennifer's existing private Nexus Admin conversation");
  const roomDoc=await api(`meridianChatRooms/${room.id}`);assert.equal(decode(roomDoc).archived,false);assert.ok(decode(roomDoc).memberIds.includes(uid));
  const now=new Date(),stamp=now.toISOString(),maintenance="nexus-maintenance",ownerName=[profile.name,profile.surname].filter(Boolean).join(" ");
  const taskId="attendance-week-repair-20260914-jennifer",writes=[],runs=[];
  for(const id of ["sales-force-p-g","sales-force-p-g-monthly"]){
    const old=audit.schedules.find(d=>decode(d).id===id),fresh=await api(`retailers/${id}`),retailer=decode(fresh),monthly=id.endsWith("monthly"),schedule=retailer.reportSchedule;
    assert.equal(fresh.updateTime,old.updateTime,"Schedule changed since audit; review before resuming");
    assert.equal(schedule.configuredBy,uid);assert.equal(schedule.enabled,false);
    assert.ok(profile.permissions.allowedRetailerIds.includes(id));
    const runId=`attendance-repair-20260914-${monthly?"monthly":"daily"}`;
    const run={retailerId:id,retailerName:retailer.name,extractionProfileId:retailer.extractionProfileId,extractionName:retailer.extractionName||retailer.name,
      workflowMode:null,includeSchedulesReport:false,reportStartDate:monthly?"2026-09-01":"2026-09-14",reportEndDate:monthly?"2026-09-11":"2026-09-14",
      monthlyActualWeek:null,monthlyReconcileAllWeeks:monthly,monthlyRefreshNonce:monthly?"week-repair-20260914":null,
      monthlyWeekStartDate:monthly?"2026-09-01":null,monthlyWeekEndDate:monthly?"2026-09-11":null,dailySmartSellWeekOverride:null,
      trigger:"scheduled-retry",status:"queued",message:`User-approved ${monthly?"September month-to-date through Friday 11 September":"Friday 11 September daily attendance"} repair; wait for a complete SharePoint export.`,
      createdAt:now,createdBy:uid,createdByName:ownerName,createdByEmail:schedule.configuredByEmail,
      scheduledBy:uid,scheduledByName:ownerName,scheduledByEmail:schedule.configuredByEmail,
      maintenanceRequestedBy:maintenance,maintenanceTaskId:taskId,requestedAttendanceEndDate:"2026-09-11",
      executionTimeline:[{at:stamp,event:"maintenance-repair-queued",message:"User-approved recovery assigned to the existing automation owner, Jennifer. Daily reference 14 September resolves to Friday 11 September; Monthly range is 1-11 September. Reject partial exports."}]};
    writes.push({update:{name:`${resource}/extractionRuns/${runId}`,fields:fields(run)},currentDocument:{exists:false}});runs.push({id:runId,monthly});
    const schedulePatch={...schedule,enabled:true,updatedAt:now,maintenanceResumedBy:maintenance,maintenanceTaskId:taskId,
      lastRunKey:`${monthly?"monthly":"daily"}:2026-09-14:${schedule.time}`,lastQueuedRunId:runId,lastQueuedAt:now};
    writes.push({update:{name:fresh.name,fields:fields({reportSchedule:schedulePatch})},updateMask:{fieldPaths:["reportSchedule"]},currentDocument:{updateTime:fresh.updateTime}});
  }
  const checklist=repairChecklist();
  const task={title:"Salesforce attendance: confirm Week 2 correction and Friday 11 September updates",roomId:room.id,sourceMessageId:null,source:"direct",
    assigneeUid:uid,assigneeName:ownerName,createdBy:maintenance,createdByName:"Nexus maintenance",status:"blocked",priority:"high",dueDate:"2026-09-14",store:"",product:"",
    note:"User-approved attendance recovery. The week calculation fix is deployed. Latest raw export was Friday 11 September at 09:26 SAST and is complete only through Thursday 10 September. Friday Daily and Monthly through 11 September are queued with source validation and bounded retries. Publish a complete source, then check Job summaries and both workbook tabs. Current SharePoint workbook was modified Sunday 13 September and has been backed up; do not overwrite it with the old partial export. Existing 08:00 Daily and 09:00 Monthly schedules remain assigned to Jennifer and are resumed. If the source arrives after the two-hour retry window, rerun from Report automation.",
    progressNote:"Waiting for a complete Friday source export.",checklist,requireCompletionNote:true,revision:1,assignmentVersion:1,reminderVersion:1,
    remindAt:new Date(now.getTime()+60*60000).toISOString().replace(/:\d{2}\.\d{3}Z$/,":00.000Z"),createdAt:now,updatedAt:now,assignedAt:now,
    history:[{at:stamp,by:"Nexus maintenance",status:"blocked",note:"Task assigned following the portal owner's request; waiting for complete source data."}],maintenanceRunIds:runs.map(r=>r.id)};
  writes.push({update:{name:`${resource}/meridianChatTasks/${taskId}`,fields:fields(task)},currentDocument:{exists:false}});
  for(const [id,data] of [[`assigned_${taskId}`,{taskId,kind:"task",revision:1,nextAt:now,expiresAt:new Date(now.getTime()+7*86400000)}],[taskId,{taskId,revision:1,nextAt:new Date(task.remindAt),expiresAt:new Date(Date.parse(task.remindAt)+7*86400000)}]])writes.push({update:{name:`${resource}/meridianChatReminders/${id}`,fields:fields(data)},currentDocument:{exists:false}});
  writes.push({update:{name:roomDoc.name,fields:fields({updatedAt:now})},updateMask:{fieldPaths:["updatedAt"]},currentDocument:{updateTime:roomDoc.updateTime}});
  writes.push({update:{name:`${resource}/meridianChatAudit/${taskId}`,fields:fields({actorUid:maintenance,action:"task-created-maintenance",roomId:room.id,messageId:taskId,createdAt:now,authorization:"Portal owner requested attendance repair and Jennifer assignment"})},currentDocument:{exists:false}});
  writes.push({verify:profileDoc.name,currentDocument:{updateTime:profileDoc.updateTime}});
  save("resume-plan.json",{createdAt:stamp,runs,taskId,writes});
  const result=await api(`${base}:commit`,"POST",{writes});save("resume-result.json",result);
  console.log(JSON.stringify({resumed:true,runs,taskId,assignedTo:ownerName,scheduleTimes:["08:00 Daily","09:00 Monthly"],sourceGateRetained:true}));
}
async function status(){
  const api=await apiClient(),plan=read("resume-plan.json"),runs=[];
  for(const entry of plan.runs){const run=decode(await api(`extractionRuns/${entry.id}`));runs.push({id:run.id,status:run.status,message:run.message,reportStartDate:run.reportStartDate,reportEndDate:run.reportEndDate,monthlyWeekStartDate:run.monthlyWeekStartDate,monthlyWeekEndDate:run.monthlyWeekEndDate,sourceSharePoint:run.sourceSharePoint,salesforceAutoRetry:run.salesforceAutoRetry,owner:run.createdByName});}
  const task=decode(await api(`meridianChatTasks/${plan.taskId}`));
  const result={checkedAt:new Date().toISOString(),runs,task:{id:task.id,assignee:task.assigneeName,status:task.status}};
  save("status.json",result);console.log(JSON.stringify(result,null,2));
}
async function validateTask(){
  const api=await apiClient(),id=read("resume-plan.json").taskId,doc=await api(`meridianChatTasks/${id}`),task=decode(doc);
  const fail=message=>{throw new Error(message);},workflow=require("../functions/chat-workflow");
  try{workflow.checklist(task.checklist,fail);console.log("Task checklist validated");return;}catch{}
  assert.equal(task.revision,1,"Task changed since creation");assert.ok(task.checklist.every(s=>s.done===false));
  save("task-before-validation.json",doc);
  const patch={checklist:repairChecklist(),revision:2,updatedAt:new Date()};
  await api(`${base}:commit`,"POST",{writes:[{update:{name:doc.name,fields:fields(patch)},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:{updateTime:doc.updateTime}}]});
  workflow.checklist(decode(await api(`meridianChatTasks/${id}`)).checklist,fail);
  console.log("Jennifer task checklist validated and editable");
}
async function stagger(){
  const api=await apiClient(),daily=decode(await api("extractionRuns/attendance-repair-20260914-daily")),doc=await api("extractionRuns/attendance-repair-20260914-monthly"),monthly=decode(doc);
  assert.equal(daily.salesforceAutoRetry?.status,"waiting");assert.equal(monthly.salesforceAutoRetry?.status,"waiting");
  assert.equal(monthly.status,"failed");assert.ok(!monthly.salesforceAutoRetry.retryQueuedRunId);
  const retry={...monthly.salesforceAutoRetry,nextAttemptAt:new Date(Date.parse(daily.salesforceAutoRetry.nextAttemptAt)+5*60000).toISOString()};
  assert.ok(Date.parse(retry.nextAttemptAt)<Date.parse(retry.deadlineAt));
  const patch={salesforceAutoRetry:retry,maintenanceRetryNote:"Monthly source check offset five minutes after Daily to avoid simultaneous writes to the shared attendance workbook."};
  save("monthly-retry-before.json",doc);
  await api(`${base}:commit`,"POST",{writes:[{update:{name:doc.name,fields:fields(patch)},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:{updateTime:doc.updateTime}}]});
  console.log(JSON.stringify({dailyCheck:daily.salesforceAutoRetry.nextAttemptAt,monthlyCheck:retry.nextAttemptAt,reportingDatesUnchanged:true}));
}
async function live(){
  const api=await apiClient(),runs=[];
  for(const type of ["daily","monthly"]){
    let id=`attendance-repair-20260914-${type}`;
    const seen=new Set();
    while(id){
      assert.ok(!seen.has(id)&&seen.size<20,"Unexpected retry chain");seen.add(id);
      const run=decode(await api(`extractionRuns/${id}`));runs.push(run);
      const children=await api(`${base}:runQuery`,"POST",{structuredQuery:{from:[{collectionId:"extractionRuns"}],where:{fieldFilter:{field:{fieldPath:"parentRunId"},op:"EQUAL",value:{stringValue:id}}},limit:20}});
      runs.push(...children.filter(x=>x.document).map(x=>decode(x.document)));
      id=run.salesforceAutoRetry?.retryQueuedRunId||run.salesforceAutoRetryQueuedRunId||"";
    }
  }
  const query=await api(`${base}:runQuery`,"POST",{structuredQuery:{from:[{collectionId:"extractionRuns"}],where:{fieldFilter:{field:{fieldPath:"status"},op:"IN",value:{arrayValue:{values:["queued","running","waiting"].map(stringValue=>({stringValue}))}}}},limit:300}});
  assert.ok(query.filter(x=>x.document).length<300,"Active run listing incomplete");
  const active=query.filter(x=>x.document).map(x=>decode(x.document)).filter(r=>["sales-force-p-g","sales-force-p-g-monthly"].includes(r.retailerId));
  save("live-runs.json",{checkedAt:new Date().toISOString(),runs,active});
  const summary=r=>({id:r.id,type:r.retailerId,status:r.status,workflow:r.workflowMode,parent:r.parentRunId,retry:r.salesforceAutoRetry,source:r.sourceSharePoint?.name,createdAt:r.createdAt,completedAt:r.completedAt,message:r.message,blueprint:r.attendanceBlueprint?.monthlyPlan||r.attendanceBlueprint?.actualOneRows});
  console.log(JSON.stringify({runs:runs.map(summary),active:active.map(summary)},null,2));
}
fs.mkdirSync(dir,{recursive:true});
const actions={audit,source,fresh:()=>source({fresh:true}),resume,status,validateTask,stagger,live};
if(require.main===module)(actions[process.argv[2]]?actions[process.argv[2]]():Promise.reject(new Error("Unknown attendance repair action"))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={apiClient,base,resource,decode,fields,dir,read,save,fn};
