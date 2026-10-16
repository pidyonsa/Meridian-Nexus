const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sourceModule = require("../../functions/attendance-sharepoint-source");
const { automationPlaybookForRun } = require("../../functions/automation-playbooks");
const backend = fs.readFileSync(process.env.ATTENDANCE_BACKEND_TEST_FILE || path.join(__dirname, "../../functions/index.js"), "utf8");
const { parseAttendanceReportName: parse, selectAttendanceSharePointReport: select, attendanceSharePointVersion: version } = sourceModule;
const dailyName = "Salesforce_PG_Rep_Attendance_Daily_2026-09-07_onwards.xlsx";
const monthlyName = "Salesforce_PG_Rep_Attendance_Monthly_2026-09-01_to_2026-09-07_Refresh_ef092df1_3a3.xlsx";
const file = (name, extra = {}) => ({ id: name, name, size: 100, eTag: "v1", file: {}, lastModifiedDateTime: "2026-09-08T06:57:10Z", ...extra });
const daily = { type: "daily", startDate: "2026-09-07", today: "2026-09-08" };
const monthly = { type: "monthly", startDate: "2026-09-01", endDate: "2026-09-07", today: "2026-09-08" };
function extract(name) {
  const match = backend.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
  assert.ok(match, name);
  return match[0];
}

test("parses the daily and monthly filenames actually present in SharePoint", () => {
  assert.deepEqual(parse(dailyName), { type: "daily", startDate: "2026-09-07", endDate: "" });
  assert.deepEqual(parse(monthlyName), { type: "monthly", startDate: "2026-09-01", endDate: "2026-09-07" });
});
test("ignores blueprints, tests, PBIX, invalid dates, reversed dates and temp files", () => {
  for (const name of ["Daily Attendance Blueprint.xlsx", "Rep Attendance Test.xlsx", "Daily Attendance.pbix", `~$${dailyName}`,
    dailyName.replace("09-07", "02-30"), monthlyName.replace("09-07", "08-31"), monthlyName.replace("09-07", "10-01"),
    dailyName.replace("Daily", "Monthly"), `${dailyName}.exe`]) assert.equal(parse(name), null, name);
});
test("daily requires the requested day, not the newest upload or any older report", () => {
  const old = file(dailyName.replace("09-07", "09-04"), { lastModifiedDateTime: "2026-09-09T10:00:00Z" });
  assert.equal(select([old, file(dailyName), file(monthlyName)], daily).item.name, dailyName);
  assert.throws(() => select([old], daily), /No SharePoint daily attendance export covers 2026-09-07/);
});
test("historical daily runs select the historical date instead of today's latest", () => {
  const old = dailyName.replace("09-07", "09-04");
  assert.equal(select([file(dailyName), file(old)], { ...daily, startDate: "2026-09-04" }).item.name, old);
});
test("monthly requires full range coverage and chooses latest report period first", () => {
  const old = monthlyName.replace("09-07", "09-05");
  assert.equal(select([file(old, { lastModifiedDateTime: "2026-09-09T10:00:00Z" }), file(monthlyName)], monthly).item.name, monthlyName);
  assert.throws(() => select([file(old)], monthly), /No SharePoint monthly/);
  assert.equal(select([file(monthlyName)], { ...monthly, startDate: "2026-09-03", endDate: "2026-09-05" }).item.name, monthlyName);
  assert.throws(() => select([file(monthlyName)], { ...monthly, endDate: "2026-09-08" }), /No SharePoint monthly/);
});
test("rejects future exports and invalid or cross-month requests", () => {
  assert.throws(() => select([file(dailyName.replace("09-07", "09-09"))], { ...daily, startDate: "2026-09-09" }), /No SharePoint daily/);
  assert.throws(() => select([file(monthlyName)], { ...monthly, startDate: "2026-08-31" }), /single-month/);
  assert.throws(() => select([], { ...daily, startDate: "2026-02-30" }), /valid daily/);
});
test("versions use modification time only within a period, ambiguous versions fail", () => {
  const old = file(dailyName, { id: "older", lastModifiedDateTime: "2026-09-07T01:00:00Z" });
  assert.equal(select([old, file(dailyName)], daily).item.id, dailyName);
  assert.throws(() => select([file(dailyName), file(dailyName, { id: "another" })], daily), /Multiple SharePoint/);
});
test("invalid latest source is not silently replaced with an older valid file", () => {
  for (const extra of [{ size: 0 }, { size: sourceModule.MAX_REPORT_BYTES + 1 }, { eTag: "" }, { size: "bad" }]) {
    assert.throws(() => select([file(dailyName, extra), file(dailyName, { lastModifiedDateTime: "2026-09-01T00:00:00Z" })], daily), /No older export/);
  }
  assert.throws(() => select([file(dailyName, { folder: {} })], daily), /No SharePoint/);
});
test("a changed SharePoint file version gets a new source identity", () => {
  const a = file(dailyName);
  assert.equal(version("drive", a), version("drive", a));
  assert.notEqual(version("drive", a), version("drive", { ...a, eTag: "v2" }));
  assert.notEqual(version("drive", a), version("other-drive", a));
});

