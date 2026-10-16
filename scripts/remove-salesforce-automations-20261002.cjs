'use strict';
// User request, 2 October 2026: remove all Salesforce, Salesforce Display Compliance and P&G Perfect Store
// automations. Compute is deleted; business data (runs, masters, snapshots, files, SharePoint outputs) is kept.
// Stages: backup -> disable -> remove (scheduler jobs, functions, retailers/profiles, credentials/sessions).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,fnUrl}=require('./release-multi-admin.cjs');
const P='meridain-nexus',root=`projects/${P}/databases/(default)/documents`,base=`https://firestore.googleapis.com/v1/${root}`;
const stage=path.resolve(__dirname,'../.tmp/remove-salesforce-automations-20261002');
const save=(file,value)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2));};
const RETAILERS=['sales-force-p-g','sales-force-p-g-monthly','salesforce-display-compliance-automation','p-g-perfect-store'];
const PROFILES=['salesforce-pg-rep-attendance-daily-steps','salesforce-pg-rep-attendance-monthly-steps','salesforce-display-compliance-automation-steps','p-g-perfect-store-sos-overview-steps'];
const FUNCTIONS=['createSalesforceMonthlyAttendanceBlueprint','finalizeExpiredSalesforceAttendanceWorkers','getSalesforceAttendanceDashboard','getSalesforceAttendanceWorkbookSnapshotRows','retrySalesforceAttendanceReportLoadFailures','runSalesforceMonthlyAttendancePlanSetup','runScheduledSalesforceMonthlyAttendanceBlueprintProvisioning','runScheduledSalesforceMonthlyAttendancePlanSetup','saveSalesforceAttendanceBlueprint','saveSalesforceAttendanceMonthlySmartSellMaster','saveSalesforceAttendanceSmartSellMaster','saveSalesforceMonthlyAttendanceBlueprintProvisioning','saveSalesforceMonthlyAttendancePlanSetup','saveSharedSmartSellMaster','testSalesforceConnectedApp',
  'advanceSalesforceDisplayComplianceBatch','processSalesforceDisplayCompliancePhaseTwoReferenceRun','queueSalesforceDisplayCompliancePhaseTwoAfterBatch','reconcileSalesforceDisplayCompliancePhaseTwoInputs','saveSalesforceDisplayComplianceChannels','saveSalesforceDisplayCompliancePhaseTwoAutomation','saveSalesforceDisplayComplianceSmartSellMaster','saveSalesforceDisplayComplianceTemplateFolder','scanSalesforceDisplayCompliancePhaseTwoInputs','startSalesforceDisplayComplianceFile1Batch','startSalesforceDisplayCompliancePhaseTwoReferenceValidation'];
