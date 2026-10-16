'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {json,hash}=require('./release-multi-admin.cjs');
const {pages}=require('./nexus-azure-inventory.cjs');
const {encode}=require('./restore-picknpay-setup.cjs');
const {decode}=require('../azure-field-dashboards/attendance-publisher/index.cjs');
const project='meridain-nexus';
const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const stage=path.resolve(__dirname,'../.tmp/dataorbis-sales-20260922');
const source='C:/Users/PC/Downloads/Game & Makro ETLs (Data orbis).docx';
const definitions=[
  {id:'dataorbis-game-sales',name:'Game Sales (DataOrbis)',channel:'game',folder:'Massdiscounters Supplier Reports',banners:['GAME']},
  {id:'dataorbis-makro-sales',name:'Makro / Jumbo Sales (DataOrbis)',channel:'makro-jumbo',folder:'Massmart Wholesale Supplier Reports',banners:['MAKRO','JUMBO']}
];
function setupDocument(definition,sourceSha256) {
  assert.ok(definitions.some(d=>d.id===definition.id));
  assert.match(sourceSha256,/^[a-f0-9]{64}$/);
  return {
    name:definition.name,webAddress:'https://pyramid.dataorbis.com',username:'',
    extractionName:'Monthly Sales Performance - setup and validation required',
    reportSchedule:{enabled:false},
    restoration:{status:'awaiting-connection-verification',family:'dataorbis-monthly-sales',automaticPublication:false,
      blockers:['credentials','approved-supplier-selection','portal-actions-and-raw-copy-validation','source-and-mapping-validation','approved-monthly-template-and-destination'],
      sourceDocuments:['Game & Makro ETLs (Data orbis).docx','Game _ Makro ETLs (Data orbis)-20260922_084345-Meeting Recording (1).mp4'],sourceSha256},
    salesProcedure:{
      version:'dataorbis-sales-20260922',channel:definition.channel,folder:definition.folder,
      report:'Monthly Sales Performance',periodPolicy:'previous-full-calendar-month',timezone:'Africa/Johannesburg',
      sourceMethod:'Copy Content > Copy Raw Data',supplierSelection:'one-approved-supplier',supplierName:'',
      exampleSupplier:'WILMAR SA (PTY) LTD',exampleClient:'WILMAR',
      exampleIsNotConfiguredSupplier:true,allowedBanners:definition.banners,
      rawDimensions:['Site Code','Site','Region','Category','Brand','Product'],measures:['Sales Quantity','Sales Value Excl'],
      outputColumns:['Month-Yr','Client','Retailer','Banner','Store ID','Store Name','CHAIN #','STORE #','Province','RSM','DM','REP','MERCH','CATEGORY','BRAND','PRODUCT','SALES UNITS','SALES VALUE'],
      blankColumns:['CHAIN #','STORE #','RSM','DM','REP','MERCH'],
      referenceRequirements:['SALES DATA STORE NAME CLEAN UP','National Call Cycle Master','Approved monthly all-clients sales template'],
      rules:[
        `Open Explorer > Public Content > ${definition.folder} > Sales Extract > Options > View > Monthly Sales Performance.`,
        'Select only the approved supplier and the last complete calendar month. Stop for partial, missing or truncated data; do not use the current-month cumulative result.',
        'Replace Group with Site Code, then add Site, Region, Category, Brand and Product in that order. Retain Sales Quantity and Sales Value Excl.',
        'Right-click the report scrollbar, then Copy Content > Copy Raw Data. Preserve the complete raw result as separate evidence.',
        'Match raw Site Code plus raw Site to the approved store-name cleanup. Match the resulting clean store name to the National Call Cycle Master for banner and retailer.',
        'Retailer and banner must be the same approved channel value. Unmapped or ambiguous stores require review; do not guess or use the first match.',
        'Preserve raw site code, site name, region, category, brand, product, sales units and sales value. Keep category/brand standardisation in the approved downstream mapping.',
        'Align to the approved 18-column sales template: two blank legacy columns after Store Name and four blank staffing columns after Province. Do not populate these with zero.',
        'Validate supplier, month, row counts and totals before publication. Copy only transformed values, not raw/helper columns, into the approved month. Never append the same supplier/channel/month twice.',
        'Inventory is outside this sales procedure. Scheduling and shared-workbook updates remain off until an end-to-end validation passes.'
      ],
      validated:false,publicationEnabled:false
    },updatedBy:'nexus-dataorbis-sales-setup-20260922'
  };
}
function validateNoDuplicates(retailers) {
  const candidates=retailers.filter(doc=>/dataorbis|pyramid\.dataorbis|\bmakro\b|\bjumbo\b|\bgame\b/i.test(`${doc.id} ${doc.name||''} ${doc.webAddress||''}`));
  assert.equal(candidates.length,0,'A Game/Makro/DataOrbis profile already exists; review it instead of creating duplicates.');
}
async function queryMetadata() {
  const query=new URLSearchParams({pageSize:'1000'});
  for(const field of ['name','webAddress','extractionProfileId','updatedAt','reportSchedule','restoration'])query.append('mask.fieldPaths',field);
  const documents=await pages(`${base}/retailers?${query}`,'documents');
  return documents.map(doc=>({id:doc.name.split('/').at(-1),...decode({mapValue:{fields:doc.fields}})}));
}
async function main() {
  const action=process.argv[2];assert.ok(['audit','apply','verify'].includes(action));
  fs.mkdirSync(stage,{recursive:true});
  const sourceSha256=hash(fs.readFileSync(source));
  if(action==='audit') {
    const retailers=await queryMetadata();validateNoDuplicates(retailers);
    const proposal=definitions.map(definition=>({id:definition.id,...setupDocument(definition,sourceSha256)}));
    fs.writeFileSync(path.join(stage,'profiles.before.json'),JSON.stringify(retailers,null,2),{flag:'wx'});
    fs.writeFileSync(path.join(stage,'profiles.proposed.json'),JSON.stringify(proposal,null,2),{flag:'wx'});
    console.log(JSON.stringify({existingProfiles:retailers.length,newProfiles:proposal.map(p=>({id:p.id,name:p.name,webAddress:p.webAddress})),credentialsAccessed:false,schedulesEnabled:0}));return;
  }
  const proposed=JSON.parse(fs.readFileSync(path.join(stage,'profiles.proposed.json'),'utf8'));
  for(const [i,p] of proposed.entries())assert.deepEqual(p,{id:definitions[i].id,...setupDocument(definitions[i],sourceSha256)});
  if(action==='apply') {
    assert.ok(!fs.existsSync(path.join(stage,'profiles.applied.json')),'Already applied; verify instead of repeating.');
    const current=await queryMetadata();validateNoDuplicates(current);
    const writes=proposed.map(({id,...value})=>({update:{name:`projects/${project}/databases/(default)/documents/retailers/${id}`,fields:encode(value).mapValue.fields},currentDocument:{exists:false},
      updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}));
    await json(base+':commit','POST',{writes});
    fs.writeFileSync(path.join(stage,'profiles.applied.json'),JSON.stringify({at:new Date().toISOString(),ids:proposed.map(p=>p.id),schedulesEnabled:0,secretsWritten:0,jobsStarted:0},null,2),{flag:'wx'});
  }
  const evidence=[];
  for(const {id,...value} of proposed) {
    const document=await json(`${base}/retailers/${id}`);const actual=decode({mapValue:{fields:document.fields}});
    for(const [key,expected] of Object.entries(value))assert.deepEqual(actual[key],expected,id+': '+key);
    assert.ok(!actual.extractionProfileId && !actual.steps && !actual.password);
    evidence.push({id,name:actual.name,updateTime:document.updateTime,schedulingEnabled:actual.reportSchedule.enabled,procedureValidated:actual.salesProcedure.validated});
  }
  const result={verifiedAt:new Date().toISOString(),profiles:evidence,secretsWritten:0,jobsStarted:0};
  fs.writeFileSync(path.join(stage,'profiles.verified.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={definitions,setupDocument,validateNoDuplicates};
