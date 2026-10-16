"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict");
const Excel = require("../etl-worker/node_modules/exceljs"), { norm, clean, pnp, sha, readWorkbook } = require("../etl-worker/engine.cjs");
const source = "C:/Users/PC/Downloads/Anchor-PnP-2026-09-15-inventory-draft.xlsx";
const stage = path.resolve(__dirname, "../.tmp/anchor-pnp-mapping-review-20260923");
function values(sheet, columns) {
  const rows = [];
  sheet.eachRow((row, line) => {
    if (line === 1) return;
    const v = Array.from({ length: columns }, (_, i) => {
      const value = row.getCell(i + 1).value;
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if (value.error) return "";
        if (value.richText) return value.richText.map(part => part.text).join("");
        throw Error(`Reference ${sheet.name}:${line} must contain literal values, not formulas.`);
      }
      return value ?? "";
    });
    if (v.some(value => value !== "")) rows.push({ line, v });
  });
  return rows;
}
const key = (code, name) => JSON.stringify([norm(code), norm(name)]);
function index(rows, value) { const map = new Map(); for (const row of rows) { const k = value(row); if (!map.has(k)) map.set(k, []); map.get(k).push(row); } return map; }
async function main() {
  const bytes = await fs.readFile(source), workbook = await new Excel.Workbook().xlsx.load(bytes);
  const stores = values(workbook.getWorksheet("Cleaned Store List"), 7).filter(row => pnp(row.v[0]));
  const staff = values(workbook.getWorksheet("Meridian Call Cycle Master"), 15).filter(row => pnp(row.v[3]) && !/^(NO|N|FALSE|0|INACTIVE)$/.test(norm(row.v[4])));
  const audit = Object.fromEntries(workbook.getWorksheet("Audit").getSheetValues().slice(2).filter(Boolean).map(row => [row[1], row[2]]));
  const checksums = JSON.parse(audit.checksums), pinned = {};
  for (const [role, name] of [["stores", "SALES DATA STORE NAME CLEAN UP .xlsx"], ["staffing", "National_Call_Cycle_Masters 01.09.2026.xlsx"]]) {
    const input = await fs.readFile(path.join("C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs", name));
    assert.equal(sha(input), checksums[role], "Pinned reference checksum must match the original run.");
    pinned[role] = await readWorkbook(input, role);
  }
  function references(storeRows, staffRows) {
    return { byKey: index(storeRows.filter(row => pnp(row.v[0])), row => key(row.v[1], row.v[2])),
      byCode: index(storeRows.filter(row => pnp(row.v[0])), row => norm(row.v[1])),
      byName: index(staffRows.filter(row => pnp(row.v[3]) && !/^(NO|N|FALSE|0|INACTIVE)$/.test(norm(row.v[4]))), row => norm(row.v[1])) };
  }
  const original = references(pinned.stores, pinned.staffing), attached = references(stores, staff);
  function resolve(v, refs) {
    const k = key(v[2], v[4]), exact = refs.byKey.get(k) || [], aliases = exact.length ? exact : refs.byCode.get(norm(v[2])) || [];
    const candidates = [...index(aliases, row => JSON.stringify([row.v[4], row.v[5], row.v[3]].map(norm))).values()].map(rows => {
      const r = rows[0], staffing = refs.byName.get(norm(r.v[5])) || [];
      return { code: clean(r.v[4]), name: clean(r.v[5]), banner: clean(r.v[3]), sourceRows: rows.map(row => row.line), aliases: rows.length,
        regions: [...new Set(staffing.map(row => norm(row.v[7])).filter(Boolean))], masterRows: staffing.map(row => row.line) };
    });
    const valid = Boolean(candidates.length === 1 && candidates[0].code && candidates[0].name && pnp(candidates[0].banner));
    return { candidates, valid, match: exact.length ? "Code and name" : "Code only",
      status: candidates.length > 1 ? "Conflicting canonical stores" : valid ? "Unique canonical store" : candidates.length ? "Incomplete mapping" : "No mapping",
      regionStatus: valid ? candidates[0].regions.length === 1 ? "Unique active region" : "Region review required" : "Deferred until store is resolved" };
  }
  const exceptions = values(workbook.getWorksheet("Exceptions"), 10), mappings = new Map(), originalIssueCounts = {};
  for (const row of exceptions) {
    const v = row.v, k = key(v[2], v[4]); originalIssueCounts[v[7]] = (originalIssueCounts[v[7]] || 0) + 1;
    if (mappings.has(k)) { mappings.get(k).sourceRows.add(v[0]); continue; }
    mappings.set(k, { code: clean(v[2]), name: clean(v[4]), key: k, sourceRows: new Set([v[0]]), ...resolve(v, original), attached: resolve(v, attached) });
  }
  const signature = mapping => JSON.stringify(mapping.candidates.map(c => [c.code, c.name, c.banner, ...c.regions].map(norm)).sort());
  const differences = [...mappings.values()].filter(m => signature(m) !== signature(m.attached));
  const redundantRegions = exceptions.filter(row => row.v[7] === "REGION_MAPPING" && !mappings.get(key(row.v[2], row.v[4])).valid);
  const genuineRegions = exceptions.filter(row => row.v[7] === "REGION_MAPPING" && mappings.get(key(row.v[2], row.v[4])).valid);
  const summary = { sourceSha256: sha(bytes), uniqueExceptionStores: mappings.size, originalIssueCounts,
    deferredRegionWarnings: redundantRegions.length, remainingRegionWarnings: genuineRegions.length,
    distinctStoreConflicts: [...mappings.values()].filter(item => item.candidates.length > 1).length,
    attachedReferenceDifferences: differences.map(m => ({ code: m.code, name: m.name, affectedRows: m.sourceRows.size, pinnedStatus: m.status, attachedStatus: m.attached.status })),
    liquorRemainsEligible: true, inventoryReprocessed: false, originalWorkbookModified: false };
  const out = new Excel.Workbook(); out.creator = "Meridian Nexus";
  function sheet(name, headers, rows) {
    const s = out.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] }); s.addRow(headers); rows.forEach(row => s.addRow(row));
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; s.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3558" } };
    s.columns.forEach(column => { column.width = 26; column.alignment = { vertical: "top", wrapText: true }; });
    s.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, s.rowCount), column: headers.length } }; return s;
  }
  sheet("Summary", ["Property", "Value"], [
    ["Purpose", "Mapping review only. This is not a reprocessed or approved inventory workbook."],
    ["Source", path.basename(source)], ["Rule", "Keep liquor stores eligible. Do not select the first match or exclude unresolved stock."],
    ["XLOOKUP", "An existing first match does not establish uniqueness of code + name."],
    ...Object.entries(summary).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]),
    ["Reference basis", "Primary review uses the exact reference checksums in the original run's Audit. Embedded reference changes are listed separately and have not been published."],
    ["Inventory", `The original ${audit.readyRows} accepted rows and ${audit.exceptionRows} exception source rows have not been changed or reclassified.`],
    ["Next step", "Resolve genuine conflicts in the approved references, then create a new No-ETLs run. Review runs cannot use Retry; unchanged inputs reuse the original run. No source rows should be silently dropped."]
  ]);
  sheet("Mapping Review", ["Site code", "Source name", "Source key", "Match", "Store result", "Distinct targets", "Region result", "Affected source rows"],
    [...mappings.values()].map(m => [m.code, m.name, m.key, m.match, m.status, m.candidates.length, m.regionStatus, m.sourceRows.size]));
  sheet("Candidate Stores", ["Site code", "Source name", "Canonical code", "Canonical store", "Banner", "Alias count", "Cleaned-list rows", "Active regions", "Master row count", "Master rows"],
    [...mappings.values()].flatMap(m => m.candidates.map(c => [m.code, m.name, c.code, c.name, c.banner, c.aliases, c.sourceRows.join(", "), c.regions.join(" | "), c.masterRows.length, c.masterRows.join(", ")])));
  sheet("Region Review", ["Source row", "Site code", "Source name", "Classification", "Canonical store", "Active regions"],
    exceptions.filter(row => row.v[7] === "REGION_MAPPING").map(row => { const m = mappings.get(key(row.v[2], row.v[4]));
      return [row.v[0], m.code, m.name, m.valid ? "Review active master region" : "Duplicate warning: store unresolved", m.valid ? m.candidates[0].name : "", m.valid ? m.candidates[0].regions.join(" | ") : "Not checked"]; }));
  sheet("Other Exceptions", ["Source row", "Site code", "Article", "Source name", "Issue", "Details"],
    exceptions.filter(row => !["STORE_MAPPING", "REGION_MAPPING"].includes(row.v[7])).map(row => [row.v[0], row.v[2], row.v[3], row.v[4], row.v[7], row.v[8]]));
  sheet("Reference Differences", ["Site code", "Source name", "Affected rows", "Pinned reference result", "Attached reference result", "Attached canonical stores", "State"],
    differences.map(m => [m.code, m.name, m.sourceRows.size, m.status, m.attached.status, m.attached.candidates.map(c => `${c.code} | ${c.name} | ${c.banner}`).join("; "), "Not published to approved references"]));
  await fs.mkdir(stage, { recursive: true });
  const target = path.join(stage, "Anchor-PnP-2026-09-15-mapping-review.xlsx");
  await fs.writeFile(target, Buffer.from(await out.xlsx.writeBuffer()));
  await fs.writeFile(path.join(stage, "analysis.json"), JSON.stringify(summary, null, 2));
  const saved = await new Excel.Workbook().xlsx.readFile(target); assert.equal(saved.getWorksheet("Mapping Review").rowCount - 1, mappings.size);
  assert.equal(sha(await fs.readFile(source)), summary.sourceSha256);
  console.log(JSON.stringify({ ...summary, output: target }, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
