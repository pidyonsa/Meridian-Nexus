'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../backend/product-clients.cjs'),ExcelJS=require('../backend/node_modules/exceljs');
const product=(extra={})=>({productId:'1',sku:'00123',barcode:'00987',product:'Test Product (6 pack)',client:'Client A',...extra});
test('SKU, barcode and unambiguous exact names map to the master Brand as client',()=>{
  const c=C.index({version:'v1',rows:[product()]});
  assert.deepEqual(C.match({sku:'00123'},c),{client:'Client A',clientMatch:'sku'});
  assert.deepEqual(C.match({sku:'00987'},c),{client:'Client A',clientMatch:'barcode'});
  assert.deepEqual(C.match({product:' test PRODUCT  (6 pack) '},c),{client:'Client A',clientMatch:'productName'});
  for(const row of [{sku:'123'},{product:'Test Product 6 pack'},{product:'Other product'}])assert.equal(C.match(row,c).client,C.UNMAPPED);
});
test('conflicting identities and duplicate names never infer a client',()=>{
  const c=C.index({version:'v1',rows:[product(),product({productId:'2',sku:'00234',barcode:'00988',client:'Client B'})]});
  assert.equal(C.match({product:'Test Product (6 pack)'},c).clientMatch,'ambiguous');
  assert.equal(C.match({sku:'00123',barcode:'00988'},c).clientMatch,'ambiguous');
  assert.equal(C.match({sku:'00123',product:'Test Product (6 pack)'},c).client,'Client A');
});
test('explicit approved SKU mappings fill gaps without overwriting a master match',()=>{
  const c=C.index({version:'v1',rows:[product()]},[{sku:'999',client:'Client A'}]);
  assert.deepEqual(C.match({sku:'999'},c),{client:'Client A',clientMatch:'approvedOverride'});
  assert.notEqual(c.version,'v1');assert.equal(c.workbookVersion,'v1');assert.equal(C.match({product:'999'},c).client,C.UNMAPPED);
  assert.throws(()=>C.index({rows:[product()]},[{sku:'999',client:'Unknown'}]));
  assert.throws(()=>C.index({rows:[product()]},[{sku:'999',client:'Client A'},{sku:'999',client:'Client A'}]));
});
test('Brand equals Client while enrichment preserves original brand, values and Banner',()=>{
  const rows=[{id:'one',sku:'00123',value:10.5,quantity:2,brand:'Source brand',banner:'Store banner'},{id:'two',sku:'missing',value:4,quantity:3}];
  const result=C.enrich(rows,C.index({version:'v1',rows:[product()]}));
  assert.equal(result.rows.length,2);assert.equal(result.rows[0].brand,'Client A');assert.equal(result.rows[0].sourceBrand,'Source brand');assert.equal(result.rows[0].banner,'Store banner');
  assert.ok(result.rows.every(row=>row.brand===row.client));assert.equal(result.rows[1].brand,C.UNMAPPED);
  assert.equal(rows[0].brand,'Source brand');
  assert.equal(C.enrich(result.rows,C.index({version:'v1',rows:[product()]})).rows[0].sourceBrand,'Source brand');
  assert.equal(result.rows.reduce((n,r)=>n+r.value,0),14.5);assert.equal(result.summary.matched,1);assert.equal(result.summary.unmatched,1);assert.equal(rows[0].client,undefined);
});
test('workbook parser preserves text codes and rejects missing or incomplete mapping fields',async()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Products');sheet.addRow(['Product ID','Product Name','Brand','SKU Code','Barcode']);sheet.addRow(['1','Product','Client','00123','00456']);
  const c=await C.parse(await book.xlsx.writeBuffer(),ExcelJS);assert.equal(c.rows[0].sku,'00123');assert.equal(c.rows[0].client,'Client');
  sheet.getCell('C2').value='';await assert.rejects(C.parse(await book.xlsx.writeBuffer(),ExcelJS),/incomplete/);
  sheet.getCell('C1').value='Client';await assert.rejects(C.parse(await book.xlsx.writeBuffer(),ExcelJS),/missing Brand/);
});
