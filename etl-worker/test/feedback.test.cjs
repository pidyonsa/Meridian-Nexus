"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Excel = require("exceljs"), JSZip = require("jszip");
const source = require("../source-files.cjs"), sales = require("../sales.cjs"), feedback = require("../feedback-sales.cjs"), stock = require("../clicks-inventory.cjs"), engine = require("../engine.cjs");
async function workbook(name, headers, rows, configure = () => {}) { const w = new Excel.Workbook(), s = w.addWorksheet(name); s.addRow(headers); rows.forEach(r => s.addRow(r)); configure(w, s); return Buffer.from(await w.xlsx.writeBuffer()); }
const row = (v, line = 2) => ({ line, v });
const sourceDay = value => source.sourceDate(value);
const ctx = (transformerVersion, customer = "aQuelle") => ({ transformerVersion, customer, kind: "Sales", reportMonth: "2026-07" });
test("Clicks ignores extra helper formulas and pivot tabs but rejects formulas in measured columns", async () => {
  const values = [new Date("2026-08-01"), "01", "Store", "Product", "12", "Brand", 2, 20, { formula: 'B2&E2', result: '0112' }];
  const bytes = await workbook("Sheet1", [...sales.CLICKS_HEADERS, "ui"], [values], w => w.addWorksheet("Pivot").addRow(["Grand total", 2]));
  const raw = await sales.readRaw(bytes); assert.equal(raw.length, 1); assert.equal(raw[0].v.length, 8); assert.equal(raw[0].v[6], 2);
  values[6] = { formula: "1+1", result: 2 };
  await assert.rejects(sales.readRaw(await workbook("Data", [...sales.CLICKS_HEADERS, "ui"], [values])), /formulas/);
});
test("GLN uses only GLN Report A:G and records existing Excel errors as unknown mappings", async () => {
  const b = await workbook("GLN Report", ["SITE ID", "Brand", "StoreName", "Site (B2B Name)", "PROVINCE", "BANNER", "TradingStatus", "PROVINCE", "SITE ID"], [["005", "Shoprite", "RAW", "0005-Raw", "GAUTENG", "SHOPRITE", "Trading", "WRONG", "OTHER"], ["006", "Shoprite", "OTHER", { error: "#N/A" }, { error: "#N/A" }, "SHOPRITE"]], w => w.addWorksheet("GLN Report (2)").addRow(["Ignore"]));
  const r = await feedback.readGln(b); assert.equal(r[0].v.code, "005"); assert.equal(r[0].v.region, "GAUTENG"); assert.equal(r[1].v.site, ""); assert.equal(r[1].cellErrors.length, 2);
});
test("delimited sources parse decimal commas, verify SQL trailer counts and reject malformed records", async () => {
  const opts = { fields: { a: "A", b: "B" }, name: "weekly.txt" };
  const r = await source.readDelimited(Buffer.from("A|B\n1|2,50\n\n(1 rows affected)\n"), opts); assert.equal(source.decimal(r.rows[0].v.b), 2.5);
  await assert.rejects(source.readDelimited(Buffer.from("A|B\n1|2\n(2 rows affected)"), opts), /row count/);
  await assert.rejects(source.readDelimited(Buffer.from("A|B\n1|2|3"), opts), /column count/);
  await assert.rejects(source.readDelimited(Buffer.from("A|B\n1|2\n(1 rows affected)\n3|4"), opts), /after the row-count/);
  assert.equal(source.decimal(""), null); assert.equal(source.decimal("1,234.56"), null);
});
test("unrelated external links may be ignored only by opted-in raw readers, never macros", async () => {
  const bytes = await workbook("SC Report", ["A"], [[1]]), zip = await JSZip.loadAsync(bytes);
  zip.file("xl/externalLinks/externalLink1.xml", "<externalLink/>");
  const external = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(engine.inspectZip(external));
  assert.equal((await source.readTable(external, { fields: { a: "A" }, allowExternalLinks: true })).rows.length, 1);
  zip.file("xl/vbaProject.bin", "not executed"); await assert.rejects(engine.inspectZip(await zip.generateAsync({ type: "nodebuffer" }), { allowExternalLinks: true }));
});
test("Boxer uses source months, Product + Size SKU, AQUELLE for UNKNOWN brand and preserves source composite identity", () => {
  const raw = [row({ code: "01", name: "Original", category: "Water", brand: "UNKNOWN", description: "AQUELLE MINERAL WATER STILL", size: "500 ML", sku: "12", units: 3, value: 30, year: 2026, month: "July" }), row({ code: "01", name: "Original", brand: "AQUELLE", description: "AQUELLE MINERAL WATER STILL", size: "500 ML", sku: "12", units: 9, value: 90, year: 2026, month: "June" }, 3)];
  const result = feedback.transform({ raw }, ctx("boxer-sales-v1")), [july, june] = result.facts.map(f => f.values);
  assert.equal(result.status, "ready"); assert.equal(july[15], "AQUELLE MINERAL WATER STILL 500 ML"); assert.equal(july[14], "AQUELLE"); assert.equal(july[5], "Original"); assert.ok(result.reconciled);
  assert.equal(july[0], "2026-07-01"); assert.equal(july[16], 3); assert.equal(june[0], "2026-06-01"); assert.equal(june[16], 9); assert.equal(result.totals.excludedUnits, 0);
  assert.throws(() => feedback.transform({ raw }, ctx("boxer-sales-v1", "Anchor")), /configured customer/);
});
test("weekly inputs keep actual numeric measures, dates, supplier scope and MAIN/ZA restrictions", () => {
  const base = { code: "01", name: "Makro Main Store", sku: "12", description: "Viv Water", uom: "6PK", category: "Water", units: "2,5", value: "10.50", vendor: "EKHAMANZI SPRINGS (PTY) LTD", country: "ZA", siteType: "MAIN", day: "2026-07-05 06:09:03.580" };
  for (const adapter of ["game-sales-v1", "makro-sales-v1"]) {
    const raw = [row(base), row({ ...base, code: "02", vendor: "Other supplier" }, 3), row({ ...base, code: "03", siteType: "WEB", country: "BW" }, 4)];
    const result = feedback.transform({ raw }, ctx(adapter)); assert.equal(result.totals.readyRows, 1); assert.equal(result.totals.excludedRows, 2); assert.equal(result.facts[0].values[14], "VIV"); assert.equal(result.facts[0].values[17], 10.5); assert.ok(result.reconciled);
    if (adapter.startsWith("makro")) { assert.equal(result.facts[0].values[5], "Makro"); assert.equal(result.facts[0].values[15], "Viv Water 6PK"); }
  }
});
test("Shoprite reads selected units despite preamble, ignores other formulas and applies approved Client/VAT rules", async () => {
  const raw = (await feedback.read(await workbook("Separate View", ["Title"], [["Site", "Article", "Sell UOM", "Article Key", "Jul 2026 units", "P", "Category", "Unused"], ["0005-Raw", "Fish", "EA-1", "001", 2, 115, "Fish-123", { formula: "1+1", result: 2 }]]), ctx("shoprite-saldanha-sales-v1", "Saldanha"), "raw.xlsx")).rows;
  const gln = [row({ site: "0005-Raw", name: "SHOPRITE RAW", code: "005", banner: "SHOPRITE", region: "GAUTENG" })];
  const result = feedback.transform({ raw, gln }, ctx("shoprite-saldanha-sales-v1", "Saldanha")), f = result.facts[0].values;
  assert.equal(f[1], "UNIVERSAL PAPER"); assert.equal(f[4], "005"); assert.equal(f[8], "GAUTENG"); assert.equal(f[13], "CANNED FISH"); assert.equal(f[14], "SALDANHA"); assert.ok(Math.abs(f[17] - 200) < 1e-8);
  assert.equal(f[5], "0005-Raw"); assert.equal(f[15], "Fish EA-1");
  const universal = feedback.transform({ raw: [row({ name: "SHOPRITE RAW", description: "Tissue", uom: "EA", sku: "001", units: 2, price: 115, category: "PAPER WARE-10320601" })], gln }, ctx("shoprite-universal-sales-v1", "Universal Paper"));
  assert.equal(universal.facts[0].values[13], "PAPER WARE"); assert.equal(universal.facts[0].values[14], "");
});
test("Universal Paper brand matches Product List ORIG without UOM, Article number or Article Description", () => {
  const gln = [row({ site: "0005-Raw", name: "SHOPRITE RAW", code: "005", banner: "SHOPRITE", region: "GAUTENG" })], context = ctx("shoprite-universal-sales-v1", "Universal Paper");
  const source = (description, sku) => row({ name: "SHOPRITE RAW", description, uom: "EA-1", sku, units: 2, price: 115, category: "PAPER WARE-10320601" });
  const brand = (products, raw) => feedback.transform({ raw: [raw], gln, products }, context).facts[0].values[14];
  assert.equal(brand([row(["SHOPRITE", "600", "DINU", "PAPER", "999", "Other", "Other", "UNIVERSAL PAPER", "ROLLER TOWELS WHITE DINU 2S", "Y"])], source("ROLLER TOWELS WHITE DINU 2S", "10336810")), "DINU");
  assert.equal(brand([row(["SHOPRITE", "600", "RITEBRAND", "PAPER", 10132952, "x", "x", "UNIVERSAL", "", "Y"])], source("ROLLER TOWELS RITEBRAND 2UN PACK", "10132952")), "RITEBRAND");
  assert.equal(brand([row(["CHECKERS", "600", "DINU", "PAPER", "", "SERVIETTE DINU 50S, RED", "", "Universal Paper", "", "Y"])], source("SERVIETTE DINU 50S, RED", "10382678")), "DINU");
  assert.equal(brand([row(["SHOPRITE", "600", "DINU", "PAPER", "10382678", "x", "x", "OTHER CLIENT", "", "Y"])], source("SERVIETTE DINU 50S, RED", "10382678")), "");
});
test("duplicates and conflicting GLN matches remain blocking; excluded banners reconcile", () => {
  const a = row({ name: "Raw", description: "Fish", uom: "EA", sku: "01", units: 2, price: 115, category: "Fish" }), context = ctx("shoprite-saldanha-sales-v1", "Saldanha");
  const gln = [row({ site: "Raw", code: "001", region: "GAUTENG", banner: "SHOPRITE" })];
  const duplicate = feedback.transform({ raw: [a, { ...a, line: 3 }], gln }, context); assert.equal(duplicate.issueCounts.DUPLICATE_SOURCE, 2); assert.equal(duplicate.status, "review"); assert.ok(duplicate.reconciled);
  const ambiguous = feedback.transform({ raw: [a], gln: [...gln, row({ site: "Raw", code: "002", region: "GAUTENG", banner: "SHOPRITE" }, 3)] }, context); assert.equal(ambiguous.issueCounts.GLN_MAPPING, 1);
  const excluded = feedback.transform({ raw: [a], gln: [row({ site: "Raw", code: "001", banner: "USAVE BOX" })] }, context); assert.equal(excluded.totals.excludedUnits, 2); assert.ok(excluded.reconciled); assert.equal(excluded.status, "review");
});
test("Clicks stock joins measured sales and distinct DC balance, preserving missing values and raw name", () => {
  const raw = [row({ day: "2026-09-01", code: "01", name: "Raw", description: "Item", sku: "12", soh: 4 })], products = [row(["CLICKS", "barcode", "Brand", "Cat", "12", "Item", "Item", "ETHICA", "CL12 Item"])];
  const data = { raw, products, dc: [row(["DC1", "GAUTENG", "01", "Raw", "CLICKS"])], dcStock: [row({ day: "2026-08-31", name: "DC1", sku: "12", soh: 20 })], periodSales: [row(["2026-08-01", "01", "Raw", "Item", "12", "Brand", 3, 30]), row(["2026-08-02", "01", "Raw", "Item", "12", "Brand", -1, -10], 3)] };
  const c = { customer: "Ethica", kind: "Inventory", channelId: "clicks", transformerVersion: "clicks-inventory-v1" };
  const r = stock.transform(data, c), f = r.facts[0].values; assert.equal(f[4], "Raw"); assert.equal(f[11], 20); assert.equal(f[12], 4); assert.equal(f[13], 2); assert.equal(f[16], 0); assert.equal(r.rules.openPO, "zero-default"); assert.ok(r.reconciled);
  data.dcStock = []; data.periodSales = [];
  const missing = stock.transform(data, c); assert.equal(missing.facts[0].values[11], 0); assert.equal(missing.warningCounts.DC_MAPPING, 1); assert.equal(missing.facts[0].values[13], 0); assert.equal(missing.facts[0].values[16], 0); assert.equal(missing.warningCounts.SALES_MAPPING, 1);
  raw[0].v.soh = ""; assert.equal(stock.transform(data, c).issueCounts.SOH_INVALID, 1);
});
test("Clicks DC stock reads CALENDAR_DATE or FIN_WK_START and accepts DC dates after store stock, warning on wide gaps", async () => {
  for (const header of ["CALENDAR_DATE", "FIN_WK_START"]) {
    const rows = await stock.read(await workbook("Data", [header, "DC_DESC", "SKU_NUMBER", "ITEM_DESCRIPTION", "BRAND", "DC_SOH_QUANTITY"], [[new Date("2026-09-28"), "DC1", "12", "Item", "Brand", 20]]), "dcStock");
    assert.equal(sourceDay(rows[0].v.day), "2026-09-28");
  }
  const raw = [row({ day: "2026-09-27", code: "01", name: "Raw", description: "Item", sku: "12", soh: 4 }), row({ day: "2026-09-26", code: "02", name: "Raw", description: "Item", sku: "12", soh: 1 }, 3)];
  const data = { raw, products: [row(["CLICKS", "barcode", "Brand", "Cat", "12", "Item", "Item", "ETHICA", "CL12 Item"])], dc: [row(["DC1", "GAUTENG", "01", "Raw", "CLICKS"])], dcStock: [row({ day: "2026-09-28", name: "DC1", sku: "12", soh: 20 })], periodSales: [row(["2026-08-01", "01", "Raw", "Item", "12", "Brand", 3, 30])] };
  const c = { customer: "Ethica", kind: "Inventory", channelId: "clicks", transformerVersion: "clicks-inventory-v1" };
  const later = stock.transform(data, c); assert.equal(later.totals.invalidDcRows, 0); assert.equal(later.facts[0].values[11], 20); assert.equal(later.warningCounts.DC_DATE_GAP, undefined);
  data.dcStock[0].v.day = "2026-08-31"; const old = stock.transform(data, c);
  assert.equal(old.totals.invalidDcRows, 0); assert.equal(old.facts[0].values[11], 20); assert.equal(old.warningCounts.DC_DATE_GAP, 1);
  data.dcStock[0].v.day = "not a date"; const invalid = stock.transform(data, c);
  assert.equal(invalid.totals.invalidDcRows, 1); assert.equal(invalid.issueCounts.DC_DATE_INVALID, 1); assert.equal(invalid.facts[0].values[11], 0);
});
test("sales export streams large multi-month outputs with the saved Sheet1 layout", async () => {
  const layoutBook = new Excel.Workbook(), saved = layoutBook.addWorksheet("Sheet1"); saved.addRow(require("../shared-layout.cjs").SALES_HEADERS); saved.getColumn(5).width = 31; saved.getCell("A1").font = { bold: true, name: "Aptos Narrow" };
  const facts = Array.from({ length: 20000 }, (_, i) => ({ values: [`2026-${String(i % 12 + 1).padStart(2, "0")}-01`, "AQUELLE", "BOXER", "BOXER", "0" + i, "Store", "", "", "", "", "", "", "", "Water", "AQUELLE", "AQUELLE MINERAL WATER STILL 500 ML", 2, 20.5, null, "NO"] }));
  const result = { facts, exceptions: [], warnings: [{ line: 2, siteCode: "01", rawName: "Store", article: "12", units: 1, value: 2, errors: [{ code: "STORE_MAPPING", detail: "x" }] }], exclusions: [], referenceCellErrors: [], assignments: [], rules: {}, totals: {}, status: "ready", mappingPolicy: "feedback-sales-mappings-v2" };
  const wb = new Excel.Workbook(); await wb.xlsx.load(await sales.exportWorkbook(result, { runId: "t" }, layoutBook));
  const ws = wb.getWorksheet("Sheet1");
  assert.equal(ws.rowCount, 20001); assert.equal(ws.getColumn(5).width, 31); assert.equal(ws.getCell("A1").font.name, "Aptos Narrow"); assert.equal(ws.getCell("A1").value, "Month-Yr");
  assert.equal(ws.getCell("A3").value.toISOString(), "2026-02-01T00:00:00.000Z"); assert.equal(ws.getCell("A3").numFmt, "mmm-yy"); assert.equal(ws.getCell("E2").value, "00"); assert.equal(ws.getCell("E2").numFmt, "@"); assert.equal(ws.getCell("R2").numFmt, "0.00");
  assert.equal(ws.autoFilter, "A1:T20001"); assert.equal(ws.views[0].ySplit, 1); assert.equal(wb.getWorksheet("Accepted Warnings").getCell("G2").value, "STORE_MAPPING"); assert.ok(wb.getWorksheet("Audit"));
});
