"use strict";
// Publish the latest verified Google Franchise Orders source to the Azure snapshot.
// Only Orders inputs are replaced; Attendance documents and workbooks must stay identical.
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {api,json}=require("./release-multi-admin.cjs");
const {hash,validate,adapters,storageAllowed}=require("../azure-field-dashboards/server/snapshot-data.cjs");
const {unpackSnapshot}=require("../azure-field-dashboards/attendance-publisher/core.cjs");
const {decode}=require("../azure-field-dashboards/attendance-publisher/index.cjs");
const base="https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents",bucket="meridain-nexus.firebasestorage.app";
const container="https://meridianfield730011.blob.core.windows.net/dashboard-data/",live="https://meridian-field-dashboards.azurewebsites.net";
const stage=path.resolve(__dirname,"../.tmp/azure-orders-refresh-20261001");
const save=(name,data)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,name),JSON.stringify(data,null,2));};
const data=doc=>decode({mapValue:{fields:doc.fields||{}}});
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));
const isOrders=key=>key.startsWith("publicDashboardOrderImports/")||key.startsWith("salesTransactions/")||key.startsWith("publicDashboardSources/")||key==="portalResources/geo-product-order-master";
const isOrdersFile=name=>name.startsWith("portal-resources/geo-product-order-master/");

