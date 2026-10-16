"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { json } = require("./release-multi-admin.cjs");
const { encode } = require("./update-dataorbis-validation.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const { stage } = require("./release-dataorbis-workflow.cjs");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const docBase = base.replace("https://firestore.googleapis.com/v1/", "");
const read = async file => JSON.parse(await fs.readFile(path.join(stage, file), "utf8"));
const unpack = doc => decode({ mapValue: { fields: doc.fields } });
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function fields(value) {
  const result = encode(value).mapValue.fields;
  for (const key of ["createdAt", "startedAt", "completedAt", "uploadedAt", "updatedAt", "lastActivityAt"]) if (value[key]) result[key] = { timestampValue: value[key] };
  return result;
}
async function main() {
  const verification = await read("live-validation/final-verification.json"), transformed = await read("live-validation/transform-result.json");
  assert.equal(transformed.status, "validated-local"); assert.deepEqual(transformed.blockers, []);
  assert.equal(verification.batchDigest, transformed.batchDigest);
  const monthDoc = await json(`${base}/dataorbisMonthlyTemplates/2026-08`), month = unpack(monthDoc);
  assert.ok(!month.activeRunId, "An interactive monthly run is active; do not replace its inputs.");
  assert.equal(month.template.sha256, verification.templateSha256, "The monthly template changed after local verification.");
  const runId = `dataorbis-wilmar-2026-08-verified-${verification.batchDigest.slice(0, 12)}`;
  const ownerUid = "obJuTf8pD3gnNcH9VI0lt74XWZ33";
  const owner = unpack(await json(`${base}/adminUsers/${ownerUid}?mask.fieldPaths=role&mask.fieldPaths=disabled`));
  assert.equal(owner.role, "admin"); assert.notEqual(owner.disabled, true);
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  const uploads = [], at = new Date().toISOString();
  for (const [fileName, kind] of [["Aug26- ALL Clients by SKU.xlsx", "dataorbis-final"], ["Wilmar Aug26 validation audit.xlsx", "dataorbis-audit"]]) {
    const bytes = await fs.readFile(path.join(stage, "live-validation", fileName));
    const sha256 = hash(bytes); if (kind === "dataorbis-final") assert.equal(sha256, verification.sha256);
    const fileId = crypto.randomUUID(), storagePath = `uploads/${fileId}/${fileName}`;
    const md5 = crypto.createHash("md5").update(bytes).digest("base64");
    const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/meridain-nexus.firebasestorage.app/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(storagePath)}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": MIME, "Content-MD5": md5 }, body: bytes });
    assert.ok(response.ok, `Private output upload failed: ${response.status}`);
    const metadata = await response.json(); assert.equal(Number(metadata.size), bytes.length); assert.equal(metadata.md5Hash, md5);
    uploads.push({ fileId, name: fileName, originalName: fileName, size: bytes.length, type: MIME, storagePath, sha256,
      isDuplicate: false, source: "retailer-extraction", retailerId: "dataorbis-game-sales", extractionRunId: runId, artifactKind: kind,
      reportStartDate: "2026-08-01", reportEndDate: "2026-08-31", createdAt: at, uploadedAt: at, completedAt: at });
  }
  await fs.writeFile(path.join(stage, "verified-output-uploads.json"), JSON.stringify(uploads, null, 2), { flag: "wx" });
  const final = uploads[0], audit = uploads[1];
  const run = { retailerId: "dataorbis-game-sales", retailerName: "Wilmar - Game / Makro / Jumbo", extractionName: "Wilmar monthly sales - verified operator-assisted run",
    workflowMode: "dataorbis-monthly-sales-validated", trigger: "operator-assisted-validation", createdBy: ownerUid, promptOwnerUid: ownerUid,
    status: "completed", message: "August extraction and workbook verified in the authenticated validation session; final file saved in Nexus Files. A full cloud-worker run still needs a fresh OTP when the contact is available.",
    fileId: final.fileId, fileName: final.name, fileSize: final.size, fileSha256: final.sha256, storagePath: final.storagePath, auditFileId: audit.fileId,
    reportMonth: "2026-08", reportStartDate: "2026-08-01", reportEndDate: "2026-08-31", dataorbisTotals: transformed.totals,
    verification: { ...verification, storageVerification: "provider-md5-and-size", cloudWorkerEndToEndVerified: false }, workbookChanged: true,
    validationSourceRunId: "dataorbis-wilmar-connection-94f1ed0e-6dff-4d31-8d13-4c742b637774", createdAt: at, startedAt: at, completedAt: at, lastActivityAt: at,
    executionTimeline: [{ at, event: "verified-output-retained", message: "Saved the independently verified final workbook at the user's request. No additional OTP run was started." }] };
  const writes = uploads.map(file => ({ update: { name: `${docBase}/files/${file.fileId}`, fields: fields(file) }, currentDocument: { exists: false } }));
  writes.push({ update: { name: `${docBase}/extractionRuns/${runId}`, fields: fields(run) }, currentDocument: { exists: false } });
  writes.push({ update: { name: `${docBase}/dataorbisMonthlyBatches/WILMAR-2026-08`, fields: fields({ runId, status: "completed", fileId: final.fileId, batchDigest: verification.batchDigest, client: "WILMAR", month: "2026-08", completedAt: at }) }, currentDocument: { exists: false } });
  writes.push({ update: { name: monthDoc.name, fields: fields({ template: { storagePath: final.storagePath, sha256: final.sha256 }, latestFileId: final.fileId, updatedAt: at }) },
    updateMask: { fieldPaths: ["template", "latestFileId", "updatedAt"] }, currentDocument: { updateTime: monthDoc.updateTime } });
  await json(`${base}:commit`, "POST", { writes });
  const saved = unpack(await json(`${base}/extractionRuns/${runId}`));
  assert.equal(saved.status, "completed"); assert.equal(saved.fileSha256, verification.sha256);
  await fs.writeFile(path.join(stage, "verified-output-published.json"), JSON.stringify({ at, runId, fileId: final.fileId, auditFileId: audit.fileId, fileName: final.name, cloudWorkerEndToEndVerified: false }, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ saved: final.name, runId, totalRows: verification.totalRows, newOtpRuns: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