test("folder resolution pages all results and uses the linked Raw Data folder", async () => {
  const paths = [];
  const resolve = vm.runInNewContext(`(${extract("resolveSalesforceAttendanceSharePointSource")})`, {
    salesforceReportType: () => "Rep Attendance Daily",
    ATTENDANCE_RAW_SOURCE: sourceModule.ATTENDANCE_RAW_SOURCE,
    sharePointAccessToken: async () => "token",
    encodeGraphPath: value => value.split("/").map(encodeURIComponent).join("/"),
    retryableGraphRequest: async (_, url) => {
      paths.push(url);
      return paths.length === 1 ? { value: [file("Daily Attendance Blueprint.xlsx")], "@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/drive/next" } : { value: [file("Updated South Africa Attendance Report-2026-09-08-13-11-12.xlsx")] };
    },
    effectiveReportDatesForRun: () => ({ startDate: daily.startDate, endDate: "" }),
    dateStringInZone: () => daily.today, selectAttendanceRawReport: sourceModule.selectAttendanceRawReport, attendanceSharePointVersion: version
  });
  const result = await resolve({});
  assert.equal(result.item.name, "Updated South Africa Attendance Report-2026-09-08-13-11-12.xlsx");
  assert.ok(paths[0].includes(`/items/${sourceModule.ATTENDANCE_RAW_SOURCE.folderId}/children?`));
  assert.equal(paths.length, 2);
  assert.equal(result.folderPath, sourceModule.ATTENDANCE_RAW_SOURCE.folderPath);
});

function readerHarness({ dates = ["2026-09-07", "2026-09-08"], changed = false, size = 100, schemaError = false } = {}) {
  const item = file(dailyName);
  const source = { accessToken: "token", driveId: "drive", folderPath: "Daily", item, version: "v1", period: parse(dailyName) };
  const read = vm.runInNewContext(`(${extract("readSalesforceAttendanceSharePointSource")})`, {
    path, downloadSharePointDriveItem: async () => ({ size }),
    graphRequest: async () => ({ size: 100, eTag: changed ? "v2" : "v1" }),
    ExcelJS: { Workbook: class { constructor() { this.xlsx = { readFile: async () => {} }; } } },
    attendanceWorksheet: () => {
      if (schemaError) throw new Error("Required attendance columns missing");
      return { rowNumber: 1, columns: { visitDate: 1 }, worksheet: { rowCount: dates.length + 1, getRow: n => ({ getCell: () => ({ value: dates[n - 2] }) }) } };
    },
    attendanceDateValue: value => value,
    effectiveReportDatesForRun: () => ({ startDate: "2026-09-07", endDate: "" }),
    salesforceReportType: () => "Rep Attendance Daily", dateStringInZone: () => "2026-09-08"
  });
  return () => read(source, "temp", {});
}
test("daily source validation retains raw bytes and counts only the target date for the handoff", async () => {
  const result = await readerHarness()();
  assert.equal(result.rowCount, 2);
  assert.equal(result.sourceSharePoint.matchingRows, 1);
  assert.equal(result.sourceSharePoint.maxVisitDate, "2026-09-08");
  assert.equal(result.name, dailyName);
});
test("source validation refuses changing, truncated, malformed and wrong-period workbooks", async () => {
  await assert.rejects(readerHarness({ changed: true })(), /changed while being read/);
  await assert.rejects(readerHarness({ size: 90 })(), /changed while being read/);
  await assert.rejects(readerHarness({ schemaError: true })(), /columns missing/);
  await assert.rejects(readerHarness({ dates: ["2026-09-04"] })(), /disagree with the dated filename/);
  await assert.rejects(readerHarness({ dates: ["2026-09-09"] })(), /disagree with the dated filename/);
  await assert.rejects(readerHarness({ dates: ["2026-09-08"] })(), /no readable visits for 2026-09-07/);
  await assert.rejects(readerHarness({ dates: [] })(), /no readable visits/);
});

