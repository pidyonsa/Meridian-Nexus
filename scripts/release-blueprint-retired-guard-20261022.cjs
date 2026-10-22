'use strict';
// processExtraction: the Geo Rep Capture Blueprint feature was retired on 22 October (user decision; data archived
// and deleted, its functions deleted). The live processExtraction source has drifted from functions/index.js, so
// instead of redeploying the repo file this patches the deployed bundle: any run in an old geo-rep-blueprint-* mode
// is cancelled before the Azure hand-off, so it never reaches the blueprint code on Google or the Azure worker.
//   node scripts/release-blueprint-retired-guard-20261022.cjs prepare|deploy
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/blueprint-retired-guard-20261022'),name='processExtraction';
const ANCHOR=`  const runRef = event.data.ref;
  const run = event.data.data();
  // Automations moved to Azure (retailers/<id>.executor == "azure") are handed to the Azure worker;
`;
const GUARD=`  // The Geo Rep Capture Blueprint feature was retired (22 October 2026). Cancel any run in one of its old modes
  // before the Azure hand-off, so it never reaches the blueprint code here or on the Azure worker.
  if (/^geo-rep-blueprint-/.test(String(run.workflowMode || ""))) {
    await runRef.set({ status: "cancelled", message: "Geo Rep Capture Blueprint automation has been retired; this run was not processed.", completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
`;
const read=f=>JSON.parse(fs.readFileSync(path.join(stage,f),'utf8'));
const save=(f,v)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2));};
function patch(source){
  assert.equal(source.split(ANCHOR).length,2,'anchor must appear exactly once');
  assert.ok(!source.includes('Blueprint automation has been retired'),'already patched');
  const [head,tail]=source.split(ANCHOR);
  assert.ok(head.endsWith('async (event) => {\n')&&head.includes('exports.processExtraction = onDocumentCreated('),'anchor is not the processExtraction handler');
  return head+ANCHOR.split('\n').slice(0,2).join('\n')+'\n'+GUARD+ANCHOR.split('\n').slice(2).join('\n')+tail;
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
  console.log(`Prepared blueprint-retired guard for ${fn.serviceConfig.revision} (${patched.length-source.length} bytes added).`);
}
async function deploy(){
  const prepared=read('prepared.json'),before=read('before.json'),live=path.join(stage,'live');
  const fn=await json(fnUrl(name));assert.equal(fn.serviceConfig.revision,prepared.revision,'processExtraction changed since prepare');
  assert.deepEqual(fileHashes(live),prepared.baseline);
  const patched=fs.readFileSync(path.join(stage,'index.patched.js'));assert.equal(hash(patched),prepared.patched);
  const recent=Date.now()-30*60*1000;
  const runs=await json('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:['status','lastActivityAt','workflowMode'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'status'},op:'IN',value:{arrayValue:{values:['queued','running','azure-reserved','azure-dispatching'].map(stringValue=>({stringValue}))}}}},limit:500}});
  const active=runs.filter(r=>r.document&&Date.parse(r.document.fields?.lastActivityAt?.timestampValue||0)>recent).map(r=>r.document.name.split('/').pop());
  assert.equal(active.length,0,'Active extraction runs: '+active.join(','));
  const zip=new Zip();for(const f of Object.keys(prepared.baseline))zip.file(f,f==='index.js'?patched:fs.readFileSync(path.join(live,f)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',op);
  console.log('Building processExtraction with the blueprint-retired guard.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],fn.serviceConfig[field],field);
  const filters=t=>JSON.stringify([...(t.eventFilters||[])].sort((a,b)=>a.attribute.localeCompare(b.attribute)));
  assert.equal(filters(after.eventTrigger),filters(fn.eventTrigger));assert.equal(after.eventTrigger.eventType,fn.eventTrigger.eventType);assert.equal(after.eventTrigger.retryPolicy,fn.eventTrigger.retryPolicy);
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; trigger and runtime unchanged. Rollback source generation ${before.buildConfig.source.storageSource.generation}.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
