"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ExcelJS = require("../../functions/node_modules/exceljs");
const e = require("../../functions/dataorbis-sales.js");
const options = { month: "2026-08", client: "WILMAR", numericConvention: "literal-confirmed", referencesApproved: true, sourceComplete: true };
function row(overrides = {}) { return { sheet: "Game Raw Data", line: 2, v: ["2026-08-01", "G008", "GAME BEACON BAY_G008", "Eastern Cape", "SUNFLOWER OIL", "EXCELLA", "EXCELLA OIL 4L", 4, 640], ...overrides }; }
function refs() { return { cleanup: [{ line: 2, v: ["GAME", "G008", "GAME BEACON BAY_G008", "GAME", "G008", "GAME EAST LONDON", "GAME"] }], callCycle: [{ line: 2, v: ["G008", "GAME EAST LONDON", "MER1", "Game"] }] }; }

test("projects all 20 actual template columns, preserves raw identity and six legacy blanks plus two trailing blanks", () => {
  const r = e.transform([row()], refs(), options);
  assert.equal(r.status, "validated-local");
  assert.equal(r.publicationEnabled, false);
  assert.equal(e.HEADERS[15], "PRODUCT/SKU");
  assert.equal(r.records[0].v.length, 20);
  assert.equal(r.records[0].v[5], "GAME BEACON BAY_G008");
  assert.equal(r.records[0].mapping.cleanName, "GAME EAST LONDON");
  for (const i of [6, 7, 9, 10, 11, 12, 18, 19]) assert.equal(r.records[0].v[i], null);
  assert.deepEqual(r.totals.source, r.totals.output);
});
test("Game date-column subtotals never enter sales, including aggregate and partial Total blocks", () => {
  const detail = row(), total = row({ line: 3, v: ["Total", ...detail.v.slice(1)] });
  const r = e.transform([detail, total], refs(), options);
  assert.equal(r.records.length, 1); assert.equal(r.removedTotals.length, 1);
  const aggregate = row({ line: 4, v: [" total ", null, null, null, null, null, null, 1000, 999999] });
  total.v[8] = 641;
  const input = [detail, total, aggregate], original = structuredClone(input);
  const result = e.transform(input, refs(), options);
  assert.deepEqual(result.totals.source, { rows: 1, units: 4, value: 640 });
  assert.deepEqual(result.totals.output, result.totals.source);
  assert.equal(result.removedTotals.length, 2);
  assert.ok(result.removedTotals.every(r => r.reason === "game-date-subtotal"));
  assert.deepEqual(input, original, "Raw export remains unchanged for audit");
  assert.equal(result.records[0].v[0], "2026-08-01");
  assert.throws(() => e.transform([detail, row({ line: 3 })], refs(), options), /repeated/);
  assert.throws(() => e.transform([total], refs(), options), /No detail rows/);
});

test("only Total in Game column A is excluded, not product names or invalid date labels", () => {
  const detail = row(); detail.v[6] = "Total";
  assert.equal(e.transform([detail], refs(), options).records[0].v[15], "Total");
  for (const label of ["TOTAL", "Total", " total "]) {
    const total = row({ line: 3, v: [label, ...detail.v.slice(1)] });
    assert.equal(e.transform([detail, total], refs(), options).removedTotals.length, 1);
  }
  const invalid = row(); invalid.v[0] = "Total sales";
  assert.throws(() => e.transform([invalid], refs(), options), /month/);
});

