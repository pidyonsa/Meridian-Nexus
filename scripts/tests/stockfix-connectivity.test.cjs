const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const backend = fs.readFileSync(path.join(root, "functions/index.js"), "utf8");
const frontend = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
function extract(source, name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}
class HttpsError extends Error {
  constructor(code, message, details) { super(message); Object.assign(this, { code, details }); }
}
const week = { week: "2026-08-05", storagePath: "stockfix-source/test-week/source.ndjson.gz" };
function reader(download) {
  return vm.runInNewContext(`(${extract(backend, "readStockFixFirebaseWeekSummary")})`, {
    HttpsError,
    console: { error() {} },
    getStorage: () => ({ bucket: () => ({ file: () => ({ download }) }) }),
    stockFixFirebaseStoragePath: value => value,
    stockFixSupportedSourceName: value => value,
    stockFixSourceText: value => value.toString(),
    stockFixRowsFromText: JSON.parse,
    stockFixSummaryFromRows: (rows, selectedWeek, options) => ({ rows, selectedWeek, options })
  });
}

for (const code of [403, "403", 404, "404"]) {
  test(`Stock Fix maps Storage ${code} to an actionable source error`, async () => {
    const read = reader(async () => { throw Object.assign(new Error("private provider diagnostic"), { code }); });
    await assert.rejects(read(week), error => {
      assert.equal(error.code, "failed-precondition");
      assert.equal(error.details.reason, Number(code) === 403 ? "stockfix-source-access-denied" : "stockfix-source-missing");
      assert.equal(error.details.week, week.week);
      assert.ok(!error.message.includes("private provider diagnostic"));
      return true;
    });
  });
}
test("Stock Fix preserves transient errors instead of treating them as no data", async () => {
  const failure = Object.assign(new Error("temporary failure"), { code: 503 });
  await assert.rejects(reader(async () => { throw failure; })(week), error => error === failure);
});
test("Stock Fix retains row parsing, reporting week and filter options", async () => {
  const rows = [{ store: "Test Store", tasks: 12 }];
  const options = { includeRows: true, filters: { region: "Gauteng" } };
  const result = await reader(async () => [Buffer.from(JSON.stringify(rows))])(week, options);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.selectedWeek, week.week);
  assert.equal(result.options, options);
});
test("Firestore long polling is configured before any listener starts", () => {
  const calls = [];
  const database = {
    settings(settings) { calls.push({ kind: "settings", settings }); },
    collection() { return { onSnapshot() { calls.push({ kind: "listener" }); } }; }
  };
  const context = {
    database: null, storage: null, auth: null, cloudFunctions: null,
    firebase: {
      firestore: () => database,
      storage: () => ({ setMaxUploadRetryTime() {}, setMaxOperationRetryTime() {} }),
      auth: () => ({ onAuthStateChanged() { calls.push({ kind: "auth" }); } }),
      app: () => ({ functions() {} })
    },
    elements: { fileSummary: {} },
    showToast(message) { assert.fail(message); }
  };
  vm.runInNewContext(`(${extract(frontend, "initialiseFirebase")})()`, context);
  assert.equal(calls[0].kind, "settings");
  const settings = calls[0].settings;
  assert.equal(settings.experimentalForceLongPolling, true);
  assert.equal(settings.experimentalAutoDetectLongPolling, false);
  assert.equal(settings.experimentalLongPollingOptions.timeoutSeconds, 25);
  assert.equal(settings.useFetchStreams, false);
  assert.equal(calls.filter(call => call.kind === "listener").length, 0, "No legacy file data may load before authentication");
});
test("HTML and offline shell reference the same updated app asset", () => {
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "public/service-worker.js"), "utf8");
  const version = html.match(/app\.js\?v=([^"\s]+)/)[1];
  assert.ok(worker.includes(`/app.js?v=${version}`));
});

function sessionHarness({ claims = { email: "admin@nexus.co.za", admin: true }, workspace = async () => {} } = {}) {
  const calls = [];
  const noop = () => {};
  const context = {
    state: {}, auditedSessionUid: "", meridianChatSession: null, syncMeridianChat: noop,
    nexusSessionGeneration: 0, stopLegacyAdminData: noop,
    subscribeLegacyAdminData: () => { assert.equal(context.state.isAdmin, true); },
    window: { location: { hash: "#stockfix" } },
    auth: { signOut: async () => calls.push("sign-out") },
    elements: {
      adminLogin: {}, operationsLogin: {}, adminWorkspace: {}, adminSessionName: {},
      nexusAccountEmail: {}, nexusLoginPassword: {}
    },
    stopOperationsRefresh: noop, stopOwnerPromptSubscription: noop,
    clearAdminSubscriptions: noop, renderOperationsWorkspace: noop,
    syncNexusNavigationAccess: noop, renderFilesRunRetailerDetails: noop,
    subscribeAdminData: noop, loadAdminJobHistory: noop, subscribeOwnerPrompts: noop,
    startOperationsRefresh: noop, showToast: noop, setViewFromHash: noop,
    callFunction: async () => ({}),
    loadOperationsWorkspace: async () => { calls.push("workspace"); await workspace(); },
    loadStockFixDashboard: () => calls.push("stockfix")
  };
  const configure = vm.runInNewContext(`(${extract(frontend, "configureAdminSession")})`, context);
  const user = {
    uid: "test-session", email: claims.email,
    getIdTokenResult: async force => {
      assert.equal(force, true, "Keep the fresh-claims check at sign-in");
      calls.push("claims");
      return { claims };
    }
  };
  return { configure, user, context, calls };
}

test("Direct Stock Fix navigation resumes only after auth and workspace finish", async () => {
  let resolveWorkspace;
  const harness = sessionHarness({ workspace: () => new Promise(resolve => { resolveWorkspace = resolve; }) });
  const pending = harness.configure(harness.user);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(harness.calls, ["claims", "workspace"]);
  resolveWorkspace();
  await pending;
  assert.deepEqual(harness.calls, ["claims", "workspace", "stockfix"]);
});

test("Navigating away while auth loads does not fetch Stock Fix", async () => {
  const harness = sessionHarness({ workspace: async () => { harness.context.window.location.hash = "#home"; } });
  await harness.configure(harness.user);
  assert.ok(!harness.calls.includes("stockfix"));
});

test("Normal-user landing permissions do not trigger an admin Stock Fix load", async () => {
  const harness = sessionHarness({ claims: { email: "normal@example.test", operator: true } });
  await harness.configure(harness.user);
  assert.equal(harness.context.window.location.hash, "automation");
  assert.ok(!harness.calls.includes("stockfix"));
});

test("Accounts without Nexus claims are denied without fetching Stock Fix", async () => {
  const harness = sessionHarness({ claims: { email: "unauthorised@example.test" } });
  await harness.configure(harness.user);
  assert.deepEqual(harness.calls, ["claims", "sign-out"]);
});

test("Signing out never loads Stock Fix", async () => {
  const harness = sessionHarness();
  await harness.configure(null);
  assert.deepEqual(harness.calls, []);
});

test("client-only claims are signed out without loading any staff data or chat", async () => {
  const harness = sessionHarness({ claims: { email: "client@example.test", chatClient: true, nexusRole: "client", operator: false } });
  await harness.configure(harness.user);
  assert.deepEqual(harness.calls, ["claims", "sign-out"]);
  assert.notEqual(harness.context.state.isOperator, true);
});

test("legacy file listeners are admin-only, cleared and ignore queued callbacks after logout", () => {
  const callbacks = [], stopped = [];
  const noop = () => {};
  const context = { state: { isAdmin: false }, auth: { currentUser: { uid: "admin" } },
    legacyAdminSubscriptions: [], legacyAdminGeneration: 0,
    renderFiles: noop, renderClientOptions: noop, renderAdminHistory: noop, renderOperations: noop,
    sortFilesNewestFirst: noop, showToast: () => assert.fail("Stale callback"), friendlyError: String,
    database: { collection: name => ({ onSnapshot: (next, error) => {
      callbacks.push({ next, error }); return () => stopped.push(name);
    } }) } };
  vm.runInNewContext(`${extract(frontend, "stopLegacyAdminData")}\n${extract(frontend, "subscribeLegacyAdminData")}`, context);
  context.subscribeLegacyAdminData(); assert.equal(callbacks.length, 0);
  context.state.isAdmin = true;
  context.subscribeLegacyAdminData(); assert.equal(callbacks.length, 3);
  callbacks[0].next({ docs: [{ id: "file", data: () => ({ name: "Private" }) }] });
  assert.equal(context.state.files.length, 1);
  context.stopLegacyAdminData(); assert.equal(stopped.length, 3);
  callbacks[0].next({ docs: [{ id: "stale", data: () => ({ name: "Stale" }) }] });
  callbacks[0].error(new Error("Stale"));
  assert.equal(context.state.files.length, 0);
  assert.equal(context.state.dashboardClients.length, 0);
});

test("late admin token resolution cannot reopen staff listeners after logout", async () => {
  const harness = sessionHarness();
  let resolve;
  harness.user.getIdTokenResult = () => new Promise(done => { resolve = done; });
  const pending = harness.configure(harness.user);
  await harness.configure(null);
  resolve({ claims: { email: "admin@nexus.co.za", admin: true } });
  await pending;
  assert.equal(harness.context.state.isAdmin, false);
  assert.deepEqual(harness.calls, []);
});
