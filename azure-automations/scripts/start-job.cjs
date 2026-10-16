'use strict';
// Start an Azure Container Apps job execution with per-run environment overrides, then wait for it.
// Usage: node start-job.cjs <job-name> NAME=value [NAME=value...]
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const JOBS='/subscriptions/02b268fe-e01a-453e-b287-eec83ccc0676/resourceGroups/rg-meridian-nexus-automations/providers/Microsoft.App/jobs/';
const [job,...pairs]=process.argv.slice(2);
assert.ok(/^job-[a-z0-9-]+$/.test(job||''),'job name required');
const overrides=Object.fromEntries(pairs.map(p=>{const i=p.indexOf('=');assert.ok(i>0,'NAME=value');return [p.slice(0,i),p.slice(i+1)];}));
const token=()=>execFileSync('powershell.exe',['-NoProfile','-Command',"& 'C:/Program Files/Microsoft SDKs/Azure/CLI2/wbin/az.cmd' account get-access-token --query accessToken -o tsv"],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
async function arm(path,method='GET',body){
  const r=await fetch('https://management.azure.com'+path+(path.includes('?')?'&':'?')+'api-version=2024-03-01',{method,headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  const text=await r.text();assert.ok(r.ok,`${method} ${path} ${r.status} ${text.slice(0,400)}`);return text?JSON.parse(text):{};
}
async function main(){
  const def=await arm(JOBS+job);
  const containers=def.properties.template.containers.map(c=>({...c,env:(c.env||[]).map(e=>Object.hasOwn(overrides,e.name)?{name:e.name,value:overrides[e.name]}:e)}));
  for(const name of Object.keys(overrides))assert.ok(containers[0].env.some(e=>e.name===name),'unknown env '+name);
  const started=await arm(JOBS+job+'/start','POST',{containers});
  const name=started.name||started.id?.split('/').at(-1);console.log(JSON.stringify({event:'started',job,execution:name,overrides}));
  for(;;){
    await new Promise(r=>setTimeout(r,15000));
    const ex=await arm(JOBS+job+'/executions/'+name);const s=ex.properties?.status;
    if(['Succeeded','Failed','Stopped','Degraded'].includes(s)){console.log(JSON.stringify({event:'finished',execution:name,status:s,start:ex.properties.startTime,end:ex.properties.endTime}));process.exitCode=s==='Succeeded'?0:1;return;}
  }
}
main().catch(e=>{console.error(String(e.message).slice(0,500));process.exitCode=1;});
