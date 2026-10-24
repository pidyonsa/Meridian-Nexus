'use strict';
// Reads a client distribution-gap workbook: one sheet per banner, each a weekly matrix of
//   Date | Store | [Region] | <product> | <product> ...   with cells "No gap" / "Opportunity" / "Lost" (or blank).
// Weeks are stacked down the sheet. Nothing is saved here; the result is validated data plus warnings.
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');

const LIMITS = {bytes: 10 * 1024 * 1024, sheets: 20, rows: 20000, columns: 200};
// Sheet name -> banner. Order matters: the first match wins.
const BANNERS = [
  {banner: 'PnP Family', test: /pnp|pick\s*n\s*pay|family/i},
  {banner: 'Dis-Chem', test: /dis-?\s*chem/i},
  {banner: "Food Lover's Market", test: /\bflm\b|food\s*lover/i}
];
// Any other sheet with a Date/Store header is a banner named after the sheet, e.g. "Spar Gap Tracker" -> "Spar".
const bannerFromSheet = name => clean(name.replace(/\b(gap|gaps|matrix|tracker|report|sheet|\d+\s*ml)\b/gi, ' ').replace(/[-_]+/g, ' ')) || clean(name);
const STATUS = {'no gap': 'N', 'nogap': 'N', opportunity: 'O', opportunities: 'O', lost: 'L', loss: 'L'};

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const storeKey = name => clean(name).toLowerCase();

// Cell value -> plain value (ExcelJS gives rich text, formulas and hyperlinks as objects).
function plain(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return plain(value.result);
    if (Array.isArray(value.richText)) return value.richText.map(t => t.text).join('');
    if ('text' in value) return value.text;
    return null;
  }
  return value;
}

// "31.08.2026", "31/08/2026", "2026-08-31", a real date or an Excel serial -> "2026-08-31".
function weekOf(value) {
  const v = plain(value);
  let y, m, d;
  if (v instanceof Date) { y = v.getUTCFullYear(); m = v.getUTCMonth() + 1; d = v.getUTCDate(); }
  else if (typeof v === 'number' && v > 30000 && v < 80000) { const t = new Date(Date.UTC(1899, 11, 30) + v * 86400000); y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); }
  else {
    const s = clean(v);
    let match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match) { d = +match[1]; m = +match[2]; y = +match[3]; }
    else if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +match[1]; m = +match[2]; d = +match[3]; }
    else return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 2020 || y > 2100) return null;
  return date.toISOString().slice(0, 10);
}

