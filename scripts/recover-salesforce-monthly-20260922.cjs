'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const {json}=require('./release-multi-admin.cjs');
const {decode}=require('../azure-field-dashboards/attendance-publisher/index.cjs');
const {fields}=require('../firebase-dashboards/scripts/firestore-values.cjs');
const graph=require('../tmp/sharepoint_helpers.js'),ExcelJS=require('../functions/node_modules/exceljs');
const {worksheetCache,auditMtdCache}=require('./monthly-workbook-cache-audit.cjs');
const root='projects/meridain-nexus/databases/(default)/documents',base='https://firestore.googleapis.com/v1/'+root;
const dir=path.resolve(__dirname,'../.tmp/salesforce-monthly-recovery-20260922');
const priorId='aeEPedEzn1cP8gdxDdFp',runId='monthly-workbook-retry-20260922-01';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const data=doc=>decode({mapValue:{fields:doc.fields||{}}});
const get=async name=>json(base+'/'+name);
const save=async(name,value)=>{await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2));};
const read=async name=>JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
const exists=async name=>{try{return await get(name);}catch(error){if(error.message.startsWith('GET 404:'))return null;throw error;}};
async function active(){
  const rows=await json(base+':runQuery','POST',{structuredQuery:{from:[{collectionId:'extractionRuns'}],select:{fields:['retailerId','workflowMode','status','createdAt'].map(fieldPath=>({fieldPath}))},where:{fieldFilter:{field:{fieldPath:'status'},op:'IN',value:{arrayValue:{values:['queued','running','waiting','cancelling'].map(stringValue=>({stringValue}))}}}},limit:300}});
  const docs=rows.filter(r=>r.document).map(r=>r.document);assert.ok(docs.length<300,'Active run scan is incomplete');
  return docs.filter(d=>['sales-force-p-g','sales-force-p-g-monthly'].includes(data(d).retailerId));
}
async function audit(){
  const prior=await get('extractionRuns/'+priorId),p=data(prior),parent=await get('extractionRuns/'+p.parentRunId),config=await get('salesforceAttendanceConfig/current'),file=await get('files/'+p.sourceFileId),update=await get('attendanceBlueprintUpdates/'+p.attendanceBlueprintUpdateKey),lock=await exists('automationLocks/salesforce-daily-attendance-blueprint');
  const state={at:new Date().toISOString(),prior,parent,config,file,update,lock,active:await active()};await save('audit.json',state);
  console.log(JSON.stringify({prior:priorId,status:p.status,message:p.message,source:data(parent).sourceSharePoint?.name,through:p.reportEndDate,workbook:data(config).attendanceBlueprint,active:state.active.map(d=>({id:d.name.split('/').at(-1),...data(d)})),lock:lock?data(lock):null},null,2));
}
async function download(token,ref,label){
  const endpoint='/drives/'+ref.driveId+'/items/'+ref.itemId;
  const before=await graph.graphJson(token,endpoint+'?$select=id,name,eTag,size,lastModifiedDateTime,webUrl,publication');
  assert.ok(before.eTag&&before.size>0&&before.size<25*1024*1024);
  const file=path.join(dir,label+'.xlsx');
  try{await fs.access(file);throw Error('Preserve existing '+label+' audit file');}catch(error){if(error.code!=='ENOENT')throw error;}
  await graph.graphDownload(token,endpoint+'/content',file);
  const bytes=await fs.readFile(file),after=await graph.graphJson(token,endpoint+'?$select=id,eTag,size');
  assert.equal(after.eTag,before.eTag,'Workbook changed during read');assert.equal(bytes.length,before.size);
  return {...before,sha256:hash(bytes),file};
}
async function inspect(){
  const a=await read('audit.json'),config=data(a.config),p=data(a.parent),token=await graph.graphToken();
  const source=await download(token,p.sourceSharePoint,'source'),workbook=await download(token,config.attendanceBlueprint,'before');
  assert.equal(source.eTag,p.sourceSharePoint.eTag,'Stored retry source differs from SharePoint');
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(workbook.file);
  const sheet=book.getWorksheet(config.attendanceBlueprint.monthlyWorksheet);assert.ok(sheet);
  const totals={1:0,2:0,3:0,4:0,5:0};let rows=0;
  sheet.eachRow((row,n)=>{if(n===1)return;if(row.getCell(12).value)rows++;for(let w=1;w<=5;w++)totals[w]+=Number(row.getCell(33+w).value)||0;});
  const result={at:new Date().toISOString(),source,workbook,monthlyRows:rows,beforeTotals:totals};await save('inspection.json',result);
  console.log(JSON.stringify({source:source.name,workbook:workbook.name,lastModified:workbook.lastModifiedDateTime,publication:workbook.publication,beforeTotals:totals,monthlyRows:rows,readOnly:true},null,2));
}
async function queue(){
  const existing=await exists('extractionRuns/'+runId);if(existing){console.log(JSON.stringify({runId,status:data(existing).status,alreadyQueued:true}));return;}
  const a=await read('audit.json'),inspection=await read('inspection.json');
  const prior=await get('extractionRuns/'+priorId),p=data(prior),update=await get('attendanceBlueprintUpdates/'+p.attendanceBlueprintUpdateKey),parent=await get('extractionRuns/'+p.parentRunId),config=await get('salesforceAttendanceConfig/current');
  assert.equal(p.status,'failed');assert.equal(data(update).status,'failed');assert.equal(data(update).updateRunId,priorId);
  assert.equal(config.updateTime,a.config.updateTime,'Workbook or SmartSell configuration changed since inspection');
  assert.equal(data(parent).status,'completed');assert.equal(data(parent).sourceSharePoint.completeThrough,'2026-09-21');
  assert.equal(p.reportStartDate,'2026-09-01');assert.equal(p.reportEndDate,'2026-09-21');assert.equal(p.monthlyReconcileAllWeeks,true);
  assert.equal((await active()).length,0,'Another attendance job is active; do not overlap writes');
  const lock=await exists('automationLocks/salesforce-daily-attendance-blueprint');
  if(lock&&data(lock).runId){const owner=await exists('extractionRuns/'+data(lock).runId);assert.ok(!owner||['completed','failed','cancelled','aborted','skipped_duplicate'].includes(data(owner).status),'Attendance lock has an active owner');}
  const token=await graph.graphToken(),b=data(config).attendanceBlueprint;
  const target=await graph.graphJson(token,'/drives/'+b.driveId+'/items/'+b.itemId+'?$select=id,eTag');
  assert.equal(target.eTag,inspection.workbook.eTag,'Workbook changed since read-only inspection; inspect fresh before retrying');
  const now=new Date().toISOString(),keys=['retailerId','retailerName','extractionProfileId','attendanceReportType','sourceFileId','sourceFileName','attendanceBlueprintUpdateKey','parentRunId','attendanceDate','reportStartDate','reportEndDate','monthlyActualWeek','monthlyReconcileAllWeeks','dailySmartSellWeekOverride','monthlyWeekStartDate','monthlyWeekEndDate'];
  const run={...Object.fromEntries(keys.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])),extractionName:'Monthly Attendance workbook recovery',workflowMode:'salesforce-attendance-blueprint-update',trigger:'manual-restart',status:'queued',previousUpdateRunId:priorId,retryOfRunId:priorId,createdBy:'nexus-maintenance',createdByName:'Authorized Nexus maintenance',requestedFor:p.createdBy||null,requestedForName:p.createdByName||null,message:'User-requested Monthly retry through 21 September using the validated stored SharePoint export. Preserve the current workbook and verify the saved Actual Week cells.',executionTimeline:[{at:now,event:'queued',message:'Retry the failed workbook step only; no source download, schedule change, restore or forced unlock.',previousUpdateRunId:priorId}]};
  const encoded=fields(run);encoded.createdAt={timestampValue:now};
  const updatePatch=fields({status:'queued',updateRunId:runId,previousUpdateRunId:priorId,message:run.message});updatePatch.queuedAt={timestampValue:now};
  const writes=[
    {update:{name:root+'/extractionRuns/'+runId,fields:encoded},currentDocument:{exists:false}},
    {update:{name:update.name,fields:updatePatch},updateMask:{fieldPaths:Object.keys(updatePatch)},currentDocument:{updateTime:update.updateTime}},
    {update:{name:parent.name,fields:fields({attendanceBlueprintUpdateRunId:runId})},updateMask:{fieldPaths:['attendanceBlueprintUpdateRunId']},currentDocument:{updateTime:parent.updateTime}},
    {verify:config.name,currentDocument:{updateTime:config.updateTime}},{verify:prior.name,currentDocument:{updateTime:prior.updateTime}}
  ];
  await save('queue-plan.json',{at:now,runId,run,workbookETag:target.eTag});await json(base+':commit','POST',{writes});
  console.log(JSON.stringify({queued:runId,through:p.reportEndDate,sourceReused:true,workbookVersionGuardRetained:true}));
}
async function status(){
  const doc=await get('extractionRuns/'+runId),r=data(doc);await save('run.json',doc);
  console.log(JSON.stringify({runId,status:r.status,message:r.message,createdAt:r.createdAt,completedAt:r.completedAt,timeline:r.executionTimeline?.slice(-4),actualWeekTotals:r.attendanceBlueprint?.monthlyPlan?.actualWeekTotals,sharePoint:r.attendanceBlueprint?.sharePoint},null,2));
}
async function verify(){
  const verifiedRunId=process.argv[3]||runId;
  assert.match(verifiedRunId,/^[A-Za-z0-9_-]+$/);
  const r=data(await get('extractionRuns/'+verifiedRunId));assert.equal(r.status,'completed');
  assert.equal(r.retailerId,'sales-force-p-g-monthly');assert.equal(r.reportStartDate,'2026-09-01');assert.equal(r.reportEndDate,'2026-09-21');assert.equal(r.monthlyReconcileAllWeeks,true);
  const a=await read('audit.json'),inspection=await read('inspection.json'),blueprint=data(a.config).attendanceBlueprint,token=await graph.graphToken();
  const parent=data(await get('extractionRuns/'+r.parentRunId));assert.equal(parent.status,'completed');
  assert.equal(parent.sourceSharePoint.itemId,inspection.source.id);assert.equal(parent.sourceSharePoint.eTag,inspection.source.eTag);assert.equal(parent.sourceSharePoint.completeThrough,'2026-09-21');
  assert.equal(hash(await fs.readFile(inspection.source.file)),inspection.source.sha256,'Inspected raw export changed locally');
  const storedSource=data(await get('files/'+r.sourceFileId));assert.equal(storedSource.sha256,inspection.source.sha256,'Completed run used a different export');
  const saved=await download(token,blueprint,'verified-'+verifiedRunId+'-'+Date.now());
  const code=await fs.readFile(path.resolve(__dirname,'../functions/index.js'),'utf8'),ctx=vm.createContext({Date,HttpsError:Error});
  for(const name of ['optionalText','optionalDate','attendanceCellValue','attendanceText','attendanceHeader','attendanceHeaderColumn','attendanceWorksheetHeader','attendanceWorksheet','salesforceDateValue','attendanceDateValue','attendanceStoreCode','attendanceLocationCompliant','attendanceMonthKey','attendanceNumericValue','attendanceCalendarWeek']){
    const fn=code.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\r?\\n\\}'));assert.ok(fn,name);vm.runInContext(fn[0],ctx);
  }
  const sourceBook=new ExcelJS.Workbook(),book=new ExcelJS.Workbook();await sourceBook.xlsx.readFile(inspection.source.file);await book.xlsx.readFile(saved.file);
  const source=ctx.attendanceWorksheet(sourceBook,{storeCode:['storecode'],employeeId:['employeeid'],visitDate:['visitdate'],checkIn:['checkinlocationcompliance'],checkOut:['checkoutlocationcompliance']},'Verified source');
  const counts=new Map(),seen=new Set();let raw=0;
  for(let n=source.rowNumber+1;n<=source.worksheet.rowCount;n++){
    const row=source.worksheet.getRow(n),date=ctx.attendanceDateValue(row.getCell(source.columns.visitDate).value);
    if(date<'2026-09-01'||date>'2026-09-21')continue;raw++;
    if(!ctx.attendanceLocationCompliant(row.getCell(source.columns.checkIn).value)&&!ctx.attendanceLocationCompliant(row.getCell(source.columns.checkOut).value))continue;
    const store=ctx.attendanceStoreCode(row.getCell(source.columns.storeCode).value),person=ctx.attendanceText(row.getCell(source.columns.employeeId).value).replace(/\s+/g,'');
    if(!store||!person)continue;const key=person+'|'+store+'|'+date;if(seen.has(key))continue;seen.add(key);
    const group=store+'|'+ctx.attendanceCalendarWeek(date);counts.set(group,(counts.get(group)||0)+1);
  }
  const totals={1:0,2:0,3:0,4:0},mismatches=[],planRows=[];let rows=0,week5Total=0;
  const plan=book.getWorksheet(blueprint.monthlyWorksheet);assert.ok(plan);
  assert.equal(ctx.attendanceHeader(plan.getRow(1).getCell(1).value),'month');
  assert.equal(ctx.attendanceHeader(plan.getRow(1).getCell(12).value),'storestorecode');
  for(let week=1;week<=5;week++)assert.equal(ctx.attendanceHeader(plan.getRow(1).getCell(33+week).value),'wk'+week+'actual');
  book.getWorksheet(blueprint.monthlyWorksheet).eachRow((row,n)=>{
    if(n<2||ctx.attendanceMonthKey(row.getCell(1).value)!=='2026-09')return;
    const store=ctx.attendanceStoreCode(row.getCell(12).value);if(!store)return;rows++;planRows.push(n);
    for(let week=1;week<=4;week++){const expected=counts.get(store+'|'+week)||0,actual=ctx.attendanceNumericValue(row.getCell(33+week).value);totals[week]+=actual;if(actual!==expected)mismatches.push({row:n,week,actual,expected});}
    week5Total+=ctx.attendanceNumericValue(row.getCell(38).value);
  });
  assert.equal(rows,r.attendanceBlueprint.monthlyPlan.planRefresh.targetRows);assert.deepEqual(totals,r.attendanceBlueprint.monthlyPlan.actualWeekTotals);assert.equal(mismatches.length,0,'Saved monthly cells differ from source');assert.ok(totals[4]>0);
  const Zip=require('../functions/node_modules/jszip'),before=await Zip.loadAsync(await fs.readFile(inspection.workbook.file)),after=await Zip.loadAsync(await fs.readFile(saved.file));
  const manifest=await after.file('xl/workbook.xml').async('string');
  const formulaCache=auditMtdCache(await worksheetCache(after,blueprint.monthlyWorksheet),planRows);
  const result={verifiedAt:new Date().toISOString(),runId:verifiedRunId,completedAt:r.completedAt,workbook:saved.name,workbookETag:saved.eTag,source:inspection.source.name,through:'2026-09-21',rawRows:raw,monthlyRows:rows,actualWeekTotals:totals,total:Object.values(totals).reduce((a,b)=>a+b,0),mismatches:mismatches.length,formulaCache,week5Total,backupId:r.workbookBackup?.backupId,workerSharePointVersion:r.attendanceBlueprint.sharePoint.sharePointVersion,sheetCount:(manifest.match(/<sheet /g)||[]).length,packagePartsBefore:Object.keys(before.files).length,packagePartsAfter:Object.keys(after.files).length,readOnly:true};
  await save('verification.json',result);console.log(JSON.stringify(result,null,2));
}
const actions={audit,inspect,queue,status,verify};
if(require.main===module){assert.ok(actions[process.argv[2]],'Use audit, inspect, queue, status or verify');actions[process.argv[2]]().catch(error=>{console.error(error.message);process.exitCode=1;});}
