'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), zlib = require('node:zlib');
const {publish, checkSources, mergeAttendance, unpackSnapshot} = require('../attendance-publisher/core.cjs');
const {hash} = require('../server/snapshot-data.cjs');
const now = () => new Date('2026-09-22T08:00:00Z');
function fixture() {
  const documents = {}, version = 'a'.repeat(64), bytes = Buffer.from('synthetic workbook');
  for (const id of ['current','merchandisers']) documents['geoRepAttendanceDashboard/' + id] = {
    reportStartDate:'2026-09-01',reportEndDate:'2026-09-20',rows:[{userCode:'synthetic'}],source:{schedules:{fileId:'old'}}
  };
  documents['files/old'] = {storagePath:'uploads/old.xlsx'};
  documents['publicDashboardSources/orders'] = {version, rowCount:1};
  documents['publicDashboardOrderImports/' + version + '/chunks/1'] = {rows:[{quantity:2,value:0}]};
  documents['salesTransactions/unchanged'] = {value:3};
  const file = {size:bytes.length,sha256:hash(bytes),base64:bytes.toString('base64')};
  const baseline = {schema:1,capturedAt:'2026-09-21T12:00:00Z',documents,files:{'uploads/old.xlsx':file}};
  const source = {documents:{},versions:{source:'v2'},files:{'uploads/new.xlsx':file}};
  for (const id of ['current','merchandisers']) source.documents['geoRepAttendanceDashboard/' + id] = {
    ...structuredClone(documents['geoRepAttendanceDashboard/' + id]),reportEndDate:'2026-09-21',source:{schedules:{fileId:'new'}}
  };
  source.documents['files/new'] = {storagePath:'uploads/new.xlsx'};
  source.documents['geoRepAttendanceConfig/current'] = {dashboardExclusions:{revision:4}};
  return {baseline,source};
}
function harness() {
  const {baseline,source} = fixture(), bytes = zlib.gzipSync(JSON.stringify(baseline)), sha256 = hash(bytes);
  const pointer = {schema:1,blob:'snapshots/'+sha256+'.json.gz',sha256,bytes:bytes.length,capturedAt:baseline.capturedAt,ordersImportedAt:'preserve'};
  const stored = new Map([[pointer.blob,bytes],['current.json',Buffer.from(JSON.stringify(pointer))]]), writes=[];
  let etag='initial', failVerify=false, conflict=false;
  const dependencies = {
    now, source:{load:async()=>structuredClone(source),workbooks:async()=>source.files,verify:async()=>{if(failVerify)throw Error('Source changed');}},
    verifyReports:async()=>({rep:{scheduled:1},merchandiser:{scheduled:1}}),
    blobs:{read:async name=>({bytes:stored.get(name),etag}),write:async(name,data,condition)=>{
      if (name==='current.json') {if(conflict||condition['If-Match']!==etag)throw Error('412 conflict');etag='next';}
      else assert.equal(condition['If-None-Match'],'*');
      writes.push(name);stored.set(name,data);
    }}
  };
  return {baseline,source,pointer,stored,writes,dependencies,setFailure:()=>{failVerify=true;},setConflict:()=>{conflict=true;}};
}
test('updates both attendance audiences without changing Orders, and drops superseded attendance workbooks',()=>{
  const {baseline,source}=fixture(), next=mergeAttendance(baseline,source,now());
  assert.equal(next.documents['geoRepAttendanceDashboard/merchandisers'].reportEndDate,'2026-09-21');
  for(const [key,value]of Object.entries(baseline.documents))if(/^(publicDashboard|salesTransactions)/.test(key))assert.deepEqual(next.documents[key],value);
  assert.equal(next.files['uploads/old.xlsx'],undefined);assert.ok(next.files['uploads/new.xlsx']);
  assert.equal(next.documents['geoRepAttendanceConfig/current'].dashboardExclusions.revision,4);
  assert.equal(baseline.documents['geoRepAttendanceDashboard/current'].reportEndDate,'2026-09-20');
});
test('rejects mismatched dates, incomplete audiences, future dates and backwards imports',()=>{
  const {baseline,source}=fixture();
  source.documents['geoRepAttendanceDashboard/merchandisers'].reportEndDate='2026-09-20';assert.throws(()=>checkSources(source,now()),/different imports/);
  source.documents['geoRepAttendanceDashboard/merchandisers'].rows=[];assert.throws(()=>checkSources(source,now()),/Incomplete/);
  const f=fixture();for(const report of Object.values(f.source.documents).filter(d=>d.reportEndDate))report.reportEndDate='2026-09-22';
  assert.throws(()=>checkSources(f.source,now()),/Incomplete/);
  for(const report of Object.values(f.source.documents).filter(d=>d.reportEndDate))report.reportEndDate='2026-09-19';
  assert.throws(()=>mergeAttendance(baseline,f.source,now()),/backwards/);
});
test('publishes an immutable verified blob then conditionally switches the pointer; repeated checks do not write',async()=>{
  const h=harness(), result=await publish(h.dependencies);
  assert.equal(result.status,'published');assert.equal(h.writes.length,2);assert.equal(h.writes[1],'current.json');
  const pointer=JSON.parse(h.stored.get('current.json'));assert.equal(pointer.ordersImportedAt,'preserve');
  assert.equal(pointer.attendanceThrough,'2026-09-21');assert.ok(unpackSnapshot(pointer,h.stored.get(pointer.blob)));
  assert.equal((await publish(h.dependencies)).status,'unchanged');assert.equal(h.writes.length,2);
});
test('changed sources, failed reconciliation and competing publishers never replace the live pointer',async()=>{
  for(const failure of ['source','report','conflict']){
    const h=harness(), before=h.stored.get('current.json');
    if(failure==='source')h.setFailure();else if(failure==='report')h.dependencies.verifyReports=async()=>{throw Error('Invalid report');};else h.setConflict();
    await assert.rejects(publish(h.dependencies));assert.deepEqual(h.stored.get('current.json'),before);
  }
});
test('corrupted baseline and read-back cannot be promoted',async()=>{
  let h=harness();h.stored.set(h.pointer.blob,Buffer.from('corrupt'));await assert.rejects(publish(h.dependencies),/checksum/);assert.equal(h.writes.length,0);
  h=harness();const read=h.dependencies.blobs.read;h.dependencies.blobs.read=async name=>h.writes.includes(name)?{bytes:Buffer.from('corrupt')}:read(name);
  await assert.rejects(publish(h.dependencies),/read-back/);assert.equal(h.writes.includes('current.json'),false);
});
test('attendance workbook names accept one-day and multi-day ranges only', () => {
  const {ATTENDANCE_WORKBOOK} = require('../attendance-publisher/index.cjs');
  assert.ok(ATTENDANCE_WORKBOOK.test('uploads/a1/Geo_Rep_Strike_Rate_Report_2026-10-01.xlsx'));
  assert.ok(ATTENDANCE_WORKBOOK.test('uploads/a1/Geo_Rep_Strike_Rate_Report_2026-09-01_to_2026-09-30.xlsx'));
  assert.ok(!ATTENDANCE_WORKBOOK.test('uploads/a1/Geo_Rep_Transaction_Report_2026-10-01.xlsx'));
  assert.ok(!ATTENDANCE_WORKBOOK.test('uploads/a1/b/Geo_Rep_Strike_Rate_Report_2026-10-01.xlsx'));
  assert.ok(!ATTENDANCE_WORKBOOK.test('uploads/a1/Geo_Rep_Strike_Rate_Report_2026-10-01_to_.xlsx'));
});
