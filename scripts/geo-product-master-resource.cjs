'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {json}=require('./release-multi-admin.cjs');
const C=require('../firebase-dashboards/backend/product-clients.cjs'),ExcelJS=require('../functions/node_modules/exceljs');
const source='C:/Users/PC/Documents/Meridian Nexus/SHONESA/Geo Product Order Master.xlsx';
const stage=path.resolve(__dirname,'../.tmp/dashboard-performance-clients-20260916');
const project='meridain-nexus',bucket='meridain-nexus.firebasestorage.app',root=`projects/${project}/databases/(default)/documents`;
const base=`https://firestore.googleapis.com/v1/${root}`;
const save=(name,value)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2));};
const encode=value=>value===null?{nullValue:null}:typeof value==='string'?{stringValue:value}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?{integerValue:String(value)}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
async function inspect(){
  const bytes=fs.readFileSync(source),catalog=C.index(await C.parse(bytes,ExcelJS));
  const started=Date.now(),response=await fetch('https://meridian-field-dashboards.azurewebsites.net/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({export:true}),signal:AbortSignal.timeout(125000)});
  assert.equal(response.status,200);const report=await response.json();
  const mapped=C.enrich(report.table.rows,catalog);
  assert.equal(report.table.total,report.table.rows.length);
  const summary={at:new Date().toISOString(),sourceBytes:bytes.length,sha256:catalog.version,products:catalog.rows.length,clients:[...new Set(catalog.rows.map(r=>r.client))],totals:report.totals,loadMs:Date.now()-started,mapping:mapped.summary,
    methods:Object.fromEntries([...new Set(mapped.rows.map(r=>r.clientMatch))].map(k=>[k,mapped.rows.filter(r=>r.clientMatch===k).length])),
    unmatched:[...new Map(mapped.rows.filter(r=>r.client===C.UNMAPPED).map(r=>[r.sku+'|'+r.product,{sku:r.sku,product:r.product,reason:r.clientMatch}])).values()]};
  save('orders-before.json',report);save('master-inspection.json',summary);console.log(JSON.stringify(summary,null,2));
}
async function upload(){
  const bytes=fs.readFileSync(source),catalog=await C.parse(bytes,ExcelJS),id=C.RESOURCE_ID,name=path.basename(source);
  const records=await json(`${base}:runQuery`,'POST',{structuredQuery:{from:[{collectionId:'portalResources'}],select:{fields:['sourceName','storagePath','sha256'].map(fieldPath=>({fieldPath}))},limit:501}});
  const docs=records.filter(r=>r.document).map(r=>r.document);assert.ok(docs.length<501);
  const existing=docs.find(d=>d.name.endsWith('/'+id));
  if(existing){assert.equal(existing.fields.sha256?.stringValue,catalog.version,'An existing master differs; do not overwrite it');console.log('Identical master is already in Resources.');return;}
  assert.ok(!docs.some(d=>d.fields.sourceName?.stringValue===name),'Master is already catalogued under another ID; review before adding');
  const storagePath=`portal-resources/${id}/${catalog.version.slice(0,16)}_${name}`;
  const gc=args=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  const token=gc(['auth','print-access-token',`--project=${project}`,'--quiet']),email=gc(['config','get-value','account','--quiet']);
  assert.match(email,/^[^\s@]+@[^\s@]+$/);
  const storage=async(url,options={})=>{const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'x-goog-user-project':project,...options.headers}});if(r.status===404&&!options.method)return null;if(!r.ok)throw Error(`Resource storage request failed: HTTP ${r.status}`);return r.json();};
  const metadataUrl=`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}`;
  let metadata=await storage(metadataUrl);
  if(!metadata){
    const boundary='nexus_'+crypto.randomBytes(12).toString('hex'),type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const meta={name:storagePath,contentType:type,cacheControl:'private, no-store',metadata:{resourceId:id,sha256:catalog.version,source:'nexus-resources'}};
    const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    metadata=await storage(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  assert.equal(metadata.md5Hash,crypto.createHash('md5').update(bytes).digest('base64'));assert.equal(Number(metadata.size),bytes.length);assert.ok(!metadata.metadata?.firebaseStorageDownloadTokens);
  const at=new Date().toISOString(),actor=`cloud-operator:${email}`;
  const resource={title:'Geo Product Order Master',category:'Meridian Product Master',sourceName:name,storagePath,size:bytes.length,type:metadata.contentType,active:true,tags:['georep','franchise-orders','product-master','client-mapping'],description:'Geo Rep order product master. Brand supplies the Franchise Orders Clients filter. Products match exact SKU/barcode or an unambiguous exact product name; no fuzzy or inferred client allocations.',sha256:catalog.version,createdBy:actor,updatedBy:actor,createdByEmail:email,updatedByEmail:email,versions:[{storagePath,sourceName:name,size:bytes.length,type:metadata.contentType,savedAt:at,savedByEmail:email}]};
  const fields=encode(resource).mapValue.fields;fields.createdAt={timestampValue:at};fields.updatedAt={timestampValue:at};
  await json(`${base}:commit`,'POST',{writes:[{update:{name:`${root}/portalResources/${id}`,fields},currentDocument:{exists:false}}]});
  const saved=await json(`${base}/portalResources/${id}`);assert.equal(saved.fields.sha256.stringValue,catalog.version);assert.equal(saved.fields.storagePath.stringValue,storagePath);
  const result={at,resourceId:id,sha256:catalog.version,products:catalog.rows.length,privateWorkbook:true,publicDownloadTokens:false,readBackVerified:true};save('resource-upload.json',result);console.log(JSON.stringify(result,null,2));
}
async function approveCranberry(){
  const doc=await json(`${base}/portalResources/${C.RESOURCE_ID}`);
  const clientOverrides=[{sku:'6009612472391',product:'aQuelle Cranberry 500ml 6 pack',client:'aQuelle'},{sku:'6009612472421',product:'aQuelle Cranberry 1.5L 6pack',client:'aQuelle'}];
  const workbook=await C.parse(fs.readFileSync(source),ExcelJS);C.index(workbook,clientOverrides);
  const at=new Date().toISOString(),fields=encode({clientOverrides,clientOverridesApproval:{at,source:'Explicit user approval in Nexus implementation conversation',reason:'Two Cranberry SKUs are absent from the original workbook; assign both to aQuelle.'}}).mapValue.fields;
  fields.updatedAt={timestampValue:at};
  await json(`${base}:commit`,'POST',{writes:[{update:{name:doc.name,fields},updateMask:{fieldPaths:Object.keys(fields)},currentDocument:{updateTime:doc.updateTime}}]});
  const saved=await json(`${base}/portalResources/${C.RESOURCE_ID}`);assert.deepEqual(saved.fields.clientOverrides,fields.clientOverrides);
  const result={at,resourceId:C.RESOURCE_ID,approvedMappings:clientOverrides,workbookUnchanged:saved.fields.sha256.stringValue===workbook.version};save('approved-client-mappings.json',result);console.log(JSON.stringify(result,null,2));
}
async function grantRead(){
  assert.ok(process.argv.includes('--approve-product-master-read'),'Explicit product-master read scope required');
  const url=`https://storage.googleapis.com/storage/v1/b/${bucket}/iam`,policy=await json(url+'?optionsRequestedPolicyVersion=3');
  const backup=path.join(stage,'product-master-storage-iam-before.json');if(!fs.existsSync(backup))save('product-master-storage-iam-before.json',policy);
  const member=`serviceAccount:nexus-public-viewer@${project}.iam.gserviceaccount.com`;
  const condition={title:'public-dashboard-product-master-read',description:'Read only the approved Geo product master resource; no other resources or writes.',expression:`resource.name.startsWith('projects/_/buckets/${bucket}/objects/portal-resources/${C.RESOURCE_ID}/')`};
  policy.version=3;policy.bindings ||= [];
  const existing=policy.bindings.find(b=>b.role==='roles/storage.objectViewer'&&b.condition?.title===condition.title);
  if(existing){assert.deepEqual(existing.condition,condition);assert.deepEqual(existing.members,[member]);}
  else {policy.bindings.push({role:'roles/storage.objectViewer',members:[member],condition});await json(url,'PUT',policy);}
  const verified=await json(url+'?optionsRequestedPolicyVersion=3');
  assert.ok(verified.bindings.some(b=>b.role==='roles/storage.objectViewer'&&b.members.includes(member)&&b.condition?.expression===condition.expression));
  save('product-master-storage-iam-after.json',verified);console.log('Verified read-only access for the report service to the single product master resource folder; no public download access or other resource grant.');
}
const actions={inspect,upload,approveCranberry,grantRead};if(require.main===module){assert.ok(actions[process.argv[2]],'Use inspect, upload, approveCranberry or grantRead');actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});}