function readSheet(ws, banner) {
  const warnings = [];
  const rowCount = ws.rowCount;
  if (rowCount > LIMITS.rows + 30) throw new AppError('resource-exhausted', `${ws.name} has more than ${LIMITS.rows} rows.`);
  if (ws.columnCount > LIMITS.columns) throw new AppError('resource-exhausted', `${ws.name} has more than ${LIMITS.columns} columns.`);
  const cells = r => { const row = ws.getRow(r); const out = []; for (let c = 1; c <= Math.min(ws.columnCount, LIMITS.columns); c++) out.push(plain(row.getCell(c).value)); return out; };
  let headerRow = 0, header = [];
  for (let r = 1; r <= Math.min(rowCount, 30); r++) { const row = cells(r); if (clean(row[0]).toLowerCase() === 'date') { headerRow = r; header = row.map(clean); break; } }
  if (!headerRow) throw new AppError('invalid-argument', `${ws.name}: no header row starting with "Date" in the first 30 rows.`);
  if (header[1].toLowerCase() !== 'store') throw new AppError('invalid-argument', `${ws.name}: the second column must be "Store" (found "${header[1]}").`);
  const hasRegion = header[2].toLowerCase() === 'region';
  const first = hasRegion ? 3 : 2;
  const products = [];
  header.forEach((name, i) => { if (i >= first && name) products.push({i, name}); });
  if (!products.length) throw new AppError('invalid-argument', `${ws.name}: no product columns after Store${hasRegion ? '/Region' : ''}.`);
  // A product heading used twice (seen in the client's FLM sheet, with differing values) is kept as two products,
  // the later one labelled with its column, and flagged so the client can be asked which is right.
  const seenNames = new Set();
  for (const p of products) {
    const lower = p.name.toLowerCase();
    if (seenNames.has(lower)) {
      const letter = ws.getColumn(p.i + 1).letter;
      warnings.push(`${ws.name}: "${p.name}" appears twice; column ${letter} is kept separately as "${p.name} (column ${letter})". Ask the client which is correct.`);
      p.name = `${p.name} (column ${letter})`;
    }
    seenNames.add(lower);
  }

  const weeks = new Map(), unknown = new Map(), fills = {N: new Map(), O: new Map(), L: new Map()};
  const fillOf = (r, c) => { const f = ws.getRow(r).getCell(c).fill; const argb = f && f.type === 'pattern' && f.pattern === 'solid' ? f.fgColor?.argb : null; return argb && /^[0-9A-F]{8}$/i.test(argb) ? `#${argb.slice(2).toUpperCase()}` : null; };
  let blanks = 0, badDates = 0, noRegion = 0;
  for (let r = headerRow + 1; r <= rowCount; r++) {
    const row = cells(r);
    if (row.every(v => clean(v) === '')) continue;
    const week = weekOf(row[0]);
    const store = clean(row[1]);
    if (!week) { badDates++; continue; }
    if (!store) continue;
    let region = hasRegion ? clean(row[2]) : '';
    if (!region || /^#n\/?a$/i.test(region)) { if (hasRegion) noRegion++; region = null; }
    if (!weeks.has(week)) weeks.set(week, new Map());
    const stores = weeks.get(week), key = storeKey(store);
    if (stores.has(key)) { warnings.push(`${ws.name}: ${store} appears twice in week ${week}; the later row is used.`); }
    const statuses = {};
    for (const p of products) {
      const raw = clean(row[p.i]);
      if (!raw) { blanks++; continue; }
      const status = STATUS[raw.toLowerCase()];
      if (!status) { unknown.set(raw, (unknown.get(raw) || 0) + 1); continue; }
      statuses[p.name] = status;
      const fill = fillOf(r, p.i + 1);
      if (fill) fills[status].set(fill, (fills[status].get(fill) || 0) + 1);
    }
    stores.set(key, {store, region, statuses});
  }
  if (badDates) warnings.push(`${ws.name}: ${badDates} row(s) without a readable date were skipped.`);
  for (const [value, n] of unknown) warnings.push(`${ws.name}: ${n} cell(s) with "${value.slice(0, 40)}" were skipped (expected No gap, Opportunity or Lost).`);
  if (noRegion) warnings.push(`${ws.name}: ${noRegion} row(s) have no region (#N/A); shown as Not given.`);
  if (!weeks.size) throw new AppError('invalid-argument', `${ws.name}: no weekly rows found under the header.`);
  const top = map => [...map].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {banner, sheet: ws.name, hasRegion, products: products.map(p => p.name), weeks, blanks, warnings, colors: {N: top(fills.N), O: top(fills.O), L: top(fills.L)}};
}

// Buffer -> {banners: [{banner, sheet, products, weeks: Map(week -> Map(storeKey -> {store, region, statuses}))}], warnings}
async function parseWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new AppError('invalid-argument', 'The file is empty.');
  if (buffer.length > LIMITS.bytes) throw new AppError('resource-exhausted', 'The file is larger than 10 MB.');
  if (buffer.subarray(0, 2).toString('latin1') !== 'PK') throw new AppError('invalid-argument', 'This is not an Excel .xlsx workbook.');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch { throw new AppError('invalid-argument', 'The workbook could not be read. Save it as .xlsx and try again.'); }
  if (wb.worksheets.length > LIMITS.sheets) throw new AppError('resource-exhausted', 'The workbook has too many sheets.');
  const banners = [], warnings = [], seen = new Set();
  for (const ws of wb.worksheets) {
    if (ws.state && ws.state !== 'visible') continue;
    const known = BANNERS.find(b => b.test.test(ws.name));
    const banner = known ? known.banner : bannerFromSheet(ws.name);
    let sheet;
    try { sheet = readSheet(ws, banner); } catch (error) {
      // A sheet without the Date / Store layout is notes or a summary, not a banner.
      if (!known && error instanceof AppError && /no header row|second column/.test(error.message)) { warnings.push(`Sheet "${ws.name}" was ignored (no Date / Store table).`); continue; }
      throw error;
    }
    if (seen.has(banner)) throw new AppError('invalid-argument', `Two sheets look like ${banner}; keep one.`);
    seen.add(banner);
    banners.push(sheet);
    warnings.push(...sheet.warnings);
    // A week that repeats the previous week cell for cell usually means the client re-sent old data.
    const ordered = [...sheet.weeks].sort(([a], [b]) => a.localeCompare(b));
    const fingerprint = stores => JSON.stringify([...stores].sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => [k, s.statuses]));
    for (let i = 1; i < ordered.length; i++) {
      if (fingerprint(ordered[i][1]) === fingerprint(ordered[i - 1][1])) warnings.push(`${sheet.banner}: week ${ordered[i][0]} is identical to ${ordered[i - 1][0]} for every store and product. The client may have repeated the previous week's data.`);
    }
  }
  if (!banners.length) throw new AppError('invalid-argument', 'No sheet with a Date / Store gap table was found.');
  // The client's own status colours: the most common fill per status across all sheets.
  const colors = {};
  for (const st of ['N', 'O', 'L']) {
    const votes = new Map();
    for (const b of banners) if (b.colors[st]) votes.set(b.colors[st], (votes.get(b.colors[st]) || 0) + 1);
    colors[st] = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  return {banners, warnings, colors};
}

// A compact, JSON-safe summary for previews and the upload record.
function summarise(parsed) {
  return {colors: parsed.colors || {}, banners: parsed.banners.map(b => ({banner: b.banner, sheet: b.sheet, products: b.products.length, blanks: b.blanks,
    weeks: [...b.weeks].sort(([a], [c]) => a.localeCompare(c)).map(([week, stores]) => {
      const counts = {N: 0, O: 0, L: 0};
      for (const s of stores.values()) for (const st of Object.values(s.statuses)) counts[st]++;
      return {week, stores: stores.size, noGap: counts.N, opportunity: counts.O, lost: counts.L};
    })})), warnings: parsed.warnings};
}

module.exports = {parseWorkbook, summarise, weekOf, storeKey, clean, BANNERS, LIMITS};
