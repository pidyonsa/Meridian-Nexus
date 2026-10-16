"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const ExcelJS = require("../etl-worker/node_modules/exceljs");
const engine = require("../etl-worker/engine.cjs");
const { gc, bucket, project, stage, save } = require("./release-etls.cjs");
async function main() {
  const resume = process.argv.includes("--resume");
  const previous = fs.existsSync(path.join(stage, "cloud-smoke.started.json")) ? JSON.parse(fs.readFileSync(path.join(stage, "cloud-smoke.started.json"))) : null;
  assert.ok(resume ? previous?.synthetic : !previous, "Inspect the previous smoke run before starting another.");
  const id = resume ? previous.id : crypto.randomUUID().replaceAll("-", ""), token = gc("auth", "print-access-token", `--project=${project}`).trim();
  assert.match(id, /^[a-f0-9]{32}$/);
  const headers = { Authorization: `Bearer ${token}`, "x-goog-user-project": project };
  const rows = {
    raw: [["01/09/2026", "TEST001", "Synthetic Store", "Corporate Store", "00012", "TEST ITEM", "V", "04", "", "", 115, 4.56, 25, "Stock Transfer"], ["01/09/2026", "TESTDC", "Synthetic DC", "Distribution center", "00012", "TEST ITEM", "V", "04", "", "", 500, 2, 250, "Standard"]],
    products: [["PICK N PAY CORPORATE", "060087157", "Test", "Test", "00012", "Test Item", "Synthetic Item", "ANCHOR", "TEST ITEM", ""]],
    stores: [["PNP", "TEST001", "Synthetic Store", "Pick N Pay Corporate", "TESTM", "SYNTHETIC CANONICAL STORE", "Pick N Pay Family"]],
    staffing: [["TESTM", "SYNTHETIC CANONICAL STORE", "TESTG", "PNP", "YES", "INLAND", "GROCERY", "GAUTENG", "TESTREP", "Synthetic Rep", "SYNDICATED REP", "", "WEEKLY", "TESTMAN", "Synthetic Manager"]],
    dc: [["Synthetic DC", "GAUTENG", "TEST001", "Synthetic Store", "Pick n Pay"]], status: [["04", "Active", "Active"]]
  };
  const rules = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true };
  const manifest = { id, version: engine.VERSION, rules, inputs: {}, synthetic: true };
  if (!resume) save("cloud-smoke.started.json", { id, synthetic: true, startedAt: new Date().toISOString(), realDataProcessed: false });
  async function upload(name, bytes, type) {
    assert.ok(name.startsWith(`etl-run-inputs/${id}/`));
    const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`);
    url.searchParams.set("uploadType", "media"); url.searchParams.set("name", name); url.searchParams.set("ifGenerationMatch", "0");
    const response = await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": type }, body: bytes });
    assert.ok(response.ok, `Synthetic input upload failed: ${response.status}`); return response.json();
  }
  if (!resume) for (const [role, [sheet, columns]] of Object.entries(engine.SCHEMAS)) {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(sheet); ws.addRow(columns); for (const row of rows[role]) ws.addRow(row);
    const bytes = Buffer.from(await wb.xlsx.writeBuffer()); await engine.readWorkbook(bytes, role);
    const name = `etl-run-inputs/${id}/${role}.xlsx`, meta = await upload(name, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    manifest.inputs[role] = { path: name, size: bytes.length, generation: meta.generation, name: role === "raw" ? "PnPSiteDaysCover_20260902082929-synthetic.xlsx" : `${role}-synthetic.xlsx` };
  }
  if (!resume) await upload(`etl-run-inputs/${id}/manifest.json`, JSON.stringify(manifest), "application/json");
  console.log(`Running one synthetic ETL validation: ${id}`);
  let operation;
  if (fs.existsSync(path.join(stage, "cloud-smoke.operation.json"))) operation = JSON.parse(fs.readFileSync(path.join(stage, "cloud-smoke.operation.json")));
  else {
    const executed = await fetch(`https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/nexus-inventory-etl:run`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ overrides: { containerOverrides: [{ env: [{ name: "ETL_RUN_ID", value: id }] }] } }) });
    assert.ok(executed.ok, `Synthetic job launch failed: ${executed.status}`); operation = await executed.json(); save("cloud-smoke.operation.json", operation);
  }
  for (let attempt = 0; !operation.done; attempt++) {
    assert.ok(attempt < 200, "Synthetic execution timed out; inspect the saved operation.");
    await new Promise(resolve => setTimeout(resolve, 5000));
    const response = await fetch(`https://run.googleapis.com/v2/${operation.name}`, { headers }); assert.ok(response.ok);
    operation = await response.json(); save("cloud-smoke.operation.json", operation);
  }
  assert.ok(!operation.error, `Synthetic execution failed: ${JSON.stringify(operation.error)}`);
  if (process.argv.includes("--logs-only")) {
    const entries = JSON.parse(gc("logging", "read", `resource.type="cloud_run_job" AND resource.labels.job_name="nexus-inventory-etl" AND jsonPayload.id="${id}"`, `--project=${project}`, "--freshness=1d", "--limit=10", "--format=json"));
    const evidence = entries.find(entry => entry.jsonPayload?.status === "ready" && entry.jsonPayload?.id === id);
    assert.ok(evidence, "No successful synthetic worker log found.");
    assert.equal(evidence.jsonPayload.totals.validStoreSOH, 115); assert.equal(evidence.jsonPayload.totals.exceptionRows, 0); assert.equal(evidence.jsonPayload.totals.dcRows, 1);
    const policy = JSON.parse(gc("storage", "buckets", "get-iam-policy", `gs://${bucket}`, `--project=${project}`, "--format=json"));
    assert.ok(policy.bindings.some(binding => binding.role === "roles/storage.objectViewer" && binding.members?.includes("serviceAccount:730011371323-compute@developer.gserviceaccount.com") && binding.condition?.expression === `resource.name.startsWith('projects/_/buckets/${bucket}/objects/etl-results/')`));
    const result = { id, synthetic: true, status: "ready", verifiedAt: new Date().toISOString(), realDataProcessed: false, businessOutputApproved: false, verification: "successful execution and worker logs", privateOutputDownloaded: false, apiReadIAMVerified: true, totals: evidence.jsonPayload.totals };
    save("cloud-smoke.verified.json", result); console.log(JSON.stringify(result)); return;
  }
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(`etl-results/${id}/result.json`)}?alt=media`;
  const identity = "730011371323-compute@developer.gserviceaccount.com";
  const credentials = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${identity}:generateAccessToken`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/devstorage.read_only"], lifetime: "300s" }) });
  if (!credentials.ok) {
    const failure = await credentials.json();
    throw new Error(`API read-identity verification unavailable: ${credentials.status}; ${failure.error?.message || "permission unavailable"}`);
  }
  const { accessToken } = await credentials.json();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }); assert.ok(response.ok, `Synthetic result unavailable to the ETL API identity: ${response.status}`);
  const result = await response.json(); assert.equal(result.status, "ready"); assert.equal(result.reconciled, true);
  assert.equal(result.headers.length, 17); assert.equal(result.preview.length, 1); assert.equal(result.preview[0][4], "SYNTHETIC CANONICAL STORE");
  assert.equal(result.totals.validStoreSOH, 115); assert.equal(result.totals.exceptionRows, 0);
  save("cloud-smoke.verified.json", { id, synthetic: true, realDataProcessed: false, businessOutputApproved: false, verifiedAt: new Date().toISOString(), status: result.status, totals: result.totals, output: result.output });
  console.log(JSON.stringify({ id, status: result.status, columns: result.headers.length, storeRows: result.preview.length, realDataProcessed: false, businessOutputApproved: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
