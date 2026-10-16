"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const policy = require("../../functions/attendance-sharepoint-source");
const root = path.resolve(__dirname, "../..");
const codeFor = key => fs.readFileSync(process.env[key] || path.join(root, "functions/index.js"), "utf8");
const fn = (code, name) => { const match = [...code.matchAll(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`, "g"))].at(-1); assert.ok(match, name); return match[0]; };
const plain = value => JSON.parse(JSON.stringify(value));
const now = new Date("2026-09-09T06:00:00Z");
const late = Object.assign(new Error("Export not ready"), { code: "ATTENDANCE_EXPORT_NOT_READY", requestedEndDate: "2026-09-08" });

test("completed-month defaults handle first-day, leap-year and year transitions", () => {
  for (const [today, start, end] of [
    ["2026-09-09", "2026-09-01", "2026-09-08"], ["2026-10-01", "2026-09-01", "2026-09-30"],
    ["2026-01-01", "2025-12-01", "2025-12-31"], ["2024-03-01", "2024-02-01", "2024-02-29"],
    ["2026-03-01", "2026-02-01", "2026-02-28"]
  ]) assert.deepEqual(policy.completedAttendanceMonthRange(today), { startDate: start, endDate: end });
  assert.throws(() => policy.completedAttendanceMonthRange("2026-02-30"), /valid/);
});

test("scheduler changes only Salesforce Monthly All Actual Weeks, not fixed weeks or other automations", () => {
  const code = codeFor("ATTENDANCE_SCHEDULE_TEST_FILE");
  const resolve = vm.runInNewContext(`(${fn(code, "scheduledReportDates")})`, {
    completedAttendanceMonthRange: policy.completedAttendanceMonthRange,
    monthToDateRange: day => ({ startDate: day.slice(0, 7) + "-01", endDate: day }),
    defaultReportDatesForRetailer: (_, __, ___, day) => ({ startDate: day, endDate: day })
  });
  for (const all of [{ monthlyReconcileAllWeeks: true }, { monthlyActualWeek: "all" }]) {
    assert.deepEqual(plain(resolve({ frequency: "monthly", ...all }, { date: "2026-09-09" }, "sales-force-p-g-monthly")), { startDate: "2026-09-01", endDate: "2026-09-08" });
  }
  const fixed = { frequency: "monthly", dateMode: "fixed", monthlyActualWeek: 2, startDate: "2026-09-01", endDate: "2026-09-09" };
  assert.deepEqual(plain(resolve(fixed, { date: "2026-09-09" }, "sales-force-p-g-monthly")), { startDate: fixed.startDate, endDate: fixed.endDate });
  for (const retailer of ["geo-rep", "geo-rep-sales-transactions", "salesforce-display-compliance-automation", "sales-force-p-g"]) {
    assert.equal(resolve({ frequency: "daily" }, { date: "2026-09-09" }, retailer).endDate, "2026-09-09");
  }
});

test("Daily date anchor is shifted once; explicit Monthly week ranges remain exact", () => {
  const code = codeFor("ATTENDANCE_BACKEND_TEST_FILE");
  const ctx = vm.createContext({ optionalDate: value => value || "", reportDatesForRun: run => ({ startDate: run.reportStartDate, endDate: run.reportEndDate }), salesforceReportType: run => run.type });
  for (const name of ["previousBusinessDay", "monthStart", "salesforceReportDatesForRun"]) vm.runInContext(fn(code, name), ctx);
  assert.equal(ctx.salesforceReportDatesForRun({ type: "Rep Attendance Daily", reportStartDate: "2026-09-07" }).startDate, "2026-09-04");
  assert.equal(ctx.salesforceReportDatesForRun({ type: "Rep Attendance Daily", reportStartDate: "2026-09-09" }).startDate, "2026-09-08");
  const monthly = ctx.salesforceReportDatesForRun({ type: "Rep Attendance Monthly", reportStartDate: "2026-09-01", reportEndDate: "2026-09-09", monthlyWeekStartDate: "2026-09-02", monthlyWeekEndDate: "2026-09-08" });
  assert.equal(monthly.startDate, "2026-09-02"); assert.equal(monthly.endDate, "2026-09-08");
});

test("only missing/late completed-day source errors qualify for bounded recovery", () => {
  const plan = policy.attendanceSourceRetryPlan({}, late, now);
  assert.equal(plan.nextAttemptAt, "2026-09-09T06:10:00.000Z");
  assert.equal(plan.deadlineAt, "2026-09-09T08:00:00.000Z");
  assert.equal(plan.maxAttempts, 12);
  assert.equal(policy.attendanceSourceRetryPlan({}, new Error("Corrupt workbook"), now), null);
  assert.equal(policy.attendanceSourceRetryPlan({}, { ...late, requestedEndDate: "2026-09-09" }, now), null);
  assert.equal(policy.attendanceSourceRetryPlan({ trigger: "derived" }, late, now), null);
  for (const run of [{ salesforceAutoRetryCount: 12 }, { salesforceAutoRetryCount: "bad" }, { attendanceSourceRetryDeadline: "2026-09-09T06:05:00Z" }, { attendanceSourceRetryDeadline: "bad" }]) assert.equal(policy.attendanceSourceRetryPlan(run, late, now).status, "exhausted");
  const retry = policy.attendanceSourceRetryPlan({ salesforceAutoRetryCount: 1, attendanceSourceRetryDeadline: plan.deadlineAt }, late, new Date("2026-09-09T06:10:15Z"));
  assert.equal(retry.deadlineAt, plan.deadlineAt);
  assert.equal(retry.nextAttemptAt, "2026-09-09T06:20:15.000Z");
});

test("wrong start filter, ambiguity and invalid versions never become retryable missing-source errors", () => {
  const period = { exportDate: "2026-09-08", exportedAt: "2026-09-08T08:00:00+02:00" };
  const metadata = ["As of 2026-09-08 08:00:00 South Africa Standard Time/SAST", "Visit Date greater or equal 9/2/2026"];
  assert.throws(() => policy.attendanceRawReportCoverage(metadata, period, { startDate: "2026-09-01", endDate: "2026-09-08" }), error => policy.attendanceSourceRetryPlan({}, error, now) === null);
  assert.throws(() => policy.attendanceRawReportCoverage(metadata, period, { startDate: "2026-09-02", endDate: "2026-09-08" }), error => policy.attendanceSourceRetryPlan({}, error, now).status === "waiting");
});

function queueHarness(overrides = {}) {
  const code = codeFor("ATTENDANCE_RETRY_TEST_FILE");
  const state = { retailerId: "sales-force-p-g-monthly", status: "failed", trigger: "scheduled", reportStartDate: "2026-09-01", reportEndDate: "2026-09-08", monthlyWeekStartDate: "2026-09-01", monthlyWeekEndDate: "2026-09-08", monthlyReconcileAllWeeks: true,
    createdBy: "jennifer-uid", createdByEmail: "fixture@example.invalid", reportIdentity: "a-delivered-source", reportIdentityOverride: "old-source", salesforceAutoRetry: policy.attendanceSourceRetryPlan({}, late, now), ...overrides };
  const writes = [];
  const ref = { id: "old" };
  const ctx = vm.createContext({
    optionalText: value => value || "", salesforceReportLoadRetryMaxAttempts: 2,
    isSalesforceAttendanceRun: run => ["sales-force-p-g", "sales-force-p-g-monthly"].includes(run.retailerId),
    FieldValue: { serverTimestamp: () => "server-time", arrayUnion: value => value },
    runTimelineEvent: (_, message) => ({ message }),
    db: { collection: collection => ({ doc: id => ({ collection, id: id || "new" }) }), runTransaction: async callback => callback({ get: async () => ({ exists: true, data: () => state }), set: (target, data) => { writes.push({ target, data }); if (target === ref) Object.assign(state, data); } }) }
  });
  const fields = code.match(/const extractionRetryTransientFields = new Set\(\[[^]*?\]\);/);
  assert.ok(fields);
  vm.runInContext(fields[0], ctx);
  for (const name of ["retryableExtractionPayload", "queueSalesforceReportLoadRetry"]) vm.runInContext(fn(code, name), ctx);
  return { state, writes, invoke: time => ctx.queueSalesforceReportLoadRetry({ id: "old", ref }, time || new Date("2026-09-09T06:11:00Z")) };
}

test("retry is idempotent, preserves owner/range and never invalidates another source delivery", async () => {
  const h = queueHarness();
  await h.invoke(); await h.invoke();
  const children = h.writes.filter(w => w.target.id === "new");
  assert.equal(children.length, 1);
  const retry = children[0].data;
  assert.equal(retry.createdBy, "jennifer-uid"); assert.equal(retry.monthlyWeekEndDate, "2026-09-08");
  assert.equal(retry.reportStartDate, "2026-09-01"); assert.equal(retry.reportEndDate, "2026-09-08");
  assert.equal(retry.salesforceAutoRetryCount, 1); assert.equal(retry.salesforceAutoRetry, undefined);
  assert.equal(retry.attendanceSourceRetryDeadline, "2026-09-09T08:00:00.000Z");
  assert.equal(h.writes.some(w => w.target.collection === "reportDeliveries"), false);
});

test("cancelled, already-delivered, non-attendance, not-yet-due and expired jobs cannot enqueue a source retry", async () => {
  for (const overrides of [{ status: "cancelled" }, { status: "completed" }, { retailerId: "geo-rep" }, { salesforceAutoRetryCount: 12 }]) {
    const h = queueHarness(overrides); await h.invoke(); assert.equal(h.writes.some(w => w.target.id === "new"), false);
  }
  for (const time of ["2026-09-09T06:09:00Z", "2026-09-09T08:01:00Z"]) {
    const h = queueHarness(); await h.invoke(new Date(time)); assert.equal(h.writes.some(w => w.target.id === "new"), false);
  }
});

test("manual All Actual Weeks uses completed dates and explicit weeks keep their chosen dates", async () => {
  const code = codeFor("ATTENDANCE_START_TEST_FILE");
  const start = code.slice(code.indexOf("exports.startExtraction = onCall("), code.indexOf("exports.startSalesforceDisplayComplianceFile1Batch ="));
  for (const all of [true, false]) {
    let queued;
    const ctx = { exports: {}, onCall: cb => cb, console: { info() {} }, HttpsError: Error,
      requireOperator: () => {}, requireNavigationPermission: async () => {}, requireRetailerPermission: async () => {}, text: v => v, optionalDate: v => v || "", optionalText: v => v || "",
      monthlyAttendanceWeekSelectionFromRequest: () => ({ actualWeek: all ? null : 2, reconcileAllWeeks: all }), scheduleFrequencyForRetailer: () => "monthly",
      completedAttendanceMonthRange: policy.completedAttendanceMonthRange, localDateParts: () => ({ date: "2026-09-09" }),
      defaultReportDatesForRetailer: (_, start, end) => ({ startDate: start, endDate: end }), salesforceDisplayComplianceRetailerId: "display-compliance",
      FieldValue: { serverTimestamp: () => "now" }, crypto: { randomUUID: () => "nonce" }, runTimelineEvent: () => ({}), recordAccessAudit: async () => {}, requestActor: () => ({}),
      db: { collection: name => name === "retailers" ? { doc: () => ({ get: async () => ({ exists: true, data: () => ({ name: "Monthly", steps: [{}] }) }) }) } : { add: async data => { queued = data; return { id: "new" }; } } } };
    vm.runInNewContext(start, ctx);
    await ctx.exports.startExtraction({ auth: { uid: "operator", token: {} }, data: { retailerId: "sales-force-p-g-monthly", reportStartDate: "2026-09-03", reportEndDate: "2026-09-09" } });
    assert.equal(queued.reportStartDate, all ? "2026-09-01" : "2026-09-03");
    assert.equal(queued.reportEndDate, all ? "2026-09-08" : "2026-09-09");
    assert.equal(queued.monthlyWeekEndDate, queued.reportEndDate);
  }
});
