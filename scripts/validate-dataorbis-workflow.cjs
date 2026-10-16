"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path");
const puppeteer = require("../functions/node_modules/puppeteer-core");
const portal = require("../functions/dataorbis-portal");
const sales = require("../functions/dataorbis-sales");
const { finalWorkbook } = require("../functions/dataorbis-workbook");
const { json } = require("./release-multi-admin.cjs");
const { update, unpack, base } = require("./validate-dataorbis-connection.cjs");
const directory = path.resolve(__dirname, "../.tmp/dataorbis-workflow-20260923/live-validation");
const runId = "dataorbis-wilmar-connection-94f1ed0e-6dff-4d31-8d13-4c742b637774";
async function capture() {
  const profile = process.argv[3];
  assert.match(profile, /^puppeteer_dev_chrome_profile-[A-Za-z0-9]+$/);
  const port = Number((await fs.readFile(path.join(process.env.TEMP, profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]);
  assert.ok(port > 0 && port < 65536);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  try {
    const page = (await browser.pages()).find(p => p.url().startsWith(portal.ORIGIN + "/"));
    assert.ok(page);
    const progress = async message => {
      const run = unpack(await json(`${base}/extractionRuns/${runId}?mask.fieldPaths=status&mask.fieldPaths=cancellationRequestedAt`));
      assert.ok(run.status === "running" && !run.cancellationRequestedAt, "Validation was cancelled.");
      await update("extractionRuns", runId, { lastActivityAt: new Date().toISOString(), message: `Validation: ${message} No final workbook published yet.` });
      console.log(message);
    };
    for (const channel of ["game", "wholesale"]) {
      const result = await portal.extractChannel(page, { channel, supplier: "WILMAR SA (PTY) LTD", month: "2026-08", progress });
      await fs.writeFile(path.join(directory, `${channel}-verified.json`), JSON.stringify(result), { flag: "wx" });
      console.log(JSON.stringify({ channel, rows: result.rows.length, reconciliation: result.reconciliation }));
    }
  } finally { browser.disconnect(); }
}
async function transform() {
  const inputs = await Promise.all(["game", "wholesale"].map(async channel => JSON.parse(await fs.readFile(path.join(directory, `${channel}-verified.json`), "utf8"))));
  const raw = inputs.flatMap(input => input.rows.map((v, i) => ({ sheet: input.channel === "game" ? "Game Raw Data" : "Makro Raw Data", line: i + 2, v })));
  const references = await sales.readReferences("C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/SALES DATA STORE NAME CLEAN UP .xlsx", "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/National_Call_Cycle_Masters 01.09.2026.xlsx");
  const result = sales.transform(raw, references, { month: "2026-08", client: "WILMAR", sourceComplete: true, numericConvention: "literal-confirmed", referencesApproved: true, excludeGameOnlineAndNonSa: true });
  await fs.writeFile(path.join(directory, "transform-result.json"), JSON.stringify(result), { flag: "wx" });
  console.log(JSON.stringify({ status: result.status, blockers: result.blockers, totals: result.totals, exceptions: result.exceptions.map(r => ({ store: r.v[1], error: r.error })) }));
  const audit = await sales.draftWorkbook(result, inputs.map(({ channel, reconciliation, capturedAt }) => ({ channel, reconciliation, capturedAt })), { expectedRows: 0, matchedRows: 0, missing: [], extra: [] });
  await fs.writeFile(path.join(directory, "Wilmar Aug26 validation audit.xlsx"), audit, { flag: "wx" });
  const verified = await finalWorkbook("C:/Users/PC/Downloads/Aug26- All Clients by Sku2 Final template.xlsx", path.join(directory, "Aug26- ALL Clients by SKU.xlsx"), result);
  await fs.writeFile(path.join(directory, "final-verification.json"), JSON.stringify(verified, null, 2), { flag: "wx" });
  console.log(JSON.stringify(verified));
}
Promise.resolve().then(() => {
  assert.ok(["capture", "transform"].includes(process.argv[2]));
  return process.argv[2] === "capture" ? capture() : transform();
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
