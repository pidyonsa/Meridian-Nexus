"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const ExcelJS = require("../functions/node_modules/exceljs");
const root = path.resolve(__dirname, "../.tmp/dataorbis-sales-20260922/workbooks");
const sources = [
  "C:/Users/PC/Downloads/Game and Makro Aug26 Raw download.xlsx",
  "C:/Users/PC/Downloads/Aug26- All Clients by Sku2 Final template.xlsx"
];
function value(cell) {
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object") {
    if (v.richText) return v.richText.map(p => p.text).join("");
    if (v.formula || v.sharedFormula || v.error) return v;
    return v.text ?? v;
  }
  return v ?? null;
}
async function main() {
  await fs.mkdir(root, { recursive: true });
  const result = [];
  for (const file of sources) {
    const bytes = await fs.readFile(file);
    const item = { file: path.basename(file), sha256: crypto.createHash("sha256").update(bytes).digest("hex"), sheets: [] };
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore" });
    for await (const sheet of reader) {
      const summary = { name: sheet.name, rows: 0, samples: [], groups: {}, formulas: 0, errors: 0, blanks: 0 };
      const relevant = [];
      for await (const row of sheet) {
        const values = row.values.slice(1).map((_, i) => value(row.getCell(i + 1)));
        if (!values.some(v => v !== null && v !== "")) { summary.blanks++; continue; }
        summary.rows++;
        if (summary.samples.length < 4) summary.samples.push({ row: row.number, values });
        for (const v of values) if (v && typeof v === "object") {
          if (v.formula || v.sharedFormula) summary.formulas++;
          if (v.error) summary.errors++;
        }
        const raw = sheet.name.endsWith("Raw Data");
        const headers = sheet.name === "Game and Makro Transformed" ? 2 : 1;
        if (row.number <= headers) continue;
        const key = raw ? String(values[0]) : JSON.stringify([values[0], values[1], values[2], values[3]]);
        const g = summary.groups[key] ||= { rows: 0, units: 0, value: 0, stores: new Set(), invalidMeasures: 0 };
        g.rows++; g.stores.add(values[raw ? 1 : 4]);
        const units = values[raw ? 7 : 16], amount = values[raw ? 8 : 17];
        if (typeof units === "number" && typeof amount === "number") { g.units += units; g.value += amount; }
        else g.invalidMeasures++;
        if (raw || sheet.name === "Game and Makro Transformed" || /^(GAME|MAKRO|JUMBO)$/i.test(String(values[2]))) relevant.push({ row: row.number, values });
      }
      for (const g of Object.values(summary.groups)) { g.stores = [...g.stores]; g.value = Math.round(g.value * 1e6) / 1e6; }
      const name = `${path.parse(file).name}-${sheet.name}`.replace(/[^a-z0-9 -]/gi, "_");
      await fs.writeFile(path.join(root, `${name}.rows.json`), JSON.stringify(relevant, null, 2));
      item.sheets.push(summary);
      console.log(JSON.stringify({ file: item.file, ...summary, groups: Object.fromEntries(Object.entries(summary.groups).map(([k, v]) => [k, { ...v, stores: v.stores.length }])) }));
    }
    result.push(item);
  }
  await fs.writeFile(path.join(root, "inspection.json"), JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
