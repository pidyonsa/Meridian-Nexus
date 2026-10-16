"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const engine = require("../etl-worker/engine.cjs"), sales = require("../etl-worker/sales.cjs"), inventory = require("../etl-worker/clicks-inventory.cjs"), feedback = require("../etl-worker/feedback-sales.cjs"), layout = require("../etl-worker/shared-layout.cjs");
const { folder, files } = require("./test-anchor-etl-real.cjs");
const root = path.dirname(folder), output = path.resolve(".tmp/etl-feedback-20260925/validation");
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const data = {}, checksums = {}, results = [];
  for (const role of ["products", "stores", "staffing", "dc", "status"]) {
    const file = role === "stores" ? ".tmp/pnp-corrected-stores-20260924/source.xlsx" : role === "staffing" ? ".tmp/national-master-20260924/files/National_Call_Cycle_23.09.2026_ETL.xlsx" : path.join(folder, files[role]);
    const bytes = fs.readFileSync(file); data[role] = await engine.readWorkbook(bytes, role); checksums[role] = engine.sha(bytes);
  }
  const gln = fs.readFileSync("C:/Users/PC/Downloads/GLN Master Jul26.xlsx");
  data.gln = await feedback.readGln(gln); checksums.gln = engine.sha(gln);
  console.log(JSON.stringify({ glnRows: data.gln.length }));
  const salesLayout = await layout.readExpected(fs.readFileSync(path.join(root, "ETHICA/Ethica Sales- Transformed.xlsx")), "Sales");
  const stockLayout = await layout.readExpected(fs.readFileSync(path.join(folder, "Transformed Inventory File- Anchor.xlsx")), "Inventory");
  async function save(label, result, stock = false) {
    assert.ok(result.reconciled); assert.ok(result.facts.length, label + " produced no output");
    const summary = { label, status: result.status, totals: result.totals, issues: result.issueCounts, warnings: result.warningCounts, examples: result.exceptions.slice(0, 2), period: [result.periodStart, result.periodEnd] };
    results.push(summary); console.log(JSON.stringify(summary));
    fs.writeFileSync(path.join(output, label + ".xlsx"), await (stock ? engine : sales).exportWorkbook(result, { localValidationOnly: true, checksums }, stock ? stockLayout : salesLayout));
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ localValidationOnly: true, checksums, results }, null, 2));
  }
  const onlyShoprite = process.argv.includes("--shoprite");
  if (!onlyShoprite) {
  const clicksContext = { customer: "Ethica", kind: "Sales", channelId: "clicks", transformerVersion: "clicks-sales-v1" };
  const uploaded = await sales.readRaw(fs.readFileSync("C:/Users/PC/Downloads/CLICKS AUG SALES FY26.xlsx"));
  const original = await sales.readRaw(fs.readFileSync(path.join(root, "ETHICA/CLICKS AUG SALES FY26.xlsx")));
  assert.deepEqual(uploaded, original, "Added UI formulas and pivot sheet must not change source facts");
  await save("Ethica-Clicks-Sales", sales.transform({ ...data, raw: uploaded }, clicksContext));
  const stock = await inventory.read(fs.readFileSync(path.join(root, "ETHICA/STORE SOH.xlsx")), "raw");
  const dcStock = await inventory.read(fs.readFileSync(path.join(root, "ETHICA/DC SOH 02-2026.xlsx")), "dcStock");
  await save("Ethica-Clicks-Inventory", inventory.transform({ ...data, raw: stock, dcStock, periodSales: uploaded }, { ...clicksContext, kind: "Inventory", transformerVersion: "clicks-inventory-v1" }), true);
  }
  const cases = [
    ["aQuelle", "boxer", "boxer-sales-v1", "2026-07", ["AQUELLE/raw sales data- Boxer 20260801.xlsx"]],
    ["aQuelle", "game", "game-sales-v1", "2026-07", fs.readdirSync(path.join(root, "AQUELLE/Game raw sales data")).filter(n => n.endsWith(".txt")).map(n => "AQUELLE/Game raw sales data/" + n)],
    ["aQuelle", "makro", "makro-sales-v1", "2026-07", fs.readdirSync(path.join(root, "AQUELLE/Makro raw sales data")).filter(n => n.endsWith(".txt")).map(n => "AQUELLE/Makro raw sales data/" + n)],
    ["Universal Paper", "shoprite-group", "shoprite-universal-sales-v1", "2026-07", ["UNIVERSAL PAPER/SC - 843682-UNIVERSAL PAPER & - Store Monthly - Feb 2026 to Jul 2026_National.xlsx"]],
    ["Saldanha", "shoprite", "shoprite-saldanha-sales-v1", "2026-07", ["SALDANHA/SHOPRITE 6 MONTHS Aug26.xlsx"]],
    ["Saldanha", "checkers", "shoprite-saldanha-sales-v1", "2026-07", ["SALDANHA/CHECKERS 6 MONTHS-Aug26.xlsx"]]
  ];
  for (const [customer, channelId, transformerVersion, reportMonth, inputs] of cases) {
    if (onlyShoprite && !transformerVersion.startsWith("shoprite-")) continue;
    const context = { customer, channelId, transformerVersion, reportMonth, kind: "Sales" }, raw = [];
    for (const file of inputs) {
      const table = await feedback.read(fs.readFileSync(path.join(root, file)), context, path.basename(file));
      raw.push(...table.rows.map(r => ({ ...r, source: path.basename(file) })));
    }
    const result = feedback.transform({ ...data, raw }, context);
    if (customer === "Saldanha") assert.ok(result.facts.every(f => f.values[1] === "UNIVERSAL PAPER"));
    await save(customer.replaceAll(" ", "-") + "-" + channelId, result);
  }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