function handlerHarness({ monthlyRun = false, sourceError = null, duplicate = false, cancel = false } = {}) {
  const run = { retailerId: monthlyRun ? "sales-force-p-g-monthly" : "sales-force-p-g", retailerName: "Attendance", extractionName: monthlyRun ? "Rep Attendance Monthly" : "Rep Attendance Daily", trigger: "manual", monthlyActualWeek: monthlyRun ? 2 : null, monthlyWeekStartDate: monthlyRun ? "2026-09-01" : "", monthlyWeekEndDate: monthlyRun ? "2026-09-07" : "", dailySmartSellWeekOverride: 3, createdBy: "operator" };
  const calls = [];
  const state = { ...run };
  const runRef = { set: async data => Object.assign(state, data), update: async data => Object.assign(state, data) };
  let stored = { name: dailyName, storagePath: "uploads/test/source.xlsx", size: 100, reportStartDate: "2026-09-07" };
  const fileRef = { set: async data => { stored = data; }, get: async () => ({ exists: true, data: () => stored }) };
  const noop = async () => null;
  const forbidden = name => async () => { calls.push(name); throw new Error(`Unexpected ${name}`); };
  class ExtractionCancelledError extends Error {}
  const context = {
    localDateParts: () => ({ date: "2026-09-08" }), firestoreMillis: () => 0,
    attendanceSourceRetryPlan: require("../../functions/attendance-sharepoint-source").attendanceSourceRetryPlan,
    exports: {}, onDocumentCreated: (_, handler) => handler,
    retailerKey: {}, sharePointTenantId: {}, sharePointClientId: {}, sharePointClientSecret: {}, geminiApiKey: {}, geoRepOpenApiId: {}, geoRepOpenApiKey: {},
    claimQueuedExtractionRun: async () => true,
    isSalesforceAttendanceRetailer: id => ["sales-force-p-g", "sales-force-p-g-monthly"].includes(id),
    isGeoRepRetailer: () => false, isSalesforceRetailer: () => true,
    ensureExtractionActive: async () => { if (cancel) throw new ExtractionCancelledError("Cancelled"); },
    resolveSalesforceAttendanceSharePointSource: async () => {
      calls.push("select-source");
      if (sourceError) throw sourceError;
      return { item: file(monthlyRun ? monthlyName : dailyName), version: "version1" };
    },
    readSalesforceAttendanceSharePointSource: async () => ({ name: monthlyRun ? monthlyName : dailyName, filePath: "temp/source.xlsx", size: 100, rowCount: 2, reportSource: "sharepoint-attendance", sourceSharePoint: { matchingRows: 2, version: "version1" } }),
    reportIdentityForRun: run => run.reportIdentityOverride || "base-period",
    reserveReportDelivery: async (_, __, run) => { calls.push(["reserve", run.reportIdentityOverride]); return { state: duplicate ? "completed" : "acquired", reportIdentity: run.reportIdentityOverride, fileId: "existing" }; },
    appendRunTimeline: async (_, kind) => calls.push(kind),
    runTimelineEvent: (kind, message) => ({ kind, message }),
    FieldValue: { serverTimestamp: () => "now", arrayUnion: (...values) => values },
    fs: { mkdtemp: async () => "temp", stat: async () => ({ isFile: () => true, size: 100 }), rm: async () => calls.push("cleanup") }, path, os: { tmpdir: () => "temp" },
    launchAutomationBrowser: forbidden("browser"), loadSalesforceConnectedApp: forbidden("salesforce-auth"),
    saveSalesforceSession: forbidden("save-session"), uploadFileToSharePoint: forbidden("source-upload"),
    redeliverStoredFileToSharePoint: forbidden("source-redelivery"), sharePointDestinationForRun: forbidden("portal-destination"),
    hashFile: async () => "sha256", effectiveReportDatesForRun: () => ({ startDate: monthlyRun ? "2026-09-01" : "2026-09-07", endDate: monthlyRun ? "2026-09-07" : "" }),
    createSafeWorkbookContract: async () => ({ status: "valid", worksheetCount: 1 }),
    geoRepReportType: () => "", salesforceReportType: () => monthlyRun ? "Rep Attendance Monthly" : "Rep Attendance Daily",
    salesforceDateRangeDescription: () => "dates", optionalAttendanceActualWeek: value => value || null,
    optionalDate: value => value || "", extractionFileNameForRun: (_, name) => name,
    crypto: { randomUUID: () => "file1" },
    db: { collection: name => {
      assert.equal(name, "files", "Attendance acquisition must not load Salesforce secrets/configuration");
      return { where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }), doc: () => ({ ...fileRef, get: async () => ({ exists: true, id: "existing", ref: fileRef, data: () => stored }) }) };
    } },
    getStorage: () => ({ bucket: () => ({ upload: async () => [{ getMetadata: async () => [{ size: "100" }], delete: noop }] }) }),
    queueSalesforceAttendanceBlueprintUpdate: async value => { calls.push(["blueprint", value]); return { updateRunId: "update1" }; },
    queueGeoRepSalesTransactionImport: noop, queueGeoRepBlueprintPopulation: noop, queueGeoRepCompanionRuns: noop,
    queueGeoRepAttendanceTrackerUpdate: noop, queueGeoRepDerivedRedelivery: noop,
    updateReportDelivery: noop, clearNoDataRetry: noop, releaseSalesforceBrowserLease: noop,
    console: { error() {} }, salesforceSessionWasInvalidated: forbidden("session-invalidation"),
    ExtractionCancelledError, NoReportDataError: class extends Error {}, extractionCancellationRequested: async () => cancel,
    captureFailureEvidence: noop
  };
  vm.runInNewContext(backend.slice(backend.indexOf("exports.processExtraction = onDocumentCreated(")), context);
  return { calls, state, run, invoke: () => context.exports.processExtraction({ id: "event1", params: { runId: "run1" }, data: { ref: runRef, data: () => run } }) };
}
for (const monthlyRun of [false, true]) test(`${monthlyRun ? "monthly" : "daily"} uses SharePoint and preserves the existing Blueprint handoff without browser/MFA/upload`, async () => {
  const h = handlerHarness({ monthlyRun });
  await h.invoke();
  assert.equal(h.state.status, "completed", h.state.message);
  assert.equal(h.state.reportSource, "sharepoint-attendance");
  assert.equal(h.state.sourceSharePoint.version, "version1");
  assert.equal(h.state.attendanceBlueprintUpdateRunId, "update1");
  const handoff = h.calls.find(call => call[0] === "blueprint")[1];
  assert.equal(handoff.run, h.run);
  assert.equal(handoff.parentRunId, "run1");
  assert.equal(handoff.run.dailySmartSellWeekOverride, 3);
  assert.equal(handoff.run.monthlyActualWeek, monthlyRun ? 2 : null);
  assert.ok(h.calls.includes("cleanup"));
});
test("unchanged source reuses its existing verified copy and still queues the normal update", async () => {
  const h = handlerHarness({ duplicate: true });
  await h.invoke();
  assert.equal(h.state.status, "completed", h.state.message);
  assert.equal(h.state.isDuplicate, true);
  assert.equal(h.calls.find(call => call[0] === "blueprint")[1].sourceFileId, "existing");
});
test("missing input fails as SharePoint, without attempting portal recovery or changing a workbook", async () => {
  const h = handlerHarness({ sourceError: new Error("Required report missing") });
  await h.invoke();
  assert.equal(h.state.status, "failed");
  assert.equal(h.state.failureProvider, "SharePoint");
  assert.equal(h.state.message, "Required report missing");
  assert.equal(h.state.workbookChanged, false);
  assert.ok(!h.calls.some(call => call[0] === "blueprint"));
});
test("a late export schedules bounded source recovery without changing the frozen period or workbook", async () => {
  const error = Object.assign(new Error("Export has not arrived"), { code: "ATTENDANCE_EXPORT_NOT_READY", requestedEndDate: "2026-09-07" });
  const h = handlerHarness({ sourceError: error, monthlyRun: true });
  await h.invoke();
  assert.equal(h.state.status, "failed");
  assert.equal(h.state.salesforceAutoRetry.kind, "sharepoint-attendance-source");
  assert.equal(h.state.salesforceAutoRetry.status, "waiting");
  assert.equal(h.state.monthlyWeekStartDate, "2026-09-01");
  assert.equal(h.state.monthlyWeekEndDate, "2026-09-07");
  assert.equal(h.state.workbookChanged, false);
  assert.match(h.state.message, /10 minutes/);
  assert.ok(!h.calls.some(call => call[0] === "blueprint"));
});
test("cancellation remains honoured before source acquisition", async () => {
  const h = handlerHarness({ cancel: true });
  await h.invoke();
  assert.equal(h.state.status, "cancelled");
  assert.ok(!h.calls.includes("select-source"));
});
test("bot playbooks describe SharePoint and keep Display Compliance separate", () => {
  for (const retailerId of ["sales-force-p-g", "sales-force-p-g-monthly"]) {
    const rules = automationPlaybookForRun({ retailerId }).rules.join(" ");
    assert.match(rules, /SharePoint/);
    assert.match(rules, /Do not open Salesforce/);
    assert.match(rules, /Preserve/);
  }
  assert.doesNotMatch(automationPlaybookForRun({ retailerId: "salesforce-display-compliance-automation" }).rules.join(" "), /SharePoint Monthly/);
});
