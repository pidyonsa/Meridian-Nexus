"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { gc } = require("./release-etls.cjs");
const project = "meridain-nexus";
const database = `projects/${project}/databases/(default)`;
const base = `https://firestore.googleapis.com/v1/${database}/documents`;
const stepSetId = "picknpay-sales-extraction-steps";
function setupDocument() {
  // Deliberately unlinked: the historical browser steps and credentials need revalidation.
  return {
    name: "Pick n Pay Sales", username: "", webAddress: "https://www.pnpportal.co.za/pnp_app/Account/Login",
    extractionName: "Setup required - verify connection and monthly sales workflow",
    reportSchedule: { enabled: false },
    restoration: {
      status: "awaiting-connection-verification", candidateStepSetId: stepSetId,
      historicalClientProfile: "STAEDTLER SA (PTY) LTD",
      reportPolicy: "Previous full calendar month; no latest-available or partial-period fallback",
      sourceDocuments: ["Sales Data Extraction Manual.docx", "Sales Data Extraction Steps.xlsx"],
      blockers: ["credentials", "approved-client-selection", "login-email-code-and-terms-review", "full-month-export-validation", "approved-raw-output-destination"],
      automaticPublication: false
    },
    updatedBy: "nexus-picknpay-setup-restoration-20260909"
  };
}
function encode(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}
async function main() {
  assert.ok(["--dry-run", "--apply"].includes(process.argv[2]), "Specify --dry-run or --apply");
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  const api = async (url, method = "GET", body) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) throw new Error(`Restoration HTTP ${response.status}: ${new URL(url).pathname}`);
    return response.json();
  };
  const existing = await api(`${base}/retailers/picknpay`);
  assert.equal(existing, null, "Pick n Pay now exists; review instead of overwriting it.");
  const beforeSteps = await api(`${base}/extractionProfiles/${stepSetId}`);
  assert.equal(beforeSteps?.fields?.steps?.arrayValue?.values?.length, 21, "The historical workflow changed; review it first.");
  const fields = encode(setupDocument()).mapValue.fields;
  const document = `${database}/documents/retailers/picknpay`;
  if (process.argv[2] === "--dry-run") { console.log(JSON.stringify({ document, setup: setupDocument(), jobsStarted: 0, credentialsRead: false }, null, 2)); return; }
  const out = path.resolve(__dirname, "../.tmp/picknpay-restoration-20260909");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "before.json"), JSON.stringify({ retailer: existing, stepSetUpdateTime: beforeSteps.updateTime }, null, 2));
  await api(`${base}:commit`, "POST", { writes: [{
    update: { name: document, fields }, currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }, { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]
  }] });
  const after = await api(`${base}/retailers/picknpay`);
  for (const [key, value] of Object.entries(fields)) assert.deepEqual(after.fields[key], value);
  assert.ok(!after.fields.extractionProfileId && !after.fields.steps);
  assert.equal(after.fields.reportSchedule.mapValue.fields.enabled.booleanValue, false);
  assert.equal((await api(`${base}/extractionProfiles/${stepSetId}`)).updateTime, beforeSteps.updateTime, "Existing steps must stay unchanged.");
  const evidence = { document, status: "awaiting-connection-verification", verifiedAt: new Date().toISOString(), updateTime: after.updateTime, jobsStarted: 0, schedulesEnabled: 0, secretsAccessed: 0, existingWorkflowsChanged: 0 };
  fs.writeFileSync(path.join(out, "verified.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
module.exports = { setupDocument, encode };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
