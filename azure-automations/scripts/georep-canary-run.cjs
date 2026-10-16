'use strict';
// Supervised first Geo Rep run on Azure. Creates an "azure-reserved" extraction run (the Google trigger ignores
// it), starts job-georep-worker with RUN_ID, and reports the run's outcome. Usage:
//   node georep-canary-run.cjs orders            (Geo Rep Sales transactions, month to date)
//   node georep-canary-run.cjs attendance        (Geo Rep Attendance, month to yesterday)
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {json}=require('../../scripts/release-multi-admin.cjs');
const {fields}=require('../../firebase-dashboards/scripts/firestore-values.cjs');
const {decode}=require('../../azure-field-dashboards/attendance-publisher/index.cjs');
const root='projects/meridain-nexus/databases/(default)/documents',base=`https://firestore.googleapis.com/v1/${root}`;
const KIND={orders:'geo-rep-sales-transactions',attendance:'geo-rep-attendance-for-reps'};
const get=async p=>{const d=await json(`${base}/${p}`);return {raw:d,data:decode({mapValue:{fields:d.fields||{}}})};};
async function main(){
  const kind=process.argv[2];assert.ok(KIND[kind],'Use orders or attendance');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const yesterday=new Date(`${today}T12:00:00Z`);yesterday.setUTCDate(yesterday.getUTCDate()-1);
  const end=kind==='orders'?today:yesterday.toISOString().slice(0,10),start=`${end.slice(0,7)}-01`;
  const retailer=await get(`retailers/${KIND[kind]}`),profile=await get(`extractionProfiles/${retailer.data.extractionProfileId}`);
  const email=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','config','get-value','account','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  const runId=`azure-canary-${kind}-${today.replace(/-/g,'')}-${Date.now().toString(36)}`,at=new Date().toISOString();
  const run={retailerId:retailer.raw.name.split('/').at(-1),retailerName:retailer.data.name,extractionProfileId:profile.raw.name.split('/').at(-1),extractionName:profile.data.name,
    workflowMode:profile.data.workflowMode||null,includeSchedulesReport:false,reportStartDate:start,reportEndDate:end,
    reportIdentityOverride:`${KIND[kind]}--azure-canary--${start}--${end}--${runId}`,
    trigger:'azure-canary',status:'azure-reserved',executor:'azure',message:'Supervised first run on Azure.',
    createdBy:`cloud-operator:${email}`,createdByEmail:email,createdByName:'Authorized cloud operator',
    executionTimeline:[{event:'queued',at,message:'Reserved for the Azure worker (supervised first run).'}]};
  const packed=fields(run);packed.createdAt={timestampValue:at};packed.lastActivityAt={timestampValue:at};
  await json(`${base}:commit`,'POST',{writes:[{update:{name:`${root}/extractionRuns/${runId}`,fields:packed},currentDocument:{exists:false}}]});
  console.log(JSON.stringify({runId,kind,range:`${start}..${end}`}));
  if(process.argv.includes('--dispatcher')){
    // Leave it reserved: the scheduled Azure dispatcher must find it and start the worker by itself.
    let last='';for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,20000));const s=(await get(`extractionRuns/${runId}`)).data;
      const line=`${s.status}${s.azureExecution?' '+s.azureExecution:''}`;if(line!==last){console.log(new Date().toISOString().slice(11,19),line);last=line;}
      if(['completed','failed','cancelled','skipped_duplicate'].includes(s.status))break;}
  }else{
    // The job runs the unchanged handler; wait for the run document to reach an outcome.
    try{execFileSync(process.execPath,[require('node:path').join(__dirname,'start-job.cjs'),'job-georep-worker','RUNNER_MODE=run',`RUN_ID=${runId}`],{stdio:'inherit',timeout:20*60*1000});}catch{console.log('Azure execution did not succeed; see the run below.');}
  }
  const done=(await get(`extractionRuns/${runId}`)).data;
  console.log(JSON.stringify({runId,status:done.status,fileId:done.fileId||null,fileName:done.fileName||null,sharePoint:done.sharePoint?.status||null,message:String(done.message||'').slice(0,300)},null,1));
}
main().catch(e=>{console.error(String(e.message).slice(0,400));process.exitCode=1;});
