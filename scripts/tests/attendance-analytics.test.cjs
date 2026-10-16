const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A = require('../../functions/attendance-analytics');
const ExcelJS = require('../../functions/node_modules/exceljs');
const hierarchy = {sourceName:'Synthetic hierarchy.xlsx',sha256:'test',rows:[
  {name:'Alex Rep',manager:'Line One',regionalManager:'Regional',generalManager:'General',head:'Head',region:'Free State',division:'CENTRAL',assignment:'syndicated'},
  {name:'Bea Rep',manager:'Line Two',regionalManager:'Regional',generalManager:'General',head:'Head',region:'Gauteng',division:'INLAND',assignment:'syndicated'},
  {name:'Missing Rep',manager:'Line One',region:'Free State',division:'CENTRAL',assignment:'syndicated'}
]};
const visit = (overrides={}) => ({userName:'Alex Rep',userCode:'A',manager:'Wrong source manager',region:'Free State',division:'Inland',role:'Sales Rep',date:'2026-09-01',week:'Week 4',customer:'Store One',storeCode:'S1',result:'Visited',banner:'Banner One',channel:'Wholesale',...overrides});
function fixture(audience='rep') {
  const visits = [visit(),visit({date:'2026-09-02',result:'Not Visited'}),visit({storeCode:'S2',customer:'Store Two',result:'Not Visited'}),visit({storeCode:'S3',customer:'Store Three',result:'Not Visited'}),visit({storeCode:'S4',customer:'Store Four',result:'Not visited'}),visit({storeCode:'S5',customer:'Store Five',result:'Unexpected code'}),visit({storeCode:'S6',result:'On Leave'}),visit({userName:'Bea Rep',userCode:'B',region:'Gauteng',date:'2026-09-08',week:'Week 1',storeCode:'S7',banner:'Banner Two',channel:'Grocery'})];
  const sourceRows = [{userName:'Alex Rep',userCode:'A',manager:'Line One',region:'Free State',scheduled:6,onSchedule:1},{userName:'Bea Rep',userCode:'B',region:'Gauteng',scheduled:1,onSchedule:1}];
  return A.buildDataset({visits:audience === 'merchandiser' ? visits.map(r=>({...r,manager:r.userName,userName:'Merch '+r.userName,userCode:'M'+r.userCode,role:'Merchandiser'})) : visits,sourceRows:audience === 'merchandiser' ? sourceRows.map(r=>({...r,manager:r.userName,userName:'Merch '+r.userName,userCode:'M'+r.userCode,role:'Merchandiser'})) : sourceRows,hierarchy,audience,version:'v1',source:{reportEndDate:'2026-09-09'}});
}
test('Central classification overrides stale Inland master values',()=>{
  for(const region of ['Free State','FREE STATE','North West','North-West']) assert.equal(A.division(region,'INLAND'),'CENTRAL');
  assert.equal(A.division('Gauteng'),'INLAND');assert.equal(A.division('Western Cape'),'COASTAL');assert.equal(A.division('Unknown'),'UNASSIGNED');
});
test('negative attendance statuses do not substring-match visited',()=>{
  for(const result of ['Not Visited','Unvisited','Not Completed','Not Checked In','No Visit']) assert.equal(A.resultStatus(result),'missed');
  assert.equal(A.resultStatus('Visited'),'visited');assert.equal(A.resultStatus('On leave'),'excluded');assert.equal(A.resultStatus('Not visited - unclear'),'unknown');assert.equal(A.resultStatus(''),'unknown');
  assert.equal(A.resultStatus('Cancelled'),'unknown');assert.equal(A.resultStatus('Caught up on: 2026-09-09'),'visited');
  assert.equal(A.resultStatus('Caught up on: 2026-02-30'),'unknown');
});
test('caught-up visits count positively against the scheduled day and retain completion date',async()=>{
  const dataset=A.buildDataset({visits:[visit({date:'2026-09-01',result:'Caught up on: 2026-09-09'})],hierarchy,audience:'rep'});
  const d=A.dashboard(dataset);assert.equal(d.metrics.attended,1);assert.equal(d.metrics.caughtUpVisits,1);assert.equal(d.metrics.missedStores,0);assert.equal(d.metrics.visitedStores,1);assert.equal(d.scheduleAnalytics.daily[0].label,'2026-09-01');assert.equal(d.scheduleAnalytics.daily[0].attended,1);
  const result=A.detail(dataset,{}, {metric:'actual'});assert.equal(result.total,1);assert.equal(result.rows[0].completedDate,'2026-09-09');
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await A.excel(result,{audience:'rep'},ExcelJS));assert.equal(workbook.getWorksheet('Visits').getCell('U2').value,'2026-09-09');
});

