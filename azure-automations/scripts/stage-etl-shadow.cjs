'use strict';
// Stage an Azure shadow ETL run from a completed Google run: server-side copies of the pinned inputs
// under a new run id, plus a manifest that matches them. Outputs then land in etl-results/<shadow id>/,
// which no etlRuns document or portal screen refers to.
const assert=require('node:assert/strict');
const {json,api}=require('../../scripts/release-multi-admin.cjs');
const BUCKET='meridain-nexus.firebasestorage.app',O=`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
const PAIRS={'6c4353b2dc99ad7503b1e490a8da5e7b':'a9d63fc243c3bdde247f1cce2fb50356-0eeb367e','0c19b8544f0e7c61ae28ff02b51aa243-29b4e834':'cf0d782e08f816952de197f915693b45-a88d1fad'};
const enc=encodeURIComponent;
const known=process.argv[3]?JSON.parse(require('node:fs').readFileSync(process.argv[3],'utf8').replace(/^﻿/,'')):{};
async function main(){
  for(const [source,shadow] of Object.entries(PAIRS)){
    if(process.argv[2]&&process.argv[2]!==source)continue;
    const manifest=JSON.parse(Buffer.from(await (await api(`${O}/${enc(`etl-run-inputs/${source}/manifest.json`)}?alt=media`)).arrayBuffer()).toString());
    assert.equal(manifest.id,source);
    for(const [role,input] of Object.entries(manifest.inputs)){
      const ext=input.path.split('.').at(-1),target=`etl-run-inputs/${shadow}/${role}.${ext}`;
      assert.equal(input.path,`etl-run-inputs/${source}/${role}.${ext}`);
      const src=await json(`${O}/${enc(input.path)}?generation=${input.generation}`);
      // Copies made by an earlier attempt can't be read with the create-only grant; their metadata
      // (read through the Azure ETL identity) is supplied in known[target] and must match the source.
      let copied=known[target];
      if(!copied){
        let r=await json(`${O}/${enc(input.path)}/rewriteTo/b/${BUCKET}/o/${enc(target)}?ifGenerationMatch=0&sourceGeneration=${input.generation}`,'POST',{});
        while(!r.done)r=await json(`${O}/${enc(input.path)}/rewriteTo/b/${BUCKET}/o/${enc(target)}?ifGenerationMatch=0&sourceGeneration=${input.generation}&rewriteToken=${enc(r.rewriteToken)}`,'POST',{});
        copied=r.resource;
      }
      assert.equal(copied.crc32c,src.crc32c,role+' checksum');assert.equal(copied.md5Hash,src.md5Hash,role+' md5');
      input.path=target;input.generation=copied.generation;
    }
    manifest.id=shadow;
    // fingerprint hashes the (identical) input content, so it legitimately still starts with the source id.
    assert.ok(!JSON.stringify({...manifest,fingerprint:''}).includes(source),'source id still referenced');
    // api() sends the body as JSON, which is exactly the manifest file content.
    await api(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&ifGenerationMatch=0&name=${enc(`etl-run-inputs/${shadow}/manifest.json`)}`,'POST',manifest);
    console.log(JSON.stringify({source,shadow,context:manifest.context.id,kind:manifest.context.kind,inputs:Object.keys(manifest.inputs)}));
  }
}
main().catch(e=>{console.error(String(e.message).slice(0,400));process.exitCode=1;});
