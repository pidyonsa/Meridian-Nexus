"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { setupDocument, encode } = require("../restore-picknpay-setup.cjs");
const { updateApp } = require("../release-picknpay-setup.cjs");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "functions/index.js"), "utf8").replace(/\r\n/g, "\n");
function extract(name, code = source) { const match = code.match(new RegExp(`function ${name}\\([^]*?\\n\\}`)); assert.ok(match, name); return match[0]; }
test("restoration is non-runnable and never enables schedules or assumes a client", () => {
  const data = setupDocument();
  assert.equal(data.username, ""); assert.equal(data.password, undefined); assert.equal(data.steps, undefined); assert.equal(data.extractionProfileId, undefined);
  assert.equal(data.reportSchedule.enabled, false); assert.equal(data.restoration.automaticPublication, false);
  assert.equal(data.restoration.candidateStepSetId, "picknpay-sales-extraction-steps");
  const context = { URL, optionalText: s => String(s || "") };
  vm.createContext(context); vm.runInContext(extract("safeOperationsProfile"), context);
  assert.equal(context.safeOperationsProfile({ id: "picknpay", data: () => data }).ready, false);
  assert.equal(encode(data).mapValue.fields.reportSchedule.mapValue.fields.enabled.booleanValue, false);
});
test("existing backend rejects a restored unlinked profile before queuing any job", async () => {
  const handler = source.match(/exports\.startExtraction = onCall\(async \(request\) => \{[^]*?\n\}\);/)?.[0]; assert.ok(handler);
  let queued = 0;
  const context = { exports: {}, onCall: fn => fn, console: { info() {} }, requireNavigationPermission: async () => {}, requireRetailerPermission: async () => {},
    text: x => x, optionalDate: x => x || "", optionalText: x => x || "", scheduleFrequencyForRetailer: () => "daily", defaultReportDatesForRetailer: () => ({}), optionalSmartSellWeekOverride: () => null,
    db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: setupDocument }) }), add: async () => { queued++; } }) },
    HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } }
  };
  vm.createContext(context); vm.runInContext(handler, context);
  await assert.rejects(context.exports.startExtraction({ auth: { uid: "fixture" }, data: { retailerId: "picknpay" } }), e => e.code === "failed-precondition" && /Link extraction steps/.test(e.message));
  assert.equal(queued, 0);
});
test("Hosting patch changes only the setup notice hooks; existing Admin policy stays intact", () => {
  const before = fs.readFileSync(path.join(root, ".tmp/no-etls-20260909/portal/app.js"), "utf8").replace(/\r\n/g, "\n");
  const patched = updateApp(before);
  assert.ok(patched.includes("renderRetailerSetupStatus(retailer);"));
  const restored = patched.replace(extract("renderRetailerSetupStatus", patched) + "\n\n", "").replace("\n  renderRetailerSetupStatus();", "").replace("\n  renderRetailerSetupStatus(retailer);", "");
  assert.equal(restored, before);
});
test("setup notice clears for other profiles and new profile form", () => {
  const notice = { hidden: false, textContent: "stale" };
  const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8").replace(/\r\n/g, "\n");
  const context = { document: { getElementById: id => id === "retailerSetupStatus" ? notice : null } }; vm.createContext(context); vm.runInContext(extract("renderRetailerSetupStatus", app), context);
  context.renderRetailerSetupStatus(setupDocument()); assert.equal(notice.hidden, false); assert.match(notice.textContent, /credentials are missing/);
  context.renderRetailerSetupStatus({ ...setupDocument(), username: "fixture", credentialsUpdatedAt: "2026-09-09" }); assert.match(notice.textContent, /credentials saved/);
  context.renderRetailerSetupStatus({ id: "geo-rep" }); assert.equal(notice.hidden, true); assert.equal(notice.textContent, "");
  context.renderRetailerSetupStatus(); assert.equal(notice.hidden, true);
});
