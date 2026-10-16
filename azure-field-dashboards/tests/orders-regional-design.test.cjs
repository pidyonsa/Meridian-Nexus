'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const scope={};scope.window=scope;vm.runInNewContext(fs.readFileSync('public/orders.js','utf8'),scope);vm.runInNewContext(fs.readFileSync('public/province-geometry.js','utf8'),scope);vm.runInNewContext(fs.readFileSync('ui/orders-regions.js','utf8'),scope);
const O=require('../../firebase-dashboards/backend/vendor/orders.cjs'),R=require('../../firebase-dashboards/backend/order-regional-analytics.cjs');
const helpers={groupTable:()=>'<table></table>',metricControl:()=>'',granularityControl:()=>''};
function report(value=10,quantity=2,region='Gauteng'){
  const row=O.normalise({id:'1',data:()=>({orderDate:'2026-09-12',orderNumber:'1',storeName:'Store',region,value,quantity,currency:'Not supplied'})});
  return R.report(R.enrich([row]),O.selection({},'2026-09',Error),'2026-09');
}
test('nine actual province paths are bundled locally with source provenance',()=>{
  const g=scope.FranchiseProvinceGeometry;assert.equal(g.provinces.length,9);assert.match(g.sourceSha256,/^[a-f0-9]{64}$/);
  for(const p of g.provinces){assert.ok(p.path.length>200);assert.ok(p.label.every(Number.isFinite));assert.doesNotMatch(p.path,/NaN|Infinity/);}
});
test('regional page renders map, snapshots, share charts, original table and observed-date trend',()=>{
  const html=scope.FranchiseRegions.html(report(),'amount',helpers);
  for(const text of ['Regional intelligence','Order performance by province','Divisional snapshot','Value share','Volume share','Daily amount by region','data-fr-province="Gauteng"','data-fr-point="Gauteng"','<table>'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/undefined|NaN|Infinity|<iframe|https:\/\//);
  assert.equal((html.match(/data-fr-point=/g)||[]).length,1);
});
test('zero and unavailable data are not turned into invented money or invalid graph coordinates',()=>{
  for(const v of [0,null,-10]){
    const html=scope.FranchiseRegions.html(report(v),'amount',helpers);
    assert.doesNotMatch(html,/NaN|Infinity|undefined/);
    if(v===0){assert.match(html,/Geo records zero amounts/);assert.match(html,/No recorded value/);assert.doesNotMatch(html,/leads the selected|<strong>No records<\/strong>/);}
    if(v===null)assert.match(html,/Comparable amounts are not available/);
  }
});
test('data labels are escaped in map, share, insight and chart attributes',()=>{
  const html=scope.FranchiseRegions.html(report(10,2,'<img src=x onerror=alert(1)>'),'units',helpers);
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('empty selections do not show fictional zero-percent divisional shares',()=>{
  const data=R.report([],O.selection({},'2026-09',Error),'2026-09');
  const html=scope.FranchiseRegions.html(data,'units',helpers);
  assert.match(html,/Not available value/);assert.match(html,/No order lines match/);
  assert.doesNotMatch(html,/data-fr-province=|data-fr-point=|>0% value/);
});
test('shared period tooltip preserves exact totals, zero, missing values and escaped labels',()=>{
  const data=report(1234.56,2.125),details=scope.FranchiseRegions.tooltipDetails(data,'amount',0);
  assert.equal(details.rows[0].value,1234.56);assert.equal(details.total,1234.56);
  assert.equal(details.formattedTotal,new Intl.NumberFormat('en-ZA',{maximumFractionDigits:2}).format(1234.56));
  assert.equal(scope.FranchiseRegions.tooltipDetails(data,'units',0).rows[0].value,2.125);
  assert.equal(scope.FranchiseRegions.tooltipDetails(report(0),'amount',0).formattedTotal,'0');
  assert.equal(scope.FranchiseRegions.tooltipDetails(report(null),'amount',0).rows[0].formatted,'Not available');
  assert.equal(scope.FranchiseRegions.tooltipDetails(data,'amount',9),null);
  const unsafe=scope.FranchiseRegions.tooltipDetails(report(1,1,'<img src=x onerror=alert(1)>'),'amount',0);
  assert.doesNotMatch(scope.FranchiseRegions.tooltipHtml(unsafe),/<img/);
  assert.match(scope.FranchiseRegions.tooltipHtml(unsafe),/&lt;img/);
});
test('period total includes all filtered regions, not just the top six, without adding other dates',()=>{
  const rows=Array.from({length:8},(_,i)=>O.normalise({id:String(i),data:()=>({orderDate:'2026-09-12',region:'Region '+i,value:10+i,quantity:1})}));
  rows.push(O.normalise({id:'other-day',data:()=>({orderDate:'2026-09-13',region:'Region 7',value:100,quantity:1})}));
  const data=R.report(R.enrich(rows),O.selection({},'2026-09',Error),'2026-09');
  const details=scope.FranchiseRegions.tooltipDetails(data,'amount',0);
  assert.equal(details.rows.length,6);assert.equal(details.total,108);
  assert.ok(details.rows.reduce((sum,r)=>sum+r.value,0)<details.total);
  const next=scope.FranchiseRegions.tooltipDetails(data,'amount',1);
  assert.equal(next.total,100);assert.equal(next.rows.filter(r=>r.value===0).length,5);
});
test('tooltip uses real currency and full week or month labels',()=>{
  const row=O.normalise({id:'1',data:()=>({orderDate:'2026-09-12',region:'Gauteng',value:1234.56,quantity:2,currency:'ZAR'})});
  for(const granularity of ['week','month']){
    const data=R.report(R.enrich([row]),O.selection({granularity},'2026-09',Error),'2026-09');
    const d=scope.FranchiseRegions.tooltipDetails(data,'amount',0);
    assert.equal(d.formattedTotal,new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(1234.56));
    assert.match(d.title,/2026/);if(granularity==='week')assert.match(d.title,/ - /);
  }
});
