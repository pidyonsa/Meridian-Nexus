'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {adapters, hash} = require('../server/snapshot-data.cjs');
const {createAzureReports, ReportError} = require('../server/azure-reports.cjs');
const {createService} = require('../../firebase-dashboards/backend/service.cjs');
const directory = path.resolve(__dirname, '../../.tmp/azure-dashboard-migration');
async function main() {
  const pointer = JSON.parse(await fs.readFile(path.join(directory,'current.json'),'utf8'));
  const bytes = await fs.readFile(path.join(directory,'snapshot.json.gz'));
  assert.equal(hash(bytes),pointer.sha256);
  const snapshot = JSON.parse(zlib.gunzipSync(bytes));
  const baseline = createService({...adapters(snapshot),ExcelJS,HttpsError:ReportError});
  const provider = createAzureReports({readBlob:async name => name === 'current.json' ? Buffer.from(JSON.stringify(pointer)) : bytes});
  const result = {checkedAt:new Date().toISOString(),snapshot:pointer.sha256,attendance:{},orders:{},checks:[]};
  async function attendance(input) {
    const expected = await baseline.attendance(input), actual = await provider.request('/api/attendance',input);
    assert.equal(actual.status,200,actual.data.error);
    const {dataHosting,...data} = actual.data;
    assert.equal(dataHosting.provider,'Azure');assert.deepEqual(data,expected);
    return data;
  }
  for (const audience of ['rep','merchandiser']) {
    const report = await attendance({audience});
    const all = await attendance({audience,mode:'detail',version:report.version});
    assert.equal(all.total,report.metrics.scheduled);
    assert.equal(report.metrics.attended + report.metrics.missedVisits + report.metrics.unknownVisits,report.metrics.scheduled);
    let regionCount = 0;
    for (const region of report.availableFilters.regions) regionCount += (await attendance({audience,filters:{region}})).metrics.scheduled;
    assert.equal(regionCount,report.metrics.scheduled);
    const filters = {date:report.reportEndDate};
    const day = await attendance({audience,filters});
    for (const metric of ['actual','missed','unknown']) {
      const details = await attendance({audience,filters,mode:'detail',selection:{metric}});
      assert.equal(details.total,day.metrics[{actual:'attended',missed:'missedVisits',unknown:'unknownVisits'}[metric]]);
    }
    const exported = await provider.request('/api/attendance',{audience,filters,mode:'export',version:report.version});
    assert.equal(exported.status,200,exported.data.error);
    const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.data.base64,'base64'));
    assert.equal(workbook.getWorksheet('Visits').rowCount-1,day.metrics.scheduled);
    assert.equal((await provider.request('/api/attendance',{audience,mode:'export',version:'old'})).status,409);
    result.attendance[audience] = {through:report.reportEndDate,metrics:report.metrics,version:report.version,dayExportRows:day.metrics.scheduled};
    result.checks.push(audience+'/totals-regions-day-details-excel-version');
    console.log(JSON.stringify({audience,scheduled:report.metrics.scheduled,attended:report.metrics.attended,through:report.reportEndDate,verified:true}));
  }
  for (const input of [{},{includeCancelled:true,export:true},{filters:{client:'aQuelle'}},{start:'2025-10-01',end:'2026-09-30',granularity:'month'}]) {
    const expected = await baseline.orders(input), actual = await provider.request('/api/orders',input);
    assert.equal(actual.status,200,actual.data.error);
    const {dataHosting,...data} = actual.data;
    expected.source = expected.source.replace('isolated Firebase viewer import','verified import hosted on Azure');
    assert.deepEqual(data,expected);
    if (!Object.keys(input).length) result.orders = {totals:data.totals,version:data.version,latestImport:data.latestImport};
    if (input.export) {
      assert.equal(data.totals.lines,data.table.rows.length);
      assert.equal(data.totals.orders,new Set(data.table.rows.map(row=>row.orderKey).filter(Boolean)).size);
      if (data.totals.amount !== null) assert.equal(Math.round(data.totals.amount*100),Math.round(data.table.rows.reduce((sum,row)=>sum+row.value,0)*100));
    }
  }
  result.checks.push('orders/default-cancelled-full-export-client-12months');
  assert.equal(result.orders.totals.lines,3681,'Reconcile against the successful pre-outage source response.');
  assert.equal(result.orders.totals.orders,229);
  assert.equal(result.orders.totals.units,16198);
  assert.equal(result.orders.totals.amount,2368509.69);
  await fs.writeFile(path.join(directory,'verification.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({orders:result.orders,checks:result.checks,verified:true}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
