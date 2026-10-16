"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const engine=require("../etl-worker/engine.cjs"),sales=require("../etl-worker/sales.cjs"),layout=require("../etl-worker/shared-layout.cjs");
const {folder,files}=require("./test-anchor-etl-real.cjs");
const root=path.dirname(folder),out=path.resolve(__dirname,"../.tmp/shared-etls-20260924/validation");
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const data={},checksums={};
  for(const role of ["products","stores","staffing","dc","status"]){
    const file=role==="stores"?".tmp/pnp-corrected-stores-20260924/source.xlsx":role==="staffing"?".tmp/national-master-20260924/files/National_Call_Cycle_23.09.2026_ETL.xlsx":path.join(folder,files[role]);
    const bytes=fs.readFileSync(file); checksums[role]=engine.sha(bytes); data[role]=await engine.readWorkbook(bytes,role);
  }
  const config={salesDays:30,openPO:"unknown",bannerColumn:"D",reportDate:"as-of",productFamily:"PICK N PAY CORPORATE",confirmed:true};
  const inventoryLayout=await layout.readExpected(fs.readFileSync(path.join(folder,"Transformed Inventory File- Anchor.xlsx")),"Inventory");
  assert.equal(inventoryLayout.getWorksheet("Template").actualRowCount,1);
  const results=[];
  for(const [customer,relative] of [["Anchor",path.join("ANCHOR",files.raw)],["Dynamic Brands","DYNAMIC BRANDS/Inventory raw data- PnPSiteDaysCover_20260902122406.xlsx"],["Penflex","PENFLEX/Raw inventory data- PnPSiteDaysCover_20260902054708.xlsx"]]){
    data.raw=await engine.readWorkbook(fs.readFileSync(path.join(root,relative)),"raw");
    const result=engine.transform(data,config,path.basename(relative),engine.ACCEPTED_MAPPING_POLICY,engine.RAW_SITE_NAME_POLICY,{customer});
    assert.ok(result.reconciled);assert.ok(result.facts.length>0);
    result.facts.forEach(f=>{assert.equal(f.values[15],customer.toUpperCase());assert.equal(f.values[4],String(data.raw.find(r=>r.line===f.line).v[2]));});
    if(customer==="Anchor"){
      const old=engine.transform(data,config,path.basename(relative),engine.ACCEPTED_MAPPING_POLICY,engine.RAW_SITE_NAME_POLICY);
      assert.deepEqual(result.facts,old.facts);assert.deepEqual(result.totals,old.totals);
    }
    const bytes=await engine.exportWorkbook(result,{localValidationOnly:true,checksums},inventoryLayout);
    fs.writeFileSync(path.join(out,customer.replaceAll(" ","-")+"-inventory.xlsx"),bytes);
    const summary={customer,kind:"Inventory",status:result.status,totals:result.totals,issueCounts:result.issueCounts,warningCounts:result.warningCounts};results.push(summary);console.log(JSON.stringify(summary));
  }
  data.raw=await sales.readRaw(fs.readFileSync(path.join(root,"ETHICA/CLICKS AUG SALES FY26.xlsx")));
  const result=sales.transform(data,{customer:"Ethica",kind:"Sales",channelId:"clicks",transformerVersion:"clicks-sales-v1"});
  assert.ok(result.reconciled);assert.ok(result.facts.length>0);assert.equal(result.totals.inputRows,data.raw.length);
  assert.ok(Math.abs(result.totals.sourceUnits-data.raw.reduce((s,r)=>s+Number(r.v[6]),0))<0.001);
  assert.ok(Math.abs(result.totals.sourceValue-data.raw.reduce((s,r)=>s+Number(r.v[7]),0))<0.001);
  const salesLayout=await layout.readExpected(fs.readFileSync(path.join(root,"ETHICA/Ethica Sales- Transformed.xlsx")),"Sales");
  assert.equal(salesLayout.getWorksheet("Sheet1").actualRowCount,1);
  fs.writeFileSync(path.join(out,"Ethica-sales.xlsx"),await sales.exportWorkbook(result,{localValidationOnly:true,checksums},salesLayout));
  const summary={customer:"Ethica",kind:"Sales",status:result.status,totals:result.totals,issueCounts:result.issueCounts,warningCounts:result.warningCounts};results.push(summary);console.log(JSON.stringify(summary));
  fs.writeFileSync(path.join(out,"results.json"),JSON.stringify({at:new Date().toISOString(),localValidationOnly:true,checksums,results},null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
