"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { stage, fn } = require("../release-operations-reports.cjs");
const { decode } = require("../../azure-field-dashboards/attendance-publisher/index.cjs");
const reportsModule = require("../../functions/operations-reports");
async function main() {
  const records = {};
  for (const file of fs.readdirSync(path.join(stage, "records"))) {
    const doc = JSON.parse(fs.readFileSync(path.join(stage, "records", file), "utf8")), id = doc.name.split("/").at(-1);
    records[doc.name.split("/").slice(-2).join("/")] = { id, exists: true, data: () => decode({ mapValue: { fields: doc.fields } }) };
  }
  const db = { collection: name => ({ doc: id => records[`${name}/${id}`] }), getAll: async (...docs) => docs };
  const data = await reportsModule.list({ db, role: "admin", profile: { role: "admin" }, runs: Object.values(records).filter(doc => doc.id.startsWith("dataorbis-wilmar")) });
  assert.equal(data.reports.length, 2); assert.equal(data.reports[0].name, "Aug26- ALL Clients by SKU.xlsx");
  const read = name => fs.readFileSync(path.join(stage, "portal", name), "utf8");
  const server = http.createServer((req, res) => {
    if (req.url === "/styles.css") { res.setHeader("Content-Type", "text/css"); res.end(read("styles.css")); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
    const page = await browser.newPage(), errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(({ html, data }) => {
      const doc = new DOMParser().parseFromString(html, "text/html"), panel = doc.querySelector("#automationDeliveryHistory").closest("section");
      document.body.style.padding = "16px"; panel.style.maxWidth = "760px"; document.body.append(panel);
      for (const id of ["adminDeliveryList", "adminDeliverySummary"]) { const element = document.createElement("div"); element.id = id; element.hidden = true; document.body.append(element); }
      window.elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(element => [element.id, element]));
      window.state = { files: [], operationsWorkspace: data }; window.sortFilesNewestFirst = () => 0;
      window.escapeHtml = value => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
      window.formatDate = () => "23 Sep 2026"; window.updateSelectionControls = () => {};
      window.calls = []; window.downloads = []; window.toasts = [];
      window.callFunction = async (name, args) => { calls.push({ name, args }); return { chunk: "dGVzdA==", size: 4, nextOffset: 4, complete: true, generation: "123" }; };
      window.triggerDownload = url => downloads.push(url); window.showToast = message => toasts.push(message);
      window.storage = { ref: () => { throw Error("Legacy storage must not be called"); } };
    }, { html: read("index.html"), data });
    const app = read("app.js");
    for (const name of ["reportFiles", "renderReportDeliveries", "getDownloadUrl", "downloadFiles"]) await page.addScriptTag({ content: fn(app, name) });
    const handler = app.match(/  const download = event\.target\.closest\("\[data-download-delivery\]"\);[^]*?\n  \}/)[0];
    await page.addScriptTag({ content: `document.addEventListener("click", event => {${handler}});renderReportDeliveries();` });
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 700 });
      assert.equal(await page.$$eval("#automationDeliveryHistory [data-download-delivery]", items => items.length), 2);
      await page.click("#automationDeliveryHistory [data-download-delivery]"); await page.waitForFunction(() => !state.busy);
      const fit = await page.$eval("#automationDeliveryHistory", element => ({ width: element.clientWidth, content: element.scrollWidth }));
      assert.ok(fit.content <= fit.width + 1, `Report rows overflow at ${width}: ${JSON.stringify(fit)}`);
      await page.screenshot({ path: path.join(stage, `reports-${width}.png`), fullPage: true });
    }
    assert.equal(await page.evaluate(() => calls.length), 3);
    assert.equal(await page.evaluate(() => calls.every(call => call.name === "getPortalResourceDownload" && call.args.kind === "extraction-report")), true);
    await page.evaluate(() => { state.operationsWorkspace = { reports: [], reportsStatus: "unavailable" }; renderReportDeliveries(); });
    assert.match(await page.$eval("#automationDeliveryHistory", e => e.textContent), /could not be loaded/);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(stage, "browser-passed.json"), JSON.stringify({ at: new Date().toISOString(), widths: [1440, 390, 320],
      actualSavedMetadata: true, legacyFilesEmpty: true, authenticatedDownloadApiMocked: true, portalCalls: 0 }, null, 2));
    console.log("Saved Wilmar metadata, desktop/mobile report rendering and checked download wiring passed; no extraction or live download started.");
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
