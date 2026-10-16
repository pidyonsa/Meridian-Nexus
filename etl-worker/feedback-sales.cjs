"use strict";
const { VERSION, clean, norm } = require("./engine.cjs"), { SALES_HEADERS } = require("./shared-layout.cjs");
const { readTable, readDelimited, decimal, sourceDate, monthNumber, monthNames, reportMonth } = require("./source-files.cjs");
const { key, index, unique, issue, counts, mapper, shoprite } = require("./feedback-mapping.cjs");
const adapters = new Set(["boxer-sales-v1", "game-sales-v1", "makro-sales-v1", "shoprite-universal-sales-v1", "shoprite-saldanha-sales-v1"]);
const supplier = "EKHAMANZI SPRINGS (PTY) LTD";
const fields = {
  "boxer-sales-v1": { code: "StoreID", name: "Store", category: "BoMM Category", brand: "Brand", description: "Description", size: "SizeDesc", units: "Units", value: "Sales", year: "Year", month: "Month", sku: "Item No" },
  "game-sales-v1": { day: ["LoadDate", "Loaded Date"], end: "EndDate", saleType: "SaleType", code: "PlantCode", name: "PlantName", country: "Country", vendor: "VendorName", sku: "MaterialCode", description: "MaterialDescription", category: "DepartmentDescription", units: "Quantity", value: ["ValueExcl", "Value"] },
  "makro-sales-v1": { day: "EndDate", code: "SiteCode", name: "SiteDescription", siteType: ["SiteType", "StoreType"], vendor: "VendorName", sku: ["ProductCode", "Article No"], description: ["ProductDescription", "Article"], uom: ["SalesUnit", "Sales UOM"], category: "CategoryDescription", units: "Quantity", value: "ValueExcl" }
};
async function read(buffer, context, name) {
  const adapter = context.transformerVersion;
  if (!adapters.has(adapter)) throw new Error("Unsupported feedback sales adapter.");
  if (fields[adapter]) {
    const options = { fields: fields[adapter], ...(adapter === "boxer-sales-v1" ? { sheets: ["Data"] } : {}) };
    return /\.(txt|csv)$/i.test(name) ? readDelimited(buffer, { ...options, name }) : readTable(buffer, options);
  }
  const saldanha = adapter === "shoprite-saldanha-sales-v1", month = reportMonth(context.reportMonth), monthLabel = `${monthNames[+month.slice(5) - 1].slice(0, 3)} ${month.slice(0, 4)} units`;
  return readTable(buffer, { sheets: [saldanha ? "Separate View" : "SC Report"], allowExternalLinks: true,
    fields: { name: saldanha ? "Site" : "Store", description: "Article", uom: ["Sales UOM", "Sell UOM"], sku: saldanha ? "Article Key" : "Article No", units: monthLabel, price: ["Sell Price (Incl)", "P"], category: "Category" },
    optional: {} });
}
async function readGln(buffer) {
  // A:G are the source mapping. H:L repeat lookup headings and include staff errors.
  return (await readTable(buffer, { sheets: ["GLN Report"], headerColumns: 7, allowExcelErrors: true, fields: {
    site: "Site (B2B Name)", name: "StoreName", code: "SITE ID", banner: "BANNER", region: "PROVINCE"
  } })).rows;
}
function transform(data, context) {
  const adapter = context.transformerVersion, month = reportMonth(context.reportMonth);
  if (!adapters.has(adapter)) throw new Error("Unsupported feedback sales adapter.");
  const saldanha = adapter === "shoprite-saldanha-sales-v1", isShoprite = adapter.startsWith("shoprite-"), game = adapter === "game-sales-v1", makro = adapter === "makro-sales-v1", boxer = adapter === "boxer-sales-v1";
  const expectedCustomer = isShoprite ? saldanha ? "SALDANHA" : "UNIVERSAL PAPER" : "AQUELLE";
  if (norm(context.customer) !== expectedCustomer) throw new Error("This source format is validated only for its configured customer.");
  const channel = isShoprite ? "SHOPRITE GROUP" : boxer ? "BOXER" : game ? "GAME" : "MAKRO", mapStore = mapper(data, channel);
  const glnSite = index(data.gln || [], r => norm(r.v.site)), glnName = index(data.gln || [], r => norm(r.v.name));
  if (isShoprite && !data.gln?.length) throw new Error("Select the shared GLN Master in Resources for Shoprite sales.");
  // Product List CLIENT may be entered as "UNIVERSAL" or "UNIVERSAL PAPER".
  const productClient = value => norm(value) === expectedCustomer || (expectedCustomer === "UNIVERSAL PAPER" && norm(value) === "UNIVERSAL");
  const productRows = (data.products || []).filter(r => productClient(r.v[7]) && shoprite(r.v[0]));
  const products = index(productRows, r => norm(r.v[8]));
  const productsByArticle = index(productRows, r => norm(r.v[4]).replace(/^0+/, ""));
  const productsByDescription = index(productRows, r => norm(r.v[5]));
  const totals = { inputRows: data.raw.length, storeRows: data.raw.length, readyRows: 0, exceptionRows: 0, outputRows: 0, dcRows: 0, invalidDcRows: 0, warningRows: 0, excludedRows: 0,
    sourceUnits: 0, validUnits: 0, exceptionUnits: 0, excludedUnits: 0, sourceValue: 0, validValue: 0, exceptionValue: 0, excludedValue: 0, unknownUnitsRows: 0, unknownValueRows: 0 };
  const exceptions = [], warnings = [], exclusions = [], groups = new Map(), assignments = new Map();
  const identity = r => r.identity || key(...Object.values(r.v));
  const duplicates = index(data.raw.filter(r => !r.total), identity);
  let periodRows = 0;
  for (const row of data.raw) {
    const v = row.v, rawName = String(v.name ?? ""), article = clean(v.sku), errors = [], notices = [];
    if (row.total && !clean(v.name) && !article) { totals.excludedRows++; exclusions.push({ line: row.line, source: row.source, siteCode: "", rawName: "Total", article: "", units: 0, value: 0, reason: "Report subtotal excluded; not a source transaction." }); continue; }
    const year = Number(v.year), mn = monthNumber(v.month), sourceDay = isShoprite ? null : boxer ? Number.isInteger(year) && mn ? `${year}-${String(mn).padStart(2, "0")}-01` : null : sourceDate(v.day);
    const hasSourceDate = boxer ? clean(v.year) !== "" || clean(v.month) !== "" : !isShoprite && clean(v.day) !== "";
    const day = sourceDay || (!hasSourceDate ? month + "-01" : null);
    const outputMonth = day?.slice(0, 7) || month;
    const units = decimal(v.units), price = decimal(v.price), value = isShoprite ? units === 0 ? 0 : units !== null && price !== null ? units * price / 1.15 : null : decimal(v.value);
    if (units === null) { totals.unknownUnitsRows++; errors.push(issue("UNITS_INVALID", "Units are missing or non-numeric.")); } else totals.sourceUnits += units;
    if (value === null) { totals.unknownValueRows++; errors.push(issue("VALUE_INVALID", isShoprite ? "A non-zero sales quantity needs a numeric inclusive selling price." : "Sales value is missing or non-numeric.")); } else totals.sourceValue += value;
    if (!day) errors.push(issue("DATE_INVALID", "Source month/date is invalid; the selected reporting month is only used when the source date is blank."));
    periodRows++;
    let reason = "";
    if (game && norm(v.country) !== "ZA") reason = "Non-ZA Game store excluded.";
    if (game && norm(v.vendor) !== supplier) reason = "Other supplier excluded from aQuelle output.";
    if (makro && norm(v.siteType) !== "MAIN") reason = "Non-MAIN Makro site excluded.";
    if (makro && norm(v.vendor) !== supplier) reason = "Other supplier excluded from aQuelle output.";
    if (isShoprite && /CHECKERS FOODS SERVICES|USAVE BOX/.test(norm(rawName))) reason = "Excluded Shoprite banner per feedback.";
    if (reason) { totals.excludedRows++; totals.excludedUnits += units || 0; totals.excludedValue += value || 0; exclusions.push({ line: row.line, source: row.source, siteCode: clean(v.code), article, rawName, units, value, reason }); continue; }
    if (!clean(rawName) || !article) errors.push(issue("IDENTIFIER_MISSING", "Source store name and product identifier are required."));
    if (duplicates.get(identity(row))?.length !== 1) errors.push(issue("DUPLICATE_SOURCE", "Identical source records occur more than once; resolve overlapping exports before approval."));
    let siteCode = clean(v.code), storeName = makro ? clean(rawName.replace(/Main Store/ig, "")) : rawName, banner = channel, region = "", product = clean(v.description), brand = "", category = clean(v.category), mapped;
    if (isShoprite) {
      const matches = (saldanha ? glnSite : glnName).get(norm(rawName)) || [], gln = unique(matches, r => [r.v.code, r.v.banner, r.v.region]);
      if (matches.length && !gln) errors.push(issue("GLN_MAPPING", "More than one distinct GLN mapping matches this source store."));
      else if (!gln) notices.push(issue("GLN_MAPPING", "No GLN match; store ID/banner and GLN region left blank."));
      siteCode = clean(gln?.v.code); banner = clean(gln?.v.banner);
      mapped = mapStore(siteCode, rawName, "name"); region = saldanha ? clean(gln?.v.region) : mapped.region;
      product = `${clean(v.description)} ${clean(v.uom)}`.trim();
      if (saldanha) { brand = "SALDANHA"; category = "CANNED FISH"; }
      else {
        category = category.replace(/-\s*\d+\s*$/, "").trim();
        // ORIG holds the Shoprite article description (no UOM); Article and Article Description are fallbacks.
        const description = norm(v.description), candidates = products.get(description) || products.get(norm(product)) || productsByArticle.get(norm(article).replace(/^0+/, "")) || productsByDescription.get(description) || [];
        brand = clean(unique(candidates, r => [r.v[2]])?.v[2]);
        if (!brand) notices.push(issue("PRODUCT_MAPPING", candidates.length ? "Product List rows for this article disagree on Brand; left blank." : "No Product List ORIG, Article or Article Description match for Brand; left blank."));
      }
      if (/CHECKERS FOODS SERVICES|USAVE BOX/.test(norm(banner))) { totals.excludedRows++; totals.excludedUnits += units || 0; totals.excludedValue += value || 0; exclusions.push({ line: row.line, siteCode, article, rawName, units, value, reason: "Excluded GLN banner per feedback." }); continue; }
    } else {
      mapped = mapStore(siteCode, rawName, boxer ? "pair" : game ? "name" : "code"); region = mapped.region;
      brand = boxer ? (["", "UNKNOWN"].includes(norm(v.brand)) ? "AQUELLE" : clean(v.brand)) : norm(v.description).includes("VIV") ? "VIV" : "AQUELLE";
      product = boxer ? `${clean(v.description)} ${clean(v.size)}`.trim() : makro ? `${clean(v.description)} ${clean(v.uom)}`.trim() : clean(v.description);
    }
    // These joins enrich region/staff only; source identity and GLN keys remain unchanged.
    if (!saldanha) notices.push(...mapped.errors.map(e => issue("REGION_MAPPING", e.detail + " Region left blank.")));
    notices.push(...mapped.warnings.filter(e => !saldanha || e.code !== "REGION_MAPPING"));
    if (saldanha && !region) notices.push(issue("REGION_MAPPING", "No GLN province for this source site; left blank."));
    if (notices.length) { totals.warningRows++; warnings.push({ line: row.line, source: row.source, siteCode, article, rawName, outcome: errors.length ? "blocked" : "included", errors: notices }); }
    if (errors.length) { totals.exceptionRows++; totals.exceptionUnits += units || 0; totals.exceptionValue += value || 0; exceptions.push({ line: row.line, source: row.source, kind: "sales", siteCode, rawName, article, units, value, errors }); continue; }
    totals.readyRows++; totals.validUnits += units; totals.validValue += value;
    const values = [outputMonth + "-01", saldanha ? "UNIVERSAL PAPER" : expectedCustomer, channel, banner, siteCode, storeName, "", "", region, "", "", "", "", category, brand, product, 0, 0, null, mapped.assignments.length ? "YES" : "NO"];
    const id = key(...values.slice(0, 16), article);
    if (!groups.has(id)) groups.set(id, { line: row.line, source: row.source, siteCode, article, rawName, sourceRows: 0, values });
    const fact = groups.get(id); fact.values[16] += units; fact.values[17] += value; fact.sourceRows++;
    mapped.assignments.forEach(r => assignments.set(JSON.stringify(r), r));
  }
  if (!periodRows) throw new Error("No source records were available for transformation.");
  const facts = [...groups.values()]; totals.outputRows = facts.length;
  const eq = (a, b) => Math.abs(a - b) <= Math.max(.001, Math.abs(a) * 1e-10);
  const reconciled = totals.inputRows === totals.readyRows + totals.exceptionRows + totals.excludedRows && eq(totals.sourceUnits, totals.validUnits + totals.exceptionUnits + totals.excludedUnits) && eq(totals.sourceValue, totals.validValue + totals.exceptionValue + totals.excludedValue)
    && eq(totals.validUnits, facts.reduce((s, f) => s + f.values[16], 0)) && eq(totals.validValue, facts.reduce((s, f) => s + f.values[17], 0));
  if (!reconciled) throw new Error("Sales row/unit/value reconciliation failed.");
  return { version: VERSION, kind: "Sales", customer: context.customer, adapter, mappingPolicy: "feedback-sales-mappings-v2", outputPolicy: "shared-sample-layout-v1", headers: SALES_HEADERS, asOf: month + "-01", reportDate: month + "-01", periodStart: month + "-01", periodEnd: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).toISOString().slice(0, 10),
    rules: { reportingMonth: month, reportingDatePolicy: "Use the valid source row date; use the selected reporting month only when that source date is blank.", salesBasis: isShoprite ? "Selected month units x inclusive selling price / 1.15" : "Measured source units and value; decimal points/commas parsed numerically", ...(game || makro ? { supplier: supplier, sourceScope: game ? "ZA; distinct sale types retained" : "MAIN sites only", skuBasis: game ? "MaterialDescription" : "ProductDescription + SalesUnit" } : {}), ...(saldanha ? { sourceCustomer: "SALDANHA", outputClient: "UNIVERSAL PAPER", clientLabelApproval: "User confirmed 2026-09-25" } : {}) },
    totals, reconciled, status: exceptions.length || !facts.length ? "review" : "ready", facts, exceptions, warnings, exclusions, dcFacts: [], assignments: [...assignments.values()], regionDecisions: [], referenceCellErrors: (data.gln || []).flatMap(r => r.cellErrors || []), issueCounts: counts(exceptions), warningCounts: counts(warnings) };
}
module.exports = { adapters, fields, read, readGln, transform };
