'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const JSZip=require('jszip');
const root=path.resolve(__dirname,'..');
(async()=>{
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(root,'dist/meridian-nexus-azure.zip')));
  const files=Object.values(zip.files).filter(e=>!e.dir);
  for(const file of files){
    assert.match(file.name,/^(public\/|server\/|App_Data\/|package(?:-lock)?\.json$|PORT_MANIFEST\.json$)/);
    assert.doesNotMatch(file.name,/\.env|fixtures|local-data|node_modules|\.git|\.tmp/);
    if(/\.(?:js|cjs|html|css)$/.test(file.name))assert.doesNotMatch(await file.async('string'),/firebase|firestore|cloudfunctions\.net|salesforce|stockfix|sales\.duckdb/i);
  }
  const pkg=JSON.parse(await zip.file('package.json').async('string'));assert.equal(pkg.scripts.preview,undefined);assert.equal(pkg.devDependencies,undefined);
  for(const entry of JSON.parse(fs.readFileSync(path.join(root,'PORT_MANIFEST.json'))).files){
    const original=fs.readFileSync(path.join(root,'..',entry.source));assert.equal(crypto.createHash('sha256').update(original).digest('hex'),entry.sourceSha256,`Original changed: ${entry.source}`);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,entry.destination))).digest('hex'),entry.sha256,`Port manifest drift: ${entry.destination}`);
  }
  process.stdout.write(`Verified ${files.length} deployment files; allowlist clean and all eight original source hashes unchanged.\n`);
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
