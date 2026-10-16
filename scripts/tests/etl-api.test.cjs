"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApi } = require("../../functions/meridian-etl");
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function api({ user, profile, result, run, output, outputSize, beforeTransaction, statusBytes, ioDelay = 0 } = {}) {
  let writes = 0;
  const reads = [], stats = { pending: 0, maxPending: 0, statusMetadata: 0 };
  const record = run || { id: "a".repeat(32), status: "review", createdAt: new Date().toISOString() };
  const db = {
    collection: name => ({ doc: () => ({ get: async () => ({ exists: name === "adminUsers" ? !!profile : true, data: () => name === "adminUsers" ? profile : { ...record } }), update: async patch => { writes++; Object.assign(record, patch); } }) }),
    runTransaction: async fn => {
      if (beforeTransaction) await beforeTransaction(record);
      return fn({ get: ref => ref.get(), update: (ref, patch) => ref.update(patch), create: () => { writes++; } });
    }
  };
  const bucket = { file: path => ({
    getMetadata: async () => {
      if (path.endsWith(".json")) stats.statusMetadata++;
      if (path.endsWith("result.json") && result) return [{ size: JSON.stringify(result).length }];
      if (/\.(xlsx|jsonl)$/.test(path) && output) return [{ size: outputSize ?? output.length, generation: "123" }];
      const e = new Error("missing"); e.code = 404; throw e;
    },
    download: async options => {
      reads.push({ path, options }); stats.pending++; stats.maxPending = Math.max(stats.maxPending, stats.pending);
      try {
        if (ioDelay) await new Promise(resolve => setTimeout(resolve, ioDelay));
        if (path.endsWith("result.json") && (result || statusBytes)) return [(statusBytes || Buffer.from(JSON.stringify(result))).subarray(options.start, options.end + 1)];
        if (/\.(xlsx|jsonl)$/.test(path) && output) return [output.subarray(options.start, options.end + 1)];
        throw Object.assign(new Error("missing"), { code: 404 });
      } finally { stats.pending--; }
    },
    getSignedUrl: () => assert.fail("ETL downloads must not require signing permissions")
  }) };
  return { handler: createApi({ db, getAuth: () => ({ getUser: async () => user }), bucket, HttpsError }), writes: () => writes, reads, stats };
}
const admin = { uid: "admin", email: "admin@nexus.co.za", customClaims: { admin: true }, tokensValidAfterTime: "2026-01-01T00:00:00Z" };
const request = data => ({ auth: { uid: "admin", token: { admin: true, auth_time: Date.parse("2026-09-09T00:00:00Z") / 1000 } }, data });

test("completed status uses overlapping bounded reads without metadata round trips", async () => {
  const instance = api({ user: admin, profile: { role: "admin" }, result: { status: "review", totals: {} }, ioDelay: 20 });
  await instance.handler(request({ action: "detail", id: "a".repeat(32) }));
  assert.equal(instance.reads.length, 2);
  assert.equal(instance.stats.statusMetadata, 0);
  assert.equal(instance.stats.maxPending, 2);
  for (const { options } of instance.reads) assert.deepEqual(options, { start: 0, end: 2 * 1024 * 1024, validation: false });
});

test("bounded status reads still reject oversized results before parsing", async () => {
  const instance = api({ user: admin, profile: { role: "admin" }, statusBytes: Buffer.alloc(2 * 1024 * 1024 + 2, 32) });
  await assert.rejects(instance.handler(request({ action: "detail", id: "a".repeat(32) })), { code: "internal" });
  assert.equal(instance.writes(), 0);
});

