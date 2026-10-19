'use strict';
// Assemble the image build context from the publisher bundles deployed on Google right now, so the Azure job runs
// the production code. The only replaced files are the two entry points; their deployed versions must still be the
// ones reviewed on 16 October (pinned hashes below), since the local change only lets the token source be passed in.
// If Google is redeployed, review the difference, port it to the local entry point and update the hash.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash}=require('../../scripts/release-multi-admin.cjs'),Zip=require('../../functions/node_modules/jszip');
const repo=path.resolve(__dirname,'../..'),out=path.join(repo,'.tmp/dashboard-publisher-context');
const BUNDLES=[
  {fn:'publishAzureAttendance',dir:'attendance',entry:'attendance-publisher/index.cjs',local:'azure-field-dashboards/attendance-publisher/index.cjs',reviewed:'9cd6b28d5471f07563fa874512a45027bd8aa553d3740b1746886327985458ab'},
  {fn:'refreshPublicFranchiseOrders',dir:'refresh',entry:'index.cjs',local:'firebase-dashboards/refresh/index.cjs',reviewed:'67384455e6e19cc76d37bd123e6a631272d174da4f4442b14d52ef4451a914a2'}
];
(async()=>{
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});const source={};
  for(const b of BUNDLES){
    const fn=await json(fnUrl(b.fn)),s=fn.buildConfig.source.storageSource;
    const zip=await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
    const files={};
    for(const name of Object.keys(zip.files)){if(zip.files[name].dir)continue;assert.ok(!name.includes('..'));const target=path.join(out,b.dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=await zip.file(name).async('nodebuffer');fs.writeFileSync(target,bytes);files[name]=hash(bytes);}
    assert.equal(files[b.entry],b.reviewed,`${b.fn}: deployed ${b.entry} changed since it was reviewed`);
    fs.copyFileSync(path.join(repo,b.local),path.join(out,b.dir,b.entry));
    source[b.fn]={revision:fn.serviceConfig.revision,generation:s.generation,files};
  }
  for(const f of ['Dockerfile','publisher-runner.cjs'])fs.copyFileSync(path.join(__dirname,f),path.join(out,f));
  fs.writeFileSync(path.join(out,'.dockerignore'),'**/node_modules\n');
  fs.writeFileSync(path.join(out,'SOURCE.json'),JSON.stringify(source,null,2));
  console.log(JSON.stringify({context:out,revisions:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.revision]))}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
