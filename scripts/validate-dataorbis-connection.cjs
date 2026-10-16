"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const puppeteer = require("../functions/node_modules/puppeteer-core");
const { json, api, fnUrl } = require("./release-multi-admin.cjs");
const { encode } = require("./update-dataorbis-validation.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const { inspect } = require("./inspect-dataorbis-portal.cjs");
const JSZip = require("../functions/node_modules/jszip");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const profileId = "dataorbis-game-sales";
const ownerUid = "obJuTf8pD3gnNcH9VI0lt74XWZ33";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function fields(data) {
  const result = encode(data).mapValue.fields;
  for (const name of ["createdAt", "startedAt", "completedAt", "lastActivityAt", "consumedAt", "closedAt"]) {
    if (data[name]) result[name] = { timestampValue: new Date(data[name]).toISOString() };
  }
  return result;
}
const unpack = doc => decode({ mapValue: { fields: doc.fields } });
const now = () => new Date().toISOString();

async function submitPortalOtp(page, value) {
  assert.match(value, /^\d{6}$/);
  for (let index = 0; index < 6; index++) {
    const selector = `#presented-code-${index + 1}`;
    await page.$eval(selector, e => { e.focus(); e.select(); });
    await page.type(selector, value[index]);
  }
  assert.ok(await page.evaluate(expected => [...document.querySelectorAll('input[id^="presented-code-"]')].map(e => e.value).join("") === expected, value), "Portal OTP fields did not match the submitted code.");
  const [request] = await Promise.all([
    page.waitForRequest(req => new URL(req.url()).pathname === "/totp-insert-code" && req.method() === "POST", { timeout: 20000 }),
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {}), page.click("#btnSubmit")
  ]);
  assert.ok(new URLSearchParams(request.postData()).get("codeinput") === value, "Portal did not send the supplied OTP correctly.");
}

async function inspectSession(page, username, runId, heartbeat) {
  const readline = require("node:readline"), path = require("node:path"), fs = require("node:fs");
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const timeout = setTimeout(() => lines.close(), 75 * 60 * 1000);
  console.log(JSON.stringify({ status: "inspection-session-open", runId, commands: ["inspect", "frames", "click", "press", "screenshot", "probe", "invoke", "finish"] }));
  try {
    for await (const line of lines) {
      try {
        const command = JSON.parse(line);
        if (command.action === "finish") break;
        assert.equal(new URL(page.url()).origin, "https://pyramid.dataorbis.com");
        if (!await heartbeat()) break;
        if (command.action === "probe") {
          assert.ok(!/login|totp/i.test(new URL(page.url()).pathname));
          console.log(redact(await page.$$eval(command.selector, nodes => nodes.slice(0, 20).map(node => {
            const clone = node.cloneNode(true);
            for (const input of clone.querySelectorAll("input")) input.removeAttribute("value");
            return clone.outerHTML.slice(0, 30000);
          })), username));
          continue;
        } else if (command.action === "invoke") {
          assert.ok(!/login|totp/i.test(new URL(page.url()).pathname));
          assert.ok(["inspectReport", "selectSupplier", "configureMonth", "configureDimensions", "copyRawData", "openReport"].includes(command.name));
          const modulePath = require.resolve("../functions/dataorbis-portal.js");
          delete require.cache[modulePath];
          const driver = require(modulePath);
          const result = await driver[command.name](page, command.options || {});
          if (command.name === "copyRawData") {
            const folder = path.resolve(__dirname, "../.tmp/dataorbis-workflow-20260923/live-validation");
            fs.mkdirSync(folder, { recursive: true });
            const file = path.join(folder, `raw-${Date.now()}.json`);
            fs.writeFileSync(file, JSON.stringify(result), { flag: "wx" });
            console.log(JSON.stringify({ rawEvidence: file, rows: result.rows?.length, publishedWorkbooks: 0 }));
          } else console.log(redact(result, username));
          continue;
        } else if (command.action === "click") {
          assert.equal(typeof command.selector, "string");
          await page.click(command.selector, { clickCount: command.double ? 2 : 1, button: command.right ? "right" : "left" });
          await sleep(3000);
        } else if (command.action === "press") {
          assert.ok(["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "PageDown"].includes(command.key));
          await page.keyboard.press(command.key); await sleep(2000);
        } else if (command.action === "screenshot") {
          assert.ok(!/login|totp|code/i.test(new URL(page.url()).pathname), "Do not capture authentication screens.");
          const folder = path.resolve(__dirname, "../.tmp/dataorbis-live-validation-20260923"); fs.mkdirSync(folder, { recursive: true });
          const file = path.join(folder, `portal-${Date.now()}.png`); await page.screenshot({ path: file }); console.log(JSON.stringify({ screenshot: file }));
        } else assert.ok(["inspect", "frames"].includes(command.action));
        const frames = page.frames();
        const target = frames[command.frame || 0];
        if (command.action === "frames") console.log(redact(frames.map((frame, i) => ({ index: i, name: frame.name(), url: frame.url().split("?")[0] })), username));
        else console.log(redact(await target.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 16000),
          controls: [...document.querySelectorAll("button, a, [role=button], [role=treeitem], input, [title]")].filter(e => e.getClientRects().length).slice(0, 160).map(e => ({ tag: e.tagName, id: e.id, role: e.getAttribute("role"), title: e.title, label: e.getAttribute("aria-label"), text: (e.innerText || "").slice(0, 140), type: e.type, class: e.className }))
        })), username));
      } catch (error) { console.log(redact({ inspectionError: error.name, message: String(error.message).replace(/\b\d{6}\b/g, "[code]").slice(0, 400) }, username)); }
    }
  } finally { clearTimeout(timeout); lines.close(); }
}

