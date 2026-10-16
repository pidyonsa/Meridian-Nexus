"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const engine = require("../engine.cjs");
const { validateRules } = require("../../functions/meridian-etl");
const config = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true };
const row = (line, v) => ({ line, v });
function fixture() {
  return {
    raw: [row(2, ["01/09/2026", "N001", "Raw Store", "Corporate Store", "00012", "YEAST", "V", "04", "", "", 115, 4.56, 25, "Stock Transfer"]), row(3, ["01/09/2026", "D001", "Main DC", "Distribution center", "00012", "YEAST", "V", "04", "", "", 500, 2, 250, "Standard"])],
    products: [row(2, ["PICK N PAY CORPORATE", "060087157", "Anchor", "Baking", "00012", "Yeast", "Standard Yeast", "ANCHOR", "YEAST", ""] )],
    stores: [row(2, ["PNP", "N001", "Raw Store", "Pick N Pay Corporate", "M001", "CANONICAL STORE", "Pick N Pay Family"])],
    staffing: [row(2, ["M001", "CANONICAL STORE", "G01", "PNP", "YES", "INLAND", "GROCERY", "GAUTENG", "01", "Rep", "SYNDICATED REP", "", "WEEKLY", "M1", "Manager"] )],
    dc: [row(2, ["Main DC", "GAUTENG", "N001", "Raw Store", "Pick n Pay"])],
    status: [row(2, ["04", "Active", "Active"])]
  };
}

const accepted = data => engine.transform(data, config, "", engine.ACCEPTED_MAPPING_POLICY);
test("raw Site Name output changes only column E and retains canonical mapping and assignments", async () => {
  for (const name of ["Raw Store", "  Mixed Case  Store  ", "=Literal Store", ""]) {
    const data = fixture(); data.raw[0].v[2] = name;
    const before = accepted(data);
    const result = engine.transform(data, config, "", engine.ACCEPTED_MAPPING_POLICY, engine.RAW_SITE_NAME_POLICY);
    assert.equal(result.facts[0].values[4], name);
    assert.equal(result.facts[0].canonicalName, "CANONICAL STORE");
    assert.equal(result.facts[0].canonicalCode, "M001");
    assert.equal(result.facts[0].values[2], "GAUTENG");
    assert.deepEqual(result.facts[0], { ...before.facts[0], values: before.facts[0].values.map((value, i) => i === 4 ? name : value) });
    for (const key of ["totals", "assignments", "exceptions", "warnings", "exclusions", "regionDecisions", "status"]) assert.deepEqual(result[key], before[key], key);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await engine.exportWorkbook(result));
    assert.equal(wb.getWorksheet("Template").getCell("E2").value ?? "", name);
    assert.equal(wb.getWorksheet("Template").getCell("E2").formula, undefined);
    assert.equal(wb.getWorksheet("Store Assignments").getCell("B2").value, "CANONICAL STORE");
    assert.equal(wb.getWorksheet("Mapping Policy").getCell("A3").value, engine.RAW_SITE_NAME_POLICY);
  }
  assert.equal(accepted(fixture()).facts[0].values[4], "CANONICAL STORE", "Old manifests preserve their output policy");
  assert.throws(() => engine.transform(fixture(), config, "", engine.ACCEPTED_MAPPING_POLICY, "unapproved-output"), /Unsupported output policy/);
});

test("raw Site Name output retains missing-alias warnings and does not invent a master name", () => {
  const data = fixture(); data.stores = [];
  const result = engine.transform(data, config, "", engine.ACCEPTED_MAPPING_POLICY, engine.RAW_SITE_NAME_POLICY);
  assert.equal(result.status, "ready"); assert.equal(result.facts[0].values[4], "Raw Store");
  assert.equal(result.facts[0].canonicalName, ""); assert.equal(result.warningCounts.STORE_MAPPING, 1);
});

