'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), zlib = require('node:zlib');
const ExcelJS = require('exceljs');
const {createAzureReports, blobReader, ReportError} = require('../server/azure-reports.cjs');
const {adapters, validate, hash} = require('../server/snapshot-data.cjs');
const {createService} = require('../../firebase-dashboards/backend/service.cjs');
async function fixture() {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Schedules');
  sheet.addRow(['Schedule Date','User','User Code','Manager','Role','Assigned Region(s)','Customer Name','Result']);
  sheet.addRow(['2026-09-20','Synthetic Rep','R1','Synthetic Manager','Sales Rep','Free State','Synthetic Store','Visited']);
  sheet.addRow(['2026-09-21','Synthetic Rep','R1','Synthetic Manager','Sales Rep','Free State','Synthetic Other Store','Not Visited']);
  sheet.addRow(['2026-09-20','Synthetic Merch','M1','Synthetic Rep','Merchandiser','Free State','Synthetic Store','Caught up on: 2026-09-21']);
  sheet.addRow(['2026-09-20','Excluded Rep','R2','Synthetic Manager','Sales Rep','Free State','Excluded Store','Visited']);
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  const version = 'a'.repeat(64), documents = {};
  for (const id of ['current','merchandisers']) documents['geoRepAttendanceDashboard/' + id] = {reportStartDate:'2026-09-01',reportEndDate:'2026-09-21',updatedAt:'2026-09-21T04:00:00Z',source:{schedules:{fileId:'fixture'}},rows:[{userName:id === 'current' ? 'Synthetic Rep' : 'Synthetic Merch',userCode:id === 'current' ? 'R1' : 'M1',manager:'Synthetic Manager',region:'Free State',scheduled:2,onSchedule:1}]};
  documents['files/fixture'] = {name:'fixture.xlsx',storagePath:'uploads/fixture.xlsx',sha256:hash(bytes)};
  documents['geoRepAttendanceConfig/current'] = {dashboardExclusions:{revision:3,entries:[{name:'Excluded Rep',audience:'rep'}]}};
  documents['publicDashboardSources/orders'] = {version,period:'2026-09',rowCount:2,importedAt:'2026-09-21T04:00:00Z',range:{startDate:'2026-09-01',endDate:'2026-09-20'}};
  documents['publicDashboardOrderImports/' + version + '/chunks/0001'] = {rows:[
    {id:'line1',orderDate:'2026-09-20',orderNumber:'S1',storeName:'Synthetic Store',product:'Synthetic Product',quantity:4,value:0,region:'Free State',rep:'Synthetic Rep',status:'Ordered',importedAt:'2026-09-21T04:00:00Z'},
    {id:'line2',orderDate:'2026-09-20',orderNumber:'S2',storeName:'Synthetic Store',product:'Synthetic Product',quantity:2,value:12.34,region:'Free State',rep:'Synthetic Rep',status:'Cancelled',importedAt:'2026-09-21T04:00:00Z'}
  ]};
  const snapshot = {schema:1,capturedAt:'2026-09-21T05:00:00Z',documents,files:{'uploads/fixture.xlsx':{size:bytes.length,sha256:hash(bytes),base64:bytes.toString('base64')}}};
  return snapshot;
}
function encode(snapshot) {
  const bytes = zlib.gzipSync(JSON.stringify(snapshot)), sha256 = hash(bytes);
  const pointer = {schema:1,blob:'snapshots/' + sha256 + '.json.gz',sha256,bytes:bytes.length,capturedAt:snapshot.capturedAt,attendanceThrough:'2026-09-21',ordersImportedAt:'2026-09-21T04:00:00Z'};
  return {bytes,pointer,readBlob:async name => name === 'current.json' ? Buffer.from(JSON.stringify(pointer)) : bytes};
}
test('Azure snapshots preserve original engine results for both audiences, exclusions, dates, details and orders', async() => {
  const snapshot = await fixture(), bundle = encode(snapshot);
  const service = createService({...adapters(snapshot),ExcelJS,HttpsError:ReportError});
  const provider = createAzureReports({readBlob:bundle.readBlob,serviceFactory:createService,ExcelJS});
  for (const audience of ['rep','merchandiser']) {
    for (const input of [{audience},{audience,filters:{date:'2026-09-20'}},{audience,mode:'detail',selection:{metric:'actual'}},{audience,mode:'detail',selection:{metric:'missed',unit:'stores'}}]) {
      const expected = await service.attendance(input), actual = await provider.request('/api/attendance',input);
      assert.equal(actual.status,200);
      const {dataHosting,...data} = actual.data; assert.equal(dataHosting.provider,'Azure');assert.deepEqual(data,expected);
    }
    const overview = await provider.request('/api/attendance',{audience});
    const exported = await provider.request('/api/attendance',{audience,mode:'export',version:overview.data.version});
    assert.equal(exported.status,200);
    const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.data.base64,'base64'));
    assert.equal(workbook.getWorksheet('Visits').rowCount-1,overview.data.metrics.scheduled);
    assert.equal((await provider.request('/api/attendance',{audience,mode:'export',version:'old'})).status,409);
  }
  assert.equal((await provider.request('/api/attendance')).data.metrics.scheduled,2);
  for (const input of [{},{includeCancelled:true},{export:true},{filters:{region:'Free State'}},{start:'2025-10-01',end:'2026-09-30',granularity:'month'}]) {
    const expected = await service.orders(input), actual = await provider.request('/api/orders',input);
    assert.equal(actual.status,200);const {dataHosting,...data} = actual.data;
    expected.source = expected.source.replace('isolated Firebase viewer import','verified import hosted on Azure');
    assert.deepEqual(data,expected);
  }
  assert.equal((await provider.request('/api/orders')).data.totals.amount,0);
  assert.equal((await provider.request('/api/orders')).data.totals.orders,1);
});
test('rejects tampered workbooks, incomplete imports and unrelated collections', async() => {
  const snapshot = await fixture();
  let copy = structuredClone(snapshot);copy.files['uploads/fixture.xlsx'].sha256='0'.repeat(64);assert.throws(()=>validate(copy),/checksum/);
  copy=structuredClone(snapshot);copy.documents['publicDashboardSources/orders'].rowCount=3;assert.throws(()=>validate(copy),/chunks/);
  copy=structuredClone(snapshot);copy.documents['adminUsers/private']={};assert.throws(()=>validate(copy),/Unsupported/);
});
test('coalesces snapshot loading; preserves a verified generation on failed refresh; rejects initial corruption', async() => {
  const bundle=encode(await fixture());let calls=0,fail=false;
  const provider=createAzureReports({readBlob:async name=>{calls++;if(fail)throw Error('Private storage failure');return bundle.readBlob(name);},serviceFactory:createService,ExcelJS});
  const first=provider.request('/api/health'),second=provider.request('/api/health');
  assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(calls,2);
  fail=true;const retained=await provider.request('/api/orders',{refresh:true});assert.equal(retained.status,200);assert.equal(retained.data.dataHosting.refreshFailed,true);
  const broken=createAzureReports({readBlob:async()=>Buffer.from('{}')});
  const rejected=await broken.request('/api/orders');assert.equal(rejected.status,503);assert.doesNotMatch(rejected.data.error,/Private|checksum|blob/);
});
test('managed identity access is bounded to private blobs and never follows external URLs', async() => {
  const requests=[];
  const read=blobReader({containerUrl:'https://synthetic.blob.core.windows.net/dashboard-data/',env:{IDENTITY_ENDPOINT:'http://127.0.0.1/token',IDENTITY_HEADER:'synthetic-only'},fetchImpl:async(url,options)=>{
    requests.push([String(url),options]);
    return String(url).startsWith('http:') ? new Response(JSON.stringify({access_token:'synthetic-token',expires_on:String(Math.floor(Date.now()/1000)+3600)})) : new Response('{}');
  }});
  await read('current.json');await read('current.json');assert.equal(requests.length,3);
  assert.equal(requests[1][1].headers.Authorization,'Bearer synthetic-token');assert.equal(requests[1][1].redirect,'error');
  await assert.rejects(read('../private.xlsx'),/Unsupported/);
  await assert.rejects(read('https://example.com'),/Unsupported/);
  assert.throws(()=>blobReader({containerUrl:'https://example.com/dashboard-data/'}),/private Azure/);
});
