"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("../functions/node_modules/exceljs");
const root = "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs";
const out = path.resolve(__dirname, "../.tmp/shared-etls-20260924");
async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (/\.(xlsx|txt|csv)$/i.test(file)) result.push(file);
  }
  return result;
}
async function main() {
  await fs.mkdir(out, { recursive: true });
  const result = [];
  for (const file of await walk(root)) {
    const name = path.relative(root, file);
    if (/National_Call|STORE NAME|Product List|DC Mapping|PNP Status|Jul26- All/i.test(name) && path.dirname(name) !== ".") continue;
    if (!/\.xlsx$/i.test(file)) {
      const text = await fs.readFile(file, "utf8");
      result.push({ file: name, lines: text.split(/\r?\n/).length, sample: text.split(/\r?\n/).slice(0, 4) });
    } else {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
      const sheets = wb.worksheets.map(ws => {
        const sample = [];
        ws.eachRow((row, line) => { if (sample.length < 4) sample.push({ line, values: row.values.slice(1) }); });
        return { name: ws.name, rows: ws.rowCount, cols: ws.columnCount, sample };
      });
      const entry = { file: name, sheets };
      if (name === "Product List.xlsx") {
        const counts = {};
        wb.worksheets[0].eachRow((r,n) => { if(n>1) { const key = `${r.getCell(8).text}|${r.getCell(1).text}`; counts[key] = (counts[key] || 0) + 1; } });
        entry.clients = counts;
      }
      result.push(entry);
    }
    console.log(name);
  }
  await fs.writeFile(path.join(out, "source-formats.json"), JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
