'use strict';
// processExtraction: hand runs of automations flagged retailers/<id>.executor == "azure" to the Azure worker.
// The Google trigger marks such a queued run "azure-reserved" and returns; the Azure dispatcher starts
// job-georep-worker for it. Tracker steps stay on Google. The Azure image runs this same code with
// NEXUS_EXECUTOR=azure, which skips the hand-off. Rollback: remove the retailer's executor field.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/georep-azure-handoff-20261005'),name='processExtraction';
const ANCHOR='  const runRef = event.data.ref;\n  const run = event.data.data();\n';
const HANDOFF=`  // Automations moved to Azure (retailers/<id>.executor == "azure") are handed to the Azure worker;
  // tracker steps stay here. The Azure worker runs this same code with NEXUS_EXECUTOR=azure.
  if (process.env.NEXUS_EXECUTOR !== "azure" && run.status === "queued" && run.retailerId && !/tracker/.test(run.workflowMode || "")) {
    const retailerDoc = await db.collection("retailers").doc(String(run.retailerId)).get();
    if (retailerDoc.exists && retailerDoc.data().executor === "azure") {
      const handedOff = await db.runTransaction(async (transaction) => {
        const latest = (await transaction.get(runRef)).data() || {};
        if (latest.status !== "queued") return false;
        transaction.set(runRef, { status: "azure-reserved", executor: "azure", message: "Queued for the Azure worker.", lastActivityAt: FieldValue.serverTimestamp(), executionTimeline: FieldValue.arrayUnion(runTimelineEvent("azure-reserved", "Handed to the Azure worker.")) }, { merge: true });
        return true;
      });
      if (handedOff) return;
    }
  }
`;
const read=f=>JSON.parse(fs.readFileSync(path.join(stage,f),'utf8'));
const save=(f,v)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2));};
function patch(source){
  const i=source.indexOf('exports.processExtraction = ');assert.ok(i>0);
  const at=source.indexOf(ANCHOR,i);assert.ok(at>i&&at-i<1000,'anchor must directly follow the processExtraction declaration');
  assert.equal(source.split(HANDOFF).length,1,'already patched');
  return source.slice(0,at+ANCHOR.length)+HANDOFF+source.slice(at+ANCHOR.length);
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
  console.log(`Prepared hand-off for ${fn.serviceConfig.revision} (${patched.length-source.length} bytes added).`);
}
async function deploy(){
  const prepared=read('prepared.json'),before=read('before.json'),live=path.join(stage,'live');
  const fn=await json(fnUrl(name));assert.equal(fn.serviceConfig.revision,prepared.revision,'processExtraction changed since prepare');
  assert.deepEqual(fileHashes(live),prepared.baseline);
  const patched=fs.readFileSync(path.join(stage,'index.patched.js'));assert.equal(hash(patched),prepared.patched);
  const recent=Date.now()-30*60*1000;
  const runs=await json('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:['status','lastActivityAt','retailerId','workflowMode','createdAt'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'running'}}},limit:50}});
  // User-approved 5 October: blueprint folder-refresh runs from that morning's 06:00 batch loop on Google event
  // redelivery until ~06:00 on 6 October (the refresh ignores run status) and never go idle. Only those are
  // excused (retailer geo-rep, workflow geo-rep-blueprint-folder-refresh, created 04:00-04:10 UTC on 5 Oct).
  const createdAt=f=>Date.parse(f.createdAt?.timestampValue||f.createdAt?.stringValue||0);
  const excused=f=>f.retailerId?.stringValue==='geo-rep'&&f.workflowMode?.stringValue==='geo-rep-blueprint-folder-refresh'&&createdAt(f)>=Date.parse('2026-10-05T04:00:00Z')&&createdAt(f)<Date.parse('2026-10-05T04:10:00Z');
  const active=runs.filter(r=>r.document&&Date.parse(r.document.fields?.lastActivityAt?.timestampValue||0)>recent&&!excused(r.document.fields)).map(r=>r.document.name.split('/').at(-1));assert.equal(active.length,0,'Active extraction runs: '+active.join(','));
  const iam=await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`);
  const zip=new Zip();for(const f of Object.keys(prepared.baseline))zip.file(f,f==='index.js'?patched:fs.readFileSync(path.join(live,f)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',op);
  console.log('Building processExtraction with the Azure hand-off.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],fn.serviceConfig[field],field);
  assert.deepEqual(after.eventTrigger,fn.eventTrigger);assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),iam);
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; no retailer is flagged yet, so behaviour is unchanged. Rollback source generation ${before.buildConfig.source.storageSource.generation}.`);
}
const actions={prepare,deploy};if(!actions[process.argv[2]])throw Error('Use prepare or deploy');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
