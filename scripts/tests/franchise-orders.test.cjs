const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalise, metrics, selection, report, createReader} = require('../../functions/franchise-orders');
class HttpsError extends Error { constructor(code,message) { super(message); this.code = code; } }
const line = (id, overrides = {}) => normalise({id, data:()=>({orderDate:'2026-09-02',periodKey:'2026-09',orderNumber:'A1',storeCode:'S1',storeName:'Store A',region:'Gauteng',rep:'Rep A',product:'Product A',sku:'SKU1',quantity:2,value:40,unitPrice:20,status:'Ordered',mapped:true,importedAt:'2026-09-09T04:00:00Z',...overrides})});
const selected = changes => selection({start:'2026-09-01',end:'2026-09-30',...changes}, '2026-09', HttpsError);
test('unique orders use store and order reference, not product lines',()=> {
  const totals = metrics([line('1'),line('2',{product:'Product B'}),line('3',{storeCode:'S2'})]);
  assert.equal(totals.orders,2); assert.equal(totals.amount,120); assert.equal(totals.averageOrder,60);
});
test('cancelled orders are excluded by default and reconciled separately',()=> {
  const rows=[line('1'),line('2',{status:'Cancelled',value:90})];
  const result=report(rows,selected(), '2026-09');
  assert.equal(result.totals.amount,40); assert.equal(result.quality.cancelled.amount,90);
  assert.equal(report(rows,selected({includeCancelled:true}), '2026-09').totals.amount,130);
});
test('no invented currency, client or franchise designation',()=> {
  const result=report([line('1')],selected(), '2026-09');
  assert.equal(result.totals.currency,'Not supplied');
  assert.equal(result.options.client.length,0);
  assert.ok(result.quality.warnings.some(w=>w.includes('franchise-only')));
});
test('mixed currencies and missing amounts are never added into a money total',()=> {
  assert.equal(metrics([line('1',{currency:'ZAR'}),line('2',{currency:'USD'})]).amount,null);
  assert.equal(metrics([line('1',{value:null})]).amount,null);
  assert.equal(metrics([line('1',{value:''})]).amount,null);
  assert.equal(metrics([line('1',{quantity:null})]).units,null);
  assert.equal(metrics([line('1',{value:-5})]).amount,-5);
});
test('calendar validation rejects rollover, inverted and excessive ranges',()=> {
  for (const input of [{start:'2026-02-30'},{end:'2026-13-01'},{start:'2026-09-04',end:'2026-09-03'},{start:'2024-01-01'}]) assert.throws(()=>selected(input),{code:'invalid-argument'});
  assert.throws(()=>selected({page:-1}),{code:'invalid-argument'});
  assert.throws(()=>selected({sort:'__proto__'}),{code:'invalid-argument'});
  assert.throws(()=>selected({filters:{rep:['Rep A']}}),{code:'invalid-argument'});
});
test('default selection follows latest ledger month',()=> {
  assert.equal(selection({},'2026-08',HttpsError).start,'2026-08-01');
  assert.equal(selection({},'2026-02',HttpsError).end,'2026-02-28');
});
test('filters, search and selected-order drilldown affect every measure',()=> {
  const rows=[line('1'),line('2',{region:'Free State',orderNumber:'A2'}),line('3',{orderNumber:'A3',product:'Soap'})];
  assert.equal(report(rows,selected({filters:{region:'Free State'}}),'2026-09').totals.amount,40);
  assert.equal(report(rows,selected({query:'soap'}),'2026-09').table.total,1);
  assert.equal(report(rows,selected({orderKey:rows[1].orderKey}),'2026-09').table.rows[0].orderNumber,'A2');
});
test('sort and pagination do not truncate totals; CSV uses whole filtered selection',()=> {
  const rows=Array.from({length:121},(_,i)=>line(String(i),{value:i,orderNumber:String(i)}));
  const result=report(rows,selected({page:3,sort:'value'}),'2026-09');
  assert.equal(result.table.rows.length,21); assert.equal(result.table.rows[0].value,20);
  assert.equal(result.totals.amount,7260);
  assert.equal(report(rows,selected({export:true}),'2026-09').table.rows.length,121);
});
test('empty and sparse periods do not invent zero-order days or comparisons',()=> {
  const empty=report([],selected(),'2026-09'); assert.deepEqual(empty.trend,[]); assert.equal(empty.table.pages,1);
  const sparse=report([line('1'),line('2',{orderDate:'2026-09-07'})],selected(),'2026-09'); assert.equal(sparse.trend.length,2);
  const invalid=report([line('1',{orderDate:'bad'})],selected(),'2026-09'); assert.equal(invalid.quality.invalidDates,1); assert.equal(invalid.totals.lines,0);
});
function fixture() {
  const state={user:{uid:'u',email:'staff@example.test',customClaims:{operator:true}},profile:{permissions:{allowedNavigationIds:['franchiseorder']}}, reads:0, size:1};
  const documents=[{id:'1',data:()=>({periodKey:'2026-09',orderDate:'2026-09-02',orderNumber:'A',storeCode:'1',quantity:1,value:3,status:'Ordered'})}];
  const db={collection(name) { if(name==='adminUsers') return {doc:()=>({get:async()=>({exists:!!state.profile,data:()=>state.profile})})};
    const query={where:()=>query,orderBy:()=>query,limit:()=>query,get:async()=>{state.reads++; return {size:state.size,docs:documents};}}; return query; }};
  return {state, read:createReader({db,getAuth:()=>({getUser:async()=>state.user}),HttpsError}),request:{auth:{uid:'u',token:{auth_time:2000000000}},data:{}}};
}
test('signed-out and unauthorised requests fail before reading any order data',async()=> {
  const f=fixture(); await assert.rejects(f.read({data:{}}),{code:'unauthenticated'}); assert.equal(f.state.reads,0);
  f.state.profile.permissions.allowedNavigationIds=['insights']; await assert.rejects(f.read(f.request),{code:'permission-denied'}); assert.equal(f.state.reads,0);
});
test('disabled, external, missing and revoked staff fail closed',async()=> {
  for(const mutate of [f=>f.state.user.disabled=true,f=>f.state.profile.disabled=true,f=>f.state.profile.chatAccess={audience:'external'},f=>f.state.user.customClaims.chatClient=true,f=>f.state.profile=null,f=>f.state.user=null,f=>f.state.user.tokensValidAfterTime='2040-01-01T00:00:00Z']) {
    const f=fixture(); mutate(f); await assert.rejects(f.read(f.request),{code:'permission-denied'}); assert.equal(f.state.reads,0);
  }
});
test('cached rows do not cache privileges or trust forged token admin flags',async()=> {
  const f=fixture(); await f.read(f.request); f.state.profile.permissions.allowedNavigationIds=[];
  f.request.auth.token.admin=true; f.request.auth.token.email='admin@nexus.co.za'; await assert.rejects(f.read(f.request),{code:'permission-denied'});
});
test('provisioned administrator has access; oversized source never returns partial totals',async()=> {
  const f=fixture(); f.state.user.customClaims={admin:true}; f.request.auth.token.admin=true; f.state.profile.role='admin'; f.state.profile.permissions={};
  assert.equal((await f.read(f.request)).totals.amount,3);
  f.state.size=30001; f.request.data.refresh=true; await assert.rejects(f.read(f.request),{code:'resource-exhausted'});
});
module.exports={line};

