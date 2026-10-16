"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {json,hash}=require("./release-multi-admin.cjs"),{gc}=require("./release-etls.cjs"),{fields}=require("./refresh-national-master-20260924.cjs");
const {readExpected}=require("../etl-worker/shared-layout.cjs");
const root="C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs",stage=path.resolve(__dirname,"../.tmp/shared-etls-20260924/resources");
const project="meridain-nexus",bucket="meridain-nexus.firebasestorage.app",base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const refKey="etlReferenceSets/anchor-pnp-v1",type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),"utf8"));
function save(file,value){fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2),{flag:"wx"});}
const encode=v=>v===null?{nullValue:null}:typeof v==="string"?{stringValue:v}:typeof v==="boolean"?{booleanValue:v}:typeof v==="number"?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
async function audit(){
  const refs=await json(`${base}/${refKey}`),current=fields(refs),documents={};
  for(const [role,id] of Object.entries(current.resources))documents[role]=await json(`${base}/portalResources/${id}`);
  const validation=JSON.parse(fs.readFileSync(".tmp/shared-etls-20260924/validation/results.json","utf8"));
  for(const [role,checksum] of Object.entries(validation.checksums))assert.equal(fields(documents[role]).sha256,checksum,`${role}: live reference differs from validated input`);
  const samples=[];
  for(const [role,kind,relative] of [["inventorySample","Inventory","ANCHOR/Transformed Inventory File- Anchor.xlsx"],["salesSample","Sales","ETHICA/Ethica Sales- Transformed.xlsx"]]){
    const file=path.join(root,relative),bytes=fs.readFileSync(file),layout=await readExpected(bytes,kind);
    assert.equal(layout.worksheets[0].actualRowCount,1);
    const id=`etl-shared-${kind.toLowerCase()}-sample`,sha256=hash(bytes),sourceName=path.basename(file);
    samples.push({id,role,kind,file,sourceName,sha256,size:bytes.length,md5Hash:crypto.createHash("md5").update(bytes).digest("base64"),storagePath:`portal-resources/${id}/${sha256.slice(0,16)}_${sourceName}`});
  }
  save("audit.json",{refs,documents,samples,at:new Date().toISOString()});console.log("Shared samples validated; current master hashes match local replay. No files changed.");
}
async function upload(){
  const audit=read("audit.json"),token=gc("auth","print-access-token",`--project=${project}`,"--quiet").trim();
  for(const item of audit.samples){
    const receipt=`uploaded-${item.role}.json`;if(fs.existsSync(path.join(stage,receipt)))continue;
    const bytes=fs.readFileSync(item.file);assert.equal(hash(bytes),item.sha256);
    const boundary="nexus_"+crypto.randomBytes(12).toString("hex"),meta={name:item.storagePath,contentType:type,cacheControl:"private, no-store",metadata:{resourceId:item.id,sha256:item.sha256,source:"shared-etl-transformed-sample"}};
    const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const response=await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`,{method:"POST",redirect:"error",headers:{Authorization:`Bearer ${token}`,"x-goog-user-project":project,"Content-Type":`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(120000)});
    assert.ok(response.ok,`Private create-only upload returned ${response.status}; shared pointers unchanged.`);
    const result=await response.json();assert.equal(result.md5Hash,item.md5Hash);assert.equal(Number(result.size),item.size);assert.equal(result.metadata.sha256,item.sha256);assert.ok(!result.metadata.firebaseStorageDownloadTokens);
    save(receipt,{...item,generation:result.generation});
  }
  console.log("Two private transformed samples uploaded unchanged; checksums verified from upload receipts.");
}
async function publish(){
  const audit=read("audit.json"),current=fields(audit.refs),now=new Date().toISOString(),writes=[];
  assert.equal((await json(`${base}/${refKey}`)).updateTime,audit.refs.updateTime);
  const resources={...current.resources};delete resources.template;
  for(const item of audit.samples.map(s=>read(`uploaded-${s.role}.json`))){
    const record={title:`${item.kind} transformed sample - shared`,description:"Shared output headers and formatting for all file-based ETL customers/channels. Sample records are never copied to a new output.",sourceName:item.sourceName,storagePath:item.storagePath,size:item.size,type,sha256:item.sha256,generation:item.generation,category:"Reference",active:true,tags:["etl","shared",`etl-anchor-${item.role}`],versions:[{storagePath:item.storagePath,sourceName:item.sourceName,size:item.size,type,sha256:item.sha256,generation:item.generation,savedAt:now}],createdAt:now,updatedAt:now,updatedBy:"authorized-shared-etl-setup-20260924"};
    writes.push({update:{name:`projects/${project}/databases/(default)/documents/portalResources/${item.id}`,fields:encode(record).mapValue.fields},currentDocument:{exists:false}});
    resources[item.role]=item.id;
  }
  for(const [role,doc] of Object.entries(audit.documents))assert.equal((await json(`${base}/${doc.name.split("/documents/")[1]}`)).updateTime,doc.updateTime,role);
  const revision=Number(current.revision)+1;
  const patch={resources,revision,updatedAt:now,updatedBy:{uid:"authorized-shared-etl-setup-20260924",email:""}};
  writes.push({update:{name:audit.refs.name,fields:encode(patch).mapValue.fields},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:{updateTime:audit.refs.updateTime}});
  save("writes.json",writes);const result=await json(`${base}:commit`,"POST",{writes});assert.equal(result.writeResults.length,3);
  save("published.json",{revision,resources,at:now,commitTime:result.commitTime});console.log(`Shared ETL set v${revision} activated. Existing masters and historical reports retained.`);
}
async function verify(){
  for(const write of read("writes.json")){
    const doc=await json(`${base}/${write.update.name.split("/documents/")[1]}`);
    for(const [k,v] of Object.entries(write.update.fields))assert.deepEqual(doc.fields[k],v);
  }
  for(const doc of Object.values(read("audit.json").documents))assert.deepEqual(await json(`${base}/${doc.name.split("/documents/")[1]}`),doc);
  save("verified.json",{...read("published.json"),verifiedAt:new Date().toISOString(),mastersUnchanged:true,historicalOutputsUnchanged:true,blankTemplateRetainedButNotRequired:true});console.log("Shared references verified; old template and master Resources unchanged.");
}
const actions={audit,upload,publish,verify};
Promise.resolve().then(()=>{assert.ok(actions[process.argv[2]]);return actions[process.argv[2]]();}).catch(e=>{console.error(e.stack);process.exitCode=1;});
