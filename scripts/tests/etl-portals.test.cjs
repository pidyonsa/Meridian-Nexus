"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const file = process.env.ETL_PORTALS_SCRIPT || "public/etl-portals.js";
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const events = {}, calls = [], root = { addEventListener: (name, fn) => { events[name] = fn; } };
  const context = { window: {}, AbortController, Date, confirm: () => true };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
  const workspace = { profiles: [{ id: "dataorbis-game-sales", ready: true }, { id: "dataorbis-makro-sales", ready: false }],
    runs: [{ id: "wilmar-done", retailerId: "dataorbis-game-sales", status: "completed" }, { id: "espen-done", retailerId: "dataorbis-makro-sales", status: "completed" }],
    reports: [{ id: "wilmar-file", name: "Aug26- ALL Clients by SKU.xlsx", extractionRunId: "wilmar-done" }, { id: "espen-file", name: "Espen.xlsx", extractionRunId: "espen-done" }],
    prompts: [{ id: "otp-test", runId: "wilmar-done", message: "Verification required" }], reportsStatus: "ready" };
  let changes = 0, fail = false;
  const api = { load: async () => { if (fail) throw Error("Service unavailable"); return workspace; },
    start: async data => { calls.push(["start", data]); return { reused: true }; }, configure: id => calls.push(["configure", id]),
    download: file => calls.push(["download", file.id]), verify: prompt => calls.push(["verify", prompt.id]), abort: id => calls.push(["abort", id]) };
  const view = context.window.MeridianEtlPortals.create(root, api, () => { changes++; }, () => { changes++; });
  const click = dataset => events.click({ target: { closest: () => ({ dataset, hasAttribute: name => Object.hasOwn(dataset, name.replace(/^data-/, "").replace(/-([a-z])/g, (_,c)=>c.toUpperCase())) }) } });
  const submit = () => events.submit({ target: { id: "etlPortalRun" }, preventDefault() {} });
  return { api, view, workspace, calls, click, submit, events, isProfile: context.window.MeridianEtlPortals.isProfile, fail: () => { fail = true; }, changes: () => changes };
}
test("client reports, login settings and OTP reuse the supplied authenticated adapters", async () => {
  const f = fixture(); await f.view.refresh();
  assert.match(f.view.view(), /Aug26- ALL Clients by SKU.xlsx/); assert.doesNotMatch(f.view.view(), /Espen.xlsx/);
  f.click({ portalDownload: "wilmar-file" }); await tick();
  f.click({ portalCredentials: "dataorbis-makro-sales" }); await tick();
  f.click({ portalPrompt: "otp-test" }); await tick();
  assert.deepEqual(f.calls, [["download", "wilmar-file"], ["configure", "dataorbis-makro-sales"], ["verify", "otp-test"]]);
  assert.doesNotMatch(f.view.view(), /type="password"/);
  f.click({ portalSelect: "dataorbis-makro-sales" });
  assert.match(f.view.view(), /Espen.xlsx/); assert.doesNotMatch(f.view.view(), /Aug26- ALL Clients/);
  f.submit(); await tick(); assert.equal(f.calls.filter(c=>c[0]==="start").length,0);
});
test("monthly submission uses complete calendar months, suppresses double clicks and preserves duplicate outcome", async () => {
  const f = fixture(); await f.view.refresh();
  f.events.change({ target: { id: "etl-portal-month", value: "2024-02" } });
  f.submit(); f.submit(); await tick();
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0][1].reportStartDate,"2024-02-01"); assert.equal(f.calls[0][1].reportEndDate,"2024-02-29");
  assert.match(f.view.view(),/has not been duplicated/);
  f.workspace.runs.unshift({id:"busy",retailerId:"dataorbis-makro-sales",status:"queued"});
  f.view.update(f.workspace); f.submit(); await tick(); assert.equal(f.calls.length,1);
});
test("errors and untrusted report text are visible safely; late refresh cannot repaint a stopped session", async () => {
  const f = fixture();
  f.workspace.reports[0].name='<img src=x onerror=alert(1)>.xlsx';
  await f.view.refresh(); assert.match(f.view.view(),/&lt;img/); assert.doesNotMatch(f.view.view(),/<img/);
  f.workspace.reportsStatus="unavailable"; f.view.update(f.workspace); assert.match(f.view.view(),/Reports could not be loaded/);
  f.fail(); await f.view.refresh(); assert.match(f.view.view(),/Service unavailable/);
  let resolve; f.api.load=()=>new Promise(r=>{resolve=r;});
  const pending=f.view.refresh();f.view.stop();const before=f.changes();resolve(f.workspace);await pending;
  assert.equal(f.changes(),before);
});