test('daily activity survives monthly aggregation; every bucket reconciles to the same lines',()=>{
  const rows=Array.from({length:100},(_,i)=>line(String(i),{orderDate:`2026-${i%2?'08':'09'}-${String(i%27+1).padStart(2,'0')}`,orderNumber:String(i%21),value:i-10}));
  for(const granularity of ['auto','day','week','month']){
    const s=selected({start:'2026-07-01',granularity,filters:{region:'Gauteng'},sort:'value'}), result=report(rows,s,'2026-09');
    assert.equal(result.dailyTrend.length,54);
    for(const bucket of [...result.dailyTrend,...result.trend]){
      const detail=report(rows,selected({...s,start:bucket.start,end:bucket.end,export:true}),'2026-09');
      for(const field of ['amount','orders','units','stores','averageOrder','lines'])assert.equal(detail.totals[field],bucket[field],`${granularity} ${bucket.label} ${field}`);
      assert.equal(detail.table.rows.length,bucket.lines);
    }
    assert.equal(result.trend.reduce((s,r)=>s+r.lines,0),result.totals.lines);
  }
});

test('weekly buckets clip to filters at month/year boundaries',()=>{
  const rows=[line('1',{orderDate:'2026-01-01'}),line('2',{orderDate:'2026-01-04'}),line('3',{orderDate:'2026-01-05'})];
  const result=report(rows,selection({start:'2026-01-01',end:'2026-01-05',granularity:'week'},'2026-01',HttpsError),'2026-01');
  assert.deepEqual(result.trend.map(r=>[r.start,r.end,r.lines]),[['2026-01-01','2026-01-04',2],['2026-01-05','2026-01-05',1]]);
});

test('source exceptions and blank dimension drilldowns preserve every other filter',()=>{
  const rows=[line('1',{mapped:false,rep:'',product:'',quantity:null,value:null,orderNumber:''}),line('2',{mapped:false,status:'Cancelled'}),line('3',{mapped:false,region:'Other'}),line('4',{product:'Not supplied'})];
  const result=report(rows,selected({filters:{region:'Gauteng'}}),'2026-09');
  for(const key of ['unmapped','missingRep','missingOrderNumber','missingUnits','missingValues','cancelled']){
    const drill=report(rows,selected({filters:{region:'Gauteng'},exception:key,export:true}),'2026-09');
    assert.equal(drill.table.rows.length,key==='cancelled'?result.quality.cancelled.lines:result.quality[key]);
  }
  const missing=report(rows,selected({missingFilter:'product'}),'2026-09');assert.equal(missing.table.total,1);assert.equal(missing.table.rows[0].id,'1');
  const literal=report(rows,selected({filters:{product:'Not supplied'}}),'2026-09');assert.equal(literal.table.total,1);assert.equal(literal.table.rows[0].id,'4');
  assert.equal(result.by.product.filter(r=>r.label==='Not supplied').length,2,'Unknown value is not merged with a literal source label');
  assert.equal(report(rows,selected({exceptions:['unmapped','cancelled'],filters:{region:'Gauteng'}}),'2026-09').table.rows[0].id,'2');
});

test('drilldown inputs reject arbitrary predicates and malformed controls',()=>{
  for(const input of [{granularity:'hour'},{exception:'__proto__'},{exceptions:['constructor']},{exceptions:'unmapped'},{missingFilter:'id'},{missingFilter:{}},{missingFilters:['id']},{missingFilters:'product'}])assert.throws(()=>selected(input),{code:'invalid-argument'});
});

test('nested missing-field filters intersect rather than widening a drilldown',()=>{
  const rows=[line('1',{product:'',storeName:''}),line('2',{product:'',storeName:'Known'}),line('3',{product:'Known',storeName:''})];
  const result=report(rows,selected({missingFilters:['product','storeName']}),'2026-09');
  assert.equal(result.table.total,1);assert.equal(result.table.rows[0].id,'1');
  assert.equal(report(rows,selected({missingFilters:['product']}),'2026-09').table.total,2);
});
