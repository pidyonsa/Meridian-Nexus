"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const ExcelJS = require("exceljs");
const sales = require("./dataorbis-sales");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthRange(start, end, today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })) {
  assert.match(start || "", /^\d{4}-(0[1-9]|1[0-2])-01$/, "Choose the first day of a complete reporting month.");
  const month = start.slice(0, 7);
  const last = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10);
  assert.equal(end, last, "Choose the last day of the same reporting month.");
  assert.ok(end < today, "The reporting month must be complete.");
  return { month, start, end, fileName: `${MONTHS[Number(start.slice(5, 7)) - 1]}${start.slice(2, 4)}- ALL Clients by SKU.xlsx` };
}
async function finalWorkbook(templateFile, outputFile, result) {
  assert.notEqual(path.resolve(templateFile), path.resolve(outputFile), "Never overwrite the supplied template.");
  const template = await sales.inspectTemplate(templateFile, result);
  sales.assertPublishable(result, template);
  const outputHandle = await fs.open(outputFile, "wx");
  await outputHandle.close();
  let completed = false;
  try {
    const writer = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: outputFile, useStyles: true, useSharedStrings: true });
    writer.creator = "Meridian Nexus";
    const target = writer.addWorksheet("Sheet1", { views: [{ state: "frozen", ySplit: 1 }] });
    target.columns = sales.HEADERS.map((header, index) => ({ key: String(index), width: [5, 15].includes(index) ? 40 : 20 }));
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(templateFile, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore" });
    let copied = 0;
    for await (const sheet of reader) for await (const row of sheet) {
      if (!row.hasValues) continue;
      const output = target.addRow(row.values.slice(1));
      row.eachCell({ includeEmpty: true }, (cell, column) => { output.getCell(column).style = cell.style; });
      output.commit();
      if (row.number > 1) copied++;
    }
    assert.equal(copied, template.rows);
    for (const record of result.records) {
      const row = target.addRow([new Date(`${record.v[0]}T00:00:00Z`), ...record.v.slice(1)]);
      row.getCell(1).numFmt = "mmm-yy";
      row.getCell(5).numFmt = "@";
      row.getCell(17).numFmt = "#,##0.######";
      row.getCell(18).numFmt = "#,##0.######";
      row.commit();
    }
    target.commit();
    await writer.commit();
    // Read back the actual saved file, including every unchanged client row.
    const check = new ExcelJS.stream.xlsx.WorkbookReader(outputFile, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore" });
    const unchanged = crypto.createHash("sha256");
    let count = 0;
    for await (const sheet of check) for await (const row of sheet) {
      if (row.number === 1 || !row.hasValues) continue;
      const values = sales.values(row, sales.HEADERS.length, sheet.name);
      if (count < template.rows) unchanged.update(JSON.stringify(values) + "\n");
      else assert.deepEqual(values, result.records[count - template.rows]?.v, "Saved batch differs from validated rows.");
      count++;
    }
    assert.equal(count, template.rows + result.records.length);
    assert.equal(unchanged.digest("hex"), template.dataSha256, "Another client's template rows changed.");
    assert.equal(sales.sha(await fs.readFile(templateFile)), template.sha256, "The original template changed during processing.");
    completed = true;
    return { templateSha256: template.sha256, originalRows: template.rows, appendedRows: result.records.length, totalRows: count,
      sha256: sales.sha(await fs.readFile(outputFile)), batchDigest: result.batchDigest };
  } finally {
    if (!completed) await fs.unlink(outputFile).catch(() => {});
  }
}
module.exports = { monthRange, finalWorkbook };
