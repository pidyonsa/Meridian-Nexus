"use strict";
const ExcelJS = require("exceljs");
const { PassThrough } = require("node:stream");
const { inspectZip, clean, norm, date, VERSION } = require("./engine.cjs");
const { SALES_HEADERS } = require("./shared-layout.cjs");
const CLICKS_HEADERS = ["CALENDAR_DATE", "STORE_NUMBER", "STORE", "SKU_DESCRIPTION", "SKU_NUMBER", "BRAND", "SALES_VOLUME", "SALES_VALUE"];
const amount = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const key = (...v) => JSON.stringify(v.map(norm));
const one = (rows, project) => new Set(rows.map(r => key(...project(r)))).size === 1 ? rows[0] : null;
function index(rows, project) {
  const map = new Map();
  for (const row of rows) { const k = project(row); if (!map.has(k)) map.set(k, []); map.get(k).push(row); }
  return map;
}
async function readRaw(buffer) {
  const { readTable } = require("./source-files.cjs");
  const table = await readTable(buffer, { fields: Object.fromEntries(CLICKS_HEADERS.map(h => [h, h])) });
  return table.rows.map(row => ({ line: row.line, v: CLICKS_HEADERS.map(h => row.v[h]) }));
}
function transform(data, context) {
  if (context.transformerVersion !== "clicks-sales-v1" || context.channelId !== "clicks" || context.kind !== "Sales") throw new Error("Unsupported sales adapter.");
  const customer = norm(context.customer);
  const channelProducts = data.products.filter(r=>norm(r.v[0]) === "CLICKS");
  const products = index(channelProducts.filter(r=>norm(r.v[7]) === customer), r=>norm(r.v[4]));
  const others = index(channelProducts.filter(r=>norm(r.v[7]) !== customer), r=>norm(r.v[4]));
  if (!customer || !data.raw.some(r=>products.has(norm(r.v[4])))) throw new Error("No source SKUs match the selected customer in the shared Clicks Product List. Check the customer and raw export.");
  const stores = index(data.stores.filter(r=>norm(r.v[0]) === "CLICKS"),r=>norm(r.v[1]));
  const staff = index(data.staffing.filter(r=>norm(r.v[3]) === "CLICKS" && !/^(NO|N|FALSE|0|INACTIVE)$/.test(norm(r.v[4]))),r=>key(r.v[0],r.v[1]));
  const duplicates = index(data.raw,r=>key(date(r.v[0]),r.v[1],r.v[4]));
  const groups = new Map(), exceptions = [], warnings = [], assignments = new Map();
  const totals = { inputRows:data.raw.length,storeRows:data.raw.length,readyRows:0,exceptionRows:0,dcRows:0,invalidDcRows:0,warningRows:0,excludedRows:0,
    sourceUnits:0,validUnits:0,exceptionUnits:0,sourceValue:0,validValue:0,exceptionValue:0,unknownUnitsRows:0,unknownValueRows:0 };
  for (const row of data.raw) {
    const v=row.v, day=date(v[0]), siteCode=clean(v[1]), rawName=String(v[2] ?? ""), article=clean(v[4]), units=amount(v[6]), value=amount(v[7]);
    const errors=[], notices=[];
    const add=(code,detail,warning=false)=> (warning ? notices : errors).push({code,detail});
    if (!day) add("DATE_INVALID","CALENDAR_DATE is not a valid date; month was not guessed.");
    if (!siteCode || !article || !clean(rawName)) add("IDENTIFIER_MISSING","Source store code, name and SKU are required.");
    if (units === null) { add("UNITS_INVALID","Sales volume is missing or non-numeric."); totals.unknownUnitsRows++; } else totals.sourceUnits+=units;
    if (value === null) { add("VALUE_INVALID","Sales value is missing or non-numeric."); totals.unknownValueRows++; } else totals.sourceValue+=value;
    if (duplicates.get(key(day,siteCode,article)).length !== 1) add("DUPLICATE_SOURCE","Repeated date/store/SKU rows require review; totals were not silently deduplicated.");
    let matches=products.get(norm(article)) || [];
    const exact=matches.filter(r=>norm(r.v[8])===norm(v[3])); if (exact.length) matches=exact;
    const product=one(matches,r=>r.v.slice(1,8));
    if (!matches.length && others.has(norm(article))) add("CUSTOMER_MISMATCH","SKU belongs to another customer in the shared Product List; not relabelled.");
    if (!product) add("PRODUCT_MAPPING","No unique product attributes for this customer's Clicks SKU. Raw description retained.",true);
    let aliases=stores.get(norm(siteCode)) || [];
    const exactStore=aliases.filter(r=>norm(r.v[2])===norm(rawName)); if (exactStore.length) aliases=exactStore;
    const store=one(aliases,r=>[r.v[3],r.v[4],r.v[5]]);
    if (aliases.length && !store) add("STORE_MAPPING","Multiple canonical stores match this source store. Review the clean-up master.");
    else if (!store || !clean(store.v[4]) || !clean(store.v[5])) add("STORE_MAPPING","No complete store alias; source store identifiers retained.",true);
    const people=store ? staff.get(key(store.v[4],store.v[5])) || [] : [];
    const region=clean(people[0]?.v[7]);
    if (!region) add("REGION_MAPPING","No region on the first active exact master-store match; left blank.",true);
    if (notices.length) { warnings.push({line:row.line,siteCode,rawName,article,outcome:errors.length ? "blocked":"included",errors:notices}); totals.warningRows++; }
    if (errors.length) {
      exceptions.push({line:row.line,kind:"sales",siteCode,rawName,article,units,value,errors}); totals.exceptionRows++;
      totals.exceptionUnits+=units ?? 0; totals.exceptionValue+=value ?? 0; continue;
    }
    const month=day.slice(0,7)+"-01";
    const values=[month,customer,"CLICKS",clean(store?.v[3]) || "CLICKS",siteCode,rawName,"","",region,"","","","",clean(product?.v[3]),clean(product?.v[2]) || clean(v[5]),clean(product?.v[6]) || clean(v[3]),units,value,null,people.length ? "YES":"NO"];
    const id=JSON.stringify([month,siteCode,rawName,article,...values.slice(8,16)]);
    if (!groups.has(id)) groups.set(id,{line:row.line,siteCode,article,rawName,sourceRows:0,values:values.map((v,i)=>[16,17].includes(i)?0:v)});
    const fact=groups.get(id); fact.values[16]+=units; fact.values[17]+=value; fact.sourceRows++;
    totals.readyRows++; totals.validUnits+=units; totals.validValue+=value;
    for (const person of people) {
      const record={siteCode,canonicalName:clean(store.v[5]),employeeId:clean(person.v[8]),name:clean(person.v[9]),role:clean(person.v[10]),managerCode:clean(person.v[13]),manager:clean(person.v[14])};
      assignments.set(JSON.stringify(record),record);
    }
  }
  const facts=[...groups.values()];
  for (const f of facts) { f.values[16]=round(f.values[16]); f.values[17]=round(f.values[17]); }
  for (const k of ["sourceUnits","validUnits","exceptionUnits","sourceValue","validValue","exceptionValue"]) totals[k]=round(totals[k]);
  totals.outputRows=facts.length;
  const reconciled=totals.inputRows===totals.readyRows+totals.exceptionRows && Math.abs(totals.sourceUnits-totals.validUnits-totals.exceptionUnits)<0.001 && Math.abs(totals.sourceValue-totals.validValue-totals.exceptionValue)<0.001;
  if (!reconciled) throw new Error("Sales row/unit/value reconciliation failed.");
  const counts=rows=>rows.reduce((o,r)=>{for(const e of r.errors)o[e.code]=(o[e.code]||0)+1;return o;},{});
  const dates=data.raw.map(r=>date(r.v[0])).filter(Boolean).sort();
  return {version:VERSION,kind:"Sales",customer,adapter:context.transformerVersion,mappingPolicy:"shared-sales-mappings-v1",outputPolicy:"shared-sample-layout-v1",asOf:dates.at(-1),periodStart:dates[0],periodEnd:dates.at(-1),reportDate:dates.at(-1),rules:{period:"Calendar month from CALENDAR_DATE",salesBasis:"Measured SALES_VOLUME and SALES_VALUE; no tax or case conversion"},
    headers:SALES_HEADERS,totals,reconciled,status:exceptions.length || !facts.length ? "review":"ready",facts,exceptions,warnings,exclusions:[],dcFacts:[],assignments:[...assignments.values()],regionDecisions:[],referenceCellErrors:[],issueCounts:counts(exceptions),warningCounts:counts(warnings)};
}
// Streams rows to the zip so multi-month exports (tens of thousands of rows) stay within the worker heap.
async function exportWorkbook(result, provenance, layout) {
  const out=new PassThrough(), chunks=[]; out.on("data",c=>chunks.push(c));
  const finished=new Promise((resolve,reject)=>{out.on("end",resolve); out.on("error",reject);});
  const wb=new ExcelJS.stream.xlsx.WorkbookWriter({stream:out,useStyles:true,useSharedStrings:true}); wb.creator="Meridian Nexus";
  const sheet=(name,headers,rows,columns=headers.map(()=>({width:24})),headerStyle=()=>({font:{bold:true}}))=>{
    const ws=wb.addWorksheet(name,{views:[{state:"frozen",ySplit:1}]}); ws.columns=columns;
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,rows.length+1),column:headers.length}};
    const head=ws.addRow(headers); headers.forEach((_,i)=>{head.getCell(i+1).style=headerStyle(i);}); head.commit();
    for(const r of rows) ws.addRow(r).commit();
    ws.commit();
  };
  const saved=layout.getWorksheet("Sheet1"), dateFormat=result.mappingPolicy === "feedback-sales-mappings-v1" ? "yyyy/mm/dd" : "mmm-yy";
  const numFmt={1:dateFormat,5:"@",18:"0.00"};
  sheet("Sheet1",saved.getRow(1).values.slice(1),result.facts.map(f=>f.values.map((v,i)=>i===0?new Date(v+"T00:00:00Z"):v)),
    SALES_HEADERS.map((_,i)=>({width:saved.getColumn(i+1).width,...(numFmt[i+1]?{style:{numFmt:numFmt[i+1]}}:{})})),
    i=>({...structuredClone(saved.getRow(1).getCell(i+1).style),...(numFmt[i+1]?{numFmt:numFmt[i+1]}:{})}));
  for(const [name,rows] of [["Exceptions",result.exceptions],["Accepted Warnings",result.warnings]]) sheet(name,["Source row","Site Code","Source name","Article","Units","Value","Issue","Details"],rows.flatMap(r=>r.errors.map(e=>[r.line,r.siteCode,r.rawName,r.article,r.units??null,r.value??null,e.code,e.detail])));
  sheet("Excluded Rows",["Source file","Source row","Site Code","Source name","Article","Units","Value","Reason"],result.exclusions.map(r=>[r.source || "",r.line,r.siteCode,r.rawName,r.article,r.units??null,r.value??null,r.reason]));
  sheet("Reference Cell Errors",["Role","Row","Column","Error"],result.referenceCellErrors.map(r=>[r.role,r.line,r.column,r.error]));
  sheet("Store Assignments",["Site Code","Canonical store","Employee ID","Resource","Role","Manager ID","Manager"],result.assignments.map(r=>[r.siteCode,r.canonicalName,r.employeeId,r.name,r.role,r.managerCode,r.manager]));
  sheet("Audit",["Property","Value"],Object.entries({state:result.status,adapter:result.adapter,customer:result.customer,periodStart:result.periodStart,periodEnd:result.periodEnd,...result.rules,...result.totals,...provenance}).map(([k,v])=>[k,typeof v==="object"?JSON.stringify(v):String(v??"")]));
  await wb.commit(); await finished;
  return Buffer.concat(chunks);
}
module.exports={readRaw,transform,exportWorkbook,CLICKS_HEADERS};
