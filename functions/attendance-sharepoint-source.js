"use strict";

const crypto = require("node:crypto");

const MAX_REPORT_BYTES = 25 * 1024 * 1024;
// Resolved from the administrator's shared link. Stable item IDs do not depend
// on the sharing link's lifetime and keep acquisition separate from delivery.
const ATTENDANCE_RAW_SOURCE = Object.freeze({
  driveId: "b!f7lQOiM6-E-5AUPBp41Fd9NsvlVE9-1IriUYn-ErvlQ1QG2P3mMeQKsExsIz-9lR",
  folderId: "01X2VAWPYB7L27TIKSX5G3OCU53FS4MQZ5",
  folderPath: "Power BI - PG/Rep Attendance/Rep Attendance Download/Rep Attendance Raw Data"
});
const RAW_REPORT_PATTERN = /^Updated South Africa Attendance Report-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})(?: \([1-9]\d*\))?\.xlsx$/i;
const REPORT_PATTERN = /^Salesforce_PG_Rep_Attendance_(Daily|Monthly)_(\d{4}-\d{2}-\d{2})(?:_to_(\d{4}-\d{2}-\d{2})|(_onwards))(?:_Refresh_[a-z0-9_-]+)?\.xlsx$/i;

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function completedAttendanceMonthRange(today) {
  if (!validDate(today)) throw new Error("Attendance requires a valid South African reference date.");
  const endDate = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  // On the first, finish the preceding month instead of requesting an empty day.
  return { startDate: `${endDate.slice(0, 7)}-01`, endDate };
}

function attendanceExportNotReady(message, requestedEndDate) {
  return Object.assign(new Error(message), { code: "ATTENDANCE_EXPORT_NOT_READY", requestedEndDate });
}

function attendanceSourceRetryPlan(run, error, now = new Date()) {
  if (error?.code !== "ATTENDANCE_EXPORT_NOT_READY") return null;
  const trigger = run.trigger || "manual";
  if (!["manual", "scheduled", "scheduled-retry", "automatic-retry", "failed-step-retry", "manual-restart"].includes(trigger)) return null;
  const today = new Date(now.getTime() + 7200000).toISOString().slice(0, 10);
  // An explicitly requested current/future day cannot become complete this morning.
  if (!validDate(error.requestedEndDate) || error.requestedEndDate >= today) return null;
  const count = Number(run.salesforceAutoRetryCount || 0);
  const attempts = Number.isInteger(count) && count >= 0 ? count : 12;
  const deadline = run.attendanceSourceRetryDeadline ? Date.parse(run.attendanceSourceRetryDeadline) : now.getTime() + 120 * 60000;
  const next = now.getTime() + 10 * 60000;
  const waiting = attempts < 12 && Number.isFinite(deadline) && next <= deadline;
  return {
    kind: "sharepoint-attendance-source", status: waiting ? "waiting" : "exhausted",
    attempts, maxAttempts: 12, intervalMinutes: 10,
    deadlineAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : "",
    nextAttemptAt: waiting ? new Date(next).toISOString() : ""
  };
}

function parseAttendanceReportName(name) {
  const match = REPORT_PATTERN.exec(String(name || ""));
  if (!match || !validDate(match[2]) || (match[3] && !validDate(match[3]))) return null;
  const type = match[1].toLowerCase();
  const startDate = match[2];
  const endDate = match[3] || "";
  if (endDate && endDate < startDate) return null;
  if (type === "monthly" && (!endDate || endDate.slice(0, 7) !== startDate.slice(0, 7))) return null;
  return { type, startDate, endDate };
}

function selectAttendanceSharePointReport(items, { type, startDate, endDate = "", today }) {
  if (!["daily", "monthly"].includes(type) || !validDate(startDate) || !validDate(today)
    || (endDate && (!validDate(endDate) || endDate < startDate))
    || (type === "monthly" && (!endDate || endDate.slice(0, 7) !== startDate.slice(0, 7)))) {
    throw new Error("SharePoint attendance selection requires a valid daily date or a single-month date range.");
  }
  const reports = items.filter(item => item.file && !item.folder && !item.deleted)
    .map(item => ({ item, period: parseAttendanceReportName(item.name) }))
    .filter(({ period }) => period?.type === type)
    .sort((a, b) => (b.period.endDate || b.period.startDate).localeCompare(a.period.endDate || a.period.startDate)
      || b.period.startDate.localeCompare(a.period.startDate)
      || String(b.item.lastModifiedDateTime || "").localeCompare(String(a.item.lastModifiedDateTime || "")));
  const matching = reports.filter(({ period }) => period.startDate <= today && (!period.endDate || period.endDate <= today)
    && (type === "daily"
      ? period.startDate === startDate && (!endDate || !period.endDate || period.endDate >= endDate)
      : period.startDate <= startDate && period.endDate >= endDate && period.startDate.slice(0, 7) === startDate.slice(0, 7)));
  if (!matching.length) {
    const latest = reports[0]?.period;
    const available = latest ? ` Latest dated ${type} export: ${latest.startDate}${latest.endDate ? ` to ${latest.endDate}` : " onwards"}.` : " No recognised dated exports were found.";
    throw new Error(`No SharePoint ${type} attendance export covers ${startDate}${endDate ? ` to ${endDate}` : ""}.${available} Publish the required report in the ${type === "daily" ? "Daily" : "Monthly"} folder, then rerun. Salesforce login is disabled for attendance.`);
  }
  const selected = matching[0];
  const next = matching[1];
  if (next && selected.period.startDate === next.period.startDate && selected.period.endDate === next.period.endDate
    && selected.item.lastModifiedDateTime === next.item.lastModifiedDateTime) {
    throw new Error("Multiple SharePoint attendance exports have the same reporting period and modification time. Remove the ambiguity before running.");
  }
  if (!selected.item.id || !selected.item.eTag || !Number.isFinite(Number(selected.item.size))
    || Number(selected.item.size) <= 0 || Number(selected.item.size) > MAX_REPORT_BYTES) {
    throw new Error("The selected SharePoint attendance export has missing version metadata, is empty, or exceeds the 25 MB limit. No older export was substituted.");
  }
  return selected;
}

