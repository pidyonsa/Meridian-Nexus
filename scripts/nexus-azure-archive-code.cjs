'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {api,json}=require('./release-multi-admin.cjs');
const {pages,readWithRetry}=require('./nexus-azure-inventory.cjs');
const {hash}=require('./nexus-azure-copy-plan.cjs');
const project='meridain-nexus';
const sourceBucket='gcf-v2-sources-730011371323-us-central1';
const isProviderInit=name=>['/__/firebase/init.js','/__/firebase/init.json'].includes(name);
async function archiveBytes(directory,bytes) {
  const sha256=hash(bytes); const file=path.join(directory,'artifacts',sha256);
  try { await fs.writeFile(file,bytes,{flag:'wx'}); }
  catch(error) { if(error.code!=='EEXIST') throw error; assert.equal(hash(await fs.readFile(file)),sha256); }
  return {sha256,bytes:bytes.length};
}
function providerEntry(file,artifact) {
  assert.ok(isProviderInit(file.path));
  return {path:file.path,expectedHostingHash:file.hash,artifact,sourceKind:'firebase-generated-response',
    releaseHashVerified:false,azureReplacementRequired:true,observedAt:new Date().toISOString()};
}
async function main() {
  const directory=path.resolve(__dirname,'../.tmp/nexus-azure-copy',new Date().toISOString().replace(/[:.]/g,'-')+'-code');
  await fs.mkdir(path.join(directory,'artifacts'),{recursive:true});
  const report={at:new Date().toISOString(),project,mode:'archive-only-not-executable',functions:[],hosting:[],rules:[],errors:[]};
  const save=async()=>fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(report,null,2));
  const archive=bytes=>archiveBytes(directory,bytes);
  console.log(JSON.stringify({directory,sourceWrites:false,azureDeployment:false}));
  const functions=await pages(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/-/functions?pageSize=1000`,'functions');
  const cached=new Map();
  for(const config of functions) {
    try {
      const source=config.buildConfig?.source?.storageSource;
      assert.equal(source?.bucket,sourceBucket,'Unexpected source bucket.');
      assert.match(String(source.generation),/^\d+$/);
      const key=JSON.stringify(source);
      let artifact=cached.get(key);
      if(!artifact) {
        const endpoint=`https://storage.googleapis.com/storage/v1/b/${sourceBucket}/o/${encodeURIComponent(source.object)}?generation=${source.generation}`;
        const metadata=await readWithRetry(endpoint+'&fields=size,md5Hash,generation,contentEncoding');
        assert.equal(String(metadata.generation),String(source.generation));
        assert.ok(Number(metadata.size)<=100*1024*1024,'Source archive exceeds limit.');
        assert.ok(!metadata.contentEncoding,'Encoded source archive needs an explicit transport.');
        const bytes=Buffer.from(await (await api(endpoint+'&alt=media')).arrayBuffer());
        assert.equal(bytes.length,Number(metadata.size));
        assert.ok(metadata.md5Hash,'Source archive checksum unavailable.');
        assert.equal(crypto.createHash('md5').update(bytes).digest('base64'),metadata.md5Hash);
        artifact=await archive(bytes); cached.set(key,artifact);
      }
      report.functions.push({name:config.name,revision:config.serviceConfig?.revision,runtime:config.buildConfig?.runtime,
        entryPoint:config.buildConfig?.entryPoint,source,artifact,enabledInAzure:false});
    } catch(error) { report.errors.push({kind:'function',name:config.name,message:error.message.slice(0,180)}); }
    await save();
    if((report.functions.length+report.errors.length)%10===0) console.log(JSON.stringify({functionsArchived:report.functions.length,errors:report.errors.length}));
  }
  const sites=await pages(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites?pageSize=100`,'sites');
  for(const site of sites) {
    try {
      const id=site.name.split('/').at(-1); assert.match(id,/^[a-z0-9-]+$/);
      const url=`https://firebasehosting.googleapis.com/v1beta1/${site.name}/channels/live`;
      const before=await readWithRetry(url); const version=before.release?.version;
      assert.ok(version?.name,'No live Hosting release.');
      const metadata=await readWithRetry(`https://firebasehosting.googleapis.com/v1beta1/${version.name}`);
      const files=await pages(`https://firebasehosting.googleapis.com/v1beta1/${version.name}/files?pageSize=1000`,'files');
      const entry={name:site.name,version:version.name,configuration:await archive(Buffer.from(JSON.stringify(metadata))),files:[],providerRuntime:[]};
      report.hosting.push(entry);
      for(const file of files) {
        try {
          assert.ok(file.path.startsWith('/') && !file.path.startsWith('//'),'Invalid asset path.');
          const assetUrl=new URL(`https://${id}.web.app`);
          assetUrl.pathname=file.path; assetUrl.searchParams.set('nexus_archive',Date.now());
          const response=await fetch(assetUrl,{redirect:'error',signal:AbortSignal.timeout(120000)});
          assert.ok(response.ok,'Hosting asset download failed: '+response.status);
          const bytes=Buffer.from(await response.arrayBuffer());
          if(isProviderInit(file.path)) {
            if(file.path.endsWith('.json'))assert.equal(JSON.parse(bytes).projectId,project);
            entry.providerRuntime.push(providerEntry(file,await archive(bytes)));
          } else {
            assert.equal(hash(zlib.gzipSync(bytes,{level:9})),file.hash,'Asset no longer matches captured release.');
            entry.files.push({path:file.path,hostingHash:file.hash,artifact:await archive(bytes)});
          }
        } catch(error) { report.errors.push({kind:'hosting-file',site:id,path:file.path,message:error.message.slice(0,180)}); }
        await save();
      }
      assert.equal((await readWithRetry(url)).release.version.name,version.name,'Hosting release changed during archive.');
    } catch(error) { report.errors.push({kind:'hosting',name:site.name,message:error.message.slice(0,180)}); }
    await save();
    console.log(JSON.stringify({sitesArchived:report.hosting.length,assetsArchived:report.hosting.reduce((n,s)=>n+s.files.length,0),errors:report.errors.length}));
  }
  const releases=await pages(`https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=100`,'releases');
  for(const release of releases) {
    const rules=await json(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
    report.rules.push({name:release.name,source:release.rulesetName,artifact:await archive(Buffer.from(JSON.stringify(rules)))});
  }
  report.completedAt=new Date().toISOString();report.complete=report.errors.length===0;
  report.exclusions=['Cloud Run container image layers','secret values','business database and files','Firebase passwords and sessions'];
  await save();
  console.log(JSON.stringify({directory,complete:report.complete,functions:report.functions.length,sites:report.hosting.length,
    assets:report.hosting.reduce((n,s)=>n+s.files.length,0),rules:report.rules.length,errors:report.errors}));
  if(!report.complete)process.exitCode=1;
}
async function reconcileProviderRoutes() {
  const directory=path.resolve(process.argv[3]||'');
  assert.ok(directory.startsWith(path.resolve(__dirname,'../.tmp/nexus-azure-copy')+path.sep));
  const original=await fs.readFile(path.join(directory,'manifest.json'),'utf8');
  const report=JSON.parse(original);
  assert.equal(report.project,project);assert.equal(report.mode,'archive-only-not-executable');
  assert.ok(report.completedAt && report.errors.length);
  assert.ok(report.errors.every(e=>e.kind==='hosting-file' && isProviderInit(e.path)),'Only reserved initialization routes can be reconciled here.');
  await fs.writeFile(path.join(directory,'manifest.before-provider-reconciliation.json'),original,{flag:'wx'});
  for(const entry of report.hosting) {
    const id=entry.name.split('/').at(-1);assert.match(id,/^[a-z0-9-]+$/);
    const url=`https://firebasehosting.googleapis.com/v1beta1/${entry.name}/channels/live`;
    assert.equal((await readWithRetry(url)).release.version.name,entry.version);
    const files=await pages(`https://firebasehosting.googleapis.com/v1beta1/${entry.version}/files?pageSize=1000`,'files');
    entry.providerRuntime=[];
    for(const file of files.filter(f=>isProviderInit(f.path))) {
      const response=await fetch(`https://${id}.web.app${file.path}`,{redirect:'error',signal:AbortSignal.timeout(120000)});
      assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());
      if(file.path.endsWith('.json'))assert.equal(JSON.parse(bytes).projectId,project);
      entry.providerRuntime.push(providerEntry(file,await archiveBytes(directory,bytes)));
    }
    assert.equal(entry.files.length+entry.providerRuntime.length,files.length,'Missing Hosting assets.');
    assert.equal((await readWithRetry(url)).release.version.name,entry.version);
  }
  report.resolvedProviderRouteErrors=report.errors;report.errors=[];report.complete=true;
  report.providerRoutesReconciledAt=new Date().toISOString();
  report.scope='Version-verified function sources and user assets; provider-generated initialization responses separately observed, not release-hash verified.';
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({complete:true,functions:report.functions.length,assets:report.hosting.reduce((n,s)=>n+s.files.length,0),
    providerResponses:report.hosting.reduce((n,s)=>n+s.providerRuntime.length,0),azureExecutable:false}));
}
if(require.main===module)(process.argv[2]==='reconcile-provider-routes'?reconcileProviderRoutes():main()).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={isProviderInit,providerEntry};
