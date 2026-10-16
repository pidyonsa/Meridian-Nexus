'use strict';
const O=require('./vendor/orders.cjs');
const PROVINCES={GAUTENG:'Gauteng',WESTERNCAPE:'Western Cape',SWD:'Western Cape',KWAZULUNATAL:'KwaZulu-Natal',MPUMALANGA:'Mpumalanga',LIMPOPO:'Limpopo',FREESTATE:'Free State',NORTHWEST:'North West',NORTHERNCAPE:'Northern Cape',EASTERNCAPE:'Eastern Cape',EASTLONDON:'Eastern Cape',PORTELIZABETH:'Eastern Cape'};
const DIVISIONS={'Free State':'Central','North West':'Central',Gauteng:'Inland',Mpumalanga:'Inland',Limpopo:'Inland','Western Cape':'Coastal','KwaZulu-Natal':'Coastal','Eastern Cape':'Coastal'};
const province=region=>PROVINCES[String(region||'').toUpperCase().replace(/[^A-Z]/g,'')]||'';
const enrich=rows=>rows.map(row=>({...row,province:province(row.region)}));
function grouped(rows,key) {
  const groups=new Map();
  for(const row of rows){const label=key(row);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(row);}
  return [...groups].map(([label,items])=>({label,...O.metrics(items)}));
}
function analytics(rows,report) {
  const provinces=grouped(rows,row=>row.province||'Outside mapped provinces');
  const divisions=grouped(rows,row=>DIVISIONS[row.province]||'Other / unassigned');
  const periods=report.trend.map(({label,start,end})=>({label,start,end}));
  const buckets=new Map(periods.map(p=>[p.label,[]]));
  for(const row of rows){
    const p=periods.find(p=>row.orderDate>=p.start&&row.orderDate<=p.end);
    if(p)buckets.get(p.label).push(row);
  }
  const series=periods.map(p=>({...p,regions:grouped(buckets.get(p.label),row=>row.region||'Unmapped')}));
  return {schema:1,provinces,divisions,series,granularity:report.trendKey,mapped:O.metrics(rows.filter(row=>row.province)),unmapped:O.metrics(rows.filter(row=>!row.province))};
}
function report(rows,selection,period) {
  // Reuse the reader's exact filtering and ordering before restoring normal pagination.
  const result=O.report(rows,{...selection,export:true},period);
  result.regionalAnalytics=analytics(result.table.rows,result);
  result.selection.export=selection.export;
  if(!selection.export)result.table.rows=result.table.rows.slice((result.table.page-1)*50,result.table.page*50);
  return result;
}
module.exports={province,enrich,analytics,report};
