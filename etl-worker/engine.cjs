"use strict";

const ExcelJS = require("exceljs");
const yauzl = require("yauzl");
const crypto = require("node:crypto");
const VERSION = "anchor-pnp-v1";
const MAPPING_POLICY = "pnp-exact-store-first-region-20260924";
const ACCEPTED_MAPPING_POLICY = "pnp-nonblocking-mappings-no-liquor-20260924";
const LEGACY_OUTPUT_POLICY = "pnp-master-site-name-v1";
const RAW_SITE_NAME_POLICY = "pnp-raw-site-name-v1";
const HEADERS = ["Week Ending", "Banner ", "Region", "Site Code ", "Site Name", "Barcode ", "Brand ", "Category ", "Article", "Article Description", "Article Description P&G PL", "Supplying DC SOH", "Store SOH ", "Sell Out P4 Weeks  ", " Article Status ", "CLIENT", "Open PO Qty"];
const SCHEMAS = {
  raw: ["Sheet1", ["Week Ending Date", "Site Code", "Site Description", "Site Profile", "Article Number", "Article description", "Vendor Number", "Site Article Status", "Listing Status", "RP (MRP) Type", "SOH Qty", "DROS Qty", "Days Cover", "Source Of Supply", "Date Last Received", "Date Last Sold", "Last Ordered Date"]],
  products: ["Product List", ["Banner", "Barcode", "Brand", "Category", "Article", "Article Description", "Article Description P&G PL", "CLIENT", "ORIG", "Serviceability"]],
  stores: ["Sheet1", ["Banner", "Store ID", "Store Name", "Cleaned Banner", "Cleaned Store Code", "Cleaned Store NAME", "Cleaned Banner"]],
  staffing: ["Sheet1", ["STORE CODE", "STORE NAME", "GEO REP STORE CODE", "BANNER", "ACTIVE", "DIVISION", "CHANNEL", "REGION", "RESOURCE EMP ID", "RESOURCE NAME", "RESOURCE TYPE", "EMAIL", "CALLING FREQUENCY", "MANAGER EMP CODE", "LINE MANAGER"]],
  dc: ["Sheet1", ["DC", "PROVINCE", "STORE ID", "STORE", "Portal"]],
  status: ["PNP STATUS", ["Code", "Description", "Cleaned Description"]]
};
const clean = value => String(value ?? "").trim().replace(/\s+/g, " ");
const norm = value => clean(value).toUpperCase();
const pnp = value => /^(PNP(?:\s|$)|PICK\s*(?:N|AND|&)\s*PAY(?:\s|$))/.test(norm(value));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const identifier = value => clean(value);
const number = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
function date(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  const input = clean(value);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
function rules(input) {
  if (![28, 30].includes(input?.salesDays)) throw new Error("Choose a 28-day or 30-day DROS estimate. Actual sales are not supplied by this adapter.");
  if (!["unknown", "zero-default"].includes(input.openPO)) throw new Error("Choose the missing open-PO convention.");
  if (!["D", "G"].includes(input.bannerColumn)) throw new Error("Choose the canonical banner column, D or G.");
  if (!["as-of", "exported"].includes(input.reportDate)) throw new Error("Choose inventory as-of or filename export date for Week Ending.");
  if (input.productFamily !== "PICK N PAY CORPORATE" || input.confirmed !== true) throw new Error("Confirm the PnP product-family alias and processing rules.");
  return { salesDays: input.salesDays, openPO: input.openPO, bannerColumn: input.bannerColumn, reportDate: input.reportDate, productFamily: input.productFamily, confirmed: true };
}

// Inspect ZIP metadata before ExcelJS allocates decompressed XML. Never execute workbook content.
async function inspectZip(buffer, { allowExternalLinks = false } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 25 * 1024 * 1024) throw new Error("Workbooks must be between 1 byte and 25 MB.");
  await new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(new Error("The file is not a valid XLSX workbook."));
    let expanded = 0; let actualBytes = 0; let entries = 0; let failed = false;
    const fail = message => { if (failed) return; failed = true; zip.close(); reject(new Error(message)); };
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", entry => {
      expanded += entry.uncompressedSize;
      if (++entries > 5000 || expanded > 160 * 1024 * 1024 || entry.uncompressedSize > 100 * 1024 * 1024) return fail("Workbook exceeds the safe decompression limit.");
      if (/vbaProject|connections\.xml|embeddings\//i.test(entry.fileName) || (!allowExternalLinks && /externalLinks\//i.test(entry.fileName)) || entry.generalPurposeBitFlag & 1) return fail("Macros, external connections, embedded objects and encrypted workbooks are not supported.");
      if (/\/$/.test(entry.fileName)) return zip.readEntry();
      zip.openReadStream(entry, (error, stream) => {
        if (error) return fail("Unable to validate compressed workbook content.");
        let seen = 0;
        stream.on("data", chunk => {
          seen += chunk.length; actualBytes += chunk.length;
          if (seen > entry.uncompressedSize || actualBytes > 160 * 1024 * 1024) { stream.destroy(); fail("Workbook exceeds its declared decompression size."); }
        });
        stream.on("error", () => fail("Workbook contains corrupt or misdeclared compressed content."));
        stream.on("end", () => { if (!failed) zip.readEntry(); });
      });
    });
    zip.readEntry();
  }));
}
async function readWorkbook(buffer, role) {
  await inspectZip(buffer);
  const schema = SCHEMAS[role];
  if (!schema) throw new Error("Unsupported reference role.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const candidates = role === "staffing"
    ? workbook.worksheets.filter(sheet => ["SHEET1", "CALL CYCLE MASTER"].includes(norm(sheet.name)))
    : workbook.worksheets.filter(sheet => sheet.name === schema[0]);
  if (candidates.length > 1) throw new Error(`${role}: multiple candidate master sheets. Keep one approved call-cycle sheet.`);
  const sheet = candidates[0];
  if (!sheet) throw new Error(`${role}: missing sheet ${role === "staffing" ? "Sheet1 or Call Cycle Master" : schema[0]}.`);
  if (sheet.rowCount > (role === "raw" ? 25001 : 100001) || sheet.columnCount > 100) throw new Error(`${role}: workbook exceeds the supported row/column limits.`);
  schema[1].forEach((header, i) => {
    if (norm(sheet.getRow(1).getCell(i + 1).text) !== norm(header)) throw new Error(`${role}: column ${i + 1} must be ${header}.`);
  });
  const rows = [];
  sheet.eachRow((row, line) => {
    if (line === 1) return;
    const cellErrors = [];
    const values = schema[1].map((_, i) => {
      const cell = row.getCell(i + 1); const value = cell.value;
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if (value.formula || value.sharedFormula || value.hyperlink) throw new Error(`${role}: row ${line} contains a formula or hyperlink. Upload a values-only reference.`);
        if (value.error) { cellErrors.push({ column: i + 1, error: String(value.error) }); return ""; }
        if (value.richText) return value.richText.map(part => part.text).join("");
        throw new Error(`${role}: row ${line} contains an unsupported cell value.`);
      }
      // Excel's displayed zero-padding is material to status codes and identifiers.
      if (typeof value === "number" && /^0+$/.test(cell.numFmt || "")) return String(value).padStart(cell.numFmt.length, "0");
      return value ?? "";
    });
    if (values.some(v => v !== "")) rows.push({ line, v: values, ...(cellErrors.length ? { cellErrors } : {}) });
  });
  if (!rows.length) throw new Error(`${role}: the selected sheet contains no data rows.`);
  return rows;
}
function index(rows, key) {
  const map = new Map();
  for (const row of rows) { const id = key(row); if (!map.has(id)) map.set(id, []); map.get(id).push(row); }
  return map;
}
function unique(rows, projection) {
  const values = new Map(rows.map(row => [JSON.stringify(projection(row).map(norm)), row]));
  return values.size === 1 ? [...values.values()][0] : null;
}
const storeKey = (code, name) => JSON.stringify([norm(code), norm(name)]);
function storeCandidates(rows, bannerIndex) {
  // Repeated aliases must not hide a different canonical store in the preview.
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.v[4], row.v[5], row.v[bannerIndex]].map(norm));
    if (!groups.has(key)) groups.set(key, { role: "stores", line: row.line,
      canonicalCode: clean(row.v[4]), canonicalName: clean(row.v[5]), banner: clean(row.v[bannerIndex]),
      aliasCount: 0, sourceRows: [], sourceNames: [] });
    const candidate = groups.get(key); candidate.aliasCount++;
    if (candidate.sourceRows.length < 12) candidate.sourceRows.push(row.line);
    const name = clean(row.v[2]);
    if (candidate.sourceNames.length < 5 && !candidate.sourceNames.some(value => norm(value) === norm(name))) candidate.sourceNames.push(name);
  }
  return [...groups.values()];
}
function exported(name) {
  const m = /^PnPSiteDaysCover_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[\s._(-]|$)/i.exec(name || "");
  if (!m || !date(`${m[1]}-${m[2]}-${m[3]}`) || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+02:00`;
}
function transform(data, options, sourceName, mappingPolicy = MAPPING_POLICY, outputPolicy = LEGACY_OUTPUT_POLICY, context = null) {
  if (![MAPPING_POLICY, ACCEPTED_MAPPING_POLICY].includes(mappingPolicy)) throw new Error("Unsupported mapping policy.");
  if (![LEGACY_OUTPUT_POLICY, RAW_SITE_NAME_POLICY].includes(outputPolicy)) throw new Error("Unsupported output policy.");
  const acceptedMappings = mappingPolicy === ACCEPTED_MAPPING_POLICY;
  const liquor = value => /\bLIQUOR\b/.test(norm(value));
  const liquorAlias = row => [0, 2, 3, 5, 6].some(i => liquor(row.v[i]));
  const config = rules(options);
  const exportedAt = exported(sourceName);
  if (config.reportDate === "exported" && !exportedAt) throw new Error("The source filename does not contain a valid PnP export timestamp.");
  const dates = [...new Set(data.raw.map(row => date(row.v[0])))];
  if (dates.length !== 1 || !dates[0]) throw new Error("All input rows must have one valid inventory as-of date.");
  const asOf = dates[0];
  const reportDate = config.reportDate === "exported" ? exportedAt.slice(0, 10) : asOf;
  const customer = context ? norm(context.customer) : "ANCHOR";
  if (!customer || customer.length > 100) throw new Error("Select a valid customer.");
  const customerProducts = data.products.filter(r => norm(r.v[7]) === customer && norm(r.v[0]) === config.productFamily);
  const products = index(customerProducts, r => norm(r.v[4]));
  const otherProducts = index(data.products.filter(r => norm(r.v[7]) !== customer && norm(r.v[0]) === config.productFamily), r => norm(r.v[4]));
  if (context && !data.raw.some(r => products.has(norm(r.v[4])))) throw new Error(`The raw articles do not match ${customer} in the shared Product List. Check the selected customer and raw file.`);
  const storeRows = data.stores.filter(r => pnp(r.v[0]));
  const stores = index(storeRows, r => norm(r.v[1]));
  const storesByKey = index(storeRows, r => storeKey(r.v[1], r.v[2]));
  const staff = index(data.staffing.filter(r => pnp(r.v[3]) && !/^(NO|N|FALSE|0|INACTIVE)$/.test(norm(r.v[4]))), r => storeKey(r.v[0], r.v[1]));
  const dcMap = index(data.dc.filter(r => pnp(r.v[4])), r => norm(r.v[2]));
  const status = index(data.status, r => norm(r.v[0]).padStart(2, "0"));
  const dcRows = data.raw.filter(r => norm(r.v[3]) === "DISTRIBUTION CENTER");
  const dcByName = index(dcRows, r => `${norm(r.v[2])}|${norm(r.v[4])}`);
  const dcByCode = index(dcRows, r => `${norm(r.v[1])}|${norm(r.v[4])}`);
  const rawKeys = index(data.raw, r => `${norm(r.v[1])}|${norm(r.v[4])}`);
  const facts = []; const exceptions = []; const dcFacts = []; const assignments = new Map();
  const warnings = []; const exclusions = [];
  const regionDecisions = new Map();
  const totals = { inputRows: data.raw.length, storeRows: 0, dcRows: dcRows.length, readyRows: 0, exceptionRows: 0, invalidDcRows: 0, sourceStoreSOH: 0, validStoreSOH: 0, exceptionStoreSOH: 0, unknownStoreSOHRows: 0, dcSOH: 0 };
  Object.assign(totals, { warningRows: 0, excludedRows: 0, excludedStoreSOH: 0 });
  for (const row of data.raw) {
    const v = row.v; const siteCode = identifier(v[1]); const article = identifier(v[4]); const soh = number(v[10]);
    const errors = []; const rowWarnings = [];
    const add = (code, detail, references = [], permitted = false) => {
      const nonblocking = acceptedMappings && (permitted || ["DC_MAPPING", "PRODUCT_MAPPING", "REGION_MAPPING"].includes(code));
      (nonblocking ? rowWarnings : errors).push({ code, detail, ...(references.length ? { references: references.slice(0, 12), referenceCount: references.length } : {}) });
    };
    if (!siteCode || !article) add("IDENTIFIER_MISSING", "Site code and article are required.");
    if (context && !products.has(norm(article)) && otherProducts.has(norm(article))) add("CUSTOMER_MISMATCH", "Article belongs to a different customer in the shared Product List. It has not been relabelled.");
    if ((rawKeys.get(`${norm(siteCode)}|${norm(article)}`) || []).length !== 1) add("DUPLICATE_SOURCE", "Duplicate site/article rows must be resolved in the source.");
    if (soh === null) add("SOH_INVALID", "SOH Qty is missing or non-numeric; it was not replaced by zero.");
    if (norm(v[3]) === "DISTRIBUTION CENTER") {
      if (errors.length) { totals.invalidDcRows++; exceptions.push({ line: row.line, kind: "dc", siteCode, article, rawName: clean(v[2]), soh, errors }); }
      else { dcFacts.push({ line: row.line, siteCode, name: clean(v[2]), article, asOf, soh }); totals.dcSOH += soh; }
      continue;
    }
    totals.storeRows++;
    if (soh === null) totals.unknownStoreSOHRows++; else totals.sourceStoreSOH += soh;
    if (!["CORPORATE STORE", "FRANCHISEE STORE"].includes(norm(v[3]))) add("PROFILE_UNKNOWN", `Unsupported site profile: ${clean(v[3])}`);
    let aliases = stores.get(norm(siteCode)) || [];
    const exactNames = storesByKey.get(storeKey(siteCode, v[2])) || [];
    if (exactNames.length) aliases = exactNames;
    // Resolve the raw identity before filtering: a liquor row must never become
    // the supermarket that happens to share its retailer code.
    const excludedLiquor = acceptedMappings && (liquor(v[2]) || (exactNames.length > 0 && exactNames.every(liquorAlias)));
    if (acceptedMappings) aliases = aliases.filter(r => !liquorAlias(r));
    const bannerIndex = config.bannerColumn === "D" ? 3 : 6;
    const store = unique(aliases, r => [r.v[4], r.v[5], r.v[bannerIndex]]);
    const storeValid = Boolean(store && clean(store.v[4]) && clean(store.v[5]) && pnp(store.v[bannerIndex]));
    if (!excludedLiquor && !storeValid) add("STORE_MAPPING", !aliases.length ? "No PnP site-code alias in the store clean-up master."
      : !store ? `Multiple canonical stores match ${exactNames.length ? "site code and source name" : "site code"}. ${acceptedMappings ? "Pick n Pay Liquor candidates excluded" : "Liquor stores remain eligible"}; review the distinct candidates. Region validation is deferred until the store is resolved.`
      : "The canonical store ID, name or selected banner is incomplete or invalid. Region validation is deferred until the store is resolved.", storeCandidates(aliases, bannerIndex), !aliases.length);
    let candidates = products.get(norm(article)) || [];
    const exactProducts = candidates.filter(r => norm(r.v[8]) === norm(v[5]));
    if (exactProducts.length) candidates = exactProducts;
    const product = unique(candidates, r => r.v.slice(1, 8));
    if (!product || product.v.slice(1, 8).some(value => !clean(value))) add("PRODUCT_MAPPING", candidates.length ? "Conflicting or incomplete product attributes. Resolve article/ORIG aliases in Product List." : `Article is not in the ${customer}/PnP product family.`, candidates.map(r => ({ role: "products", line: r.line, barcode: clean(r.v[1]), description: clean(r.v[5]), sourceAlias: clean(r.v[8]) })));
    const statusRow = unique(status.get(norm(v[7]).padStart(2, "0")) || [], r => [r.v[2]]);
    if (!excludedLiquor && (!statusRow || !clean(statusRow.v[2]))) add("STATUS_MAPPING", `No unique status mapping for ${clean(v[7])}.`);
    const staffing = storeValid ? staff.get(storeKey(store.v[4], store.v[5])) || [] : [];
    const regions = [...new Set(staffing.map(r => norm(r.v[7])).filter(Boolean))];
    const selectedRegion = norm(staffing[0]?.v[7]);
    if (storeValid && !selectedRegion) add("REGION_MAPPING", "No region on the first active exact store-code/name match in the master.", staffing.map(r => ({ role: "staffing", line: r.line, canonicalCode: clean(r.v[0]), canonicalName: clean(r.v[1]), region: clean(r.v[7]) })));
    if (storeValid && selectedRegion && regions.length > 1) regionDecisions.set(storeKey(store.v[4], store.v[5]), {
      canonicalCode: clean(store.v[4]), canonicalName: clean(store.v[5]), region: selectedRegion,
      sourceLine: staffing[0].line, otherRegions: regions.filter(region => region !== selectedRegion), policy: mappingPolicy
    });
    const dc = unique(dcMap.get(norm(siteCode)) || [], r => [r.v[0]]);
    let dcStock = null;
    if (dc) {
      const key = `${norm(dc.v[0])}|${norm(article)}`;
      const matches = dcByName.get(key) || dcByCode.get(key) || [];
      if (matches.length === 1 && number(matches[0].v[10]) !== null && (rawKeys.get(`${norm(matches[0].v[1])}|${norm(article)}`) || []).length === 1) dcStock = number(matches[0].v[10]);
    }
    if (dcStock === null) add("DC_MAPPING", "No unique store-to-DC and DC/article balance. A missing DC balance is not zero.");
    const dros = number(v[11]);
    if (dros === null || dros < 0) add("DROS_INVALID", "DROS Qty must be a non-negative number.");
    if (excludedLiquor && !errors.length) {
      exclusions.push({ line: row.line, siteCode, article, rawName: clean(v[2]), soh, reason: "Pick n Pay Liquor excluded by approved policy." });
      totals.excludedRows++; totals.excludedStoreSOH += soh;
      continue;
    }
    if (rowWarnings.length) {
      warnings.push({ line: row.line, siteCode, article, rawName: clean(v[2]), soh, outcome: errors.length ? "blocked" : "included", errors: rowWarnings });
      totals.warningRows++;
    }
    if (errors.length) {
      totals.exceptionRows++;
      if (soh !== null) totals.exceptionStoreSOH += soh;
      exceptions.push({ line: row.line, kind: "store", siteCode, article, rawName: clean(v[2]), canonicalName: store ? clean(store.v[5]) : "", soh, errors });
      continue;
    }
    const siteName = outputPolicy === RAW_SITE_NAME_POLICY ? String(v[2] ?? "") : clean(store?.v[5]) || clean(v[2]);
    const fact = { line: row.line, siteCode, article, asOf, canonicalCode: identifier(store?.v[4]), canonicalName: clean(store?.v[5]), rawName: clean(v[2]), supplyingDC: clean(dc?.v[0]), soh, salesBasis: `DROS x ${config.salesDays} estimate`, openPOBasis: config.openPO, values: [reportDate, clean(store?.v[bannerIndex]), selectedRegion, siteCode, siteName, identifier(product?.v[1]), clean(product?.v[2]), clean(product?.v[3]), article, clean(product?.v[5]) || clean(v[5]), clean(product?.v[6]), dcStock, soh, round(dros * config.salesDays), clean(statusRow.v[2]), customer, config.openPO === "zero-default" ? 0 : null] };
    facts.push(fact); totals.readyRows++; totals.validStoreSOH += soh;
    for (const person of staffing) {
      const record = { siteCode, canonicalName: fact.canonicalName, employeeId: identifier(person.v[8]), name: clean(person.v[9]), role: clean(person.v[10]), managerCode: identifier(person.v[13]), manager: clean(person.v[14]) };
      assignments.set(JSON.stringify(record), record);
    }
  }
  for (const key of ["sourceStoreSOH", "validStoreSOH", "exceptionStoreSOH", "excludedStoreSOH", "dcSOH"]) totals[key] = round(totals[key]);
  const codes = {};
  for (const exception of exceptions) for (const issue of exception.errors) codes[issue.code] = (codes[issue.code] || 0) + 1;
  const warningCounts = {};
  for (const row of warnings) for (const issue of row.errors) warningCounts[issue.code] = (warningCounts[issue.code] || 0) + 1;
  const reconciled = totals.inputRows === totals.storeRows + totals.dcRows && totals.storeRows === totals.readyRows + totals.exceptionRows + totals.excludedRows && Math.abs(totals.sourceStoreSOH - totals.validStoreSOH - totals.exceptionStoreSOH - totals.excludedStoreSOH) < 0.001;
  if (!reconciled) throw new Error("Internal reconciliation failed. No output may be approved.");
  const referenceCellErrors = Object.keys(SCHEMAS).flatMap(role => data[role].flatMap(row => (row.cellErrors || []).map(error => ({ role, line: row.line, ...error }))));
  return { version: VERSION, mappingPolicy, outputPolicy, regionDecisions: [...regionDecisions.values()], asOf, exportedAt, reportDate, rules: config, totals, issueCounts: codes, warningCounts, warnings, exclusions, referenceCellErrors, reconciled, status: exceptions.length || !facts.length ? "review" : "ready", facts, exceptions, dcFacts, assignments: [...assignments.values()] };
}
async function readTemplate(buffer) {
  await inspectZip(buffer);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Template");
  if (workbook.worksheets.length !== 1 || !sheet || sheet.columnCount > HEADERS.length || sheet.rowCount > 2 || sheet.model.merges?.length || sheet.getTables().length) throw new Error("Use a blank inventory template with one Template sheet, 17 columns and no merged cells or tables.");
  HEADERS.forEach((header, index) => {
    if (typeof sheet.getRow(1).getCell(index + 1).value !== "string" || norm(sheet.getRow(1).getCell(index + 1).value) !== norm(header)) throw new Error(`Inventory template column ${index + 1} must be ${header.trim()}.`);
  });
  sheet.getRow(2).eachCell(cell => { if (cell.value !== null && cell.value !== "") throw new Error("The inventory template must not contain data or formulas below its header."); });
  return workbook;
}

async function exportWorkbook(result, provenance = {}, savedTemplate = null) {
  const wb = new ExcelJS.Workbook(); wb.creator = "Meridian Nexus";
  function sheet(name, headers, rows) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(headers);
    for (const row of rows) ws.addRow(row.map(value => typeof value === "string" ? value.slice(0, 32000) : value));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3558" } };
    ws.columns.forEach(column => { column.width = 24; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: headers.length } };
    return ws;
  }
  const template = sheet("Template", HEADERS, result.facts.map(f => f.values.map((value, i) => i === 0 ? new Date(`${value}T00:00:00Z`) : value)));
  if (savedTemplate) {
    const saved = savedTemplate.getWorksheet("Template");
    template.getRow(1).values = saved.getRow(1).values;
    template.getRow(1).height = saved.getRow(1).height;
    template.views = saved.views?.length ? structuredClone(saved.views) : template.views;
    template.pageSetup = structuredClone(saved.pageSetup);
    for (let column = 1; column <= HEADERS.length; column++) {
      const source = saved.getColumn(column);
      template.getColumn(column).width = source.width || 24;
      template.getRow(1).getCell(column).style = structuredClone(saved.getRow(1).getCell(column).style);
      const style = { ...source.style, ...saved.getRow(2).getCell(column).style };
      for (let row = 2; row <= template.rowCount; row++) template.getRow(row).getCell(column).style = structuredClone(style);
    }
  }
  template.getColumn(1).numFmt = "yyyy-mm-dd";
  for (const column of [4, 6, 9]) template.getColumn(column).numFmt = "@";
  sheet("Exceptions", ["Source row", "Type", "Site Code", "Article", "Source name", "Canonical name", "Store SOH", "Issue", "Details", "Reference candidates", "Source key (code + name)", "Candidate count"], result.exceptions.flatMap(r => r.errors.map(e => [r.line, r.kind, r.siteCode, r.article, r.rawName, r.canonicalName || "", r.soh, e.code, e.detail, e.references ? JSON.stringify(e.references) : "", storeKey(r.siteCode, r.rawName), e.referenceCount || 0])));
  if ([ACCEPTED_MAPPING_POLICY, "clicks-inventory-mappings-v1"].includes(result.mappingPolicy)) {
    sheet("Accepted Warnings", ["Source row", "Site Code", "Article", "Source name", "Store SOH", "Outcome", "Issue", "Details", "Reference candidates"], result.warnings.flatMap(r => r.errors.map(e => [r.line, r.siteCode, r.article, r.rawName, r.soh, r.outcome, e.code, e.detail, JSON.stringify(e.references || [])])));
    sheet("Excluded Stores", ["Source row", "Site Code", "Article", "Source name", "Store SOH", "Reason"], result.exclusions.map(r => [r.line, r.siteCode, r.article, r.rawName, r.soh, r.reason]));
  }
  sheet("DC Inventory", ["Source row", "DC code", "DC name", "Article", "As of", "SOH"], result.dcFacts.map(r => [r.line, r.siteCode, r.name, r.article, r.asOf, r.soh]));
  sheet("Store Assignments", ["Site Code", "Canonical store", "Employee ID", "Resource", "Role", "Manager ID", "Manager"], result.assignments.map(r => [r.siteCode, r.canonicalName, r.employeeId, r.name, r.role, r.managerCode, r.manager]));
  if (result.referenceCellErrors.length) sheet("Reference Errors", ["Role", "Source row", "Column", "Excel error"], result.referenceCellErrors.map(r => [r.role, r.line, r.column, r.error]));
  sheet("Mapping Policy", ["Policy", "Store Code", "Store Name", "Selected Region", "First Master Row", "Other Regions"], [
    [result.mappingPolicy, "", "", "First active exact code/name match; all staff assignments retained", "", ""],
    [result.outputPolicy || LEGACY_OUTPUT_POLICY, "", "", result.outputPolicy === RAW_SITE_NAME_POLICY ? "Template Site Name uses raw Site Description; canonical store mapping retained separately" : "Template Site Name uses canonical store name when available", "", ""],
    ...(result.mappingPolicy === ACCEPTED_MAPPING_POLICY ? [[result.mappingPolicy, "", "", "DC, product, region and missing site-alias mappings are non-blocking; unavailable mapped values remain blank. All Pick n Pay Liquor excluded.", "", ""]] : []),
    ...(result.regionDecisions || []).map(r => [r.policy, r.canonicalCode, r.canonicalName, r.region, r.sourceLine, r.otherRegions.join(" | ")])
  ]);
  sheet("Audit", ["Property", "Value"], Object.entries({ state: result.status === "ready" ? "Validated, not yet approved" : "DRAFT - unresolved exceptions; not a complete inventory dataset", pipeline: VERSION, asOf: result.asOf, exportedAt: result.exportedAt, reportDate: result.reportDate, ...result.rules, ...result.totals, ...provenance, dcWarning: "DC balances on Template are repeated per store. Use DC Inventory for distinct DC stock.", salesWarning: result.rules.salesBasis || `Sell Out P4 Weeks is an estimate (DROS x ${result.rules.salesDays}), not measured sales.`, staffingWarning: "Assignments are separate reference relationships; do not multiply inventory by resources." }).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "")]));
  // Text cells remain literal strings in XLSX, including leading '=', never formula objects.
  return Buffer.from(await wb.xlsx.writeBuffer());
}
module.exports = { VERSION, MAPPING_POLICY, ACCEPTED_MAPPING_POLICY, LEGACY_OUTPUT_POLICY, RAW_SITE_NAME_POLICY, HEADERS, SCHEMAS, clean, norm, pnp, sha, date, exported, rules, inspectZip, readWorkbook, readTemplate, transform, exportWorkbook };
