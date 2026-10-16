const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("../functions/node_modules/puppeteer-core");

async function main() {
  const root = path.resolve(__dirname, "..");
  const live = process.argv.includes("--live");
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    args: ["--no-first-run", "--disable-extensions"]
  });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => {
      const url = new URL(request.url());
      failedRequests.push({ url: url.origin + url.pathname, error: request.failure()?.errorText });
    });
    await page.setBypassServiceWorker(true);
    if (!live) {
      await page.setRequestInterception(true);
      page.on("request", request => {
        const url = new URL(request.url());
        if (url.origin === "https://meridian-nexus.web.app" && url.pathname === "/app.js") {
          request.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(root, "public/app.js")) });
        } else request.continue();
      });
    }
    await page.goto("https://meridian-nexus.web.app/#insights", { waitUntil: "load", timeout: 90000 });
    try {
      await page.waitForFunction(() => typeof database !== "undefined" && database !== null && typeof auth !== "undefined" && auth !== null);
    } catch (error) {
      console.log(JSON.stringify({ pageErrors, failedRequests, state: await page.evaluate(() => ({ firebase: typeof firebase, database: typeof database, app: document.querySelector('script[src*="app.js"]')?.src })) }, null, 2));
      throw error;
    }
    const settings = await page.evaluate(() => {
      const settings = database._delegate._getSettings();
      return {
        sdk: firebase.SDK_VERSION,
        forceLongPolling: settings.experimentalForceLongPolling,
        autoDetectLongPolling: settings.experimentalAutoDetectLongPolling,
        pollingTimeout: settings.experimentalLongPollingOptions.timeoutSeconds,
        signedIn: Boolean(auth.currentUser)
      };
    });
    assert.equal(settings.sdk, "12.15.0");
    assert.equal(settings.forceLongPolling, true);
    assert.equal(settings.autoDetectLongPolling, false);
    assert.equal(settings.pollingTimeout, 25);
    assert.equal(settings.signedIn, false, "This check must not impersonate or sign in any user");
    await new Promise(resolve => setTimeout(resolve, 3000));
    assert.deepEqual(pageErrors, [], "The extension-free browser must have no uncaught application errors");
    console.log(JSON.stringify({ target: live ? "production" : "local app against production SDK", ...settings, pageErrors }, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