test("Pick n Pay appears beside DataOrbis without treating the unlinked profile as runnable", async () => {
  const f = fixture(); await f.view.refresh();
  assert.match(f.view.overview(), /data-portal-open="picknpay"/);
  f.click({ portalSelect: "picknpay" });
  assert.match(f.view.view(), /Pick n Pay monthly sales/);
  assert.match(f.view.view(), /Setup required/);
  assert.doesNotMatch(f.view.view(), /ALL Clients by SKU|Espen.xlsx|Aug26-/);
  f.submit(); await tick(); assert.equal(f.calls.length, 0);
  f.click({ portalCredentials: "picknpay" }); await tick();
  assert.deepEqual(f.calls, [["configure", "picknpay"]]);
  assert.equal(f.isProfile("picknpay"), true);
  assert.equal(f.isProfile("geo-rep"), false);
});

test("verified Pick n Pay uses its existing run ID and month range with isolated reports and OTP", async () => {
  const f = fixture(); f.workspace.profiles.push({ id: "picknpay", ready: true, portal: "www.pnpportal.co.za" });
  f.workspace.runs.push({ id: "pnp-done", retailerId: "picknpay", status: "completed" });
  f.workspace.reports.push({ id: "pnp-file", name: "Pick n Pay sales.xlsx", extractionRunId: "pnp-done" });
  f.workspace.prompts.push({ id: "pnp-otp", runId: "pnp-done", message: "Pick n Pay verification" });
  await f.view.refresh(); f.click({ portalSelect: "picknpay" });
  assert.match(f.view.view(), /Pick n Pay sales.xlsx/);
  assert.doesNotMatch(f.view.view(), /wilmar-file|espen-file|otp-test/);
  f.click({ portalDownload: "pnp-file" }); await tick();
  f.click({ portalPrompt: "pnp-otp" }); await tick();
  f.events.change({ target: { id: "etl-portal-month", value: "2026-08" } });
  f.submit(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [
    ["download", "pnp-file"], ["verify", "pnp-otp"],
    ["start", { retailerId: "picknpay", reportStartDate: "2026-08-01", reportEndDate: "2026-08-31" }]
  ]);
});

test("Pick n Pay and the DataOrbis workbook have separate run locks", async () => {
  const f = fixture(); f.workspace.profiles.push({ id: "picknpay", ready: true });
  f.workspace.runs.push({ id: "dataorbis-active", retailerId: "dataorbis-game-sales", status: "queued" });
  await f.view.refresh(); f.click({ portalSelect: "picknpay" }); f.submit(); await tick();
  assert.equal(f.calls.length, 1);
  f.workspace.runs.push({ id: "pnp-active", retailerId: "picknpay", status: "waiting_for_otp" });
  f.view.update(f.workspace); f.submit(); await tick(); assert.equal(f.calls.length, 1);
  f.workspace.runs = f.workspace.runs.filter(r => r.id !== "dataorbis-active");
  f.view.update(f.workspace); f.click({ portalSelect: "dataorbis-game-sales" }); f.submit(); await tick();
  assert.equal(f.calls.length, 2);
  f.workspace.profiles.find(p => p.id === "picknpay").setupRequired = true;
  f.workspace.runs = f.workspace.runs.filter(r => r.id !== "pnp-active");
  f.view.update(f.workspace); f.click({ portalSelect: "picknpay" }); f.submit(); await tick();
  assert.equal(f.calls.length, 2); assert.match(f.view.view(), /Workflow validation is outstanding/);
});
