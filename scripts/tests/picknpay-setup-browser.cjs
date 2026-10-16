"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { setupDocument } = require("../restore-picknpay-setup.cjs");
const root = path.resolve(__dirname, "../.."), portal = process.env.NEXUS_PORTAL_STAGE || path.join(root, "public"), out = path.join(root, ".tmp/picknpay-restoration-20260909/browser");
const read = name => fs.readFileSync(path.join(portal, name), "utf8").replace(/\r\n/g, "\n");
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    if (req.url === "/styles.css") { res.setHeader("Content-Type", "text/css"); res.end(fs.readFileSync(path.join(root, "public/styles.css"))); return; }
    res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request", r => new URL(r.url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle0" });
    await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const panel = doc.querySelector('[data-admin-panel="retailers"]'); panel.hidden = false;
      const main = document.createElement("main"); main.id = "adminView"; main.className = "admin-page view"; main.append(panel); document.body.append(main);
      window.elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(el => [el.id, el]));
      window.state = { retailers: [], extractionProfiles: [] };
      window.syncSalesforceConnectedAppFields = () => {};
      window.escapeHtml = value => { const el = document.createElement("span"); el.textContent = String(value || ""); return el.innerHTML.replaceAll('"', "&quot;"); };
    }, read("index.html"));
    const app = read("app.js");
    for (const name of ["syncExtractionProfileOptions", "renderRetailerSetupStatus", "resetRetailerForm", "editRetailer", "hasExtractionSteps"]) {
      const body = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]; assert.ok(body, name); await page.addScriptTag({ content: body });
    }
    await page.evaluate(data => { state.retailers = [{ id: "picknpay", ...data }]; editRetailer("picknpay"); }, setupDocument());
    assert.equal(await page.$eval("#retailerFormTitle", e => e.textContent), "Pick n Pay Sales");
    assert.match(await page.$eval("#retailerSetupStatus", e => e.textContent), /credentials are missing/);
    assert.equal(await page.$eval("#retailerExtractionProfile", e => e.value), "");
    assert.equal(await page.evaluate(() => hasExtractionSteps(state.retailers[0])), false);
    assert.equal(await page.$eval("#retailerUsername", e => e.value), "");
    assert.equal(await page.$eval("#retailerPassword", e => e.value), "");
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      const size = await page.$eval("#retailerSetupStatus", e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(size.width > 0 && size.scroll <= size.width + 1, `Setup status overflows at ${width}`);
      await page.screenshot({ path: path.join(out, `setup-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => { state.retailers[0].username = "synthetic"; state.retailers[0].credentialsUpdatedAt = "2026-09-09"; editRetailer("picknpay"); });
    assert.match(await page.$eval("#retailerSetupStatus", e => e.textContent), /credentials saved/);
    await page.evaluate(() => resetRetailerForm());
    assert.equal(await page.$eval("#retailerSetupStatus", e => e.hidden), true);
    assert.equal(await page.$eval("#retailerSetupStatus", e => e.textContent), "");
    assert.deepEqual(errors, []);
    console.log("Pick n Pay setup: actual editor hooks, missing/saved credentials, unlinked readiness, reset and 1440/390/320px status layout passed. Synthetic only; no retailer login or Firebase calls.");
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