test("approved mapping gaps include raw identifiers and leave unavailable values blank", async () => {
  const data = fixture(); data.stores = []; data.products = []; data.dc = [];
  const result = accepted(data), fact = result.facts[0];
  assert.equal(result.status, "ready"); assert.equal(result.reconciled, true);
  assert.equal(result.totals.warningRows, 1); assert.equal(result.totals.exceptionRows, 0);
  assert.deepEqual(result.warningCounts, { STORE_MAPPING: 1, PRODUCT_MAPPING: 1, DC_MAPPING: 1 });
  assert.deepEqual(fact.values.slice(1, 12), ["", "", "N001", "Raw Store", "", "", "", "00012", "YEAST", "", null]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await engine.exportWorkbook(result));
  assert.equal(wb.getWorksheet("Template").getCell("L2").value, null);
  assert.equal(wb.getWorksheet("Accepted Warnings").rowCount, 4);
  assert.ok(wb.getWorksheet("Excluded Stores"));
  assert.equal(wb.getWorksheet("Mapping Policy").getCell("A2").value, engine.ACCEPTED_MAPPING_POLICY);
});

test("approved policy does not invent product attributes or region from conflicting candidates", () => {
  const data = fixture(); data.products.push(row(3, [...data.products[0].v]));
  data.products[1].v[1] = "conflicting-barcode"; data.staffing[0].v[7] = "";
  const result = accepted(data);
  assert.equal(result.status, "ready"); assert.equal(result.warningCounts.PRODUCT_MAPPING, 1);
  assert.equal(result.warningCounts.REGION_MAPPING, 1); assert.equal(result.facts[0].values[2], "");
  assert.equal(result.facts[0].values[5], ""); assert.equal(result.facts[0].values[9], "YEAST");
  assert.equal(result.assignments.length, 1);
});

test("liquor candidates are excluded before exact-name and code-only ambiguity checks", () => {
  for (const exact of [true, false]) {
    const data = fixture();
    data.stores.push(row(3, ["PNP", "N001", "Raw Store", "Pick n Pay Liquor", "L001", "LIQUOR STORE", "PNP"]));
    if (!exact) data.raw[0].v[2] = "Other alias";
    const result = accepted(data);
    assert.equal(result.status, "ready"); assert.equal(result.facts[0].canonicalCode, "M001");
    assert.equal(result.totals.validStoreSOH, 115); assert.equal(result.totals.excludedRows, 0);
  }
});

test("attached and standalone liquor facts are excluded, never reassigned to a supermarket", () => {
  for (const canonicalOnly of [true, false]) {
    const data = fixture();
    const raw = [...data.raw[0].v]; raw[1] = "N002"; raw[2] = canonicalOnly ? "Attached Store" : "PNP LIQUOR Standalone"; raw[10] = 40;
    data.raw.push(row(4, raw));
    data.stores.push(row(3, ["PNP", "N002", "Attached Store", "PNP", "L002", "PNP LIQUOR ATTACHED", "PNP"]));
    data.stores.push(row(4, ["PNP", "N002", "Supermarket", "PNP", "M002", "SUPERMARKET", "PNP"]));
    const result = accepted(data);
    assert.equal(result.status, "ready"); assert.equal(result.totals.excludedRows, 1);
    assert.equal(result.totals.excludedStoreSOH, 40); assert.equal(result.totals.sourceStoreSOH, 155);
    assert.equal(result.totals.validStoreSOH, 115); assert.equal(result.facts.length, 1);
    assert.equal(result.exclusions[0].siteCode, "N002"); assert.ok(result.reconciled);
  }
});

test("unknown source names are not discarded using a liquor-only code fallback", () => {
  const data = fixture(); data.stores[0].v[2] = "Different store"; data.stores[0].v[3] = "PNP LIQUOR";
  const result = accepted(data);
  assert.equal(result.status, "ready"); assert.equal(result.warningCounts.STORE_MAPPING, 1);
  assert.equal(result.totals.excludedRows, 0); assert.equal(result.facts[0].values[4], "Raw Store");
  data.stores[0].v[3] = "PNP"; data.stores[0].v[5] = "PNP LIQUORICE CENTRE";
  assert.equal(accepted(data).facts[0].canonicalName, "PNP LIQUORICE CENTRE");
});