async function main(){
  const token=execFileSync("powershell.exe",["-NoProfile","-Command","& 'C:/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az.cmd' account get-access-token --subscription 02b268fe-e01a-453e-b287-eec83ccc0676 --resource https://storage.azure.com/ --query accessToken -o tsv"],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","inherit"]}).trim();
  async function blob(name,{method="GET",body,conditions={}}={}){
    assert.ok(name==="current.json"||/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(name));
    const r=await fetch(container+name,{method,headers:{Authorization:"Bearer "+token,"x-ms-version":"2023-11-03",...(body?{"x-ms-blob-type":"BlockBlob","Content-Type":name.endsWith(".gz")?"application/gzip":"application/json","Cache-Control":"private, no-store"}:{}),...conditions},body,signal:AbortSignal.timeout(120000)});
    assert.ok(r.ok,`Azure blob ${method} ${name} ${r.status}`);return {bytes:Buffer.from(await r.arrayBuffer()),etag:r.headers.get("etag")};
  }
  const current=await blob("current.json"),pointer=JSON.parse(current.bytes);assert.ok(current.etag);
  const before=unpackSnapshot(pointer,(await blob(pointer.blob)).bytes),next=structuredClone(before);
  for(const key of Object.keys(next.documents))if(isOrders(key)){delete next.documents[key];delete next.sourceUpdates?.[key];}
  for(const name of Object.keys(next.files))if(isOrdersFile(name))delete next.files[name];
  const versions={};
  async function document(name,fields){
    let doc;try{doc=await json(base+"/"+name);}catch(error){if(String(error.message).startsWith("GET 404:"))return null;throw error;}
    next.documents[name]=fields?pick(data(doc),fields):data(doc);versions[name]=doc.updateTime;return next.documents[name];
  }
  async function workbook(storagePath,expected){
    assert.ok(storageAllowed(storagePath),"Unsupported workbook path");
    const held=before.files[storagePath];
    if(held&&/^[a-f0-9]{64}$/.test(expected||"")&&held.sha256===expected){next.files[storagePath]=held;return;}
    const url=`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}`,meta=await json(url);
    assert.ok(Number(meta.size)<=25*1024*1024);
    const bytes=Buffer.from(await (await api(url+"?alt=media&generation="+meta.generation)).arrayBuffer()),sha256=hash(bytes);
    if(/^[a-f0-9]{64}$/.test(expected||""))assert.equal(sha256,expected,"Workbook checksum mismatch");
    next.files[storagePath]={size:bytes.length,sha256,base64:bytes.toString("base64")};
  }
  const resource=await document("portalResources/geo-product-order-master",["active","storagePath","updatedAt","sha256","clientOverrides"]);
  if(resource?.active!==false&&resource?.storagePath)await workbook(resource.storagePath,resource.sha256);
  await document("publicDashboardSources/orderRegions",["active","regions","version","sourceName"]);
  const orders=await document("publicDashboardSources/orders",["version","period","rowCount","importedAt","range","brandColumn","brandRows","summaryDifference"]);
  assert.ok(/^[a-f0-9]{64}$/.test(orders?.version),"Missing verified Orders source");
  const previousOrders=before.documents["publicDashboardSources/orders"];
  assert.ok(String(orders.range?.endDate)>=String(previousOrders.range?.endDate),"Orders would move backwards");
  if(orders.version===previousOrders.version){console.log("Azure already serves Orders version "+orders.version);return;}
  let page;do{
    const q=new URLSearchParams({pageSize:"1000",...(page?{pageToken:page}:{})}),chunks=await json(base+"/publicDashboardOrderImports/"+orders.version+"/chunks?"+q);
    for(const doc of chunks.documents||[])next.documents[doc.name.split("/documents/")[1]]={rows:data(doc).rows};
    page=chunks.nextPageToken;
  }while(page);
  const fields=["periodKey","orderDate","orderNumber","storeCode","sku","poNumber","quantity","value","unitPrice","mapped","importedAt","sourceSystem","region","province","rep","manager","storeName","product","status","client","banner","channel","brand","category","currency","Brands","brands","Brand","Brand Name"];
  const ledger=(await json(base+":runQuery","POST",{structuredQuery:{from:[{collectionId:"salesTransactions"}],select:{fields:fields.map(f=>({fieldPath:f.includes(" ")?"`"+f+"`":f}))},limit:30001}})).filter(r=>r.document).map(r=>r.document);
  assert.ok(ledger.length<=30000,"Ledger exceeds snapshot bound");
  for(const doc of ledger)next.documents["salesTransactions/"+doc.name.split("/").at(-1)]=data(doc);
  for(const [name,updateTime] of Object.entries(versions))assert.equal((await json(base+"/"+name+"?mask.fieldPaths=updatedAt")).updateTime,updateTime,"Source changed during copy; repeat");
  next.sourceUpdates={...next.sourceUpdates,...versions};next.capturedAt=new Date().toISOString();validate(next);
  // Attendance must be byte-for-byte the published data.
  for(const [key,value] of Object.entries(before.documents))if(!isOrders(key))assert.deepEqual(next.documents[key],value,key);
  for(const [name,file] of Object.entries(before.files))if(!isOrdersFile(name))assert.equal(next.files[name]?.sha256,file.sha256,name);
  const ExcelJS=require("../azure-field-dashboards/node_modules/exceljs"),{createService}=require("../azure-field-dashboards/server/report-engine/service.cjs");
  class ReportError extends Error{constructor(code,message){super(message);this.code=code;}}
  const service=snap=>createService({...adapters(snap),ExcelJS,HttpsError:ReportError});
  const oldOrders=await service(before).orders({}),newOrders=await service(next).orders({}),exported=await service(next).orders({includeCancelled:true,export:true});
  assert.ok(exported.table.rows.length>0&&newOrders.totals);
  for(const audience of ["rep","merchandiser"]){const a=await service(before).attendance({audience}),b=await service(next).attendance({audience});assert.deepEqual(b.metrics,a.metrics);assert.equal(b.version,a.version);}
  const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(next)),{level:9}),sha256=hash(bytes);assert.ok(bytes.length<=30*1024*1024);
  const name="snapshots/"+sha256+".json.gz";await blob(name,{method:"PUT",body:bytes,conditions:{"If-None-Match":"*"}});assert.equal(hash((await blob(name)).bytes),sha256);
  const updated={...pointer,blob:name,sha256,bytes:bytes.length,capturedAt:next.capturedAt,ordersImportedAt:orders.importedAt};
  await blob("current.json",{method:"PUT",body:Buffer.from(JSON.stringify(updated)),conditions:{"If-Match":current.etag}});
  const result={at:new Date().toISOString(),previous:pointer,updated,ordersVersion:orders.version,range:orders.range,rowCount:orders.rowCount,ledgerRecords:ledger.length,oldTotals:oldOrders.totals,newTotals:newOrders.totals,exportRows:exported.table.rows.length};
  save("published.json",result);
  console.log(JSON.stringify({range:orders.range,importedAt:orders.importedAt,rowCount:orders.rowCount,oldTotals:oldOrders.totals,newTotals:newOrders.totals,snapshot:sha256},null,2));
  console.log("Published Orders to Azure; Attendance documents, workbooks and report metrics unchanged.");
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
