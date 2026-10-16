"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ExcelJS = require("../../functions/node_modules/exceljs");
const { parseAttendanceRawReportName: parse, selectAttendanceRawReport: select, attendanceRawReportCoverage: coverage, MAX_REPORT_BYTES, ATTENDANCE_RAW_SOURCE } = require("../../functions/attendance-sharepoint-source");
const backend = fs.readFileSync(process.env.ATTENDANCE_BACKEND_TEST_FILE || path.join(__dirname, "../../functions/index.js"), "utf8");
const name = "Updated South Africa Attendance Report-2026-09-08-13-11-12.xlsx";
const file = (extra = {}) => ({ id: "item1", name, eTag: "v1", size: 100, file: {}, lastModifiedDateTime: "2026-09-08T11:12:40Z", ...extra });
const request = { type: "daily", startDate: "2026-09-07", today: "2026-09-09", now: "2026-09-09T06:00:00Z" };
const metadata = ["As of 2026-09-08 13:11:12 South Africa Standard Time/SAST", "Visit Date greater or equal 9/1/2026"];
const range = { startDate: "2026-09-01", endDate: "2026-09-07" };
function extract(name) {
  const match = backend.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
  assert.ok(match, name);
  return match[0];
}

test("parses the actual linked raw report, treating its date as SAST export time", () => {
  assert.deepEqual(parse(name), { exportDate: "2026-09-08", exportedAt: "2026-09-08T13:11:12+02:00" });
  assert.deepEqual(parse(name.replace(".xlsx", " (12).XLSX")), parse(name));
  for (const suffix of [" (0)", " (-1)", " latest", " (1) extra"]) assert.equal(parse(name.replace(".xlsx", `${suffix}.xlsx`)), null);
  for (const bad of [`~$${name}`, name.replace("09-08", "02-30"), name.replace("13-11-12", "24-00-00"), name.replace("13-11-12", "13-60-00"), name.replace("13-11-12", "13-11-60"), `${name}.exe`, "Daily Attendance Blueprint.xlsx"]) assert.equal(parse(bad), null);
});

test("both report types select the newest export from the last of five pages containing 1000 files", async () => {
  const items = Array.from({ length: 999 }, (_, index) => file({ id: `old-${index}`, name: `Updated South Africa Attendance Report-2026-09-07-${String(Math.floor(index / 3600)).padStart(2, "0")}-${String(Math.floor(index / 60) % 60).padStart(2, "0")}-${String(index % 60).padStart(2, "0")}.xlsx`, lastModifiedDateTime: "2026-09-09T05:59:59Z" }));
  items.push(file({ id: "latest-final-page", name: name.replace(".xlsx", " (1).xlsx") }));
  for (const type of ["Rep Attendance Daily", "Rep Attendance Monthly"]) {
    let page = 0;
    const context = { ATTENDANCE_RAW_SOURCE, sharePointAccessToken: async () => "token", salesforceReportType: () => type,
      effectiveReportDatesForRun: () => range, dateStringInZone: () => request.today,
      selectAttendanceRawReport: (all, input) => select(all, { ...input, now: request.now }), attendanceSharePointVersion: () => "version",
      retryableGraphRequest: async () => ({ value: items.slice(page * 200, ++page * 200), ...(page < 5 ? { "@odata.nextLink": `https://graph.microsoft.com/v1.0/page${page}` } : {}) }) };
    const resolve = vm.runInNewContext(`(${extract("resolveSalesforceAttendanceSharePointSource")})`, context);
    assert.equal((await resolve({})).item.id, "latest-final-page");
    assert.equal(page, 5);
  }
});

test("SAST midnight and same-day time ordering determine eligibility, not UTC calendar dates", () => {
  const midnight = file({ name: "Updated South Africa Attendance Report-2026-09-09-00-00-01.xlsx" });
  const after = { ...request, now: "2026-09-08T22:00:02Z" };
  assert.equal(select([file(), midnight], after).period.exportDate, "2026-09-09");
  assert.equal(select([file(), midnight], { ...after, now: "2026-09-08T22:00:00Z" }).period.exportDate, "2026-09-08");
  const later = file({ id: "later", name: name.replace("13-11-12", "14-00-00"), lastModifiedDateTime: "2026-09-08T12:01:00Z" });
  assert.equal(select([file({ lastModifiedDateTime: "2026-09-09T05:00:00Z" }), later], request).item.id, "later");
});

