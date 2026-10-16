"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const ExcelJS = require("../../functions/node_modules/exceljs");
const sales = require("../../functions/dataorbis-sales");
const { monthRange, finalWorkbook } = require("../../functions/dataorbis-workbook");
const { portalNumber, validateExport } = require("../../functions/dataorbis-portal");
test("requires a complete calendar month and uses the requested output name", () => {
  assert.equal(monthRange("2026-08-01", "2026-08-31", "2026-09-23").fileName, "Aug26- ALL Clients by SKU.xlsx");
  assert.equal(monthRange("2024-02-01", "2024-02-29", "2026-09-23").month, "2024-02");
  for (const dates of [["2026-08-02", "2026-08-31"], ["2026-08-01", "2026-09-30"], ["2026-09-01", "2026-09-30"]]) {
    assert.throws(() => monthRange(...dates, "2026-09-23"));
  }
});
test("portal copy numbers use verified English thousands grouping, not locale guessing", () => {
  for (const [input, expected] of [["2,483", 2483], ["5,214,179", 5214179], ["-1,023.50", -1023.5], ["0", 0]]) assert.equal(portalNumber(input), expected);
  for (const bad of ["1,23", "1.000,50", "1 000", "NaN", "Infinity", "", "=1+1"]) assert.throws(() => portalNumber(bad));
});

test("Game export reconciliation uses dated detail only, excluding subtotal rows at both report levels", () => {
  const raw = { headers: sales.RAW_HEADERS, rows: [
    ["2026-08-01", "G008", "GAME RAW", "Eastern Cape", "Oil", "EXCELLA", "Product", 4, 640],
    ["2026-08-01", "G008", "GAME RAW", "Eastern Cape", "Oil", "EXCELLA", "Other Product", 5, 500],
    ["Total", "G008", "GAME RAW", "Eastern Cape", "Oil", "EXCELLA", null, 9, 1140],
    [" total ", null, null, null, null, null, null, 9, 1140]
  ], totals: { units: 9999, value: 999999 } };
  const baseline = { rows: [["2026-08-01", "Food", 9, 1140], ["TOTAL", null, 9, 1140]] };
  const result = validateExport(raw, baseline, "2026-08", "game");
  assert.deepEqual(result.detailTotals, { units: 9, value: 1140 });
  assert.deepEqual(result.summaryTotals, result.detailTotals);
  assert.equal(result.excludedSubtotalRows, 2);
  assert.equal(result.roundingLimit, 1.5);
  assert.throws(() => validateExport(raw, baseline, "2026-08", "wholesale"), /Total block/);
  assert.throws(() => validateExport(raw, { rows: [["2026-08-01", "Food", 8, 1140]] }, "2026-08", "game"), /quantity/);
  assert.throws(() => validateExport(raw, { rows: [["2026-08-01", "Food", 9, 5000]] }, "2026-08", "game"), /sales value/);
  assert.throws(() => validateExport({ ...raw, rows: raw.rows.slice(2) }, baseline, "2026-08", "game"), /dated sales detail/);
  assert.throws(() => validateExport(raw, { rows: [["Total", null, 9, 1140]] }, "2026-08", "game"), /dated sales detail/);
  assert.throws(() => validateExport(raw, baseline, "2026-09", "game"), /month/);
});
test("final workbook preserves other clients, reads back output and refuses duplicate appends", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-dataorbis-test-"));
  try {
    const template = path.join(dir, "template.xlsx"), output = path.join(dir, "Aug26- ALL Clients by SKU.xlsx");
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Sheet1");
    sheet.addRow(sales.HEADERS);
    const other = [new Date("2026-08-01T00:00:00Z"), "OTHER CLIENT", "GAME", "GAME", "00123", "OTHER STORE", null, null, "Gauteng", null, null, null, null, "Oil", "Brand", "SKU", 4, 123.45, null, null];
    sheet.addRow(other).getCell(1).numFmt = "mmm-yy";
    await book.xlsx.writeFile(template);
    const originalHash = sales.sha(await fs.readFile(template));
    const raw = [{ sheet: "Game Raw Data", line: 2, v: ["2026-08-01", "G008", "GAME RAW", "Eastern Cape", "Oil", "EXCELLA", "Product", 8, 2483] }];
    raw.push({ sheet: "Game Raw Data", line: 3, v: ["Total", null, null, null, null, null, null, 1000, 50000] });
    const refs = { cleanup: [{ line: 2, v: ["GAME", "G008", "GAME RAW", "GAME", "G008", "GAME CLEAN", "GAME"] }], callCycle: [{ line: 2, v: ["G008", "GAME CLEAN", "MER1", "GAME"] }] };
    const result = sales.transform(raw, refs, { month: "2026-08", client: "WILMAR", sourceComplete: true, numericConvention: "literal-confirmed", referencesApproved: true });
    const verified = await finalWorkbook(template, output, result);
    assert.equal(verified.originalRows, 1); assert.equal(verified.appendedRows, 1); assert.equal(verified.totalRows, 2);
    const final = new ExcelJS.Workbook(); await final.xlsx.readFile(output);
    final.getWorksheet("Sheet1").eachRow((row, line) => { if (line > 1) assert.ok(row.getCell(1).value instanceof Date); });
    assert.equal(sales.sha(await fs.readFile(template)), originalHash);
    await assert.rejects(finalWorkbook(output, path.join(dir, "duplicate.xlsx"), result), /already exists/);
    await assert.rejects(finalWorkbook(template, template, result), /Never overwrite/);
    await assert.rejects(finalWorkbook(template, output, result), /EEXIST/);
    await assert.rejects(finalWorkbook(template, path.join(dir, "blocked.xlsx"), { ...result, blockers: ["bad-source"] }), /blocked/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
