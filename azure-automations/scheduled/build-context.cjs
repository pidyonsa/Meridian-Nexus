'use strict';
// Assemble the image build context from the scheduled functions' bundles deployed on Google right now. Four distinct
// code sets cover the seven functions; each is copied unchanged into fns/<set>/ and installed from its own lock file.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {json,api,fnUrl,hash}=require('../../scripts/release-multi-admin.cjs'),Zip=require('../../functions/node_modules/jszip');
const {FUNCTIONS}=require('./functions.cjs');
const out=path.resolve(__dirname,'../../.tmp/scheduled-context');
async function bundle(name){
  const fn=await json(fnUrl(name)),s=fn.buildConfig.source.storageSource;
  const zip=await Zip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${s.bucket}/o/${encodeURIComponent(s.object)}?alt=media&generation=${s.generation}`)).arrayBuffer());
  const files={};for(const k of Object.keys(zip.files)){if(zip.files[k].dir)continue;assert.ok(!k.includes('..'));files[k]=await zip.file(k).async('nodebuffer');}
  return {fn,files};
}
(async()=>{
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  const sets={},source={};
  for(const [name,def] of Object.entries(FUNCTIONS)){
    const {fn,files}=await bundle(name),hashes=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)]));
    assert.equal(fn.buildConfig.entryPoint,name);
    // Secrets the Azure job loads must be exactly the ones Google mounts for this function.
    assert.deepEqual((fn.serviceConfig.secretEnvironmentVariables||[]).map(x=>x.key).sort(),[...def.secrets].sort(),`${name}: secrets differ`);
    if(!sets[def.set]){
      sets[def.set]=hashes;
      for(const [k,v] of Object.entries(files)){const t=path.join(out,'fns',def.set,k);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,v);}
    }else{
      // Functions sharing a set must have byte-identical deployed code (scripts/ and ignore files excepted).
      const code=h=>Object.fromEntries(Object.entries(h).filter(([k])=>/\.(c?js|json)$/.test(k)&&!k.startsWith('scripts/')));
      assert.deepEqual(code(hashes),code(sets[def.set]),`${name}: deployed code differs from set ${def.set}`);
    }
    source[name]={set:def.set,revision:fn.serviceConfig.revision,generation:fn.buildConfig.source.storageSource.generation};
  }
  for(const f of ['Dockerfile','scheduled-runner.cjs','functions.cjs'])fs.copyFileSync(path.join(__dirname,f),path.join(out,f));
  fs.writeFileSync(path.join(out,'.dockerignore'),'**/node_modules\n');
  fs.writeFileSync(path.join(out,'SOURCE.json'),JSON.stringify(source,null,2));
  console.log(JSON.stringify({context:out,sets:Object.keys(sets),functions:source},null,1));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
