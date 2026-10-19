'use strict';
// processExtraction hand-off v2: SharePoint tracker updates also go to the Azure worker. v1 (5 Oct) kept
// tracker modes on Google; a supervised tracker run on Azure (azure-canary-tracker-mvam8deu, 16 Oct) matched
// Google's output, so the tracker exclusion is removed. Only retailers with executor "azure" are affected.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/georep-handoff-trackers-20261016'),name='processExtraction';
const OLD=`  // Automations moved to Azure (retailers/<id>.executor == "azure") are handed to the Azure worker;
  // tracker steps stay here. The Azure worker runs this same code with NEXUS_EXECUTOR=azure.
  if (process.env.NEXUS_EXECUTOR !== "azure" && run.status === "queued" && run.retailerId && !/tracker/.test(run.workflowMode || "")) {`;
const NEW=`  // Automations moved to Azure (retailers/<id>.executor == "azure"), tracker updates included, are handed to
  // the Azure worker. The Azure worker runs this same code with NEXUS_EXECUTOR=azure.
  if (process.env.NEXUS_EXECUTOR !== "azure" && run.status === "queued" && run.retailerId) {`;
const read=f=>JSON.parse(fs.readFileSync(path.join(stage,f),'utf8'));
const save=(f,v)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2));};
function patch(source){
  assert.equal(source.split(OLD).length,2,'v1 hand-off block must appear exactly once');
  return source.replace(OLD,NEW);
}
async function prepare(){
  const fn=await json(fnUrl(name));save('before.json',fn);const s=fn.buildConfig.source.storageSource;
  const zip=await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const live=path.join(stage,'live');fs.rmSync(live,{recursive:true,force:true});
  for(const f of Object.keys(zip.files)){if(zip.files[f].dir)continue;const t=path.join(live,f);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,await zip.file(f).async('nodebuffer'));}
  const source=fs.readFileSync(path.join(live,'index.js'),'utf8'),patched=patch(source);
  new Function('require','module','exports','__filename','__dirname',patched);
  fs.writeFileSync(path.join(stage,'index.patched.js'),patched);
  save('prepared.json',{at:new Date().toISOString(),revision:fn.serviceConfig.revision,baseline:fileHashes(live),patched:hash(Buffer.from(patched))});
  console.log(`Prepared hand-off v2 for ${fn.serviceConfig.revision} (${patched.length-source.length} bytes changed).`);
}
async function deploy(){
  const prepared=read('prepared.json'),before=read('before.json'),live=path.join(stage,'live');
  const fn=await json(fnUrl(name));assert.equal(fn.serviceConfig.revision,prepared.revision,'processExtraction changed since prepare');
  assert.deepEqual(fileHashes(live),prepared.baseline);
  const patched=fs.readFileSync(path.join(stage,'index.patched.js'));assert.equal(hash(patched),prepared.patched);
  // No run may be active on Google while the function is replaced (Azure runs are unaffected).
  const recent=Date.now()-30*60*1000;
  const runs=await json('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:['status','lastActivityAt','executor'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'status'},op:'IN',value:{arrayValue:{values:['running','queued'].map(stringValue=>({stringValue}))}}}},limit:100}});
  const active=runs.filter(r=>r.document&&r.document.fields?.executor?.stringValue!=='azure'&&Date.parse(r.document.fields?.lastActivityAt?.timestampValue||0)>recent).map(r=>r.document.name.split('/').at(-1));
  assert.equal(active.length,0,'Active Google extraction runs: '+active.join(','));
  const zip=new Zip();for(const f of Object.keys(prepared.baseline))zip.file(f,f==='index.js'?patched:fs.readFileSync(path.join(live,f)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',op);
  console.log('Building processExtraction with hand-off v2 (trackers to Azure).');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],fn.serviceConfig[field],field);
  const filters=t=>JSON.stringify([...(t.eventFilters||[])].sort((a,b)=>a.attribute.localeCompare(b.attribute)));
  assert.equal(filters(after.eventTrigger),filters(fn.eventTrigger));assert.equal(after.eventTrigger.eventType,fn.eventTrigger.eventType);assert.equal(after.eventTrigger.retryPolicy,fn.eventTrigger.retryPolicy);
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; trigger and runtime unchanged. Rollback source generation ${before.buildConfig.source.storageSource.generation}.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
