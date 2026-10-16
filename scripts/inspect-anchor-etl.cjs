"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("../functions/node_modules/exceljs");
const JSZip = require("../functions/node_modules/jszip");
const source = "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/ANCHOR";
const output = path.resolve(__dirname, "../.tmp/anchor-etl-analysis");
function value(cell) {
  const item = cell.value;
  if (item instanceof Date) return item.toISOString();
  if (item && typeof item === "object") {
    if (item.formula || item.sharedFormula) return { formula: item.formula || item.sharedFormula, result: item.result ?? null };
    if (item.richText) return item.richText.map(part => part.text).join("");
    if (item.text !== undefined) return item.text;
  }
  return item;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const summaries = [];
  for (const name of (await fs.readdir(source)).filter(name => /\.xlsx$/i.test(name))) {
    const bytes = await fs.readFile(path.join(source, name));
    const zip = await JSZip.loadAsync(bytes);
    const metadataFiles = Object.keys(zip.files).filter(name => /connections|queryTables|customXml|externalLinks/.test(name) && !zip.files[name].dir);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    const sheets = wb.worksheets.map(sheet => {
      const sample = [];
      sheet.eachRow({ includeEmpty: false }, (row, index) => {
        if (sample.length >= 5) return;
        const cells = [];
        row.eachCell({ includeEmpty: false }, cell => cells.push({ column: cell.col, value: value(cell) }));
        sample.push({ row: index, cells });
      });
      return { name: sheet.name, rows: sheet.actualRowCount, lastRow: sheet.rowCount, columns: sheet.columnCount, state: sheet.state, tables: Object.keys(sheet.tables || {}), sample };
    });
    const summary = { file: name, bytes: bytes.length, metadataFiles, sheets };
    summaries.push(summary);
    await fs.writeFile(path.join(output, `${path.parse(name).name}.json`), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ file: name, metadataFiles, sheets: sheets.map(({ sample, ...sheet }) => ({ ...sheet, firstRow: sample[0] })) }));
  }
  await fs.writeFile(path.join(output, "workbooks.json"), JSON.stringify(summaries, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
