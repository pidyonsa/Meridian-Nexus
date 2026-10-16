"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { redact, fields } = require("../validate-dataorbis-connection.cjs");
test("connection inspection redacts account identifiers", () => {
  const output = redact({ text: "Saved user acme-wilmar and person@example.test", inputs: [{ type: "password" }] }, "acme-wilmar");
  assert.ok(!output.includes("acme-wilmar"));
  assert.ok(!output.includes("person@example.test"));
});
test("validation job timestamps use Firestore timestamp values", () => {
  const values = fields({ createdAt: "2026-09-23T08:00:00Z", currentStep: 0, status: "running", publicationEnabled: false });
  assert.deepEqual(values.createdAt, { timestampValue: "2026-09-23T08:00:00.000Z" });
  assert.equal(values.status.stringValue, "running");
  assert.equal(values.publicationEnabled.booleanValue, false);
});
