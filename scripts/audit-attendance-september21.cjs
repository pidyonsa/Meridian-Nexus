"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { base, decode } = require("./repair-attendance-september-weeks.cjs");
const { json } = require("./release-multi-admin.cjs");
const dir = path.resolve(__dirname, "../.tmp/attendance-investigation-20260921");

async function main() {
  const api = (url, ...args) => json(url.startsWith("https:") ? url : `${base}/${url}`, ...args);
  const runs = [];
  const schedules = [];
  for (const retailerId of ["sales-force-p-g", "sales-force-p-g-monthly"]) {
    schedules.push(decode(await api(`retailers/${retailerId}`)));
    const result = await api(`${base}:runQuery`, "POST", { structuredQuery: {
      from: [{ collectionId: "extractionRuns" }],
      select: { fields: [{ fieldPath: "createdAt" }] },
      where: { fieldFilter: { field: { fieldPath: "retailerId" }, op: "EQUAL", value: { stringValue: retailerId } } },
      limit: 3000
    } });
    const found = result.filter(x => x.document).map(x => decode(x.document));
    if (found.length === 3000) throw new Error("Run audit truncated; paginate before continuing.");
    for (const run of found.filter(r => r.createdAt >= "2026-09-18T00:00:00Z").sort((a,b) => a.createdAt.localeCompare(b.createdAt))) {
      runs.push(decode(await api(`extractionRuns/${run.id}`)));
    }
  }
  const config = decode(await api("salesforceAttendanceConfig/current"));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "audit.json"), JSON.stringify({ checkedAt: new Date().toISOString(), schedules, config, runs }, null, 2));
  console.log(JSON.stringify({
    schedules: schedules.map(r => ({ id: r.id, schedule: r.reportSchedule })),
    blueprint: config.attendanceBlueprint,
    runs: runs.map(r => ({ id: r.id, retailer: r.retailerId, status: r.status, workflow: r.workflowMode,
      createdAt: r.createdAt, completedAt: r.completedAt, owner: r.createdByName,
      dates: [r.reportStartDate, r.reportEndDate], weeks: [r.monthlyActualWeek, r.monthlyReconcileAllWeeks, r.monthlyWeekStartDate, r.monthlyWeekEndDate],
      parent: r.parentRunId, child: r.attendanceBlueprintUpdateRunId, message: r.message,
      source: r.sourceSharePoint?.name, sourceMax: r.sourceSharePoint?.maxVisitDate,
      actual: r.attendanceBlueprint?.actualOneRows,
      weeklyTotals: r.attendanceBlueprint?.monthlyPlan?.actualWeekTotals }))
  }, null, 2));
}
async function verify() {
  const audit = JSON.parse(fs.readFileSync(path.join(dir, "audit.json"), "utf8"));
  const vm = require("node:vm");
  const ExcelJS = require("../functions/node_modules/exceljs");
  const graph = require("../tmp/sharepoint_helpers.js");
  const { fn } = require("./repair-attendance-september-weeks.cjs");
  const code = fs.readFileSync(path.resolve(__dirname, "../functions/index.js"), "utf8");
  const ctx = vm.createContext({ Date, HttpsError: Error });
  for (const name of ["optionalText", "optionalDate", "attendanceCellValue", "attendanceText", "attendanceHeader", "attendanceHeaderColumn", "attendanceWorksheetHeader", "attendanceWorksheet", "salesforceDateValue", "attendanceDateValue", "attendanceStoreCode", "attendanceLocationCompliant", "attendanceMonthKey", "attendanceNumericValue", "attendanceCalendarWeek"])
    vm.runInContext(fn(code, name), ctx);
  const dailyRun = audit.runs.find(r => r.id === "YvndmTyJireYExb2wc5n");
  const updateRecord = decode(await json(`${base}/attendanceBlueprintUpdates/${dailyRun.attendanceBlueprintUpdateKey}`));
  const monthlyRun = audit.runs.find(r => r.id === "TBxUotr1Aelzu8QWHMTv");
  const token = await graph.graphToken();
  const download = async (ref, label) => {
    const endpoint = `/drives/${ref.driveId}/items/${ref.itemId}`;
    const before = await graph.graphJson(token, `${endpoint}?$select=id,name,eTag,size,lastModifiedDateTime,webUrl`);
    const file = path.join(dir, `${label}-${Date.now()}.xlsx`);
    await graph.graphDownload(token, `${endpoint}/content`, file);
    const after = await graph.graphJson(token, `${endpoint}?$select=id,eTag,size`);
    if (before.eTag !== after.eTag || fs.statSync(file).size !== before.size) throw Error(`${label} changed during audit`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    return { workbook, metadata: before, file };
  };
  const blueprint = await download(audit.config.attendanceBlueprint, "blueprint");
  const source = await download(monthlyRun.sourceSharePoint, "source");
  const contract = ctx.attendanceWorksheet(source.workbook, {
    storeCode: ["storecode"], employeeId: ["employeeid"], visitDate: ["visitdate"],
    checkIn: ["checkinlocationcompliance"], checkOut: ["checkoutlocationcompliance"]
  }, "Attendance source");
  const days = {}, counts = new Map(), unique = new Set();
  contract.worksheet.eachRow((row, n) => {
    if (n <= contract.rowNumber) return;
    const date = ctx.attendanceDateValue(row.getCell(contract.columns.visitDate).value);
    if (!date || !date.startsWith("2026-09")) return;
    const day = days[date] ||= { raw: 0, compliant: 0, unique: 0, calendarWeek: ctx.attendanceCalendarWeek(date) };
    day.raw++;
    if (!ctx.attendanceLocationCompliant(row.getCell(contract.columns.checkIn).value) && !ctx.attendanceLocationCompliant(row.getCell(contract.columns.checkOut).value)) return;
    day.compliant++;
    const store = ctx.attendanceStoreCode(row.getCell(contract.columns.storeCode).value);
    const employee = ctx.attendanceText(row.getCell(contract.columns.employeeId).value).replace(/\s+/g, "");
    const key = `${employee}|${store}|${date}`;
    if (!store || !employee || unique.has(key)) return;
    unique.add(key); day.unique++;
    const weekKey = `${store}|${day.calendarWeek}`;
    counts.set(weekKey, (counts.get(weekKey) || 0) + 1);
  });
  const weeklyTotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, sourceMatchedTotals = { ...weeklyTotals };
  let monthlyRows = 0, completedWeekMismatches = 0;
  blueprint.workbook.getWorksheet(audit.config.attendanceBlueprint.monthlyWorksheet).eachRow((row, n) => {
    if (n === 1 || ctx.attendanceMonthKey(row.getCell(1).value) !== "2026-09") return;
    const store = ctx.attendanceStoreCode(row.getCell(12).value);
    if (!store) return;
    monthlyRows++;
    for (let week = 1; week <= 5; week++) {
      const actual = ctx.attendanceNumericValue(row.getCell(33 + week).value);
      const expected = counts.get(`${store}|${week}`) || 0;
      weeklyTotals[week] += actual; sourceMatchedTotals[week] += expected;
      if (week <= 3 && actual !== expected) completedWeekMismatches++;
    }
  });
  const dailyTotals = {};
  blueprint.workbook.getWorksheet(audit.config.attendanceBlueprint.dailyWorksheet).eachRow((row, n) => {
    if (n === 1) return;
    const date = ctx.attendanceDateValue(row.getCell(1).value);
    if (!date || !date.startsWith("2026-09")) return;
    const day = dailyTotals[date] ||= { rows: 0, actual: 0 };
    day.rows++; day.actual += ctx.attendanceNumericValue(row.getCell(34).value);
  });
  const result = { checkedAt: new Date().toISOString(),
    dailyQueue: { status: updateRecord.status, runId: updateRecord.updateRunId, message: updateRecord.message, queuedAt: updateRecord.queuedAt },
    actualDailyRun: { id: dailyRun.id, status: dailyRun.status, cancelledAt: dailyRun.cancellationRequestedAt },
    source: source.metadata, workbook: blueprint.metadata, monthlyRows, weeklyTotals, sourceMatchedTotals,
    completedWeekMismatches, dailyTotals, sourceDays: days,
    files: { source: source.file, workbook: blueprint.file }
  };
  fs.writeFileSync(path.join(dir, "verification.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
async function metadata() {
  const audit = JSON.parse(fs.readFileSync(path.join(dir, "audit.json"), "utf8"));
  const child = audit.runs.find(r => r.id === "YvndmTyJireYExb2wc5n");
  const raw = decode(await json(`${base}/attendanceBlueprintUpdates/${child.attendanceBlueprintUpdateKey}?mask.fieldPaths=status&mask.fieldPaths=updateRunId&mask.fieldPaths=parentRunId&mask.fieldPaths=message&mask.fieldPaths=queuedAt`));
  const graph = require("../tmp/sharepoint_helpers.js");
  const token = await graph.graphToken();
  const b = audit.config.attendanceBlueprint;
  const workbook = await graph.graphJson(token, `/drives/${b.driveId}/items/${b.itemId}?$select=id,name,eTag,size,lastModifiedDateTime,webUrl`);
  const s = audit.runs.find(r => r.id === "TBxUotr1Aelzu8QWHMTv").sourceSharePoint;
  const source = await graph.graphJson(token, `/drives/${s.driveId}/items/${s.itemId}?$select=id,name,eTag,size,lastModifiedDateTime`);
  const result = { checkedAt: new Date().toISOString(), queue: raw, actualChildStatus: child.status, workbook, source, workbookContentsRead: false };
  fs.writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
const action = process.argv[2];
(action === "verify" ? verify() : action === "metadata" ? metadata() : main()).catch(e => { console.error(e.message); process.exitCode = 1; });
