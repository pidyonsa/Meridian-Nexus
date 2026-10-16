"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const h = require("../tmp/sharepoint_helpers");
const ExcelJS = require("../functions/node_modules/exceljs");
const root = path.resolve(__dirname, "..");
const backendPath = process.env.ATTENDANCE_BACKEND_TEST_FILE || path.join(root, "functions/index.js");
const sourceModule = require(path.join(path.dirname(backendPath), "attendance-sharepoint-source.js"));

async function main() {
  const code = await fs.readFile(backendPath, "utf8");
  const token = await h.graphToken();
  const directory = await fs.mkdtemp(path.join(root, ".tmp/attendance-raw-validation-"));
  const results = [];
  try {
    const context = vm.createContext({
      ...sourceModule, fs, path, ExcelJS, Date, Buffer, console,
      sharePointAccessToken: async () => token,
      retryableGraphRequest: h.graphJson, graphRequest: h.graphJson,
      dateStringInZone: () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date()),
      effectiveReportDatesForRun: run => ({ startDate: run.startDate, endDate: run.endDate }),
      salesforceReportType: run => run.type === "monthly" ? "Rep Attendance Monthly" : "Rep Attendance Daily",
      downloadSharePointDriveItem: async (token, drive, item, filePath) => {
        await h.graphDownload(token, `/drives/${drive}/items/${item}/content`, filePath);
        return fs.stat(filePath);
      }
    });
    for (const name of ["attendanceCellValue", "attendanceText", "attendanceHeader", "attendanceHeaderColumn", "attendanceWorksheetHeader", "attendanceWorksheet", "salesforceDateValue", "attendanceDateValue", "resolveSalesforceAttendanceSharePointSource", "readSalesforceAttendanceSharePointSource"]) {
      const fn = code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
      assert.ok(fn, name);
      vm.runInContext(fn[0], context);
    }
    for (const run of [
      { type: "daily", startDate: "2026-09-07", endDate: "" },
      { type: "monthly", startDate: "2026-09-01", endDate: "2026-09-07" },
      { type: "daily", startDate: "2026-09-08", endDate: "" },
      { type: "monthly", startDate: "2026-09-01", endDate: "2026-09-08" }
    ]) {
      const source = await context.resolveSalesforceAttendanceSharePointSource(run);
      try {
        const verified = await context.readSalesforceAttendanceSharePointSource(source, directory, run);
        results.push({ ...run, status: "validated", name: verified.name, size: verified.size, rowCount: verified.rowCount,
          matchingRows: verified.sourceSharePoint.matchingRows, completeThrough: verified.sourceSharePoint.completeThrough,
          exportedAt: verified.sourceSharePoint.exportedAt, minVisitDate: verified.sourceSharePoint.minVisitDate, maxVisitDate: verified.sourceSharePoint.maxVisitDate });
      } catch (error) {
        if (run.endDate !== "2026-09-08" && run.startDate !== "2026-09-08") throw error;
        assert.match(error.message, /export day is partial/);
        results.push({ ...run, status: "partial-export-rejected", name: source.item.name, reason: error.message });
      }
    }
    const result = { checkedAt: new Date().toISOString(), sharePointWrites: 0, jobsCreated: 0, blueprintUpdates: 0, results };
    await fs.mkdir(path.join(root, ".tmp/attendance-raw-release"), { recursive: true });
    await fs.writeFile(path.join(root, ".tmp/attendance-raw-release/live-validation.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.join(root, ".tmp") + path.sep));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