test("non-liquor ambiguity and incomplete canonical mappings still require review", () => {
  const data = fixture(); data.stores.push(row(3, ["PNP", "N001", "Raw Store", "PNP", "M002", "OTHER", "PNP"]));
  let result = accepted(data);
  assert.equal(result.status, "review"); assert.equal(result.issueCounts.STORE_MAPPING, 1);
  assert.match(result.exceptions[0].errors[0].detail, /Liquor candidates excluded/);
  data.stores.pop(); data.stores[0].v[4] = ""; result = accepted(data);
  assert.equal(result.status, "review"); assert.equal(result.issueCounts.STORE_MAPPING, 1);
});

test("accepted mappings cannot hide invalid quantities, dates, status, identifiers or duplicates", () => {
  for (const [change, code] of [
    [d => { d.raw[0].v[10] = "bad"; }, "SOH_INVALID"],
    [d => { d.raw[0].v[11] = -1; }, "DROS_INVALID"],
    [d => { d.raw[0].v[1] = ""; }, "IDENTIFIER_MISSING"],
    [d => { d.raw[0].v[3] = "unknown"; }, "PROFILE_UNKNOWN"],
    [d => { d.status = []; }, "STATUS_MAPPING"],
    [d => { d.raw.push(row(4, [...d.raw[0].v])); }, "DUPLICATE_SOURCE"]
  ]) {
    const data = fixture(); data.products = []; change(data);
    const result = accepted(data); assert.equal(result.status, "review"); assert.ok(result.issueCounts[code]); assert.ok(result.reconciled);
  }
  const liquor = fixture(); liquor.raw[0].v[2] = "PNP LIQUOR"; liquor.raw[0].v[10] = "bad";
  assert.equal(accepted(liquor).issueCounts.SOH_INVALID, 1); assert.equal(accepted(liquor).totals.excludedRows, 0);
  const badDate = fixture(); badDate.raw[0].v[0] = "Total"; assert.throws(() => accepted(badDate), /valid inventory/);
  assert.throws(() => engine.transform(fixture(), config, "", "unapproved-policy"), /Unsupported mapping policy/);
});

test("staffing accepts the national Call Cycle Master sheet without reading merchandiser hours as stores", async () => {
  for (const name of ["Sheet1", "Call Cycle Master"]) {
    const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet(name);
    sheet.addRow(engine.SCHEMAS.staffing[1]); sheet.addRow(fixture().staffing[0].v);
    wb.addWorksheet("Merchandiser Hours").addRow(["Week Number", "User Code"]);
    const rows = await engine.readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "staffing");
    assert.deepEqual(rows, fixture().staffing);
  }
});

test("staffing rejects ambiguous master tabs and invalid headers", async () => {
  const wb = new ExcelJS.Workbook();
  for (const name of ["Sheet1", "Call Cycle Master"]) {
    const sheet = wb.addWorksheet(name); sheet.addRow(engine.SCHEMAS.staffing[1]); sheet.addRow(fixture().staffing[0].v);
  }
  await assert.rejects(engine.readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "staffing"), /multiple candidate/);
  wb.removeWorksheet("Sheet1"); wb.getWorksheet("Call Cycle Master").getCell("A1").value = "Wrong Code";
  await assert.rejects(engine.readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "staffing"), /column 1 must be STORE CODE/);
});

test("saved inventory template preserves headers, widths and styles without retaining sample data", async () => {
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet("Template"); sheet.addRow(engine.HEADERS);
  sheet.getColumn(5).width = 47; sheet.getCell("A1").font = { bold: true, color: { argb: "FFFF7000" } };
  sheet.getCell("E2").alignment = { wrapText: true };
  const saved = await engine.readTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
  const result = engine.transform(fixture(), config, "");
  const output = new ExcelJS.Workbook(); await output.xlsx.load(await engine.exportWorkbook(result, { test: true }, saved));
  assert.equal(output.getWorksheet("Template").rowCount, 2); assert.equal(output.getWorksheet("Template").getColumn(5).width, 47);
  assert.equal(output.getWorksheet("Template").getCell("A1").font.color.argb, "FFFF7000");
  assert.equal(output.getWorksheet("Template").getCell("E2").value, "CANONICAL STORE");
  assert.equal(output.getWorksheet("Template").getCell("E2").alignment.wrapText, true);
  assert.equal(output.getWorksheet("Template").getCell("F2").value, "060087157");
  assert.ok(output.getWorksheet("Audit"));
});

