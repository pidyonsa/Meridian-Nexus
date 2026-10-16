"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),zlib=require("node:zlib"),{Readable}=require("node:stream");
const root=path.resolve(__dirname,".."),stage=path.join(root,".tmp/attendance-staff-access/hosting"),site="meridian-nexus",project="meridain-nexus";
const cliPath=path.join(process.env.APPDATA,"npm/node_modules/firebase-tools"),cli=require(cliPath),hosting=require(path.join(cliPath,"lib/hosting/api")),{Client}=require(path.join(cliPath,"lib/apiv2"));
const assets=["index.html","app.js","service-worker.js"],tag="20260909-attendance-staff-access";
const canonical=v=>v.replace("projects/730011371323/",`projects/${project}/`);
const read=n=>JSON.parse(fs.readFileSync(path.join(stage,n))),save=(n,v)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,n),JSON.stringify(v,null,2));};
async function connect(){await cli.hosting.channel.list({project,site,nonInteractive:true});return new Client({urlPrefix:"https://firebasehosting.googleapis.com",apiVersion:"v1beta1",auth:true});}
async function prepare(){
  assert.ok(!fs.existsSync(path.join(stage,"before.json")),"Preserve prior backup");
  const client=await connect(),current=await hosting.getChannel(project,site,"live");
  assert.equal(current.release.version.name.split("/").at(-1),"ccd8f2808ae55324","Review newer live hosting before replacing it");
  const {body}=await client.get(`/${current.release.version.name}/files`,{queryParams:{pageSize:1000}});assert.ok(!body.nextPageToken);
  const before={},updated={};
  for(const name of assets){const r=await fetch(`https://${site}.web.app/${name}?backup=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});assert.ok(r.ok);before[name]=await r.text();updated[name]=before[name];}
  const local=fs.readFileSync(path.join(root,"public/app.js"),"utf8");
  for(const name of ["operatorCanAccessGeoAttendance","openAttendanceDashboard","openCallCycleDashboard"]){
    const pattern=new RegExp(`function ${name}\\([^]*?\\r?\\n\\}`),a=before["app.js"].match(pattern),b=local.match(pattern);assert.ok(a&&b);
    updated["app.js"]=updated["app.js"].replace(a[0],()=>b[0]);
  }
  for(const name of ["index.html","service-worker.js"]){assert.ok(updated[name].includes("app.js?v=20260909-job-summaries2"));updated[name]=updated[name].replaceAll("app.js?v=20260909-job-summaries2",`app.js?v=${tag}`);}
  assert.ok(updated["service-worker.js"].includes('const CACHE = "meridian-nexus-v51";'));
  updated["service-worker.js"]=updated["service-worker.js"].replace('const CACHE = "meridian-nexus-v51";','const CACHE = "meridian-nexus-v52";');
  save("before.json",{current,files:body.files,assets:before});save("assets.json",updated);
  console.log(JSON.stringify({prepared:true,changedAssets:assets,appChanges:"Three attendance/Call Cycle viewing guards only"}));
}
async function deploy(){
  const before=read("before.json"),updated=read("assets.json"),client=await connect(),current=await hosting.getChannel(project,site,"live");
  assert.equal(canonical(current.release.version.name),canonical(before.current.release.version.name));
  const files=Object.fromEntries(before.files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const [name,content] of Object.entries(updated)){const gzip=zlib.gzipSync(content,{level:9}),hash=crypto.createHash("sha256").update(gzip).digest("hex");files[`/${name}`]=hash;uploads.set(hash,gzip);}
  const version=await hosting.createVersion(site,{config:current.release.version.config});save("created.json",{version,files});
  const populated=await client.post(`/${version}:populateFiles`,{files}),uploader=new Client({urlPrefix:populated.body.uploadUrl,auth:true});
  for(const hash of populated.body.uploadRequiredHashes||[]){assert.ok(uploads.has(hash));const r=await uploader.request({method:"POST",path:`/${hash}`,body:Readable.from([uploads.get(hash)]),resolveOnHTTPError:true,responseType:"stream"});r.body.resume();assert.equal(r.status,200);}
  await hosting.updateVersion(site,version.split("/").at(-1),{status:"FINALIZED"});
  assert.equal(canonical((await hosting.getChannel(project,site,"live")).release.version.name),canonical(current.release.version.name));
  await hosting.createRelease(site,"live",version,{message:"Enable normal-staff viewing of Time & Attendance and Dedicated/Syndicated Call Cycle; keep admin and automation controls restricted"});console.log(JSON.stringify({released:version}));
}
async function verify(){
  const {version,files}=read("created.json"),client=await connect();assert.equal(canonical((await hosting.getChannel(project,site,"live")).release.version.name),canonical(version));
  const {body}=await client.get(`/${version}/files`,{queryParams:{pageSize:1000}});assert.deepEqual(Object.fromEntries(body.files.map(f=>[f.path,f.hash])),files);
  for(const [name,expected] of Object.entries(read("assets.json"))){let matched=false;for(let attempt=0;attempt<12;attempt++){const r=await fetch(`https://${site}.web.app/${name}?verify=${Date.now()}`,{headers:{"Cache-Control":"no-cache"}});if(r.ok&&await r.text()===expected){matched=true;break;}await new Promise(resolve=>setTimeout(resolve,5000));}assert.ok(matched,`Propagation not verified: ${name}`);}
  const result={version,tag,verifiedAt:new Date().toISOString(),preservedOtherAssets:read("before.json").files.filter(f=>!assets.includes(f.path.slice(1))).length};save("verified.json",result);console.log(JSON.stringify(result));
}
const actions={prepare,deploy,verify};if(!actions[process.argv[2]])throw new Error("Use prepare, deploy or verify");actions[process.argv[2]]().catch(e=>{console.error(e.message);process.exitCode=1;});
