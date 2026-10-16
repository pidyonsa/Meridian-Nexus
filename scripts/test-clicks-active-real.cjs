"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const engine = require("../etl-worker/engine.cjs"), clicks = require("../etl-worker/clicks-inventory.cjs"), layout = require("../etl-worker/shared-layout.cjs");
const { folder, files } = require("./test-anchor-etl-real.cjs");
async function main() {
  const data = {}, checksums = {}, root = path.dirname(folder), out = path.resolve(".tmp/clicks-active-validation-20260925");
  for (const role of ["products", "stores", "staffing", "dc"]) {
    const file = role === "stores" ? ".tmp/pnp-corrected-stores-20260924/source.xlsx" : role === "staffing" ? ".tmp/national-master-20260924/files/National_Call_Cycle_23.09.2026_ETL.xlsx" : path.join(folder, files[role]);
    const bytes = fs.readFileSync(file); data[role] = await engine.readWorkbook(bytes, role); checksums[role] = engine.sha(bytes);
  }
  for (const [role, file] of [["raw", path.join(root, "ETHICA/STORE SOH.xlsx")], ["dcStock", path.join(root, "ETHICA/DC SOH 02-2026.xlsx")], ["periodSales", "C:/Users/PC/Downloads/CLICKS AUG SALES FY26.xlsx"]]) {
    const bytes = fs.readFileSync(file); data[role] = await clicks.read(bytes, role); checksums[role] = engine.sha(bytes);
  }
  const context = { customer: "Ethica", kind: "Inventory", channelId: "clicks", transformerVersion: "clicks-inventory-v1" };
  const before = clicks.transform(data, context), after = clicks.transform(data, { ...context, articleStatusDefault: "Active" });
  assert.deepEqual(after.totals, before.totals); assert.deepEqual(after.exceptions, before.exceptions); assert.deepEqual(after.warnings, before.warnings);
  assert.ok(after.facts.length > 0 && after.facts.every(r => r.values[14] === "Active"));
  assert.deepEqual(after.facts.map(r => r.values.filter((_, i) => i !== 14)), before.facts.map(r => r.values.filter((_, i) => i !== 14)));
  const sample = await layout.readExpected(fs.readFileSync(path.join(folder, "Transformed Inventory File- Anchor.xlsx")), "Inventory");
  const bytes = await engine.exportWorkbook(after, { localValidationOnly: true, checksums }, sample);
  const Excel = require("../etl-worker/node_modules/exceljs"), wb = new Excel.Workbook(); await wb.xlsx.load(bytes);
  const sheet = wb.getWorksheet("Template"); assert.equal(sheet.rowCount - 1, after.facts.length);
  for (let row = 2; row <= sheet.rowCount; row++) assert.equal(sheet.getCell(row, 15).text, "Active");
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "Ethica-Clicks-inventory-active-draft.xlsx"), bytes);
  const result = { at: new Date().toISOString(), localValidationOnly: true, outputRows: after.facts.length, articleStatus: "Active", allOtherColumnsUnchanged: true, exceptionsUnchanged: true, totals: after.totals, checksums, transformerSha256: engine.sha(fs.readFileSync("etl-worker/clicks-inventory.cjs")) };
  fs.writeFileSync(path.join(out, "verified.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ outputRows: result.outputRows, articleStatus: result.articleStatus, allOtherColumnsUnchanged: true, exceptionRows: after.totals.exceptionRows }));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
