'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('../backend/node_modules/exceljs'),{parseOrders}=require('../backend/order-workbook.cjs');
async function parse(extra){
  const w=new ExcelJS.Workbook(),s=w.addWorksheet('Order Details');
  s.addRow(['Date','Transaction Number','Customer Name','Product Name','Quantity','Total']);
  s.addRow(['2026-09-30 08:00:00','Order 1','Store A','Product A',2,115]);
  s.addRow(extra);
  return parseOrders(Buffer.from(await w.xlsx.writeBuffer()),{ExcelJS,range:{startDate:'2026-09-01',endDate:'2026-09-30'},importedAt:'2026-10-01T17:00:00Z'});
}
test('an R0 line with no product is skipped and counted, not published',async()=>{
  const r=await parse(['2026-09-30 08:49:30','1790750970100836','IKHWEZI WHOLESALERS ESHOWE','',1,0]);
  assert.equal(r.rows.length,1);assert.equal(r.metadata.skippedBlankZeroLines,1);assert.equal(r.metadata.detailTotal,115);
});
test('a line with no product but a value still stops publication',async()=>{
  await assert.rejects(parse(['2026-09-30 08:49:30','Order 2','Store B','',1,50]),/1 order lines have missing identity/);
});
test('a dated-out-of-range line still stops publication',async()=>{
  await assert.rejects(parse(['2026-10-01 08:00:00','Order 3','Store C','Product C',1,10]),/1 order lines have missing identity/);
});
