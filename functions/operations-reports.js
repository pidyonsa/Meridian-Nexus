"use strict";

const validId = value => typeof value === "string" && /^[\w-]{1,160}$/.test(value);
const activeAdmin = profile => profile?.role === "admin" && profile.disabled !== true
  && !["client"].includes(profile.accountType) && profile.chatAccess?.audience !== "external"
  && profile.chatAccess?.workRole !== "Client";
const idsForRun = run => [...new Set([run.fileId, run.auditFileId,
  ...(Array.isArray(run.artifacts) ? run.artifacts.map(item => item?.fileId) : [])].filter(validId))];
const isReport = file => file.source === "retailer-extraction" && validId(file.extractionRunId);
function time(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || 0);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function list({ db, role, profile, runs }) {
  if (role !== "admin" || !activeAdmin(profile)) return { reports: [], reportsStatus: "restricted" };
  const candidates = new Map();
  const completed = runs.map(doc => ({ id: doc.id, ...doc.data() })).filter(run => run.status === "completed")
    .sort((a, b) => String(time(b.completedAt || b.createdAt)).localeCompare(String(time(a.completedAt || a.createdAt))));
  for (const run of completed) {
    for (const id of idsForRun(run)) if (!candidates.has(id) && candidates.size < 24) candidates.set(id, run);
    if (candidates.size >= 24) break;
  }
  if (!candidates.size) return { reports: [], reportsStatus: "ready" };
  const files = await db.getAll(...[...candidates.keys()].map(id => db.collection("files").doc(id)));
  const reports = files.filter(doc => doc.exists && isReport(doc.data())).map(doc => {
    const file = doc.data(), run = candidates.get(doc.id);
    return { id: doc.id, name: String(file.name || file.originalName || "Report").slice(0, 300),
      retailerName: String(file.retailerName || run.retailerName || "Extraction profile").slice(0, 160),
      completedAt: time(file.completedAt || file.uploadedAt || file.createdAt || run.completedAt),
      artifactKind: String(file.artifactKind || ""), extractionRunId: file.extractionRunId,
      source: file.source, downloadKind: "extraction-report" };
  });
  return { reports, reportsStatus: "ready" };
}

async function download({ db, uid, id, start = 0, generation, HttpsError, read }) {
  const profile = await db.collection("adminUsers").doc(uid).get();
  if (!profile.exists || !activeAdmin(profile.data())) throw new HttpsError("permission-denied", "An active admin account is required.");
  if (!validId(id)) throw new HttpsError("invalid-argument", "A valid report ID is required.");
  const doc = await db.collection("files").doc(id).get();
  if (!doc.exists || !isReport(doc.data())) throw new HttpsError("not-found", "The completed report was not found.");
  const file = doc.data(), run = await db.collection("extractionRuns").doc(file.extractionRunId).get();
  if (!run.exists || run.data().status !== "completed" || !idsForRun(run.data()).includes(id)) {
    throw new HttpsError("failed-precondition", "This file is not a completed report output.");
  }
  const storagePath = String(file.storagePath || "");
  if (!storagePath.startsWith(`uploads/${id}/`) || storagePath.slice(`uploads/${id}/`.length).includes("/")
    || !storagePath.slice(`uploads/${id}/`.length) || /[\\\r\n]/.test(storagePath)) {
    throw new HttpsError("failed-precondition", "The report file path is invalid.");
  }
  if (!Number.isSafeInteger(start) || start < 0 || (start > 0 && !/^\d{1,30}$/.test(String(generation || "")))) {
    throw new HttpsError("invalid-argument", "The report download offset is invalid.");
  }
  return { ...await read({ storagePath, start, generation, expectedSize: Number(file.size || 0) }), sourceName: String(file.name || "Report").slice(0, 300) };
}

async function readChunk({ bucket, HttpsError, storagePath, start, generation, expectedSize }) {
  const [metadata] = await bucket.file(storagePath).getMetadata();
  const size = Number(metadata.size), currentGeneration = String(metadata.generation);
  if (!Number.isSafeInteger(size) || size <= 0 || start >= size || (expectedSize && expectedSize !== size)) {
    throw new HttpsError("failed-precondition", "The saved report size is invalid.");
  }
  if (generation && String(generation) !== currentGeneration) throw new HttpsError("failed-precondition", "The report changed during download. Please retry.");
  const end = Math.min(size - 1, start + 4 * 1024 * 1024 - 1);
  // Read a generation-pinned range so large workbooks never exceed callable limits.
  const [bytes] = await bucket.file(storagePath, { generation: currentGeneration }).download({ start, end, validation: false });
  if (bytes.length !== end - start + 1) throw new HttpsError("unavailable", "The report download was incomplete. Please retry.");
  return { chunk: bytes.toString("base64"), nextOffset: end + 1, complete: end + 1 === size, size,
    generation: currentGeneration, contentType: metadata.contentType || "application/octet-stream" };
}

module.exports = { list, download, readChunk };
