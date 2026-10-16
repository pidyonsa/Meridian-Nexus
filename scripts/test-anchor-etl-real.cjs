"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const engine = require("../etl-worker/engine.cjs");
const folder = "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/ANCHOR";
const files = { raw: "PnPSiteDaysCover_20260902082929- PNP INVENTORY RAW.xlsx", products: "Product List.xlsx", stores: "SALES DATA STORE NAME CLEAN UP .xlsx", staffing: "National_Call_Cycle_Masters 01.09.2026.xlsx", dc: "DC Mapping File.xlsx", status: "PNP Status Codes.xlsx" };
async function main() {
  const data = {}; const hashes = {};
  for (const [role, name] of Object.entries(files)) {
    const buffer = await fs.readFile(path.join(folder, name)); hashes[role] = engine.sha(buffer); data[role] = await engine.readWorkbook(buffer, role);
  }
  // Local validation only: these settings model the example; they do not approve a production run.
  const result = engine.transform(data, { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "exported", productFamily: "PICK N PAY CORPORATE", confirmed: true }, files.raw);
  const output = path.resolve(__dirname, "../.tmp/anchor-etl-validation"); await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "anchor-pnp-DRAFT.xlsx"), await engine.exportWorkbook(result, { note: "LOCAL VALIDATION ONLY - NOT APPROVED", hashes }));
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(result));
  const diagnostic = { nameUnique: 0, nameBannerUnique: 0, fullUnique: 0 };
  for (const raw of data.raw.filter(r => engine.norm(r.v[3]) !== "DISTRIBUTION CENTER")) {
    let candidates = data.stores.filter(r => engine.pnp(r.v[0]) && engine.norm(r.v[1]) === engine.norm(raw.v[1]));
    const exact = candidates.filter(r => engine.norm(r.v[2]) === engine.norm(raw.v[2])); if (exact.length) candidates = exact;
    for (const [key, positions] of [["nameUnique", [5]], ["nameBannerUnique", [5, 3]], ["fullUnique", [4, 5, 3]]]) if (new Set(candidates.map(r => JSON.stringify(positions.map(i => engine.norm(r.v[i]))))).size === 1) diagnostic[key]++;
  }
  console.log(JSON.stringify({ totals: result.totals, issues: result.issueCounts, status: result.status, storeMappingDiagnostic: diagnostic }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { files, folder };
