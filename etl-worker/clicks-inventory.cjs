"use strict";
const engine = require("./engine.cjs"), sales = require("./sales.cjs"), { readTable, decimal, sourceDate } = require("./source-files.cjs");
const { index, key, unique, issue, counts, mapper } = require("./feedback-mapping.cjs");
const { clean, norm } = engine;
const stockFields = { day: "CALENDAR_DATE", code: "STORE_NUMBER", name: "STORE", description: ["SKU_DESCRIPTION", "PRODUCT_DESCR"], sku: "SKU_NUMBER", brand: "BRAND", soh: "STORE_SOH_VOLUME" };
// Ethica renamed the DC date column from FIN_WK_START to CALENDAR_DATE in September 2026; both are accepted.
const dcFields = { day: ["CALENDAR_DATE", "FIN_WK_START"], name: "DC_DESC", sku: "SKU_NUMBER", description: "ITEM_DESCRIPTION", brand: "BRAND", soh: "DC_SOH_QUANTITY" };
async function read(buffer, role) {
  if (role === "periodSales") return sales.readRaw(buffer);
  return (await readTable(buffer, { fields: role === "dcStock" ? dcFields : stockFields })).rows;
}
function transform(data, context) {
  if (context.transformerVersion !== "clicks-inventory-v1" || context.channelId !== "clicks" || context.kind !== "Inventory") throw new Error("Unsupported Clicks inventory adapter.");
  if (context.articleStatusDefault !== undefined && context.articleStatusDefault !== "Active") throw new Error("Unsupported Clicks article-status default.");
  // Older pinned runs retain their original blank-status rule.
  const articleStatus = context.articleStatusDefault || "";
  const dates = [...new Set(data.raw.map(r => sourceDate(r.v.day)).filter(Boolean))].sort();
  if (!dates.length) throw new Error("Store stock has no valid as-of dates.");
  const asOf = dates.at(-1), firstDate = dates[0], customer = norm(context.customer), mapStore = mapper(data, "CLICKS");
  const products = data.products.filter(r => norm(r.v[0]) === "CLICKS" && norm(r.v[7]) === customer);
  const orig = index(products, r => norm(r.v[8])), other = index(data.products.filter(r => norm(r.v[0]) === "CLICKS" && norm(r.v[7]) !== customer), r => norm(r.v[4]));
  if (!data.raw.some(r => products.some(p => norm(p.v[4]) === norm(r.v.sku)))) throw new Error("Store stock SKUs do not match the selected customer in the shared Product List.");
  const dcMap = (data.dc || []).filter(r => norm(r.v[4]) === "CLICKS"), dcNames = index(dcMap, r => norm(r.v[3])), dcCodes = index(dcMap, r => norm(r.v[2]));
  const dcBalances = index(data.dcStock, r => key(r.v.name, r.v.sku)), rawKeys = index(data.raw, r => key(r.v.code, r.v.sku));
  const salesKeys = index(data.periodSales, r => key(r.v[1], r.v[4]));
  const saleDates = data.periodSales.map(r => sourceDate(r.v[0]));
  if (saleDates.some(d => !d || d > firstDate)) throw new Error("Sales dates must be valid and must not be later than the earliest stock as-of date.");
  const saleDuplicates = index(data.periodSales, r => key(sourceDate(r.v[0]), r.v[1], r.v[4]));
  const totals = { inputRows: data.raw.length, storeRows: data.raw.length, readyRows: 0, exceptionRows: 0, dcRows: data.dcStock.length, invalidDcRows: 0, warningRows: 0, excludedRows: 0, sourceStoreSOH: 0, validStoreSOH: 0, exceptionStoreSOH: 0, excludedStoreSOH: 0, unknownStoreSOHRows: 0, dcSOH: 0 };
  const facts = [], exceptions = [], warnings = [], dcFacts = [], assignments = new Map();
  const dayMs = 24 * 60 * 60 * 1000, dcGapDays = 7;
  for (const row of data.dcStock) {
    const soh = decimal(row.v.soh), day = sourceDate(row.v.day), errors = [], notices = [];
    if (soh === null) errors.push(issue("DC_SOH_INVALID", "DC stock is missing or non-numeric."));
    // DC and store snapshots are exported separately, so their dates may differ; only a missing date or a wide gap needs attention.
    if (!day) errors.push(issue("DC_DATE_INVALID", "DC stock date is missing or invalid."));
    else if (Math.abs(Date.parse(day) - Date.parse(asOf)) > dcGapDays * dayMs) notices.push(issue("DC_DATE_GAP", `DC stock date ${day} is more than ${dcGapDays} days from the store-stock as-of date ${asOf}; balance included.`));
    if (dcBalances.get(key(row.v.name, row.v.sku)).length !== 1) errors.push(issue("DUPLICATE_DC", "Repeated DC/SKU balance; not summed."));
    if (notices.length) { totals.warningRows++; warnings.push({ line: row.line, siteCode: "", rawName: clean(row.v.name), article: clean(row.v.sku), outcome: errors.length ? "blocked" : "included", errors: notices }); }
    if (errors.length) { totals.invalidDcRows++; exceptions.push({ line: row.line, kind: "dc", siteCode: "", article: clean(row.v.sku), rawName: clean(row.v.name), soh, errors }); }
    else { dcFacts.push({ line: row.line, siteCode: "", name: clean(row.v.name), article: clean(row.v.sku), asOf: day, soh }); totals.dcSOH += soh; }
  }
  for (const row of data.raw) {
    const v = row.v, siteCode = clean(v.code), rawName = String(v.name), article = clean(v.sku), soh = decimal(v.soh);
    const mapped = mapStore(siteCode, rawName, "code-name"), errors = [...mapped.errors], notices = [...mapped.warnings];
    const stockDate = sourceDate(v.day);
    if (!stockDate) errors.push(issue("DATE_INVALID", "Store stock date is missing or invalid."));
    if (dates.length > 1) notices.push(issue("STOCK_DATES", "Source contains multiple stock dates; each row retains its own source date."));
    if (!siteCode || !article || !clean(rawName)) errors.push(issue("IDENTIFIER_MISSING", "Store code, store name and SKU are required."));
    if (soh === null) { totals.unknownStoreSOHRows++; errors.push(issue("SOH_INVALID", "Store stock is missing or non-numeric.")); } else totals.sourceStoreSOH += soh;
    if (rawKeys.get(key(v.code, v.sku)).length !== 1) errors.push(issue("DUPLICATE_SOURCE", "Repeated store/SKU balance; review the raw stock export."));
    const matches = orig.get(norm(v.description)) || orig.get(norm(`CL${article} ${v.description}`)) || [];
    const product = unique(matches, r => r.v.slice(1, 8));
    if (!product) notices.push(issue("PRODUCT_MAPPING", "No unique PRODUCT_DESCR / ORIG match; unavailable product fields left blank."));
    if (!product && other.has(norm(article)) && !products.some(p => norm(p.v[4]) === norm(article))) errors.push(issue("CUSTOMER_MISMATCH", "SKU belongs to another customer; not relabelled."));
    const dcMatches = dcNames.get(norm(rawName)) || dcNames.get(norm(`${rawName} (${siteCode})`)) || dcCodes.get(norm(siteCode)) || [];
    const dc = unique(dcMatches, r => [r.v[0]]), balances = dc ? dcBalances.get(key(dc.v[0], article)) || [] : [];
    const balance = balances.length === 1 && dcFacts.find(r => r.line === balances[0].line), dcStock = balance ? balance.soh : 0;
    // Clicks outputs zero, not blank, when no DC balance matches (user request 2026-09-29); the warning keeps the gap visible.
    if (!balance) notices.push(issue("DC_MAPPING", "No unique supplying DC/SKU balance; Supplying DC SOH set to 0."));
    // Clicks outputs zero, not blank, when a store/SKU has no measured sales (user request 2026-09-29).
    const measured = salesKeys.get(key(siteCode, article)) || []; let units = 0;
    if (measured.length) {
      if (measured.some(r => decimal(r.v[6]) === null || saleDuplicates.get(key(sourceDate(r.v[0]), r.v[1], r.v[4])).length !== 1)) errors.push(issue("SALES_INVALID", "Non-numeric units or duplicate daily sales rows for this store/SKU."));
      else units = measured.reduce((sum, r) => sum + decimal(r.v[6]), 0);
    } else notices.push(issue("SALES_MAPPING", "No sales rows for this store/SKU in the supplied sales period; Sell Out P4 Weeks set to 0."));
    if (notices.length) { totals.warningRows++; warnings.push({ line: row.line, siteCode, rawName, article, outcome: errors.length ? "blocked" : "included", errors: notices }); }
    if (errors.length) { totals.exceptionRows++; totals.exceptionStoreSOH += soh || 0; exceptions.push({ line: row.line, kind: "store", siteCode, rawName, article, soh, errors }); continue; }
    totals.readyRows++; totals.validStoreSOH += soh;
    const articleDescription = clean(product?.v[5]) || clean(v.description);
    facts.push({ line: row.line, siteCode, article, rawName, asOf: stockDate, supplyingDC: clean(dc?.v[0]), soh, values: [stockDate, "CLICKS", mapped.region, siteCode, rawName, clean(product?.v[1]), clean(product?.v[2]), clean(product?.v[3]), clean(product?.v[4]) || article, articleDescription, articleDescription, dcStock, soh, units, articleStatus, customer, 0] });
    mapped.assignments.forEach(r => assignments.set(JSON.stringify(r), r));
  }
  const reconciled = totals.inputRows === totals.readyRows + totals.exceptionRows && Math.abs(totals.sourceStoreSOH - totals.validStoreSOH - totals.exceptionStoreSOH) < .001;
  if (!reconciled) throw new Error("Clicks inventory row/stock reconciliation failed.");
  saleDates.sort();
  return { version: engine.VERSION, kind: "Inventory", adapter: context.transformerVersion, mappingPolicy: "clicks-inventory-mappings-v1", outputPolicy: engine.RAW_SITE_NAME_POLICY, asOf, reportDate: asOf,
    rules: { dcDatePolicy: `DC stock needs a valid date; dates more than ${dcGapDays} days from the store as-of date are included with a DC_DATE_GAP warning.`, salesBasis: `Measured units from supplied sales export (${saleDates[0]} to ${saleDates.at(-1)}); no DROS estimate`, openPO: "zero-default", openPOBasis: "Clicks supplies no open-PO data; Open PO Qty is 0 on every row (user request 2026-09-29)", sellOutDefault: "Store/SKU pairs without measured sales show 0 Sell Out P4 Weeks", dcSOHDefault: "Store/SKU rows without a unique supplying DC/SKU balance show 0 Supplying DC SOH", articleStatus: articleStatus || "Not supplied; blank", ...(articleStatus ? { articleStatusBasis: "User-approved default: all Clicks lines assumed Active; no source status indicator" } : {}) },
    totals, reconciled, status: exceptions.length || !facts.length ? "review" : "ready", facts, exceptions, warnings, exclusions: [], dcFacts, assignments: [...assignments.values()], regionDecisions: [], referenceCellErrors: [], issueCounts: counts(exceptions), warningCounts: counts(warnings) };
}
module.exports = { read, transform };
