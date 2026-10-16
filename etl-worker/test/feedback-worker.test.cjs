"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Excel = require("exceljs");
const { main } = require("../worker.cjs"), engine = require("../engine.cjs"), { SALES_HEADERS } = require("../shared-layout.cjs"), feedback = require("../feedback-sales.cjs"), { inventoryFixture } = require("./inventory-fixture.cjs");
async function fixture(adapter, duplicate = false) {
  const id = "f".repeat(32), { manifest, objects } = await inventoryFixture(id), stock = adapter === "clicks-inventory-v1", weekly = adapter === "makro-sales-v1";
  manifest.context = { id: "synthetic", kind: stock ? "Inventory" : "Sales", customer: stock ? "Ethica" : weekly ? "aQuelle" : "Saldanha", channelId: stock ? "clicks" : weekly ? "makro" : "shoprite", transformerVersion: adapter, reportMonth: "2026-07" };
  delete manifest.inputs.template; delete manifest.inputs.status; if (!stock) delete manifest.inputs.dc;
  async function put(role, sheet, headers, rows) {
    const w = new Excel.Workbook(), s = w.addWorksheet(sheet); s.addRow(headers); rows.forEach(r => s.addRow(r));
    const bytes = Buffer.from(await w.xlsx.writeBuffer()); pin(role, bytes, "xlsx");
  }
  function pin(role, bytes, ext) {
    const p = `etl-run-inputs/${id}/${role}.${ext}`; objects.set(p, bytes); manifest.inputs[role] = { path: p, name: `${role}.${ext}`, generation: "1", size: bytes.length };
  }
  await put("expected", stock ? "Template" : "Sheet1", stock ? engine.HEADERS : SALES_HEADERS, [["OLD SAMPLE"]]);
  if (stock) {
    await put("raw", "Data", ["CALENDAR_DATE", "STORE_NUMBER", "STORE", "SKU_DESCRIPTION", "SKU_NUMBER", "BRAND", "STORE_SOH_VOLUME"], [[new Date("2026-09-01"), "01", "Raw", "Item", "12", "Brand", 3]]);
    await put("dcStock", "Data", ["CALENDAR_DATE", "DC_DESC", "SKU_NUMBER", "ITEM_DESCRIPTION", "BRAND", "DC_SOH_QUANTITY"], [[new Date("2026-08-31"), "DC1", "12", "Item", "Brand", 20]]);
    await put("periodSales", "Data", require("../sales.cjs").CLICKS_HEADERS, [[new Date("2026-08-01"), "01", "Raw", "Item", "12", "Brand", 2, 20]]);
    await put("products", "Product List", engine.SCHEMAS.products[1], [["CLICKS", "barcode", "Brand", "Cat", "12", "Item", "Item", "ETHICA", "CL12 Item"]]);
  } else if (weekly) {
    const headers = Object.values(feedback.fields[adapter]).map(v => [].concat(v)[0]);
    const values = ["2026-07-05 00:00:00.000", "01", "Raw Main Store", "MAIN", "EKHAMANZI SPRINGS (PTY) LTD", "12", "Item", "EA", "Water", 2, 20];
    const raw = Buffer.from(headers.join("|") + "\n" + values.join("|") + "\n(1 rows affected)\n"); pin("raw", raw, "txt");
    values[0] = "2026-07-12 00:00:00.000"; pin("raw2", duplicate ? raw : Buffer.from(headers.join("|") + "\n" + values.join("|")), "txt");
  } else {
    await put("raw", "Separate View", ["Site", "Article", "Sell UOM", "Article Key", "Jul 2026 units", "P", "Category"], [["0005-Raw", "Fish", "EA", "12", 2, 115, "Fish"]]);
    await put("gln", "GLN Report", ["SITE ID", "Brand", "StoreName", "Site (B2B Name)", "PROVINCE", "BANNER", "TradingStatus"], [["005", "Shoprite", "RAW", "0005-Raw", "GAUTENG", "SHOPRITE", "Trading"]]);
  }
  objects.set(`etl-run-inputs/${id}/manifest.json`, Buffer.from(JSON.stringify(manifest)));
  const bucket = { file: (path, options = {}) => ({ getMetadata: async () => [{ size: objects.get(path).length }], download: async () => { if (!path.endsWith("manifest.json")) assert.equal(options.generation, "1"); return [objects.get(path)]; }, save: async (value, config) => { if (config.preconditionOpts?.ifGenerationMatch === 0 && objects.has(path)) throw Object.assign(new Error("exists"), { code: 412 }); objects.set(path, Buffer.from(value)); } }) };
  return { id, bucket, objects, manifest };
}
test("worker executes pinned Clicks stock, multiple TXT sales and GLN monthly sources end-to-end", async () => {
  for (const adapter of ["clicks-inventory-v1", "makro-sales-v1", "shoprite-saldanha-sales-v1"]) {
    const f = await fixture(adapter); await main({ ...f, logger: { log() {}, error: line => assert.fail(line) } });
    const result = JSON.parse(f.objects.get(`etl-results/${f.id}/result.json`)); assert.equal(result.status, "ready"); assert.ok(result.reconciled); assert.ok(result.output.size > 0);
    if (adapter === "makro-sales-v1") { assert.equal(result.totals.validUnits, 4); assert.ok(result.checksums.raw2); }
    if (adapter === "shoprite-saldanha-sales-v1") assert.equal(result.preview[0][1], "UNIVERSAL PAPER");
    if (adapter === "clicks-inventory-v1") assert.equal(result.preview[0][13], 2);
  }
});
test("worker rejects identical weekly files and invalid cross-customer adapter before publishing", async () => {
  for (const invalid of ["duplicate", "customer", "path"]) {
    const f = await fixture("makro-sales-v1", invalid === "duplicate");
    if (invalid === "customer") f.manifest.context.customer = "Anchor";
    if (invalid === "path") f.manifest.inputs.raw.path = "portal-resources/private.txt";
    f.objects.set(`etl-run-inputs/${f.id}/manifest.json`, Buffer.from(JSON.stringify(f.manifest)));
    await main({ ...f, logger: { log() {}, error() {} } }); process.exitCode = 0;
    assert.equal(f.objects.has(`etl-results/${f.id}/result.json`), false);
    const failure = JSON.parse(f.objects.get(`etl-results/${f.id}/failure.json`)); assert.match(failure.error, invalid === "duplicate" ? /same weekly export/ : invalid === "customer" ? /Unknown customer/ : /pinned prefix/);
  }
});

