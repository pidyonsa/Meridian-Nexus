'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const fs=require('node:fs');
const path=require('node:path');
const {seed}=require('./fixtures.cjs');
const {MemoryStore,AzureStore,chunks}=require('../server/store.cjs');
const {service,fields}=require('../server/analytics.cjs');
const {parseAttendance,operationalWeek}=require('../server/imports.cjs');
const {principal,previewAllowed}=require('../server/auth.cjs');
const {orderRows,GeoClient,syncOrders}=require('../server/geo.cjs');
const {filenameDate,latestFiles}=require('../server/sync.cjs');
const A=require('../server/domain/attendance.cjs');
const {appFor}=require('../server/main.cjs');
async function fixture(){const store=new MemoryStore();await seed(store);return {store,api:service(store)};}
test('positive early/caught-up visits, excluded leave, and distinct missed stores reconcile',()=>{
  const statuses=['Visited','Not Visited','Caught up on: 2026-09-03','Early visit on: 2026-08-31','On leave','Unclear'];
  const dataset=A.buildDataset({audience:'rep',hierarchy:{rows:[]},version:'test',visits:statuses.map((result,i)=>({id:String(i),userName:'Rep',region:'Free State',storeCode:i===1?'S0':`S${i}`,result,date:'2026-09-01'}))});
  const summary=A.dashboard(dataset),actual=A.detail(dataset,{}, {metric:'actual'}),missed=A.detail(dataset,{}, {metric:'missed',unit:'stores'});
  assert.equal(summary.metrics.scheduled,5);assert.equal(summary.metrics.attended,3);assert.equal(actual.total,3);assert.equal(missed.total,0);assert.equal(summary.metrics.unknownVisits,1);
  assert.equal(A.division('North West','Inland'),'CENTRAL');assert.equal(A.division('Free State'),'CENTRAL');
  assert.equal(A.resultStatus('Early visit on: 2026-02-30'),'unknown');
});
test('filtered attendance details and Excel contain the same selection',async()=>{
  const {api}=await fixture();const query={audience:'merchandiser',filters:{manager:'Test Manager 1'}};
  const summary=await api.attendance(query),detail=await api.attendance({...query,mode:'detail',selection:{metric:'actual'},version:summary.version});
  assert.equal(summary.metrics.attended,detail.total);assert.ok(detail.rows.every(r=>r.manager==='Test Manager 1'));
  const exported=await api.attendance({...query,mode:'export',selection:{metric:'actual'},version:summary.version});
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.base64,'base64'));assert.equal(workbook.worksheets[0].rowCount-1,detail.total);
});
test('attendance export refuses stale data or hierarchy versions',async()=>{
  const {api,store}=await fixture(),summary=await api.attendance({});
  await store.publish('hierarchy','2000-01',[{name:'Changed',manager:'Changed'}]);
  await assert.rejects(api.attendance({mode:'export',version:summary.version}),/refreshed/);
});
test('attendance rejects unsupported audience, modules, ranges and filters',async()=>{
  const {api}=await fixture();for(const query of [{audience:'dedicated'},{mode:'callcycle'},{filters:[]},{period:'2026-99'}])await assert.rejects(api.attendance(query));
  assert.throws(()=>fields({permission:'admin'}));
});
test('orders reconcile cards, daily graph points, filtered lines and cancellations',async()=>{
  const {api}=await fixture(),data=await api.orders({});
  const all=await api.orders({export:true});assert.equal(data.totals.lines,all.table.rows.length);
  assert.equal(data.trend.reduce((n,p)=>n+p.amount,0),data.totals.amount);
  for(const bucket of data.trend){const detail=await api.orders({start:bucket.start,end:bucket.end});assert.equal(detail.totals.amount,bucket.amount);assert.equal(detail.totals.lines,bucket.lines);}
  assert.ok(all.table.rows.every(r=>!r.cancelled));assert.ok((await api.orders({includeCancelled:true})).totals.lines>data.totals.lines);
});
test('amounts retain recorded zero, unknown values and unknown currencies',()=>{
  const epod={epod_id:'1',status:'Processed',order_date:'2026-09-01',location_id:'STORE'},users=new Map();
  const [zero]=orderRows(epod,{products:[{qty:2,price:3,total:0}]},users,'2026-09');assert.equal(zero.value,0);
  const [unknown]=orderRows(epod,{products:[{product_name:'Unknown amount'}]},users,'2026-09');assert.equal(unknown.value,null);assert.equal(unknown.quantity,null);assert.equal(unknown.currency,'');
  assert.throws(()=>orderRows({...epod,order_date:''},{products:[{}]},users,'2026-09'),/order date/i);
});
test('API pagination failure or repeated pages fails closed',async()=>{
  const client=new GeoClient({GEO_REP_OPEN_API_ID:'test',GEO_REP_OPEN_API_KEY:'test'});
  client.get=async()=>({total_pages:2,epods:[{epod_id:'repeated'}]});await assert.rejects(client.all('test','epods'),/repeated page/);
  client.get=async()=>({epods:[]});await assert.rejects(client.all('test','epods'),/pagination/);
});
test('a failed EPOD detail request does not replace a good snapshot',async()=>{
  const {store}=await fixture(),previous=await store.read('orders','2026-09');
  const client={all:async(path)=>path.includes('users')?[]:[{epod_id:'one'},{epod_id:'two'}],get:async()=>{throw Error('API failure');}};
  await assert.rejects(syncOrders(store,client,'2026-09'));assert.equal((await store.read('orders','2026-09')).version,previous.version);
});
test('staff role and tenant are checked, not just a logged-in Microsoft account',()=>{
  assert.throws(()=>principal({tid:'other',oid:'x',roles:['Nexus.Admin']},'meridian'));
  assert.throws(()=>principal({tid:'meridian',oid:'x',roles:['authenticated']},'meridian'));
  assert.equal(principal({tid:'meridian',oid:'x',roles:['Nexus.Reader']},'meridian').admin,false);
  assert.equal(principal({tid:'meridian',oid:'x',roles:['Nexus.Admin']},'meridian').admin,true);
});
test('preview authentication cannot be enabled in Azure or production',()=>{
  const local={NODE_ENV:'development',NEXUS_PREVIEW:'true'};assert.equal(previewAllowed(local),true);
  assert.equal(previewAllowed({...local,NODE_ENV:'production'}),false);assert.equal(previewAllowed({...local,WEBSITE_INSTANCE_ID:'azure'}),false);
});
test('HTTP requests without real auth cannot read Azure-edition data or spoof a principal header',async t=>{
  const {store}=await fixture(),app=appFor(store,{NODE_ENV:'production',ENTRA_TENANT_ID:'tenant',ENTRA_CLIENT_ID:'client',PUBLIC_ORIGIN:'https://nexus.example'});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/session`,{headers:{'x-ms-client-principal':'fake','x-ms-client-principal-id':'admin'}});
  assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('XLSX import uses individual schedule results and does not manufacture attendance from totals',async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Schedules');
  sheet.addRow(['Schedule Date','Rep Name','Customer Name','Role','Result','Region']);sheet.addRow(['2026-09-01','Test Rep','Store','Sales Rep','Early visit on: 2026-08-31','Free State']);
  const result=await parseAttendance(Buffer.from(await workbook.xlsx.writeBuffer()),'rep','2026-09');assert.equal(result.rows.length,1);assert.equal(A.resultStatus(result.rows[0].result),'visited');
  sheet.getCell('A2').value='09/01/26';await assert.rejects(parseAttendance(Buffer.from(await workbook.xlsx.writeBuffer()),'rep','2026-09'),/dates could not be parsed/);
});
test('latest report is selected by export timestamp, including hundreds of older files',()=>{
  const old=Array.from({length:500},(_,i)=>({name:`inbox/attendance/rep/2026-09/Schedules-20260912083000-${i}.xlsx`}));
  const latest={name:'inbox/attendance/rep/2026-09/Schedules-20260913083000.xlsx'};
  // Older duplicate timestamps do not make a unique later snapshot ambiguous.
  const selected=latestFiles([latest,...old],Date.parse('2026-09-13T10:00:00Z'));assert.equal(selected[0].name,latest.name);
  assert.equal(latestFiles([...old,latest],Date.parse('2026-09-13T10:00:00Z'))[0].name,latest.name);
  assert.equal(filenameDate('Schedules-2026-02-30T083000.xlsx'),null);assert.equal(filenameDate('~$Schedules-20260913083000.xlsx'),null);
  assert.throws(()=>latestFiles([latest,{name:latest.name.replace('Schedules','Copy')}],Date.parse('2026-09-13T10:00:00Z')),/same latest/);
});
test('Geo operational weeks retain the existing four-week anchor, not calendar week-of-month',()=>{
  assert.equal(operationalWeek('2026-04-27'),'Week 2');assert.equal(operationalWeek('2026-05-04'),'Week 3');assert.equal(operationalWeek('2026-05-11'),'Week 4');assert.equal(operationalWeek('2026-05-18'),'Week 1');
});
test('Azure snapshot publication leaves the old manifest visible if any chunk fails',async()=>{
  const store=Object.create(AzureStore.prototype),old={id:'current-2026-09',version:'old',_etag:'etag1',rows:[{id:'good'}]};
  let switched=false,created=0,archived=false;
  store.cache=new Map();store.blobs={getBlockBlobClient:()=>({uploadData:async()=>{archived=true;}})};
  store.container={item:()=>({read:async()=>({resource:old}),replace:async()=>{switched=true;}}),items:{create:async()=>{created++;if(created===2)throw Error('Simulated write failure');}}};
  await assert.rejects(store.publish('orders','2026-09',Array.from({length:400},()=>({text:'x'.repeat(1000)}))),/write failure/);
  assert.equal(archived,true);assert.equal(switched,false);assert.equal(old.version,'old');
});
test('Azure snapshot switch uses the previous ETag and happens after all row writes',async()=>{
  const store=Object.create(AzureStore.prototype);let created=0,switched=false;
  store.cache=new Map();store.blobs={getBlockBlobClient:()=>({uploadData:async()=>{}})};
  store.container={item:()=>({read:async()=>({resource:{_etag:'expected'}}),replace:async(value,options)=>{assert.ok(created>0);assert.equal(options.accessCondition.condition,'expected');switched=true;}}),items:{create:async()=>{created++;}}};
  await store.publish('orders','2026-09',[{id:'one'}]);assert.equal(switched,true);
});
test('empty imports never erase a published report',async()=>{const {store}=await fixture(),old=await store.read('orders','2026-09');await assert.rejects(store.publish('orders','2026-09',[]));assert.equal((await store.read('orders','2026-09')).version,old.version);});
test('chunk payloads stay below Cosmos item limits; oversized rows rejected',()=>{
  const parts=chunks(Array.from({length:1000},()=>({text:'x'.repeat(1000)})));assert.ok(parts.length>1);assert.ok(parts.every(p=>Buffer.byteLength(JSON.stringify(p))<200000));assert.throws(()=>chunks([{text:'x'.repeat(200000)}]));
});
test('runtime has no obsolete modules, cloud SDK or URL dependencies',()=>{
  for(const dir of ['public','server'])for(const file of fs.readdirSync(path.join(__dirname,'..',dir),{recursive:true}).filter(f=>/\.(js|cjs|css|html)$/.test(f))){
    const content=fs.readFileSync(path.join(__dirname,'..',dir,file),'utf8');assert.doesNotMatch(content,/firebase|firestore|cloudfunctions\.net|salesforce|stockfix|sales\.duckdb|nexusAssistantToggle/i,`${dir}/${file}`);
  }
});
