'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const base='https://meridian-field-dashboards.azurewebsites.net';
const stage=path.resolve(__dirname,'../../.tmp/azure-attendance-publisher-20260922');
async function main(){
  const status=JSON.parse(await fs.readFile(path.join(stage,'status.json'),'utf8'));
  const published=status.logs.find(row=>row.message?.event==='azure-attendance-publisher'&&row.message.status==='published')?.message;
  assert.ok(published,'A verified publisher success is required before checking the live dashboard');
  const previous=JSON.parse(await fs.readFile(path.resolve(__dirname,'../../.tmp/azure-dashboard-migration/verification.json'),'utf8'));
  const result={at:new Date().toISOString(),published,reports:{}};
  async function request(route,input){
    const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});
    const data=await response.json();assert.equal(response.status,200,data.error);assert.equal(data.dataHosting.provider,'Azure');assert.equal(data.dataHosting.refreshFailed,false);
    assert.equal(data.dataHosting.capturedAt,published.capturedAt);return data;
  }
  const orders=await request('/api/orders',{refresh:true});
  assert.deepEqual(orders.totals,previous.orders.totals);assert.equal(orders.version,previous.orders.version);result.ordersPreserved=true;
  for(const audience of ['rep','merchandiser']){
    const report=await request('/api/attendance',{audience,refresh:true}),expected=published.attendance[audience];
    assert.equal(report.reportEndDate,published.through);assert.equal(report.version,expected.version);
    assert.equal(report.metrics.scheduled,expected.scheduled);assert.equal(report.metrics.attended,expected.attended);
    const filters={date:report.reportEndDate},day=await request('/api/attendance',{audience,filters});assert.ok(day.metrics.scheduled>0);
    for(const metric of ['actual','missed','unknown']){
      const detail=await request('/api/attendance',{audience,filters,mode:'detail',selection:{metric},version:report.version});
      assert.equal(detail.total,day.metrics[{actual:'attended',missed:'missedVisits',unknown:'unknownVisits'}[metric]]);
      assert.ok(detail.rows.every(row=>row.date===report.reportEndDate));
    }
    const output=await request('/api/attendance',{audience,filters,mode:'export',version:report.version});
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(output.base64,'base64'));
    assert.equal(workbook.getWorksheet('Visits').rowCount-1,day.metrics.scheduled);
    result.reports[audience]={through:report.reportEndDate,metrics:report.metrics,latestDay:day.metrics,weekly:report.scheduleAnalytics?.weekly,exclusionRevision:report.quality?.exclusionRevision};
    console.log(JSON.stringify({audience,through:report.reportEndDate,scheduled:report.metrics.scheduled,attended:report.metrics.attended,latestDayScheduled:day.metrics.scheduled,latestDayAttended:day.metrics.attended,detailsAndExcelVerified:true}));
  }
  await fs.writeFile(path.join(stage,'live-verification.json'),JSON.stringify(result,null,2));
  console.log('Both live Attendance audiences, latest-day detail and Excel reconcile; Orders are unchanged.');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
