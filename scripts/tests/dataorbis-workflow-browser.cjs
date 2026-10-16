"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { hash } = require("../release-multi-admin.cjs");
const stage = path.resolve(__dirname, "../../.tmp/dataorbis-workflow-20260923"), portal = path.join(stage, "portal");
const read = file => fs.readFileSync(path.join(portal, file), "utf8").replace(/\r\n/g, "\n");
async function main() {
  const server = http.createServer((req, res) => { if (req.url === "/styles.css") { res.setHeader("Content-Type", "text/css"); res.end(read("styles.css")); } else { res.setHeader("Content-Type", "text/html"); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body></body></html>'); } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
    const page = await browser.newPage(), errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const workspace = doc.querySelector("#operationsWorkspace"); workspace.hidden = false; document.body.append(workspace);
      window.elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(e => [e.id, e]));
      window.state = { isAdmin: true, operationsManualProfileId: "", operationsRunPending: false };
      window.profile = { id: "dataorbis-game-sales", name: "Wilmar - Game / Makro / Jumbo", ready: true };
      window.currentOperationsProfile = () => profile;
      window.isMonthlyAttendanceRetailer = () => false; window.isDailySalesforceAttendanceProfile = () => false;
      window.toggleDateInputLabel = (input, hidden) => { input.closest("label").hidden = hidden; };
      window.operationsMonthlyAttendanceRunOptions = () => ({});
      window.calls = []; window.callFunction = (name, data) => { calls.push({ name, data }); return new Promise(resolve => { window.resolveRun = resolve; }); };
      window.renderExtractionRun = () => {}; window.showToast = () => {}; window.friendlyError = e => e.message;
      window.loadOperationsWorkspace = async () => {};
    }, read("index.html"));
    const source = read("app.js"), fn = name => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
    for (const name of ["isDataOrbisSalesProfile", "renderOperationsManualRunControls", "renderOperationsSchedule"]) await page.addScriptTag({ content: fn(name) });
    const guard = fn("renderOperationsWorkspace").match(/  elements\.operationsRunExtraction\.disabled = [^;]+;/)[0];
    await page.addScriptTag({ content: `window.renderOperationsWorkspace = () => { const profile = currentOperationsProfile(); ${guard} renderOperationsManualRunControls(profile); renderOperationsSchedule(profile, {permissions:{manageSchedules:true}}); };` });
    await page.addScriptTag({ content: source.match(/elements\.operationsRunExtraction\.addEventListener\("click", async \(event\) => \{[^]*?\n\}\);/)?.[0] || source.match(/elements\.operationsRunExtraction\.addEventListener\("click", async \(\) => \{[^]*?\n\}\);/)[0] });
    for (const admin of ["admin-one", "admin-two"]) {
      await page.evaluate(admin => { state.uid = admin; state.operationsManualProfileId = ""; profile.setupRequired = false; renderOperationsWorkspace(); }, admin);
      assert.equal(await page.$eval("#operationsRunExtraction", e => e.disabled), false);
      assert.equal(await page.$eval("#operationsSchedulePanel", e => e.hidden), true);
      assert.match(await page.$eval("#operationsStartDate", e => e.value), /^\d{4}-\d{2}-01$/);
      await page.click("#operationsRunExtraction");
      assert.equal(await page.$eval("#operationsRunExtraction", e => e.disabled), true);
      const count = await page.evaluate(() => calls.length); await page.click("#operationsRunExtraction");
      assert.equal(await page.evaluate(() => calls.length), count);
      await page.evaluate(() => resolveRun({ runId: "synthetic-run" })); await page.waitForFunction(() => !state.operationsRunPending);
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      const fits = await page.$eval("#operationsRunExtraction", e => ({ width: e.clientWidth, scroll: e.scrollWidth, height: e.clientHeight, content: e.scrollHeight }));
      assert.ok(fits.width && fits.scroll <= fits.width + 1 && fits.content <= fits.height + 1);
      await page.screenshot({ path: path.join(stage, `run-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => { profile.setupRequired = true; renderOperationsWorkspace(); });
    assert.equal(await page.$eval("#operationsRunExtraction", e => e.disabled), true);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(stage, "browser-passed.json"), JSON.stringify({ at: new Date().toISOString(), assets: Object.fromEntries(["app.js", "index.html", "service-worker.js"].map(f => [f, hash(fs.readFileSync(path.join(portal, f)))])), admins: 2, widths: [1440, 390, 320] }, null, 2));
    console.log("Two admin Run flows, duplicate-click protection, month defaults, setup guard and responsive button checks passed.");
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
