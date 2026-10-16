'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const backendRequire=require('node:module').createRequire(path.join(__dirname,'../backend/package.json'));
const ExcelJS=backendRequire('exceljs'),{HttpsError}=backendRequire('firebase-functions/v2/https');
const {createService}=require('../backend/service.cjs');
async function setup(brandHeader){
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Schedules');
  sheet.addRow(['Schedule Date','User','User Code','Manager','Role','Assigned Region(s)','Customer Name','Result']);
  const add=(day,store,result,role='Sales Rep')=>sheet.addRow([`2026-09-${day}`,'Test Person',role==='Sales Rep'?'REP001':'MERCH001','Test Manager',role,'Free State',store,result]);
  add('07','Store A','Early visit on: 2026-09-06');add('08','Store A','Not Visited');add('09','Store B','Caught up on: 2026-09-10');add('10','Store C','Not Visited');add('11','Store D','Pending');
  add('12','Store M','Visited','Merchandiser');add('12','Store P','Visited','P&G Dedicated Rep');
  if(brandHeader){sheet.getCell(1,9).value=brandHeader;for(let i=2;i<=sheet.rowCount;i++)sheet.getCell(i,9).value=i===3?'Test Brand B':'Test Brand A';}
  const bytes=await workbook.xlsx.writeBuffer(),access=[],downloads=[];
  const sources={current:{reportStartDate:'2026-09-01',reportEndDate:'2026-09-13',source:{schedules:{fileId:'verified-workbook'}},rows:[],tracker:{webUrl:'https://private.example'},updatedByRunId:'private-run'},merchandisers:{reportStartDate:'2026-09-01',reportEndDate:'2026-09-13',source:{schedules:{fileId:'verified-workbook'}},rows:[]}};
  const data={geoRepAttendanceDashboard:sources,files:{'verified-workbook':{storagePath:'uploads/test/report.xlsx',name:'Schedules.xlsx'}}};
  const db={collection:name=>({doc:id=>({get:async()=>{access.push(`${name}/${id}`);const value=data[name]?.[id];return {exists:!!value,data:()=>value};}})})};
  const getStorage=()=>({bucket:()=>({file:name=>({download:async({destination})=>{downloads.push(destination);assert.equal(name,'uploads/test/report.xlsx');await fs.writeFile(destination,bytes);}})})});
  return {service:createService({db,getStorage,ExcelJS,HttpsError}),access,downloads,sources,data};
}
test('actual Geo workbook reader reconciles audiences, early/late completions, missed visits and distinct stores',async()=>{
  const {service,downloads}=await setup();
  const data=await service.attendance({audience:'rep'});
  assert.equal(data.metrics.scheduled,5);assert.equal(data.metrics.attended,2);assert.equal(data.metrics.missedVisits,2);assert.equal(data.metrics.unknownVisits,1);
  assert.ok(data.charts.byDivision.some(row=>row.label==='CENTRAL'));
  const actual=await service.attendance({mode:'detail',selection:{metric:'actual'},version:data.version});assert.equal(actual.total,2);
  const missed=await service.attendance({mode:'detail',selection:{metric:'missed',unit:'stores'}});assert.equal(missed.total,1);assert.equal(missed.rows[0].storeName,'Store C');
  const merch=await service.attendance({audience:'merchandiser'});assert.equal(merch.metrics.scheduled,1);assert.equal(merch.metrics.attended,1);
  assert.ok(!JSON.stringify(data).includes('private'));
  assert.ok(data.quality.warnings.some(w=>w.includes('no mapped banners or channels')));
  assert.equal(downloads.length,2,'Each audience is parsed once; repeat views share the source cache');
  for(const file of downloads)await assert.rejects(fs.stat(file),{code:'ENOENT'});
});
test('Excel export uses exactly the selected records and records filters; stale versions are rejected',async()=>{
  const {service}=await setup(),filters={region:'Free State'},selection={metric:'actual'};
  const data=await service.attendance({filters});
  const detail=await service.attendance({mode:'detail',filters,selection,version:data.version});
  const exported=await service.attendance({mode:'export',filters,selection,version:data.version});
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.base64,'base64'));
  assert.equal(workbook.getWorksheet('Visits').rowCount-1,detail.total);assert.equal(exported.total,detail.total);
  const metadata=Object.fromEntries(workbook.getWorksheet('Selection').getSheetValues().filter(Boolean).map(row=>[row[1],row[2]]));
  assert.deepEqual(JSON.parse(metadata.filters),filters);assert.deepEqual(JSON.parse(metadata.selection),selection);
  await assert.rejects(service.attendance({mode:'export',version:'stale'}),{code:'failed-precondition'});
});
test('unsupported attendance audiences, query modes and filters fail before reading any data',async()=>{
  const {service,access}=await setup();
  for(const input of [{audience:'dedicated'},{mode:'callcycle'},{mode:'upload'},{filters:{collection:'adminUsers'}},{selection:{metric:7}}])await assert.rejects(service.attendance(input),{code:'invalid-argument'});
  assert.equal(access.length,0);
});

test('public Azure/Firebase viewer applies fresh admin exclusions to cached datasets, details and exports',async()=>{
  const {service,data,downloads}=await setup();const before=await service.attendance({});
  data.geoRepAttendanceConfig={current:{dashboardExclusions:{revision:1,entries:[{name:'Test Person',audience:'rep'}]}}};
  const after=await service.attendance({});assert.equal(after.metrics.scheduled,0);assert.equal(after.rows.length,0);assert.notEqual(after.version,before.version);
  assert.equal((await service.attendance({mode:'detail'})).total,0);
  assert.equal((await service.attendance({mode:'export'})).total,0);
  await assert.rejects(service.attendance({mode:'export',version:before.version}),{code:'failed-precondition'});
  assert.equal(downloads.length,1,'Policy changes do not reload the workbook');
  assert.equal((await service.attendance({audience:'merchandiser'})).metrics.scheduled,1);
});
test('attendance preserves optional Brands without inferring brand assignments from transaction data',async()=>{
  const {service}=await setup('Brands'),filters={brand:'Test Brand A'};
  const all=await service.attendance({});assert.deepEqual(all.availableFilters.brands,['Test Brand A','Test Brand B']);
  const data=await service.attendance({filters}),detail=await service.attendance({mode:'detail',filters});
  assert.equal(data.metrics.scheduled,4);assert.equal(detail.total,4);assert.ok(detail.rows.every(r=>r.brand==='Test Brand A'));
  assert.equal(data.quality.strikeRateTotals,null);
  const exported=await service.attendance({mode:'export',filters}),book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.base64,'base64'));
  assert.equal(book.getWorksheet('Visits').getRow(1).values.at(-1),'Brand');assert.equal(book.getWorksheet('Visits').getRow(2).values.at(-1),'Test Brand A');
  const absent=await setup();assert.deepEqual((await absent.service.attendance({})).availableFilters.brands,[]);
});
test('public attendance cannot list or mutate exclusions for either audience',async()=>{
  const {service,access,downloads}=await setup();
  for(const audience of ['rep','merchandiser'])for(const mode of ['exclusions','commit','remove','setEnabled','import']){
    await assert.rejects(service.attendance({audience,mode}),{code:'invalid-argument'});
  }
  assert.equal(access.length,0);assert.equal(downloads.length,0);
});