function redact(value, username) {
  return JSON.stringify(value, null, 2).split(username).join("[saved username]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]");
}

async function update(collection, id, data, deleted = []) {
  const query = new URLSearchParams();
  for (const key of [...Object.keys(data), ...deleted]) query.append("updateMask.fieldPaths", key);
  query.set("currentDocument.exists", "true");
  return json(`${base}/${collection}/${id}?${query}`, "PATCH", { fields: fields(data) });
}

async function create(collection, id, data) {
  return json(`${base}/${collection}?documentId=${encodeURIComponent(id)}`, "POST", { fields: fields(data) });
}

async function verifyWorkerGuard() {
  const fn = await json(fnUrl("processExtraction"));
  const source = fn.buildConfig.source.storageSource;
  const archive = await JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
  const code = await archive.file("index.js").async("string");
  assert.match(code, /if \(run\.status !== "queued"\) return false;/);
  assert.match(code, /if \(!await claimQueuedExtractionRun\(runRef, event\.id\)\)/);
  assert.ok(!code.includes('run.workflowMode === "dataorbis-connection-validation"'));
}

async function main() {
  assert.equal(process.argv[2], "wilmar", "Specify wilmar; no other client's credentials may be used.");
  const mask = new URLSearchParams();
  for (const field of ["name", "webAddress", "username", "salesProcedure", "extractionProfileId", "steps"]) mask.append("mask.fieldPaths", field);
  const profile = unpack(await json(`${base}/retailers/${profileId}?${mask}`));
  assert.equal(profile.salesProcedure?.clientCode, "WILMAR");
  assert.equal(new URL(profile.webAddress).origin, "https://pyramid.dataorbis.com");
  assert.ok(profile.username);
  const owner = unpack(await json(`${base}/adminUsers/${ownerUid}?mask.fieldPaths=role&mask.fieldPaths=disabled`));
  assert.equal(owner.role, "admin");
  assert.notEqual(owner.disabled, true);
  await verifyWorkerGuard();

  const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  let runId = "", promptId = "";
  const timeline = [];
  const event = (name, message) => { timeline.push({ at: now(), event: name, message }); };
  async function runUpdate(status, message) {
    event(status, message);
    await update("extractionRuns", runId, { status, message, lastActivityAt: now(), executionTimeline: timeline });
  }
  async function requestOtp(attempt = 1) {
    if (!runId) {
      runId = `dataorbis-wilmar-connection-${crypto.randomUUID()}`;
      event("connection-check", "Wilmar portal connection validation only. No reports or workbooks will be published.");
      // Non-queued checks cannot be claimed by the deployed extraction worker.
      await create("extractionRuns", runId, { retailerId: profileId, retailerName: `${profile.name} (connection check only)`,
        extractionName: "Wilmar connection check - no report export", workflowMode: "dataorbis-connection-validation",
        trigger: "manual-validation", createdBy: ownerUid, promptOwnerUid: ownerUid,
        status: "running", message: timeline[0].message, createdAt: now(), startedAt: now(), lastActivityAt: now(),
        executionTimeline: timeline, totalSteps: 2, currentStep: 1, publicationEnabled: false });
    }
    promptId = `${runId}-otp-${crypto.randomUUID()}`;
    await create("automationPrompts", promptId, { runId, retailerId: profileId, retailerName: "Wilmar - Game / Makro / Jumbo",
      ownerUid, type: "otp", status: "waiting", inputRequired: true, codeLength: 6, createdAt: now(),
      message: `${attempt > 1 ? "DataOrbis rejected the previous code. Wait for the Authenticator to show a NEW code, then enter it here. " : ""}Wilmar connection check: enter the current 6-digit Authenticator code for the Wilmar DataOrbis account. This check will not publish a monthly workbook.` });
    await runUpdate("waiting_otp", "Waiting for the run owner to enter the DataOrbis OTP in Nexus. Connection check only.");
    console.log(JSON.stringify({ status: "waiting_otp", runId, open: "https://meridian-nexus.web.app/#automation", noReportExport: true }));
    const deadline = Date.now() + 7 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(1000);
      const run = unpack(await json(`${base}/extractionRuns/${runId}?mask.fieldPaths=status&mask.fieldPaths=cancellationRequestedAt`));
      if (run.cancellationRequestedAt || !["running", "waiting_otp"].includes(run.status)) throw new Error("Connection check was stopped.");
      const prompt = unpack(await json(`${base}/automationPrompts/${promptId}`));
      if (prompt.status === "cancelled") throw new Error("OTP prompt cancelled.");
      if (prompt.status === "submitted") {
        assert.equal(prompt.handledBy, ownerUid);
        assert.ok(typeof prompt.value === "string" && prompt.value.length <= 80);
        await update("automationPrompts", promptId, { status: "consumed", consumedAt: now() }, ["value"]);
        await runUpdate("running", "Validating the owner-supplied portal code. No report export.");
        return prompt.value;
      }
    }
    throw new Error("OTP prompt timed out.");
  }
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(profile.webAddress, { waitUntil: "networkidle2", timeout: 60000 });
    assert.equal(new URL(page.url()).origin, "https://pyramid.dataorbis.com");
    await page.waitForSelector("#presented-username", { visible: true, timeout: 20000 });
    assert.equal(await page.$eval("#login-form", e => new URL(e.action).origin), "https://pyramid.dataorbis.com");
    const secret = unpack(await json(`${base}/retailerSecrets/${profileId}`));
    const keyResponse = await json("https://secretmanager.googleapis.com/v1/projects/meridain-nexus/secrets/RETAILER_CREDENTIAL_KEY/versions/latest:access");
    const key = Buffer.from(Buffer.from(keyResponse.payload.data, "base64").toString("utf8").trim(), "base64");
    assert.equal(key.length, 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
    decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
    const password = Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]);
    try {
      await page.type("#presented-username", profile.username);
      await page.type("#password", password.toString("utf8"));
    } finally { password.fill(0); key.fill(0); }
    await page.click("#btnSubmit");
    await sleep(10000);
    assert.equal(new URL(page.url()).origin, "https://pyramid.dataorbis.com");
    let snapshot = await inspect(page);
    console.log(redact({ phase: "after-login", ...snapshot }, profile.username));
    const otpSelectors = ["#presented-code-1", "input[autocomplete=one-time-code]", "#otp", "#verificationCode", "input[name=otp]", "input[name=code]"];
    let otpSelector = "";
    for (const selector of otpSelectors) {
      if (await page.$eval(selector, e => !!e.getClientRects().length).catch(() => false)) { otpSelector = selector; break; }
    }
    for (let attempt = 1; otpSelector && attempt <= 3; attempt++) {
      const value = await requestOtp(attempt);
      assert.equal(new URL(page.url()).origin, "https://pyramid.dataorbis.com");
      if (otpSelector === "#presented-code-1") {
        assert.match(value, /^\d{6}$/);
        assert.equal(await page.$eval("#totop-insert-code-form", e => new URL(e.action).origin), "https://pyramid.dataorbis.com");
        await submitPortalOtp(page, value);
      } else {
        await page.type(otpSelector, value);
        await page.focus(otpSelector);
        await page.keyboard.press("Enter");
      }
      await sleep(2000);
      snapshot = await inspect(page);
      console.log(redact({ phase: "after-otp", ...snapshot }, profile.username));
      if (!/totp/i.test(new URL(page.url()).pathname)) break;
      await update("automationPrompts", promptId, { status: "rejected", closedAt: now() }, ["value"]);
      await runUpdate("running", "DataOrbis did not accept the code. A fresh OTP must be entered in Nexus; no code will be reused.");
      if (!/something wasn.t right|try again|invalid|expired/i.test(snapshot.text)) break;
    }
    // A disappearing password box alone is not proof of authentication.
    let verified = /Massdiscounters Supplier Reports|Massmart Wholesale Supplier Reports/i.test(snapshot.text)
      && !/login\/login\.html/.test(snapshot.path);
    console.log(JSON.stringify({ status: verified ? "authenticated-report-folders-visible" : "needs-portal-review", otpUsed: !!promptId,
      extractedReports: 0, publishedWorkbooks: 0, schedulesChanged: false }));
    if (process.argv.includes("--inspect-session") && runId && !/login|totp/i.test(new URL(page.url()).pathname)) {
      await inspectSession(page, profile.username, runId, async () => {
        const run = unpack(await json(`${base}/extractionRuns/${runId}?mask.fieldPaths=status&mask.fieldPaths=cancellationRequestedAt`));
        if (run.cancellationRequestedAt || run.status !== "running") return false;
        await update("extractionRuns", runId, { lastActivityAt: now(), message: "Inspecting authenticated Wilmar report controls. No report export or template publication yet." });
        return true;
      });
      snapshot = await inspect(page);
      verified = verified || (!/login|totp/i.test(new URL(page.url()).pathname)
        && /Monthly Sales Performance/.test(snapshot.text) && /Sales Quantity/.test(snapshot.text) && /Sales Value Excl/.test(snapshot.text));
    }
    if (runId) {
      await runUpdate("cancelled", verified
        ? "Connection check verified report-folder access and stopped as planned. No sales extraction or monthly template update was run."
        : "Connection check stopped for portal review. No sales extraction or monthly template update was run.");
      await update("extractionRuns", runId, { completedAt: now(), connectionValidation: { verified, noReportExport: true } });
    }
  } finally {
    try {
      if (promptId) await update("automationPrompts", promptId, { status: "closed", closedAt: now() }, ["value"]).catch(() => {});
      if (runId) {
        const run = unpack(await json(`${base}/extractionRuns/${runId}?mask.fieldPaths=status`));
        if (["running", "waiting_otp"].includes(run.status)) {
          await runUpdate("cancelled", "Connection validation ended without a report export or monthly template update.");
          await update("extractionRuns", runId, { completedAt: now() });
        }
      }
    } finally {
      await browser.close();
    }
  }
}

if (require.main === module) main().catch(error => { console.error(`Connection check stopped: ${error.name}. No report was published.`); process.exitCode = 1; });
module.exports = { redact, fields, submitPortalOtp, inspectSession, update, unpack, base };
