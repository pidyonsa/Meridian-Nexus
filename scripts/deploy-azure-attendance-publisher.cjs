'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {json, api, fnUrl} = require('./release-multi-admin.cjs');
const {fields} = require('../firebase-dashboards/scripts/firestore-values.cjs');
const {decode} = require('../azure-field-dashboards/attendance-publisher/index.cjs');
const project='meridain-nexus', subscription='02b268fe-e01a-453e-b287-eec83ccc0676';
const rg=`/subscriptions/${subscription}/resourceGroups/rg-meridian-field-dashboards`;
const identity=rg+'/providers/Microsoft.ManagedIdentity/userAssignedIdentities/attendance-publisher';
const container=rg+'/providers/Microsoft.Storage/storageAccounts/meridianfield730011/blobServices/default/containers/dashboard-data';
const sa='azure-attendance-publisher@'+project+'.iam.gserviceaccount.com';
const functionName='publishAzureAttendance', jobName=`projects/${project}/locations/us-central1/jobs/azure-attendance-publisher`;
const root=`projects/${project}/databases/(default)/documents`, base='https://firestore.googleapis.com/v1/'+root;
const stage=path.resolve(__dirname,'../.tmp/azure-attendance-publisher-20260922');
const save=async(name,value)=>{await fs.mkdir(stage,{recursive:true});await fs.writeFile(path.join(stage,name),JSON.stringify(value,null,2));};
const read=async name=>JSON.parse(await fs.readFile(path.join(stage,name),'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let azureToken;
async function arm(resource,method='GET',body,version='2023-01-31') {
  azureToken ||= JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`az account get-access-token --subscription ${subscription} --resource https://management.azure.com/ -o json`],{encoding:'utf8',windowsHide:true})).accessToken;
  const response=await fetch('https://management.azure.com'+resource+'?api-version='+version,{method,headers:{Authorization:'Bearer '+azureToken,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Azure '+response.status+': '+(await response.text()).slice(0,1000));
  return response.status===204?{}:response.json();
}
async function optional(action) {try{return await action();}catch(error){if(/^(GET|Azure) 404:/.test(error.message))return null;throw error;}}
async function schedule() {
  const doc=await json(base+'/retailers/geo-rep-attendance-for-reps?mask.fieldPaths=reportSchedule');
  const before=decode({mapValue:{fields:doc.fields}}).reportSchedule;
  assert.equal(before.frequency,'daily');assert.equal(before.timezone,'Africa/Johannesburg');
  if(before.time==='06:00'&&before.enabled===true){console.log('Geo Rep daily schedule is already 06:00 SAST.');return;}
  assert.equal(before.time,'01:00','Unexpected schedule; review before changing');
  await save('schedule-before.json',doc);
  const after={...before,enabled:true,time:'06:00',frequency:'daily',timezone:'Africa/Johannesburg',dateMode:'daily',businessDaysOnly:false,daysOfWeek:[0,1,2,3,4,5,6]};
  await json(base+':commit','POST',{writes:[
    {update:{name:doc.name,fields:fields({reportSchedule:after})},updateMask:{fieldPaths:['reportSchedule']},currentDocument:{updateTime:doc.updateTime}},
    {update:{name:root+'/publicDashboardRefreshAudit/attendance-schedule-20260922',fields:fields({at:new Date().toISOString(),action:'User requested syndicated attendance at 06:00 SAST daily',previousTime:before.time,time:after.time,retailerId:'geo-rep-attendance-for-reps'})},currentDocument:{exists:false}}
  ]});
  const verified=decode({mapValue:{fields:(await json(base+'/retailers/geo-rep-attendance-for-reps?mask.fieldPaths=reportSchedule')).fields}}).reportSchedule;
  assert.deepEqual(verified,after);await save('schedule-applied.json',{at:new Date().toISOString(),schedule:verified});
  console.log('Verified Geo Rep download: 06:00 Africa/Johannesburg, every day, month-to-yesterday.');
}
async function provision() {
  const serviceUrl=`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${sa}`;
  let account=await optional(()=>json(serviceUrl));
  if(!account)account=await json(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,'POST',{accountId:'azure-attendance-publisher',serviceAccount:{displayName:'Azure Attendance publisher (keyless)',description:'Only verified syndicated Attendance snapshots; no original data writes.'}});
  assert.equal(account.email,sa);assert.ok(account.uniqueId);
  await save('google-identity.json',{email:account.email,uniqueId:account.uniqueId});
  const roles=[['nexusAttendanceDocumentGet',['datastore.entities.get']],['nexusAttendanceWorkbookGet',['storage.objects.get']]];
  for(const [id,permissions]of roles){
    const url=`https://iam.googleapis.com/v1/projects/${project}/roles/${id}`;
    let role=await optional(()=>json(url));
    if(!role)role=await json(`https://iam.googleapis.com/v1/projects/${project}/roles`,'POST',{roleId:id,role:{title:id,description:'Read-only permissions for the approved Attendance publisher.',includedPermissions:permissions,stage:'GA'}});
    assert.deepEqual(role.includedPermissions.sort(),permissions.sort());assert.notEqual(role.deleted,true);
  }
  const policyUrl=`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy=await json(policyUrl+':getIamPolicy','POST',{options:{requestedPolicyVersion:3}}), role=`projects/${project}/roles/nexusAttendanceDocumentGet`;
  await save('project-iam-before.json',policy);
  policy.bindings||=[];let binding=policy.bindings.find(b=>b.role===role&&!b.condition);
  if(!binding){binding={role,members:[]};policy.bindings.push(binding);}
  if(!binding.members.includes('serviceAccount:'+sa)){binding.members.push('serviceAccount:'+sa);await json(policyUrl+':setIamPolicy','POST',{policy});}
  const bucketUrl=`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/iam`;
  const storage=await json(bucketUrl+'?optionsRequestedPolicyVersion=3');await save('storage-iam-before.json',storage);
  const prefix=`projects/_/buckets/${project}.firebasestorage.app/objects/`;
  const condition={title:'AzureAttendancePublisherWorkbooks',description:'Read XLSX uploads and attendance masters; runtime accepts only Geo Rep attendance filenames.',expression:`(resource.name.startsWith('${prefix}uploads/') && resource.name.endsWith('.xlsx')) || resource.name.startsWith('${prefix}geo-rep-attendance-store-masters/')`};
  const existing=storage.bindings.find(b=>b.condition?.title===condition.title);
  if(existing){assert.deepEqual(existing.members,['serviceAccount:'+sa]);assert.equal(existing.condition.expression,condition.expression);}
  else{storage.version=3;storage.bindings.push({role:`projects/${project}/roles/nexusAttendanceWorkbookGet`,members:['serviceAccount:'+sa],condition});await json(bucketUrl,'PUT',storage);}
  let managed=await optional(()=>arm(identity));
  if(!managed)managed=await arm(identity,'PUT',{location:'southafricanorth',tags:{purpose:'syndicated-attendance-publisher'}});
  assert.ok(managed.properties.clientId&&managed.properties.principalId);
  const credential={issuer:'https://accounts.google.com',subject:account.uniqueId,audiences:['api://AzureADTokenExchange']};
  await arm(identity+'/federatedIdentityCredentials/georep-publisher','PUT',{properties:credential});
  const roleId='1ef72c2d-269b-46f4-8fa1-740fb22dd1c9',assignmentId='b6aee4df-0cf5-4ff4-94ce-9312bd2671c4';
  const rolePath=`/subscriptions/${subscription}/providers/Microsoft.Authorization/roleDefinitions/${roleId}`;
  const permissions=[{actions:[],notActions:[],dataActions:['Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read','Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write'],notDataActions:[]}];
  let azureRole=await optional(()=>arm(rolePath,'GET',null,'2022-04-01'));
  if(!azureRole)azureRole=await arm(rolePath,'PUT',{properties:{roleName:'Meridian Attendance Snapshot Publisher',description:'Read and write only; assigned solely to the private dashboard container. No delete or key access.',type:'CustomRole',assignableScopes:[rg],permissions}},'2022-04-01');
  assert.deepEqual(azureRole.properties.permissions,permissions);
  await arm(container+'/providers/Microsoft.Authorization/roleAssignments/'+assignmentId,'PUT',{properties:{roleDefinitionId:rolePath,principalId:managed.properties.principalId,principalType:'ServicePrincipal'}},'2022-04-01');
  await save('identities.json',{at:new Date().toISOString(),google:account.email,subject:account.uniqueId,azure:managed.properties,identity,container,rolePath,assignmentId});
  console.log('Dedicated keyless identities configured; Google read-only, Azure container-only read/write, no deletion or keys.');
}
async function provisionOrders() {
  // Orders needs two reads the Attendance publisher did not: a query of the salesTransactions
  // ledger, and the Geo product master workbook. Chunks use fixed IDs, so no other list is needed.
  const id='nexusOrdersLedgerList',permissions=['datastore.entities.list'],url=`https://iam.googleapis.com/v1/projects/${project}/roles/${id}`;
  let role=await optional(()=>json(url));
  if(!role)role=await json(`https://iam.googleapis.com/v1/projects/${project}/roles`,'POST',{roleId:id,role:{title:id,description:'Query the Orders ledger for the approved Azure Orders publisher.',includedPermissions:permissions,stage:'GA'}});
  assert.deepEqual(role.includedPermissions,permissions);assert.notEqual(role.deleted,true);
  const policyUrl=`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy=await json(policyUrl+':getIamPolicy','POST',{options:{requestedPolicyVersion:3}}),roleName=`projects/${project}/roles/${id}`;
  await save('orders-project-iam-before.json',policy);
  policy.bindings||=[];let binding=policy.bindings.find(b=>b.role===roleName&&!b.condition);
  if(!binding){binding={role:roleName,members:[]};policy.bindings.push(binding);}
  if(!binding.members.includes('serviceAccount:'+sa)){binding.members.push('serviceAccount:'+sa);policy.version=3;await json(policyUrl+':setIamPolicy','POST',{policy});}
  const bucketUrl=`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/iam`;
  const storage=await json(bucketUrl+'?optionsRequestedPolicyVersion=3');await save('orders-storage-iam-before.json',storage);
  const prefix=`projects/_/buckets/${project}.firebasestorage.app/objects/`;
  const condition={title:'AzureOrdersPublisherProductMaster',description:'Read only the Geo product order master workbook used for Orders client mapping.',expression:`resource.name.startsWith('${prefix}portal-resources/geo-product-order-master/')`};
  const existing=storage.bindings.find(b=>b.condition?.title===condition.title);
  if(existing){assert.deepEqual(existing.members,['serviceAccount:'+sa]);assert.equal(existing.condition.expression,condition.expression);}
  else{storage.version=3;storage.bindings.push({role:`projects/${project}/roles/nexusAttendanceWorkbookGet`,members:['serviceAccount:'+sa],condition});await json(bucketUrl,'PUT',storage);}
  await save('orders-identities.json',{at:new Date().toISOString(),serviceAccount:sa,projectRole:roleName,storageCondition:condition});
  console.log('Orders reads granted: ledger query and product master workbook only; no write permissions.');
}
async function deploy() {
  const credentials=await read('identities.json');
  const existing=await optional(()=>json(fnUrl(functionName)));
  assert.ok(!existing,'Publisher exists; use the reviewed update action.');
  await deploySource(credentials);
}
async function deploySource(credentials,existing) {
  const dir=path.resolve(__dirname,'../azure-field-dashboards'),Zip=require('../functions/node_modules/jszip'),zip=new Zip();
  for(const name of ['core.cjs','index.cjs','orders.cjs'])zip.file('attendance-publisher/'+name,await fs.readFile(path.join(dir,'attendance-publisher',name)));
  zip.file('server/snapshot-data.cjs',await fs.readFile(path.join(dir,'server/snapshot-data.cjs')));
  const engine=JSON.parse(await fs.readFile(path.join(dir,'server/report-engine/manifest.json'),'utf8'));
  const {hash}=require('../azure-field-dashboards/server/snapshot-data.cjs');
  for(const item of engine){const bytes=await fs.readFile(path.join(dir,'server/report-engine',item.path));assert.equal(hash(bytes),item.sha256);zip.file('server/report-engine/'+item.path,bytes);}
  const pkg=JSON.parse(await fs.readFile(path.join(dir,'attendance-publisher/package.json'),'utf8'));pkg.main='attendance-publisher/index.cjs';
  zip.file('package.json',JSON.stringify(pkg));zip.file('package-lock.json',await fs.readFile(path.join(dir,'attendance-publisher/package-lock.json')));
  const upload=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`,'POST',{});
  const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'content-type':'application/zip'},body:data});assert.ok(sent.ok);
  const body={name:`projects/${project}/locations/us-central1/functions/${functionName}`,description:'Private keyless publisher of completed Geo Rep Attendance and verified Franchise Orders imports to the existing Azure dashboard snapshot.',
    buildConfig:{runtime:'nodejs22',entryPoint:functionName,source:{storageSource:upload.storageSource}},
    serviceConfig:{serviceAccountEmail:sa,timeoutSeconds:300,availableMemory:'2Gi',availableCpu:'1',maxInstanceCount:1,minInstanceCount:0,maxInstanceRequestConcurrency:1,ingressSettings:'ALLOW_ALL',environmentVariables:{AZURE_PUBLISHER_CLIENT_ID:credentials.azure.clientId}},labels:{purpose:'azure-attendance-publisher'}};
  const endpoint=existing?fnUrl(functionName)+'?updateMask=buildConfig,serviceConfig':`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions?functionId=${functionName}`;
  const op=await json(endpoint,existing?'PATCH':'POST',body);await save('deploy-operation.json',op);console.log('Building isolated Attendance publisher ('+data.length+' bytes).');
  for(;;){const result=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(result.done){assert.ok(!result.error,JSON.stringify(result.error));break;}await sleep(15000);}
  const fn=await json(fnUrl(functionName));assert.equal(fn.state,'ACTIVE');await save('deployed.json',{name:fn.name,revision:fn.serviceConfig.revision,uri:fn.serviceConfig.uri,service:fn.serviceConfig.service});
  console.log('Publisher active: '+fn.serviceConfig.revision);
}
async function update(){await deploySource(await read('identities.json'),await json(fnUrl(functionName)));}
async function activate() {
  const fn=await json(fnUrl(functionName)),url='https://run.googleapis.com/v2/'+fn.serviceConfig.service;
  const policy=await json(url+':getIamPolicy');policy.bindings||=[];
  assert.ok(!policy.bindings.some(b=>b.members.some(m=>['allUsers','allAuthenticatedUsers'].includes(m))));
  let binding=policy.bindings.find(b=>b.role==='roles/run.invoker'&&!b.condition);
  if(!binding){binding={role:'roles/run.invoker',members:[]};policy.bindings.push(binding);}
  if(!binding.members.includes('serviceAccount:'+sa)){binding.members.push('serviceAccount:'+sa);await json(url+':setIamPolicy','POST',{policy});}
  const job={name:jobName,description:'Publish completed 06:00 SAST Geo Rep attendance imports to Azure; no change to Orders.',schedule:'*/5 * * * *',timeZone:'Africa/Johannesburg',attemptDeadline:'320s',retryConfig:{retryCount:3,minBackoffDuration:'60s',maxBackoffDuration:'300s',maxDoublings:2},httpTarget:{uri:fn.serviceConfig.uri,httpMethod:'POST',headers:{'Content-Type':'application/json'},body:Buffer.from('{}').toString('base64'),oidcToken:{serviceAccountEmail:sa,audience:fn.serviceConfig.uri}}};
  const existing=await optional(()=>json('https://cloudscheduler.googleapis.com/v1/'+jobName));
  if(existing){assert.equal(new URL(existing.httpTarget.uri).href,new URL(job.httpTarget.uri).href);assert.equal(existing.schedule,job.schedule);assert.equal(existing.state,'ENABLED');}
  else await json(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-central1/jobs`,'POST',job);
  const response=await fetch(fn.serviceConfig.uri,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await response.body.cancel();assert.ok([401,403].includes(response.status),'Publisher must remain private');
  await json('https://cloudscheduler.googleapis.com/v1/'+jobName+':run','POST',{});
  await save('activated.json',{at:new Date().toISOString(),jobName,schedule:job.schedule,timeZone:job.timeZone,anonymousStatus:response.status});
  console.log('Private publisher scheduled every five minutes and invoked now; anonymous access blocked.');
}
async function status() {
  const job=await json('https://cloudscheduler.googleapis.com/v1/'+jobName);
  const logs=await json('https://logging.googleapis.com/v2/entries:list','POST',{resourceNames:['projects/'+project],filter:'resource.type="cloud_run_revision" AND resource.labels.service_name="publishazureattendance" AND timestamp>="2026-09-22T07:00:00Z"',orderBy:'timestamp desc',pageSize:25});
  const result={at:new Date().toISOString(),job:{state:job.state,schedule:job.schedule,timeZone:job.timeZone,lastAttemptTime:job.lastAttemptTime,status:job.status},logs:(logs.entries||[]).map(e=>({at:e.timestamp,severity:e.severity,message:e.jsonPayload||e.textPayload,status:e.httpRequest?.status}))};
  await save('status.json',result);console.log(JSON.stringify(result,null,2));
}
async function prepareScheduler() {
  const fn=await json(fnUrl('runScheduledExtractions')),s=fn.buildConfig.source.storageSource;
  const Zip=require('../functions/node_modules/jszip'),bytes=Buffer.from(await(await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const zip=await Zip.loadAsync(bytes),code=await zip.file('index.js').async('string');
  assert.ok(code.includes('if (isGeoRepRepAttendanceRetailer(retailerDoc.id) && now.date.endsWith("-01")) return;'));
  assert.match(code,/return \{ startDate: monthStart\(endDate\), endDate \};/);
  await save('scheduler-before.json',fn);await fs.writeFile(path.join(stage,'scheduler-before.zip'),bytes);
  await fs.writeFile(path.join(stage,'scheduler-index.js'),code);
  console.log('Saved exact deployed scheduler source for a one-guard removal; no deployment yet.');
}
async function deployScheduler() {
  const fn=await read('scheduler-before.json'),current=await json(fnUrl('runScheduledExtractions'));
  assert.equal(current.serviceConfig.revision,fn.serviceConfig.revision,'Scheduler changed; re-review baseline');
  const Zip=require('../functions/node_modules/jszip'),zip=await Zip.loadAsync(await fs.readFile(path.join(stage,'scheduler-before.zip')));
  const before=await zip.file('index.js').async('string'),after=await fs.readFile(path.join(stage,'scheduler-index.js'),'utf8');
  const normalize=text=>text.replace(/\r\n/g,'\n');
  const lines=normalize(before).split('\n'),guard=lines.findIndex(line=>line.includes('if (isGeoRepRepAttendanceRetailer(retailerDoc.id) && now.date.endsWith("-01")) return;'));
  assert.ok(guard>=3);assert.ok(lines[guard-3].includes("Nakita's Rep attendance range"));
  lines.splice(guard-3,4);
  assert.equal(normalize(after),lines.join('\n'),'Only the obsolete first-day guard and its comment may change');
  zip.file('index.js',after);
  const upload=await json(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions:generateUploadUrl`,'POST',{});
  const result=await fetch(upload.uploadUrl,{method:'PUT',headers:{'content-type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(result.ok);
  const op=await json(fnUrl('runScheduledExtractions')+'?updateMask=buildConfig.source','PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});await save('scheduler-operation.json',op);
  console.log('Deploying the first-of-month guard removal only; other scheduler code and runtime settings unchanged.');
  for(;;){const result=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(result.done){assert.ok(!result.error,JSON.stringify(result.error));break;}await sleep(15000);}
  const next=await json(fnUrl('runScheduledExtractions'));
  for(const key of ['serviceAccountEmail','environmentVariables','secretEnvironmentVariables','availableMemory','availableCpu','maxInstanceCount','maxInstanceRequestConcurrency','timeoutSeconds'])assert.deepEqual(next.serviceConfig[key],fn.serviceConfig[key],key);
  await save('scheduler-deployed.json',{at:new Date().toISOString(),previous:fn.serviceConfig.revision,revision:next.serviceConfig.revision});
  console.log('Verified scheduler first-of-month fix: '+next.serviceConfig.revision);
}
const actions={schedule,provision,provisionOrders,deploy,activate,status,update,prepareScheduler,deployScheduler};
if(require.main===module){assert.ok(actions[process.argv[2]],'Use schedule, provision, deploy, activate, status or update');actions[process.argv[2]]().catch(error=>{console.error(error.stack);process.exitCode=1;});}
