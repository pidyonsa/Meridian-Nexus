'use strict';
// processExtraction: never reuse a Geo Rep report captured before its date range ended (Johannesburg time).
// Such a file cannot contain the last day in full (2 Oct: the 11:30 run reused a 1 October file captured at
// 12:56 on 1 October). These reports take the existing verified "source refresh" path instead.
// Only this condition changes in the live source; everything else is the deployed bundle as-is.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash,fileHashes}=require('./release-multi-admin.cjs'),Zip=require('../functions/node_modules/jszip');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/georep-dedup-fix-20261004'),name='processExtraction';
const OLD='        const sourceRefreshRequired = isGeoRepRetailer(run.retailerId) && file.requiresRefresh === true;\n';
const NEW=`        // A report captured before its date range ended (Johannesburg time) cannot hold the last day in full.
        const capturedMillis = firestoreMillis(file.completedAt) || firestoreMillis(file.createdAt);
        const periodEnd = effectiveReportDatesForRun(run).endDate;
        const capturedBeforePeriodEnd = Boolean(capturedMillis && /^\\d{4}-\\d{2}-\\d{2}$/.test(periodEnd || "") && capturedMillis < Date.parse(\`\${periodEnd}T00:00:00+02:00\`) + 86400000);
        const sourceRefreshRequired = isGeoRepRetailer(run.retailerId) && (file.requiresRefresh === true || capturedBeforePeriodEnd);
`;
const read=f=>JSON.parse(fs.readFileSync(path.join(stage,f),'utf8'));
const save=(f,v)=>fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2));
function patch(source){assert.equal(source.split(OLD).length,2,'Patch anchor must appear exactly once');return source.replace(OLD,NEW);}
function check(){
  // The new rule, evaluated exactly as written in NEW.
  const rule=(captured,periodEnd)=>Boolean(captured&&/^\d{4}-\d{2}-\d{2}$/.test(periodEnd||'')&&captured<Date.parse(`${periodEnd}T00:00:00+02:00`)+86400000);
  assert.equal(rule(Date.parse('2026-10-01T10:56:17Z'),'2026-10-01'),true,'1 Oct file captured 12:56 SAST on 1 Oct must refresh');
  assert.equal(rule(Date.parse('2026-10-01T21:59:00Z'),'2026-10-01'),true,'23:59 SAST on the end day is still incomplete');
  assert.equal(rule(Date.parse('2026-10-01T22:00:01Z'),'2026-10-01'),false,'captured after midnight SAST may be reused');
  assert.equal(rule(Date.parse('2026-10-02T10:02:00Z'),'2026-10-01'),false,'next-day capture may be reused');
  assert.equal(rule(0,'2026-10-01'),false);assert.equal(rule(Date.now(),''),false);
  console.log('Rule checks passed.');
}
async function prepare(){
  check();
  const live=path.join(stage,'live'),fn=await json(fnUrl(name));const before=read('before.json');
  assert.equal(fn.serviceConfig.revision,before.serviceConfig.revision,'processExtraction changed since the reviewed snapshot');
  const source=fs.readFileSync(path.join(live,'index.js'),'utf8'),patched=patch(source);
  new Function('require','module','exports','__filename','__dirname',patched); // syntax check only, not executed
  fs.writeFileSync(path.join(stage,'index.patched.js'),patched);
  save('prepared.json',{at:new Date().toISOString(),baseline:fileHashes(live),patched:hash(Buffer.from(patched))});
  console.log('Prepared: one condition changed in live index.js ('+(patched.length-source.length)+' bytes added).');
}
async function deploy(){
  const prepared=read('prepared.json'),before=read('before.json'),live=path.join(stage,'live');
  const fn=await json(fnUrl(name));assert.equal(fn.serviceConfig.revision,before.serviceConfig.revision);
  assert.deepEqual(fileHashes(live),prepared.baseline);
  const patched=fs.readFileSync(path.join(stage,'index.patched.js'));assert.equal(hash(patched),prepared.patched);
  // Do not swap revisions under an active extraction.
  // A run counts as active only if it showed activity in the last 30 minutes (one Sept 11 run is stuck in "running").
  const runs=await json('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:[{fieldPath:'status'},{fieldPath:'lastActivityAt'}]},where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'running'}}},limit:50}});
  const recent=Date.now()-30*60*1000;
  const active=runs.filter(r=>r.document&&Date.parse(r.document.fields?.lastActivityAt?.timestampValue||0)>recent).map(r=>r.document.name.split('/').at(-1));assert.equal(active.length,0,'Active extraction runs: '+active.join(','));
  const iam=await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`);
  const zip=new Zip();for(const f of Object.keys(prepared.baseline))zip.file(f,f==='index.js'?patched:fs.readFileSync(path.join(live,f)));
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const sent=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(sent.ok);
  const op=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:fn.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('operation.json',op);
  console.log('Building processExtraction with the Geo Rep same-day reuse fix.');
  for(;;){const r=await json('https://cloudfunctions.googleapis.com/v2/'+op.name);if(r.done){assert.ok(!r.error,JSON.stringify(r.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['environmentVariables','secretEnvironmentVariables','serviceAccountEmail','ingressSettings','timeoutSeconds','availableMemory','availableCpu','maxInstanceCount','minInstanceCount','maxInstanceRequestConcurrency'])assert.deepEqual(after.serviceConfig[field],fn.serviceConfig[field],field);
  assert.deepEqual(after.eventTrigger,fn.eventTrigger);assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),iam);
  save('after.json',after);console.log(`Verified ${after.serviceConfig.revision}; trigger, runtime and IAM unchanged. Rollback: redeploy generation ${before.buildConfig.source.storageSource.generation}.`);
}
const actions={check:async()=>check(),prepare,deploy};
if(!actions[process.argv[2]])throw Error('Use check, prepare or deploy');
actions[process.argv[2]]().catch(e=>{console.error(e.stack);process.exitCode=1;});
