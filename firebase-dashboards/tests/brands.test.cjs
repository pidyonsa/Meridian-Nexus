'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../backend/node_modules/exceljs'),{parseOrders}=require('../backend/order-workbook.cjs'),O=require('../backend/vendor/orders.cjs');
const {fields}=require('../scripts/firestore-values.cjs');
async function fixture(brand='Brands'){
  const w=new ExcelJS.Workbook(),s=w.addWorksheet('Order Details');
  s.addRow(['Date','Transaction Number','Customer Name','Product Name','Quantity','Total','Sub-total',brand,'Banner','Email Address','Signature','Currency']);
  s.addRow(['2026-09-14 09:00:00','Order 1','Store A','Product A',2,115,100,'Test Brand','Retailer A','private@example.test','private-signature','ZAR']);
  s.addRow(['2026-09-14 09:00:00','Order 1','Store A','Product B',1,0,0,'Brand B','Retailer A','private@example.test','private-signature','ZAR']);
  const summary=w.addWorksheet('Order Summary');summary.addRow(['Transaction Number','Total']);summary.addRow(['Order 1',114.99]);
  return parseOrders(Buffer.from(await w.xlsx.writeBuffer()),{ExcelJS,range:{startDate:'2026-09-01',endDate:'2026-09-14'},importedAt:'2026-09-14T10:00:00Z'});
}
test('Brand, Brands and Brand Name map to brand, never Banner, including exports and filtered totals',async()=>{
  for(const header of ['Brand','Brands','Brand Name']){
    const r=await fixture(header);assert.equal(r.metadata.brandColumn,header);assert.equal(r.rows[0].brand,'Test Brand');assert.equal(r.rows[0].banner,'Retailer A');
    assert.equal(r.rows.length,2,'Zero-value lines remain in the source');assert.equal(r.rows[0].unitPrice,50,'Line subtotal is divided by quantity');
    assert.ok(!JSON.stringify(r.rows).includes('private'));
    const report=O.report(r.rows.map(row=>O.normalise({id:row.id,data:()=>row})),O.selection({filters:{brand:'Test Brand'},export:true},'2026-09',Error),'2026-09');
    assert.equal(report.table.total,1);assert.equal(report.table.rows[0].brand,'Test Brand');assert.equal(report.totals.amount,115);
    assert.equal(r.metadata.summaryDifference,0.01,'Source summary variance is retained, not balanced into line values');
  }
});
test('existing ledger records with plural Brands retain the field',()=>{
  const row=O.normalise({id:'line',data:()=>({Brands:'Brand A',banner:'Retailer B'})});assert.equal(row.brand,'Brand A');assert.equal(row.banner,'Retailer B');
});
test('Firestore publishing preserves decimal currency amounts and integer counts',()=>{
  const r=fields({amount:123.45,count:2,rows:[{amount:0.05}]});assert.deepEqual(r.amount,{doubleValue:123.45});assert.deepEqual(r.count,{integerValue:'2'});assert.deepEqual(r.rows.arrayValue.values[0].mapValue.fields.amount,{doubleValue:0.05});
  assert.throws(()=>fields({amount:NaN}));
});
