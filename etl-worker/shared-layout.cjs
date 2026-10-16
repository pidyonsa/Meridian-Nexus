"use strict";
const ExcelJS = require("exceljs");
const { inspectZip, norm, HEADERS } = require("./engine.cjs");
const SALES_HEADERS = ["Month-Yr", "Client", "Retailer", "Banner", "Store ID", "Store Name", "CHAIN #", "STORE #", "Province", "RSM", "DM", "REP", "MERCH", "CATEGORY", "BRAND", "PRODUCT/SKU", "SALES UNITS", "SALES VALUE", "SALES CASES (NEED HELP)", "Meridian Coverage"];
async function readExpected(buffer, kind) {
  if (!["Inventory", "Sales"].includes(kind)) throw new Error("Unknown output layout.");
  await inspectZip(buffer);
  const source = new ExcelJS.Workbook(); await source.xlsx.load(buffer);
  const headers = kind === "Inventory" ? HEADERS : SALES_HEADERS;
  const candidates = source.worksheets.filter(ws => headers.every((h, i) => typeof ws.getRow(1).getCell(i + 1).value === "string" && norm(ws.getRow(1).getCell(i + 1).value) === norm(h)));
  if (candidates.length !== 1) throw new Error(`The shared ${kind.toLowerCase()} sample must contain exactly one sheet with the approved ${headers.length} output headers.`);
  const original = candidates[0];
  if (original.columnCount > headers.length || original.model.merges?.some(range => /^\w*1:/.test(range))) throw new Error("The shared sample has extra columns or merged headers. Review the output layout.");
  // Create a new workbook: never carry sample rows, formulas, tables or links into a run.
  const blank = new ExcelJS.Workbook(), target = blank.addWorksheet(kind === "Inventory" ? "Template" : "Sheet1");
  target.addRow(headers.map((_, i) => original.getRow(1).getCell(i + 1).value));
  target.getRow(1).height = original.getRow(1).height;
  target.views = [{ state: "frozen", ySplit: 1 }];
  headers.forEach((_, i) => {
    target.getColumn(i + 1).width = Math.max(8, Math.min(80, original.getColumn(i + 1).width || 24));
    target.getRow(1).getCell(i + 1).style = structuredClone(original.getRow(1).getCell(i + 1).style);
    target.getRow(2).getCell(i + 1).style = structuredClone(original.getRow(2).getCell(i + 1).style);
  });
  return blank;
}
module.exports = { readExpected, SALES_HEADERS };
