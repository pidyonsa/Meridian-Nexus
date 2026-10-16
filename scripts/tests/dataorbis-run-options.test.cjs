"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").resolve(__dirname, "../../public/app.js"), "utf8");
const fn = name => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const pending = { id: "dataorbis-game-sales", name: "Wilmar - Game / Makro / Jumbo", username: "private-username",
  credentialsUpdatedAt: "2026-09-23", webAddress: "https://pyramid.dataorbis.com", salesProcedure: { version: "dataorbis-client-sales-20260923" } };
function setup(overrides = {}) {
  const state = { isAdmin: true, retailers: [pending], operationsWorkspace: { account: { role: "admin" }, profiles: [] }, ...overrides };
  const context = vm.createContext({ state, URL, elements: { operationsRetailer: { value: pending.id } } });
  vm.runInContext(["hasExtractionSteps", "operationsProfiles", "currentOperationsProfile"].map(fn).join("\n"), context);
  return { context, state, profiles: () => JSON.parse(JSON.stringify(vm.runInContext("operationsProfiles()", context))) };
}
test("admin sees client setup with no credentials exposed and cannot infer readiness", () => {
  const s = setup(), [p] = s.profiles();
  assert.equal(p.name, pending.name);
  assert.equal(p.setupRequired, true);
  assert.equal(p.ready, false);
  assert.equal(p.scheduleEnabled, false);
  assert.equal(p.connectionLabel, "Credentials saved");
  assert.ok(!JSON.stringify(p).includes("private-username"));
  assert.equal(vm.runInContext("currentOperationsProfile().id", s.context), pending.id);
  assert.equal(s.state.operationsWorkspace.profiles.length, 0, "Never mutate the API's approved list");
});
test("normal users cannot see admin-only setup profiles", () => {
  assert.equal(setup({ isAdmin: false }).profiles().length, 0);
  assert.equal(setup({ operationsWorkspace: { account: { role: "normal" }, profiles: [] } }).profiles().length, 0);
});
test("server-approved profile wins over a stale local setup copy", () => {
  const ready = { id: pending.id, name: pending.name, ready: true };
  assert.deepEqual(setup({ operationsWorkspace: { account: { role: "admin" }, profiles: [ready] } }).profiles(), [ready]);
});
test("unrelated and linked local profiles are not promoted into the run selector", () => {
  assert.equal(setup({ retailers: [{ ...pending, id: "unrelated" }, { ...pending, extractionProfileId: "not-authorized-by-api" }] }).profiles().length, 0);
});
test("empty credentials remain a distinct setup state", () => {
  const [p] = setup({ retailers: [{ ...pending, username: "" }] }).profiles();
  assert.equal(p.connectionLabel, "Credentials required");
});
test("Run and scheduling guards reject setup selections", () => {
  assert.match(fn("renderOperationsSchedule"), /if \(!canManageSchedules \|\| !profile \|\| profile\.setupRequired === true\) return/);
  assert.match(fn("renderOperationsWorkspace"), /operationsRunExtraction\.disabled = !profile \|\| profile\.setupRequired === true/);
  assert.match(source, /elements\.operationsRunExtraction\.addEventListener\("click", async \(\) => \{\s+const profile = currentOperationsProfile\(\);\s+if \(!profile \|\| profile\.setupRequired === true \|\| state\.operationsRunPending\) return/);
});
