'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {json,api,fnUrl}=require('./release-multi-admin.cjs');
const E=require('../functions/attendance-exclusions-core');
const project='meridain-nexus',documentRoot=`projects/${project}/databases/(default)/documents`;
const base=`https://firestore.googleapis.com/v1/${documentRoot}`;
const out=path.resolve(__dirname,'../.tmp/attendance-exclusions-20260916/refresh');
const requested=[['Adrian Myburgh','12654'],['Cules Van Dyk','15674'],['Keanu Myburgh','12456'],['Tyrique Myburgh','4346']];
const entries=requested.map(([name,userCode])=>E.rule({name,userCode,type:'person',audience:'both',reason:'User-requested exclusion; removed from Geo Rep. Manager: Les Van Dyk.'}));
function unpack(v){return v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)])):v.arrayValue?(v.arrayValue.values||[]).map(unpack):null));}
const decode=d=>({id:d.name.split('/').at(-1),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]))});
function pack(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(pack)}};if(typeof v==='object')return {mapValue:{fields:fields(v)}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return {stringValue:v};}
const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,pack(x)]));
const save=(name,v)=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2));};
const read=p=>json(`${base}/${p}`);
const select=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]]).filter(([,x])=>x!==undefined));
async function query(collection,field,value){const r=await json(`${base}:runQuery`,'POST',{structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:value}}},limit:1000}});const docs=r.filter(x=>x.document);assert.ok(docs.length<1000,'Query exceeded its safety limit; do not assume active jobs are absent');return docs.map(x=>decode(x.document));}
function actor(){const email=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','config','get-value','account','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();assert.ok(/^[^\s@]+@[^\s@]+$/.test(email));return {uid:`cloud-operator:${email}`,name:'Authorized cloud operator',email};}
async function audit(){
  const p=decode(await read('retailers/geo-rep-attendance-for-reps'));
  const profile=p.extractionProfileId?decode(await read(`extractionProfiles/${p.extractionProfileId}`)):p;
  const config=decode(await read('geoRepAttendanceConfig/current'));
  const source=decode(await read('geoRepAttendanceDashboard/current'));
  const runs=(await query('extractionRuns','retailerId',p.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,12);
  const report={at:new Date().toISOString(),retailer:select(p,['id','name','extractionProfileId','reportSchedule']),profile:{...select(profile,['id','name','workflowMode']),actions:profile.steps?.map(s=>s.action)},policy:E.policy(config.dashboardExclusions),operationalWeek:config.operationalWeek,
    source:select(source,['updatedAt','source','reportStartDate','reportEndDate','runId']),matchingStaff:(source.rows||[]).filter(p=>entries.some(e=>E.key(e.userCode)===E.key(p.userCode))).map(p=>select(p,['userName','userCode','manager','role','scheduled','onSchedule'])),
    runs:runs.map(r=>select(r,['id','status','createdAt','completedAt','workflowMode','extractionProfileId','reportStartDate','reportEndDate','message','fileId','attendanceTrackerUpdateRunId','merchandiserTrackerUpdateRunId','companionRunIds','reportIdentity','createdBy','createdByName']))};
  save('audit.json',report);console.log(JSON.stringify(report,null,2));
}
async function exclude(){
  const doc=await read('geoRepAttendanceConfig/current'),config=E.policy(decode(doc).dashboardExclusions);
  const next=new Map(config.entries.map(e=>[e.id,e])),affected=[];
  for(const entry of entries){const old=next.get(entry.id);if(!old||!old.enabled){next.set(entry.id,entry);affected.push(entry);}}
  if(!affected.length){console.log('All four requested staff-code exclusions are already enabled.');return;}
  assert.ok(next.size<=E.MAX_RULES);
  const at=new Date().toISOString(),by=actor(),policy={revision:config.revision+1,entries:[...next.values()],updatedAt:at,updatedBy:by};
  E.policy(policy);
  const auditPath=`${documentRoot}/geoRepAttendanceConfig/current/exclusionAudit/requested-20260916-${policy.revision}`;
  await json(`${base}:commit`,'POST',{writes:[
    {update:{name:doc.name,fields:fields({dashboardExclusions:policy})},updateMask:{fieldPaths:['dashboardExclusions']},currentDocument:{updateTime:doc.updateTime}},
    {update:{name:auditPath,fields:fields({action:'commit',at,actor:by,revision:policy.revision,entries:affected,source:'explicit-user-request-cloud-operator'})},currentDocument:{exists:false}}
  ]});
  const saved=E.policy(decode(await read('geoRepAttendanceConfig/current')).dashboardExclusions);
  assert.equal(saved.revision,policy.revision);for(const e of entries)assert.ok(saved.entries.some(r=>r.id===e.id&&r.enabled));
  const result={at,revision:saved.revision,added:affected.map(e=>({name:e.name,userCode:e.userCode,type:e.type,audience:e.audience})),managerTeamExcluded:false};save('exclusions-applied.json',result);console.log(JSON.stringify(result,null,2));
}
const runId='manual-georep-attendance-refresh-20260916-exclusions';
async function queue(){
  const p=decode(await read('retailers/geo-rep-attendance-for-reps'));
  assert.equal(p.extractionProfileId,'geo-rep-rep-attendance-strike-rate-steps');
  const profile=decode(await read(`extractionProfiles/${p.extractionProfileId}`));
  assert.equal(profile.workflowMode,'geo-rep-rep-attendance');
  assert.ok(profile.steps.some(s=>s.action==='geoRepDownloadRepAttendanceReport'));
  const current=(await query('extractionRuns','retailerId',p.id));
  if(current.some(r=>r.id===runId)){console.log('The requested fresh-export job already exists: '+runId);return;}
  assert.ok(!current.some(r=>['queued','running','cancelling','waiting'].includes(r.status)),'An attendance job is active; wait before creating another');
  const policy=E.policy(decode(await read('geoRepAttendanceConfig/current')).dashboardExclusions);
  for(const e of entries)assert.ok(policy.entries.some(r=>r.id===e.id&&r.enabled),'Apply requested exclusions before downloading');
  const fn=await json(fnUrl('processExtraction')),s=fn.buildConfig.source.storageSource;
  const zip=await require('../functions/node_modules/jszip').loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const code=await zip.file('index.js').async('string');
  assert.match(code,/if \(optionalText\(run.reportIdentityOverride, 400\)\) return optionalText\(run.reportIdentityOverride, 400\)/,'Live worker must support explicit fresh report identities');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  assert.equal(today,'2026-09-16','This is a date-scoped, user-requested maintenance run');
  const end=new Date(`${today}T00:00:00Z`);end.setUTCDate(end.getUTCDate()-1);
  const startDate=today.slice(0,7)+'-01',endDate=end.toISOString().slice(0,10),at=new Date().toISOString(),by=actor();
  const run={retailerId:p.id,retailerName:p.name,extractionProfileId:profile.id,extractionName:profile.name,
    workflowMode:profile.workflowMode,includeSchedulesReport:false,reportStartDate:startDate,reportEndDate:endDate,
    reportIdentityOverride:`${p.id}--strike-rate-report--${startDate}--${endDate}--refresh-${runId}`,
    trigger:'manual-refresh',status:'queued',message:'Fresh Geo Rep export requested after staff removals; keep existing scheduled automation unchanged.',
    createdBy:by.uid,createdByEmail:by.email,createdByName:by.name,
    executionTimeline:[{event:'queued',at,message:'User requested a new syndicated export after removing four staff in Geo Rep; individual staff-code exclusions are enabled.'}]};
  const f=fields(run);f.createdAt={timestampValue:at};f.lastActivityAt={timestampValue:at};
  await json(`${base}:commit`,'POST',{writes:[{update:{name:`${documentRoot}/extractionRuns/${runId}`,fields:f},currentDocument:{exists:false}}]});
  const result={runId,queuedAt:at,reportStartDate:startDate,reportEndDate:endDate,sourceProfile:profile.id,freshIdentity:run.reportIdentityOverride,workerRevision:fn.serviceConfig.revision};save('queued.json',result);console.log(JSON.stringify(result,null,2));
}
async function status(){
  const parent=decode(await read(`extractionRuns/${runId}`));
  const records=[parent];
  for(const id of [parent.attendanceTrackerUpdateRunId,parent.merchandiserTrackerUpdateRunId,...(parent.companionRunIds||[])].filter(Boolean))records.push(decode(await read(`extractionRuns/${id}`)));
  const report={at:new Date().toISOString(),runs:records.map(r=>({...select(r,['id','status','message','createdAt','startedAt','completedAt','fileId','fileName','fileSha256','isDuplicate','reportIdentity','currentStep','currentStepAction','error','failureCategory']),executionTimeline:r.executionTimeline?.slice(-3)}))};
  save('status.json',report);console.log(JSON.stringify(report,null,2));
}
async function verify(){
  const run=decode(await read(`extractionRuns/${runId}`));assert.equal(run.status,'completed');assert.notEqual(run.isDuplicate,true,'Must use a freshly downloaded report');
  const file=decode(await read(`files/${run.fileId}`));assert.equal(file.extractionRunId,runId);
  assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.equal(file.sha256,run.fileSha256);
  assert.ok(new Date(file.uploadedAt)>=new Date(run.createdAt));
  // Verify the bot's unfiltered import rather than expanding operator access
  // to private source objects. The bot retains its existing storage permissions.
  const dashboards=[];
  for(const [audience,docId,child]of [['rep','current',run.attendanceTrackerUpdateRunId],['merchandiser','merchandisers',run.merchandiserTrackerUpdateRunId]]){
    assert.ok(child);assert.equal(decode(await read(`extractionRuns/${child}`)).status,'completed');
    const source=decode(await read(`geoRepAttendanceDashboard/${docId}`));assert.equal(source.source.schedules.fileId,run.fileId);
    const requestedSourcePeople=(source.rows||[]).filter(p=>entries.some(e=>E.key(p.userCode)===E.key(e.userCode)));
    assert.equal(requestedSourcePeople.length,0,'Requested user codes remain in the new unfiltered staff import');
    let data;
    for(let attempt=0;attempt<10;attempt++){
      const response=await fetch('https://meridian-field-dashboards.azurewebsites.net/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audience}),signal:AbortSignal.timeout(125000)});
      assert.equal(response.status,200);data=await response.json();
      if(Date.parse(data.updatedAt)===Date.parse(source.updatedAt)&&data.quality.exclusionRevision>=1)break;
      if(attempt===9)throw Error('Public viewer did not refresh to the new import');
      await new Promise(r=>setTimeout(r,20000));
    }
    const isRequested=p=>entries.some(e=>E.key(p.userCode)===E.key(e.userCode)||E.key(p.userName)===E.key(e.name));
    assert.ok(!data.rows.some(isRequested));assert.ok(!data.reconciliation.some(isRequested));
    dashboards.push({audience,updatedAt:data.updatedAt,period:[data.reportStartDate,data.reportEndDate],metrics:data.metrics,sourceStaffRows:source.rows.length,sourceScheduleRows:source.source.schedules.selectedRows,requestedCodesAbsentFromUnfilteredStaffImport:true,exclusionRevision:data.quality.exclusionRevision,adminExcludedVisits:data.quality.adminExcludedVisits,requestedPeopleAbsent:true});
  }
  const result={verifiedAt:new Date().toISOString(),runId,fileId:file.id,sha256:file.sha256,newExport:true,verificationBasis:'Completed bot download, immutable file metadata, unfiltered staff import and live dashboard responses; no direct operator read of private workbook',dashboards};save('fresh-export-verified.json',result);console.log(JSON.stringify(result,null,2));
}
const actions={audit,exclude,queue,status,verify};if(!actions[process.argv[2]])throw Error('Use audit, exclude, queue, status or verify');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