function attendanceSharePointVersion(driveId, item) {
  if (!driveId || !item?.id || !item?.eTag) throw new Error("The SharePoint attendance source version is incomplete.");
  return crypto.createHash("sha256").update(JSON.stringify([driveId, item.id, item.eTag])).digest("hex").slice(0, 32);
}

function parseAttendanceRawReportName(name) {
  const match = RAW_REPORT_PATTERN.exec(String(name || ""));
  if (!match || !validDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  return { exportDate: match[1], exportedAt: `${match[1]}T${match[2]}:${match[3]}:${match[4]}+02:00` };
}

function selectAttendanceRawReport(items, { type, startDate, endDate = "", today, now = new Date().toISOString() }) {
  if (!["daily", "monthly"].includes(type) || !validDate(startDate) || !validDate(today)
    || (endDate && (!validDate(endDate) || endDate < startDate)) || !Number.isFinite(Date.parse(now))
    || (type === "monthly" && (!endDate || endDate.slice(0, 7) !== startDate.slice(0, 7)))) {
    throw new Error("SharePoint attendance selection requires a valid daily date or a single-month date range.");
  }
  const reports = items.filter(item => item.file && !item.folder && !item.deleted)
    .map(item => ({ item, period: parseAttendanceRawReportName(item.name) }))
    .filter(({ period }) => period && period.exportDate <= today && Date.parse(period.exportedAt) <= Date.parse(now))
    .sort((a, b) => b.period.exportedAt.localeCompare(a.period.exportedAt)
      || String(b.item.lastModifiedDateTime || "").localeCompare(String(a.item.lastModifiedDateTime || "")));
  const selected = reports[0];
  if (!selected) throw attendanceExportNotReady("No recognised timestamped attendance export was found in Rep Attendance Raw Data. Publish Updated South Africa Attendance Report-YYYY-MM-DD-HH-MM-SS.xlsx. Salesforce login is disabled for attendance.", endDate || startDate);
  if (reports[1]?.period.exportedAt === selected.period.exportedAt && reports[1].item.lastModifiedDateTime === selected.item.lastModifiedDateTime) {
    throw new Error("Multiple SharePoint attendance exports have the same export timestamp and modification time. Remove the ambiguity before running.");
  }
  if (!selected.item.id || !selected.item.eTag || !Number.isFinite(Number(selected.item.size))
    || Number(selected.item.size) <= 0 || Number(selected.item.size) > MAX_REPORT_BYTES) {
    throw new Error("The selected SharePoint attendance export has missing version metadata, is empty, or exceeds the 25 MB limit. No older export was substituted.");
  }
  return selected;
}

function attendanceRawReportCoverage(metadata, period, { startDate, endDate }) {
  const lines = [...new Set(metadata.map(value => String(value || "").replace(/\s+/g, " ").trim()).filter(Boolean))];
  const asOf = lines.filter(line => /^As of /i.test(line));
  const generated = asOf[0]?.match(/^As of (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) South Africa Standard Time\/SAST\b/);
  if (asOf.length !== 1 || !generated || `${generated[1]}T${generated[2]}+02:00` !== period.exportedAt) {
    throw new Error("The SharePoint attendance export timestamp does not match its Salesforce As of header. No workbook was changed.");
  }
  const filters = lines.filter(line => /^Visit Date\b/i.test(line));
  const filter = filters[0]?.match(/^Visit Date greater or equal (\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
  const from = filter ? `${filter[3]}-${filter[1].padStart(2, "0")}-${filter[2].padStart(2, "0")}` : "";
  if (filters.length !== 1 || !validDate(from) || from > period.exportDate) {
    throw new Error("The SharePoint attendance export requires a verifiable Visit Date greater or equal M/D/YYYY filter. No workbook was changed.");
  }
  const completeThrough = new Date(Date.parse(`${period.exportDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  if (startDate < from || endDate > completeThrough) {
    const message = `The latest SharePoint attendance export covers completed days ${from} to ${completeThrough}, not ${startDate}${endDate !== startDate ? ` to ${endDate}` : ""}. Publish an export with the required start filter, generated after ${endDate} ends in South Africa. The export day is partial; no older file or Salesforce fallback was used and no workbook was changed.`;
    if (startDate >= from && endDate > completeThrough) throw attendanceExportNotReady(message, endDate);
    throw new Error(message);
  }
  return { startDate: from, endDate: period.exportDate, completeThrough, exportedAt: period.exportedAt };
}

module.exports = { MAX_REPORT_BYTES, ATTENDANCE_RAW_SOURCE, parseAttendanceReportName, selectAttendanceSharePointReport,
  attendanceSharePointVersion, parseAttendanceRawReportName, selectAttendanceRawReport, attendanceRawReportCoverage,
  completedAttendanceMonthRange, attendanceSourceRetryPlan };