test("Clicks Active default reaches every workbook/fact status without changing quantities or historical rules", async () => {
  const results = [];
  for (const active of [false, true]) {
    const f = await fixture("clicks-inventory-v1");
    if (active) f.manifest.context.articleStatusDefault = "Active";
    f.objects.set(`etl-run-inputs/${f.id}/manifest.json`, Buffer.from(JSON.stringify(f.manifest)));
    await main({ ...f, logger: { log() {}, error: line => assert.fail(line) } });
    const result = JSON.parse(f.objects.get(`etl-results/${f.id}/result.json`));
    assert.equal(result.rules.articleStatus, active ? "Active" : "Not supplied; blank");
    assert.ok(result.preview.every(row => row[14] === (active ? "Active" : "")));
    const facts = f.objects.get(`etl-results/${f.id}/facts.jsonl`).toString().split("\n").map(JSON.parse);
    assert.ok(facts.every(row => row.values[14] === (active ? "Active" : "")));
    const workbook = new Excel.Workbook(); await workbook.xlsx.load(f.objects.get(`etl-results/${f.id}/${result.output.name}`));
    assert.equal(workbook.getWorksheet("Template").getCell("O1").text.trim(), "Article Status");
    assert.equal(workbook.getWorksheet("Template").getCell("O2").text, active ? "Active" : "");
    if (active) assert.match(result.rules.articleStatusBasis, /assumed Active; no source status indicator/);
    results.push(result);
  }
  assert.deepEqual(results[1].totals, results[0].totals);
  assert.deepEqual(results[1].issueCounts, results[0].issueCounts);
  assert.deepEqual(results[1].preview.map(row => row.filter((_, i) => i !== 14)), results[0].preview.map(row => row.filter((_, i) => i !== 14)));
});