test("a loaded template is not treated as a row-based reference during transformation", async () => {
  const data = fixture(), wb = new ExcelJS.Workbook();
  wb.addWorksheet("Template").addRow(engine.HEADERS);
  data.template = await engine.readTemplate(Buffer.from(await wb.xlsx.writeBuffer()));
  data.stores[0].cellErrors = [{ column: 7, error: "#N/A" }];
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.referenceCellErrors, [{ role: "stores", line: 2, column: 7, error: "#N/A" }]);
  assert.equal(result.totals.validStoreSOH, 115);
});

test("template rejects data, formulas, wrong headers, extra sheets and merges", async () => {
  for (const change of [s => { s.getCell("A1").value = "Wrong"; }, s => { s.getCell("A2").value = "Business data"; }, s => { s.getCell("A2").value = { formula: "1+1", result: 2 }; }, s => { s.workbook.addWorksheet("Other"); }, s => { s.mergeCells("A2:B2"); }]) {
    const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet("Template"); sheet.addRow(engine.HEADERS); change(sheet);
    await assert.rejects(engine.readTemplate(Buffer.from(await wb.xlsx.writeBuffer())));
  }
});
test("canonical column F, exact 17-column schema, separate DC facts and estimate", () => {
  const result = engine.transform(fixture(), config, "PnPSiteDaysCover_20260902082929-raw.xlsx");
  assert.equal(result.status, "ready"); assert.equal(result.facts[0].values.length, 17);
  assert.equal(result.facts[0].values[4], "CANONICAL STORE");
  assert.equal(result.facts[0].values[13], 136.8); assert.equal(result.facts[0].values[16], null);
  assert.equal(result.facts[0].values[3], "N001"); assert.equal(result.facts[0].values[5], "060087157");
  assert.equal(result.facts[0].values[8], "00012"); assert.equal(result.dcFacts.length, 1);
  assert.equal(result.asOf, "2026-09-01"); assert.equal(result.exportedAt, "2026-09-02T08:29:29+02:00");
});
test("explicit banner G, exported date, zero convention and 28-day estimate", () => {
  const result = engine.transform(fixture(), { ...config, bannerColumn: "G", reportDate: "exported", openPO: "zero-default", salesDays: 28 }, "PnPSiteDaysCover_20260902082929 (1).xlsx");
  assert.equal(result.facts[0].values[1], "Pick N Pay Family"); assert.equal(result.reportDate, "2026-09-02");
  assert.equal(result.facts[0].values[13], 127.68); assert.equal(result.facts[0].values[16], 0);
});
test("duplicate staffing cannot multiply stock", () => {
  const data = fixture(); data.staffing.push(row(3, [...data.staffing[0].v])); data.staffing.push(row(4, [...data.staffing[0].v.slice(0,8), "02", "Merch", "SYNDICATED MERCHANDISER", "", "", "M1", "Manager"]));
  const result = engine.transform(data, config, "");
  assert.equal(result.facts.length, 1); assert.equal(result.assignments.length, 2); assert.equal(result.totals.validStoreSOH, 115);
});

test("first exact store region wins without removing any staff assignments", () => {
  const data = fixture();
  const second = [...data.staffing[0].v]; second[7] = "WESTERN CAPE"; second[8] = "02"; second[9] = "Second Rep";
  data.staffing.push(row(3, second));
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "ready"); assert.equal(result.facts[0].values[2], "GAUTENG");
  assert.equal(result.assignments.length, 2); assert.equal(result.totals.validStoreSOH, 115);
  assert.equal(result.regionDecisions[0].sourceLine, 2); assert.deepEqual(result.regionDecisions[0].otherRegions, ["WESTERN CAPE"]);
});

