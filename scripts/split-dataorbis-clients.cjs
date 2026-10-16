"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { encode } = require("./update-dataorbis-validation.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const stage = path.resolve(__dirname, "../.tmp/dataorbis-clients-20260923");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
// Keep the original document IDs so credentials, permissions and future run
// references remain bound to distinct profiles, without a secret migration.
const clients = [
  { id: "dataorbis-game-sales", client: "WILMAR", label: "Wilmar", oldName: "Game Sales (DataOrbis)" },
  { id: "dataorbis-makro-sales", client: "ESPEN", label: "Espen", oldName: "Makro / Jumbo Sales (DataOrbis)" }
];
const readFields = ["name", "webAddress", "username", "credentialsUpdatedAt", "extractionProfileId", "steps", "extractionName", "reportSchedule", "restoration", "salesProcedure"];
const writeFields = ["name", "extractionName", "salesProcedure", "restoration"];
const save = (name, data) => { fs.mkdirSync(stage, { recursive: true }); fs.writeFileSync(path.join(stage, name), JSON.stringify(data, null, 2), { flag: "wx" }); };
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), "utf8"));
function patchFor(profile, definition, secretExists) {
  assert.equal(profile.name, definition.oldName, "Profile was renamed; review before reassigning it.");
  assert.equal(profile.restoration?.family, "dataorbis-monthly-sales");
  assert.equal(profile.salesProcedure?.validated, false);
  assert.equal(profile.salesProcedure?.publicationEnabled, false);
  assert.equal(profile.reportSchedule?.enabled, false);
  assert.ok(!profile.username && !profile.credentialsUpdatedAt && !secretExists, "Existing credentials need an explicit client assignment before changing ownership.");
  assert.ok(!profile.extractionProfileId && !profile.steps?.length, "Do not reassign an executable profile.");
  assert.equal(profile.salesProcedure.outputColumns.length, 20, "Use the verified 20-column template.");
  const procedure = structuredClone(profile.salesProcedure);
  procedure.version = "dataorbis-client-sales-20260923";
  procedure.clientCode = definition.client;
  procedure.clientName = definition.label;
  procedure.channel = "game-makro-jumbo";
  delete procedure.folder;
  procedure.reports = [
    { channel: "game", folder: "Massdiscounters Supplier Reports", allowedBanners: ["GAME"] },
    { channel: "makro-jumbo", folder: "Massmart Wholesale Supplier Reports", allowedBanners: ["MAKRO", "JUMBO"] }
  ];
  procedure.allowedBanners = ["GAME", "MAKRO", "JUMBO"];
  procedure.supplierSelection = "profile-client-only";
  procedure.supplierName = "";
  procedure.supplierSelectionValidated = false;
  procedure.authentication = {
    method: "username-password", credentialScope: "this-profile-only", sharedCredentials: false,
    otpRequired: true, otpHandling: "interactive-automation-prompt", otpOwner: "run-owner",
    otpMayOccurDuring: ["login", "report-access", "export"], otpStageValidated: false,
    otpReusable: false, unattendedValidated: false
  };
  const sample = profile.salesProcedure.sampleValidation;
  if (definition.client === "WILMAR") {
    assert.equal(sample?.client, "WILMAR");
    procedure.sampleValidation = structuredClone(sample);
  } else {
    procedure.sampleValidation = { status: "client-sample-required", client: definition.client, matchedRows: 0,
      transformerDeployed: false, publicationEnabled: false, blockers: ["espen-raw-export-and-worked-output-required"] };
    delete procedure.exampleSupplier;
    delete procedure.exampleClient;
    delete procedure.exampleIsNotConfiguredSupplier;
  }
  procedure.rules = [
    `Use only the ${definition.label} portal username and password stored on this profile for Game, Makro and Jumbo. Never use the other client's credentials or report data.`,
    "When the portal requests an OTP, pause that run for the existing Nexus verification prompt, labelled with this client and run. Only the run owner may respond. Never save or reuse an OTP as a password. The portal challenge stage must be validated before activation.",
    `For ${definition.label}, use Massdiscounters Supplier Reports for Game and Massmart Wholesale Supplier Reports for Makro/Jumbo. Open Sales Extract > Monthly Sales Performance. Verify the exact supplier shown in the portal; do not select another client.`,
    "Select the previous complete calendar month. Require complete, untruncated results. Use Site Code, Site, Region, Category, Brand and Product with Sales Quantity and Sales Value Excl; Copy Content > Copy Raw Data from the scrollbar context menu.",
    "Match raw site code plus site name to the approved cleanup, then the clean lookup name to National Call Cycle for GAME, MAKRO or JUMBO. Ambiguous or missing mappings require review; preserve raw store and product fields in output.",
    `Populate Client only with ${definition.client}. Never mix clients in the same batch. Check both report sections against the same approved month and client.`,
    "Use the verified 20-column template, including PRODUCT/SKU, SALES CASES (NEED HELP) and Meridian Coverage. Keep the six legacy/staffing fields and the final two fields blank; do not invent case conversions or coverage.",
    "Remove repeated Total rows only after exact reconciliation with detail rows. Preserve source numeric values until the portal's decimal/thousands convention is confirmed. Review the Game Online and non-SA inclusion policy.",
    "Reconcile source and output row counts, units and values. Never append the same client/banner/month twice. Publish only to the approved destination after validation; do not modify another client's existing records.",
    definition.client === "WILMAR"
      ? "The Wilmar August sample matches 1,327 worked rows; 427 repeated Total rows were verified and nine Game rows remain in review. Live extraction, OTP, numeric conventions and publication still require validation. Runs and schedules remain off."
      : "Espen needs its own raw export and worked-output validation. The Wilmar sample does not validate Espen. Live extraction, OTP and publication remain unverified; runs and schedules remain off."
  ];
  return {
    name: `${definition.label} - Game / Makro / Jumbo`,
    extractionName: `${definition.label} monthly sales - Game / Makro / Jumbo - OTP required (setup)`,
    salesProcedure: procedure,
    restoration: { ...profile.restoration, blockers: ["client-credentials", "portal-supplier-selection", "interactive-otp-validation", "portal-actions-and-raw-copy-validation", "source-and-mapping-validation", "approved-monthly-destination", ...(definition.client === "ESPEN" ? ["espen-sample-validation"] : [])] }
  };
}
async function profileMetadata(id) {
  const q = new URLSearchParams(); for (const field of readFields) q.append("mask.fieldPaths", field);
  const doc = await json(`${base}/retailers/${id}?${q}`);
  return { updateTime: doc.updateTime, profile: decode({ mapValue: { fields: doc.fields } }) };
}
async function hasSecret(id) {
  try { await json(`${base}/retailerSecrets/${id}?mask.fieldPaths=updatedAt`); return true; }
  catch (error) { if (/^GET 404:/.test(error.message)) return false; throw error; }
}
async function prepare() {
  const plan = [];
  for (const definition of clients) {
    const current = await profileMetadata(definition.id);
    const secretExists = await hasSecret(definition.id);
    const patch = patchFor(current.profile, definition, secretExists);
    assert.deepEqual(decode(encode(patch)), patch);
    plan.push({ ...definition, ...current, patch, secretExists });
  }
  save("plan.json", plan);
  console.log(JSON.stringify({ profiles: plan.map(p => ({ id: p.id, name: p.patch.name, client: p.client, channels: p.patch.salesProcedure.allowedBanners })), passwordsRead: false, credentialsMoved: false, writes: writeFields }));
}
async function verify(plan = read("plan.json")) {
  const result = [];
  for (const item of plan) {
    const { profile, updateTime } = await profileMetadata(item.id);
    for (const field of writeFields) assert.deepEqual(profile[field], item.patch[field]);
    for (const field of readFields.filter(f => !writeFields.includes(f))) assert.deepEqual(profile[field], item.profile[field], `Unrelated field changed: ${field}`);
    assert.equal(await hasSecret(item.id), false);
    result.push({ id: item.id, name: profile.name, client: profile.salesProcedure.clientCode, channels: profile.salesProcedure.allowedBanners, otpRequired: profile.salesProcedure.authentication.otpRequired, scheduleEnabled: profile.reportSchedule.enabled, updateTime });
  }
  const evidence = { verifiedAt: new Date().toISOString(), profiles: result, secretReads: 0, secretWrites: 0, runsStarted: 0, schedulesChanged: 0, functionsDeployed: 0 };
  save("verified.json", evidence); console.log(JSON.stringify(evidence));
}
async function apply() {
  const plan = read("plan.json"); assert.deepEqual(plan.map(p => p.id), clients.map(p => p.id));
  for (const item of plan) {
    assert.deepEqual(item.patch, patchFor(item.profile, item, item.secretExists));
    assert.equal(await hasSecret(item.id), false, "Credentials were added during preparation; stop before reassigning a client.");
  }
  await json(base + ":commit", "POST", { writes: plan.map(item => ({
    update: { name: `projects/meridain-nexus/databases/(default)/documents/retailers/${item.id}`, fields: encode(item.patch).mapValue.fields },
    updateMask: { fieldPaths: writeFields }, currentDocument: { updateTime: item.updateTime }
  })) });
  await verify(plan);
}
const actions = { prepare, apply, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { clients, patchFor, writeFields };
