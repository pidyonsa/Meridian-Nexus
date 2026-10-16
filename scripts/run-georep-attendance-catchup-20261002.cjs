"use strict";
// 2 October catch-up: the 11:30 scheduled run reused Geo_Rep_Strike_Rate_Report_2026-10-01.xlsx,
// downloaded at 12:56 SAST on 1 October, so 1 October visits after about 13:00 were missing from
// both trackers and the dashboards. Queue a fresh 1 October download with its own report identity.
const { execFileSync } = require("node:child_process");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const runId = process.argv[2] || "manual-georep-attendance-catchup-20261002";

async function document(name) {
  const raw = await json(`${base}/${name}`);
  return { raw, id: raw.name.split("/").at(-1), data: decode({ mapValue: { fields: raw.fields || {} } }) };
}

async function main() {
  if (!/^manual-georep-attendance-catchup-20261002[a-z]?$/.test(runId)) throw Error("Unexpected run id");
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (localDate !== "2026-10-02") throw Error(`Unexpected Johannesburg date: ${localDate}`);
  const startDate = "2026-10-01", endDate = "2026-10-01";
  const retailer = await document("retailers/geo-rep-attendance-for-reps");
  const profile = await document(`extractionProfiles/${retailer.data.extractionProfileId}`);
  if (profile.data.workflowMode !== "geo-rep-rep-attendance") throw Error("The Geo Rep Attendance profile is not ready for this capture.");
  const email = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "config", "get-value", "account", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  const at = new Date().toISOString();
  const run = {
    retailerId: retailer.id, retailerName: retailer.data.name, extractionProfileId: profile.id, extractionName: profile.data.name,
    workflowMode: profile.data.workflowMode, includeSchedulesReport: false, reportStartDate: startDate, reportEndDate: endDate,
    reportIdentityOverride: `${retailer.id}--strike-rate-report--${startDate}--${endDate}--catchup-${runId}`,
    trigger: "manual-catchup", status: "queued",
    message: "Requested catch-up Geo Rep Attendance export for the live Azure Reps and Merchandisers dashboards.",
    createdBy: `cloud-operator:${email}`, createdByEmail: email, createdByName: "Authorized cloud operator",
    executionTimeline: [{ event: "queued", at, message: "Fresh full 1 October export: the 11:30 run reused the 1 October file downloaded at 12:56 SAST on 1 October." }]
  };
  const packed = fields(run);
  packed.createdAt = { timestampValue: at };
  packed.lastActivityAt = { timestampValue: at };
  await json(`${base}:commit`, "POST", { writes: [{ update: { name: `${root}/extractionRuns/${runId}`, fields: packed }, currentDocument: { exists: false } }] });
  const created = await document(`extractionRuns/${runId}`);
  console.log(JSON.stringify({ runId, status: created.data.status, reportStartDate: created.data.reportStartDate, reportEndDate: created.data.reportEndDate }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
