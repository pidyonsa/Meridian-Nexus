'use strict';
// User request, 4 October 2026: remove Stock Fix and Sales Insights from the Google/Firebase Nexus and do
// not move them. Deletes their code (functions, schedules, Cloud Run jobs/service, images, service
// accounts, secret) and their Firestore collections. SharePoint and Firebase Storage files are NOT touched.
// Stages: backup -> disable -> remove-compute -> remove-data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,fnUrl}=require('./release-multi-admin.cjs');
const {decode}=require('../azure-field-dashboards/attendance-publisher/index.cjs');
const P='meridain-nexus',root=`projects/${P}/databases/(default)/documents`,base=`https://firestore.googleapis.com/v1/${root}`;
const stage=path.resolve(__dirname,'../.tmp/remove-stockfix-insights-20261004');
const save=(file,value)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2));};
const FUNCTIONS=['syncStockFixSharePointSource','getSalesInsightsRoute','getStockFixAdoptionDashboard','getStockFixOperationalRoster','getStockFixDashboard','startStockFixPipelineRun','closeStockFixOperationalWeek','publishStockFixFirebaseWeek','completeStockFixOperationalTask','getStockFixAutomationStatus','getStockFixOperationalWorkspace','getStockFixFirebaseStatus','runScheduledStockFixSharePointSync','refreshSalesInsightsSnapshot','publishSalesInsightsPipelineResult','publishStockFixAdoptionWorkbook','runScheduledSalesInsightsSnapshot','getSalesInsightsDashboard','getStockFixOperationalTask','saveStockFixOperationalRosterMember'];
const JOBS=['firebase-schedule-runScheduledStockFixSharePointSync-us-central1','firebase-schedule-runScheduledSalesInsightsSnapshot-us-central1'];
const RUN_JOBS=['stockfix-pipeline','sales-insights-pipeline'],RUN_SERVICES=['sales-insights-query'];
const COLLECTIONS=['salesInsightsPipelineRuns','salesInsightsPipelineState','salesInsightsSnapshots','stockFixAdoptionWeeks','stockFixAutomation','stockFixOperationalTasks','stockFixOperationalWeeks','stockFixPipelineRuns','stockFixWeeks'];
const ACCOUNTS=['stockfix-worker','sales-insights-worker','sales-insights-query'].map(a=>`${a}@${P}.iam.gserviceaccount.com`);
const SECRETS=['SALES_INSIGHTS_LEGACY_API_KEY'];
const IMAGES=['sales-insights-pipeline','sales-insights-query','stockfix-pipeline'];
const RUN=`https://run.googleapis.com/v2/projects/${P}/locations/us-central1`,SCHED=`https://cloudscheduler.googleapis.com/v1/projects/${P}/locations/us-central1/jobs`;
const AR=`https://artifactregistry.googleapis.com/v1/projects/${P}/locations/us-central1/repositories/cloud-run-source-deploy/packages`;
async function get(url){try{return await json(url);}catch(e){if(/ 404:/.test(e.message))return null;throw e;}}
async function* documents(collection){let t='';do{const r=await json(`${base}/${collection}?pageSize=300${t?'&pageToken='+t:''}`);for(const d of r.documents||[])yield d;t=r.nextPageToken||'';}while(t);}
async function active(){
  const out=[];
  for(const c of ['stockFixPipelineRuns','salesInsightsPipelineRuns'])for await(const d of documents(c)){const s=d.fields?.status?.stringValue;if(['queued','running','waiting','preparing'].includes(s))out.push(`${c}/${d.name.split('/').at(-1)}:${s}`);}
  return out;
}
async function backup(){
  const out={at:new Date().toISOString(),functions:{},scheduler:{},runJobs:{},runServices:{},accounts:{},collections:{}};
  for(const f of FUNCTIONS)out.functions[f]=await get(fnUrl(f));
  for(const j of JOBS)out.scheduler[j]=await get(`${SCHED}/${j}`);
  for(const j of RUN_JOBS)out.runJobs[j]=await get(`${RUN}/jobs/${j}`);
  for(const s of RUN_SERVICES)out.runServices[s]=await get(`${RUN}/services/${s}`);
  for(const a of ACCOUNTS)out.accounts[a]=await get(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts/${a}`);
  for(const c of COLLECTIONS){
    const file=path.join(stage,`firestore-${c}.ndjson`);fs.mkdirSync(stage,{recursive:true});const stream=fs.createWriteStream(file);let n=0,sub=0;
    for await(const d of documents(c)){stream.write(JSON.stringify({name:d.name,updateTime:d.updateTime,data:decode({mapValue:{fields:d.fields||{}}})})+'\n');n++;
      if(n<=50){const subs=(await json(`https://firestore.googleapis.com/v1/${d.name}:listCollectionIds`,'POST',{pageSize:50})).collectionIds||[];sub+=subs.length;if(subs.length)out.collections[`${c}:subcollections`]=subs;}}
    await new Promise(r=>stream.end(r));out.collections[c]={documents:n,file:path.basename(file)};console.log('backed up',c,n,sub?`(subcollections found: ${sub})`:'');
  }
  out.active=await active();save('backup.json',out);
  console.log(JSON.stringify({functions:Object.values(out.functions).filter(Boolean).length,scheduler:Object.values(out.scheduler).filter(Boolean).length,runJobs:Object.values(out.runJobs).filter(Boolean).length,runServices:Object.values(out.runServices).filter(Boolean).length,accounts:Object.values(out.accounts).filter(Boolean).length,active:out.active}));
}
async function disable(){for(const j of JOBS){const s=await get(`${SCHED}/${j}`);if(s?.state==='ENABLED'){await json(`${SCHED}/${j}:pause`,'POST',{});console.log('paused',j);}}console.log('active runs',JSON.stringify(await active()));}
async function waitOp(op,kind){if(!op?.name)return;for(;;){const r=await json(`${kind}/${op.name}`);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));return;}await new Promise(r=>setTimeout(r,10000));}}
async function removeCompute(){
  assert.deepEqual(await active(),[],'A Stock Fix or Sales Insights run is still active');
  const log={at:new Date().toISOString(),deleted:[]};
  for(const j of JOBS)if(await get(`${SCHED}/${j}`)){await json(`${SCHED}/${j}`,'DELETE');log.deleted.push('scheduler:'+j);console.log('deleted schedule',j);}
  const ops=[];for(const f of FUNCTIONS)if(await get(fnUrl(f)))ops.push([f,await json(fnUrl(f),'DELETE')]);
  for(const [f,op] of ops){await waitOp(op,'https://cloudfunctions.googleapis.com/v2');log.deleted.push('function:'+f);console.log('deleted function',f);}
  for(const j of RUN_JOBS)if(await get(`${RUN}/jobs/${j}`)){await waitOp(await json(`${RUN}/jobs/${j}`,'DELETE'),'https://run.googleapis.com/v2');log.deleted.push('run-job:'+j);console.log('deleted job',j);}
  for(const s of RUN_SERVICES)if(await get(`${RUN}/services/${s}`)){await waitOp(await json(`${RUN}/services/${s}`,'DELETE'),'https://run.googleapis.com/v2');log.deleted.push('run-service:'+s);console.log('deleted service',s);}
  for(const i of IMAGES)if(await get(`${AR}/${i}`)){await waitOp(await json(`${AR}/${i}`,'DELETE'),'https://artifactregistry.googleapis.com/v1');log.deleted.push('image:'+i);console.log('deleted image',i);}
  for(const s of SECRETS)if(await get(`https://secretmanager.googleapis.com/v1/projects/${P}/secrets/${s}`)){await json(`https://secretmanager.googleapis.com/v1/projects/${P}/secrets/${s}`,'DELETE');log.deleted.push('secret:'+s);console.log('deleted secret',s);}
  for(const a of ACCOUNTS)if(await get(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts/${a}`)){await json(`https://iam.googleapis.com/v1/projects/${P}/serviceAccounts/${a}`,'DELETE');log.deleted.push('account:'+a);console.log('deleted account',a);}
  for(const f of FUNCTIONS)assert.equal(await get(fnUrl(f)),null);
  save('removed-compute.json',log);console.log(`Removed ${log.deleted.length} compute items; SharePoint and Firebase Storage untouched.`);
}
async function removeData(){
  const b=JSON.parse(fs.readFileSync(path.join(stage,'backup.json'),'utf8'));const log={at:new Date().toISOString(),collections:{}};
  // stockFixAdoptionWeeks/<week>/resources (2,489 documents, backed up separately) goes before its parent.
  assert.ok(fs.existsSync(path.join(stage,'firestore-stockFixAdoptionWeeks-resources.ndjson')),'no backup for adoption resources');
  for await(const parent of documents('stockFixAdoptionWeeks')){let n=0;
    for(;;){const r=await json(`https://firestore.googleapis.com/v1/${parent.name}/resources?pageSize=300&mask.fieldPaths=__name__`);const docs=r.documents||[];if(!docs.length)break;
      await json(`${base}:commit`,'POST',{writes:docs.map(d=>({delete:d.name}))});n+=docs.length;}
    log.collections[`${parent.name.split('/documents/')[1]}/resources`]=n;console.log('deleted subcollection',parent.name.split('/').at(-1),'resources',n);}
  for(const c of COLLECTIONS){
    assert.ok(b.collections[c],'no backup for '+c);let n=0;
    for(;;){const r=await json(`${base}/${c}?pageSize=300&mask.fieldPaths=__name__`);const docs=r.documents||[];if(!docs.length)break;
      for(let i=0;i<docs.length;i+=300)await json(`${base}:commit`,'POST',{writes:docs.slice(i,i+300).map(d=>({delete:d.name}))});n+=docs.length;if(n%30000<300)console.log(c,'deleted',n);}
    log.collections[c]=n;console.log('deleted collection',c,n,'(backup had',b.collections[c].documents+')');
  }
  save('removed-data.json',log);
}
const actions={backup,disable,'remove-compute':removeCompute,'remove-data':removeData};
if(!actions[process.argv[2]])throw Error('Use backup, disable, remove-compute or remove-data');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
