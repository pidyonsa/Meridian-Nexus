'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {hash}=require('../nexus-azure-copy-plan.cjs');
const {verify}=require('../verify-nexus-azure-code-archive.cjs');
const {isProviderInit,providerEntry}=require('../nexus-azure-archive-code.cjs');
async function fixture(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-code-archive-test-'));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('nexus-code-archive-test-'));
    return fs.rm(directory,{recursive:true,force:true});
  });
  await fs.mkdir(path.join(directory,'artifacts'));
  const bytes=Buffer.from('synthetic, never executed');
  const artifact={sha256:hash(bytes),bytes:bytes.length};
  await fs.writeFile(path.join(directory,'artifacts',artifact.sha256),bytes);
  const report={project:'meridain-nexus',mode:'archive-only-not-executable',completedAt:'2026-09-22',complete:true,errors:[],
    functions:[{enabledInAzure:false,artifact}],rules:[],hosting:[]};
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(report));
  return {directory,report,artifact};
}
test('reads back and verifies an opaque code artifact without executing it',async t=>{
  const {directory}=await fixture(t);const result=await verify(directory);
  assert.equal(result.artifacts,1);assert.equal(result.azureExecutable,false);
  assert.equal(result.azureTransferred,false);
});
test('rejects tampered artifacts',async t=>{
  const {directory,artifact}=await fixture(t);
  await fs.writeFile(path.join(directory,'artifacts',artifact.sha256),'altered');
  await assert.rejects(verify(directory),/size mismatch/);
});
test('rejects incomplete archives and enabled automation',async t=>{
  const {directory,report}=await fixture(t);report.complete=false;
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(report));
  await assert.rejects(verify(directory),/did not complete/);
  report.complete=true;report.functions[0].enabledInAzure=true;
  await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(report));
  await assert.rejects(verify(directory));
});
test('only exact provider init routes are exempt from release hash matching',()=>{
  assert.equal(isProviderInit('/__/firebase/init.json'),true);
  for(const name of ['/app.js','/__/firebase/other.js','/__/firebase/init.json/other','/__/firebase/init.json?fake'])assert.equal(isProviderInit(name),false);
  const entry=providerEntry({path:'/__/firebase/init.js',hash:'original'}, {sha256:'observed',bytes:1});
  assert.equal(entry.expectedHostingHash,'original');assert.equal(entry.releaseHashVerified,false);
  assert.equal(entry.azureReplacementRequired,true);
});
