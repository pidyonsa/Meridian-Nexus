"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { parseArgs } = require("node:util");
const engine = require("../functions/dataorbis-sales.js");

async function main() {
  const { values: args } = parseArgs({ options: Object.fromEntries(["raw", "template", "cleanup", "call-cycle", "month", "client", "out"].map(k => [k, { type: "string" }])) });
  for (const name of ["raw", "template", "cleanup", "call-cycle", "month", "client", "out"]) if (!args[name]) throw new Error(`Missing --${name}. This command validates locally; it never publishes.`);
  const files = [args.raw, args.template, args.cleanup, args["call-cycle"]];
  const before = await Promise.all(files.map(async file => engine.sha(await fs.readFile(file))));
  const raw = await engine.readRaw(args.raw);
  const refs = await engine.readReferences(args.cleanup, args["call-cycle"]);
  const result = engine.transform(raw.rows, refs, { month: args.month, client: args.client });
  if (!raw.expected.length) throw new Error("A worked example is required for this validation command.");
  const comparison = engine.reconcile(result, raw.expected);
  const template = await engine.inspectTemplate(args.template, { month: args.month, client: args.client });
  const provenance = { raw: raw.provenance, references: refs.provenance, template };
  const draft = await engine.draftWorkbook(result, provenance, comparison);
  const after = await Promise.all(files.map(async file => engine.sha(await fs.readFile(file))));
  if (before.some((hash, i) => hash !== after[i])) throw new Error("An input changed during validation; discard this run and retry.");
  const out = path.resolve(args.out);
  await fs.mkdir(out, { recursive: false });
  const audit = { validatedAt: new Date().toISOString(), inputsUnchanged: true, publicationEnabled: false, ...provenance, result, comparison };
  await fs.writeFile(path.join(out, "validation.json"), JSON.stringify(audit, null, 2), { flag: "wx" });
  await fs.writeFile(path.join(out, "Game-Makro-sales-DRAFT.xlsx"), draft, { flag: "wx" });
  const exceptionGroups = {};
  for (const r of result.exceptions) {
    const id = JSON.stringify([r.sheet, r.v[1], r.v[2], r.error]);
    const item = exceptionGroups[id] ||= { sheet: r.sheet, siteCode: r.v[1], site: r.v[2], issue: r.error, rows: 0 };
    item.rows++;
  }
  const summary = { status: result.status, blockers: result.blockers, totals: result.totals,
    comparison: { expected: comparison.expectedRows, matched: comparison.matchedRows, missing: comparison.missing.length, extra: comparison.extra.length },
    exceptions: Object.values(exceptionGroups), referenceWarnings: result.referenceWarnings, templateRowsPreserved: template.rows, conflictingRows: template.conflictingRows, inputsUnchanged: true,
    output: path.join(out, "Game-Makro-sales-DRAFT.xlsx"), sharedFilesWritten: 0, schedulesEnabled: 0 };
  await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2), { flag: "wx" });
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
