"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const ExcelJS = require("../functions/node_modules/exceljs");
const engine = require("../functions/dataorbis-sales.js");
async function main() {
  const dir = path.resolve(__dirname, "../.tmp/dataorbis-sales-20260922/aug26-validation-v2");
  const audit = JSON.parse(await fs.readFile(path.join(dir, "validation.json"), "utf8"));
  assert.equal(audit.comparison.exact, true); assert.equal(audit.comparison.matchedRows, 1327);
  assert.equal(audit.result.totals.source.rows, 1336); assert.equal(audit.result.removedTotals.length, 427);
  assert.equal(audit.result.exceptions.length, 9); assert.equal(audit.template.rows, 178937);
  assert.equal(audit.result.status, "blocked"); assert.equal(audit.publicationEnabled, false);
  for (const [name, expected] of [
    ["Game and Makro Aug26 Raw download.xlsx", audit.raw.sha256],
    ["Aug26- All Clients by Sku2 Final template.xlsx", audit.template.sha256]
  ]) assert.equal(engine.sha(await fs.readFile(path.join("C:/Users/PC/Downloads", name))), expected);
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(path.join(dir, "Game-Makro-sales-DRAFT.xlsx"));
  const sheet = book.getWorksheet("Draft Sales - NOT PUBLISHED");
  assert.deepEqual(engine.values(sheet.getRow(1), 20, sheet.name), engine.HEADERS);
  assert.equal(sheet.rowCount, 1328);
  audit.result.records.forEach((record, i) => assert.deepEqual(engine.values(sheet.getRow(i + 2), 20, sheet.name), record.v));
  assert.equal(book.getWorksheet("Exceptions").rowCount, 10);
  assert.equal(book.getWorksheet("Verified Total Duplicates").rowCount, 428);
  assert.equal(book.getWorksheet("Reference Warnings").rowCount, 11);
  console.log("Real-file checks passed: 1,327 exact row matches and XLSX round-trip; 9 exceptions; 427 total duplicates; original files unchanged; no publication.");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
