"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("../functions/node_modules/exceljs");
const source = "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/ANCHOR";
const output = path.resolve(__dirname, "../.tmp/anchor-etl-analysis");
const norm = value => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const pnp = value => /PICK.*PAY|^PNP/.test(norm(value));
function val(cell) {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") return value.result ?? value.text ?? cell.text;
  return value ?? "";
}
async function load(name, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(source, name));
  const sheet = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1).map(norm);
  const rows = [];
  let formulas = 0;
  sheet.eachRow((row, index) => {
    row.eachCell(cell => { if (cell.value?.formula || cell.value?.sharedFormula) formulas += 1; });
    if (index === 1) return;
    const record = {};
    headers.forEach((key, column) => { if (key && !Object.hasOwn(record, key)) record[key] = val(row.getCell(column + 1)); });
    if (Object.values(record).some(value => value !== "")) rows.push(record);
  });
  return { headers, rows, formulas };
}
function count(rows, key) {
  const result = {};
  for (const row of rows) { const value = String(row[key] ?? ""); result[value] = (result[value] || 0) + 1; }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
}
function index(rows, key) {
  const result = new Map();
  for (const row of rows) { const id = key(row); if (!result.has(id)) result.set(id, []); result.get(id).push(row); }
  return result;
}
const summary = dataset => ({ rows: dataset.rows.length, formulas: dataset.formulas });

