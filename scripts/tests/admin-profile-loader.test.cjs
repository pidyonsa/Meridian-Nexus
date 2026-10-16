"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../../public/admin-profile-loader.js"), "utf8");
function loader() { const context = { window: {}, AbortController, DOMException, setTimeout, clearTimeout, fetch: () => { throw Error("Unexpected network access"); } }; vm.runInNewContext(source, context); return context.window.NexusAdminProfiles; }
const user = { uid: "test-admin", getIdToken: async () => "synthetic-token" };
const docs = [{ document: { name: "projects/meridain-nexus/databases/(default)/documents/retailers/game", fields: { name: { stringValue: "Game Sales" }, username: { stringValue: "saved-user" }, reportSchedule: { mapValue: { fields: { enabled: { booleanValue: false } } } }, credentialsUpdatedAt: { timestampValue: "2026-09-22T10:00:00Z" } } } }];
const response = data => ({ ok: true, json: async () => data });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
function harness(fetcher, timeoutMs = 300) {
  const states = []; let next, error, stopped = 0;
  const stop = loader().start({ user, projectId: "meridain-nexus", fetcher, timeoutMs,
    listen: (n, e) => { next = n; error = e; return () => stopped++; },
    onChange: value => states.push(value) });
  return { states, stop, next: value => next(value), fail: value => error(value), stopped: () => stopped };
}
test("one-shot read retains the Firebase authorization boundary and requests only non-secret profile fields", async () => {
  let request;
  const rows = await loader().read({ user, projectId: "meridain-nexus", signal: new AbortController().signal,
    fetcher: async (url, options) => { request = { url, ...options }; return response(docs); } });
  assert.equal(request.headers.Authorization, "Bearer synthetic-token");
  assert.match(request.url, /^https:\/\/firestore.googleapis.com\/v1\/projects\/meridain-nexus\//);
  const query = JSON.parse(request.body).structuredQuery;
  assert.equal(query.from[0].collectionId, "retailers"); assert.equal(query.limit, 1001);
  assert.equal(query.select.fields.some(f => /password|secret|privateKey/i.test(f.fieldPath)), false);
  assert.equal(rows[0].id, "game"); assert.equal(rows[0].username, "saved-user"); assert.equal(rows[0].reportSchedule.enabled, false);
  assert.equal(rows[0].credentialsUpdatedAt.toISOString(), "2026-09-22T10:00:00.000Z");
});
test("stalled live stream is recovered by the one-shot read", async () => {
  const h = harness(async () => response(docs)); await tick();
  assert.equal(h.states[0].status, "loading"); assert.equal(h.states.at(-1).rows.length, 1); assert.equal(h.states.at(-1).status, "ready"); h.stop();
});
test("cache-only empty snapshots cannot erase server results", async () => {
  const h = harness(async () => response(docs)); await tick();
  h.next({ metadata: { fromCache: true }, docs: [] });
  assert.equal(h.states.at(-1).rows.length, 1); h.stop();
});
test("a newer server snapshot wins over a slower one-shot read", async () => {
  let resolve; const h = harness(() => new Promise(done => { resolve = done; })); await tick();
  h.next({ docs: [{ id: "new", data: () => ({ name: "Updated" }) }], metadata: { fromCache: false } });
  resolve(response(docs)); await tick(); assert.equal(h.states.at(-1).rows[0].id, "new"); h.stop();
});
test("permission denial is explicit and clears profiles without falling back to broader access", async () => {
  const h = harness(async () => ({ ok: false, status: 403 })); await tick();
  assert.equal(h.states.at(-1).status, "error"); assert.equal(h.states.at(-1).rows.length, 0); assert.match(h.states.at(-1).error, /not permitted/); assert.equal(h.stopped(), 1);
});
test("listener denial cannot be overwritten by a late authorized response", async () => {
  let resolve; const h = harness(() => new Promise(done => { resolve = done; })); await tick();
  h.fail({ code: "permission-denied" }); resolve(response(docs)); await tick();
  assert.equal(h.states.at(-1).status, "error"); assert.equal(h.states.at(-1).rows.length, 0);
});
test("logout stops both reads and ignores queued snapshot callbacks", async () => {
  let resolve; const h = harness(() => new Promise(done => { resolve = done; })); await tick();
  h.stop(); resolve(response(docs)); h.next({ docs: [{ id: "stale", data: () => ({}) }] }); await tick();
  assert.equal(h.states.length, 1); assert.equal(h.stopped(), 1);
});
test("even a token or network promise that never resolves has a visible timeout", async () => {
  const h = harness(() => new Promise(() => {}), 15); await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(h.states.at(-1).status, "error"); assert.match(h.states.at(-1).error, /timed out/); h.stop();
});
test("only a successful empty server result is reported as ready and empty", async () => {
  const h = harness(async () => response([{ readTime: "2026-09-23" }])); await tick();
  assert.equal(h.states.at(-1).status, "ready"); assert.equal(h.states.at(-1).rows.length, 0); h.stop();
  const failed = harness(async () => { throw Error("Network unavailable"); }); await tick();
  assert.equal(failed.states.at(-1).status, "error"); failed.stop();
});
test("unknown formats and over-limit results fail rather than displaying a partial list", async () => {
  for (const body of [{ error: {} }, [{ error: {} }], Array.from({ length: 1001 }, () => docs[0])]) {
    await assert.rejects(loader().read({ user, projectId: "meridain-nexus", signal: new AbortController().signal, fetcher: async () => response(body) }));
  }
});
