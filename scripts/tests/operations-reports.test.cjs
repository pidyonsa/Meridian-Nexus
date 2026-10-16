"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs");
const reports = require("../../functions/operations-reports");
const doc = (id, value) => ({ id, exists: Boolean(value), data: () => value });
class ErrorWithCode extends Error { constructor(code, message) { super(message); this.code = code; } }
const run = { status: "completed", fileId: "final", auditFileId: "audit", retailerName: "Wilmar", completedAt: "2026-09-23T10:00:00Z" };
const file = { name: "Aug26- ALL Clients by SKU.xlsx", source: "retailer-extraction", extractionRunId: "verified", storagePath: "uploads/final/report.xlsx" };
function database(overrides = {}) {
  const values = { "adminUsers/admin": { role: "admin" }, "extractionRuns/verified": run, "files/final": file,
    "files/audit": { ...file, name: "Wilmar Aug26 validation audit.xlsx", storagePath: "uploads/audit/audit.xlsx" }, ...overrides };
  return { collection: name => ({ doc: id => ({ id, get: async () => doc(id, values[`${name}/${id}`]) }) }),
    getAll: async (...refs) => Promise.all(refs.map(ref => ref.get())) };
}
test("lists final and audit without a Files browser subscription or exposing storage paths", async () => {
  const result = await reports.list({ db: database(), role: "admin", profile: { role: "admin" }, runs: [doc("verified", run)] });
  assert.equal(result.reportsStatus, "ready"); assert.deepEqual(result.reports.map(item => item.id), ["final", "audit"]);
  assert.equal(result.reports[0].name, file.name); assert.equal(result.reports[0].storagePath, undefined);
});
test("does not list failed, deleted, unrelated or other-account files", async () => {
  const result = await reports.list({ db: database({ "files/audit": null }), role: "admin", profile: { role: "admin" },
    runs: [doc("verified", run), doc("bad", { ...run, status: "failed", fileId: "bad" })] });
  assert.equal(result.reports.length, 1);
  for (const profile of [{ role: "normal" }, { role: "admin", disabled: true }, { role: "admin", accountType: "client" }, { role: "admin", chatAccess: { audience: "external" } }]) {
    assert.equal((await reports.list({ db: database(), role: profile.role, profile, runs: [doc("verified", run)] })).reportsStatus, "restricted");
  }
});
test("bounded metadata lookup, newest first, with duplicate outputs removed", async () => {
  let size = 0;
  await reports.list({ db: { collection: () => ({ doc: id => ({ id }) }), getAll: async (...refs) => { size = refs.length; return []; } },
    role: "admin", profile: { role: "admin" }, runs: Array.from({ length: 80 }, (_, i) => doc(`run-${i}`, { ...run, fileId: `file-${i}` })) });
  assert.equal(size, 24);
});
test("admin download reads only a completed report's private object", async () => {
  const result = await reports.download({ db: database(), uid: "admin", id: "final", HttpsError: ErrorWithCode,
    read: async options => { assert.equal(options.storagePath, file.storagePath); return { chunk: "dGVzdA==" }; } });
  assert.equal(result.sourceName, file.name);
});
test("download denies disabled, external, normal and missing admin profiles before reading", async () => {
  for (const profile of [null, { role: "normal" }, { role: "admin", disabled: true }, { role: "admin", chatAccess: { workRole: "Client" } }]) {
    await assert.rejects(reports.download({ db: database({ "adminUsers/admin": profile }), uid: "admin", id: "final", HttpsError: ErrorWithCode,
      read: () => assert.fail("must not read") }), { code: "permission-denied" });
  }
});
test("download denies unlinked, incomplete, non-report and invalid paths", async () => {
  for (const override of [{ "extractionRuns/verified": { ...run, fileId: "different" } }, { "extractionRuns/verified": { ...run, status: "running" } },
    { "files/final": { ...file, source: "upload" } }, { "files/final": { ...file, storagePath: "uploads/other/secret.xlsx" } },
    { "files/final": { ...file, storagePath: "uploads/final/../secret.xlsx" } }]) {
    await assert.rejects(reports.download({ db: database(override), uid: "admin", id: "final", HttpsError: ErrorWithCode,
      read: () => assert.fail("must not read") }));
  }
});
test("invalid range requests are rejected", async () => {
  for (const input of [{ start: -1 }, { start: 1.5 }, { start: 4 }, { start: "0" }]) {
    await assert.rejects(reports.download({ db: database(), uid: "admin", id: "final", HttpsError: ErrorWithCode, ...input, read: () => assert.fail("must not read") }), { code: "invalid-argument" });
  }
});
test("chunks are bounded, version-pinned and verified before returning", async () => {
  const size = 4 * 1024 * 1024 + 3, calls = [];
  const bucket = { file: (name, version) => ({ getMetadata: async () => [{ size, generation: "123", contentType: "application/test" }],
    download: async options => { calls.push({ version, options }); return [Buffer.alloc(options.end - options.start + 1, 1)]; } }) };
  const base = { bucket, HttpsError: ErrorWithCode, storagePath: file.storagePath, expectedSize: size };
  const first = await reports.readChunk({ ...base, start: 0 }); assert.equal(first.complete, false); assert.equal(first.nextOffset, 4 * 1024 * 1024);
  const second = await reports.readChunk({ ...base, start: first.nextOffset, generation: first.generation }); assert.equal(second.complete, true);
  assert.equal(Buffer.from(second.chunk, "base64").length, 3); assert.equal(calls[0].version.generation, "123");
  await assert.rejects(reports.readChunk({ ...base, start: 1, generation: "999" }), { code: "failed-precondition" });
  await assert.rejects(reports.readChunk({ ...base, start: 0, expectedSize: 123 }), { code: "failed-precondition" });
  await assert.rejects(reports.readChunk({ ...base, start: size }), { code: "failed-precondition" });
});
test("browser renders workspace reports without legacy files and uses checked download API", async () => {
  const code = fs.readFileSync(process.env.REPORTS_APP || "public/app.js", "utf8");
  const elements = Object.fromEntries(["automationDeliveryHistory", "adminDeliveryList", "adminDeliverySummary"].map(key => [key, {}]));
  const state = { files: [], operationsWorkspace: { reports: [{ id: "final", ...file, downloadKind: "extraction-report" }], reportsStatus: "ready" } };
  const badge = {}, calls = [], context = vm.createContext({ state, elements, document: { getElementById: () => badge },
    escapeHtml: value => String(value).replaceAll("<", "&lt;"), formatDate: () => "23 Sep 2026", sortFilesNewestFirst: () => 0,
    atob: value => Buffer.from(value, "base64").toString("binary"), Blob,
    URL: { createObjectURL: blob => { assert.equal(blob.size, 8); return "blob:checked-url"; } },
    callFunction: async (name, data) => { calls.push({ name, data }); return { chunk: "dGVzdA==", size: 8, nextOffset: data.start + 4, complete: data.start === 4, generation: "123" }; },
    storage: { ref: () => assert.fail("legacy storage must not run") } });
  for (const name of ["reportFiles", "renderReportDeliveries", "getDownloadUrl"]) vm.runInContext(code.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0], context);
  vm.runInContext("renderReportDeliveries()", context);
  assert.match(elements.automationDeliveryHistory.innerHTML, /Aug26- ALL Clients by SKU.xlsx/); assert.equal(badge.textContent, "Nexus files");
  assert.equal(await vm.runInContext("getDownloadUrl(reportFiles()[0])", context), "blob:checked-url");
  assert.equal(calls.length, 2); assert.equal(calls[1].data.generation, "123");
  assert.equal(calls[0].name, "getPortalResourceDownload"); assert.equal(calls[0].data.kind, "extraction-report");
  state.operationsWorkspace = { reports: [], reportsStatus: "unavailable" }; vm.runInContext("renderReportDeliveries()", context);
  assert.match(elements.automationDeliveryHistory.innerHTML, /could not be loaded/);
  state.operationsWorkspace = null; vm.runInContext("renderReportDeliveries()", context);
  assert.doesNotMatch(elements.automationDeliveryHistory.innerHTML, /Aug26/);
});
