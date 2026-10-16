"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const {json,hash,fileHashes,fnUrl}=require("./release-multi-admin.cjs"),{gc}=require("./release-etls.cjs");
const policyRelease=process.argv.includes("--mapping-policy");
const root=path.resolve(__dirname,".."),stage=path.join(root,policyRelease?".tmp/etl-mapping-policy-20260924":".tmp/etl-national-master-20260924"),previous=path.join(root,policyRelease?".tmp/etl-national-master-20260924":".tmp/etl-mapping-diagnostics-20260923");
const project="meridain-nexus",region="us-central1",jobUrl=`https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/nexus-inventory-etl`;
const image=`${region}-docker.pkg.dev/${project}/nexus-etl/worker:20260924-${policyRelease?"mapping-policy":"national-master"}`;
const read=file=>JSON.parse(fs.readFileSync(path.join(stage,file),"utf8"));
const prior=file=>JSON.parse(fs.readFileSync(path.join(previous,file),"utf8"));
const save=(file,value)=>{fs.mkdirSync(stage,{recursive:true});fs.writeFileSync(path.join(stage,file),JSON.stringify(value,null,2),{flag:"wx"});};
async function prepare(){
  const job=await json(jobUrl);assert.deepEqual(job.template,prior("job.after.json").template);
  save("job.before.json",job);save("iam.before.json",await json(jobUrl+":getIamPolicy"));
  const worker=path.join(stage,"worker");fs.mkdirSync(worker,{recursive:true});
  for(const name of ["engine.cjs","worker.cjs","package.json","package-lock.json","Dockerfile",".dockerignore"]){
    assert.equal(hash(fs.readFileSync(path.join(previous,"worker",name))),(prior("tested.json").worker||prior("tested.json").files)[name]);
    fs.copyFileSync(path.join(previous,"worker",name),path.join(worker,name));
  }
  fs.copyFileSync(path.join(root,"etl-worker/engine.cjs"),path.join(worker,"engine.cjs"));
  fs.mkdirSync(path.join(worker,"test"));
  for(const file of ["worker.test.cjs","inventory-fixture.cjs"])fs.copyFileSync(path.join(root,"etl-worker/test",file),path.join(worker,"test",file));
  return test();
}
function test(){
  const worker=path.join(stage,"worker");
  assert.equal(hash(fs.readFileSync(path.join(worker,"engine.cjs"))),hash(fs.readFileSync(path.join(root,"etl-worker/engine.cjs"))));
  execFileSync(process.execPath,["--test","etl-worker/test/engine.test.cjs","etl-worker/test/worker.test.cjs","scripts/tests/etl-api.test.cjs","scripts/tests/etl-references.test.cjs","scripts/tests/etl-pipelines.test.cjs"],{cwd:root,stdio:"inherit",windowsHide:true});
  save("tested.json",{at:new Date().toISOString(),files:fileHashes(worker)});
  save("build-config.json",{steps:[{name:"gcr.io/cloud-builders/docker",args:["build","-t",image,"."]},{name:"gcr.io/cloud-builders/docker",args:["run","--rm","--network=none","-v","/workspace/test:/app/test:ro",image,"node","--test","test/worker.test.cjs"]}],images:[image],timeout:"1200s"});
  console.log("Tested isolated worker change; no production change.");
}
function build(){
  assert.deepEqual(fileHashes(path.join(stage,"worker")),read("tested.json").files);
  save("build.started.json",JSON.parse(gc("builds","submit",path.join(stage,"worker"),`--config=${path.join(stage,"build-config.json")}`,`--project=${project}`,`--region=${region}`,"--async","--format=json","--quiet")));
}
async function deploy(){
  let build;
  for(let i=0;i<100;i++){
    build=await json(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${read("build.started.json").id}`);
    if(!["QUEUED","WORKING","STATUS_UNKNOWN"].includes(build.status))break;
    await new Promise(r=>setTimeout(r,10000));
  }
  assert.equal(build.status,"SUCCESS");save("build.result.json",build);
  const before=read("job.before.json"),current=await json(jobUrl);assert.deepEqual(current.template,before.template);assert.equal(current.generation,before.generation);
  assert.deepEqual(await json(jobUrl+":getIamPolicy"),read("iam.before.json"));
  const template=structuredClone(before.template);template.template.containers[0].image=image.split(":")[0]+"@"+build.results.images.find(r=>r.name===image).digest;
  const operation=await json(jobUrl,"PATCH",{name:current.name,etag:current.etag,template});save("operation.json",operation);
  for(let i=0;i<100;i++){const op=await json("https://run.googleapis.com/v2/"+operation.name);if(op.done){assert.ok(!op.error,JSON.stringify(op.error));break;}assert.ok(i<99);await new Promise(r=>setTimeout(r,5000));}
  const after=await json(jobUrl);assert.deepEqual(after.template,template);assert.equal(after.terminalCondition.state,"CONDITION_SUCCEEDED");
  assert.deepEqual(await json(jobUrl+":getIamPolicy"),read("iam.before.json"));save("job.after.json",after);
  save("verified.json",{at:new Date().toISOString(),image:template.template.containers[0].image,runtimeAndIamPreserved:true,onlyFileChanged:"engine.cjs",jobsStartedByThisRelease:0});
  console.log("National master sheet compatibility deployed; runtime and access controls unchanged. No business run started.");
}
const actions={prepare,test,build,deploy};
if(require.main===module)Promise.resolve().then(()=>{assert.ok(actions[process.argv[2]]);return actions[process.argv[2]]();}).catch(e=>{console.error(e.stack);process.exitCode=1;});