test("daily and monthly choose newest filename timestamp, not upload time or old output folders", () => {
  const older = file({ id: "older", name: name.replace("09-08", "09-07"), lastModifiedDateTime: "2026-09-09T05:00:00Z" });
  const items = [older, file(), file({ name: "Salesforce_PG_Rep_Attendance_Daily_2026-09-07_onwards.xlsx" })];
  for (const req of [request, { ...request, ...range, type: "monthly" }]) assert.equal(select(items, req).item.id, "item1");
});

test("excludes future timestamps, temporary/deleted/folder items and rejects invalid requests", () => {
  for (const item of [file({ name: name.replace("09-08", "09-10") }), file({ name: name.replace("09-08-13", "09-09-23") }), file({ folder: {} }), file({ deleted: {} }), file({ file: undefined })]) assert.throws(() => select([item], request), /No recognised/);
  for (const req of [{ ...request, startDate: "2026-02-30" }, { ...request, type: "monthly", startDate: "2026-08-31", endDate: "2026-09-07" }, { ...request, now: "invalid" }]) assert.throws(() => select([file()], req), /valid daily/);
});

test("latest corrupt metadata and ambiguous versions stop without falling back", () => {
  const older = file({ name: name.replace("09-08", "09-07") });
  for (const extra of [{ eTag: "" }, { id: "" }, { size: 0 }, { size: MAX_REPORT_BYTES + 1 }, { size: "bad" }]) assert.throws(() => select([older, file(extra)], request), /No older/);
  assert.throws(() => select([file(), file({ id: "other" })], request), /Multiple/);
});

test("uses the declared Salesforce start filter, never min visit date, for monthly coverage", () => {
  assert.deepEqual(coverage(metadata, parse(name), range), { startDate: "2026-09-01", endDate: "2026-09-08", completeThrough: "2026-09-07", exportedAt: "2026-09-08T13:11:12+02:00" });
  assert.throws(() => coverage(metadata, parse(name), { ...range, startDate: "2026-08-31" }), /covers completed days/);
  assert.throws(() => coverage(metadata, parse(name), { ...range, endDate: "2026-09-08" }), /export day is partial/);
  const next = name.replace("09-08", "09-09");
  assert.equal(coverage([metadata[0].replace("09-08", "09-09"), metadata[1]], parse(next), { ...range, endDate: "2026-09-08" }).completeThrough, "2026-09-08");
});

test("renamed, filtered or unverified workbooks cannot pass a filename-only check", () => {
  for (const lines of [[], [metadata[0]], [metadata[0].replace("13:11:12", "14:11:12"), metadata[1]], [metadata[0].replace("SAST", "UTC"), metadata[1]], [metadata[0], "Visit Date greater or equal 2/30/2026"], [...metadata, "Visit Date less than 9/3/2026"]]) assert.throws(() => coverage(lines, parse(name), range), /No workbook was changed/);
});

