"use strict";
const assert = require("node:assert/strict"), http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const stage = path.resolve(__dirname, "../../.tmp/navigation-cache-20260924");
const sources = { old: fs.readFileSync(path.join(stage, "service-worker.before.js"), "utf8"), fixed: fs.readFileSync(path.join(stage, "service-worker.js"), "utf8") };
let worker = "old", version = "old", fail = false;
const html = () => `<!doctype html><meta charset="utf-8"><title>ETL cache regression</title><h1>${version}</h1><input id="unsaved"><script>navigator.serviceWorker.register('/service-worker.js');</script>`;
const server = http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/service-worker.js") { res.setHeader("Content-Type", "application/javascript"); res.end(sources[worker]); }
  else if (["/", "/index.html"].includes(url.pathname)) { res.setHeader("Content-Type", "text/html"); res.statusCode = fail ? 503 : 200; res.end(fail ? "temporary failure" : html()); }
  else { res.setHeader("Content-Type", url.pathname.endsWith(".js") ? "application/javascript" : "text/plain"); res.end("/* synthetic public asset */"); }
});
(async () => {
  let browser;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--no-first-run", "--disable-background-networking"] });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    version = "new-shared-files";
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(await page.$eval("h1", el => el.textContent), "old", "reproduce old navigation cache bug");
    await page.type("#unsaved", "do not discard this selection");
    worker = "fixed";
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await new Promise((resolve, reject) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        registration.update().catch(reject);
      });
    });
    assert.equal(await page.$eval("#unsaved", el => el.value), "do not discard this selection", "upgrade must not reload an active form");
    assert.equal(await page.$eval("h1", el => el.textContent), "old");
    version = "latest-shared-files";
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(await page.$eval("h1", el => el.textContent), "latest-shared-files", "first navigation gets current HTML");
    assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
    fail = true;
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(await page.$eval("h1", el => el.textContent), "latest-shared-files", "503 fallback");
    fail = false;
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.$eval("h1", el => el.textContent), "latest-shared-files", "offline fallback");
    await page.setOfflineMode(false);
    await page.evaluate(async () => { await fetch("/api/private"); await fetch("/report.xlsx"); });
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys(); const urls = [];
      for (const key of keys) for (const entry of await (await caches.open(key)).keys()) urls.push(entry.url);
      return { keys, urls };
    });
    assert.deepEqual(cached.keys, ["meridian-nexus-20260924-fresh-navigation"]);
    assert.ok(!cached.urls.some(url => /api\/private|report\.xlsx/.test(url)));
    console.log("Real Edge: reproduced stale form; verified fresh first navigation, upgrade preserves input, offline/503 fallback, private request bypass.");
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
