"use strict";
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const { json, api, fnUrl } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const project = "meridain-nexus";
const root = `projects/${project}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${root}`;
const runId = "manual-georep-attendance-catchup-20260928";

async function document(name) {
  const raw = await json(`${base}/${name}`);
  return {
    raw,
    id: raw.name.split("/").at(-1),
    data: decode({ mapValue: { fields: raw.fields || {} } })
  };
}

async function main() {
  const retailer = await document("retailers/geo-rep-attendance-for-reps");
  const profile = await document(`extractionProfiles/${retailer.data.extractionProfileId}`);
  if (profile.data.workflowMode !== "geo-rep-rep-attendance" || !profile.data.steps?.some(step => step.action === "geoRepDownloadRepAttendanceReport")) {
    throw Error("The Geo Rep Attendance profile is not ready for this capture.");
  }

  try {
    await document(`extractionRuns/${runId}`);
    throw Error(`The requested catch-up run already exists: ${runId}`);
  } catch (error) {
    if (!/GET 404/.test(String(error.message || error))) throw error;
  }

  const worker = await json(fnUrl("processExtraction"));
  const storage = worker.buildConfig.source.storageSource;
  const archive = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${storage.bucket}/o/${encodeURIComponent(storage.object)}?alt=media&generation=${storage.generation}`)).arrayBuffer());
  const workerCode = await archive.file("index.js").async("string");
  if (!workerCode.includes("geo-rep-session-restored") || !workerCode.includes("responseCapture: responseCapture.capture")) {
    throw Error("The verified Geo Rep recovery release is not active.");
  }

  const now = new Date();
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (localDate !== "2026-09-28") throw Error(`Unexpected Johannesburg date: ${localDate}`);
  const yesterday = new Date(`${localDate}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const startDate = `${localDate.slice(0, 7)}-01`, endDate = yesterday.toISOString().slice(0, 10);
  const email = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "config", "get-value", "account", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw Error("The cloud operator identity is unavailable.");

  const at = now.toISOString();
  const run = {
    retailerId: retailer.id,
    retailerName: retailer.data.name,
    extractionProfileId: profile.id,
    extractionName: profile.data.name,
    workflowMode: profile.data.workflowMode,
    includeSchedulesReport: false,
    reportStartDate: startDate,
    reportEndDate: endDate,
    reportIdentityOverride: `${retailer.id}--strike-rate-report--${startDate}--${endDate}--catchup-${runId}`,
    trigger: "manual-catchup",
    status: "queued",
    message: "Requested catch-up Geo Rep Attendance export for the live Azure Reps and Merchandisers dashboards.",
    createdBy: `cloud-operator:${email}`,
    createdByEmail: email,
    createdByName: "Authorized cloud operator",
    executionTimeline: [{ event: "queued", at, message: "User requested a live Azure Attendance catch-up export after the scheduled portal downloads failed." }]
  };
  const packed = fields(run);
  packed.createdAt = { timestampValue: at };
  packed.lastActivityAt = { timestampValue: at };
  await json(`${base}:commit`, "POST", { writes: [{ update: { name: `${root}/extractionRuns/${runId}`, fields: packed }, currentDocument: { exists: false } }] });
  const created = await document(`extractionRuns/${runId}`);
  console.log(JSON.stringify({ runId, status: created.data.status, reportStartDate: created.data.reportStartDate, reportEndDate: created.data.reportEndDate, trigger: created.data.trigger, workerRevision: worker.serviceConfig.revision }, null, 2));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