test('only explicit early-visit results with valid dates count as attended',()=>{
  for(const result of ['Early visit on: 2026-09-05',' early VISIT on:  2026-09-02 ','Early visit on: 2024-02-29']) assert.equal(A.resultStatus(result),'visited');
  for(const result of ['Early visit on: 2026-02-30','Early visit on: 2026-02-29','Early visit on: 2026-13-01','Early visit on:','No early visit on: 2026-09-05','Cancelled early visit on: 2026-09-05','Early visit on: 2026-09-05 - unconfirmed']) assert.equal(A.resultStatus(result),'unknown');
});

for(const audience of ['rep','merchandiser']) test(`${audience} early visits reconcile across scheduled days, teams, stores and Excel`,async()=>{
  const person=audience === 'merchandiser' ? {userName:'Merch Alex',userCode:'MA',manager:'Alex Rep',role:'Merchandiser'} : {};
  const dataset=A.buildDataset({visits:[visit({...person,date:'2026-09-09',week:'Week 2',result:'Early visit on: 2026-09-05'}),visit({...person,date:'2026-09-10',week:'Week 2',result:'Not Visited'}),visit({...person,date:'2026-09-09',week:'Week 2',storeCode:'S2',result:'Caught up on: 2026-09-10'})],hierarchy,audience});
  const filters={manager:'Line One',region:'Free State'},d=A.dashboard(dataset,filters);
  assert.equal(d.metrics.scheduled,3);assert.equal(d.metrics.attended,2);assert.equal(d.metrics.onSchedule,2);
  assert.equal(d.metrics.earlyVisits,1);assert.equal(d.metrics.caughtUpVisits,1);assert.equal(d.metrics.unknownVisits,0);assert.equal(d.metrics.missedVisits,1);
  assert.equal(d.metrics.visitedStores,2);assert.equal(d.metrics.missedStores,0);assert.equal(d.metrics.strikeRate,2/3*100);
  for(const group of [d.rows,d.stores,d.charts.byDivision,d.charts.byRegion,d.charts.byManager,d.scheduleAnalytics.weekly,d.scheduleAnalytics.daily]) {
    assert.equal(group.reduce((s,r)=>s+r.attended,0),2);assert.equal(group.reduce((s,r)=>s+r.earlyVisits,0),1);
  }
  assert.equal(d.scheduleAnalytics.daily.find(r=>r.label==='2026-09-09').attended,2);
  assert.equal(d.scheduleAnalytics.daily.some(r=>r.label==='2026-09-05'),false,'Do not add a second target on the completion date');
  const result=A.detail(dataset,filters,{date:'2026-09-09',metric:'actual'}),early=result.rows.find(r=>r.earlyVisit);
  assert.equal(result.total,2);assert.equal(early.completedDate,'2026-09-05');assert.equal(early.date,'2026-09-09');assert.equal(early.caughtUp,false);
  assert.equal(A.detail(dataset,filters,{metric:'unknown'}).total,0);assert.equal(A.detail(dataset,filters,{metric:'missed',unit:'stores'}).total,0);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await A.excel(result,{audience},ExcelJS));const sheet=workbook.getWorksheet('Visits');
  assert.equal(sheet.rowCount,3);assert.equal(sheet.getCell('B2').value,'2026-09-09');assert.equal(sheet.getCell('F2').value,'visited');assert.equal(sheet.getCell('Q2').value,1);
  assert.equal(sheet.getCell('T2').value,'Early visit on: 2026-09-05');assert.equal(sheet.getCell('U2').value,'2026-09-05');
});
test('daily, weekly, all columns and distinct stores reconcile',()=>{
  const dataset=fixture(),d=A.dashboard(dataset);
  assert.equal(d.metrics.scheduled,7);assert.equal(d.metrics.attended,2);assert.equal(d.metrics.missedVisits,4);assert.equal(d.metrics.unknownVisits,1);
  assert.equal(d.metrics.totalStores,6);assert.equal(d.metrics.missedStores,3);assert.equal(d.metrics.unknownStores,1);
  assert.equal(d.scheduleAnalytics.weekly.reduce((s,r)=>s+r.attended,0),2);
  for(const metric of ['target','actual','missed','unknown']) for(const unit of ['visits','stores']) {
    const result=A.detail(dataset,{}, {metric,unit});
    const field=unit==='visits'?{target:'scheduled',actual:'attended',missed:'missedVisits',unknown:'unknownVisits'}[metric]:{target:'totalStores',actual:'visitedStores',missed:'missedStores',unknown:'unknownStores'}[metric];
    assert.equal(result.total,d.metrics[field]);
  }
  for(const [field,groups] of [['region',d.charts.byRegion],['division',d.charts.byDivision],['lineManager',d.charts.byManager],['date',d.scheduleAnalytics.daily],['week',d.scheduleAnalytics.weekly]]) for(const row of groups) {
    for(const [metric,count] of [['target',row.scheduled],['actual',row.attended],['missed',row.missedVisits]]) assert.equal(A.detail(dataset,{}, {[field]:row.label,metric}).total,count);
  }
});
test('manager hierarchy and combined region, manager, banner and date filters use the same rows',()=>{
  const dataset=fixture();
  assert.equal(A.dashboard(dataset,{manager:'Regional'}).metrics.scheduled,7);
  assert.equal(A.dashboard(dataset,{manager:'Line Two'}).metrics.scheduled,1);
  const filters={manager:'General',region:'Free State',banner:'Banner One',channel:'Wholesale'};
  const d=A.dashboard(dataset,filters), result=A.detail(dataset,filters,{date:'2026-09-02',metric:'missed'});
  assert.equal(d.metrics.scheduled,6);assert.equal(result.total,1);assert.equal(result.rows[0].userCode,'A');
  assert.equal(A.dashboard(dataset,{region:'Nonexistent'}).metrics.scheduled,0);
});
test('merchandisers retain Merchandiser -> Rep -> Line/Channel Manager',()=>{
  const data=A.dashboard(fixture('merchandiser'),{manager:'Regional'});
  const person=data.rows.find(r=>r.userCode==='MA');
  assert.equal(person.userName,'Merch Alex Rep');assert.equal(person.rep,'Alex Rep');assert.equal(person.manager,'Line One');assert.equal(data.metrics.scheduled,7);
});
test('ambiguous hierarchy never invents a reporting line',()=>{
  const h={rows:[...hierarchy.rows,{...hierarchy.rows[0],manager:'Conflict'}]};
  const result=A.resolvePerson(visit(),'rep',A.hierarchyIndex(h));
  assert.equal(result.hierarchyStatus,'ambiguous');assert.equal(result.manager,'Wrong source manager');
});
test('no staff, store, manager or regional truncation; unscheduled staff remain identifiable',()=>{
  const visits=Array.from({length:3200},(_,i)=>visit({userName:`User ${i}`,userCode:`U${i}`,storeCode:`S${i}`,manager:`Manager ${i%40}`}));
  const data=A.dashboard(A.buildDataset({visits,sourceRows:[{userName:'No Plan',userCode:'NONE',manager:'Manager 41',region:'Gauteng'}],hierarchy:{rows:[]},audience:'rep'}));
  assert.equal(data.rows.length,3201);assert.equal(data.stores.length,3200);assert.equal(data.charts.byManager.length,41);
  assert.equal(data.rows.find(r=>r.userCode==='NONE').noSchedule,true);assert.equal(data.metrics.scheduled,3200);
});
test('missing hierarchy staff are reported, not manufactured as attendance rows',()=>{
  const d=A.dashboard(fixture());assert.ok(d.reconciliation.some(r=>r.userName==='Missing Rep'));assert.equal(d.rows.some(r=>r.userName==='Missing Rep'),false);
});
test('Excel contains exactly selected records, full dates, hierarchy and safe text cells',async()=>{
  const dataset=fixture();dataset.rows[0].storeName='=HYPERLINK("https://example.invalid","test")';
  const result=A.detail(dataset,{manager:'Line One'},{metric:'target'});
  const bytes=await A.excel(result,{audience:'rep',filters:{manager:'Line One'},version:'v1'},ExcelJS);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);const sheet=workbook.getWorksheet('Visits');
  assert.equal(sheet.rowCount,result.total+1);assert.equal(sheet.getCell('E2').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('I2').value,'Line One');assert.equal(sheet.getCell('B2').value,'2026-09-01');
  assert.equal(workbook.getWorksheet('Selection').getCell('B2').text,'{"manager":"Line One"}');
});
test('service validates pagination and source version and shares immutable source loading',async()=>{
  const HttpsError=class extends Error{constructor(code,message){super(message);this.code=code;}};
  const source={source:{schedules:{fileId:'F'}},rows:[],reportEndDate:'2026-09-09',updatedByRunId:'R'};
  let loads=0;const db={collection:name=>({doc:()=>({get:async()=>({exists:true,data:()=>name==='files'?{name:'TEST.xlsx',sha256:'hash'}:source})})})};
  const service=A.createService({db,HttpsError,ExcelJS,hierarchy,loadVisits:async()=>{loads++;return [visit(),visit({result:'Not Visited'})];}});
  const d=await service({data:{}});assert.equal(d.metrics.attended,1);
  const oldVersion=require('node:crypto').createHash('sha256').update(JSON.stringify(['attendance-analytics3','F','hash','R',hierarchy.sha256,'rep'])).digest('hex');
  await assert.rejects(service({data:{mode:'detail',version:oldVersion}}),/Attendance has refreshed/);
  const p=await service({data:{mode:'detail',pageSize:1,page:2,version:d.version}});assert.equal(p.rows.length,1);assert.equal(p.total,2);assert.equal(loads,1);
  await assert.rejects(service({data:{mode:'detail',page:0.5}}),/Invalid detail page/);
  await assert.rejects(service({data:{mode:'detail',filters:{forged:'x'}}}),/Invalid attendance filter/);
  source.updatedByRunId='R2';await assert.rejects(service({data:{mode:'export',version:d.version}}),/Attendance has refreshed/);
});
test('Call Cycle preserves leave assignments without adding them to attendance targets',async()=>{
  const HttpsError=class extends Error{};
  const source={source:{schedules:{fileId:'F'}},rows:[],updatedByRunId:'R'};
  const db={collection:name=>({doc:()=>({get:async()=>({exists:true,data:()=>name==='files'?{name:'TEST.xlsx'}:source})})})};
  const service=A.createService({db,HttpsError,ExcelJS,hierarchy,loadVisits:async()=>[visit(),visit({storeCode:'LEAVE',customer:'Leave assignment',result:'On Leave'})]});
  const attendance=await service({data:{mode:'dashboard'}}),cycle=await service({data:{mode:'callcycle'}});
  assert.equal(attendance.metrics.scheduled,1);assert.equal(cycle.stores.length,2);assert.equal(cycle.stores.reduce((s,r)=>s+r.scheduled,0),2);
  assert.ok(cycle.stores.some(r=>r.storeCodes.includes('LEAVE')));
});
test('deployed attendance entry preserves staff auth gate and denies client, disabled and opted-out profiles',async()=>{
  const index=fs.readFileSync(require('node:path').join(process.env.NEXUS_ATTENDANCE_STAGE || '.tmp/attendance-analytics-20260910','deploy/getGeoRepAttendanceDashboard/index.js'),'utf8');
  const guard=index.match(/async function requireAttendanceViewPermission\(request\) \{[^]*?\n\}/)[0];
  assert.match(index,/await requireAttendanceViewPermission\(request\);\n  return attendanceAnalyticsService\(request\);/);
  assert.match(index,/admin-access.*guardCallables/);
  const HttpsError=class extends Error{};let profile={role:'normal',accountType:'staff',permissions:{allowedNavigationIds:['attendance']}};
  const context={HttpsError,requireOperator:r=>{if(!r.auth)throw new Error('Sign in');},requestRole:()=> 'normal',db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>profile})})})}};
  vm.createContext(context);vm.runInContext(guard,context);
  await context.requireAttendanceViewPermission({auth:{uid:'test',token:{}}});
  for(const override of [{disabled:true},{accountType:'client'},{permissions:{allowedNavigationIds:[]}},{chatAccess:{audience:'external'}}]) {
    const before=profile;profile={...profile,...override};await assert.rejects(context.requireAttendanceViewPermission({auth:{uid:'test',token:{}}}));profile=before;
  }
});
module.exports={fixture};
