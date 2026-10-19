'use strict';
// Move a Google scheduled function to its Azure job, one at a time (16 October 2026):
//   pause  <job>  - pause the Google Cloud Scheduler job(s) for the functions the Azure job runs (state saved)
//   run    <job>  - start one supervised Azure execution, wait, and print its logs
//   enable <job>  - switch the Azure job to its schedule (the SCHEDULE value in its definition)
//   resume <job>  - rollback: resume the Google scheduler job(s) and set the Azure job back to manual
// <job> is the file name in azure-automations/jobs without .yaml, e.g. nexus-stalled-runs.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {json}=require('../../scripts/release-multi-admin.cjs');
const RG='/subscriptions/02b268fe-e01a-453e-b287-eec83ccc0676/resourceGroups/rg-meridian-nexus-automations';
const WORKSPACE='a0bae0c8-0906-4da0-bdd7-3fb02a579610';
const SCHED='https://cloudscheduler.googleapis.com/v1/projects/meridain-nexus/locations/us-central1/jobs/';
const stage=path.resolve(__dirname,'../../.tmp/move-scheduled-20261016');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [action,job]=process.argv.slice(2);
const yaml=fs.readFileSync(path.join(__dirname,'../jobs',job+'.yaml'),'utf8');
const value=name=>yaml.match(new RegExp(`- name: ${name}\\n\\s+value: '?([^'\\n]+)'?`))[1];
const functions=value('FUNCTIONS').split(','),schedule=value('SCHEDULE'),jobUrl=`${RG}/providers/Microsoft.App/jobs/job-${job}`;
const tokens={};
function token(resource){return tokens[resource]||=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`az account get-access-token --resource ${resource} -o json`],{encoding:'utf8',windowsHide:true})).accessToken;}
async function azure(url,method='GET',body,resource='https://management.azure.com'){
  const r=await fetch((url.startsWith('http')?url:'https://management.azure.com'+url+(url.includes('?')?'&':'?')+'api-version=2024-03-01'),{method,headers:{Authorization:'Bearer '+token(resource),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error(`Azure ${r.status}: ${(await r.text()).slice(0,500)}`);
  return r.status===202||r.status===204?(await r.text()?{}:{}):r.json();
}
async function setTrigger(scheduled){
  const def=await azure(jobUrl),cfg=def.properties.configuration;
  const parallel={parallelism:1,replicaCompletionCount:1};
  const configuration={...cfg,triggerType:scheduled?'Schedule':'Manual',scheduleTriggerConfig:scheduled?{cronExpression:schedule,...parallel}:null,manualTriggerConfig:scheduled?null:parallel};
  await azure(jobUrl,'PATCH',{properties:{configuration}});
  for(;;){const d=await azure(jobUrl);if(d.properties.provisioningState!=='InProgress'){console.log(`Azure job-${job}:`,d.properties.configuration.triggerType,d.properties.configuration.scheduleTriggerConfig?.cronExpression||'',d.properties.provisioningState);return;}await sleep(5000);}
}
const actions={
  async pause(){
    fs.mkdirSync(stage,{recursive:true});
    for(const fn of functions){const id=`firebase-schedule-${fn}-us-central1`,before=await json(SCHED+id);
      fs.writeFileSync(path.join(stage,id+'.json'),JSON.stringify(before,null,2));
      const after=before.state==='PAUSED'?before:await json(SCHED+id+':pause','POST',{});console.log(`Google ${id}: ${before.state} -> ${after.state}`);}
  },
  async run(){
    const started=await azure(jobUrl+'/start','POST',{}),name=started.name||started.id?.split('/').at(-1);
    console.log('Azure execution',name);let status;
    for(let i=0;i<80;i++){await sleep(15000);status=(await azure(`${jobUrl}/executions/${name}`)).properties.status;if(!['Running','Processing'].includes(status))break;}
    console.log('status',status);
    // Console logs reach Log Analytics a few minutes after the execution ends.
    for(let i=0;i<16;i++){
      const r=await azure(`https://api.loganalytics.io/v1/workspaces/${WORKSPACE}/query`,'POST',{query:`ContainerAppConsoleLogs_CL | where ContainerGroupName_s startswith '${name}' | order by TimeGenerated asc | project Log_s`},'https://api.loganalytics.io');
      const rows=r.tables[0].rows.map(x=>x[0]);if(rows.some(l=>/scheduled-function-|scheduled-runner-failed/.test(l))||i===15){rows.forEach(l=>console.log(l.slice(0,1200)));break;}
      await sleep(30000);
    }
  },
  async enable(){await setTrigger(true);},
  async resume(){
    await setTrigger(false);
    for(const fn of functions){const id=`firebase-schedule-${fn}-us-central1`,r=await json(SCHED+id+':resume','POST',{});console.log(`Google ${id}: ${r.state}`);}
  }
};
if(!actions[action])throw Error('Use pause, run, enable or resume');
actions[action]().catch(e=>{console.error(e.message);process.exitCode=1;});
