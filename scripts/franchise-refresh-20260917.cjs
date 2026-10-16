'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl}=require('./release-multi-admin.cjs');
const project='meridain-nexus',root=`projects/${project}/databases/(default)/documents`,base=`https://firestore.googleapis.com/v1/${root}`;
const stage=path.resolve(__dirname,'../.tmp/franchise-refresh-20260917');
const retailerId='geo-rep-sales-transactions';
function unpack(v){return v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)])):v.arrayValue?(v.arrayValue.values||[]).map(unpack):null));}
const decode=d=>({id:d.name.split('/').at(-1),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,unpack(v)]))});
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
const save=(name,data)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,name),JSON.stringify(data,null,2));};
async function read(doc,keys){return json(`${base}/${doc}?${keys.map(k=>'mask.fieldPaths='+encodeURIComponent(k)).join('&')}`);}
async function query(collection,field,value,keys){
  const result=await json(`${base}:runQuery`,'POST',{structuredQuery:{from:[{collectionId:collection}],select:{fields:keys.map(fieldPath=>({fieldPath}))},...(field?{where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:value}}}}:{}),limit:1000}});
  const rows=result.filter(r=>r.document).map(r=>decode(r.document));assert.ok(rows.length<1000,'Query limit reached');return rows;
}
async function audit(){
  const retailer=decode(await read(`retailers/${retailerId}`,['name','extractionProfileId','workflowMode','reportSchedule','salesDashboard']));
  const profile=decode(await read(`extractionProfiles/${retailer.extractionProfileId}`,['name','workflowMode','steps']));
  const config=decode(await read('salesDashboardConfig/current',['storeMasterId','transactionRetailerId','setupStatus','lastImport','apiImportEnabled','updatedAt']));
  const runs=await query('extractionRuns','retailerId',retailerId,['status','createdAt','startedAt','completedAt','message','error','failureCategory','reportStartDate','reportEndDate','fileId','fileName','salesTransactionImportId','trigger','isDuplicate','workflowMode']);
  const imports=await query('salesTransactionImports',null,null,['status','createdAt','completedAt','message','error','parentRunId','sourceFileId','periodKey','reportStartDate','reportEndDate','rowsImported','sourceRows']);
  const functions={};
  for(const name of ['runScheduledExtractions','processExtraction','processGeoRepSalesTransactionImport','runScheduledGeoRepSalesDashboardApiImport']){
    try{const fn=await json(fnUrl(name));functions[name]={state:fn.state,updatedAt:fn.updateTime,revision:fn.serviceConfig?.revision,source:fn.buildConfig?.source};}catch(error){functions[name]={error:String(error.message).slice(0,180)};}
  }
  const scheduler=await json(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-central1/jobs?pageSize=500`);
  const jobs=(scheduler.jobs||[]).filter(j=>/runScheduledExtractions|GeoRepSalesDashboard/i.test(j.name)).map(j=>pick(j,['name','state','schedule','timeZone','lastAttemptTime','status']));
  const result={at:new Date().toISOString(),retailer,profile:{id:profile.id,name:profile.name,workflowMode:profile.workflowMode,actions:profile.steps?.map(s=>s.action)},config,
    runs:runs.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,12),imports:imports.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,12),functions,jobs};
  save('audit.json',result);console.log(JSON.stringify(result,null,2));
}
const functionName='refreshPublicFranchiseOrders',sa='730011371323-compute@developer.gserviceaccount.com';
const jobName=`projects/${project}/locations/us-central1/jobs/public-franchise-orders-publisher`;
const {fields}=require('../firebase-dashboards/scripts/firestore-values.cjs');
async function schedule(){
  const doc=await read(`retailers/${retailerId}`,['reportSchedule']),before=decode(doc).reportSchedule;
  assert.equal(before.timezone,'Africa/Johannesburg');assert.equal(before.frequency,'daily');
  const next={...before,enabled:true,time:'06:00',dateMode:'daily',businessDaysOnly:false,daysOfWeek:[0,1,2,3,4,5,6]};
  const at=new Date().toISOString();
  if(before.time!=='06:00'){
    assert.equal(before.time,'06:15','Review unexpected schedule change');save('schedule-before.json',{doc});
    await json(`${base}:commit`,'POST',{writes:[{update:{name:doc.name,fields:fields({reportSchedule:next})},updateMask:{fieldPaths:['reportSchedule']},currentDocument:{updateTime:doc.updateTime}},
      {update:{name:`${root}/publicDashboardRefreshAudit/schedule-20260917`,fields:fields({at,action:'Set existing Geo transaction download to 06:00 SAST daily',previousTime:before.time,time:next.time,retailerId,source:'explicit-user-request-cloud-operator'})},currentDocument:{exists:false}}]});
  }
  assert.equal(decode(await read(`retailers/${retailerId}`,['reportSchedule'])).reportSchedule.time,'06:00');save('schedule-applied.json',{at,time:'06:00',timezone:'Africa/Johannesburg',daily:true});console.log('Verified daily Geo transaction download scheduled at 06:00 SAST.');
}
async function deploy(){
  let existing;try{existing=await json(fnUrl(functionName));}catch(error){if(!error.message.startsWith('GET 404:'))throw error;}
  assert.ok(!existing,'The publisher already exists; do not replace it without a reviewed update.');
  const Zip=require('../functions/node_modules/jszip'),zip=new Zip(),crypto=require('node:crypto'),files={};
  for(const name of ['index.cjs','core.cjs','order-workbook.cjs','package.json','package-lock.json']){
    const bytes=fs.readFileSync(path.resolve(__dirname,'../firebase-dashboards/refresh',name));zip.file(name,bytes);files[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const upload=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`,'POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'content-type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const operation=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions?functionId=${functionName}`,'POST',{
    name:`projects/${project}/locations/us-central1/functions/${functionName}`,description:'Private publisher for the two temporary field dashboards; never writes original salesTransactions.',
    buildConfig:{runtime:'nodejs22',entryPoint:functionName,source:{storageSource:upload.storageSource}},
    serviceConfig:{serviceAccountEmail:sa,timeoutSeconds:300,availableMemory:'1Gi',availableCpu:'1',maxInstanceCount:1,minInstanceCount:0,maxInstanceRequestConcurrency:1,ingressSettings:'ALLOW_ALL'},labels:{purpose:'temporary-dashboard-order-refresh'}
  });save('deploy-operation.json',operation);save('deploy-source.json',{files,at:new Date().toISOString()});
  console.log('Building the private automated dashboard publisher.');
  for(;;){const result=await json('https://cloudfunctions.googleapis.com/v2/'+operation.name);if(result.done){assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const fn=await json(fnUrl(functionName));assert.equal(fn.state,'ACTIVE');save('deployed.json',pick(fn,['name','state','updateTime','serviceConfig']));console.log(`Publisher deployed: ${fn.serviceConfig.revision}`);
}
async function activate(){
  const fn=await json(fnUrl(functionName));assert.equal(fn.state,'ACTIVE');
  const iamUrl=`https://run.googleapis.com/v2/${fn.serviceConfig.service}`,policy=await json(iamUrl+':getIamPolicy');
  assert.ok(!(policy.bindings||[]).some(b=>b.members?.some(m=>m==='allUsers'||m==='allAuthenticatedUsers')),'The publisher must remain private.');
  policy.bindings||=[];let binding=policy.bindings.find(b=>b.role==='roles/run.invoker'&&!b.condition);if(!binding){binding={role:'roles/run.invoker',members:[]};policy.bindings.push(binding);}
  if(!binding.members.includes('serviceAccount:'+sa))binding.members.push('serviceAccount:'+sa);
  await json(iamUrl+':setIamPolicy','POST',{policy});
  let existing;try{existing=await json('https://cloudscheduler.googleapis.com/v1/'+jobName);}catch(error){if(!error.message.startsWith('GET 404:'))throw error;}
  const job={name:jobName,description:'Publish only new completed 06:00 SAST Geo transaction downloads; retry without replacing the last verified snapshot on failure.',schedule:'*/5 * * * *',timeZone:'Africa/Johannesburg',attemptDeadline:'320s',retryConfig:{retryCount:3,minBackoffDuration:'60s',maxBackoffDuration:'300s',maxDoublings:2},httpTarget:{uri:fn.serviceConfig.uri,httpMethod:'POST',headers:{'Content-Type':'application/json'},body:Buffer.from('{}').toString('base64'),oidcToken:{serviceAccountEmail:sa,audience:fn.serviceConfig.uri}}};
  if(existing){assert.equal(existing.httpTarget.uri,job.httpTarget.uri);assert.equal(existing.schedule,job.schedule);}else await json(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-central1/jobs`,'POST',job);
  const anonymous=await fetch(fn.serviceConfig.uri,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.ok([401,403].includes(anonymous.status),'Anonymous publisher access must be denied.');
  await json('https://cloudscheduler.googleapis.com/v1/'+jobName+':run','POST',{});
  save('activated.json',{at:new Date().toISOString(),jobName,anonymousStatus:anonymous.status,schedule:job.schedule,timeZone:job.timeZone,uri:fn.serviceConfig.uri});console.log('Private publisher activated and invoked through Cloud Scheduler; automatic checks every five minutes.');
}
async function status(){
  const state=decode(await read('publicDashboardRefresh/orders',['status','checkedAt','startedAt','message','lastSuccessAt','sourceFileId','rowCount','through','importedAt','publishedAt','leaseUntil']));
  const source=decode(await read('publicDashboardSources/orders',['sourceFileId','rowCount','range','importedAt','publishedAt','version','headers','refreshSchedule','detailTotal','summaryDifference']));
  const result={at:new Date().toISOString(),state,source};save('status.json',result);console.log(JSON.stringify(result,null,2));
}
async function diagnostics(){
  const logs=await json('https://logging.googleapis.com/v2/entries:list','POST',{resourceNames:[`projects/${project}`],filter:'resource.type="cloud_run_revision" AND resource.labels.service_name="publicmeridiandashboards" AND severity>=ERROR AND timestamp>="2026-09-17T11:30:00Z"',orderBy:'timestamp desc',pageSize:10});
  const result=(logs.entries||[]).map(e=>({at:e.timestamp,message:e.textPayload||e.jsonPayload,status:e.httpRequest?.status}));save('reader-diagnostics.json',result);console.log(JSON.stringify(result,null,2));
}
const actions={audit,schedule,deploy,activate,status,diagnostics};
if(require.main===module){assert.ok(actions[process.argv[2]],'Use audit');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={json,api,fnUrl,read,query,decode,pick,save,stage,root,base,retailerId};
