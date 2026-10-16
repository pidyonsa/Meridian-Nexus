"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { encode: legacyEncode } = require("./restore-picknpay-setup.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const { HEADERS } = require("../functions/dataorbis-sales.js");
const stage = path.resolve(__dirname, "../.tmp/dataorbis-sales-20260922/aug26-validation-v2");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const ids = ["dataorbis-game-sales", "dataorbis-makro-sales"];
const fields = ["salesProcedure.outputColumns", "salesProcedure.blankColumns", "salesProcedure.rules", "salesProcedure.sampleValidation"];

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "Only finite numbers can be stored.");
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  assert.ok(value && Object.getPrototypeOf(value) === Object.prototype, "Only plain values can be stored.");
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

function patchFor(profile, audit) {
  assert.equal(profile.restoration.family, "dataorbis-monthly-sales");
  assert.equal(profile.salesProcedure.validated, false, "Do not replace an independently validated profile.");
  assert.equal(profile.salesProcedure.publicationEnabled, false);
  assert.equal(profile.reportSchedule.enabled, false, "Stop if an administrator has activated this profile.");
  assert.equal(audit.inputsUnchanged, true);
  assert.equal(audit.comparison.exact, true);
  assert.equal(audit.result.publicationEnabled, false);
  assert.equal(audit.result.status, "blocked");
  const rules = [...profile.salesProcedure.rules];
  assert.equal(rules.length, 10);
  rules[7] = "Use the supplied 20-column monthly template, including PRODUCT/SKU, SALES CASES (NEED HELP) and Meridian Coverage. Keep CHAIN #, STORE #, RSM, DM, REP, MERCH and the final two columns blank; do not invent case conversions or coverage.";
  rules[8] = "Validate supplier, full-month coverage, counts and totals. Remove a Pyramid Total block only when it exactly duplicates detail rows. Preserve source numbers without guessed scaling. Review Game Online/non-SA exclusions. Never append the same supplier/channel/month twice.";
  const t = audit.result.totals;
  rules[9] = `August 2026 local check: ${audit.comparison.matchedRows} rows exactly match the supplied worked example; ${t.removedTotals.rows} repeated Total rows were verified; ${t.exceptions.rows} Game rows remain in review. Numeric conventions, reference approval, live extraction and destination still require validation. Scheduling and publication remain off.`;
  const sampleValidation = {
    status: "local-sample-matched-publication-blocked", checkedAt: audit.validatedAt, month: audit.result.month, client: audit.result.client,
    localTransformerVersion: audit.result.version, transformerDeployed: false,
    source: { name: "Game and Makro Aug26 Raw download.xlsx", sha256: audit.raw.sha256 },
    template: { name: "Aug26- All Clients by Sku2 Final template.xlsx", sha256: audit.template.sha256, existingRows: audit.template.rows, columns: HEADERS.length, modified: false },
    referenceHashes: { cleanup: audit.references.cleanup.sha256, callCycle: audit.references.callCycle.sha256 },
    totals: t, matchedRows: audit.comparison.matchedRows, expectedRows: audit.comparison.expectedRows,
    referenceWarningCount: audit.result.referenceWarnings.length, blockers: audit.result.blockers,
    publicationEnabled: false, sourceFilesUploaded: false, originalFilesModified: false
  };
  return { salesProcedure: { outputColumns: HEADERS, blankColumns: ["CHAIN #", "STORE #", "RSM", "DM", "REP", "MERCH", "SALES CASES (NEED HELP)", "Meridian Coverage"], rules, sampleValidation } };
}
async function readProfile(id) {
  const q = new URLSearchParams();
  for (const field of ["salesProcedure", "restoration", "reportSchedule"]) q.append("mask.fieldPaths", field);
  const document = await json(`${base}/retailers/${id}?${q}`);
  return { document, profile: decode({ mapValue: { fields: document.fields } }) };
}
async function main() {
  const action = process.argv[2]; assert.ok(["prepare", "apply", "repair-summary", "verify"].includes(action));
  const audit = JSON.parse(await fs.readFile(path.join(stage, "validation.json"), "utf8"));
  if (action === "prepare") {
    const changes = [];
    for (const id of ids) {
      const { document, profile } = await readProfile(id);
      changes.push({ id, updateTime: document.updateTime, before: profile, patch: patchFor(profile, audit) });
    }
    await fs.writeFile(path.join(stage, "profile-changes.json"), JSON.stringify(changes, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ profiles: ids, fields, sourceFilesUploaded: false, secretsAccessed: false, schedulesChanged: false }));
    return;
  }
  const changes = JSON.parse(await fs.readFile(path.join(stage, "profile-changes.json"), "utf8"));
  assert.deepEqual(changes.map(c => c.id), ids);
  for (const change of changes) assert.deepEqual(change.patch, patchFor(change.before, audit));
  for (const change of changes) assert.deepEqual(decode(encode(change.patch)), change.patch, "Typed metadata must survive serialization.");
  if (action === "repair-summary") {
    for (const change of changes) {
      const { document, profile } = await readProfile(change.id);
      for (const field of Object.keys(change.patch.salesProcedure)) assert.deepEqual(profile.salesProcedure[field], decode(legacyEncode(change.patch)).salesProcedure[field], "Only repair this script's previous summary.");
      assert.deepEqual(profile.reportSchedule, change.before.reportSchedule);
      assert.deepEqual(profile.restoration, change.before.restoration);
      change.updateTime = document.updateTime;
    }
  }
  if (action === "apply" || action === "repair-summary") {
    const writes = changes.map(c => ({ update: { name: `projects/meridain-nexus/databases/(default)/documents/retailers/${c.id}`, fields: encode(c.patch).mapValue.fields }, updateMask: { fieldPaths: fields }, currentDocument: { updateTime: c.updateTime } }));
    await json(base + ":commit", "POST", { writes });
  }
  for (const change of changes) {
    const { profile } = await readProfile(change.id);
    for (const field of Object.keys(change.patch.salesProcedure)) assert.deepEqual(profile.salesProcedure[field], change.patch.salesProcedure[field]);
    assert.deepEqual(profile.restoration, change.before.restoration);
    assert.deepEqual(profile.reportSchedule, change.before.reportSchedule);
  }
  const evidence = { verifiedAt: new Date().toISOString(), profiles: ids, fields, rawFilesUploaded: 0, secretsAccessed: false, schedulesChanged: false, functionsDeployed: 0 };
  await fs.writeFile(path.join(stage, "profile-validation.verified.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { patchFor, fields, encode };
