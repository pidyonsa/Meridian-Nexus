"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");

const VERSION = "dataorbis-monthly-sales-v1";
const RAW_HEADERS = ["date F454_YYYYMM", "Site Code", "Site", "Region", "Category", "Brand", "Product", "Sales Quantity", "Sales Value Excl"];
const HEADERS = ["Month-Yr", "Client", "Retailer", "Banner", "Store ID", "Store Name", "CHAIN #", "STORE #", "Province", "RSM", "DM", "REP", "MERCH", "CATEGORY", "BRAND", "PRODUCT/SKU", "SALES UNITS", "SALES VALUE", "SALES CASES (NEED HELP)", "Meridian Coverage"];
const RAW_SHEETS = { "Game Raw Data": ["GAME"], "Makro Raw Data": ["MAKRO", "JUMBO"] };
const norm = v => String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const key = values => JSON.stringify(values);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const round = n => Math.round(n * 1e6) / 1e6;

function scalar(cell, location) {
  const v = cell.value;
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) throw new Error(`${location}: invalid date.`);
    return v.toISOString().slice(0, 10);
  }
  if (v && typeof v === "object") {
    if (v.richText) return v.richText.map(p => p.text).join("");
    throw new Error(`${location}: formulas, errors and hyperlinks are not accepted as data.`);
  }
  return v ?? null;
}
function values(row, count, label) {
  return Array.from({ length: count }, (_, i) => scalar(row.getCell(i + 1), `${label}!${row.number}:${i + 1}`));
}
function headers(actual, expected, label) {
  if (actual.length !== expected.length || expected.some((v, i) => norm(v) !== norm(actual[i]))) {
    throw new Error(`${label}: workbook headers do not match the approved schema.`);
  }
}
async function preflight(file, maxExpanded = 200 * 1024 * 1024) {
  const bytes = await fs.readFile(file);
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("Workbook must be non-empty and at most 25 MB.");
  const zip = await JSZip.loadAsync(bytes);
  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    if (/vbaProject|externalLinks\/|connections\.xml|embeddings\//i.test(entry.name)) throw new Error("Active workbook content and external connections are not supported.");
    expanded += entry._data?.uncompressedSize || 0;
    if (expanded > maxExpanded || Object.keys(zip.files).length > 5000) throw new Error("Workbook exceeds the decompression limit.");
  }
  if (!zip.file("xl/workbook.xml")) throw new Error("Not an XLSX workbook.");
  return { bytes: bytes.length, sha256: sha(bytes) };
}
async function readRaw(file) {
  const provenance = await preflight(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const rows = [], expected = [];
  for (const sheet of book.worksheets) {
    if (!RAW_SHEETS[sheet.name]) continue;
    if (sheet.rowCount > 100001 || sheet.columnCount !== RAW_HEADERS.length) throw new Error(`${sheet.name}: unsupported dimensions.`);
    headers(values(sheet.getRow(1), 9, sheet.name), RAW_HEADERS, sheet.name);
    sheet.eachRow((row, line) => {
      if (line > 1 && row.hasValues) rows.push({ sheet: sheet.name, line, v: values(row, 9, sheet.name) });
    });
  }
  if (!rows.length) throw new Error("No recognised Game or Makro raw sales sheet was found.");
  const worked = book.getWorksheet("Game and Makro Transformed");
  if (worked) {
    const expectedHeaders = [RAW_HEADERS[0], "Client", "Retailer", "Banner", "Site Code", "Store Name", null, null, "Region", null, null, null, null, "Category", "Brand", "Product", "Sales Quantity", "Sales Value Excl"];
    headers(values(worked.getRow(2), 18, worked.name), expectedHeaders, worked.name);
    worked.eachRow((row, line) => {
      if (line > 2 && row.hasValues) expected.push({ line, v: values(row, 18, worked.name) });
    });
  }
  return { rows, expected, provenance };
}
async function referenceRows(file, expectedHeaders) {
  const provenance = await preflight(file);
  const rows = [];
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore" });
  let found = false;
  for await (const sheet of reader) {
    for await (const row of sheet) {
      if (sheet.name !== "Sheet1") continue;
      found = true;
      if (row.number === 1) headers(values(row, expectedHeaders.length, sheet.name), expectedHeaders, file);
      else if (row.hasValues) {
        // Only mapping fields are read; staff contact and attendance columns are unrelated.
        const errors = [];
        const v = Array.from({ length: expectedHeaders.length }, (_, i) => {
          try { return scalar(row.getCell(i + 1), `${sheet.name}!${row.number}:${i + 1}`); }
          catch (error) { errors.push(error.message); return null; }
        });
        rows.push({ line: row.number, v, ...(errors.length ? { error: errors.join(" ") } : {}) });
      }
    }
  }
  if (!found || !rows.length) throw new Error(`${file}: Sheet1 mapping data is missing.`);
  return { rows, provenance };
}
async function readReferences(cleanupFile, callCycleFile) {
  const cleanup = await referenceRows(cleanupFile, ["Banner", "Store ID", "Store Name", "Cleaned Banner", "Cleaned Store Code", "Cleaned Store NAME", "Cleaned Banner"]);
  const callCycle = await referenceRows(callCycleFile, ["STORE CODE", "STORE NAME", "GEO REP STORE CODE", "BANNER"]);
  return { cleanup: cleanup.rows, callCycle: callCycle.rows, provenance: { cleanup: cleanup.provenance, callCycle: callCycle.provenance } };
}
function addIndex(index, id, value) {
  if (!index.has(id)) index.set(id, []);
  index.get(id).push(value);
}
function mappingIndex(references) {
  const cleanup = new Map(), callCycle = new Map();
  for (const row of references.cleanup) {
    if (!norm(row.v[1]) || !norm(row.v[2])) continue;
    addIndex(cleanup, key([norm(row.v[1]), norm(row.v[2])]), row);
  }
  for (const row of references.callCycle) {
    if (!norm(row.v[1])) continue;
    addIndex(callCycle, norm(row.v[1]), row);
  }
  return { cleanup, callCycle };
}
function resolveMapping(row, index) {
  const candidates = index.cleanup.get(key([norm(row.v[1]), norm(row.v[2])])) || [];
  if (!candidates.length) return { error: "store-cleanup-missing" };
  if (candidates.some(r => r.error)) return { error: "store-cleanup-cell-error", references: candidates.map(r => r.line) };
  const identities = new Map();
  for (const candidate of candidates) {
    const v = candidate.v;
    const cleanName = norm(v[5]), banner = norm(v[6]) || norm(v[3]);
    if (!cleanName || !banner || (norm(v[3]) && norm(v[3]) !== banner)) return { error: "store-cleanup-conflict", references: candidates.map(c => c.line) };
    identities.set(key([norm(v[4]), cleanName, banner]), { cleanName, banner });
  }
  if (identities.size !== 1) return { error: "store-cleanup-ambiguous", references: candidates.map(c => c.line) };
  const mapping = [...identities.values()][0];
  const matches = index.callCycle.get(mapping.cleanName) || [];
  if (!matches.length) return { error: "call-cycle-missing", cleanName: mapping.cleanName };
  if (matches.some(r => r.error)) return { error: "call-cycle-cell-error", cleanName: mapping.cleanName };
  const banners = new Set(matches.map(r => norm(r.v[3])));
  if (banners.size !== 1 || !banners.has(mapping.banner)) return { error: "call-cycle-conflict", cleanName: mapping.cleanName };
  if (!RAW_SHEETS[row.sheet].includes(mapping.banner)) return { error: "wrong-channel", banner: mapping.banner };
  return { ...mapping, cleanupRows: candidates.map(r => r.line), callCycleRows: matches.map(r => r.line) };
}
function month(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value))) throw new Error("Choose a reporting month as YYYY-MM.");
  return String(value);
}
function totals(rows, unitsIndex, valueIndex) {
  return { rows: rows.length, units: round(rows.reduce((n, r) => n + r[unitsIndex], 0)), value: round(rows.reduce((n, r) => n + r[valueIndex], 0)) };
}
function transform(rawRows, references, options) {
  const period = month(options.month);
  const client = norm(options.client);
  if (!client || client.length > 100) throw new Error("Specify the approved client; it is not inferred from brand or filename.");
  if (rawRows.some(r => !RAW_SHEETS[r.sheet])) throw new Error("Unsupported raw source sheet.");
  const index = mappingIndex(references), records = [], exceptions = [], removedTotals = [], excluded = [], details = [];
  const blockers = [];
  if (options.numericConvention !== "literal-confirmed") blockers.push("numeric-convention-unconfirmed");
  if (options.referencesApproved !== true) blockers.push("reference-versions-unapproved");
  if (options.sourceComplete !== true) blockers.push("portal-completeness-unverified");
  const seen = new Set();
  for (const [sheet, allowed] of Object.entries(RAW_SHEETS)) {
    const all = rawRows.filter(r => r.sheet === sheet);
    if (!all.length) continue;
    const group = all.filter(r => norm(r.v[0]) !== "TOTAL"), totalRows = all.filter(r => norm(r.v[0]) === "TOTAL");
    // Game's date-column Total rows are subtotals, not sales detail. Retain them
    // only in the audit, even when they aggregate several products or stores.
    if (totalRows.length) {
      if (sheet === "Game Raw Data") {
        for (const r of totalRows) if (r.v.length !== 9 || ![r.v[7], r.v[8]].every(v => typeof v === "number" && Number.isFinite(v))) throw new Error(`${sheet}!${r.line}: subtotal measures must be numeric cells.`);
      } else {
        const counts = new Map();
        for (const r of group) { const k = key(r.v.slice(1)); counts.set(k, (counts.get(k) || 0) + 1); }
        for (const r of totalRows) { const k = key(r.v.slice(1)); counts.set(k, (counts.get(k) || 0) - 1); }
        if (totalRows.length !== group.length || [...counts.values()].some(n => n !== 0)) throw new Error(`${sheet}: Total rows do not reconcile exactly with detail rows.`);
      }
      removedTotals.push(...totalRows.map(r => ({ ...r, reason: sheet === "Game Raw Data" ? "game-date-subtotal" : "verified-total-duplicate" })));
    }
    for (const row of group) {
      const v = row.v;
      if (v.length !== 9 || v[0] !== `${period}-01`) throw new Error(`${sheet}!${row.line}: incorrect or incomplete month.`);
      if (v.slice(1, 7).some(v => typeof v !== "string" || !v.trim())) throw new Error(`${sheet}!${row.line}: missing source identity or dimension.`);
      if (![v[7], v[8]].every(v => typeof v === "number" && Number.isFinite(v))) throw new Error(`${sheet}!${row.line}: measures must be numeric cells, not locale-formatted text.`);
      const id = key([sheet, ...v.slice(0, 7)]);
      if (seen.has(id)) throw new Error(`${sheet}!${row.line}: repeated store/product detail; do not import a duplicated export.`);
      seen.add(id); details.push(row);
      if (sheet === "Game Raw Data" && (norm(v[1]) === "GE01" || norm(v[3]) === "NON-SA")) {
        if (options.excludeGameOnlineAndNonSa === true) { excluded.push({ ...row, reason: norm(v[1]) === "GE01" ? "game-online" : "game-non-sa" }); continue; }
        if (options.excludeGameOnlineAndNonSa !== false) { exceptions.push({ ...row, error: "exclusion-policy-unconfirmed" }); continue; }
      }
      const mapping = resolveMapping(row, index);
      if (mapping.error) { exceptions.push({ ...row, ...mapping }); continue; }
      if (!allowed.includes(mapping.banner)) throw new Error("Invalid mapped channel.");
      // Keep raw store and product fields. Cleanup is a lookup, not an output rename.
      const output = [v[0], client, mapping.banner, mapping.banner, v[1], v[2], null, null, v[3], null, null, null, null, v[4], v[5], v[6], v[7], v[8], null, null];
      records.push({ sheet, line: row.line, v: output, mapping });
    }
  }
  if (!details.length) throw new Error("No detail rows found.");
  if (exceptions.length) blockers.push("unresolved-row-exceptions");
  const referenceWarnings = [
    ...references.cleanup.filter(r => r.error).map(r => ({ role: "cleanup", line: r.line, error: r.error })),
    ...references.callCycle.filter(r => r.error).map(r => ({ role: "callCycle", line: r.line, error: r.error }))
  ];
  // An unrelated broken mapping is a warning. If its identity is unreadable, we
  // cannot prove it is unrelated; block instead of picking another candidate.
  if (references.cleanup.some(r => r.error && (!norm(r.v[1]) || !norm(r.v[2]))) || references.callCycle.some(r => r.error && !norm(r.v[1]))) blockers.push("unidentifiable-reference-errors");
  const byBanner = {};
  for (const banner of ["GAME", "MAKRO", "JUMBO"]) byBanner[banner] = totals(records.filter(r => r.v[3] === banner).map(r => r.v), 16, 17);
  const result = { version: VERSION, month: period, client, status: blockers.length ? "blocked" : "validated-local", publicationEnabled: false,
    blockers, records, exceptions, excluded, removedTotals, referenceWarnings,
    totals: { source: totals(details.map(r => r.v), 7, 8), output: totals(records.map(r => r.v), 16, 17),
      exceptions: totals(exceptions.map(r => r.v), 7, 8), excluded: totals(excluded.map(r => r.v), 7, 8), removedTotals: totals(removedTotals.map(r => r.v), 7, 8), byBanner } };
  result.partitionKeys = [...new Set(records.map(r => key([period, client, r.v[3]])))];
  result.batchDigest = sha(key(records.map(r => r.v).sort((a, b) => key(a).localeCompare(key(b)))));
  for (const measure of ["rows", "units", "value"]) {
    const accounted = result.totals.output[measure] + result.totals.exceptions[measure] + result.totals.excluded[measure];
    if (Math.abs(result.totals.source[measure] - accounted) > 0.00001) throw new Error("Source/output conservation failed.");
  }
  return result;
}
function reconcile(result, expected) {
  const projected = result.records.map(r => ({ line: r.line, v: r.v.slice(0, 18) }));
  const counts = new Map();
  for (const r of projected) { const k = key(r.v); counts.set(k, (counts.get(k) || 0) + 1); }
  const missing = [];
  let matched = 0;
  for (const r of expected) {
    const k = key(r.v), count = counts.get(k) || 0;
    if (count > 0) { matched++; counts.set(k, count - 1); }
    else missing.push(r);
  }
  const extra = [...counts].filter(([, n]) => n > 0).flatMap(([k, n]) => Array.from({ length: n }, () => JSON.parse(k)));
  return { expectedRows: expected.length, matchedRows: matched, missing, extra, exact: missing.length === 0 && extra.length === 0 };
}
async function inspectTemplate(file, options) {
  const provenance = await preflight(file);
  const period = month(options.month), client = norm(options.client);
  if (!client) throw new Error("Specify the target client.");
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore" });
  const partitions = {}, hash = crypto.createHash("sha256");
  let sheets = 0, rows = 0, conflicts = 0;
  for await (const sheet of reader) {
    if (++sheets !== 1 || sheet.name !== "Sheet1") throw new Error("Monthly template must have the approved Sheet1 worksheet.");
    for await (const row of sheet) {
      const v = values(row, HEADERS.length, sheet.name);
      if (row.cellCount > HEADERS.length || row.number > 750001) throw new Error("Monthly template dimensions exceed the approved schema.");
      if (row.number === 1) { headers(v, HEADERS, "Monthly template"); continue; }
      if (!v.some(v => v !== null && v !== "")) continue;
      if (v[0] !== `${period}-01`) throw new Error(`Template row ${row.number}: reporting month differs from the batch.`);
      if (typeof v[16] !== "number" || typeof v[17] !== "number" || !Number.isFinite(v[16]) || !Number.isFinite(v[17])) throw new Error(`Template row ${row.number}: invalid sales measures.`);
      hash.update(key(v) + "\n"); rows++;
      const k = key([v[0], v[1], v[2], v[3]]);
      const p = partitions[k] ||= { rows: 0, units: 0, value: 0 };
      p.rows++; p.units += v[16]; p.value += v[17];
      if (norm(v[1]) === client && ["GAME", "MAKRO", "JUMBO"].includes(norm(v[3]))) conflicts++;
    }
  }
  if (sheets !== 1) throw new Error("Monthly template worksheet is missing.");
  for (const p of Object.values(partitions)) { p.units = round(p.units); p.value = round(p.value); }
  return { ...provenance, month: period, client, columns: HEADERS, rows, partitions, conflictingRows: conflicts, dataSha256: hash.digest("hex"), modified: false };
}
function assertPublishable(result, template) {
  if (result.status !== "validated-local" || result.blockers.length || result.exceptions.length) throw new Error("Publishing is blocked by unresolved validation issues.");
  if (template.month !== result.month || template.client !== result.client) throw new Error("Template and batch identity differ.");
  if (template.conflictingRows) throw new Error("This client/channel/month already exists. Reconcile it; never append the batch again.");
  return { partitionKeys: result.partitionKeys, batchDigest: result.batchDigest, templateSha256: template.sha256 };
}
async function draftWorkbook(result, provenance, comparison) {
  const book = new ExcelJS.Workbook();
  book.creator = "Meridian Nexus";
  function sheet(name, cols, rows) {
    const s = book.addWorksheet(name);
    s.addRow(cols); rows.forEach(r => s.addRow(r));
    s.views = [{ state: "frozen", ySplit: 1 }];
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
    s.columns.forEach(c => { c.width = 22; });
    return s;
  }
  const data = sheet("Draft Sales - NOT PUBLISHED", HEADERS, result.records.map(r => [new Date(r.v[0] + "T00:00:00Z"), ...r.v.slice(1)]));
  data.getColumn(1).numFmt = "mmm-yy";
  data.getColumn(5).numFmt = "@";
  for (const col of [17, 18]) data.getColumn(col).numFmt = "0.######";
  sheet("Exceptions", ["Source sheet", "Source row", "Issue", ...RAW_HEADERS], result.exceptions.map(r => [r.sheet, r.line, r.error, ...r.v]));
  sheet("Excluded", ["Source sheet", "Source row", "Reason", ...RAW_HEADERS], result.excluded.map(r => [r.sheet, r.line, r.reason, ...r.v]));
  sheet("Excluded Subtotals", ["Source sheet", "Source row", "Reason", ...RAW_HEADERS], result.removedTotals.map(r => [r.sheet, r.line, r.reason, ...r.v]));
  sheet("Mapping Evidence", ["Source sheet", "Source row", "Raw Site Code", "Raw Site", "Cleaned lookup name", "Banner", "Cleanup rows", "Call cycle rows"], result.records.map(r => [r.sheet, r.line, r.v[4], r.v[5], r.mapping.cleanName, r.v[3], r.mapping.cleanupRows.join(","), r.mapping.callCycleRows.join(",")]));
  sheet("Reference Warnings", ["Reference", "Source row", "Issue"], result.referenceWarnings.map(r => [r.role, r.line, r.error]));
  sheet("Audit", ["Property", "Value"], Object.entries({ status: "DRAFT ONLY - do not publish until all blockers are resolved", version: VERSION,
    month: result.month, client: result.client, blockers: result.blockers, totals: result.totals, batchDigest: result.batchDigest,
    provenance, comparison: { expectedRows: comparison.expectedRows, matchedRows: comparison.matchedRows, missing: comparison.missing.length, extra: comparison.extra.length },
    numericPolicy: "Source numeric cells preserved exactly; no guessed decimal/thousands conversion.",
    originalTemplate: "Unchanged; this workbook contains only the candidate batch, not other clients' records."
  }).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]));
  return Buffer.from(await book.xlsx.writeBuffer());
}
module.exports = { VERSION, RAW_HEADERS, HEADERS, norm, sha, values, readRaw, readReferences, mappingIndex, resolveMapping, transform, reconcile, inspectTemplate, assertPublishable, draftWorkbook };
