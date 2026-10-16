'use strict';
// Point the public Franchise Orders refresh at a completed Orders run (the refresh only reads
// retailers/geo-rep-sales-transactions.reportSchedule.lastQueuedRunId; schedule dedup uses lastRunKey, so this
// one field is safe to change and the next scheduled run overwrites it). Then trigger the refresh job.
// Usage: node point-orders-refresh.cjs <completed run id>
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {json}=require('../../scripts/release-multi-admin.cjs');
const {decode}=require('../../azure-field-dashboards/attendance-publisher/index.cjs');
const base='https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
(async()=>{
  const runId=process.argv[2];assert.ok(runId,'run id required');
  const run=decode({mapValue:{fields:(await json(`${base}/extractionRuns/${runId}`)).fields}});
  assert.equal(run.retailerId,'geo-rep-sales-transactions');assert.equal(run.status,'completed');assert.ok(run.fileId,'run has no file');
  const doc=await json(`${base}/retailers/geo-rep-sales-transactions?mask.fieldPaths=reportSchedule`);
  const before=decode({mapValue:{fields:doc.fields}}).reportSchedule;
  await json(`${base}:commit`,'POST',{writes:[{update:{name:doc.name,fields:{reportSchedule:{mapValue:{fields:{lastQueuedRunId:{stringValue:runId}}}}}},updateMask:{fieldPaths:['reportSchedule.lastQueuedRunId']},currentDocument:{updateTime:doc.updateTime}}]});
  execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','scheduler','jobs','run','public-franchise-orders-publisher','--location=us-central1','--project=meridain-nexus','--quiet'],{stdio:'ignore'});
  console.log(JSON.stringify({pointed:runId,previous:before.lastQueuedRunId,lastRunKey:before.lastRunKey,file:run.fileName,range:`${run.reportStartDate}..${run.reportEndDate}`,refreshTriggered:true}));
})().catch(e=>{console.error(String(e.message).slice(0,300));process.exitCode=1;});
