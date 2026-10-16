'use strict';
// Assemble the image build context from the processExtraction source that is deployed on Google right now,
// so the Azure worker runs exactly the production code. Adds only the Dockerfile and azure-runner.js.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash}=require('../../scripts/release-multi-admin.cjs'),Zip=require('../../functions/node_modules/jszip');
const out=path.resolve(__dirname,'../../.tmp/georep-worker-context');
(async()=>{
  const fn=await json(fnUrl('processExtraction')),s=fn.buildConfig.source.storageSource;
  const zip=await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  const files={};
  for(const name of Object.keys(zip.files)){if(zip.files[name].dir)continue;assert.ok(!name.includes('..'));const target=path.join(out,name);fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=await zip.file(name).async('nodebuffer');fs.writeFileSync(target,bytes);files[name]=hash(bytes);}
  assert.ok(files['index.js']&&files['package.json']&&files['package-lock.json'],'bundle incomplete');
  assert.ok(!files['azure-runner.js']&&!files['Dockerfile'],'bundle already contains runner files');
  for(const f of ['Dockerfile','azure-runner.js'])fs.copyFileSync(path.join(__dirname,f),path.join(out,f));
  fs.writeFileSync(path.join(out,'.dockerignore'),'node_modules\n');
  fs.writeFileSync(path.join(out,'SOURCE.json'),JSON.stringify({function:'processExtraction',revision:fn.serviceConfig.revision,generation:s.generation,files},null,2));
  console.log(JSON.stringify({context:out,revision:fn.serviceConfig.revision,files:Object.keys(files).length}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
