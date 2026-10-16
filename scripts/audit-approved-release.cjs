const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), stage = path.join(root, '.tmp/approved-admin-chat-etl-20260909');
const JSZip = require(path.join(root, 'functions/node_modules/jszip'));
const gc = (...args) => execFileSync('powershell.exe', ['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args], {encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true,stdio:['ignore','pipe','inherit']});
async function main() {
 fs.mkdirSync(stage,{recursive:true});
 const token = gc('auth','print-access-token','--project=meridain-nexus','--quiet').trim();
 const get = async url => {const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,'x-goog-user-project':'meridain-nexus'}});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r;};
 const save = (name,data) => {const file=path.join(stage,name);assert.ok(!fs.existsSync(file),`Baseline already exists: ${name}`);fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data,null,2));};
 const functions=[]; let next='';
 do {const data=await (await get(`https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions?pageSize=1000${next?`&pageToken=${next}`:''}`)).json();functions.push(...data.functions||[]);next=data.nextPageToken;}while(next);
 save('functions.before.json',functions);
 const candidates=functions.filter(f=>!f.eventTrigger && !f.name.split('/').at(-1).match(/^(runScheduled|detectStalled|retryLocked|retryFailedGeoRep|finalizeExpired|retrySalesforceAttendanceReportLoadFailures)/));
 const manifest=[];
 for(const config of candidates) {
  const name=config.name.split('/').at(-1), s=config.buildConfig.source.storageSource;
  if(!s)continue;
  const archive=await JSZip.loadAsync(await (await get(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const entry=archive.file('index.js');if(!entry)continue;
  const index=await entry.async('string');
  const callable=new RegExp(`exports\\.${name}\\s*=\\s*onCall`).test(index)||['meridianChat','getFranchiseOrderDashboard'].includes(name);
  if(!callable)continue;
  const dest=path.join(stage,'sources',name);
  for(const e of Object.values(archive.files)){if(e.dir)continue;const target=path.resolve(dest,e.name);assert.ok(target.startsWith(dest+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await e.async('nodebuffer'));}
  manifest.push({name,revision:config.serviceConfig.revision,rootEmailGuard:index.includes('nexusAdminEmail')||index.includes('admin@nexus.co.za')});
  if(manifest.length%15===0)console.log(`${manifest.length} callable sources backed up`);
 }
 save('callables.before.json',manifest);
 const live=await (await get('https://firebasehosting.googleapis.com/v1beta1/projects/meridain-nexus/sites/meridian-nexus/channels/live')).json();save('hosting.before.json',live);
 const files=await (await get(`https://firebasehosting.googleapis.com/v1beta1/${live.release.version.name}/files?pageSize=1000`)).json();assert.ok(!files.nextPageToken);save('hosting-files.before.json',files);
 for(const name of ['index.html','app.js','service-worker.js']){const r=await fetch(`https://meridian-nexus.web.app/${name}?baseline=${Date.now()}`);assert.ok(r.ok);save(`live-${name}`,await r.text());}
 const releases=await (await get('https://firebaserules.googleapis.com/v1/projects/meridain-nexus/releases?pageSize=100')).json();assert.ok(!releases.nextPageToken);save('rules-releases.before.json',releases);
 for(const release of releases.releases.filter(r=>/\/cloud.firestore$|\/firebase.storage\/meridain-nexus.firebasestorage.app$/.test(r.name))){const r=await (await get(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`)).json();const kind=release.name.endsWith('/cloud.firestore')?'firestore':'storage';save(`${kind}-ruleset.before.json`,r);assert.equal(r.source.files.length,1);save(`${kind}.before.rules`,r.source.files[0].content);}
 save('bucket-iam.before.json',await(await get('https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/iam?optionsRequestedPolicyVersion=3')).json());
 console.log(JSON.stringify({functions:functions.length,callables:manifest.length,hosting:live.release.version.name,stage}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