async function reader({ startDate = "2026-09-07", endDate = "", type = "daily", filter = metadata[1], asOf = metadata[0], dates = ["2026-09-01", "2026-09-07", "2026-09-08"], changed = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Updated South Africa Attendance");
  sheet.getCell("D3").value = asOf;
  sheet.getCell("D8").value = filter;
  sheet.getRow(11).values = ["Store Code", "Employee Id", "Visit Date", "CheckIn Location Compliance", "CheckOut Location Compliance"];
  dates.forEach(date => sheet.addRow(["TEST_STORE", "TEST_EMPLOYEE", date, 1, 0]));
  const context = vm.createContext({
    path, Date, attendanceRawReportCoverage: coverage,
    ExcelJS: { Workbook: class { constructor() { this.worksheets = workbook.worksheets; this.xlsx = { readFile: async () => {} }; } } },
    downloadSharePointDriveItem: async () => ({ size: 100 }),
    graphRequest: async () => ({ size: 100, eTag: changed ? "v2" : "v1" }),
    effectiveReportDatesForRun: () => ({ startDate, endDate }),
    salesforceReportType: () => type === "monthly" ? "Rep Attendance Monthly" : "Rep Attendance Daily",
    dateStringInZone: () => "2026-09-09"
  });
  for (const fn of ["attendanceCellValue", "attendanceText", "attendanceHeader", "attendanceHeaderColumn", "attendanceWorksheetHeader", "attendanceWorksheet", "salesforceDateValue", "attendanceDateValue", "readSalesforceAttendanceSharePointSource"]) vm.runInContext(extract(fn), context);
  return context.readSalesforceAttendanceSharePointSource({ item: file(), period: parse(name), accessToken: "token", driveId: ATTENDANCE_RAW_SOURCE.driveId, folderPath: ATTENDANCE_RAW_SOURCE.folderPath, version: "v1" }, "temp", {});
}

test("raw workbook reader preserves source and passes only requested-day counts to daily", async () => {
  const result = await reader();
  assert.equal(result.rowCount, 3);
  assert.equal(result.sourceSharePoint.matchingRows, 1);
  assert.equal(result.sourceSharePoint.reportStartDate, "2026-09-01");
  assert.equal(result.sourceSharePoint.completeThrough, "2026-09-07");
  assert.equal(result.name, name);
});

test("monthly accepts completed ranges including non-visit days, but not the partial export day", async () => {
  const result = await reader({ ...range, type: "monthly" });
  assert.equal(result.sourceSharePoint.matchingRows, 2);
  await assert.rejects(reader({ ...range, endDate: "2026-09-08", type: "monthly" }), /export day is partial/);
  await assert.rejects(reader({ startDate: "2026-09-08" }), /export day is partial/);
});

test("raw reader rejects mismatched header, modified version, out-of-filter and missing visits", async () => {
  await assert.rejects(reader({ asOf: metadata[0].replace("13:11:12", "13:12:12") }), /timestamp/);
  await assert.rejects(reader({ changed: true }), /changed while being read/);
  await assert.rejects(reader({ dates: ["2026-08-31", "2026-09-07"] }), /Visit Dates disagree/);
  await assert.rejects(reader({ dates: ["2026-09-09", "2026-09-07"] }), /Visit Dates disagree/);
  await assert.rejects(reader({ dates: ["2026-09-01"] }), /no readable visits/);
});

test("both source resolvers stay inside the approved raw folder and fail unsafe/incomplete paging", async () => {
  for (const type of ["Rep Attendance Daily", "Rep Attendance Monthly"]) {
    const urls = [];
    const context = { ATTENDANCE_RAW_SOURCE, sharePointAccessToken: async () => "token", salesforceReportType: () => type,
      effectiveReportDatesForRun: () => range, dateStringInZone: () => request.today,
      selectAttendanceRawReport: (items, input) => select(items, { ...input, now: request.now }),
      attendanceSharePointVersion: () => "version", retryableGraphRequest: async (_, url) => { urls.push(url); return { value: [file()] }; } };
    const resolve = vm.runInNewContext(`(${extract("resolveSalesforceAttendanceSharePointSource")})`, context);
    await resolve({});
    assert.ok(urls[0].startsWith(`/drives/${ATTENDANCE_RAW_SOURCE.driveId}/items/${ATTENDANCE_RAW_SOURCE.folderId}/children?`));
    context.retryableGraphRequest = async () => ({ value: [file()], "@odata.nextLink": "https://other.example/page" });
    await assert.rejects(resolve({}), /Unexpected/);
    context.retryableGraphRequest = async () => ({ value: [file()], "@odata.nextLink": "https://graph.microsoft.com/v1.0/repeated" });
    await assert.rejects(resolve({}), /incomplete listing/);
  }
});
