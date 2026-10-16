'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {hash}=require('./nexus-azure-copy-plan.cjs');
async function verify(directory) {
  const report=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  assert.equal(report.project,'meridain-nexus');
  assert.equal(report.mode,'archive-only-not-executable');
  assert.ok(report.completedAt && report.complete,'Archive did not complete.');
  assert.deepEqual(report.errors,[],'Archive contains unresolved errors.');
  const artifacts=[...report.functions.map(f=>f.artifact),...report.rules.map(r=>r.artifact)];
  for(const site of report.hosting) {
    artifacts.push(site.configuration,...site.files.map(f=>f.artifact));
    for(const response of site.providerRuntime||[]) {
      assert.equal(response.sourceKind,'firebase-generated-response');
      assert.equal(response.releaseHashVerified,false);assert.equal(response.azureReplacementRequired,true);
      artifacts.push(response.artifact);
    }
  }
  const sizes=new Map();
  for(const artifact of artifacts) {
    assert.match(artifact.sha256,/^[a-f0-9]{64}$/);
    if(sizes.has(artifact.sha256)) {
      assert.equal(artifact.bytes,sizes.get(artifact.sha256)); continue;
    }
    const bytes=await fs.readFile(path.join(directory,'artifacts',artifact.sha256));
    assert.equal(bytes.length,artifact.bytes,'Artifact size mismatch.');
    assert.equal(hash(bytes),artifact.sha256,'Artifact checksum mismatch.');
    sizes.set(artifact.sha256,bytes.length);
  }
  for(const fn of report.functions)assert.equal(fn.enabledInAzure,false);
  return {verifiedAt:new Date().toISOString(),artifacts:sizes.size,bytes:[...sizes.values()].reduce((n,b)=>n+b,0),
    functions:report.functions.length,sites:report.hosting.length,assets:report.hosting.reduce((n,s)=>n+s.files.length,0),
    rules:report.rules.length,providerResponses:report.hosting.reduce((n,s)=>n+(s.providerRuntime?.length||0),0),
    azureTransferred:false,azureExecutable:false};
}
async function main() {
  const directory=path.resolve(process.argv[2]||'');
  assert.ok(directory.startsWith(path.resolve(__dirname,'../.tmp/nexus-azure-copy')+path.sep));
  const result=await verify(directory);
  await fs.writeFile(path.join(directory,'verified.json'),JSON.stringify(result,null,2),{flag:'wx'});
  console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={verify};
