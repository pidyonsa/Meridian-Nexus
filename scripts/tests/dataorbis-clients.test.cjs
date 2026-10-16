"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { clients, patchFor, writeFields } = require("../split-dataorbis-clients.cjs");
const { definitions, setupDocument } = require("../setup-dataorbis-sales.cjs");
const { HEADERS } = require("../../functions/dataorbis-sales.js");
function base(index) {
  const p = setupDocument(definitions[index], "a".repeat(64));
  p.salesProcedure.outputColumns = HEADERS;
  p.salesProcedure.sampleValidation = { client: "WILMAR", matchedRows: 1327, publicationEnabled: false };
  return p;
}
test("exactly two distinct client connections each cover all three retail banners", () => {
  assert.equal(clients.length, 2); assert.notEqual(clients[0].id, clients[1].id);
  for (const [index, client] of clients.entries()) {
    const before = base(index), copy = structuredClone(before), patch = patchFor(before, client, false);
    assert.deepEqual(before, copy);
    assert.equal(patch.name, `${client.label} - Game / Makro / Jumbo`);
    assert.deepEqual(patch.salesProcedure.allowedBanners, ["GAME", "MAKRO", "JUMBO"]);
    assert.equal(patch.salesProcedure.reports.length, 2);
    assert.equal(patch.salesProcedure.clientCode, client.client);
    assert.equal(patch.salesProcedure.folder, undefined);
    assert.equal(patch.salesProcedure.supplierSelectionValidated, false);
    assert.deepEqual(Object.keys(patch), writeFields);
    for (const field of ["username", "password", "extractionProfileId", "reportSchedule"]) assert.equal(patch[field], undefined);
  }
});
test("OTP is interactive, scoped to the run owner, never a saved or shared credential", () => {
  for (const [i, client] of clients.entries()) {
    const p = patchFor(base(i), client, false).salesProcedure;
    assert.equal(p.authentication.otpRequired, true);
    assert.equal(p.authentication.otpHandling, "interactive-automation-prompt");
    assert.equal(p.authentication.otpOwner, "run-owner");
    assert.equal(p.authentication.credentialScope, "this-profile-only");
    assert.equal(p.authentication.sharedCredentials, false);
    assert.equal(p.authentication.otpReusable, false);
    assert.equal(p.authentication.otpStageValidated, false);
    assert.equal(p.validated, false); assert.equal(p.publicationEnabled, false);
    assert.equal(p.authentication.otp, undefined); assert.equal(p.authentication.password, undefined);
  }
});
test("Wilmar evidence cannot be passed off as Espen validation", () => {
  const wilmar = patchFor(base(0), clients[0], false).salesProcedure;
  const espen = patchFor(base(1), clients[1], false).salesProcedure;
  assert.equal(wilmar.sampleValidation.matchedRows, 1327);
  assert.equal(espen.sampleValidation.client, "ESPEN"); assert.equal(espen.sampleValidation.matchedRows, 0);
  assert.equal(espen.sampleValidation.status, "client-sample-required");
  assert.equal(espen.exampleClient, undefined); assert.equal(espen.exampleSupplier, undefined);
});
test("never reassigns saved credentials, enabled schedules or linked workflows to another client", () => {
  assert.throws(() => patchFor(base(0), clients[0], true), /credentials/);
  for (const mutate of [p => { p.username = "existing"; }, p => { p.credentialsUpdatedAt = "existing"; }, p => { p.reportSchedule.enabled = true; }, p => { p.extractionProfileId = "linked"; }, p => { p.steps = [{ action: "login" }]; }, p => { p.salesProcedure.validated = true; }, p => { p.name = "Already assigned"; }]) {
    const profile = base(0); mutate(profile); assert.throws(() => patchFor(profile, clients[0], false));
  }
});