test("history refresh bounds active-run concurrency and preserves run order", async () => {
  const runs = Array.from({ length: 13 }, (_, i) => ({ id: i.toString(16).padStart(32, "0"), status: i === 0 ? "approved" : "running", createdAt: new Date().toISOString() }));
  let active = 0, maxActive = 0;
  const detailIds = [];
  const db = { collection: name => ({
    doc: id => ({ get: async () => {
      if (name === "adminUsers") return { exists: true, data: () => ({ role: "admin" }) };
      detailIds.push(id); const run = runs.find(r => r.id === id); return { exists: true, data: () => run };
    } }),
    orderBy: () => ({ limit: () => ({ get: async () => ({ docs: runs.map(run => ({ id: run.id, data: () => run })) }) }) })
  }) };
  const bucket = { file: () => ({ download: async () => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 10)); active--;
    throw Object.assign(new Error("not yet written"), { code: 404 });
  } }) };
  const handler = createApi({ db, getAuth: () => ({ getUser: async () => admin }), bucket, HttpsError });
  const result = await handler(request({ action: "history" }));
  assert.deepEqual(result.runs, runs);
  assert.deepEqual(detailIds, runs.slice(1, 11).map(run => run.id));
  assert.equal(maxActive, 8, "At most four runs each read two status objects concurrently");
  assert.equal(active, 0);
});
test("anonymous access is rejected before any data access", async () => {
  await assert.rejects(api().handler({ data: { action: "history" } }), { code: "unauthenticated" });
});
test("staff, client, disabled, removed and revoked identities cannot use ETLs", async () => {
  for (const [user, profile] of [[{ ...admin, customClaims: { operator: true } }, {}], [{ ...admin, customClaims: { admin: true, chatClient: true } }, {}], [admin, { accountType: "client" }], [{ ...admin, disabled: true }, {}], [admin, { disabled: true }], [admin, null], [{ ...admin, tokensValidAfterTime: "2027-01-01T00:00:00Z" }, {}]]) {
    await assert.rejects(api({ user, profile }).handler(request({ action: "history" })), { code: "permission-denied" });
  }
});
test("valid admin still cannot choose arbitrary paths or skip confirmations", async () => {
  const { handler } = api({ user: admin, profile: { role: "admin" } });
  await assert.rejects(handler(request({ action: "detail", id: "../../other" })), { code: "invalid-argument" });
  await assert.rejects(handler(request({ action: "run", resources: {}, rules: {} })), { code: "invalid-argument" });
  await assert.rejects(handler(request({ action: "deleteEverything" })), { code: "invalid-argument" });
  for(const pipelineId of ['anchor-clicks-v1','anchor-spar-v1','another-customer-pnp','']) await assert.rejects(handler(request({ action: 'run', pipelineId, resources: {}, rules: {} })), {code:'failed-precondition'});
});
test("review outputs cannot be approved even by admin", async () => {
  const result = { status: "review", reconciled: true, totals: { readyRows: 1, exceptionRows: 1, invalidDcRows: 0 } };
  const instance = api({ user: admin, profile: { role: "admin" }, result });
  await assert.rejects(instance.handler(request({ action: "approve", id: "a".repeat(32), confirm: true })), { code: "failed-precondition" });
  assert.equal(instance.writes(), 0);
});
test("download paths are chosen from a fixed server allowlist", async () => {
  const instance = api({ user: admin, profile: { role: "admin" }, result: { status: "review", output: { name: "../../other" } } });
  await assert.rejects(instance.handler(request({ action: "download", id: "a".repeat(32), file: "workbook" })), { code: "invalid-argument" });
});

