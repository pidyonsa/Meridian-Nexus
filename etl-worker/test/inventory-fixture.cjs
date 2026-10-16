"use strict";
const ExcelJS = require("exceljs"), engine = require("../engine.cjs");
async function inventoryFixture(id, { missingStore = false, ambiguousStore = false } = {}) {
  const rows = {
    raw: [["01/09/2026", "TEST001", "Synthetic Store", "Corporate Store", "00012", "TEST ITEM", "V", "04", "", "", 115, 4.56, 25, "Stock Transfer"], ["01/09/2026", "TESTDC", "Synthetic DC", "Distribution center", "00012", "TEST ITEM", "V", "04", "", "", 500, 2, 250, "Standard"]],
    products: [["PICK N PAY CORPORATE", "060087157", "Test", "Test", "00012", "Test Item", "Synthetic Item", "ANCHOR", "TEST ITEM", ""]],
    stores: [["PNP", missingStore ? "OTHER" : "TEST001", "Synthetic Store", "Pick N Pay Corporate", "TESTM", "SYNTHETIC CANONICAL STORE", "Pick N Pay Family"]],
    staffing: [["TESTM", "SYNTHETIC CANONICAL STORE", "TESTG", "PNP", "YES", "INLAND", "GROCERY", "GAUTENG", "TESTREP", "Synthetic Rep", "SYNDICATED REP", "", "WEEKLY", "TESTMAN", "Synthetic Manager"]],
    dc: [["Synthetic DC", "GAUTENG", "TEST001", "Synthetic Store", "Pick n Pay"]], status: [["04", "Active", "Active"]]
  };
  if (ambiguousStore) rows.stores.push(["PICK N PAY LIQUOR", "TEST001", "Synthetic Store", "PICK N PAY LIQUOR", "TESTM", "SYNTHETIC LIQUOR STORE", "PICK N PAY LIQUOR"]);
  const manifest = { id, version: engine.VERSION, rules: { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true }, inputs: {}, synthetic: true };
  const objects = new Map();
  for (const [role, [sheet, headers]] of [...Object.entries(engine.SCHEMAS), ["template", ["Template", engine.HEADERS]]]) {
    const book = new ExcelJS.Workbook(), ws = book.addWorksheet(sheet); ws.addRow(headers);
    if (role === "template") { ws.getColumn(5).width = 47; ws.getCell("A1").font = { bold: true }; }
    else for (const row of rows[role]) ws.addRow(row);
    const bytes = Buffer.from(await book.xlsx.writeBuffer()), object = `etl-run-inputs/${id}/${role}.xlsx`;
    objects.set(object, bytes);
    manifest.inputs[role] = { path: object, size: bytes.length, generation: "1", name: role === "raw" ? "PnPSiteDaysCover_20260902082929-synthetic.xlsx" : `${role}-synthetic.xlsx` };
  }
  objects.set(`etl-run-inputs/${id}/manifest.json`, Buffer.from(JSON.stringify(manifest)));
  return { manifest, objects };
}
module.exports = { inventoryFixture };