test("same store name with a different code cannot supply region or staff", () => {
  const data = fixture(), other = [...data.staffing[0].v]; other[0] = "OTHER"; other[7] = "WESTERN CAPE"; other[8] = "02";
  data.staffing.unshift(row(1, other));
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "ready"); assert.equal(result.facts[0].values[2], "GAUTENG"); assert.equal(result.assignments.length, 1);
  data.staffing = [row(1, other)]; assert.equal(engine.transform(data, config, "").issueCounts.REGION_MAPPING, 1);
});

test("missing first region stays a review exception instead of becoming zero or using another store", () => {
  const data = fixture(); data.staffing[0].v[7] = "";
  data.staffing.push(row(3, [...data.staffing[0].v.slice(0, 7), "GAUTENG", ...data.staffing[0].v.slice(8)]));
  const result = engine.transform(data, config, ""); assert.equal(result.issueCounts.REGION_MAPPING, 1); assert.equal(result.facts.length, 0);
});
test("product ORIG alias resolves article ambiguity but arbitrary first match is forbidden", () => {
  const data = fixture(); data.products.push(row(3, ["PICK N PAY CORPORATE", "9999", "Anchor", "Baking", "00012", "Yeast", "Standard Yeast", "ANCHOR", "OTHER", ""]));
  assert.equal(engine.transform(data, config, "").status, "ready");
  data.raw[0].v[5] = "Unknown";
  assert.equal(engine.transform(data, config, "").issueCounts.PRODUCT_MAPPING, 1);
});
test("store collisions, duplicate raw facts and missing DC cannot be silently discarded", () => {
  const data = fixture(); data.stores.push(row(3, ["PNP", "N001", "Raw Store", "PNP", "M2", "OTHER STORE", "PNP"]));
  data.raw.push(row(4, [...data.raw[0].v])); data.dc = [];
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "review"); assert.equal(result.totals.exceptionRows, 2); assert.equal(result.totals.exceptionStoreSOH, 230);
  assert.equal(result.issueCounts.STORE_MAPPING, 2); assert.equal(result.issueCounts.DC_MAPPING, 2); assert.equal(result.issueCounts.DUPLICATE_SOURCE, 2); assert.ok(result.reconciled);
});

test("same code and name for a supermarket and liquor store stays in review without a false region error", () => {
  const data = fixture();
  for (let i = 0; i < 20; i++) data.stores.push(row(10 + i, [...data.stores[0].v]));
  data.stores.push(row(40, ["PICK N PAY LIQUOR", "N001", "Raw Store", "PICK N PAY LIQUOR", "M001", "LIQUOR STORE", "PICK N PAY LIQUOR"]));
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "review"); assert.equal(result.facts.length, 0);
  assert.equal(result.issueCounts.STORE_MAPPING, 1); assert.equal(result.issueCounts.REGION_MAPPING, undefined);
  const issue = result.exceptions[0].errors.find(error => error.code === "STORE_MAPPING");
  assert.equal(issue.referenceCount, 2); assert.equal(issue.references[0].aliasCount, 21);
  assert.equal(issue.references[1].canonicalName, "LIQUOR STORE"); assert.match(issue.detail, /Region validation is deferred/);
  assert.equal(result.totals.exceptionStoreSOH, 115); assert.ok(result.reconciled);
});

test("composite matching distinguishes names sharing a code without silently excluding liquor", () => {
  const data = fixture();
  data.stores.push(row(3, ["PICK N PAY LIQUOR", "N001", "Liquor Store", "PICK N PAY LIQUOR", "L001", "LIQUOR STORE", "PICK N PAY LIQUOR"]));
  data.staffing.push(row(3, ["L001", "LIQUOR STORE", "G02", "PICK N PAY LIQUOR", "YES", "INLAND", "LIQUOR", "GAUTENG"]));
  assert.equal(engine.transform(data, config, "").facts[0].canonicalName, "CANONICAL STORE");
  data.raw[0].v[2] = "  liquor   store ";
  const result = engine.transform(data, config, "");
  assert.equal(result.status, "ready"); assert.equal(result.facts[0].canonicalName, "LIQUOR STORE");
});

