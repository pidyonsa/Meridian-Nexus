"use strict";
// 1 October catch-up: the scheduled 01-30 September run is stuck behind the blueprint
// backlog and, when it starts, would reuse the 01-30 September file captured mid-day on
// 30 September. Supersede it and queue a fresh full-month download in one atomic commit.
const { execFileSync } = require("node:child_process");
const JSZip = require("../functions/node_modules/jszip");
const { json, api, fnUrl } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const project = "meridain-nexus";
const root = `projects/${project}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${root}`;
const runId = "manual-georep-attendance-catchup-20261001";
const staleRunId = "IhFq97tmGvuvkRSaYs2Z";

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
  if (localDate !== "2026-10-01") throw Error(`Unexpected Johannesburg date: ${localDate}`);
  const yesterday = new Date(`${localDate}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  // On the first of the month, month-to-yesterday is the whole previous month.
  const endDate = yesterday.toISOString().slice(0, 10), startDate = `${endDate.slice(0, 7)}-01`;

  const stale = await document(`extractionRuns/${staleRunId}`);
  if (stale.data.retailerId !== retailer.id || stale.data.status !== "queued" || stale.data.reportStartDate !== startDate || stale.data.reportEndDate !== endDate) {
    throw Error(`The scheduled run is no longer the queued ${startDate} to ${endDate} job; review before superseding it.`);
  }

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
    supersedesRunId: staleRunId,
    executionTimeline: [{ event: "queued", at, message: "User requested an immediate full-September Attendance export: the 06:00 run was still waiting behind the blueprint backlog and would have reused the 01-30 September file captured mid-day on 30 September." }]
  };
  const packed = fields(run);
  packed.createdAt = { timestampValue: at };
  packed.lastActivityAt = { timestampValue: at };

  const message = `Superseded by ${runId}: this run had not started and would have reused the 01-30 September file captured mid-day on 30 September instead of downloading the complete month.`;
  const staleFields = fields({ status: "cancelled", message, supersededByRunId: runId });
  staleFields.completedAt = { timestampValue: at };
  staleFields.lastActivityAt = { timestampValue: at };
  await json(`${base}:commit`, "POST", { writes: [
    {
      update: { name: stale.raw.name, fields: staleFields },
      updateMask: { fieldPaths: ["status", "message", "supersededByRunId", "completedAt", "lastActivityAt"] },
      updateTransforms: [{ fieldPath: "executionTimeline", appendMissingElements: { values: [fields({ entry: { at, event: "cancelled", message } }).entry] } }],
      // Only supersede the run if no worker has claimed or changed it since it was read.
      currentDocument: { updateTime: stale.raw.updateTime }
    },
    { update: { name: `${root}/extractionRuns/${runId}`, fields: packed }, currentDocument: { exists: false } }
  ] });

  const created = await document(`extractionRuns/${runId}`), superseded = await document(`extractionRuns/${staleRunId}`);
  console.log(JSON.stringify({ runId, status: created.data.status, reportStartDate: created.data.reportStartDate, reportEndDate: created.data.reportEndDate, trigger: created.data.trigger, workerRevision: worker.serviceConfig.revision, superseded: { runId: staleRunId, status: superseded.data.status } }, null, 2));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
