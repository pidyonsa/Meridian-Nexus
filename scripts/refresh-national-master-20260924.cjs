"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { json, hash } = require("./release-multi-admin.cjs");
const stage = path.resolve(__dirname, "../.tmp/national-master-20260924");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const source = "C:/Users/PC/Downloads/National_Call_Cycle_Masters 23.09.2026.xlsx";
const decode = v => v?.stringValue ?? v?.integerValue ?? v?.doubleValue ?? v?.booleanValue ?? v?.timestampValue ?? (v?.arrayValue ? (v.arrayValue.values || []).map(decode) : v?.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k,decode(x)])) : null);
const fields = doc => Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v]) => [k,decode(v)]));
const save = (name, value) => { fs.mkdirSync(stage,{recursive:true}); fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2)); };
const read = name => JSON.parse(fs.readFileSync(path.join(stage,name),"utf8"));
const encode = v => v===null?{nullValue:null}:typeof v==="string"?{stringValue:v}:typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{[Number.isInteger(v)?"integerValue":"doubleValue"]:Number.isInteger(v)?String(v):v}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
async function query(collection, columns) {
  const rows = await json(`${base}:runQuery`, "POST", {structuredQuery:{from:[{collectionId:collection}],select:{fields:columns.map(fieldPath=>({fieldPath}))},limit:501}});
  const docs = rows.filter(r=>r.document).map(r=>r.document); assert.ok(docs.length<501,`${collection} exceeds audit limit`);
  return docs.map(d=>({id:d.name.split("/").at(-1),name:d.name,updateTime:d.updateTime,data:fields(d)}));
}
async function audit() {
  const common = ["name","title","storagePath","sourceName","sha256","size","active","updatedAt","versions","sheetName","storeCount","regionCount","masterStoragePath","masterSourceName"];
  const config = ["storeMasterId","storeMasterName","operationalWeek","operationalWeekUpdatedAt","updatedAt","masterId"];
  const requests = {
    portalResources:[...common,"category","tags"],
    etlReferenceSets:["resources","revision","updatedAt"],
    etlPipelineSetups:["id","customer","client","retailer","retailerId","channel","references","resources","referenceSetId","updatedAt"],
    dataorbisMonthlyTemplates:["month","approved","callCycle","cleanup","updatedAt"],
    geoRepStoreMasters:common, salesStoreMasters:common, attendanceStoreMasters:common,
    geoRepAttendanceConfig:config, geoRepMerchandiserAttendanceConfig:config, salesDashboardConfig:config,
    geoRepAttendanceDashboard:["operationalWeek","updatedAt","updatedByRunId","reportStartDate","reportEndDate","source"]
  };
  const result = {at:new Date().toISOString(),source:{name:path.basename(source),size:fs.statSync(source).size,sha256:hash(fs.readFileSync(source))},collections:{}};
  for (const [collection,columns] of Object.entries(requests)) result.collections[collection] = await query(collection,columns);
  save("audit.json",result);
  console.log(JSON.stringify({...result,collections:{...result.collections,portalResources:result.collections.portalResources.filter(r=>/store|call.?cycle|national/i.test(JSON.stringify(r.data))),etlPipelineSetups:result.collections.etlPipelineSetups.map(r=>({id:r.id,...r.data}))}},null,2));
}
async function prepare() {
  const ExcelJS = require("../etl-worker/node_modules/exceljs"), engine = require("../etl-worker/engine.cjs");
  const bytes = fs.readFileSync(source); assert.equal(hash(bytes),read("audit.json").source.sha256);
  await engine.inspectZip(bytes);
  const original = new ExcelJS.Workbook(); await original.xlsx.load(bytes);
  const sheet = original.getWorksheet("Call Cycle Master"); assert.ok(sheet);
  engine.SCHEMAS.staffing[1].forEach((h,i)=>assert.equal(engine.norm(sheet.getCell(1,i+1).text),engine.norm(h)));
  const pairs = new Map(), regionConflicts = [], incompleteIdentities = [];
  const pair = (code,name) => JSON.stringify([code,name].map(engine.norm));
  const rows = [];
  sheet.eachRow((r,line)=>{
    if(line===1)return;
    const v=Array.from({length:26},(_,i)=>{
      const cell=r.getCell(i+1); assert.ok(!cell.value || typeof cell.value!=="object",`Non-literal master cell ${line}:${i+1}`); return cell.value ?? "";
    });
    if(!v[0] || !v[1])incompleteIdentities.push([line,v[0],v[1],"Missing code or name; no invented identifier"]);
    rows.push({line,v}); if(!v[0] && !v[1])return; const k=pair(v[0],v[1]);
    if(!pairs.has(k))pairs.set(k,{line,v,regions:new Set()});
    pairs.get(k).regions.add(engine.norm(v[7]));
  });
  for(const entry of pairs.values()) if(entry.regions.size>1)regionConflicts.push([entry.v[0],entry.v[1],entry.v[7],entry.line,[...entry.regions].join(" | ")]);
  const manifest=[];
  function item(id,name,data,folder,extra={}) {
    fs.mkdirSync(path.join(stage,"files"),{recursive:true});const file=path.join(stage,"files",name);fs.writeFileSync(file,data);
    const sha256=hash(data);const out={id,name,file,size:data.length,sha256,storagePath:`${folder}/${sha256.slice(0,16)}_${name}`,...extra};manifest.push(out);return out;
  }
  const national=item("national-store-master",path.basename(source),bytes,"portal-resources/national-store-master");
  const staffingBook=new ExcelJS.Workbook(), staffing=staffingBook.addWorksheet("Call Cycle Master");
  staffing.addRow(sheet.getRow(1).values.slice(1));for(const r of rows)staffing.addRow(r.v);
  const staffingBytes=Buffer.from(await staffingBook.xlsx.writeBuffer());
  assert.equal((await engine.readWorkbook(staffingBytes,"staffing")).length,rows.length);
  const staffItem=item("inventory-anchor-staffing","National_Call_Cycle_23.09.2026_ETL.xlsx",staffingBytes,"portal-resources/inventory-anchor-staffing",{sourceResourceId:national.id,sourceSha256:national.sha256,staffAssignmentsPreserved:true});
  const lookupBook=new ExcelJS.Workbook(),lookup=lookupBook.addWorksheet("Call Cycle Master");
  const columns=[0,1,2,3,4,5,6,7];lookup.addRow(columns.map(i=>sheet.getCell(1,i+1).value));
  for(const entry of pairs.values()) lookup.addRow(columns.map(i=>entry.v[i]));
  const lookupBytes=Buffer.from(await lookupBook.xlsx.writeBuffer());
  item("attendance-master","National_Store_Lookup_23.09.2026.xlsx",lookupBytes,"geo-rep-attendance-store-masters/geo-rep-attendance-store-master",{sourceResourceId:national.id,sourceSha256:national.sha256,storeCount:pairs.size,regionCount:new Set(rows.map(r=>engine.norm(r.v[7])).filter(Boolean)).size,sheetName:"Call Cycle Master"});
  item("orders-master","National_Store_Lookup_23.09.2026.xlsx",lookupBytes,"geo-rep-sales-store-masters/geo-rep-orders-store-master",{sourceResourceId:national.id,sourceSha256:national.sha256});
  item("geo-capture-lookup","National_Store_Lookup_23.09.2026.xlsx",lookupBytes,"geo-rep-store-masters/dischem-triparc-grab-and-go",{sourceResourceId:national.id,sourceSha256:national.sha256});
  item("dataorbis-callcycle","National_Call_Cycle_23.09.2026_ETL.xlsx",staffingBytes,"dataorbis-inputs/2026-08/national-master-20260924",{sourceResourceId:national.id,sourceSha256:national.sha256});
  const cleanFile="C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/SALES DATA STORE NAME CLEAN UP .xlsx";
  const cleanBytes=fs.readFileSync(cleanFile);assert.equal(hash(cleanBytes),read("audit.json").collections.portalResources.find(r=>r.id==="inventory-anchor-stores").data.sha256);
  const cleanRows=await engine.readWorkbook(cleanBytes,"stores");
  const canonical=pairs.get(pair("EF18","PNP MDANTSANE"));assert.ok(canonical);assert.equal(engine.norm(canonical.v[3]),"PICK N PAY CORPORATE");
  const aliases=new Set([pair("EC31","EM Mdantsane"),pair("EF18","PnP EM Mdantsane City")]);
  const seen=new Set(), cleaned=[], approved=[], duplicates=[];
  for(const row of cleanRows){
    const v=[...row.v];
    if(aliases.has(pair(v[1],v[2])) && /^(PNP|PICK N PAY)/.test(engine.norm(v[0]))){
      approved.push([row.line,v[1],v[2],v[4],v[5],"EF18","PNP MDANTSANE","Tim reply supplied by user, 2026-09-24"]);
      v[3]=canonical.v[3];v[4]="EF18";v[5]="PNP MDANTSANE";v[6]=canonical.v[3];
    }
    const cellErrors=(row.cellErrors||[]).filter(e=>!(aliases.has(pair(v[1],v[2])) && [4,5,6,7].includes(e.column)));
    const signature=JSON.stringify([v.map(engine.norm),cellErrors]);if(seen.has(signature)){duplicates.push(row.line);continue;}seen.add(signature);cleaned.push({line:row.line,v,cellErrors});
  }
  if(!cleaned.some(r=>pair(r.v[1],r.v[2])===pair("EC31","EM Mdantsane"))){
    cleaned.push({line:0,v:["PNP","EC31","EM Mdantsane",canonical.v[3],"EF18","PNP MDANTSANE",canonical.v[3]]});
    approved.push(["New approved alias","EC31","EM Mdantsane","","","EF18","PNP MDANTSANE","Tim reply supplied by user, 2026-09-24"]);
  }
  for(const alias of aliases)assert.ok(cleaned.some(r=>pair(r.v[1],r.v[2])===alias),"Approved alias absent from cleaned list");
  const cleanBook=new ExcelJS.Workbook(),cleanSheet=cleanBook.addWorksheet("Sheet1");cleanSheet.addRow(engine.SCHEMAS.stores[1]);for(const r of cleaned){const added=cleanSheet.addRow(r.v);for(const e of r.cellErrors||[])added.getCell(e.column).value={error:e.error};}
  const cleanItem=item("inventory-anchor-stores","Store_Mapping_24.09.2026.xlsx",Buffer.from(await cleanBook.xlsx.writeBuffer()),"portal-resources/inventory-anchor-stores",{approvedAliases:2,exactDuplicateRowsRemoved:duplicates.length,liquorClassification:"pending-review"});
  const review=new ExcelJS.Workbook();
  function tab(name,headers,data){const s=review.addWorksheet(name,{views:[{state:"frozen",ySplit:1}]});s.addRow(headers);data.forEach(r=>s.addRow(r));s.getRow(1).font={bold:true};s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};s.columns.forEach(c=>c.width=26);return s;}
  const groups=new Map();for(const row of cleaned){if(!/^(PNP|PICK N PAY)/.test(engine.norm(row.v[0])))continue;const k=pair(row.v[1],row.v[2]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
  const decisions=[];
  for(const group of groups.values()){
    const alternatives=group.filter(r=>!/LIQUOR/i.test(`${r.v[3]} ${r.v[5]}`));
    for(const row of group.filter(r=>/LIQUOR/i.test(`${r.v[3]} ${r.v[5]}`)))decisions.push([row.v[1],row.v[2],row.v[4],row.v[5],row.v[3],alternatives.map(r=>`${r.v[4]} / ${r.v[5]}`).join(" | "),alternatives.length?"Possible attached - confirm":"Standalone or unclassified - confirm","PENDING","",""]);
  }
  tab("Liquor Review",["Raw Store Code","Raw Store Name","Master Store Code","Master Store Name","Banner","Non-liquor candidates for same raw pair","Classification candidate","Decision (Exclude attached / Keep standalone)","Approved By","Approval Date"],decisions);
  tab("Approved Aliases",["Old mapping row","Raw Code","Raw Name","Old Master Code","Old Master Name","Approved Master Code","Approved Master Name","Approval"],approved);
  tab("Master Region Review",["Store Code","Store Name","First Region","First Master Row","All Regions"],regionConflicts);
  tab("Master Identity Review",["Master Row","Store Code","Store Name","Issue"],incompleteIdentities);
  tab("Reference Audit",["Property","Value"],Object.entries({source:path.basename(source),sourceSha256:national.sha256,sourceRows:rows.length,uniqueStorePairs:pairs.size,duplicateStoreRows:rows.length-pairs.size,staffAssignments:"All retained in ETL reference and original workbook",deduplication:"Only identical complete cleanup mappings removed; conflicting candidates retained",exactDuplicateMappingsRemoved:duplicates.length,liquor:"No attached/standalone classification assumed; Tim/Nakita approval pending",approvedAliases:2,productAndDCExceptions:"Remain for review; missing balances are not zero"}));
  item("pnp-store-mapping-review","PnP_Store_Mapping_Review_24.09.2026.xlsx",Buffer.from(await review.xlsx.writeBuffer()),"portal-resources/pnp-store-mapping-review");
  const regionModule=require("../firebase-dashboards/backend/order-regions.cjs");
  const regionEntries=rows.map(r=>({storeName:r.v[1],region:r.v[7]}));
  const evidence=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../firebase-dashboards/test-results/order-regions/additional-store-evidence.json"),"utf8"));
  const names=new Set(regionEntries.map(r=>regionModule.key(r.storeName)));
  for(const e of evidence) if(!names.has(regionModule.key(e.name)))regionEntries.push(...e.stores);
  const regionResource={...regionModule.compile(regionEntries),active:true,sourceName:path.basename(source),sourceSha256:national.sha256,sourceSheet:sheet.name,additionalEvidence:evidence,updatedAt:new Date().toISOString(),scope:"Exact unambiguous store-name lookup; existing transaction regions preserved"};
  regionModule.index(regionResource);save("order-regions.json",regionResource);
  save("manifest.json",manifest);
  save("prepared.json",{at:new Date().toISOString(),sourceRows:rows.length,uniqueStorePairs:pairs.size,incompleteIdentityRows:incompleteIdentities.length,regionConflicts:regionConflicts.length,liquorDecisionsPending:decisions.length,approvedAliasRows:approved.length,exactDuplicateMappingsRemoved:duplicates.length,sourceSha256:national.sha256,staffingSha256:staffItem.sha256,cleanupSha256:cleanItem.sha256});
  console.log(JSON.stringify(read("prepared.json"),null,2));
}
async function upload() {
  const previous=fs.existsSync(path.join(stage,"uploaded.json"))?read("uploaded.json"):[];
  if(previous.length)save(`uploads-before-${Date.now()}.json`,previous);
  const {execFileSync}=require("node:child_process"),crypto=require("node:crypto");
  const token=execFileSync("powershell.exe",["-NoProfile","-File","C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1","auth","print-access-token","--project=meridain-nexus","--quiet"],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","inherit"]}).trim();
  const uploaded=[];
  for(const item of read("manifest.json")){
    const bytes=fs.readFileSync(item.file);assert.equal(hash(bytes),item.sha256);
    const existing=previous.find(i=>i.id===item.id&&i.sha256===item.sha256&&i.storagePath===item.storagePath);
    if(existing){uploaded.push(existing);continue;}
    const boundary="nexus_"+crypto.randomBytes(12).toString("hex"),type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const meta={name:item.storagePath,contentType:type,cacheControl:"private, no-store",metadata:{sha256:item.sha256,source:"national-master-20260924",sourceSha256:read("prepared.json").sourceSha256}};
    const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const response=await fetch("https://storage.googleapis.com/upload/storage/v1/b/meridain-nexus.firebasestorage.app/o?uploadType=multipart&ifGenerationMatch=0",{method:"POST",headers:{Authorization:`Bearer ${token}`,"x-goog-user-project":"meridain-nexus","Content-Type":`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(120000)});
    assert.ok(response.ok,`Create-only upload failed for ${item.id}: ${response.status}`);const stored=await response.json();
    assert.equal(stored.md5Hash,crypto.createHash("md5").update(bytes).digest("base64"));assert.equal(Number(stored.size),item.size);assert.ok(!stored.metadata?.firebaseStorageDownloadTokens);
    uploaded.push({...item,generation:stored.generation,md5Hash:stored.md5Hash});save("upload-progress.json",uploaded);
    console.log(`Private version uploaded and checksum verified: ${item.id}`);
  }
  save("uploaded.json",uploaded);
}
async function dataorbisProjection() {
  const ExcelJS=require("../etl-worker/node_modules/exceljs"),manifest=read("manifest.json"),old=manifest.find(i=>i.id==="dataorbis-callcycle");
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(manifest.find(i=>i.id==="inventory-anchor-staffing").file);
  assert.equal(book.worksheets.length,1);book.worksheets[0].name="Sheet1";
  const bytes=Buffer.from(await book.xlsx.writeBuffer()),sha256=hash(bytes),name="National_Call_Cycle_23.09.2026_DataOrbis.xlsx",file=path.join(stage,"files",name);
  fs.writeFileSync(file,bytes);
  Object.assign(old,{name,file,size:bytes.length,sha256,storagePath:`dataorbis-inputs/2026-08/national-master-20260924/${sha256.slice(0,16)}_${name}`});
  save("manifest.json",manifest);console.log("Prepared DataOrbis-specific Sheet1 projection, with all call-cycle values unchanged.");
}
async function geoProjection(){
  const ExcelJS=require("../etl-worker/node_modules/exceljs"),manifest=read("manifest.json"),book=new ExcelJS.Workbook();
  await book.xlsx.readFile(manifest.find(i=>i.id==="attendance-master").file);const old=book.worksheets[0];
  const output=new ExcelJS.Workbook(),sheet=output.addWorksheet("Call Cycle Master");
  // The existing dashboard parser selects the leftmost supported identifier.
  // Put the genuinely unique Geo ID first; retailer codes collide across stores.
  const columns=[3,1,2,4,5,6,7,8];
  old.eachRow(row=>sheet.addRow(columns.map(c=>row.getCell(c).value)));
  const bytes=Buffer.from(await output.xlsx.writeBuffer()),sha256=hash(bytes),name="Geo_Store_Lookup_23.09.2026.xlsx",file=path.join(stage,"files",name);fs.writeFileSync(file,bytes);
  for(const id of ["attendance-master","orders-master"]){const i=manifest.find(x=>x.id===id);const folder=i.storagePath.slice(0,i.storagePath.lastIndexOf("/"));Object.assign(i,{name,file,size:bytes.length,sha256,storagePath:`${folder}/${sha256.slice(0,16)}_${name}`});}
  const target=manifest.find(i=>i.id==="attendance-master"),reader=require("../azure-field-dashboards/server/report-engine/vendor/source-reader.cjs")({ExcelJS,path,
    db:{collection:name=>({doc:()=>({get:async()=>({exists:true,data:()=>name==="attendanceStoreMasters"?{storagePath:target.storagePath,sourceName:name}: {storeMasterId:"master"}})})})},
    getStorage:()=>({bucket:()=>({file:()=>({download:async({destination})=>fs.copyFileSync(file,destination)})})})});
  const directory=path.join(stage,"reader-validation");fs.mkdirSync(directory,{recursive:true});
  const enrichment=await reader.geoRepAttendanceStoreMasterEnrichment("rep",directory);
  assert.equal(enrichment.byCode.size,read("prepared.json").uniqueStorePairs);assert.equal(enrichment.byName.size,read("prepared.json").uniqueStorePairs);
  const expected=new Set(sheet.getColumn(1).values.slice(2).map(v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim()));
  assert.deepEqual(new Set(enrichment.byCode.keys()),expected);
  save("manifest.json",manifest);save("geo-identifier-validation.json",{at:new Date().toISOString(),identifier:"GEO REP STORE CODE",uniqueIdentifiers:enrichment.byCode.size,uniqueNames:enrichment.byName.size,retailerCodesPreserved:true});
  console.log("Actual Azure reader verified all 9,668 unique Geo IDs and store names; retailer codes remain unchanged in their own column.");
}
async function publishGeoProjection(){
  const writes=[],before=[],now=new Date().toISOString();
  for(const [id,collection,document] of [["attendance-master","attendanceStoreMasters","geo-rep-attendance-store-master"],["orders-master","salesStoreMasters","geo-rep-orders-store-master"]]){
    const i=read("uploaded.json").find(r=>r.id===id);assert.equal(i.sha256,read("manifest.json").find(r=>r.id===id).sha256);
    const key=`${collection}/${document}`,doc=await json(`${base}/${key}`);before.push(doc);
    const values={storagePath:i.storagePath,sourceName:i.name,sha256:i.sha256,generation:i.generation,identifierColumn:"GEO REP STORE CODE",updatedAt:now};
    writes.push({update:{name:doc.name,fields:encode(values).mapValue.fields},updateMask:{fieldPaths:Object.keys(values)},currentDocument:{updateTime:doc.updateTime}});
  }
  // Keep the specialist campaign lookup until its rep/manager fields can be preserved.
  const key="geoRepStoreMasters/dischem-triparc-grab-and-go",original=read("publish-before.json").find(r=>r.key===key).document;
  const change=read("publish-writes.json").find(w=>w.update.name.endsWith("/"+key)),current=await json(`${base}/${key}`);
  for(const [k,v] of Object.entries(change.update.fields))assert.deepEqual(current.fields[k],v,"Campaign lookup changed independently");
  writes.push({update:{name:current.name,fields:original.fields},updateMask:change.updateMask,currentDocument:{updateTime:current.updateTime}});
  save("geo-lookup-before.json",before);save("geo-lookup-writes.json",writes);
  await json(`${base}:commit`,"POST",{writes});save("geo-lookup-published.json",{at:now,identifier:"GEO REP STORE CODE",campaignLookupRestoredToPriorVersion:true});
  console.log("Unique Geo ID lookups activated. Specialist Dischem lookup restored pending its rep/manager-compatible refresh.");
}
async function validateLocal() {
  const engine=require("../etl-worker/engine.cjs"),{folder,files}=require("./test-anchor-etl-real.cjs"),data={};
  const manifest=read("manifest.json"),item=id=>manifest.find(i=>i.id===id);
  for(const [role,name] of Object.entries(files)){
    const file=role==="stores"?item("inventory-anchor-stores").file:role==="staffing"?item("inventory-anchor-staffing").file:path.join(folder,name);
    data[role]=await engine.readWorkbook(fs.readFileSync(file),role);
  }
  for(const [code,name] of [["EC31","EM Mdantsane"],["EF18","PnP EM Mdantsane City"]]){
    const candidates=data.stores.filter(r=>engine.pnp(r.v[0])&&engine.norm(r.v[1])===engine.norm(code)&&engine.norm(r.v[2])===engine.norm(name));
    assert.ok(candidates.length);assert.ok(candidates.every(r=>r.v[4]==="EF18"&&r.v[5]==="PNP MDANTSANE"));
  }
  const result=engine.transform(data,{salesDays:30,openPO:"unknown",bannerColumn:"D",reportDate:"as-of",productFamily:"PICK N PAY CORPORATE",confirmed:true},files.raw);
  assert.ok(result.reconciled);assert.equal(result.totals.sourceStoreSOH,result.totals.validStoreSOH+result.totals.exceptionStoreSOH);
  assert.equal(data.staffing.length,read("prepared.json").sourceRows);assert.equal(new Set(result.facts.map(f=>f.line)).size,result.facts.length);
  const sales=require("../functions/dataorbis-sales.js");
  await sales.readReferences(path.join(folder,files.stores),item("dataorbis-callcycle").file);
  const lookups=require("../firebase-dashboards/backend/order-regions.cjs"),ExcelJS=require("../etl-worker/node_modules/exceljs");
  const lookup=await lookups.parseMaster(fs.readFileSync(item("attendance-master").file),ExcelJS);assert.equal(lookup.length,read("prepared.json").uniqueStorePairs);
  save("local-validation.json",{at:new Date().toISOString(),fixture:files.raw,inventoryAsOf:result.asOf,localReplayOnly:true,sourceAssignments:data.staffing.length,totals:result.totals,issues:result.issueCounts,reconciled:result.reconciled,approvedAliasPairsVerified:2,dataorbisReferenceReadPassed:true,lookupRows:lookup.length,mappingPolicy:result.mappingPolicy});
  console.log(JSON.stringify(read("local-validation.json"),null,2));
}
async function publish() {
  assert.ok(fs.existsSync(path.resolve(__dirname,"../.tmp/etl-mapping-policy-20260924/verified.json")),"Deploy and verify the mapping policy before switching references.");
  assert.ok(read("local-validation.json").reconciled,"Local workbook reconciliation must pass.");
  assert.ok(!fs.existsSync(path.join(stage,"published.json")),"Already published; verify rather than replay.");
  const items=read("uploaded.json"),item=id=>{const v=items.find(i=>i.id===id);assert.ok(v,id);assert.equal(hash(fs.readFileSync(v.file)),v.sha256);return v;};
  const audit=read("audit.json"),before=[],writes=[],now=new Date().toISOString(),actor="nexus-authorized-master-refresh-20260924";
  async function patch(key,values,{timestampKeys=[],expected=null,expectAbsent=false}={}){
    let doc=null;const mask=Object.keys(values).map(k=>"mask.fieldPaths="+encodeURIComponent(k)).join("&");
    try{doc=await json(`${base}/${key}?${mask}`);}catch(e){if(!e.message.startsWith("GET 404:"))throw e;}
    if(expected)assert.equal(doc?.updateTime,expected.updateTime,`${key} changed since the audit`);
    if(expectAbsent)assert.equal(doc,null,`${key} was created after the audit`);
    before.push({key,document:doc});
    const f=encode(values).mapValue.fields;for(const key of timestampKeys)f[key]={timestampValue:now};
    writes.push({update:{name:`projects/meridain-nexus/databases/(default)/documents/${key}`,fields:f},updateMask:{fieldPaths:Object.keys(values)},currentDocument:doc?{updateTime:doc.updateTime}:{exists:false}});
  }
  const resourceSpecs={
    "national-store-master":["National Store Master / Call Cycle - 23 September 2026","Meridian Store Master","Original uploaded workbook, including Call Cycle Master and Merchandiser Hours. Source for the linked, versioned ETL and Geo Rep references."],
    "inventory-anchor-staffing":["ETL Store / Call-cycle Master - 23 September 2026","Meridian Store Master","Call Cycle Master sheet from the latest national workbook. All staff assignments and code/name pairs retained; merchandiser-hour detail remains in the original resource."],
    "inventory-anchor-stores":["Store name clean-up - Tim mapping update","Reference","Tim-approved EC31 / EM Mdantsane and EF18 / PnP EM Mdantsane City aliases to EF18 / PNP MDANTSANE. Identical mappings deduplicated; ambiguous liquor mappings await review."],
    "pnp-store-mapping-review":["PnP store mapping review - Tim and Nakita","Reference","Review attached versus standalone liquor stores and missing store identifiers. Pending decisions are not applied to production. Raw and master store code/name pairs are separate and preserved."]
  };
  for(const [id,[title,category,description]] of Object.entries(resourceSpecs)){
    const i=item(id),old=audit.collections.portalResources.find(r=>r.id===id),type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const version={storagePath:i.storagePath,sourceName:i.name,size:i.size,type,savedAt:now,sha256:i.sha256,generation:i.generation};
    await patch(`portalResources/${id}`,{title,category,description,active:true,storagePath:i.storagePath,sourceName:i.name,size:i.size,type,sha256:i.sha256,generation:i.generation,
      sourceResourceId:i.sourceResourceId||null,sourceSha256:i.sourceSha256||read("prepared.json").sourceSha256,
      tags:old?.data.tags||["etl","national-master"],versions:[...(old?.data.versions||[]),version],updatedAt:now,updatedBy:actor,...(!old?{createdAt:now,createdBy:actor}:{})},{expected:old,expectAbsent:!old});
  }
  const ref=audit.collections.etlReferenceSets.find(r=>r.id==="anchor-pnp-v1");
  await patch("etlReferenceSets/anchor-pnp-v1",{revision:Number(ref.data.revision)+1,updatedAt:now,updatedBy:{uid:actor,email:""},mappingPolicy:"pnp-exact-store-first-region-20260924"},{expected:ref});
  const master=item("attendance-master"),masterName="National Store Master - 23 September 2026";
  await patch("attendanceStoreMasters/geo-rep-attendance-store-master",{id:"geo-rep-attendance-store-master",name:masterName,storagePath:master.storagePath,sourceName:master.name,sha256:master.sha256,generation:master.generation,sourceResourceId:"national-store-master",sourceSha256:read("prepared.json").sourceSha256,active:true,storeCount:master.storeCount,regionCount:master.regionCount,sheetName:master.sheetName,updatedAt:now,updatedBy:actor},{timestampKeys:["updatedAt"]});
  for(const collection of ["geoRepAttendanceConfig","geoRepMerchandiserAttendanceConfig"]){
    const old=audit.collections[collection].find(r=>r.id==="current");
    await patch(`${collection}/current`,{storeMasterId:"geo-rep-attendance-store-master",storeMasterName:masterName,storeMasterUpdatedAt:now,operationalWeek:3,operationalWeekUpdatedAt:now,operationalWeekUpdatedBy:actor,updatedAt:now,updatedBy:actor},{expected:old,timestampKeys:["storeMasterUpdatedAt","operationalWeekUpdatedAt","updatedAt"]});
  }
  for(const id of ["current","merchandisers"]){
    await patch(`geoRepAttendanceDashboard/${id}`,{operationalWeek:3,operationalWeekUpdatedAt:now,operationalWeekUpdatedBy:actor},{timestampKeys:["operationalWeekUpdatedAt"]});
  }
  const orders=item("orders-master"),oldOrders=audit.collections.salesStoreMasters.find(r=>r.id==="geo-rep-orders-store-master");
  await patch("salesStoreMasters/geo-rep-orders-store-master",{storagePath:orders.storagePath,sourceName:orders.name,sha256:orders.sha256,generation:orders.generation,sourceResourceId:"national-store-master",sourceSha256:read("prepared.json").sourceSha256,storeCount:master.storeCount,regionCount:master.regionCount,sheetName:master.sheetName,updatedAt:now,updatedBy:actor},{expected:oldOrders,timestampKeys:["updatedAt"]});
  const geo=item("geo-capture-lookup"),oldGeo=audit.collections.geoRepStoreMasters.find(r=>r.id==="dischem-triparc-grab-and-go");
  await patch("geoRepStoreMasters/dischem-triparc-grab-and-go",{masterStoragePath:geo.storagePath,masterSourceName:geo.name,masterSha256:geo.sha256,masterSourceResourceId:"national-store-master",updatedAt:now,updatedBy:actor},{expected:oldGeo,timestampKeys:["updatedAt"]});
  const dataorbis=item("dataorbis-callcycle"),oldTemplate=audit.collections.dataorbisMonthlyTemplates.find(r=>r.id==="2026-08");
  await patch("dataorbisMonthlyTemplates/2026-08",{callCycle:{storagePath:dataorbis.storagePath,sha256:dataorbis.sha256},callCycleSourceResourceId:"national-store-master",callCycleUpdatedAt:now},{expected:oldTemplate});
  const regionResource=read("order-regions.json");assert.ok(Buffer.byteLength(JSON.stringify(encode(regionResource)))<900000);
  await patch("publicDashboardSources/orderRegions",regionResource);
  save("publish-before.json",before);save("publish-writes.json",writes);
  const result=await json(`${base}:commit`,"POST",{writes});assert.equal(result.writeResults.length,writes.length);
  save("published.json",{at:now,commitTime:result.commitTime,documents:writes.map(w=>w.update.name.split("/documents/")[1]),masterSourceSha256:read("prepared.json").sourceSha256,referenceRevision:2,operationalWeek:3,liquorDecisionsApplied:false,completedReportsChanged:false});
  console.log(JSON.stringify(read("published.json"),null,2));
}
async function verifyMetadata(){
  const combined=[...read("publish-writes.json"),...(fs.existsSync(path.join(stage,"geo-lookup-writes.json"))?read("geo-lookup-writes.json"):[])];
  const writes=[...new Map(combined.map(w=>[w.update.name,w])).values()],verified=[];
  for(const write of writes){
    const key=write.update.name.split("/documents/")[1],mask=write.updateMask.fieldPaths.map(k=>"mask.fieldPaths="+encodeURIComponent(k)).join("&");
    const current=await json(`${base}/${key}?${mask}`);
    assert.deepEqual(current.fields,write.update.fields,`${key} differs from the committed reference`);verified.push({key,updateTime:current.updateTime});
  }
  const after=await query("geoRepAttendanceDashboard",["reportStartDate","reportEndDate","updatedByRunId","updatedAt","operationalWeek"]);
  for(const row of after){const previous=read("audit.json").collections.geoRepAttendanceDashboard.find(r=>r.id===row.id);assert.ok(previous);for(const key of ["reportStartDate","reportEndDate","updatedByRunId","updatedAt"])assert.deepEqual(row.data[key],previous.data[key]);assert.equal(Number(row.data.operationalWeek),3);}
  save("metadata-verified.json",{at:new Date().toISOString(),documents:verified,reportDatesAndRunIdsPreserved:true});
  console.log(`${verified.length} live reference/configuration documents verified. Report dates and completed run IDs are unchanged.`);
}
const actions={audit,prepare,upload,publish,validate:validateLocal,verify:verifyMetadata,"dataorbis-projection":dataorbisProjection,"geo-projection":geoProjection,"publish-geo-projection":publishGeoProjection};
if(require.main===module)Promise.resolve().then(()=>{assert.ok(actions[process.argv[2]],"Specify audit, prepare, upload or publish");return actions[process.argv[2]]();}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={base,stage,source,decode,fields,save,query};
