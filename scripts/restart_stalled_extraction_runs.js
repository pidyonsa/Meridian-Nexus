const { execFileSync } = require("node:child_process");

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "meridain-nexus";
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const restartableStatuses = new Set(["queued", "running", "cancelling"]);
const transientFields = new Set([
  "status", "message", "createdAt", "startedAt", "completedAt", "updatedAt", "lastActivityAt",
  "currentStep", "totalSteps", "currentStepAction", "executionTimeline", "reportIdentity",
  "fileId", "fileName", "originalFileName", "fileSize", "fileSha256", "storagePath", "sharePoint",
  "uploadedAt", "isDuplicate", "duplicateOfFileId", "attendanceBlueprint", "attendanceBlueprintUpdateRunId",
  "salesDashboardImportId", "attendanceTrackerUpdateRunId", "merchandiserTrackerUpdateRunId",
  "companionRunId", "companionRunIds", "cancellationRequestedAt", "cancellationRequestedBy",
  "portalWaitAcknowledgedAt", "portalWaitAcknowledgedBy", "runSummary", "failureEvidence", "promptId",
  "failureProvider", "failureCategory", "workbookChanged", "retryQueuedAt", "retryQueuedRunId",
  "salesforceAutoRetry", "salesforceAutoRetryQueuedAt", "salesforceAutoRetryQueuedRunId"
]);

function accessToken() {
  if (process.env.FIRESTORE_ACCESS_TOKEN) return process.env.FIRESTORE_ACCESS_TOKEN.trim();
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  } catch (error) {
    return execFileSync("gcloud.cmd", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  }
}

const token = accessToken();

async function firestoreRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
  return body;
}

function stringValue(fields, key) {
  return String(fields?.[key]?.stringValue || "");
}

function millis(fields, key) {
  const value = fields?.[key]?.timestampValue || fields?.[key]?.stringValue || "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function retryFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).filter(([key]) => !transientFields.has(key)));
}

function timestamp(value = new Date()) {
  return { timestampValue: value.toISOString() };
}

function text(value) {
  return value ? { stringValue: String(value) } : { nullValue: null };
}

function timelineEvent(event, message, extra = {}) {
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries({ event, message, ...extra, at: new Date().toISOString() })
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, { stringValue: String(value) }]))
    }
  };
}

function appendTimeline(fields, event) {
  const values = Array.isArray(fields?.executionTimeline?.arrayValue?.values)
    ? fields.executionTimeline.arrayValue.values.slice()
    : [];
  values.push(event);
  return { arrayValue: { values } };
}

async function updateDocument(path, fields) {
  const mask = Object.keys(fields).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  return firestoreRequest(`${baseUrl}/${path}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields })
  });
}

async function createDocument(collection, fields) {
  return firestoreRequest(`${baseUrl}/${collection}`, {
    method: "POST",
    body: JSON.stringify({ fields })
  });
}

async function cancelWaitingPrompts(runId) {
  const query = {
    structuredQuery: {
      from: [{ collectionId: "automationPrompts" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "runId" }, op: "EQUAL", value: { stringValue: runId } } },
            { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "waiting" } } }
          ]
        }
      }
    }
  };
  const rows = await firestoreRequest(`${baseUrl}:runQuery`, { method: "POST", body: JSON.stringify(query) });
  for (const row of rows || []) {
    if (!row.document?.name) continue;
    const path = row.document.name.split("/documents/")[1];
    await updateDocument(path, {
      status: { stringValue: "cancelled" },
      handledAt: timestamp(),
      handledBy: { stringValue: "maintenance-restart" }
    });
  }
}

async function main() {
  const runIds = process.argv.slice(2).map((value) => String(value || "").trim()).filter(Boolean);
  if (!runIds.length) throw new Error("Pass one or more explicit extraction run IDs to restart.");

  const now = Date.now();
  const thresholdMs = Number(process.env.STALLED_THRESHOLD_MS || 90_000);
  for (const runId of runIds) {
    const source = await firestoreRequest(`${baseUrl}/extractionRuns/${encodeURIComponent(runId)}`);
    const fields = source.fields || {};
    const status = stringValue(fields, "status");
    const last = Math.max(millis(fields, "lastActivityAt"), millis(fields, "updatedAt"), millis(fields, "startedAt"), millis(fields, "createdAt"));
    const inactiveMs = now - last;
    if (!restartableStatuses.has(status) || inactiveMs < thresholdMs) {
      console.log(JSON.stringify({ runId, skipped: true, status, inactiveMinutes: Math.round(inactiveMs / 6000) / 10 }));
      continue;
    }

    const ownerUid = stringValue(fields, "createdBy") || stringValue(fields, "scheduledBy") || "scheduler";
    const ownerEmail = stringValue(fields, "createdByEmail") || stringValue(fields, "scheduledByEmail");
    const ownerName = stringValue(fields, "createdByName") || stringValue(fields, "scheduledByName");
    const report = stringValue(fields, "retailerName") || stringValue(fields, "extractionName") || stringValue(fields, "retailerId");

    await cancelWaitingPrompts(runId);
    const retry = await createDocument("extractionRuns", {
      ...retryFields(fields),
      batchId: { nullValue: null },
      displayComplianceBatchId: { nullValue: null },
      retryOfRunId: { stringValue: runId },
      trigger: { stringValue: "maintenance-restart" },
      status: { stringValue: "queued" },
      message: { stringValue: "Fresh extraction retry queued after the previous job stalled before the worker started." },
      createdBy: { stringValue: ownerUid },
      createdByEmail: text(ownerEmail),
      createdByName: text(ownerName),
      scheduledBy: fields.scheduledBy || (stringValue(fields, "trigger") === "scheduled" ? { stringValue: ownerUid } : { nullValue: null }),
      scheduledByEmail: fields.scheduledByEmail || (stringValue(fields, "trigger") === "scheduled" ? text(ownerEmail) : { nullValue: null }),
      scheduledByName: fields.scheduledByName || (stringValue(fields, "trigger") === "scheduled" ? text(ownerName) : { nullValue: null }),
      createdAt: timestamp(),
      lastActivityAt: timestamp(),
      executionTimeline: { arrayValue: { values: [timelineEvent("maintenance-restart-queued", "Fresh owner-preserving retry queued for a stale extraction job.", { retryOfRunId: runId })] } }
    });
    const newRunId = retry.name.split("/").pop();
    await updateDocument(`extractionRuns/${runId}`, {
      status: { stringValue: "cancelled" },
      message: { stringValue: "Stalled extraction was restarted by Admin maintenance. A fresh job was queued under the original owner." },
      cancellationRequestedAt: timestamp(),
      cancellationRequestedBy: { stringValue: "maintenance-restart" },
      completedAt: timestamp(),
      lastActivityAt: timestamp(),
      retryQueuedRunId: { stringValue: newRunId },
      executionTimeline: appendTimeline(fields, timelineEvent("maintenance-restart", "Admin maintenance cancelled this stale job and queued a fresh owner-preserving retry.", { retryRunId: newRunId }))
    });
    console.log(JSON.stringify({ oldRunId: runId, newRunId, status, report, ownerUid, ownerEmail, ownerName }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
