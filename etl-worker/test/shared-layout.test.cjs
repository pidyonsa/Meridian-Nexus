"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),ExcelJS=require("exceljs");
const engine=require("../engine.cjs"),layout=require("../shared-layout.cjs"),sales=require("../sales.cjs");
const {inventoryFixture}=require("./inventory-fixture.cjs");
test("samples supply headers and styles only; no data, formulas or links are copied",async()=>{
  for(const kind of ["Inventory","Sales"]){
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Expected");ws.addRow(kind==="Sales"?layout.SALES_HEADERS:engine.HEADERS);
    ws.addRow(["old-client",{formula:"1+1",result:2}]);ws.getColumn(5).width=43;
    const result=await layout.readExpected(Buffer.from(await wb.xlsx.writeBuffer()),kind),sheet=result.worksheets[0];
    assert.equal(sheet.actualRowCount,1);assert.equal(sheet.getCell("A2").value,null);assert.equal(sheet.getCell("B2").value,null);assert.equal(sheet.getColumn(5).width,43);
    ws.getCell("A1").value="Wrong header";await assert.rejects(layout.readExpected(Buffer.from(await wb.xlsx.writeBuffer()),kind),/headers/);
  }
});
test("PnP uses the selected customer, never the Anchor literal, and rejects wrong-customer input",async()=>{
  const f=await inventoryFixture("a".repeat(32)),data={};
  for(const role of Object.keys(engine.SCHEMAS))data[role]=await engine.readWorkbook(f.objects.get(f.manifest.inputs[role].path),role);
  data.products[0].v[7]="PENFLEX";
  const result=engine.transform(data,f.manifest.rules,"raw.xlsx",engine.ACCEPTED_MAPPING_POLICY,engine.RAW_SITE_NAME_POLICY,{customer:"Penflex"});
  assert.equal(result.facts[0].values[15],"PENFLEX");assert.ok(result.reconciled);
  assert.throws(()=>engine.transform(data,f.manifest.rules,"raw.xlsx",engine.ACCEPTED_MAPPING_POLICY,engine.RAW_SITE_NAME_POLICY,{customer:"Anchor"}),/do not match/);
  data.raw.push({...data.raw[0],line:9,v:data.raw[0].v.map((v,i)=>i===4?"OTHER":v)});
  data.products.push({line:3,v:["PICK N PAY CORPORATE","barcode","brand","cat","OTHER","description","desc","ANCHOR"]});
  const mixed=engine.transform(data,f.manifest.rules,"raw.xlsx",engine.ACCEPTED_MAPPING_POLICY,engine.RAW_SITE_NAME_POLICY,{customer:"Penflex"});
  assert.equal(mixed.issueCounts.CUSTOMER_MISMATCH,1);assert.ok(mixed.reconciled);
});
function salesData(){return {raw:[{line:2,v:["2026-08-01","001","Raw Clicks Name","Item","12","Brand",3,12.50]},{line:3,v:["2026-08-02","001","Raw Clicks Name","Item","12","Brand",-1,-4]}],products:[{line:2,v:["CLICKS","barcode","Brand","Cat","12","Item","Item","ETHICA","Item"]}],stores:[{line:2,v:["CLICKS","001","Raw Clicks Name","CLICKS","C1","Canonical Clicks","CLICKS"]}],staffing:[{line:2,v:["C1","Canonical Clicks","G1","CLICKS","YES","","","Gauteng","REP1"]}]};}
const context={kind:"Sales",customer:"Ethica",channelId:"clicks",transformerVersion:"clicks-sales-v1"};
test("Clicks monthly aggregation preserves signed measured units, value and raw store names",()=>{
  const result=sales.transform(salesData(),context);assert.ok(result.reconciled);assert.equal(result.facts.length,1);assert.equal(result.totals.readyRows,2);
  assert.equal(result.facts[0].values[0],"2026-08-01");assert.equal(result.facts[0].values[5],"Raw Clicks Name");assert.equal(result.facts[0].values[16],2);assert.equal(result.facts[0].values[17],8.5);assert.equal(result.facts[0].values[18],null);
});
test("sales duplicates, wrong customer, missing measures and ambiguous stores cannot be approved",()=>{
  const d=salesData();d.raw.push({...d.raw[0],line:4});const duplicate=sales.transform(d,context);assert.equal(duplicate.status,"review");assert.equal(duplicate.issueCounts.DUPLICATE_SOURCE,2);assert.ok(duplicate.reconciled);
  assert.throws(()=>sales.transform(salesData(),{...context,customer:"Anchor"}),/No source SKUs/);
  const missing=salesData();missing.raw[0].v[7]="";assert.equal(sales.transform(missing,context).issueCounts.VALUE_INVALID,1);
  const amb=salesData();amb.stores.push({line:3,v:["CLICKS","001","Raw Clicks Name","CLICKS","C2","Other","CLICKS"]});assert.equal(sales.transform(amb,context).issueCounts.STORE_MAPPING,2);
});
