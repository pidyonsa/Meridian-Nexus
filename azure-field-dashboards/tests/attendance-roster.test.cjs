'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
require('../ui/attendance-roster.js');const R=globalThis.AttendanceRoster;
const row=(userName,userCode,scheduled,attended,manager='Manager')=>({userName,userCode,scheduled,attended,manager,region:'Gauteng',totalStores:3,missedVisits:scheduled-attended,unknownVisits:0,strikeRate:scheduled?attended/scheduled*100:null});
const data={audience:'rep',version:'test-v1',reportStartDate:'2026-09-01',reportEndDate:'2026-09-17',rows:[row('Pat Rep','a',10,8),row('Jo Rep','b',5,0),row('Kay Rep','c',20,20),{...row('No Schedule','d',null,null),noSchedule:true}]};
test('roster sorts lowest progress first, without converting missing schedules into zeros',()=>{
  const rows=R.matchingRows(data);
  assert.deepEqual(rows.map(r=>r.userCode),['b','a','c','d']);
  assert.deepEqual(data.rows.map(r=>r.userCode),['a','b','c','d'],'source order is not mutated');
  const stats=R.summary(rows);assert.equal(stats.count,4);assert.equal(stats.active,2);assert.equal(stats.average,60);
  assert.equal(stats.highest.person,'c');assert.equal(stats.lowest.person,'b');assert.equal(stats.scheduledPeople,3);
});
test('search normalizes name case and whitespace, and empty results have no fabricated ranking',()=>{
  assert.deepEqual(R.matchingRows(data,'  pAT   rep  ').map(r=>r.userCode),['a']);
  assert.equal(R.matchingRows(data,'Manager').length,0,'search is by staff name, not manager');
  const stats=R.summary([]);assert.equal(stats.average,null);assert.equal(stats.highest,undefined);
  assert.doesNotMatch(R.kpis(data,[]),/NaN|Infinity|undefined|0\.0%/);
});
test('multi-manager assignments count as one person and the average is per person, not per assignment',()=>{
  const rows=[row('Pat','a',5,0,'One'),row('Pat','a',5,5,'Two'),row('Jo','b',100,100)];
  const stats=R.summary(rows);assert.equal(stats.count,2);assert.equal(stats.active,2);assert.equal(stats.average,75);
  assert.equal(stats.lowest.strikeRate,50);
});
test('performance-card labels escape untrusted source names',()=>{
  const html=R.kpis(data,[row('<img src=x onerror=alert(1)>','a',1,1)]);
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('Excel exports all matching rows in screen order, with typed percentages and no formulas from source text',async()=>{
  const many={...data,rows:Array.from({length:205},(_,i)=>row(i===0?'=HYPERLINK("bad")':'Rep '+i,'id-'+i,10,i%11))};
  const rows=R.matchingRows(many,'');assert.ok(rows.length>R.pageSize);
  const book=R.workbook(many,rows,'',{region:'Gauteng'},ExcelJS),copy=new ExcelJS.Workbook();await copy.xlsx.load(await book.xlsx.writeBuffer());
  const sheet=copy.getWorksheet('Rep roster');assert.equal(sheet.rowCount,206);
  assert.deepEqual(sheet.getRows(2,205).map(r=>r.getCell(2).value),rows.map(r=>r.userCode));
  assert.equal(sheet.getCell('H2').value,rows[0].strikeRate/100);assert.equal(sheet.getCell('H2').numFmt,'0.0%');
  const malicious=sheet.getRows(2,205).find(r=>r.getCell(1).value==='=HYPERLINK("bad")');assert.equal(malicious.getCell(1).type,ExcelJS.ValueType.String);
  const meta=Object.fromEntries(copy.getWorksheet('Selection').getRows(1,copy.getWorksheet('Selection').rowCount).map(r=>[r.getCell(1).value,r.getCell(2).value]));
  assert.equal(meta.rows,205);assert.equal(meta.version,'test-v1');assert.deepEqual(JSON.parse(meta.filters),{region:'Gauteng'});
});
test('Excel retains missing staff schedules as blanks and includes the merchandiser-to-rep hierarchy',async()=>{
  const merch={...data,audience:'merchandiser',rows:data.rows.map(r=>({...r,rep:'Rep Parent'}))};
  const book=R.workbook(merch,R.matchingRows(merch),'',{},ExcelJS),sheet=book.getWorksheet('Merchandiser roster');
  assert.equal(sheet.getCell('C2').value,'Rep Parent');assert.equal(sheet.getCell('G5').value,null);assert.equal(sheet.getCell('I5').value,null);assert.equal(sheet.getCell('L5').value,'No schedule detail');
});
