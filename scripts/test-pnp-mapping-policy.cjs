"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const engine = require("../etl-worker/engine.cjs"), { files, folder } = require("./test-anchor-etl-real.cjs");
async function main() {
  const data = {}, checksums = {};
  for (const [role, name] of Object.entries(files)) {
    const file = role === "stores" ? ".tmp/national-master-20260924/files/Store_Mapping_24.09.2026.xlsx"
      : role === "staffing" ? ".tmp/national-master-20260924/files/National_Call_Cycle_23.09.2026_ETL.xlsx" : path.join(folder, name);
    const bytes = fs.readFileSync(file); checksums[role] = engine.sha(bytes); data[role] = await engine.readWorkbook(bytes, role);
  }
  const rules = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "exported", productFamily: "PICK N PAY CORPORATE", confirmed: true };
  const result = engine.transform(data, rules, files.raw, engine.ACCEPTED_MAPPING_POLICY);
  const legacy = engine.transform(data, rules, files.raw);
  assert.equal(result.reconciled, true); assert.equal(result.totals.sourceStoreSOH, legacy.totals.sourceStoreSOH);
  assert.equal(result.totals.inputRows, legacy.totals.inputRows);
  for (const code of ["DC_MAPPING", "PRODUCT_MAPPING", "REGION_MAPPING"]) assert.equal(result.issueCounts[code], undefined);
  assert.ok(result.exceptions.every(r => r.errors.every(e => e.detail !== "No PnP site-code alias in the store clean-up master.")));
  const out = path.resolve(".tmp/pnp-policy-validation-20260924"); fs.mkdirSync(out, { recursive: true });
  const summary = { at: new Date().toISOString(), localValidationOnly: true, source: files.raw, asOf: result.asOf, mappingPolicy: result.mappingPolicy,
    checksums, status: result.status, reconciled: result.reconciled, totals: result.totals, issues: result.issueCounts, warnings: result.warningCounts, legacyTotals: legacy.totals };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(out, "inventory-local-validation.xlsx"), await engine.exportWorkbook(result, { note: "LOCAL VALIDATION ONLY - NOT APPROVED", checksums }));
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
