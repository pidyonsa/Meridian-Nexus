'use strict';
const A=require('../backend/vendor/attendance.cjs'),O=require('../backend/vendor/orders.cjs');
const ExcelJS=require('../backend/node_modules/exceljs');
class ReportError extends Error {constructor(code,message){super(message);this.code=code;}}
const rawOrders=Array.from({length:80},(_,i)=>({id:`test-line-${i}`,orderNumber:`Order ${Math.floor(i/2)}`,orderDate:`2026-${i<64?'09':'08'}-${String(i%12+1).padStart(2,'0')}`,storeCode:`Store ${i%6}`,storeName:`Store ${i%6}`,rep:`Rep ${i%4}`,manager:`Manager ${i%2}`,region:['Gauteng','Free State'][i%2],product:`Product ${i%5}`,sku:`SKU ${i%5}`,status:['Processed','Ordered','Pre-Ordered','Cancelled'][i%4],banner:`Banner ${i%3}`,channel:`Channel ${i%2}`,client:`Client ${i%2}`,brand:i<64?`Brand ${i%2}`:'August Brand',category:`Category ${i%3}`,currency:'ZAR',quantity:i+1,value:(i+1)*10.25,unitPrice:10.25,mapped:true,importedAt:'2026-09-14T10:00:00Z'}));
const orders=rawOrders.map(r=>O.normalise({id:r.id,data:()=>r}));
const hierarchy={rows:[0,1,2,3].map(i=>({name:`Rep ${i}`,manager:`Manager ${i%2}`,regionalManager:'Regional Manager',region:['Gauteng','Free State'][i%2],assignment:'syndicated'})),sourceName:'Synthetic test hierarchy',sha256:'fixture'};
const datasets=Object.fromEntries(['rep','merchandiser'].map(audience=>{
  const visits=Array.from({length:48},(_,i)=>({id:`${audience}-${i}`,date:`2026-09-${String(i%12+1).padStart(2,'0')}`,week:`Week ${Math.ceil((i%12+1)/7)}`,userName:audience==='rep'?`Rep ${i%4}`:`Merchandiser ${i%4}`,userCode:`${audience}-${i%4}`,manager:audience==='rep'?`Manager ${i%2}`:`Rep ${i%4}`,role:audience==='rep'?(i%2?'Sales Rep':'Team Leader'):(i%2?'Merchandiser':'In Car Merchandiser'),region:['Gauteng','Free State'][i%2],storeCode:`Store ${i%6}`,storeName:`Store ${i%6}`,banner:`Banner ${i%3}`,channel:`Channel ${i%2}`,brand:`Brand ${i%2}`,result:['Visited','Not Visited','Early visit on: 2026-09-01','Caught up on: 2026-09-13','Pending'][i%5]}));
  return [audience,A.buildDataset({visits,hierarchy,audience,version:'fixture',source:{reportStartDate:'2026-09-01',reportEndDate:'2026-09-12'}})];
}));
function fixtureService(){return {
  async orders(input={}){const result=O.report(orders,O.selection(input,'2026-09',ReportError),'2026-09');result.groupCounts=Object.fromEntries(Object.entries(result.by).map(([key,rows])=>[key,rows.length]));return result;},
  async attendance(input={}){
    const audience=input.audience||'rep',dataset=datasets[audience],filters=input.filters||{},selection=input.selection||{};
    if(!input.mode||input.mode==='dashboard')return A.dashboard(dataset,filters);
    const d=A.detail(dataset,filters,selection);
    if(input.mode==='export'){const bytes=await A.excel(d,{audience,filters,selection,version:dataset.version},ExcelJS);return {base64:bytes.toString('base64'),fileName:'Attendance-test.xlsx',total:d.total};}
    const page=input.page||1;return {...d,rows:d.rows.slice((page-1)*100,page*100),page,pageCount:Math.max(1,Math.ceil(d.total/100)),version:dataset.version};
  }
};}
module.exports={fixtureService,orders,datasets,ReportError};
