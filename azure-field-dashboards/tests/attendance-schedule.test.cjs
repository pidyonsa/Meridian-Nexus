'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const local=fs.readFileSync(path.resolve(__dirname,'../../functions/index.js'),'utf8');
const staged=path.resolve(__dirname,'../../.tmp/azure-attendance-publisher-20260922/scheduler-index.js');
for(const [name,code]of [['local',local],...(fs.existsSync(staged)?[['exact-production-stage',fs.readFileSync(staged,'utf8')]]:[])]){
  const range=code.match(/function defaultReportDatesForRetailer\([^]*?\n\}/)[0];
  const scheduled=code.match(/function scheduledReportDates\([^]*?\n\}/)[0];
  const context=vm.createContext({salesforceDisplayComplianceRetailerId:'display-compliance',isGeoRepAttendanceRetailer:id=>id==='geo-rep-attendance-for-reps',monthStart:date=>date.slice(0,7)+'-01'});
  vm.runInContext(range+'\n'+scheduled,context);
  test(name+': daily Geo Rep range includes weekends, month end, year end and leap day',()=>{
    for(const [today,start,end]of [
      ['2026-09-22','2026-09-01','2026-09-21'],['2026-09-21','2026-09-01','2026-09-20'],
      ['2026-10-01','2026-09-01','2026-09-30'],['2027-01-01','2026-12-01','2026-12-31'],['2028-03-01','2028-02-01','2028-02-29']
    ]){
      const result=context.scheduledReportDates({frequency:'daily',dateMode:'daily'},{date:today},'geo-rep-attendance-for-reps');
      assert.equal(result.startDate,start);assert.equal(result.endDate,end);
    }
  });
  test(name+': scheduler no longer skips the first day; keeps idempotency, disabled and due-time guards',()=>{
    const body=code.slice(code.indexOf('exports.runScheduledExtractions ='),code.indexOf('exports.runScheduledSalesforceMonthlyAttendancePlanSetup ='));
    assert.doesNotMatch(body,/now\.date\.endsWith\("-01"\)/);
    assert.match(body,/freshSchedule\.lastRunKey === runKey/);
    assert.match(body,/freshSchedule\.enabled !== true/);
    assert.match(body,/now\.minutes < scheduledMinutes/);
    assert.match(body,/scheduleFrequency: freshFrequency/);
  });
}
