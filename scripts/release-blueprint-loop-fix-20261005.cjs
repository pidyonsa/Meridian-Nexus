'use strict';
// processExtraction: stop Geo Rep Blueprint folder-refresh runs from looping on Google event redelivery.
// When an invocation exceeds the 540 s limit, Google re-delivers the creation event for up to 24 h and the
// handler restarted from scratch every time (it reads the creation snapshot, always "queued"). Now it reads the
// run fresh: a finished run stops, and a run that has started 3 times is marked failed instead of looping.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/blueprint-loop-fix-20261005'),name='processExtraction';
const ANCHOR=`async function processGeoRepBlueprintFolderRefresh(event) {
  const runRef = event.data.ref;
  const run = event.data.data();
  const runId = event.params.runId;
`;
const GUARD=`  // Google re-delivers this event when an invocation exceeds its time limit. Stop if the run already finished,
  // and stop retrying after 3 starts instead of looping for up to 24 hours.
  const attempt = await db.runTransaction(async (transaction) => {
    const latest = (await transaction.get(runRef)).data() || {};
    if (["completed", "completed_no_data", "failed", "failed_permanent", "cancelled"].includes(latest.status)) return 0;
    const next = Number(latest.folderRefreshAttempts || 0) + 1;
    transaction.set(runRef, { folderRefreshAttempts: next }, { merge: true });
    return next;
  });
  if (!attempt) return;
  if (attempt > 3) {
    const message = "Blueprint refresh stopped after 3 attempts; each exceeded the worker time limit.";
    await runRef.set({ status: "failed", message, completedAt: FieldValue.serverTimestamp(), executionTimeline: FieldValue.arrayUnion(runTimelineEvent("folder-refresh-failed", message)) }, { merge: true });
    return;
  }
`;
const read=f=>JSON.parse(fs.readFileSync(path.join(stage,f),'utf8'));
const save=(f,v)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2));};
function patch(source){
  assert.equal(source.split(ANCHOR).length,2,'anchor must appear exactly once');
  assert.ok(!source.includes('folderRefreshAttempts'),'already patched');
  return source.replace(ANCHOR,ANCHOR+GUARD);
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
  console.log(`Prepared loop fix for ${fn.serviceConfig.revision} (${patched.length-source.length} bytes added).`);
}
async function deploy(){
  const prepared=read('prepared.json'),before=read('before.json'),live=path.join(stage,'live');
  const fn=await json(fnUrl(name));assert.equal(fn.serviceConfig.revision,prepared.revision,'processExtraction changed since prepare');
  assert.deepEqual(fileHashes(live),prepared.baseline);
  const patched=fs.readFileSync(path.join(stage,'index.patched.js'));assert.equal(hash(patched),prepared.patched);
  const recent=Date.now()-30*60*1000;
  const runs=await json('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:['status','lastActivityAt','retailerId','workflowMode'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'running'}}},limit:50}});
  // Only portal/other downloads block; blueprint folder-refresh runs are what this release stops from looping.
  const active=runs.filter(r=>r.document&&Date.parse(r.document.fields?.lastActivityAt?.timestampValue||0)>recent&&r.document.fields?.workflowMode?.stringValue!=='geo-rep-blueprint-folder-refresh').map(r=>r.document.name.split('/').at(-1));
  assert.equal(active.length,0,'Active extraction runs: '+active.join(','));
  const zip=new Zip();for(const f of Object.keys(prepared.baseline))zip.file(f,f==='index.js'?patched:fs.readFileSync(path.join(live,f)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',op);
  console.log('Building processExtraction with the blueprint loop fix.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],fn.serviceConfig[field],field);
  const filters=t=>JSON.stringify([...(t.eventFilters||[])].sort((a,b)=>a.attribute.localeCompare(b.attribute)));
  assert.equal(filters(after.eventTrigger),filters(fn.eventTrigger));assert.equal(after.eventTrigger.eventType,fn.eventTrigger.eventType);assert.equal(after.eventTrigger.retryPolicy,fn.eventTrigger.retryPolicy);
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; trigger and runtime unchanged. Rollback source generation ${before.buildConfig.source.storageSource.generation}.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
