"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
async function main() {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
  try {
    const page = await browser.newPage(), errors = [], reads = [], failed = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => failed.push({ url: request.url().split("?")[0], reason: request.failure()?.errorText }));
    page.on("request", request => { if (/getSalesforceAttendance(Dashboard|WorkbookSnapshotRows)/.test(request.url())) reads.push(request.url()); });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto("https://meridian-nexus.web.app/#attendance-jobs", { waitUntil: "networkidle2", timeout: 60000 });
    try { await page.waitForFunction(() => document.getElementById("nexusLoginDialog")?.open); }
    catch (error) {
      console.log(JSON.stringify({ errors, failed, page: await page.evaluate(() => ({ hash: location.hash, firebase: !!window.firebase, app: document.querySelector('script[src^="app.js"]')?.src, title: document.title, status: document.getElementById("attendanceJobSummaryStatus")?.textContent, dialog: document.getElementById("nexusLoginDialog")?.open, toast: document.getElementById("toast")?.textContent })) }));
      await page.screenshot({ path: path.resolve(__dirname, "../../.tmp/job-summaries-verification/production-failure.png") });
      throw error;
    }
    assert.equal(await page.$eval("#attendanceJobSummaries", element => element.hidden), false);
    assert.equal(await page.$eval("#attendanceJobSummaryResults", element => element.hidden), true);
    assert.equal(await page.$eval("#attendanceStandardHeader", element => element.hidden), true);
    assert.equal(await page.$eval("#attendanceStandardHeader", element => getComputedStyle(element).display), "none");
    assert.equal(await page.$eval(".job-summary-heading h1", element => element.textContent), "Job Summaries");
    assert.equal(await page.$(".job-summary-heading .eyebrow"), null);
    assert.match(await page.title(), /Job Summaries/);
    assert.deepEqual(reads, [], "Anonymous page must not request attendance records");
    assert.deepEqual(errors, []);
    const directory = path.resolve(__dirname, "../../.tmp/job-summaries-verification");
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, "production-sign-in.png") });
    console.log("PASS: live Job Summaries assets and Nexus login load without JavaScript errors; attendance data is not requested before sign-in.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
