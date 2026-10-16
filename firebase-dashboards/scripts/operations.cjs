'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const h=require('../../scripts/repair-attendance-september-weeks.cjs');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..'),dir=path.join(repo,'.tmp/public-dashboards-20260914');fs.mkdirSync(dir,{recursive:true});
const project='meridain-nexus',account='nexus-public-viewer',email=`${account}@${project}.iam.gserviceaccount.com`,bucket=`${project}.firebasestorage.app`;
const save=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2));
function gcloud(...args){return execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:12*1024*1024});}
async function baseline(){
  const api=await h.apiClient(),records={at:new Date().toISOString(),files:{},functions:{}};
  for(const p of ['firebase.json','.firebaserc','firestore.rules','storage.rules','public/index.html','public/app.js','functions/index.js','azure-nexus/infra/main.bicep'])records.files[p]=crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,p))).digest('hex');
  records.hosting=await api('https://firebasehosting.googleapis.com/v1beta1/sites/meridian-nexus/releases?pageSize=1');
  for(const name of ['processExtraction','getGeoRepAttendanceDashboard','getFranchiseOrderDashboard']){
    const f=await api(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions/${name}`);
    records.functions[name]={updateTime:f.updateTime,revision:f.serviceConfig?.revision,source:f.buildConfig?.source};
  }
  const file=path.join(dir,'baseline.json');assert.ok(!fs.existsSync(file),'Baseline already saved; preserve it.');save('baseline.json',records);console.log('Original hosting release, function revisions and file hashes recorded.');
}
async function iam(){
  assert.ok(process.argv.includes('--approve-project-wide-firestore-read'),'Requires explicit approval of project-wide Firestore reads and uploads/ Storage reads; no IAM changes made.');
  const api=await h.apiClient();let service;
  try{service=await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`);}catch(e){if(!e.message.startsWith('API 404:'))throw e;service=await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,'POST',{accountId:account,serviceAccount:{displayName:'Public dashboard read-only viewer'}});}
  gcloud('projects','add-iam-policy-binding',project,`--member=serviceAccount:${email}`,'--role=roles/datastore.viewer','--condition=None','--quiet','--format=none');
  const url=`https://storage.googleapis.com/storage/v1/b/${bucket}/iam`,policy=await api(url+'?optionsRequestedPolicyVersion=3');
  const backup=path.join(dir,'bucket-iam-before.json');if(!fs.existsSync(backup))save('bucket-iam-before.json',policy);
  const condition={title:'public-dashboard-attendance-read',description:'Only read uploaded attendance sources and attendance store masters.',expression:`resource.name.startsWith('projects/_/buckets/${bucket}/objects/uploads/') || resource.name.startsWith('projects/_/buckets/${bucket}/objects/geo-rep-attendance-store-masters/')`};
  policy.version=3;policy.bindings ||= [];
  const existing=policy.bindings.find(b=>b.role==='roles/storage.objectViewer'&&b.condition?.title===condition.title);
  if(existing){assert.equal(existing.condition.expression,condition.expression);if(!existing.members.includes('serviceAccount:'+email))existing.members.push('serviceAccount:'+email);}
  else policy.bindings.push({role:'roles/storage.objectViewer',members:['serviceAccount:'+email],condition});
  await api(url,'PUT',policy);
  const check=await api(url+'?optionsRequestedPolicyVersion=3');assert.ok(check.bindings.some(b=>b.role==='roles/storage.objectViewer'&&b.members.includes('serviceAccount:'+email)&&b.condition?.expression===condition.expression));
  save('runtime-identity.json',{name:service.name,email,firestoreRole:'roles/datastore.viewer',storageRole:'roles/storage.objectViewer',condition});console.log('New runtime identity has database-viewer and prefix-scoped object-viewer access; no write or secret access granted.');
}
async function originalUnchanged(){
  const original=JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'),'utf8')),api=await h.apiClient();
  for(const[p,digest]of Object.entries(original.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,p))).digest('hex'),digest,p+' changed');
  const hosting=await api('https://firebasehosting.googleapis.com/v1beta1/sites/meridian-nexus/releases?pageSize=1');assert.equal(hosting.releases[0].name,original.hosting.releases[0].name);
  for(const[name,old]of Object.entries(original.functions)){const f=await api(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/us-central1/functions/${name}`);assert.deepEqual({updateTime:f.updateTime,revision:f.serviceConfig?.revision,source:f.buildConfig?.source},old,name+' changed');}
  save('original-unchanged.json',{at:new Date().toISOString(),verified:true});console.log('Original Nexus hosting, rules/config files, automation/read functions and Azure infrastructure file remain unchanged.');
}
async function live(ordersOnly=false){
  const api=await h.apiClient();
  const token=ordersOnly?'':(await api(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,'POST',{scope:['https://www.googleapis.com/auth/devstorage.read_only'],lifetime:'900s'})).accessToken;
  const doc=d=>({id:d.name.split('/').at(-1),exists:true,data:()=>{const x=h.decode(d);delete x.id;return x;}});
  const db={collection:name=>{
    const conditions=[],orderBy=[];let limit;
    const query={doc:id=>({get:async()=>{try{return doc(await api(`${name}/${id}`));}catch(e){if(!e.message.startsWith('API 404:'))throw e;return {exists:false,data:()=>undefined};}}}),
      where:(field,op,value)=>{conditions.push({fieldFilter:{field:{fieldPath:field},op:{'==':'EQUAL','>=':'GREATER_THAN_OR_EQUAL','<=':'LESS_THAN_OR_EQUAL'}[op],value:h.fields({v:value}).v}});return query;},
      orderBy:(field,direction)=>{orderBy.push({field:{fieldPath:field},direction:direction==='desc'?'DESCENDING':'ASCENDING'});return query;},limit:n=>{limit=n;return query;},
      get:async()=>{const structuredQuery={from:[{collectionId:name}],...(conditions.length?{where:conditions.length===1?conditions[0]:{compositeFilter:{op:'AND',filters:conditions}}}:{}),...(orderBy.length?{orderBy}:{}),...(limit?{limit}:{})};const result=await api(h.base+':runQuery','POST',{structuredQuery});const docs=result.filter(r=>r.document).map(r=>doc(r.document));return {docs,size:docs.length,empty:!docs.length};}};return query;
  }};
  const getStorage=()=>({bucket:()=>({file:name=>({download:async({destination})=>{assert.ok(name.startsWith('uploads/')||name.startsWith('geo-rep-attendance-store-masters/'));const response=await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}?alt=media`,{headers:{Authorization:`Bearer ${token}`,'x-goog-user-project':project},signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Storage '+response.status+': '+(await response.text()).slice(0,600));fs.writeFileSync(destination,Buffer.from(await response.arrayBuffer()));}})})});
  const backendRequire=require('node:module').createRequire(path.join(root,'backend/package.json'));
  const ExcelJS=backendRequire('exceljs'),{HttpsError}=backendRequire('firebase-functions/v2/https');
  const service=require('../backend/service.cjs').createService({db,getStorage,ExcelJS,HttpsError}),result={checkedAt:new Date().toISOString(),attendance:{}};
  for(const audience of ordersOnly?[]:['rep','merchandiser']){
    const data=await service.attendance({audience}),detail=await service.attendance({audience,mode:'detail',selection:{metric:'actual'},version:data.version});
    assert.equal(detail.total,data.metrics.attended);assert.ok(!data.tracker&&!data.source);
    result.attendance[audience]={period:[data.reportStartDate,data.reportEndDate],metrics:data.metrics,detailReconciles:true};
  }
  const orders=await service.orders({});result.orders={period:orders.latestPeriod,totals:orders.totals,source:orders.source,updated:orders.latestImport};save(ordersOnly?'live-orders-verification.json':'live-source-verification.json',result);console.log(JSON.stringify(result,null,2));
}
({baseline,iam,live,orders:()=>live(true),verify:originalUnchanged}[process.argv[2]]||(()=>{throw Error('Choose baseline, iam, live, orders or verify.');}))().catch(e=>{console.error(e.message);process.exitCode=1;});
