'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ExcelJS=require('../backend/node_modules/exceljs');
const base=process.env.PUBLIC_VIEWER_URL||'https://meridian-field-dashboards.web.app',dir=process.env.VIEWER_TEST_RESULTS_DIR||path.resolve(__dirname,'../../.tmp/public-dashboards-20260914');
async function call(route,body,method=body?'POST':'GET'){
  const started=Date.now(),r=await fetch(base+route,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(125000)});
  const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
  return {status:r.status,data,ms:Date.now()-started,headers:r.headers};
}
async function main(){
  fs.mkdirSync(dir,{recursive:true});
  const audit={at:new Date().toISOString(),url:base,attendance:{},orders:{},security:[]};
  const health=await call('/api/health');assert.equal(health.status,200);assert.equal(health.data.readOnly,true);
  for(const audience of ['rep','merchandiser']){
    const result=await call('/api/attendance',{audience});assert.equal(result.status,200,JSON.stringify(result.data));const d=result.data;
    assert.ok(!d.tracker&&!d.source);assert.ok(!JSON.stringify(d).includes('sharepoint.com'));
    const detail=await call('/api/attendance',{audience,mode:'detail',selection:{metric:'actual'},version:d.version});assert.equal(detail.status,200);assert.equal(detail.data.total,d.metrics.attended);
    const missed=await call('/api/attendance',{audience,mode:'detail',selection:{metric:'missed',unit:'stores'},version:d.version});assert.equal(missed.status,200);assert.equal(missed.data.total,d.metrics.missedStores);
    const day=d.scheduleAnalytics.daily.find(r=>r.attended>0).label,filters={date:day},selection={metric:'actual'};
    const selected=await call('/api/attendance',{audience,mode:'detail',filters,selection,version:d.version});assert.equal(selected.status,200);
    const exported=await call('/api/attendance',{audience,mode:'export',filters,selection,version:d.version});assert.equal(exported.status,200,JSON.stringify(exported.data));
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.data.base64,'base64'));assert.equal(workbook.getWorksheet('Visits').rowCount-1,selected.data.total);
    audit.attendance[audience]={period:[d.reportStartDate,d.reportEndDate],metrics:d.metrics,brands:d.availableFilters.brands,loadMs:result.ms,drilldownsReconciled:true,exportReconciled:true};
  }
  const orders=await call('/api/orders',{});assert.equal(orders.status,200);const d=orders.data;
  const exported=await call('/api/orders',{...d.selection,export:true});assert.equal(exported.status,200);assert.equal(exported.data.table.rows.length,d.table.total);
  assert.equal(Math.round(exported.data.table.rows.reduce((n,r)=>n+r.value,0)*100)/100,d.totals.amount);
  assert.ok(exported.data.table.rows.every(r=>!r.email&&!r.signature&&!r.photo));
  const banner=d.options.banner[0],filtered=await call('/api/orders',{filters:{banner},export:true});assert.equal(filtered.status,200);assert.ok(filtered.data.table.rows.every(r=>r.banner===banner));
  audit.orders={totals:d.totals,source:d.source,importedAt:d.latestImport,sourceCoverage:d.sourceCoverage,loadMs:orders.ms,exportReconciled:true,bannerFilterVerified:true};
  for(const [route,method,status]of [['/api/admin','POST',404],['/api/import/orders','POST',404],['/api/files','POST',404],['/api/orders','DELETE',405],['/api/attendance','PUT',405]]){
    const r=await call(route,{},method);assert.equal(r.status,status);audit.security.push({route,method,status:r.status});
  }
  for(const route of ['/attendance','/attendance/merchandiser/stores','/franchise-orders','/franchise-orders/trend']){const r=await call(route);assert.equal(r.status,200);assert.ok(r.data.includes('viewer.js'));assert.ok(r.headers.get('x-robots-tag')?.includes('noindex'));}
  fs.writeFileSync(path.join(dir,'public-live-verification.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
