"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),ExcelJS=require("exceljs");
const {main}=require("../worker.cjs"),engine=require("../engine.cjs"),{SALES_HEADERS}=require("../shared-layout.cjs"),{CLICKS_HEADERS}=require("../sales.cjs"),{inventoryFixture}=require("./inventory-fixture.cjs");
test("new worker manifests read shared samples, while customer and kind remain pinned",async()=>{
  for(const kind of ["Inventory","Sales"]){
    const id=(kind==="Sales"?"1":"2").repeat(32),{manifest,objects}=await inventoryFixture(id);
    manifest.mappingPolicy=engine.ACCEPTED_MAPPING_POLICY;manifest.outputPolicy=engine.RAW_SITE_NAME_POLICY;
    manifest.context={id:"synthetic",customer:kind==="Sales"?"Ethica":"Anchor",kind,channelId:kind==="Sales"?"clicks":"pnp",transformerVersion:kind==="Sales"?"clicks-sales-v1":"pnp-inventory-v2"};
    delete manifest.inputs.template;
    async function put(role,sheet,headers,rows){
      const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet(sheet);ws.addRow(headers);rows.forEach(r=>ws.addRow(r));
      const bytes=Buffer.from(await wb.xlsx.writeBuffer()),p=`etl-run-inputs/${id}/${role}.xlsx`;
      objects.set(p,bytes);manifest.inputs[role]={name:`${role}.xlsx`,path:p,generation:"1",size:bytes.length};
    }
    await put("expected",kind==="Sales"?"Sheet1":"Template",kind==="Sales"?SALES_HEADERS:engine.HEADERS,[["OLD SAMPLE - DO NOT COPY"]]);
    if(kind==="Sales"){
      delete manifest.inputs.dc;delete manifest.inputs.status;
      await put("raw","Sheet1",CLICKS_HEADERS,[[new Date("2026-08-01"),"TEST001","Raw Name","Item","12","Brand",2,20]]);
      await put("products","Product List",engine.SCHEMAS.products[1],[["CLICKS","barcode","Brand","Category","12","Item","Item","ETHICA"]]);
    }
    objects.set(`etl-run-inputs/${id}/manifest.json`,Buffer.from(JSON.stringify(manifest)));
    const bucket={file:(path,options={})=>({getMetadata:async()=>[{size:objects.get(path).length}],download:async()=>{if(path.endsWith(".xlsx"))assert.equal(options.generation,"1");return [objects.get(path)];},save:async(bytes,opts)=>{if(opts.preconditionOpts?.ifGenerationMatch===0 && objects.has(path))throw Object.assign(new Error("exists"),{code:412});objects.set(path,Buffer.from(bytes));}})};
    await main({id,bucket,logger:{log(){},error:line=>assert.fail(line)}});
    assert.equal(objects.has(`etl-results/${id}/failure.json`),false);
    const result=JSON.parse(objects.get(`etl-results/${id}/result.json`));assert.equal(result.status,"ready");assert.ok(result.reconciled);
    assert.equal(result.headers.length,kind==="Sales"?20:17);assert.equal(result.output.name,kind==="Sales"?"sales.xlsx":"inventory.xlsx");
    const output=new ExcelJS.Workbook();await output.xlsx.load(objects.get(`etl-results/${id}/${result.output.name}`));
    const sheet=output.worksheets[0];assert.equal(sheet.actualRowCount,2);assert.notEqual(sheet.getCell("A2").text,"OLD SAMPLE - DO NOT COPY");
    assert.equal(sheet.getCell(kind==="Sales"?"B2":"P2").text,kind==="Sales"?"ETHICA":"ANCHOR");
  }
});
