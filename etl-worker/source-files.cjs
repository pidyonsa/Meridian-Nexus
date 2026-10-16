"use strict";
const Excel = require("exceljs"), csv = require("@fast-csv/parse");
const { inspectZip, clean, norm, date, sha } = require("./engine.cjs");
const headerKey = value => norm(value).replace(/[^A-Z0-9]/g, "");
const aliases = value => (Array.isArray(value) ? value : [value]).map(headerKey);
function columns(headers, fields, optional = {}) {
  const result = {};
  for (const [field, names] of Object.entries({ ...optional, ...fields })) {
    const matches = headers.map((h, i) => aliases(names).includes(headerKey(h)) ? i : -1).filter(i => i >= 0);
    if (matches.length > 1) throw new Error(`Duplicate source column for ${field}. Keep one unambiguous source column.`);
    if (!matches.length && Object.hasOwn(fields, field)) return null;
    if (matches.length) result[field] = matches[0];
  }
  return result;
}
function cellValue(cell, label) {
  const value = cell.value;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (value.richText) return value.richText.map(v => v.text).join("");
    throw new Error(`${label}: formulas, links and Excel errors are not valid source values. Use the original values-only export.`);
  }
  if (typeof value === "number" && /^0+$/.test(cell.numFmt || "")) return String(value).padStart(cell.numFmt.length, "0");
  return value ?? "";
}
async function readTable(buffer, { sheets, fields, optional = {}, allowExternalLinks = false, maxRows = 100000, headerColumns, allowExcelErrors = false } = {}) {
  // External-link metadata in unrelated report tabs is never followed or evaluated.
  await inspectZip(buffer, { allowExternalLinks });
  const workbook = new Excel.Workbook(); await workbook.xlsx.load(buffer);
  const candidates = [];
  for (const sheet of workbook.worksheets.filter(s => !sheets || sheets.map(norm).includes(norm(s.name)))) {
    for (let row = 1; row <= Math.min(25, sheet.rowCount); row++) {
      const headers = sheet.getRow(row).values.slice(1, headerColumns ? headerColumns + 1 : undefined).map(v => typeof v === "object" && v !== null ? "" : v);
      const map = columns(headers, fields, optional);
      if (map) { candidates.push({ sheet, row, map, headers }); break; }
    }
  }
  if (candidates.length !== 1) throw new Error(`Expected one ${sheets?.join(" / ") || "source"} table containing ${Object.values(fields).map(v => [].concat(v)[0]).join(", ")}. Found ${candidates.length}; check the raw export, not the transformed file.`);
  const { sheet, row: headerRow, map, headers } = candidates[0], rows = [];
  sheet.eachRow((row, line) => {
    if (line <= headerRow) return;
    const cellErrors = [];
    const v = Object.fromEntries(Object.entries(map).map(([key, i]) => {
      const cell = row.getCell(i + 1);
      if (allowExcelErrors && cell.value?.error) { cellErrors.push({ role: "gln", line, column: headers[i], error: cell.value.error }); return [key, ""]; }
      return [key, cellValue(cell, `${sheet.name} row ${line}, ${headers[i]}`)];
    }));
    if (!Object.values(v).some(v => clean(v))) return;
    if (rows.length >= maxRows) throw new Error(`Source exceeds ${maxRows.toLocaleString("en")} data rows.`);
    const total = row.values.some(v => typeof v === "string" && /^(?:grand\s+|sub\s*)?total\s*:?$/i.test(v.trim()));
    const identity = sha(JSON.stringify(row.values.map(value => value && typeof value === "object" && !(value instanceof Date) ? null : value)));
    rows.push({ line, v, identity, ...(total ? { total: true } : {}), ...(cellErrors.length ? { cellErrors } : {}) });
  });
  if (!rows.length) throw new Error("The source table has no data rows.");
  return { rows, headers, sheet: sheet.name, headerRow };
}
async function readDelimited(buffer, { fields, optional = {}, name = "source.txt", maxRows = 100000 } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 25 * 1024 * 1024) throw new Error("Source files must be between 1 byte and 25 MB.");
  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.subarray(2).toString("utf16le");
  else text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0], delimiters = ["|", "\t", ";", ","].filter(d => columns(first.split(d), fields, optional));
  if (delimiters.length !== 1) throw new Error(`${name}: expected a delimited export containing ${Object.keys(fields).join(", ")}.`);
  const delimiter = delimiters[0], rows = []; let map, headers, trailer;
  await new Promise((resolve, reject) => {
    const parser = csv.parseString(text, { delimiter, quote: delimiter === "|" ? null : '"', ignoreEmpty: true, strictColumnHandling: true });
    parser.on("error", reject).on("end", resolve).on("data-invalid", () => parser.destroy(new Error(`${name}: invalid delimited row.`)));
    parser.on("data", values => {
      try {
        if (!headers) { headers = values; map = columns(headers, fields, optional); if (!map) throw new Error(`${name}: missing required columns.`); return; }
        const count = values.length === 1 && /^\((\d+) rows? affected\)$/.exec(values[0].trim());
        if (count && trailer === undefined) { trailer = Number(count[1]); return; }
        if (trailer !== undefined) throw new Error(`${name}: unexpected data after the row-count footer.`);
        if (values.length !== headers.length) throw new Error(`${name}: row ${rows.length + 2} has an unexpected column count.`);
        if (rows.length >= maxRows) throw new Error(`${name}: too many rows.`);
        rows.push({ line: rows.length + 2, source: name, identity: sha(JSON.stringify(values)), v: Object.fromEntries(Object.entries(map).map(([key, i]) => [key, values[i]])) });
      } catch (error) { parser.destroy(error); }
    });
  });
  if (!rows.length) throw new Error(`${name}: the export has no rows.`);
  if (trailer !== undefined && trailer !== rows.length) throw new Error(`${name}: declared row count does not match the data; the export may be incomplete.`);
  return { rows, headers, sheet: name };
}
function decimal(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = clean(value).replace(/[\s\u00a0]/g, "");
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const result = Number(text.replace(",", ".")); return Number.isFinite(result) ? result : null;
}
function sourceDate(value) {
  if (value instanceof Date) return date(value);
  const text = clean(value), match = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/.exec(text);
  return date(match ? match[1] : text);
}
const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
function monthNumber(value) {
  const valueText = norm(value); let number = Number(valueText);
  if (!Number.isInteger(number)) number = monthNames.findIndex(m => m === valueText || m.slice(0, 3) === valueText) + 1;
  return number >= 1 && number <= 12 ? number : null;
}
function reportMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") || +value.slice(0, 4) < 2000) throw new Error("Choose a valid reporting month.");
  return value;
}
module.exports = { readTable, readDelimited, columns, cellValue, decimal, sourceDate, monthNumber, monthNames, reportMonth, headerKey };
