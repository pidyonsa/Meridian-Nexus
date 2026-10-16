"use strict";
// Re-issue a still-queued Attendance catch-up as a new run so its creation event is delivered
// immediately (queued events otherwise retry about every 10 minutes behind a backlog).
// The original is cancelled in the same atomic commit, only if no worker has claimed it.
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents";
const base = `https://firestore.googleapis.com/v1/${root}`;
const [fromId, toId] = process.argv.slice(2);

async function main() {
  if (!/^manual-georep-attendance-catchup-20261001[a-z]?$/.test(fromId || "") || !/^manual-georep-attendance-catchup-20261001[a-z]$/.test(toId || "")) {
    throw Error("Usage: node requeue-georep-attendance-catchup-20261001.cjs <queued catch-up id> <new catch-up id>");
  }
  const raw = await json(`${base}/extractionRuns/${fromId}`), run = decode({ mapValue: { fields: raw.fields || {} } });
  if (!["queued", "failed"].includes(run.status) || run.trigger !== "manual-catchup" || run.retailerId !== "geo-rep-attendance-for-reps" ||
      run.reportStartDate !== "2026-09-01" || run.reportEndDate !== "2026-09-30") throw Error(`${fromId} is not a queued or failed 01-30 September catch-up (${run.status}).`);
  const at = new Date().toISOString();
  const next = {
    ...Object.fromEntries(["retailerId", "retailerName", "extractionProfileId", "extractionName", "workflowMode", "includeSchedulesReport",
      "reportStartDate", "reportEndDate", "trigger", "message", "createdBy", "createdByEmail", "createdByName"].map(key => [key, run[key]])),
    reportIdentityOverride: `${run.retailerId}--strike-rate-report--${run.reportStartDate}--${run.reportEndDate}--catchup-${toId}`,
    status: "queued",
    supersedesRunId: fromId,
    executionTimeline: [{ event: "queued", at, message: `Re-issued ${fromId}, ${run.status === "failed" ? "after its Geo Rep download failed" : "which had not started, when extra worker capacity opened"}, so the full-September Attendance export runs now.` }]
  };
  const packed = fields(next);
  packed.createdAt = { timestampValue: at };
  packed.lastActivityAt = { timestampValue: at };
  const message = `Re-issued as ${toId} before any worker claimed it; no download was started for this run.`;
  const cancelled = fields({ status: "cancelled", message, supersededByRunId: toId });
  cancelled.completedAt = { timestampValue: at };
  cancelled.lastActivityAt = { timestampValue: at };
  const create = { update: { name: `${root}/extractionRuns/${toId}`, fields: packed }, currentDocument: { exists: false } };
  // A failed run is left as recorded; only a queued run must be cancelled so it cannot also start.
  if (run.status === "failed") { await json(`${base}:commit`, "POST", { writes: [create] }); console.log(JSON.stringify({ retried: fromId, queued: toId, at })); return; }
  await json(`${base}:commit`, "POST", { writes: [
    {
      update: { name: raw.name, fields: cancelled },
      updateMask: { fieldPaths: ["status", "message", "supersededByRunId", "completedAt", "lastActivityAt"] },
      updateTransforms: [{ fieldPath: "executionTimeline", appendMissingElements: { values: [fields({ entry: { at, event: "cancelled", message } }).entry] } }],
      currentDocument: { updateTime: raw.updateTime }
    },
    { update: { name: `${root}/extractionRuns/${toId}`, fields: packed }, currentDocument: { exists: false } }
  ] });
  console.log(JSON.stringify({ cancelled: fromId, queued: toId, at }));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
