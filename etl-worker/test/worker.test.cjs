"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), ExcelJS = require("exceljs");
const { main } = require("../worker.cjs"), { inventoryFixture } = require("./inventory-fixture.cjs");
test("worker processes pinned inputs including the saved template through final reconciliation", async () => {
  for (const variant of ["ready", "missing", "ambiguous", "accepted-missing", "accepted-liquor", "accepted-raw-name"]) {
    const policy = variant.startsWith("accepted-"), missingStore = variant.endsWith("missing"), ambiguousStore = variant === "ambiguous" || variant === "accepted-liquor", needsReview = !policy && (missingStore || ambiguousStore);
    const id = ({ ready: "a", missing: "b", ambiguous: "c", "accepted-missing": "d", "accepted-liquor": "e", "accepted-raw-name": "f" }[variant]).repeat(32), { objects, manifest } = await inventoryFixture(id, { missingStore, ambiguousStore });
    if (variant === "accepted-raw-name") manifest.outputPolicy = require("../engine.cjs").RAW_SITE_NAME_POLICY;
    if (policy) { manifest.mappingPolicy = require("../engine.cjs").ACCEPTED_MAPPING_POLICY; objects.set(`etl-run-inputs/${id}/manifest.json`, Buffer.from(JSON.stringify(manifest))); }
    const original = new Map(objects), logs = [];
    const bucket = { file: (name, options = {}) => ({
      getMetadata: async () => [{ size: objects.get(name).length }],
      download: async args => { if (name.endsWith(".xlsx")) { assert.equal(options.generation, "1"); assert.equal(args.validation, "crc32c"); } return [objects.get(name)]; },
      save: async (value, opts) => {
        assert.ok(name.startsWith(`etl-results/${id}/`));
        if (opts.preconditionOpts?.ifGenerationMatch === 0 && objects.has(name)) throw Object.assign(new Error("exists"), { code: 412 });
        objects.set(name, Buffer.from(value));
      }
    }) };
    const logger = { log: line => logs.push(JSON.parse(line)), error: line => assert.fail(line) };
    await main({ id, bucket, logger });
    assert.equal(objects.has(`etl-results/${id}/failure.json`), false);
    const result = JSON.parse(objects.get(`etl-results/${id}/result.json`));
    assert.equal(result.status, needsReview ? "review" : "ready");
    assert.equal(result.reconciled, true);
    assert.equal(result.totals.exceptionRows, needsReview ? 1 : 0);
    if (needsReview) assert.equal(result.issueCounts.REGION_MAPPING, undefined);
    if (ambiguousStore && !policy) assert.equal(result.exceptionPreview[0].errors.find(error => error.code === "STORE_MAPPING").referenceCount, 2);
    if (policy) { assert.equal(result.mappingPolicy, manifest.mappingPolicy); assert.equal(result.totals.warningRows, missingStore ? 1 : 0); assert.equal(result.warnings, undefined); assert.equal(result.exclusions, undefined); }
    assert.equal(result.totals.sourceStoreSOH, 115);
    assert.equal(result.totals.dcSOH, 500);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(objects.get(`etl-results/${id}/${result.output.name}`));
    assert.equal(workbook.getWorksheet("Template").getColumn(5).width, 47);
    assert.equal(workbook.getWorksheet("Template").getCell("A1").font.bold, true);
    if (!needsReview) {
      const name = variant === "accepted-raw-name" || missingStore ? "Synthetic Store" : "SYNTHETIC CANONICAL STORE";
      assert.equal(workbook.getWorksheet("Template").getCell("E2").value, name);
      assert.equal(result.preview[0][4], name);
      const fact = JSON.parse(objects.get(`etl-results/${id}/facts.jsonl`).toString().split("\n")[0]);
      assert.equal(fact.values[4], name); assert.equal(fact.canonicalName, missingStore ? "" : "SYNTHETIC CANONICAL STORE");
      assert.equal(result.outputPolicy, manifest.outputPolicy || require("../engine.cjs").LEGACY_OUTPUT_POLICY);
    }
    assert.ok(workbook.getWorksheet("Audit"));
    assert.ok(result.timings.some(t => t.stage === "Reading and validating template"));
    assert.ok(result.workerElapsedMs >= 0);
    assert.equal(logs.at(-1).status, result.status);
    for (const [name, bytes] of original) assert.deepEqual(objects.get(name), bytes);
    const count = logs.length; await main({ id, bucket, logger });
    assert.equal(logs.length, count, "Duplicate delivery cannot rerun a claimed job");
  }
});
