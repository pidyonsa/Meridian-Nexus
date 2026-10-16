"use strict";

const { Storage } = require("@google-cloud/storage");
const engine = require("./engine.cjs");
const layout = require("./shared-layout.cjs");
const salesEngine = require("./sales.cjs");
const feedbackSales = require("./feedback-sales.cjs"), clicksInventory = require("./clicks-inventory.cjs");
const BUCKET = "meridain-nexus.firebasestorage.app";
async function main({ id = process.env.ETL_RUN_ID, bucket = new Storage().bucket(BUCKET), logger = console } = {}) {
  if (!/^[a-f0-9]{32}(?:-[a-f0-9]{8})?$/.test(id || "")) throw new Error("Invalid ETL run identifier.");
  const out = `etl-results/${id}`;
  const started = Date.now(), timings = [];
  let phase = null;
  const save = (name, content, type, once = false) => bucket.file(`${out}/${name}`).save(content, { resumable: false, contentType: type, metadata: { cacheControl: "private, no-store" }, ...(once ? { preconditionOpts: { ifGenerationMatch: 0 } } : {}) });
  const progress = async (stage, percent) => {
    const at = Date.now();
    if (phase) timings.push({ stage: phase.stage, ms: at - phase.at });
    phase = { stage, at };
    logger.log(JSON.stringify({ id, stage, percent, elapsedMs: at - started }));
    await save("progress.json", JSON.stringify({ stage, percent, elapsedMs: at - started, updatedAt: new Date().toISOString() }), "application/json");
  };
  try {
    await save("claim.json", JSON.stringify({ execution: process.env.CLOUD_RUN_EXECUTION, startedAt: new Date().toISOString() }), "application/json", true);
  } catch (error) { if (Number(error.code) === 412) return; throw error; }
  try {
    await progress("Reading pinned inputs", 5);
    const [manifestBytes] = await bucket.file(`etl-run-inputs/${id}/manifest.json`).download();
    if (manifestBytes.length > 50000) throw new Error("Manifest exceeds the supported size.");
    const manifest = JSON.parse(manifestBytes);
    if (manifest.id !== id || manifest.version !== engine.VERSION) throw new Error("Manifest version does not match this worker.");
    const context = manifest.context, sales = context?.kind === "Sales";
    const adapter = context?.transformerVersion, feedback = feedbackSales.adapters.has(adapter), clicksStock = adapter === "clicks-inventory-v1";
    const approved = { "boxer-sales-v1": ["AQUELLE", "boxer"], "game-sales-v1": ["AQUELLE", "game"], "makro-sales-v1": ["AQUELLE", "makro"], "shoprite-universal-sales-v1": ["UNIVERSAL PAPER", "shoprite-group"], "shoprite-saldanha-sales-v1": ["SALDANHA", "shoprite", "checkers"] };
    const feedbackValid = feedback && sales && engine.norm(context.customer) === approved[adapter][0] && approved[adapter].slice(1).includes(context.channelId);
    if (context && !((adapter === "pnp-inventory-v2" && context.channelId === "pnp" && context.kind === "Inventory") || (adapter === "clicks-sales-v1" && context.channelId === "clicks" && sales) || (clicksStock && context.kind === "Inventory" && context.channelId === "clicks" && engine.norm(context.customer) === "ETHICA") || feedbackValid)) throw new Error("Unknown customer/channel adapter in pinned manifest.");
    const data = {}; const checksums = {};
    let template = null;
    const weekly = ["game-sales-v1", "makro-sales-v1"].includes(adapter);
    const rawRoles = weekly ? Object.keys(manifest.inputs).filter(r => /^raw(?:[2-9]|1[0-2])?$/.test(r)).sort((a,b) => Number(a.slice(3) || 1) - Number(b.slice(3) || 1)) : ["raw"];
    if (!rawRoles.length || rawRoles.some((r,i) => r !== (i ? `raw${i + 1}` : "raw"))) throw new Error("Weekly input roles must be consecutive and include raw.");
    const roles = [...(sales ? [...rawRoles, "products", "stores", "staffing", ...(adapter?.startsWith("shoprite-") ? ["gln"] : [])] : clicksStock ? ["raw", "dcStock", "periodSales", "products", "stores", "staffing", "dc"] : Object.keys(engine.SCHEMAS)), ...(manifest.inputs.expected ? ["expected"] : manifest.inputs.template ? ["template"] : [])];
    if (Object.keys(manifest.inputs).some(r => !roles.includes(r))) throw new Error("Unexpected pinned input role.");
    if (sales && !manifest.inputs.expected) throw new Error("The sales output requires its pinned transformed sample.");
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]; const pinned = manifest.inputs[role];
      const extension = weekly && rawRoles.includes(role) ? /\.(xlsx|txt|csv)$/i.exec(pinned?.name || "")?.[1]?.toLowerCase() : "xlsx";
      if (!pinned || !extension || pinned.path !== `etl-run-inputs/${id}/${role}.${extension}`) throw new Error("Input is outside this run's pinned prefix.");
      await progress(`Reading and validating ${role}`, 10 + Math.floor(i * 60 / roles.length));
      const file = bucket.file(pinned.path, { generation: pinned.generation });
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== pinned.size || pinned.size > 25 * 1024 * 1024) throw new Error(`${role}: pinned file size mismatch.`);
      const [bytes] = await file.download({ validation: "crc32c" });
      checksums[role] = engine.sha(bytes);
      if (weekly && rawRoles.includes(role) && rawRoles.some(r => r !== role && checksums[r] === checksums[role])) throw new Error("The same weekly export was selected more than once. Remove the duplicate file.");
      if (role === "expected") template = await layout.readExpected(bytes, sales ? "Sales" : "Inventory");
      else if (role === "template") template = await engine.readTemplate(bytes);
      else if (rawRoles.includes(role) && feedback) {
        const table = await feedbackSales.read(bytes, context, pinned.name);
        data.raw ||= []; data.raw.push(...table.rows.map(r => ({ ...r, source: pinned.name })));
        if (data.raw.length > 300000) throw new Error("Combined weekly exports exceed 300,000 rows.");
      }
      else if (role === "gln") data.gln = await feedbackSales.readGln(bytes);
      else if (clicksStock && ["raw", "dcStock", "periodSales"].includes(role)) data[role] = await clicksInventory.read(bytes, role);
      else if (role === "raw" && sales) data[role] = await salesEngine.readRaw(bytes);
      else data[role] = await engine.readWorkbook(bytes, role);
    }
    await progress("Transforming and reconciling", 75);
    const result = feedback ? feedbackSales.transform(data, context) : clicksStock ? clicksInventory.transform(data, context) : sales ? salesEngine.transform(data, context) : engine.transform(data, manifest.rules, manifest.inputs.raw.name, manifest.mappingPolicy, manifest.outputPolicy, context);
    await progress("Writing review files", 88);
    const workbook = await (sales ? salesEngine : engine).exportWorkbook(result, { runId: id, checksums, ...(context ? { customer: context.customer, pipelineId: context.id } : {}) }, template);
    const name = `${sales ? "sales" : "inventory"}${result.status === "ready" ? "" : "-draft"}.xlsx`;
    await save(name, workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", true);
    for (const [name, rows] of [["facts.jsonl", result.facts], ["exceptions.jsonl", result.exceptions], ["dc.jsonl", result.dcFacts], ["assignments.jsonl", result.assignments]]) {
      await save(name, rows.map(row => JSON.stringify(row)).join("\n"), "application/x-ndjson", true);
    }
    const { facts, exceptions, assignments, dcFacts, referenceCellErrors, warnings, exclusions, regionDecisions, ...summary } = result;
    Object.assign(summary, { warningPreview: warnings.slice(0, 100), exclusionPreview: exclusions.slice(0, 100), regionDecisions: regionDecisions.slice(0, 100), regionDecisionCount: regionDecisions.length });
    const complete = { ...summary, referenceCellErrorCount: referenceCellErrors.length, referenceCellErrors: referenceCellErrors.slice(0, 100), id, completedAt: new Date().toISOString(), inputs: manifest.inputs, checksums, output: { name, sha256: engine.sha(workbook), size: workbook.length }, preview: facts.slice(0, 100).map(row => row.values), exceptionPreview: exceptions.slice(0, 100), assignmentCount: assignments.length, headers: sales ? layout.SALES_HEADERS : engine.HEADERS, workerElapsedMs: Date.now() - started, timings: [...timings, { stage: phase.stage, ms: Date.now() - phase.at }] };
    await save("result.json", JSON.stringify(complete), "application/json", true);
    await progress(result.status === "ready" ? "Ready for approval" : "Review required", 100);
    logger.log(JSON.stringify({ id, status: result.status, totals: result.totals, workerElapsedMs: Date.now() - started, timings }));
  } catch (error) {
    // No tokens, workbook rows or resource URLs are written to service logs.
    const message = String(error.message || "ETL failed").slice(0, 1200);
    await save("failure.json", JSON.stringify({ status: "failed", error: message, completedAt: new Date().toISOString() }), "application/json", true).catch(() => {});
    logger.error(JSON.stringify({ id, error: message }));
    process.exitCode = 1;
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
