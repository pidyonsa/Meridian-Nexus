'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const base = 'https://meridian-field-dashboards.azurewebsites.net';
const directory = path.resolve(__dirname, '../../.tmp/azure-dashboard-migration');
async function main() {
  const result = {at:new Date().toISOString(),base,checks:[],reports:{}};
  async function request(route, input) {
    const start = Date.now();
    const response = await fetch(base + route, {method:input ? 'POST' : 'GET', ...(input ? {headers:{'content-type':'application/json'},body:JSON.stringify(input)} : {}), signal:AbortSignal.timeout(120000)});
    const data = await response.json();
    assert.equal(response.status,200,route + ': ' + data.error);
    assert.equal(data.dataHosting?.provider,'Azure');
    assert.equal(data.dataHosting.refreshFailed,false);
    console.log(JSON.stringify({route,audience:input?.audience,mode:input?.mode || 'dashboard',status:response.status,ms:Date.now()-start}));
    return data;
  }
  const health = await request('/api/health');assert.equal(health.dataService,'azure-blob-snapshot');result.health=health;
  const orders = await request('/api/orders',{filters:{},sort:'newest',page:1,refresh:true});
  // Data refreshes daily, so check consistency with the published snapshot instead of fixed migration totals.
  assert.equal(orders.latestImport,health.dataHosting.ordersImportedAt);assert.ok(orders.version);
  assert.ok(orders.totals.orders>0&&orders.totals.lines>=orders.totals.orders&&orders.totals.amount>0,'Orders totals look empty');
  result.reports.orders={totals:orders.totals,latestImport:orders.latestImport,version:orders.version};
  result.checks.push('orders/live-totals-version');
  for (const audience of ['rep','merchandiser']) {
    const report = await request('/api/attendance',{audience,refresh:true});
    assert.equal(report.reportEndDate,health.dataHosting.attendanceThrough);assert.ok(report.version);
    assert.ok(report.metrics.scheduled>0&&report.metrics.attended<=report.metrics.scheduled,audience+' attendance totals inconsistent');
    const filters = {date:report.reportEndDate};
    const day = await request('/api/attendance',{audience,filters});
    const details = await request('/api/attendance',{audience,filters,mode:'detail',selection:{metric:'actual'},version:report.version});
    assert.equal(details.total,day.metrics.attended);
    const exported = await request('/api/attendance',{audience,filters,mode:'export',version:report.version});
    const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.base64,'base64'));
    assert.equal(workbook.getWorksheet('Visits').rowCount-1,day.metrics.scheduled);
    result.reports[audience]={through:report.reportEndDate,metrics:report.metrics,dayExportRows:day.metrics.scheduled};
    result.checks.push(audience+'/live-totals-day-detail-excel-version');
  }
  for (const route of ['/current.json','/snapshot.json.gz','/server/azure-reports.cjs','/server/report-engine/hierarchy.json','/api/import']) {
    const response=await fetch(base+route,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,404,route);await response.body.cancel();
  }
  result.checks.push('private-artifacts-not-web-routes');
  await fs.writeFile(path.join(directory,'live-verification.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({verified:true,checks:result.checks}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
