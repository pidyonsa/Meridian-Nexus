"use strict";
// User request, 22 October: the Geo Rep blueprint feature is retired and its data removed, after a backup.
//   node scripts/blueprint-archive-20261022.cjs export   -> .tmp/blueprint-archive-20261022/*.json (raw Firestore REST docs)
//   node scripts/blueprint-archive-20261022.cjs delete   -> deletes exactly the documents in that export
// Scope: geoRepBlueprints, geoRepBlueprintUpdates, geoRepBlueprintFolders (all), extractionRuns with a
// geo-rep-blueprint-* workflowMode, and geo-rep `files` records of type "Blueprint Reporting" or Form Reports
// stamped geoRepBlueprintLastUpdate. Campaign/compliance files, other geo-rep runs and the attendance
// workbook's attendanceBlueprintUpdates are not touched. Storage objects are not deleted here.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { json } = require("./release-multi-admin.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const dir = path.join(__dirname, "..", ".tmp", "blueprint-archive-20261022");
const MODES = ["geo-rep-blueprint-folder-refresh", "geo-rep-blueprint-folder-sync", "geo-rep-blueprint-inspect", "geo-rep-blueprint-populate", "geo-rep-blueprint-report"];
const eq = (f, v) => ({ fieldFilter: { field: { fieldPath: f }, op: "EQUAL", value: { stringValue: v } } });

async function all(collectionId, where) {
  const docs = []; let last = null;
  for (;;) {
    const q = { from: [{ collectionId }], ...(where ? { where } : {}), orderBy: [{ field: { fieldPath: "__name__" } }], limit: 500 };
    if (last) q.startAt = { values: [{ referenceValue: last }], before: false };
    const page = (await json(`${base}:runQuery`, "POST", { structuredQuery: q })).filter(r => r.document).map(r => r.document);
    docs.push(...page); if (page.length < 500) return docs; last = page.at(-1).name;
  }
}

const isBlueprintFile = d => d.fields.geoRepReportType?.stringValue === "Blueprint Reporting"
  || (d.fields.geoRepReportType?.stringValue === "Form Report" && Boolean(d.fields.geoRepBlueprintLastUpdate));

async function exportAll() {
  fs.mkdirSync(dir, { recursive: true });
  const sets = {
    geoRepBlueprints: await all("geoRepBlueprints"),
    geoRepBlueprintUpdates: await all("geoRepBlueprintUpdates"),
    geoRepBlueprintFolders: await all("geoRepBlueprintFolders"),
    extractionRuns: (await Promise.all(MODES.map(m => all("extractionRuns", eq("workflowMode", m))))).flat(),
    files: (await all("files", eq("retailerId", "geo-rep"))).filter(isBlueprintFile)
  };
  const summary = { exportedAt: new Date().toISOString(), counts: {} };
  for (const [name, docs] of Object.entries(sets)) {
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs));
    summary.counts[name] = docs.length;
  }
  summary.storagePaths = sets.files.map(d => d.fields.storagePath?.stringValue).filter(Boolean);
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary.counts));
}

async function deleteAll() {
  const summary = JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8"));
  let deleted = 0;
  for (const name of Object.keys(summary.counts)) {
    const docs = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8"));
    assert.equal(docs.length, summary.counts[name]);
    if (name === "extractionRuns") assert.ok(docs.every(d => MODES.includes(d.fields.workflowMode?.stringValue)), "non-blueprint run in export");
    if (name === "files") assert.ok(docs.every(isBlueprintFile), "non-blueprint file in export");
    for (let i = 0; i < docs.length; i += 400) {
      // Precondition on updateTime: anything changed since the export is left alone and fails the batch.
      const writes = docs.slice(i, i + 400).map(d => ({ delete: d.name, currentDocument: { updateTime: d.updateTime } }));
      await json(`${base}:commit`, "POST", { writes });
      deleted += writes.length;
    }
    console.log(JSON.stringify({ collection: name, deleted: docs.length }));
  }
  console.log(JSON.stringify({ totalDeleted: deleted }));
}

const mode = process.argv[2];
(mode === "export" ? exportAll() : mode === "delete" ? deleteAll() : Promise.reject(new Error("Use export or delete")))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
