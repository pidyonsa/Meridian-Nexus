'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
require('../ui/attendance-stores.js');const S=globalThis.AttendanceStores;
const row=(storeName,storeId,attended=0,unknownVisits=0)=>({storeName,storeId,attended,unknownVisits,scheduled:4,missedVisits:4-attended-unknownVisits,resources:['Pat Rep','Jo Rep'],reps:['Parent Rep'],region:'Gauteng',managers:['Manager A','Manager B'],storeCodes:[storeId],banners:[]});
const data={audience:'rep',version:'v1',reportStartDate:'2026-09-01',reportEndDate:'2026-09-17',availableFilters:{banners:[]},stores:[row('Visited store','v',2,1),row('Awaiting store','u',0,1),row('Missed store','m'),row('Another missed store','a')]};
test('distinct store cards reconcile without treating missed visits as missed stores',()=>{
  assert.deepEqual(S.summary(data.stores),{total:4,visited:1,missed:2,unknown:1,missedPercent:50});
  assert.equal(S.status(data.stores[0]),'visited','A positive visit wins over outstanding or unverified visits');
  assert.deepEqual(S.matchingRows(data).map(r=>r.storeId),['a','m','u','v']);
  assert.deepEqual(data.stores.map(r=>r.storeId),['v','u','m','a']);
});
test('search and status intersect, normalize whitespace, and match assigned staff or store codes',()=>{
  assert.equal(S.matchingRows(data,' pat   REP ').length,4);
  assert.equal(S.matchingRows(data,'parent rep','missed').length,2);
  assert.deepEqual(S.matchingRows(data,'awaiting','unknown').map(r=>r.storeId),['u']);
  assert.equal(S.matchingRows(data,'awaiting','missed').length,0);
  assert.equal(S.matchingRows(data,'Manager A').length,0);
  const empty=S.summary([]);assert.equal(empty.missedPercent,null);assert.doesNotMatch(S.kpis([],'all'),/NaN|Infinity|undefined|0\.0%/);
});
test('banner is only available when it exists in the source; placeholders do not create a column',()=>{
  assert.equal(S.hasBanner(data),false);
  assert.equal(S.hasBanner({...data,availableFilters:{banners:['-','Not set','Unassigned']}}),false);
  assert.equal(S.hasBanner({...data,stores:[{...data.stores[0],banners:['Clicks']}]}),true);
  assert.equal(S.hasBanner({...data,stores:[],availableFilters:{banners:['Clicks']}}),true);
});
test('Excel contains all matching stores beyond one page, literal source text, and metadata',async()=>{
  const many={...data,stores:Array.from({length:205},(_,i)=>row(i===0?'=HYPERLINK("unsafe")':'Store '+i,'id-'+i,i%3===0?1:0))};
  const rows=S.matchingRows(many),book=S.workbook(many,rows,'','all',{manager:'Manager A'},ExcelJS),copy=new ExcelJS.Workbook();
  await copy.xlsx.load(await book.xlsx.writeBuffer());const sheet=copy.getWorksheet('Attendance by store');
  assert.equal(sheet.rowCount,206);assert.ok(rows.length>S.pageSize);
  const idColumn=sheet.getRow(1).values.indexOf('Store ID');
  assert.deepEqual(sheet.getRows(2,205).map(r=>r.getCell(idColumn).value),rows.map(r=>r.storeId));
  assert.equal(sheet.getCell('H2').type,ExcelJS.ValueType.Number);
  const text=sheet.getRows(2,205).find(r=>r.getCell(2).value==='=HYPERLINK("unsafe")');assert.equal(text.getCell(2).type,ExcelJS.ValueType.String);
  const meta=Object.fromEntries(copy.getWorksheet('Selection').getRows(1,copy.getWorksheet('Selection').rowCount).map(r=>[r.getCell(1).value,r.getCell(2).value]));
  assert.equal(meta.rows,205);assert.equal(meta.version,'v1');assert.deepEqual(JSON.parse(meta.filters),{manager:'Manager A'});
});
test('Excel respects missed-only search, and keeps merchandiser, rep, manager and source banner',()=>{
  const merch={...data,audience:'merchandiser',availableFilters:{banners:['Clicks']},stores:data.stores.map(r=>({...r,banners:['Clicks']}))};
  const rows=S.matchingRows(merch,'missed','missed'),sheet=S.workbook(merch,rows,'missed','missed',{},ExcelJS).worksheets[0];
  const headers=sheet.getRow(1).values.slice(1);
  assert.equal(sheet.rowCount,3);assert.ok(headers.includes('Merchandiser'));assert.ok(headers.includes('Rep'));assert.ok(headers.includes('Banner'));
  assert.equal(sheet.getCell('E2').value,'Parent Rep');assert.equal(sheet.getCell('H2').value,'Manager A, Manager B');
  assert.ok(sheet.getRows(2,2).every(r=>r.getCell(1).value==='Missed'));
});
test('missed dates show on the store table and in Excel so managers know which days were missed',async()=>{
  const dated={...data,stores:[{...row('Missed store','m'),dates:['2026-09-03','2026-09-01','2026-09-08'],missedDates:['2026-09-08','2026-09-01']},{...row('Busy store','b'),missedDates:['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05','2026-09-06']},row('Visited store','v',4)]};
  const h={table:(headers,rows)=>`<table><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`,link:v=>String(v)};
  const book=S.workbook(dated,S.matchingRows(dated),'','all',{},ExcelJS),sheet=book.worksheets[0],headers=sheet.getRow(1).values.slice(1);
  const missed=headers.indexOf('Missed dates')+1,scheduled=headers.indexOf('Scheduled dates')+1;
  assert.ok(missed>0&&scheduled>0);
  const byStore=Object.fromEntries(sheet.getRows(2,3).map(r=>[r.getCell(2).value,r]));
  assert.equal(byStore['Missed store'].getCell(missed).value,'Tue 01 Sep 2026, Tue 08 Sep 2026');
  assert.equal(byStore['Missed store'].getCell(scheduled).value,'Tue 01 Sep 2026, Thu 03 Sep 2026, Tue 08 Sep 2026');
  assert.equal(byStore['Visited store'].getCell(missed).value,'');
  const cells=S.tableHtml(dated,S.matchingRows(dated),h);
  assert.match(cells,/<th>Missed dates<\/th>/);
  assert.match(cells,/Tue 01 Sep<\/span>, <span>Tue 08 Sep/);
  assert.match(cells,/\+2 more/);
});
test('engine records the scheduled dates of missed visits per store',()=>{
  const A=require('../server/report-engine/vendor/attendance.cjs');
  const visits=[['2026-09-01','Not visited'],['2026-09-02','Visited'],['2026-09-03','Not visited'],['2026-09-04','On leave']].map(([date,result],i)=>({id:'r'+i,date,result,storeCode:'S1',storeName:'Store 1',userName:'Pat',region:'Gauteng'}));
  const set=A.buildDataset({visits,hierarchy:{rows:[]},audience:'rep',version:'v'});
  const [store]=A.dashboard(set).stores;
  assert.deepEqual(store.missedDates,['2026-09-01','2026-09-03']);
  assert.deepEqual(store.dates,['2026-09-01','2026-09-02','2026-09-03']);
});
