'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../backend/vendor/attendance.cjs'),O=require('../backend/vendor/orders.cjs');
const {orders,datasets,ReportError}=require('./filter-fixture.cjs');
const orderFields=['manager','banner','region','rep','storeName','product','status','client','channel','brand','category','currency'];
test('every order filter and combination selects exactly its matching records and totals',()=>{
  for(const field of orderFields)for(const value of new Set(orders.map(r=>r[field]))){
    const selection=O.selection({filters:{[field]:value},includeCancelled:true,export:true},'2026-09',ReportError);
    const expected=orders.filter(r=>r.orderDate.startsWith('2026-09')&&r[field]===value),report=O.report(orders,selection,'2026-09');
    assert.deepEqual(report.table.rows.map(r=>r.id).sort(),expected.map(r=>r.id).sort(),field);
    assert.deepEqual(report.totals,O.metrics(expected),field);
  }
  const sample=orders[0],filters=Object.fromEntries(orderFields.map(k=>[k,sample[k]]));
  const report=O.report(orders,O.selection({filters,export:true},'2026-09',ReportError),'2026-09');
  assert.ok(report.table.total>0);assert.ok(report.table.rows.every(r=>orderFields.every(k=>r[k]===sample[k])));
});
test('explicit cancelled status includes matching orders without a contradictory hidden exclusion',()=>{
  const report=O.report(orders,O.selection({filters:{status:'Cancelled'},export:true},'2026-09',ReportError),'2026-09');
  assert.equal(report.selection.includeCancelled,true);
  assert.equal(report.table.total,orders.filter(r=>r.orderDate.startsWith('2026-09')&&r.cancelled).length);
});
test('attendance filter combinations, completed/missed visits, distinct stores and daily selections reconcile for both audiences',()=>{
  for(const dataset of Object.values(datasets)){
    const fields=['region','division','role','banner','brand','channel','date','week','manager','person','store'];
    for(const field of fields){
      const sample=dataset.rows[0],value=field==='manager'?'Regional Manager':field==='person'?sample.userCode:field==='store'?sample.storeId:sample[field];
      const match=r=>field==='manager'?r.managerPath.includes(value):field==='person'?r.userCode===value:field==='store'?r.storeId===value:r[field]===value;
      const expected=dataset.rows.filter(match),filters={[field]:value},d=A.dashboard(dataset,filters);
      assert.equal(d.metrics.scheduled,expected.length,field);
      assert.equal(d.metrics.attended,expected.filter(r=>r.status==='visited').length,field);
      for(const unit of ['visits','stores'])for(const [metric,key] of [['target',unit==='visits'?'scheduled':'totalStores'],['actual',unit==='visits'?'attended':'visitedStores'],['missed',unit==='visits'?'missedVisits':'missedStores'],['unknown',unit==='visits'?'unknownVisits':'unknownStores']]){
        assert.equal(A.detail(dataset,filters,{metric,unit}).total,d.metrics[key],`${field}/${unit}/${metric}`);
      }
    }
    const r=dataset.rows[0],filters={manager:'Regional Manager',region:r.region,banner:r.banner,role:r.role,division:r.division,channel:r.channel,brand:r.brand};
    const detail=A.detail(dataset,filters,{date:r.date});assert.ok(detail.total>0);
    assert.ok(detail.rows.every(row=>row.date===r.date&&row.region===r.region&&row.banner===r.banner&&row.role===r.role));
    assert.equal(A.dashboard(dataset,{region:'Missing test region'}).metrics.scheduled,0);
  }
});