test("reconciled outputs with accepted warnings and liquor exclusions may be approved manually", async () => {
  const result = { status: "ready", reconciled: true, output: { sha256: "fixture-output" }, totals: { readyRows: 3, warningRows: 2, excludedRows: 1, exceptionRows: 0, invalidDcRows: 0 } };
  const instance = api({ user: admin, profile: { role: "admin" }, run: { id: "a".repeat(32), status: "ready", fingerprint: "policy-fingerprint", createdAt: new Date().toISOString() }, result });
  await assert.rejects(instance.handler(request({ action: "approve", id: "a".repeat(32) })), { code: "failed-precondition" });
  const approved = await instance.handler(request({ action: "approve", id: "a".repeat(32), confirm: true }));
  assert.equal(approved.run.status, "approved"); assert.equal(approved.run.approval.fingerprint, "policy-fingerprint");
});
test("assigned staff Admins can download bounded generation-pinned chunks without signing", async () => {
  const output = Buffer.alloc(1024 * 1024 + 5, 65), user = { ...admin, email: "manager@example.test" };
  const instance = api({ user, profile: { role: "admin", accountType: "staff" }, result: { status: "review", asOf: "2026-09-01", output: { name: "inventory-draft.xlsx" } }, output });
  const input = { action: "download", id: "a".repeat(32), file: "workbook" };
  const first = await instance.handler(request(input));
  assert.equal(Buffer.from(first.dataBase64, "base64").length, 1024 * 1024); assert.equal(first.nextOffset, 1024 * 1024); assert.equal(first.url, undefined);
  const last = await instance.handler(request({ ...input, offset: first.nextOffset, generation: first.generation }));
  assert.equal(last.nextOffset, null); assert.equal(Buffer.from(last.dataBase64, "base64").length, 5);
  assert.deepEqual(Buffer.concat([Buffer.from(first.dataBase64, "base64"), Buffer.from(last.dataBase64, "base64")]), output);
  for (const extra of [{ offset: -1 }, { offset: 1.5 }, { offset: output.length + 1 }]) await assert.rejects(instance.handler(request({ ...input, ...extra })), { code: "invalid-argument" });
  await assert.rejects(instance.handler(request({ ...input, offset: 1, generation: "old" })), { code: "failed-precondition" });
  user.customClaims = { admin: false }; await assert.rejects(instance.handler(request(input)), { code: "permission-denied" });
});
test("oversized output is rejected before allocating its contents", async () => {
  const instance = api({ user: admin, profile: { role: "admin" }, result: { output: { name: "inventory.xlsx" } }, output: Buffer.from("test"), outputSize: 64 * 1024 * 1024 + 1 });
  await assert.rejects(instance.handler(request({ action: "download", id: "a".repeat(32), file: "workbook" })), { code: "resource-exhausted" });
});

test('late completed output clears an earlier failure instead of displaying a false Retry', async () => {
  const instance = api({ user: admin, profile: { role: 'admin' },
    run: { id: 'a'.repeat(32), status: 'failed', error: 'Worker launch response timed out', createdAt: new Date().toISOString() },
    result: { status: 'review', completedAt: new Date().toISOString(), totals: { exceptionRows: 1 } }
  });
  const detail = await instance.handler(request({ action: 'detail', id: 'a'.repeat(32) }));
  assert.equal(detail.run.status, 'review');
  assert.equal(detail.run.error, null);
});

test('deadline checks cannot downgrade a completed run with temporarily absent output metadata', async () => {
  for (const status of ['ready', 'review', 'approved']) {
    const instance = api({ user: admin, profile: { role: 'admin' },
      run: { id: 'a'.repeat(32), status, createdAt: '2026-01-01T00:00:00Z' }
    });
    const detail = await instance.handler(request({ action: 'detail', id: 'a'.repeat(32) }));
    assert.equal(detail.run.status, status);
    assert.equal(instance.writes(), 0);
  }
});

test('status refresh preserves an approval saved while worker metadata is being read', async () => {
  const instance = api({ user: admin, profile: { role: 'admin' },
    run: { id: 'a'.repeat(32), status: 'running', createdAt: new Date().toISOString() },
    result: { status: 'ready', completedAt: new Date().toISOString(), totals: { readyRows: 1 } },
    beforeTransaction: record => { record.status = 'approved'; record.approval = { at: '2026-09-22T09:00:00Z' }; }
  });
  const detail = await instance.handler(request({ action: 'detail', id: 'a'.repeat(32) }));
  assert.equal(detail.run.status, 'approved');
  assert.equal(instance.writes(), 0);
});
