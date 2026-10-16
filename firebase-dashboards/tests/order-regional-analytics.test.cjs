'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../backend/vendor/orders.cjs'),R=require('../backend/order-regional-analytics.cjs');
const make=(overrides={})=>O.normalise({id:overrides.id||'line',data:()=>({orderDate:'2026-09-12',region:'Gauteng',storeName:'Store',storeCode:'S1',orderNumber:'Order1',quantity:2,value:10,currency:'ZAR',status:'Ordered',mapped:true,...overrides})});
const selected=input=>O.selection(input||{},'2026-09',Error);
test('province and division aliases match the supplied reference without inferring unknown geography',()=>{
  for(const name of ['KwaZulu-Natal','KWAZULU NATAL','Kwa-Zulu Natal'])assert.equal(R.province(name),'KwaZulu-Natal');
  assert.equal(R.province('SWD'),'Western Cape');assert.equal(R.province('East London'),'Eastern Cape');assert.equal(R.province('Port Elizabeth'),'Eastern Cape');
  for(const name of ['Unmapped','Virtual','Lesotho','Made up'])assert.equal(R.province(name),'');
});
test('complete filtered analytics preserve pagination, exports, order deduplication and totals',()=>{
  const rows=R.enrich(Array.from({length:123},(_,i)=>make({id:String(i),region:i%2?'East London':'Port Elizabeth'})));
  const s=selected({page:2}),expected=O.report(rows,s,'2026-09'),actual=R.report(rows,s,'2026-09');
  assert.deepEqual(actual.table,expected.table);assert.equal(actual.selection.export,false);
  assert.deepEqual(actual.totals,expected.totals);assert.equal(actual.regionalAnalytics.provinces[0].lines,123);
  assert.equal(actual.regionalAnalytics.provinces[0].orders,1);assert.equal(actual.regionalAnalytics.divisions[0].stores,1);
  assert.equal(actual.regionalAnalytics.series[0].regions.reduce((s,r)=>s+r.amount,0),1230);
  assert.equal(R.report(rows,selected({export:true}),'2026-09').table.rows.length,123);
});
test('province filter combines all matching source regions and retains every existing filter',()=>{
  const rows=R.enrich([make({region:'East London',client:'A'}),make({region:'Port Elizabeth',client:'A'}),make({region:'Eastern Cape',client:'B'}),make({region:'Gauteng',client:'A'}),make({region:'Port Elizabeth',client:'A',status:'Cancelled'})]);
  const data=R.report(rows,selected({filters:{province:'Eastern Cape',client:'A'}}),'2026-09');
  assert.equal(data.totals.lines,2);assert.deepEqual(data.by.region.map(r=>r.label).sort(),['East London','Port Elizabeth']);
  assert.equal(data.regionalAnalytics.provinces.length,1);assert.equal(data.regionalAnalytics.divisions[0].label,'Coastal');
  assert.equal(R.report(rows,selected({filters:{province:'Eastern Cape',client:'A'},includeCancelled:true}),'2026-09').totals.lines,3);
});
test('zero, missing, mixed-currency and negative amounts remain truthful',()=>{
  for(const [values,currencies,expected]of [[[0,0],['ZAR','ZAR'],0],[[null,2],['ZAR','ZAR'],null],[[1,2],['ZAR','USD'],null],[[-10,2],['ZAR','ZAR'],-8]]){
    const rows=R.enrich(values.map((value,i)=>make({id:String(i),value,currency:currencies[i]})));
    const data=R.report(rows,selected(),'2026-09');
    assert.equal(data.regionalAnalytics.provinces[0].amount,expected);assert.equal(data.regionalAnalytics.series[0].regions[0].amount,expected);
    assert.equal(data.totals.units,4);
  }
});
test('unmapped and unknown divisions are accounted for, empty results do not invent periods',()=>{
  const rows=R.enrich([make({region:'Northern Cape'}),make({region:'Unmapped'}),make({region:'Virtual'})]);
  const data=R.report(rows,selected(),'2026-09');
  assert.equal(data.regionalAnalytics.mapped.lines,1);assert.equal(data.regionalAnalytics.unmapped.lines,2);assert.equal(data.regionalAnalytics.divisions[0].label,'Other / unassigned');
  const empty=R.report(rows,selected({filters:{region:'No match'}}),'2026-09');
  assert.deepEqual(empty.regionalAnalytics.series,[]);assert.equal(empty.regionalAnalytics.mapped.lines,0);
});
test('daily, weekly and monthly regional series reconcile each observed bucket without fabricated history',()=>{
  const rows=R.enrich([make({orderDate:'2026-08-12'}),make({orderDate:'2026-09-04'}),make({orderDate:'2026-09-12'})]);
  for(const granularity of ['day','week','month']){
    const data=R.report(rows,selected({start:'2026-01-01',end:'2026-09-30',granularity}),'2026-09');
    assert.equal(data.regionalAnalytics.granularity,granularity);assert.equal(data.regionalAnalytics.series.length,data.trend.length);
    for(const period of data.regionalAnalytics.series){const original=data.trend.find(p=>p.label===period.label);assert.equal(period.regions.reduce((s,r)=>s+r.amount,0),original.amount);}
    assert.ok(data.regionalAnalytics.series.every(p=>p.start>='2026-08-01'));
  }
});