test("incomplete store mappings defer region validation, while genuine region gaps remain blocking", () => {
  const data = fixture(); data.staffing = [];
  assert.equal(engine.transform(data, config, "").issueCounts.REGION_MAPPING, 1);
  data.stores[0].v[4] = "";
  const result = engine.transform(data, config, "");
  assert.equal(result.issueCounts.STORE_MAPPING, 1); assert.equal(result.issueCounts.REGION_MAPPING, undefined);
  assert.equal(result.status, "review");
});

test("new exception workbook includes source key and distinct candidate count", async () => {
  const data = fixture(); data.stores.push(row(3, ["PNP", "N001", "Raw Store", "PNP", "M002", "OTHER STORE", "PNP"]));
  const result = engine.transform(data, config, ""), wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await engine.exportWorkbook(result));
  const ws = wb.getWorksheet("Exceptions");
  assert.equal(ws.getCell("K1").value, "Source key (code + name)");
  assert.deepEqual(JSON.parse(ws.getCell("K2").value), ["N001", "RAW STORE"]);
  assert.equal(ws.getCell("L2").value, 2); assert.equal(JSON.parse(ws.getCell("J2").value).length, 2);
  assert.equal(wb.getWorksheet("Template").rowCount, 1);
});
test("no missing numeric value becomes zero; alpha statuses retain meaning", () => {
  const data = fixture(); data.raw[0].v[10] = ""; data.raw[0].v[7] = "7B"; data.status.push(row(3, ["7B", "Old", "Discontinued"]));
  const result = engine.transform(data, config, "");
  assert.equal(result.totals.unknownStoreSOHRows, 1); assert.equal(result.issueCounts.SOH_INVALID, 1); assert.equal(result.issueCounts.STATUS_MAPPING, undefined);
});
test("all rules need explicit confirmation on API and worker", () => {
  for (const validate of [engine.rules, validateRules]) {
    assert.throws(() => validate({})); assert.throws(() => validate({ ...config, confirmed: false })); assert.throws(() => validate({ ...config, salesDays: 365 }));
    assert.deepEqual(validate(config), config);
  }
});
test("mixed dates and invalid export timestamps fail closed", () => {
  const data = fixture(); data.raw[1].v[0] = "02/09/2026";
  assert.throws(() => engine.transform(data, config, ""), /one valid/);
  assert.throws(() => engine.transform(fixture(), { ...config, reportDate: "exported" }, "latest.xlsx"), /timestamp/);
  assert.equal(engine.date("31/02/2026"), null); assert.equal(engine.exported("PnPSiteDaysCover_20261302082929.xlsx"), null);
});
test("read contracts reject wrong schema, formulas and unsafe ZIPs", async () => {
  await assert.rejects(engine.inspectZip(Buffer.from("invalid")));
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("PNP STATUS"); ws.addRow(["Code", "Description", "Cleaned Description"]); ws.addRow(["04", "Active", { formula: "1+1", result: 2 }]);
  await assert.rejects(engine.readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "status"), /formula/);
  ws.getCell("C2").value = "Active"; ws.getCell("A1").value = "Wrong";
  await assert.rejects(engine.readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "status"), /column 1/);
});
test("XLSX output preserves literal text and exact template with audit sheets", async () => {
  const result = engine.transform(fixture(), config, ""); result.facts[0].values[4] = "=HYPERLINK(\"evil\")";
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await engine.exportWorkbook(result, { runId: "test" }));
  assert.deepEqual(wb.getWorksheet("Template").getRow(1).values.slice(1), engine.HEADERS);
  assert.equal(wb.getWorksheet("Template").getCell("E2").type, ExcelJS.ValueType.String);
  assert.equal(wb.getWorksheet("Template").getCell("F2").value, "060087157");
  assert.equal(wb.worksheets.length, 6);
  assert.equal(wb.getWorksheet("Mapping Policy").getCell("A2").value, "pnp-exact-store-first-region-20260924");
});
test("ZIP expansion is checked against actual decompressed bytes", async () => {
  const JSZip = require("jszip");
  const zip = new JSZip(); zip.file("xl/test.xml", "x".repeat(100000));
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central >= 0); bytes.writeUInt32LE(1, central + 24);
  await assert.rejects(engine.inspectZip(bytes), /compressed|decompression/);
});