async function main() {
  const raw = await load("PnPSiteDaysCover_20260902082929- PNP INVENTORY RAW.xlsx");
  const gold = await load("Transformed Inventory File- Anchor.xlsx");
  const products = await load("Product List.xlsx");
  const stores = await load("SALES DATA STORE NAME CLEAN UP .xlsx");
  const master = await load("National_Call_Cycle_Masters 01.09.2026.xlsx");
  const dc = await load("DC Mapping File.xlsx");
  const status = await load("PNP Status Codes.xlsx");
  const pnpGold = gold.rows.filter(row => pnp(row.BANNER));
  const pnpStores = stores.rows.filter(row => pnp(row.BANNER) || pnp(row["CLEANED BANNER"]));
  const byCode = index(pnpStores, row => norm(row["STORE ID"]));
  const byName = index(pnpStores, row => norm(row["STORE NAME"]));
  const productByArticle = index(products.rows.filter(row => pnp(row.BANNER)), row => norm(row.ARTICLE));
  const goldByArticle = index(pnpGold, row => norm(row.ARTICLE));
  const goldBySiteArticle = index(pnpGold, row => `${norm(row["SITE CODE"])}|${norm(row.ARTICLE)}`);
  const masterByName = index(master.rows, row => norm(row["STORE NAME"]));
  const matches = { storeCodeUnique: 0, storeCodeConflicting: 0, storeCodeMissing: 0, storeNameUnique: 0, storeCodeAndNameUnique: 0, storeCodeAndNameAmbiguous: 0, productArticleUnique: 0, productArticleAmbiguous: 0, productMissing: 0, anchorProductUnique: 0, anchorProductAmbiguous: 0, anchorProductMissing: 0, goldRawSiteArticle: 0, goldCanonicalSiteArticle: 0, goldSOHEqual: 0, goldDROSx28Equal: 0, goldDROSx30Equal: 0, goldNameEqualsRaw: 0, goldNameEqualsColumnF: 0, masterMultipleRows: 0, masterMissing: 0 };
  const omitted = [];
  const conflicts = [];
  const cases = [];
  for (const row of raw.rows) {
    const codeCandidates = byCode.get(norm(row["SITE CODE"])) || [];
    const uniqueCodeTargets = [...new Set(codeCandidates.map(row => `${norm(row["CLEANED STORE CODE"])}|${norm(row["CLEANED STORE NAME"])}|${norm(row["CLEANED BANNER"])}`))];
    if (uniqueCodeTargets.length === 1) matches.storeCodeUnique += 1;
    else if (uniqueCodeTargets.length > 1) matches.storeCodeConflicting += 1;
    else matches.storeCodeMissing += 1;
    const nameCandidates = byName.get(norm(row["SITE DESCRIPTION"])) || [];
    if (new Set(nameCandidates.map(row => norm(row["CLEANED STORE NAME"]))).size === 1) matches.storeNameUnique += 1;
    const exactCandidates = codeCandidates.filter(item => norm(item["STORE NAME"]) === norm(row["SITE DESCRIPTION"]));
    const exactTargets = new Set(exactCandidates.map(row => [row["CLEANED STORE CODE"], row["CLEANED STORE NAME"], row["CLEANED BANNER"]].map(norm).join("|")));
    if (exactTargets.size === 1) matches.storeCodeAndNameUnique += 1;
    if (exactTargets.size > 1) matches.storeCodeAndNameAmbiguous += 1;
    const prod = productByArticle.get(norm(row["ARTICLE NUMBER"])) || [];
    const productVariants = new Set(prod.map(row => [row.BARCODE, row.BRAND, row.CATEGORY, row["ARTICLE DESCRIPTION"], row["ARTICLE DESCRIPTION P&G PL"], row.CLIENT].map(norm).join("|")));
    if (productVariants.size === 1) matches.productArticleUnique += 1;
    else if (productVariants.size > 1) matches.productArticleAmbiguous += 1;
    else matches.productMissing += 1;
    const anchorProducts = prod.filter(item => norm(item.CLIENT) === "ANCHOR");
    const anchorVariants = new Set(anchorProducts.map(item => [item.BARCODE, item.BRAND, item.CATEGORY, item["ARTICLE DESCRIPTION"], item["ARTICLE DESCRIPTION P&G PL"]].map(norm).join("|")));
    if (anchorVariants.size === 1) matches.anchorProductUnique += 1;
    else if (anchorVariants.size > 1) matches.anchorProductAmbiguous += 1;
    else matches.anchorProductMissing += 1;
    if (anchorVariants.size > 1 && !conflicts.some(item => item.article === row["ARTICLE NUMBER"])) conflicts.push({ article: row["ARTICLE NUMBER"], variants: anchorProducts });
    const mapping = uniqueCodeTargets.length === 1 ? codeCandidates[0] : null;
    const rawMatch = goldBySiteArticle.get(`${norm(row["SITE CODE"])}|${norm(row["ARTICLE NUMBER"])}`) || [];
    const mappedMatch = mapping ? goldBySiteArticle.get(`${norm(mapping["CLEANED STORE CODE"])}|${norm(row["ARTICLE NUMBER"])}`) || [] : [];
    if (rawMatch.length) matches.goldRawSiteArticle += 1;
    if (mappedMatch.length) matches.goldCanonicalSiteArticle += 1;
    const candidates = mappedMatch.length ? mappedMatch : rawMatch;
    const compared = candidates.length === 1 ? candidates[0] : null;
    if (compared) {
      if (Number(compared["STORE SOH"]) === Number(row["SOH QTY"])) matches.goldSOHEqual += 1;
      if (Math.abs(Number(compared["SELL OUT P4 WEEKS"]) - Number(row["DROS QTY"]) * 28) < 0.011) matches.goldDROSx28Equal += 1;
      if (Math.abs(Number(compared["SELL OUT P4 WEEKS"]) - Number(row["DROS QTY"]) * 30) < 0.011) matches.goldDROSx30Equal += 1;
      if (norm(compared["SITE NAME"]) === norm(row["SITE DESCRIPTION"])) matches.goldNameEqualsRaw += 1;
      if (mapping && norm(compared["SITE NAME"]) === norm(mapping["CLEANED STORE NAME"])) matches.goldNameEqualsColumnF += 1;
    }
    if (!rawMatch.length) omitted.push(row);
    const staffing = mapping ? masterByName.get(norm(mapping["CLEANED STORE NAME"])) || [] : [];
    if (staffing.length > 1) matches.masterMultipleRows += 1;
    if (!staffing.length) matches.masterMissing += 1;
    if (cases.length < 5) cases.push({ raw: row, mapping, matchedProductVariants: productVariants.size, output: compared, goldArticleRows: (goldByArticle.get(norm(row["ARTICLE NUMBER"])) || []).length });
  }
  const profiles = {
    raw: { ...summary(raw), dates: count(raw.rows, "WEEK ENDING DATE"), siteProfiles: count(raw.rows, "SITE PROFILE"), status: count(raw.rows, "SITE ARTICLE STATUS"), sourceOfSupply: count(raw.rows, "SOURCE OF SUPPLY"), uniqueSites: new Set(raw.rows.map(row => row["SITE CODE"])).size, uniqueArticles: new Set(raw.rows.map(row => row["ARTICLE NUMBER"])).size },
    transformed: { ...summary(gold), banners: count(gold.rows, "BANNER"), dates: count(gold.rows, "WEEK ENDING"), clients: count(gold.rows, "CLIENT"), pnpRows: pnpGold.length, pnpDates: count(pnpGold, "WEEK ENDING"), pnpOpenPO: count(pnpGold, "OPEN PO QTY"), pnpDC: count(pnpGold, "SUPPLYING DC SOH"), pnpStatuses: count(pnpGold, "ARTICLE STATUS") },
    products: { ...summary(products), anchorRows: products.rows.filter(row => norm(row.CLIENT) === "ANCHOR").length, anchorBanners: count(products.rows.filter(row => norm(row.CLIENT) === "ANCHOR"), "BANNER") },
    stores: { ...summary(stores), pnpRows: pnpStores.length, pnpInputBanners: count(pnpStores, "BANNER"), pnpCanonicalBanners: count(pnpStores, "CLEANED BANNER") },
    master: { ...summary(master), roles: count(master.rows, "RESOURCE TYPE"), duplicatedStoreNames: [...masterByName.values()].filter(rows => rows.length > 1).length },
    dc: { ...summary(dc), portals: count(dc.rows, "PORTAL") }, status: status.rows,
    matches,
    excludedFromExample: { rows: omitted.length, profiles: count(omitted, "SITE PROFILE"), articles: count(omitted, "ARTICLE NUMBER"), statuses: count(omitted, "SITE ARTICLE STATUS") },
    samplePnPOutput: cases.map(item => ({ site: item.raw["SITE CODE"], rawName: item.raw["SITE DESCRIPTION"], columnF: item.mapping?.["CLEANED STORE NAME"] || null, outputName: item.output?.["SITE NAME"] || null, DROS: item.raw["DROS QTY"], outputP4Weeks: item.output?.["SELL OUT P4 WEEKS"] ?? null })),
    anchorProductConflicts: conflicts
  };
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "mapping-analysis.json"), JSON.stringify({ checkedAt: new Date().toISOString(), ...profiles, cases }, null, 2));
  console.log(JSON.stringify(profiles, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
