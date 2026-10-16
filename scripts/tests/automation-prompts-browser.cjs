"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), http = require("node:http");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { hash } = require("../release-multi-admin.cjs");
const { submitPortalOtp } = require("../validate-dataorbis-connection.cjs");
const stage = process.env.NEXUS_PROMPT_STAGE || path.resolve(__dirname, process.env.NEXUS_PROMPT_REPAIR === "2" ? "../../.tmp/dataorbis-otp-race-20260923" : "../../.tmp/dataorbis-otp-repair-20260923"), portal = path.join(stage, "portal");
const read = name => fs.readFileSync(path.join(portal, name), "utf8");
async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === "/otp-fixture") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<form method="post" action="/totp-insert-code" onsubmit="document.getElementById('codeinput').value=[...document.querySelectorAll('input[type=text]')].map(e=>e.value).join('')">${Array.from({ length: 6 }, (_, i) => `<input id="presented-code-${i + 1}" type="text" maxlength="1" value="9">`).join("")}<input id="codeinput" name="codeinput" type="hidden"><button id="btnSubmit">Continue</button></form>`);
    } else if (req.url === "/totp-insert-code") { req.resume(); res.end("Synthetic portal accepted request"); }
    else if (req.url === "/styles.css") { res.setHeader("Content-Type", "text/css"); res.end(read("styles.css")); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      document.body.append(doc.querySelector("#automationPromptDialog"));
      window.elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(e => [e.id, e]));
      window.state = { activeAutomationPrompt: null, handledPromptIds: new Set() };
      window.ownerPromptUnsubscribe = null;
      window.showToast = message => { window.lastToast = message; };
      window.friendlyError = e => e.message;
      window.calls = 0;
      window.callFunction = async () => { window.calls++; return new Promise(resolve => { window.resolveSubmit = resolve; }); };
      window.auth = { currentUser: { uid: "owner-test", getIdToken: async () => "synthetic-token" } };
      window.firebase = { app: () => ({ options: { projectId: "synthetic-project" } }) };
      const query = { where: () => query, onSnapshot: cb => { window.liveSnapshot = cb; return () => {}; } };
      window.database = { collection: () => query };
      window.fetch = async (url, request) => {
        window.pollRequest = { url, body: JSON.parse(request.body) };
        return { ok: true, json: async () => window.pollRows || [] };
      };
    }, read("index.html"));
    const app = read("app.js").replace(/\r\n/g, "\n");
    for (const name of ["stopOwnerPromptSubscription", "subscribeOwnerPrompts", "handleAutomationPrompt", "syncAutomationPromptModal", "submitAutomationPromptValue"]) {
      const code = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0]; assert.ok(code, name);
      await page.addScriptTag({ content: code });
    }
    await page.evaluate(() => {
      elements.automationPromptForm.addEventListener("submit", event => { event.preventDefault(); submitAutomationPromptValue(); });
      window.fixture = id => ({ id, ownerUid: "owner-test", status: "waiting", type: "otp", codeLength: 6, retailerName: "Wilmar - Game / Makro / Jumbo", message: "Enter the current six-digit Authenticator code for Wilmar in Nexus." });
      syncAutomationPromptModal([fixture("first")]);
    });
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 900 });
      const dimensions = await page.$eval("#automationPromptDialog", e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(dimensions.width > 0 && dimensions.scroll <= dimensions.width + 1);
      await page.screenshot({ path: path.join(stage, `otp-${width}.png`) });
    }
    await page.type("#automationPromptValue", "123");
    await page.evaluate(() => syncAutomationPromptModal([]));
    assert.equal(await page.$eval("#automationPromptDialog", e => e.open), true, "Old workspace cannot close a newer prompt");
    await page.click("button[type=submit]");
    assert.equal(await page.evaluate(() => calls), 0);
    await page.$eval("#automationPromptValue", e => { e.value = "123456"; });
    await page.click("button[type=submit]");
    assert.equal(await page.$eval("button[type=submit]", e => e.textContent), "Sending...");
    await page.evaluate(() => submitAutomationPromptValue());
    assert.equal(await page.evaluate(() => calls), 1);
    await page.evaluate(() => { syncAutomationPromptModal([], { authoritative: true }); syncAutomationPromptModal([fixture("first")]); });
    assert.equal(await page.$eval("#automationPromptDialog", e => e.open), false, "Stale response cannot reopen handled prompt");
    await page.evaluate(() => { syncAutomationPromptModal([fixture("second")]); resolveSubmit({ status: "submitted" }); });
    assert.equal(await page.$eval("#automationPromptDialog", e => e.open), true, "Old request must not close retry prompt");
    assert.equal(await page.evaluate(() => state.activeAutomationPrompt.id), "second");
    assert.equal(await page.$eval("button[type=submit]", e => e.disabled), false);
    await page.evaluate(() => {
      pollRows = [{ document: { name: "projects/synthetic-project/databases/(default)/documents/automationPrompts/polled", fields: {
        ownerUid: { stringValue: "owner-test" }, status: { stringValue: "waiting" }, type: { stringValue: "otp" }, codeLength: { integerValue: "6" }, retailerName: { stringValue: "Wilmar" }
      } } }];
      subscribeOwnerPrompts("owner-test");
    });
    await page.waitForFunction(() => state.activeAutomationPrompt?.id === "polled");
    const request = await page.evaluate(() => pollRequest);
    assert.ok(!request.body.structuredQuery.select.fields.some(f => f.fieldPath === "value"));
    assert.equal(request.body.structuredQuery.where.compositeFilter.filters[0].fieldFilter.value.stringValue, "owner-test");
    await page.evaluate(() => { pollRows = []; });
    await page.waitForFunction(() => !elements.automationPromptDialog.open, { timeout: 8000 });
    await page.evaluate(() => { stopOwnerPromptSubscription({ resetPrompt: true }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/otp-fixture`);
    await submitPortalOtp(page, "012345");
    assert.match(await page.$eval("body", e => e.innerText), /Synthetic portal accepted/);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(stage, process.env.NEXUS_PROMPT_STAGE ? "otp-browser-passed.json" : "browser-passed.json"), JSON.stringify({ at: new Date().toISOString(), tests: "OTP validation, submission lock, stale snapshots, retry race, owner-only HTTP fallback, 1440/390/320px", assets: Object.fromEntries(["app.js", "index.html", "service-worker.js"].map(f => [f, hash(fs.readFileSync(path.join(portal, f)))])) }, null, 2));
    console.log("OTP browser checks passed; only synthetic codes used.");
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
