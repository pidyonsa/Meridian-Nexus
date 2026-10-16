"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const runtime = require("../../functions/dataorbis-runtime");
const input = { storagePath: "dataorbis-inputs/test.xlsx", sha256: "a".repeat(64) };
function fixture() {
  const documents = new Map([["dataorbisMonthlyTemplates/2026-08", { approved: true, template: input, cleanup: input, callCycle: input }]]);
  let sequence = 0;
  const db = { collection: name => ({ doc: id => ({ id: id || `run-${++sequence}`, path: `${name}/${id || `run-${sequence}`}` }) }),
    runTransaction: async action => {
      const writes = [];
      const tx = { get: async ref => ({ data: () => documents.get(ref.path) }), create: (ref, data) => { assert.ok(!documents.has(ref.path)); writes.push(() => documents.set(ref.path, data)); },
        update: (ref, data) => writes.push(() => documents.set(ref.path, { ...documents.get(ref.path), ...data })),
        set: (ref, data, options) => writes.push(() => documents.set(ref.path, { ...(options?.merge ? documents.get(ref.path) : {}), ...data })) };
      const result = await action(tx); writes.forEach(w => w()); return result;
    } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const args = { db, HttpsError, FieldValue: { serverTimestamp: () => "server-time" }, retailerId: "dataorbis-game-sales",
    retailerData: { name: "Wilmar", username: "synthetic-private-username", webAddress: "https://pyramid.dataorbis.com/", salesProcedure: { clientCode: "WILMAR", supplier: "WILMAR SA (PTY) LTD", automationReady: true, excludeGameOnlineAndNonSa: true } },
    request: { data: { reportStartDate: "2026-08-01", reportEndDate: "2026-08-31" }, auth: { uid: "admin-one", token: { email: "synthetic@example.test" } } } };
  return { documents, args };
}
test("queues the executable workflow with one client's configuration and owner-only OTP identity", async () => {
  const { documents, args } = fixture();
  const result = await runtime.queue(args), run = documents.get(`extractionRuns/${result.runId}`);
  assert.equal(run.workflowMode, runtime.MODE); assert.equal(run.promptOwnerUid, "admin-one");
  assert.equal(run.outputFileName, "Aug26- ALL Clients by SKU.xlsx");
  assert.equal(run.dataorbis.client, "WILMAR"); assert.ok(!JSON.stringify(run).includes("synthetic-private-username"));
  assert.equal(documents.get("dataorbisMonthlyTemplates/2026-08").activeRunId, result.runId);
});
test("a second admin cannot start an overlapping monthly job", async () => {
  const { args } = fixture(); await runtime.queue(args); args.request.auth.uid = "admin-two";
  await assert.rejects(runtime.queue(args), error => error.code === "already-exists");
});
test("cancelled jobs release the logical lock on the next request", async () => {
  const { args, documents } = fixture(); const first = await runtime.queue(args);
  documents.get(`extractionRuns/${first.runId}`).status = "cancelled";
  args.request.auth.uid = "admin-two";
  const second = await runtime.queue(args); assert.notEqual(first.runId, second.runId);
  assert.equal(documents.get(`extractionRuns/${second.runId}`).promptOwnerUid, "admin-two");
});
test("completed client/month batches are reused, not appended again", async () => {
  const { args, documents } = fixture();
  documents.set("dataorbisMonthlyBatches/WILMAR-2026-08", { status: "completed", runId: "existing" });
  assert.deepEqual(await runtime.queue(args), { runId: "existing", reused: true });
});
test("unapproved inputs, cross-client credentials and partial months fail before creating a job", async () => {
  for (const mutate of [f => f.documents.clear(), f => f.args.retailerData.salesProcedure.clientCode = "ESPEN", f => f.args.retailerData.webAddress = "https://example.test/", f => f.args.request.data.reportEndDate = "2026-08-15", f => f.args.retailerData.salesProcedure.automationReady = false]) {
    const f = fixture(); mutate(f); await assert.rejects(runtime.queue(f.args));
    assert.equal([...f.documents.keys()].filter(k => k.startsWith("extractionRuns/")).length, 0);
  }
});
test("a late cancelled worker cannot overwrite its replacement's batch or monthly lock", async () => {
  const { args, documents } = fixture();
  const first = await runtime.queue(args);
  const runRef = args.db.collection("extractionRuns").doc(first.runId);
  documents.get(runRef.path).cancellationRequestedAt = "cancelled";
  const replacement = await runtime.queue(args);
  const monthRef = args.db.collection("dataorbisMonthlyTemplates").doc("2026-08");
  const batchRef = args.db.collection("dataorbisMonthlyBatches").doc("WILMAR-2026-08");
  await runtime.failRun({ ...args, monthRef, batchRef, runRef, runId: first.runId, message: "Cancelled" });
  assert.equal(documents.get(monthRef.path).activeRunId, replacement.runId);
  assert.equal(documents.get(batchRef.path).runId, replacement.runId);
  assert.equal(documents.get(batchRef.path).status, "queued");
  assert.equal(documents.get(runRef.path).status, "cancelled");
});
