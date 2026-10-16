"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { patchFor, fields, encode } = require("../update-dataorbis-validation.cjs");
const { decode } = require("../../azure-field-dashboards/attendance-publisher/index.cjs");
const { definitions, setupDocument } = require("../setup-dataorbis-sales.cjs");
function fixture() {
  const profile = setupDocument(definitions[0], "a".repeat(64));
  const audit = { inputsUnchanged: true, validatedAt: "2026-09-22T00:00:00Z", comparison: { exact: true, matchedRows: 1327, expectedRows: 1327 },
    raw: { sha256: "b".repeat(64) }, template: { sha256: "c".repeat(64), rows: 178937 }, references: { cleanup: { sha256: "d".repeat(64) }, callCycle: { sha256: "e".repeat(64) } },
    result: { status: "blocked", version: "dataorbis-monthly-sales-v1", month: "2026-08", client: "WILMAR", publicationEnabled: false,
      totals: { removedTotals: { rows: 427 }, exceptions: { rows: 9 } }, referenceWarnings: [], blockers: ["numeric-convention-unconfirmed"] } };
  return { profile, audit };
}
test("sample patch touches only four procedure fields, not credentials, schedules, validation approval or linked steps", () => {
  const { profile, audit } = fixture(), before = structuredClone(profile);
  const patch = patchFor(profile, audit);
  assert.deepEqual(profile, before);
  assert.deepEqual(Object.keys(patch), ["salesProcedure"]);
  assert.deepEqual(Object.keys(patch.salesProcedure).map(k => "salesProcedure." + k), fields);
  assert.equal(patch.salesProcedure.outputColumns.length, 20);
  assert.equal(patch.salesProcedure.blankColumns.length, 8);
  assert.equal(patch.salesProcedure.rules.length, 10);
  assert.equal(patch.salesProcedure.sampleValidation.transformerDeployed, false);
  assert.equal(patch.salesProcedure.sampleValidation.publicationEnabled, false);
});
test("refuses to change activated or independently validated profiles and failed samples", () => {
  for (const mutate of [
    p => { p.reportSchedule.enabled = true; }, p => { p.salesProcedure.validated = true; },
    p => { p.salesProcedure.publicationEnabled = true; }, p => { p.restoration.family = "other"; }
  ]) { const { profile, audit } = fixture(); mutate(profile); assert.throws(() => patchFor(profile, audit)); }
  const { profile, audit } = fixture(); audit.comparison.exact = false;
  assert.throws(() => patchFor(profile, audit));
});
test("Firestore encoding preserves nested integer counts, decimal totals, zero and false", () => {
  const { profile, audit } = fixture();
  const patch = patchFor(profile, audit);
  patch.salesProcedure.sampleValidation.totals.source = { rows: 1336, units: 138269.005, value: 184178.755, excluded: 0 };
  assert.deepEqual(decode(encode(patch)), patch);
  assert.deepEqual(decode(encode([0, false, null, -76.222])), [0, false, null, -76.222]);
  assert.throws(() => encode(NaN)); assert.throws(() => encode(undefined));
});
