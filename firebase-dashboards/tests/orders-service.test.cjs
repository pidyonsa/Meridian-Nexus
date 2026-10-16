'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const backendRequire=require('node:module').createRequire(require('node:path').join(__dirname,'../backend/package.json'));
const ExcelJS=backendRequire('exceljs'),{HttpsError}=backendRequire('firebase-functions/v2/https');
const {createService}=require('../backend/service.cjs');
async function fixture(){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Products');sheet.addRow(['Product Name','Brand','SKU Code']);sheet.addRow(['Product A','Client A','SKU-A']);sheet.addRow(['Product B','Client B','SKU-B']);
  const bytes=await book.xlsx.writeBuffer();let reads=0,downloads=0;
  const source=[{id:'a',sku:'SKU-A',product:'Product A',value:10,quantity:2},{id:'b',sku:'SKU-B',product:'Product B',value:20,quantity:4},{id:'c',sku:'SKU-C',product:'Product C',value:30,quantity:6}].map(r=>({...r,orderNumber:'Order1',orderDate:'2026-09-12',storeCode:'S1',storeName:'Store',region:'Gauteng',manager:'Manager',rep:'Rep',status:'Processed',banner:'Banner',currency:'ZAR',mapped:true,importedAt:'2026-09-16T09:00:00Z',periodKey:'2026-09'}));
  let resource={storagePath:'portal-resources/geo-product-order-master/master.xlsx',updatedAt:'v1',clientOverrides:[{sku:'SKU-C',client:'Client B'}],active:true};
  let regionResource=null;
  const snapshot=data=>({exists:!!data,data:()=>data});
  const db={collection:name=>{
    if(name==='publicDashboardSources')return {doc:id=>({get:async()=>snapshot(id==='orderRegions'?regionResource:null)})};
    if(name==='portalResources')return {doc:()=>({get:async()=>snapshot(resource)})};
    if(name==='salesTransactions'){
      const query={where:()=>query,orderBy:()=>query,limit:()=>query,get:async()=>{reads++;return {size:source.length,docs:source.map(r=>({id:r.id,data:()=>r}))};}};return query;
    }
    throw Error('Unexpected collection: '+name);
  }};
  const getStorage=()=>({bucket:()=>({file:()=>({download:async()=>{downloads++;return [bytes];}})})});
  const service=createService({db,getStorage,ExcelJS,HttpsError});
  return {service,source,resource,setResource:value=>{resource=value;},setRegionResource:value=>{regionResource=value;},stats:()=>({reads,downloads})};
}
test('client filtering reconciles totals, trend, groups and all exported order lines',async()=>{
  const f=await fixture(),all=await f.service.orders({});assert.deepEqual(all.options.client,['Client A','Client B']);assert.equal(all.totals.amount,60);assert.equal(all.clientMapping.matched,3);assert.equal(all.clientMapping.approvedMappings,1);
  for(const [client,amount,lines]of [['Client A',10,1],['Client B',50,2]]){
    const input={filters:{client,banner:'Banner',manager:'Manager'}},data=await f.service.orders(input),out=await f.service.orders({...input,export:true,version:data.version});
    assert.equal(data.totals.amount,amount);assert.equal(data.totals.lines,lines);assert.ok(out.table.rows.every(r=>r.client===client));assert.equal(out.table.total,lines);
    for(const groups of [data.trend,...Object.values(data.by)])assert.equal(groups.reduce((sum,r)=>sum+r.amount,0),amount);
  }
  assert.equal(f.stats().downloads,1);assert.equal(f.stats().reads,2,'Both source queries are cached across filters');
});
test('manual refresh reloads source and mapping, while stale exports are rejected',async()=>{
  const f=await fixture(),old=await f.service.orders({});f.source[0].value=100;
  const refreshed=await f.service.orders({refresh:true});assert.equal(refreshed.totals.amount,150);assert.notEqual(refreshed.version,old.version);assert.equal(f.stats().downloads,2);
  await assert.rejects(f.service.orders({export:true,version:old.version}),{code:'failed-precondition'});
  f.setResource({...f.resource,updatedAt:'v2',clientOverrides:[]});const removed=await f.service.orders({refresh:true});assert.ok(removed.options.client.includes('Unmapped client'));assert.equal(removed.totals.amount,150);
});

test('Brand and Client filters return identical mapped rows, totals and exports',async()=>{
  const f=await fixture();f.source[0].brand='Original Geo brand';
  const all=await f.service.orders({export:true});
  assert.deepEqual(all.options.brand,all.options.client);
  assert.equal(all.table.rows.find(r=>r.id==='a').sourceBrand,'Original Geo brand');
  for(const client of all.options.client){
    const viaClient=await f.service.orders({filters:{client},export:true});
    const viaBrand=await f.service.orders({filters:{brand:client},export:true,version:viaClient.version});
    const both=await f.service.orders({filters:{brand:client,client,banner:'Banner'},export:true});
    assert.deepEqual(viaBrand.table,viaClient.table);assert.deepEqual(both.table,viaClient.table);
    assert.deepEqual(viaBrand.totals,viaClient.totals);assert.deepEqual(viaBrand.by,viaClient.by);assert.deepEqual(viaBrand.trend,viaClient.trend);
    assert.ok(viaBrand.table.rows.every(r=>r.brand===client&&r.client===client));
  }
  assert.equal((await f.service.orders({filters:{client:'Client A',brand:'Client B'}})).totals.lines,0);
  assert.equal(f.source[0].brand,'Original Geo brand');
});
test('inactive masters are not read, and traversal paths fail closed',async()=>{
  const f=await fixture();f.setResource({...f.resource,active:false});assert.equal((await f.service.orders({})).clientMapping,null);assert.equal(f.stats().downloads,0);
  f.setResource({...f.resource,storagePath:'portal-resources/geo-product-order-master/../private.xlsx'});await assert.rejects(f.service.orders({refresh:true}),{code:'failed-precondition'});
});
test('regional lookup survives source refreshes and invalidates stale exports without changing amounts',async()=>{
  const f=await fixture(),R=require('../backend/order-regions.cjs');
  f.source.forEach(r=>{r.region='Unmapped';r.mapped=false;r.value=0;});
  const before=await f.service.orders({});assert.equal(before.quality.unmapped,3);
  f.setRegionResource({...R.compile([{storeName:'Store',region:'Gauteng'}]),active:true});
  const after=await f.service.orders({refresh:true});assert.equal(after.quality.unmapped,0);assert.deepEqual(after.totals,before.totals);
  assert.match(after.quality.warnings.join(' '),/zero amounts/);assert.notEqual(after.version,before.version);
  await assert.rejects(f.service.orders({export:true,version:before.version}),{code:'failed-precondition'});
  f.source.push({...f.source[0],id:'new-daily-line',quantity:9});
  const next=await f.service.orders({refresh:true,filters:{region:'Gauteng'},export:true});assert.equal(next.table.total,4);assert.ok(next.table.rows.every(r=>r.region==='Gauteng'));
  f.setRegionResource({...R.compile([{storeName:'Store',region:'Western Cape'}]),active:true});
  const revised=await f.service.orders({refresh:true});assert.equal(revised.by.region[0].label,'Western Cape');assert.notEqual(revised.version,next.version);
});
