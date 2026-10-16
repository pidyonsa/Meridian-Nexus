"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), puppeteer = require("../../functions/node_modules/puppeteer-core");
const { defaults, CHANNELS, pipelineId } = require("../../functions/etl-pipelines");
const root = path.resolve(__dirname, "../.."), stage = process.env.NEXUS_PORTAL_STAGE || path.join(root, "public"), out = process.env.NEXUS_ETL_TEST_OUTPUT || path.join(root, ".tmp/etl-feedback-20260925/browser");
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const shared = Object.fromEntries(["products", "stores", "staffing", "dc", "status", "inventorySample", "salesSample", "gln"].map(r => [r, r]));
  const resources = [...Object.keys(shared), "raw", "dcStock", "periodSales"].map(id => ({ id, sourceName: id + ".xlsx", title: id, size: 100 }));
  for (const id of ["week1", "week2"]) resources.push({ id, sourceName: id + ".txt", title: id, size: 100 });
  let browser; const calls = [], errors = [];
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
    const page = await browser.newPage(); page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main id="test-etls" class="etl"></main></body></html>');
    await page.addStyleTag({ path: path.join(stage, "etls.css") });
    await page.exposeFunction("fixtureCall", async data => {
      calls.push(data);
      if (data.action === "catalogue") return { resources, referenceSet: { resources: shared, revision: 5 }, pipelines: defaults(), channels: CHANNELS };
      if (data.action === "history") return { runs: [] };
      if (data.action === "run") return { id: "f".repeat(32) };
      if (data.action === "detail") return { run: { id: "f".repeat(32), sourceName: "Synthetic only", status: "ready", createdAt: new Date().toISOString() }, result: null };
      throw Error("Unexpected browser fixture action");
    });
    await page.exposeFunction("fixtureUpload", async (role, name) => { const resource = { id: "upload" + resources.length, sourceName: name, title: name, size: 100 }; resources.push(resource); return resource; });
    await page.evaluate(() => { window.MeridianEtlPortals = { create: () => ({ overview: () => "", view: () => "", refresh() {}, stop() {} }) }; });
    await page.addScriptTag({ path: path.join(stage, "etls.js") });
    await page.evaluate(() => { window.session = MeridianEtls.mount(document.getElementById("test-etls"), { call: window.fixtureCall, upload: (role, file) => window.fixtureUpload(role, file.name) }); });
    await page.waitForSelector("#etl-row-customer-clicks");
    async function open(customer, channel, kind) {
      await page.click('.etl-tabs [data-tab="pipelines"]');
      await page.select(`#etl-row-customer-${channel}`, customer);
      const id = pipelineId(customer, channel, kind); await page.select(`#etl-row-kind-${channel}`, id);
      await page.click(`[data-pipeline="${id}"][data-destination="run"]`); await page.waitForSelector("#etlRunForm");
    }
    async function pictures(label) {
      for (const width of [1440, 390, 320]) {
        await page.setViewport({ width, height: 900 });
        const bounds = await page.$eval("#test-etls", e => ({ client: e.clientWidth, scroll: e.scrollWidth })); assert.ok(bounds.scroll <= bounds.client + 1, label + " overflow at " + width);
        const overlaps = await page.$$eval('.etl-file-row', rows => rows.some(row => { const cells = [...row.children].map(e => e.getBoundingClientRect()); return cells.some((a,i) => cells.some((b,j) => j > i && Math.min(a.right,b.right) - Math.max(a.left,b.left) > 2 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 2)); })); assert.equal(overlaps, false);
        await page.screenshot({ path: path.join(out, `${label}-${width}.png`), fullPage: true });
      }
      await page.setViewport({ width: 1440, height: 1000 });
    }
    await open("Ethica", "clicks", "Inventory"); assert.equal(await page.$$eval("[data-upload]", es => es.length), 3);
    assert.equal(await page.$('[name="salesDays"]'), null); assert.equal(await page.$eval('#etlRunForm [type="submit"]', e => e.disabled), true);
    await page.select("#etl-raw", "raw"); await page.select("#etl-dcStock", "dcStock"); await page.select("#etl-periodSales", "periodSales");
    assert.equal(await page.$eval('#etlRunForm [type="submit"]', e => e.disabled), false); await pictures("clicks-inventory");
    await page.click('#etlRunForm [type="submit"]'); await page.waitForSelector('[data-tab="review"][aria-current="page"]');
    assert.deepEqual(calls.filter(c => c.action === "run").at(-1).resources, { raw: "raw", dcStock: "dcStock", periodSales: "periodSales" });
    await open("aQuelle", "game", "Sales");
    assert.equal(await page.$eval('[data-upload="raw"]', e => e.multiple), true); assert.match(await page.$eval('[data-upload="raw"]', e => e.accept), /txt/);
    await page.select("#etl-raw", "week1"); await page.select("#etl-raw", "week2");
    assert.equal(await page.$$eval("[data-remove-file]", e => e.length), 2);
    await page.click('[data-remove-file="week2"]'); assert.equal(await page.$$eval("[data-remove-file]", e => e.length), 1);
    await page.select("#etl-raw", "week2"); await page.evaluate(() => { const m = document.getElementById("etl-report-month"); m.value = "2026-07"; m.dispatchEvent(new Event("change", { bubbles: true })); });
    for (const n of ["uploaded-1.txt", "uploaded-2.txt"]) fs.writeFileSync(path.join(out, n), "SYNTHETIC TEST ONLY");
    const fileInput = await page.$('[data-upload="raw"]'); await fileInput.uploadFile(path.join(out, "uploaded-1.txt"), path.join(out, "uploaded-2.txt"));
    await page.waitForFunction(() => document.querySelectorAll("[data-remove-file]").length === 4 && !document.querySelector('#etlRunForm [type="submit"]').disabled);
    assert.equal(await page.$eval("#etl-report-month", e => e.value), "2026-07"); await pictures("weekly-files");
    await page.click('#etlRunForm [type="submit"]'); await page.waitForSelector('[data-tab="review"][aria-current="page"]');
    const weekly = calls.filter(c => c.action === "run").at(-1); assert.equal(weekly.reportMonth, "2026-07"); assert.equal(weekly.resources.raw.length, 4);
    await open("Saldanha", "shoprite", "Sales");
    assert.equal(await page.$eval('#etl-raw', e => e.value), ""); assert.ok((await page.$eval('.etl-reference-summary', e => e.textContent)).includes("gln.xlsx"));
    assert.equal(await page.$$eval("[data-upload]", e => e.length), 1); await pictures("shoprite-month");
    assert.deepEqual(errors, []); await page.evaluate(() => session.stop());
    fs.writeFileSync(path.join(out, "verified.json"), JSON.stringify({ syntheticOnly: true, realJobsStarted: false, viewports: [1440,390,320], runCalls: calls.filter(c => c.action === "run"), errors }, null, 2));
    console.log("Feedback controls passed: three Clicks inputs, multiple weekly uploads, reporting month, inherited GLN, desktop/mobile layout.");
  } finally { if (browser) await browser.close(); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
