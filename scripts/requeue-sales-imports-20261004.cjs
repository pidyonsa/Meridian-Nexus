'use strict';
// Re-run the Geo Rep sales transaction imports that failed from about 28 September to 4 October because the
// import could not read the Orders store master (fixed by the sales-import-store-master-read grant).
// Same document shape as reconcileGeoRepSalesTransactionImport; creating it starts importGeoRepSalesTransactionReport.
const assert=require('node:assert/strict');
const {json}=require('./release-multi-admin.cjs');
const {fields}=require('../firebase-dashboards/scripts/firestore-values.cjs');
const {decode}=require('../azure-field-dashboards/attendance-publisher/index.cjs');
const root='projects/meridain-nexus/databases/(default)/documents',base=`https://firestore.googleapis.com/v1/${root}`;
const get=async p=>decode({mapValue:{fields:(await json(`${base}/${p}`)).fields||{}}});
async function main(){
  const config=await get('salesDashboardConfig/current');assert.ok(config.storeMasterId,'no store master configured');
  const october=(await get('extractionRuns/Pp7TRdTCOIhS2RN2lyut')).fileId;
  const files=['eb5a112b-b65b-497c-b4cd-f55fa5b1e295',october];
  const writes=[],out=[];const at=new Date().toISOString();
  for(const fileId of files){
    const f=await get(`files/${fileId}`);assert.ok(f.reportStartDate&&f.reportEndDate,'file dates missing '+fileId);
    const period=f.reportStartDate.slice(0,7),id=`requeue-20261004-${period}`;
    const doc={sourceFileId:fileId,sourceFileName:f.name||f.originalName||null,parentRunId:f.extractionRunId||null,storeMasterId:config.storeMasterId,storeMasterName:config.storeMasterName||null,
      periodKey:period,reportStartDate:f.reportStartDate,reportEndDate:f.reportEndDate,status:'queued',
      message:'Re-run after the Orders store master read permission was restored (imports failed since about 28 September).',
      reconciliationOfImportId:fileId};
    const packed=fields(doc);packed.createdAt={timestampValue:at};packed.updatedAt={timestampValue:at};
    writes.push({update:{name:`${root}/salesTransactionImports/${id}`,fields:packed},currentDocument:{exists:false}});
    out.push({id,fileId,file:doc.sourceFileName,range:`${f.reportStartDate}..${f.reportEndDate}`});
  }
  await json(`${base}:commit`,'POST',{writes});
  console.log(JSON.stringify(out,null,1));
}
main().catch(e=>{console.error(String(e.message).slice(0,300));process.exitCode=1;});
