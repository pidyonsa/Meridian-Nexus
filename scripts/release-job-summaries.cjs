"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),zlib=require("node:zlib");
const {Readable}=require("node:stream");
const root=path.resolve(__dirname,".."),followUp=process.argv.includes("--login-fix"),stage=path.join(root,followUp?".tmp/job-summaries-login-release":".tmp/job-summaries-release");
const cliPath=path.join(process.env.APPDATA,"npm/node_modules/firebase-tools");
const cli=require(cliPath),hosting=require(path.join(cliPath,"lib/hosting/api")),{Client}=require(path.join(cliPath,"lib/apiv2"));
const assets=["index.html","app.js","service-worker.js","attendance-job-summaries.css"];
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name)));
const save=(name,value)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2));
const canonical=value=>value.replace("projects/730011371323/","projects/meridain-nexus/");
async function connect(){await cli.hosting.channel.list({project:"meridain-nexus",site:"meridian-nexus",nonInteractive:true});return new Client({urlPrefix:"https://firebasehosting.googleapis.com",apiVersion:"v1beta1",auth:true});}
async function prepare(){
  assert.ok(!fs.existsSync(path.join(stage,"before.json")),"Keep the existing release backup");fs.mkdirSync(stage,{recursive:true});
  const client=await connect(),current=await hosting.getChannel("meridain-nexus","meridian-nexus","live");
  const expectedVersion=followUp?JSON.parse(fs.readFileSync(path.join(root,".tmp/job-summaries-release/after.json"))).version.split("/").at(-1):"838e30246cbec694";
  assert.equal(current.release.version.name.split("/").at(-1),expectedVersion,"Production changed since the reviewed baseline");
  const {body}=await client.get(`/${current.release.version.name}/files`,{queryParams:{pageSize:1000}});assert.ok(!body.nextPageToken);
  for(const name of assets.slice(0,3)){
    const response=await fetch(`https://meridian-nexus.web.app/${name}?review=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});assert.ok(response.ok);
    const content=Buffer.from(await response.arrayBuffer());
    assert.ok(content.equals(fs.readFileSync(path.join(root,followUp?".tmp/job-summaries-release/assets":".tmp/franchise-release/hosting-assets",name))),`${name} differs from the prior reviewed release`);
    fs.writeFileSync(path.join(stage,`before-${name}`),content);
  }
  fs.mkdirSync(path.join(stage,"assets"),{recursive:true});
  for(const name of assets)fs.copyFileSync(path.join(root,"public",name),path.join(stage,"assets",name));
  save("before.json",{release:current,files:body.files});
  console.log(JSON.stringify({baseline:current.release.version.name,changedAssets:assets,functionsChanged:0,rulesChanged:0}));
}
async function deploy(){
  const before=read("before.json"),client=await connect(),current=await hosting.getChannel("meridain-nexus","meridian-nexus","live");
  assert.equal(canonical(current.release.version.name),canonical(before.release.release.version.name));
  const files=Object.fromEntries(before.files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const name of assets){const content=fs.readFileSync(path.join(stage,"assets",name)),gz=zlib.gzipSync(content,{level:9}),hash=crypto.createHash("sha256").update(gz).digest("hex");files[`/${name}`]=hash;uploads.set(hash,gz);}
  const version=await hosting.createVersion("meridian-nexus",{config:current.release.version.config});save("created.json",{version,files});
  const populated=await client.post(`/${version}:populateFiles`,{files}),uploader=new Client({urlPrefix:populated.body.uploadUrl,auth:true});
  for(const hash of populated.body.uploadRequiredHashes||[]){assert.ok(uploads.has(hash));const result=await uploader.request({method:"POST",path:`/${hash}`,body:Readable.from([uploads.get(hash)]),resolveOnHTTPError:true,responseType:"stream"});result.body.resume();assert.equal(result.status,200);}
  await hosting.updateVersion("meridian-nexus",version.split("/").pop(),{status:"FINALIZED"});
  assert.equal(canonical((await hosting.getChannel("meridain-nexus","meridian-nexus","live")).release.version.name),canonical(current.release.version.name));
  await hosting.createRelease("meridian-nexus","live",version,{message:"Restore Daily and Monthly attendance Job Summaries, retaining current dashboards and bot workflow"});
  console.log(JSON.stringify({released:version}));
  await verify();
}
async function verify(){
  const {version,files}=read("created.json"),client=await connect();
  assert.equal(canonical((await hosting.getChannel("meridain-nexus","meridian-nexus","live")).release.version.name),canonical(version));
  const {body}=await client.get(`/${version}/files`,{queryParams:{pageSize:1000}});assert.deepEqual(Object.fromEntries(body.files.map(f=>[f.path,f.hash])),files);
  for(const name of assets){
    const expected=fs.readFileSync(path.join(stage,"assets",name));let matched=false;
    for(let attempt=0;attempt<12;attempt++){
      const response=await fetch(`https://meridian-nexus.web.app/${name}?verify=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});
      if(response.ok && Buffer.from(await response.arrayBuffer()).equals(expected)){matched=true;break;}
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    assert.ok(matched,`${name} propagation is not verified yet`);
  }
  const checks={};
  for(const name of ["getSalesforceAttendanceDashboard","getSalesforceAttendanceWorkbookSnapshotRows"]){
    const response=await fetch(`https://us-central1-meridain-nexus.cloudfunctions.net/${name}`,{method:"POST",headers:{"Content-Type":"application/json"},body:'{"data":{}}'});
    assert.ok([401,403].includes(response.status),`${name} must reject anonymous access`);checks[name]=response.status;
  }
  const result={version,changedAssets:assets,preservedAssets:read("before.json").files.filter(f=>!assets.includes(f.path.slice(1))).length,anonymousAccess:checks,verifiedAt:new Date().toISOString()};save("after.json",result);console.log(JSON.stringify(result));
}
const actions={prepare,deploy,verify};
if(!actions[process.argv[2]])throw new Error("Use prepare, deploy or verify");
actions[process.argv[2]]().catch(error=>{console.error(error.message.slice(0,1600));process.exitCode=1;});
