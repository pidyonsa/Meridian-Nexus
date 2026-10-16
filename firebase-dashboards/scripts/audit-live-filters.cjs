'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ExcelJS=require('../backend/node_modules/exceljs'),O=require('../backend/vendor/orders.cjs');
const base='https://meridian-field-dashboards.web.app';
const audit={at:new Date().toISOString(),url:base,orders:[],attendance:{},requests:0};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function call(route,input){
  // Keep this read-only audit comfortably below the live per-minute limit.
  await pause(800);audit.requests++;
  let response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(125000)});
  if(response.status===429){await pause(61000);return call(route,input);}
  const data=await response.json();assert.equal(response.status,200,`${route}: ${data.error||response.status}`);return data;
}
const ids=rows=>rows.map(r=>r.id).sort();
async function orders(){
  const baseline=await call('orders',{includeCancelled:true,export:true}),rows=baseline.table.rows;
  assert.equal(rows.length,baseline.table.total);
  async function verify(input,expected,label){
    const d=await call('orders',{...input,export:true});
    assert.deepEqual(ids(d.table.rows),ids(expected),label);assert.deepEqual(d.totals,O.metrics(expected),label);
    for(const groups of Object.values(d.by))assert.equal(groups.reduce((n,g)=>n+g.lines,0),expected.length,label+'/groups');
    assert.equal(d.trend.reduce((n,g)=>n+g.lines,0),expected.length,label+'/trend');
    audit.orders.push({filter:label,lines:d.table.total});return d;
  }
  for(const [field,options]of Object.entries(baseline.options)){
    if(!options.length){audit.orders.push({filter:field,unavailable:true});continue;}
    for(const value of field==='status'?options:[options[0],options.at(-1)].filter((v,i,a)=>a.indexOf(v)===i)){
      await verify({filters:{[field]:value},includeCancelled:true},rows.filter(r=>r[field]===value),field);
    }
  }
  const cancelled=rows.filter(r=>r.cancelled);
  if(cancelled.length){const d=await verify({filters:{status:cancelled[0].status}},cancelled.filter(r=>r.status===cancelled[0].status),'cancelled-status-default');assert.equal(d.selection.includeCancelled,true);}
  const sample=rows.find(r=>!r.cancelled),filters=Object.fromEntries(['manager','banner','region','rep','storeName','product'].map(k=>[k,sample[k]]));
  const matches=r=>!r.cancelled&&Object.entries(filters).every(([k,v])=>!v||r[k]===v);
  await verify({filters},rows.filter(matches),'combined');
  await verify({filters,orderKey:sample.orderKey},rows.filter(r=>matches(r)&&r.orderKey===sample.orderKey),'combined-order-drilldown');
  await verify({start:sample.orderDate,end:sample.orderDate},rows.filter(r=>!r.cancelled&&r.orderDate===sample.orderDate),'single-day');
  await verify({filters:{banner:'__no_such_banner__'}},[],'no-results');
  await verify({query:sample.orderNumber},rows.filter(r=>!r.cancelled&&[r.orderNumber,r.poNumber,r.storeName,r.storeCode,r.product,r.sku,r.rep].join(' ').toLowerCase().includes(sample.orderNumber.toLowerCase())),'search');
  const sorted=await verify({sort:'quantity'},rows.filter(r=>!r.cancelled),'sort');assert.ok(sorted.table.rows.every((r,i,a)=>!i||(a[i-1].quantity??-Infinity)>=(r.quantity??-Infinity)));
  await verify({},rows.filter(r=>!r.cancelled),'reset');
  console.log(`Orders: ${audit.orders.length} filter/data checks passed, including cancellation, combinations, day, search, sort and exports.`);
}
async function attendance(audience){
  const baseline=await call('attendance',{audience}),result={filters:[],unavailable:[],combination:{}};audit.attendance[audience]=result;
  const mapping={region:'regions',manager:'managers',division:'divisions',role:'roles',banner:'banners',channel:'channels',brand:'brands'};
  const isMatch=(row,filters)=>Object.entries(filters).every(([k,v])=>!v||(k==='manager'?row.managerPath.includes(v):row[k]===v));
  for(const [field,key]of Object.entries(mapping)){
    const options=baseline.availableFilters[key]||[];
    if(!options.length){result.unavailable.push(field);continue;}
    const filters={[field]:options[0]},d=await call('attendance',{audience,filters});
    const detail=await call('attendance',{audience,mode:'detail',filters,version:d.version});
    assert.equal(detail.total,d.metrics.scheduled,field);assert.ok(detail.rows.every(r=>isMatch(r,filters)),field);
    for(const groups of [d.charts.byRegion,d.charts.byDivision,d.charts.byRole,d.scheduleAnalytics.daily,d.scheduleAnalytics.weekly])assert.equal(groups.reduce((n,g)=>n+g.scheduled,0),d.metrics.scheduled,field+'/groups');
    result.filters.push({field,options:options.length,records:d.metrics.scheduled});
  }
  const initial=await call('attendance',{audience,mode:'detail'}),sample=initial.rows[0];assert.ok(sample);
  const filters={region:sample.region,manager:sample.managerPath[0]||'',division:sample.division,role:sample.role};
  const d=await call('attendance',{audience,filters});
  for(const [metric,unit,key]of [['target','visits','scheduled'],['actual','visits','attended'],['missed','visits','missedVisits'],['missed','stores','missedStores']]){
    const details=await call('attendance',{audience,filters,mode:'detail',selection:{metric,unit},version:d.version});assert.equal(details.total,d.metrics[key],`${audience}/${metric}/${unit}`);
    if(unit==='visits')assert.ok(details.rows.every(r=>isMatch(r,filters)));
  }
  const selection={date:sample.date},details=await call('attendance',{audience,filters,mode:'detail',selection,version:d.version});
  const exported=await call('attendance',{audience,filters,mode:'export',selection,version:d.version});
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.base64,'base64'));
  const rows=book.getWorksheet('Visits').getSheetValues().slice(2).filter(Boolean);assert.equal(rows.length,details.total);assert.equal(exported.total,details.total);
  assert.ok(rows.every(r=>r[2]===sample.date&&r[11]===sample.region));
  const metadata=Object.fromEntries(book.getWorksheet('Selection').getSheetValues().filter(Boolean).map(r=>[r[1],r[2]]));
  assert.deepEqual(JSON.parse(metadata.filters),filters);assert.deepEqual(JSON.parse(metadata.selection),selection);
  result.combination={records:d.metrics.scheduled,dailyExportRecords:rows.length,drilldownsReconciled:true,excelReconciled:true};
  const empty=await call('attendance',{audience,filters:{region:'__no_such_region__'}});assert.equal(empty.metrics.scheduled,0);assert.equal(empty.stores.length,0);
  const reset=await call('attendance',{audience,filters:{}});assert.deepEqual(reset.metrics,baseline.metrics);
  console.log(`Attendance ${audience}: ${result.filters.length} populated filters, combinations, daily Excel and metric drilldowns passed; unavailable: ${result.unavailable.join(', ')}.`);
}
(async()=>{
  await orders();for(const audience of ['rep','merchandiser'])await attendance(audience);
  fs.writeFileSync(path.resolve(__dirname,'../test-results/live-filter-audit.json'),JSON.stringify(audit,null,2));
  console.log(`Live filter audit passed (${audit.requests} read-only requests).`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
