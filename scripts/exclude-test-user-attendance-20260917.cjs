'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {json}=require('./release-multi-admin.cjs');
const E=require('../functions/attendance-exclusions-core');
const ExcelJS=require('../firebase-dashboards/backend/node_modules/exceljs');
const root='projects/meridain-nexus/databases/(default)/documents';
const base=`https://firestore.googleapis.com/v1/${root}`;
const policyUrl=`${base}/geoRepAttendanceConfig/current?mask.fieldPaths=dashboardExclusions`;
const stage=path.resolve(__dirname,'../.tmp/exclude-test-user-20260917');
const requested=E.rule({name:'Test User',userCode:'GRMADMIN',type:'person',audience:'both',enabled:true,reason:'Explicit user request on 2026-09-17: exclude the Test User attendance record shown under Unassigned.'});
function unpack(v){return v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)])):v.arrayValue?(v.arrayValue.values||[]).map(unpack):null));}
const fields=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,pack(v)]));
function pack(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(pack)}};if(typeof v==='object')return {mapValue:{fields:fields(v)}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:v};}
const save=(name,data)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,name),JSON.stringify(data,null,2));};
const load=name=>JSON.parse(fs.readFileSync(path.join(stage,name)));
async function attendance(body){
  const response=await fetch('https://meridian-field-dashboards.azurewebsites.net/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(125000)});
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
async function audit(){
  assert.ok(!fs.existsSync(path.join(stage,'before.json')),'Preserve the original exclusion baseline.');
  const doc=await json(policyUrl),policy=E.policy(unpack(doc.fields.dashboardExclusions));
  const audiences={};
  for(const audience of ['rep','merchandiser']){
    const dashboard=await attendance({audience,refresh:true});
    const matches=dashboard.rows.filter(r=>E.key(r.userCode)==='GRMADMIN'||E.key(r.userName)==='TEST USER');
    for(const r of matches){assert.equal(E.key(r.userCode),'GRMADMIN');assert.equal(E.key(r.userName),'TEST USER');}
    const details=await attendance({audience,mode:'detail',filters:{person:'GRMADMIN'},selection:{metric:'target'},version:dashboard.version});
    assert.ok(details.total<=100,'Review a larger impact before applying the exclusion.');
    assert.equal(details.total,details.rows.length);
    audiences[audience]={version:dashboard.version,metrics:dashboard.metrics,period:dashboard.reportEndDate,updatedAt:dashboard.updatedAt||null,matches:matches.map(r=>({name:r.userName,userCode:r.userCode,manager:r.manager,scheduled:r.scheduled,attended:r.attended})),details:details.rows};
  }
  assert.ok(audiences.rep.matches.length||audiences.merchandiser.matches.length||policy.entries.some(e=>e.id===requested.id&&e.enabled),'Could not identify the requested account.');
  save('before.json',{at:new Date().toISOString(),doc,policy,audiences});console.log(JSON.stringify({revision:policy.revision,existingEntries:policy.entries.length,audiences:Object.fromEntries(Object.entries(audiences).map(([k,v])=>[k,{matches:v.matches,visits:v.details.length}]))},null,2));
}
async function apply(){
  const before=load('before.json'),doc=await json(policyUrl),policy=E.policy(unpack(doc.fields.dashboardExclusions));
  assert.equal(doc.updateTime,before.doc.updateTime,'Exclusions changed since review; do not overwrite concurrent edits.');
  const existing=policy.entries.find(e=>e.id===requested.id);
  if(existing?.enabled){console.log('The exact individual exclusion is already enabled.');return;}
  const entries=policy.entries.filter(e=>e.id!==requested.id).concat(requested);assert.ok(entries.length<=E.MAX_RULES);
  const email=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','config','get-value','account','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  assert.match(email,/^[^\s@]+@[^\s@]+$/);
  const at=new Date().toISOString(),actor={uid:`cloud-operator:${email}`,email,name:'Authorized cloud operator'};
  const next={revision:policy.revision+1,entries,updatedAt:at,updatedBy:actor};E.policy(next);
  await json(`${base}:commit`,'POST',{writes:[
    {update:{name:doc.name,fields:fields({dashboardExclusions:next})},updateMask:{fieldPaths:['dashboardExclusions']},currentDocument:{updateTime:doc.updateTime}},
    {update:{name:`${root}/geoRepAttendanceConfig/current/exclusionAudit/test-user-20260917-${next.revision}`,fields:fields({action:'commit',at,actor,revision:next.revision,entries:[requested],source:'explicit-user-request-cloud-operator'})},currentDocument:{exists:false}}
  ]});
  const saved=E.policy(unpack((await json(policyUrl)).fields.dashboardExclusions));
  assert.deepEqual(saved,E.policy(next));
  assert.deepEqual(saved.entries.filter(e=>e.id!==requested.id),before.policy.entries.filter(e=>e.id!==requested.id));
  save('applied.json',{at,revision:saved.revision,entry:requested,previousEntriesPreserved:true});console.log(`Enabled individual GRMADMIN exclusion at revision ${saved.revision}; existing rules preserved.`);
}
async function verify(){
  const before=load('before.json'),policy=E.policy(unpack((await json(policyUrl)).fields.dashboardExclusions));
  assert.ok(policy.entries.some(e=>e.id===requested.id&&e.enabled));
  assert.deepEqual(policy.entries.filter(e=>e.id!==requested.id),before.policy.entries.filter(e=>e.id!==requested.id));
  const result={at:new Date().toISOString(),revision:policy.revision,audiences:{}};
  for(const audience of ['rep','merchandiser']){
    const data=await attendance({audience,refresh:true}),prior=before.audiences[audience];
    assert.ok(data.rows.every(r=>E.key(r.userCode)!=='GRMADMIN'&&E.key(r.userName)!=='TEST USER'),'Test User must be absent from the roster and scorecard.');
    for(const metric of ['target','actual','missed']){
      const detail=await attendance({audience,mode:'detail',filters:{person:'GRMADMIN'},selection:{metric},version:data.version});assert.equal(detail.total,0);
    }
    const out=await attendance({audience,mode:'export',filters:{person:'GRMADMIN'},selection:{metric:'target'},version:data.version});
    const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(out.base64,'base64'));assert.equal(book.getWorksheet('Visits').rowCount,1);
    const sameSource=!!prior.updatedAt&&data.updatedAt===prior.updatedAt&&data.reportEndDate===prior.period;
    if(sameSource){
      assert.equal(data.metrics.scheduled,prior.metrics.scheduled-prior.details.length);
      assert.equal(data.metrics.attended,prior.metrics.attended-prior.details.filter(r=>r.status==='visited').length);
    }
    result.audiences[audience]={metrics:data.metrics,excludedVisits:prior.details.length,totalsDeltaChecked:sameSource,rosterAbsent:true,detailAbsent:true,excelRows:0};
  }
  save('verified.json',result);console.log(JSON.stringify(result,null,2));
}
const actions={audit,apply,verify};assert.ok(actions[process.argv[2]],'Use audit, apply or verify.');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