test("Makro Total duplicate verification is unchanged by the Game subtotal rule", () => {
  const detail = row({ sheet: "Makro Raw Data" }), references = refs();
  for (const i of [0, 3, 6]) references.cleanup[0].v[i] = "MAKRO";
  references.callCycle[0].v[3] = "MAKRO";
  const total = row({ sheet: detail.sheet, line: 3, v: ["Total", ...detail.v.slice(1)] });
  const result = e.transform([detail, total], references, options);
  assert.equal(result.records.length, 1);
  assert.equal(result.removedTotals[0].reason, "verified-total-duplicate");
  total.v[8]++;
  assert.throws(() => e.transform([detail, total], references, options), /reconcile/);
});
test("never guesses at numeric scale, truncates decimals, or drops returns and zeros", () => {
  for (const [units, amount] of [[1.095, 76.222], [0, 0], [-4, -640]]) {
    const input = row(); input.v[7] = units; input.v[8] = amount;
    const r = e.transform([input], refs(), { month: options.month, client: options.client });
    assert.equal(r.records[0].v[16], units); assert.equal(r.records[0].v[17], amount);
    assert.ok(r.blockers.includes("numeric-convention-unconfirmed"));
    assert.throws(() => e.assertPublishable(r, {}), /blocked/);
  }
  const bad = row(); bad.v[8] = "1,095";
  assert.throws(() => e.transform([bad], refs(), options), /numeric cells/);
});
test("requires the declared complete month and explicit client", () => {
  for (const date of ["2026-08-02", "2026-09-01", "not a date"]) {
    const input = row(); input.v[0] = date;
    assert.throws(() => e.transform([input], refs(), options), /month/);
  }
  assert.throws(() => e.transform([row()], refs(), { ...options, client: "" }), /client/);
  assert.throws(() => e.transform([row()], refs(), { ...options, month: "2026-13" }), /month/);
});
test("composite store mappings are mandatory; no prefix or name-only fallbacks", () => {
  for (const modify of [r => { r.v[1] = "G999"; }, r => { r.v[2] = "OTHER STORE"; }]) {
    const input = row(); modify(input);
    const r = e.transform([input], refs(), options);
    assert.equal(r.records.length, 0); assert.equal(r.exceptions[0].error, "store-cleanup-missing");
    assert.deepEqual(r.totals.source, r.totals.exceptions);
  }
});
test("duplicate staffing rows do not multiply sales; conflicting mappings block", () => {
  const data = refs(); data.callCycle.push({ ...data.callCycle[0], line: 3 });
  assert.equal(e.transform([row()], data, options).records.length, 1);
  data.callCycle.push({ line: 4, v: ["G008", "GAME EAST LONDON", "MER1", "MAKRO"] });
  assert.equal(e.transform([row()], data, options).exceptions[0].error, "call-cycle-conflict");
  const another = refs(); another.cleanup.push({ line: 3, v: ["GAME", "G008", "GAME BEACON BAY_G008", "GAME", "G009", "OTHER", "GAME"] });
  assert.equal(e.transform([row()], another, options).exceptions[0].error, "store-cleanup-ambiguous");
});
test("Game online and non-SA are held for review until exclusion policy is explicit", () => {
  const input = row(); input.v[3] = "Non-sa";
  const hold = e.transform([input], refs(), options);
  assert.equal(hold.exceptions[0].error, "exclusion-policy-unconfirmed");
  const exclude = e.transform([input], refs(), { ...options, excludeGameOnlineAndNonSa: true });
  assert.equal(exclude.excluded.length, 1); assert.equal(exclude.records.length, 0);
  const include = e.transform([input], refs(), { ...options, excludeGameOnlineAndNonSa: false });
  assert.equal(include.records.length, 1);
});
test("broken matching reference cannot hide behind a valid duplicate; unrelated identifiable errors are warnings", () => {
  const data = refs();
  data.cleanup.push({ ...data.cleanup[0], line: 9, error: "invalid mapping cell" });
  assert.equal(e.transform([row()], data, options).exceptions[0].error, "store-cleanup-cell-error");
  data.cleanup[1].v = ["OTHER", "X1", "OTHER SITE", null, null, null, null];
  const unrelated = e.transform([row()], data, options);
  assert.equal(unrelated.status, "validated-local"); assert.equal(unrelated.referenceWarnings.length, 1);
  data.cleanup[1].v[1] = null;
  assert.ok(e.transform([row()], data, options).blockers.includes("unidentifiable-reference-errors"));
});
test("reconciliation uses all cells and multiplicity, not totals alone", () => {
  const r = e.transform([row()], refs(), options);
  const expected = [{ line: 3, v: r.records[0].v.slice(0, 18) }];
  assert.equal(e.reconcile(r, expected).exact, true);
  assert.equal(e.reconcile(r, [...expected, ...expected]).missing.length, 1);
  expected[0].v[16]++;
  assert.equal(e.reconcile(r, expected).matchedRows, 0);
});
test("idempotency guard refuses existing month/client/channel partitions", () => {
  const r = e.transform([row()], refs(), options);
  assert.throws(() => e.assertPublishable(r, { month: "2026-08", client: "WILMAR", conflictingRows: 1 }), /already exists/);
  assert.throws(() => e.assertPublishable(r, { month: "2026-09", client: "WILMAR", conflictingRows: 0 }), /identity/);
  assert.equal(e.assertPublishable(r, { month: "2026-08", client: "WILMAR", conflictingRows: 0 }).batchDigest, r.batchDigest);
});
test("draft is values-only and keeps subtotal evidence outside the sales sheet", async () => {
  const input = row(); input.v[6] = '=HYPERLINK("https://invalid.example","x")';
  const total = row({ line: 3, v: ["Total", null, null, null, null, null, null, 999, 10000] });
  const r = e.transform([input, total], refs(), options);
  const bytes = await e.draftWorkbook(r, {}, e.reconcile(r, []));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  const sheet = wb.getWorksheet("Draft Sales - NOT PUBLISHED");
  assert.equal(sheet.getCell("P2").value, input.v[6]);
  assert.equal(sheet.getCell("P2").formula, undefined);
  assert.equal(sheet.getCell("S2").value, null); assert.equal(sheet.getCell("T2").value, null);
  assert.equal(sheet.rowCount, 2);
  const subtotal = wb.getWorksheet("Excluded Subtotals");
  assert.equal(subtotal.rowCount, 2); assert.equal(subtotal.getCell("C2").value, "game-date-subtotal");
  assert.equal(subtotal.getCell("D2").value, "Total");
  assert.ok(wb.getWorksheet("Exceptions")); assert.ok(wb.getWorksheet("Audit"));
});
test("streaming template inspection preserves existing rows, detects conflicts, and rejects schema drift", async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dataorbis-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "template.xlsx"), wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1"); sheet.addRow(e.HEADERS);
  const r = e.transform([row()], refs(), options);
  sheet.addRow([new Date("2026-08-01T00:00:00Z"), ...r.records[0].v.slice(1)]); sheet.getColumn(1).numFmt = "mmm-yy";
  await wb.xlsx.writeFile(file);
  const before = e.sha(await fs.readFile(file));
  const audit = await e.inspectTemplate(file, options);
  assert.equal(audit.rows, 1); assert.equal(audit.conflictingRows, 1);
  assert.equal(e.sha(await fs.readFile(file)), before);
  sheet.getCell("P1").value = "PRODUCT"; await wb.xlsx.writeFile(file);
  await assert.rejects(e.inspectTemplate(file, options), /schema/);
});