const JOBS=FUNCTIONS.map(f=>`firebase-schedule-${f}-us-central1`);
const jobUrl=name=>`https://cloudscheduler.googleapis.com/v1/projects/${P}/locations/us-central1/jobs/${name}`;
async function get(url){try{return await json(url);}catch(e){if(/ 404:/.test(e.message))return null;throw e;}}
async function activeRuns(){
  const out=[];
  for(const v of RETAILERS){const r=await json(`${base}:runQuery`,'POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:[{fieldPath:'status'}]},where:{fieldFilter:{field:{fieldPath:'retailerId'},op:'EQUAL',value:{stringValue:v}}}}});
    out.push(...r.filter(x=>x.document&&['queued','running','waiting'].includes(x.document.fields?.status?.stringValue)).map(x=>({id:x.document.name.split('/').at(-1),retailerId:v,status:x.document.fields.status.stringValue})));}
  return out;
}
async function backup(){
  const out={at:new Date().toISOString(),retailers:{},profiles:{},functions:{},jobs:{}};
  for(const id of RETAILERS){const d=await get(`${base}/retailers/${id}`);assert.ok(d,'missing retailer '+id);out.retailers[id]=d;}
  for(const id of PROFILES){const d=await get(`${base}/extractionProfiles/${id}`);assert.ok(d,'missing profile '+id);out.profiles[id]=d;}
  for(const f of FUNCTIONS){const d=await get(fnUrl(f));assert.ok(d,'missing function '+f);out.functions[f]=d;}
  const allJobs=(await json(`https://cloudscheduler.googleapis.com/v1/projects/${P}/locations/us-central1/jobs?pageSize=500`)).jobs||[];
  for(const j of allJobs){const n=j.name.split('/').at(-1);if(JOBS.includes(n))out.jobs[n]=j;}
  out.activeRuns=await activeRuns();
  save('backup.json',out);
  console.log(JSON.stringify({retailers:Object.keys(out.retailers).length,profiles:Object.keys(out.profiles).length,functions:Object.keys(out.functions).length,schedulerJobs:Object.keys(out.jobs),activeRuns:out.activeRuns}));
}
async function disable(){
  const b=JSON.parse(fs.readFileSync(path.join(stage,'backup.json')));
  for(const id of RETAILERS){const d=await json(`${base}/retailers/${id}?mask.fieldPaths=reportSchedule`);
    if(d.fields?.reportSchedule?.mapValue?.fields?.enabled?.booleanValue===true){await json(`${base}:commit`,'POST',{writes:[{update:{name:d.name,fields:{reportSchedule:{mapValue:{fields:{enabled:{booleanValue:false}}}}}},updateMask:{fieldPaths:['reportSchedule.enabled']},currentDocument:{updateTime:d.updateTime}}]});console.log('schedule disabled',id);}}
  for(const n of Object.keys(b.jobs)){const j=await get(jobUrl(n));if(j&&j.state==='ENABLED'){await json(jobUrl(n)+':pause','POST',{});console.log('paused',n);}}
  console.log('active runs',JSON.stringify(await activeRuns()));
}
async function remove(){
  const b=JSON.parse(fs.readFileSync(path.join(stage,'backup.json')));const log={at:new Date().toISOString(),deleted:[]};
  const active=await activeRuns();
  assert.equal(active.length,0,'Active Salesforce/Perfect Store runs: '+JSON.stringify(active));
  for(const n of Object.keys(b.jobs)){if(await get(jobUrl(n))){await json(jobUrl(n),'DELETE');log.deleted.push('scheduler:'+n);console.log('deleted job',n);}}
  const ops=[];
  for(const f of FUNCTIONS){if(await get(fnUrl(f)))ops.push({f,op:await json(fnUrl(f),'DELETE')});}
  for(const {f,op} of ops){for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,f+': '+JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,10000));}log.deleted.push('function:'+f);console.log('deleted function',f);}
  const writes=[];
  for(const id of RETAILERS)writes.push({delete:`${root}/retailers/${id}`});
  for(const id of PROFILES)writes.push({delete:`${root}/extractionProfiles/${id}`});
  // Stored credentials and browser/session state for the removed automations (deliberately not backed up).
  for(const col of ['retailerSecrets','retailerSessions'])for(const id of RETAILERS)if(await get(`${base}/${col}/${id}`))writes.push({delete:`${root}/${col}/${id}`});
  for(const col of ['salesforceMfaState','salesforceBrowserLeases']){let t='';do{const r=await json(`${base}/${col}?pageSize=300&mask.fieldPaths=__name__${t?'&pageToken='+t:''}`);for(const d of r.documents||[])writes.push({delete:d.name});t=r.nextPageToken||'';}while(t);}
  for(let i=0;i<writes.length;i+=400)await json(`${base}:commit`,'POST',{writes:writes.slice(i,i+400)});
  log.deleted.push(...writes.map(w=>'firestore:'+w.delete.split('/documents/')[1]));
  for(const id of RETAILERS)assert.equal(await get(`${base}/retailers/${id}`),null);
  for(const f of FUNCTIONS)assert.equal(await get(fnUrl(f)),null);
  save('removed.json',log);console.log(`Removed ${log.deleted.length} items; business data kept.`);
}
const actions={backup,disable,remove};if(!actions[process.argv[2]])throw Error('Use backup, disable or remove');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
