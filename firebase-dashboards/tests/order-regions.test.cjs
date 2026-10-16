'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../backend/order-regions.cjs');
const O=require('../backend/vendor/orders.cjs');
test('exact names fill only missing regions, ignoring unreliable customer numbers',()=>{
  const catalog=R.index(R.compile([{storeName:'SPAR A',region:'KwaZulu Natal'},{storeName:'SPAR B',region:'Gauteng'}]));
  const rows=[{storeName:' spar   a ',region:'Unmapped',storeCode:'1234',value:0,quantity:7},{storeName:'SPAR B',region:'Unmapped',storeCode:'1234',value:10},{storeName:'SPAR A',region:'Western Cape',mapped:true},{storeName:'SPAR A EXPRESS',region:'Unmapped',storeCode:'1234'}];
  const out=R.enrich(rows,catalog);assert.deepEqual(out.map(r=>r.region),['KwaZulu Natal','Gauteng','Western Cape','Unmapped']);
  assert.equal(rows[0].region,'Unmapped');assert.equal(out[0].value,0);assert.equal(out[0].quantity,7);assert.equal(out[0].mapped,true);assert.equal(out[2],rows[2]);
});
test('conflicting name matches remain unmapped; duplicate assignments agree',()=>{
  const c=R.index(R.compile([{storeName:'Spar A',region:'Gauteng'},{storeName:'Spar A',region:'Western Cape'},{storeName:'Spar B',region:'KZN'},{storeName:'Spar B',region:'KwaZulu-Natal'}]));
  assert.deepEqual(R.enrich([{storeName:'Spar A',region:'Unmapped'},{storeName:'Spar B',region:''}],c).map(r=>r.region),['Unmapped','KwaZulu Natal']);
});
test('mapping corruption and oversized resources fail closed',()=>{
  const c=R.compile([{storeName:'Spar A',region:'Gauteng'}]);c.regions['SPAR A']=['Western Cape'];assert.throws(()=>R.index(c),/checksum/);
  assert.throws(()=>R.index({regions:{bad:'Gauteng'}}),/Invalid/);assert.throws(()=>R.index({regions:{}}),/Invalid/);
});
test('mapping preserves all rows, totals, units, order IDs and client filters',()=>{
  const c=R.index(R.compile([{storeName:'Store A',region:'Gauteng'},{storeName:'Store B',region:'Western Cape'}]));
  const rows=[['a','Store A',5],['b','Store B',8]].map(([id,storeName,quantity])=>O.normalise({id,data:()=>({orderNumber:'123456789012345678901',storeName,quantity,value:0,orderDate:'2026-09-20',client:'aQuelle',brand:'aQuelle'})}));
  const selection=O.selection({export:true,filters:{client:'aQuelle'}},'2026-09',Error);
  const before=O.report(rows,selection,'2026-09'),after=O.report(R.enrich(rows,c),selection,'2026-09');
  assert.deepEqual(after.totals,before.totals);assert.equal(after.quality.unmapped,0);assert.equal(after.by.region.length,2);
  assert.equal(after.by.region.reduce((n,r)=>n+r.units,0),13);assert.deepEqual(after.table.rows.map(r=>r.id),before.table.rows.map(r=>r.id));
});
