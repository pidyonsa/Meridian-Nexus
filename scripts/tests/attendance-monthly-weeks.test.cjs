"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ExcelJS = require("../../functions/node_modules/exceljs");
const backend = fs.readFileSync(process.env.ATTENDANCE_BACKEND_TEST_FILE || path.resolve(__dirname, "../../functions/index.js"), "utf8");
const ctx = vm.createContext({ Date, HttpsError: Error });
for (const name of ["optionalText", "optionalDate", "optionalAttendanceActualWeek", "dateStringInZone", "attendanceWeekStart", "smartSellWeek", "smartSellWeekForAttendanceDate", "smartSellWeekReferenceDate", "attendanceCellValue", "attendanceText", "attendanceHeader", "attendanceHeaderColumn", "salesforceDateValue", "attendanceDateValue", "attendanceMonthKey", "attendanceCalendarWeek", "attendanceCalendarWeeksInRange", "attendanceStoreCode", "attendanceNumericValue", "attendanceMonthlyActualColumn", "attendanceMonthlyTargetColumn", "setAttendancePlainNumberCell", "attendanceNeedsPlainNumberFormat", "excelColumnName", "updateMonthlyAttendanceActuals"]) {
  const fn = backend.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
  assert.ok(fn, name);
  vm.runInContext(fn[0], ctx);
}
test("September partial week and next Monday are different monthly weeks", () => {
  for (const [date, week] of [["2026-09-01",1],["2026-09-06",1],["2026-09-07",2],["2026-09-11",2],["2026-09-13",2],["2026-09-14",3],["2026-09-21",4],["2026-09-28",5],["2026-09-30",5]]) assert.equal(ctx.attendanceCalendarWeek(date), week, date);
  assert.deepEqual(Array.from(ctx.attendanceCalendarWeeksInRange("2026-09-01", "2026-09-11", "2026-09")), [1,2]);
});
test("Monday month starts and five-column month ends stay supported", () => {
  for (const [date, week] of [["2026-06-01",1],["2026-06-07",1],["2026-06-08",2],["2026-08-01",1],["2026-08-03",2],["2026-08-31",5]]) assert.equal(ctx.attendanceCalendarWeek(date), week, date);
});
function fixture() {
  const worksheet = new ExcelJS.Workbook().addWorksheet("South Africa Visit Plan");
  for (const [column, value] of [[1,"Month"],[2,"Resource: Employee Id"],[12,"Store: Store Code"]]) worksheet.getCell(1,column).value = value;
  for (const [column, value] of [[1,"2026-09-01"],[2,"EMP1"],[12,"S1"],[27,2],[28,3],[34,3],[35,0],[36,9]]) worksheet.getCell(2,column).value = value;
  worksheet.getCell(3,1).value="2026-08-01";
  worksheet.getCell(3,2).value="EMP1";
  worksheet.getCell(3,12).value="S1";
  worksheet.getCell(3,34).value=7;
  return worksheet;
}
const visits = ["2026-09-03", "2026-09-07", "2026-09-11"].map(visitDate => ({visitDate, employeeId:"EMP1", storeCode:"S1"}));
test("MTD reconciliation replaces polluted Week 1, fills Week 2, and is idempotent", () => {
  const worksheet=fixture();
  const run=()=>ctx.updateMonthlyAttendanceActuals({worksheet,visits,reportMonth:"2026-09",reconcileAllWeeks:true,weekStartDate:"2026-09-01",weekEndDate:"2026-09-11",replaceReportedWeeks:true});
  const first=run();
  assert.equal(worksheet.getCell(2,34).value,1);
  assert.equal(worksheet.getCell(2,35).value,2);
  assert.equal(first.actualWeekTotals[1],1);
  assert.equal(first.actualWeekTotals[2],2);
  assert.equal(worksheet.getCell(2,36).value,9,"later weeks untouched");
  assert.equal(worksheet.getCell(3,34).value,7,"other months untouched");
  assert.equal(run().updatedCells,0,"replay must not add visits twice");
});
test("covered week without visits clears stale actuals but not later weeks", () => {
  const worksheet=fixture();
  ctx.updateMonthlyAttendanceActuals({worksheet,visits:[],reportMonth:"2026-09",reconcileAllWeeks:true,weekStartDate:"2026-09-01",weekEndDate:"2026-09-11",replaceReportedWeeks:true});
  assert.equal(worksheet.getCell(2,34).value,0);
  assert.equal(worksheet.getCell(2,35).value,0);
  assert.equal(worksheet.getCell(2,36).value,9);
});
test("Friday replay uses the confirmed SmartSell cycle, not Monday's run date", () => {
  const reference=ctx.smartSellWeekReferenceDate({smartSellWeekUpdatedAt:{toDate:()=>new Date("2026-09-07T07:14:18.695Z")}});
  assert.equal(reference,"2026-09-07");
  assert.equal(ctx.smartSellWeekForAttendanceDate(1,"2026-09-11",reference),1);
  assert.equal(ctx.smartSellWeekForAttendanceDate(1,"2026-09-14",reference),2);
  assert.equal(ctx.smartSellWeekForAttendanceDate(1,"2026-09-04",reference),4);
  assert.equal(ctx.smartSellWeekForAttendanceDate(1,"2026-10-05",reference),1);
});
test("SmartSell confirmation timestamp is interpreted in Johannesburg", () => {
  assert.equal(ctx.smartSellWeekReferenceDate({smartSellWeekUpdatedAt:"2026-09-06T22:30:00Z"}),"2026-09-07");
  assert.throws(()=>ctx.smartSellWeekReferenceDate({smartSellWeekUpdatedAt:"invalid"}),/confirmation date is invalid/);
});
