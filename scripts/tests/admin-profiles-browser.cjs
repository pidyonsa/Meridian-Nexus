"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { encode } = require("../update-dataorbis-validation.cjs");
const root = path.resolve(__dirname, "../.."), stage = path.join(root, ".tmp/admin-profiles-20260923");
const portal = process.env.NEXUS_PROFILE_PORTAL || path.join(stage, "before");
const screenshots = process.env.NEXUS_PROFILE_SCREENSHOTS || stage;
const profiles = process.env.NEXUS_DATAORBIS_CLIENT_PLAN
  ? JSON.parse(fs.readFileSync(process.env.NEXUS_DATAORBIS_CLIENT_PLAN, "utf8")).map(p => ({ id: p.id, ...p.profile, ...p.patch }))
  : [
  { id: "dataorbis-game-sales", name: "Game Sales (DataOrbis)", webAddress: "https://pyramid.dataorbis.com", username: "", reportSchedule: { enabled: false } },
  { id: "dataorbis-makro-sales", name: "Makro / Jumbo Sales (DataOrbis)", webAddress: "https://pyramid.dataorbis.com", username: "", reportSchedule: { enabled: false } }
];
async function main() {
  fs.mkdirSync(screenshots, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost"), name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (url.pathname.startsWith("/__/firebase/") || name === "service-worker.js") { res.setHeader("Content-Type", "text/javascript"); res.end("/* synthetic SDK */"); return; }
    const file = path.resolve(portal, name), fallback = path.resolve(root, "public", name);
    const chosen = file.startsWith(portal + path.sep) && fs.existsSync(file) ? file : fallback.startsWith(path.join(root, "public") + path.sep) && fs.existsSync(fallback) ? fallback : null;
    if (!chosen || !fs.statSync(chosen).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml" }[path.extname(chosen)] || "application/octet-stream");
    res.end(fs.readFileSync(chosen));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    let restMode = "success";
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.hostname === "firestore.googleapis.com") {
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST" };
        if (request.method() === "OPTIONS") return request.respond({ status: 204, headers });
        if (restMode !== "success") return request.respond({ status: restMode === "denied" ? 403 : 503, headers, contentType: "application/json", body: '{}' });
        const body = profiles.map(p => ({ document: { name: `projects/meridain-nexus/databases/(default)/documents/retailers/${p.id}`, fields: encode(p).mapValue.fields } }));
        return request.respond({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
      }
      return url.hostname === "127.0.0.1" ? request.continue() : request.abort();
    });
    await page.evaluateOnNewDocument(profiles => {
      const test = window.profileTest = { profiles, subscriptions: [], calls: [], toasts: [], mode: "pending" };
      const auth = { currentUser: null, onAuthStateChanged(cb) { test.callback = cb; setTimeout(() => cb(null), 0); }, async signOut() { auth.currentUser = null; await test.callback(null); } };
      function query(name) {
        const q = { where: () => q, orderBy: () => q, limit: () => q, doc: () => q, collection: () => q,
          get: async () => ({ docs: [], exists: false }), onSnapshot(...args) {
            const callbacks = args.filter(arg => typeof arg === "function");
            const next = callbacks[0], error = callbacks[1];
            test.subscriptions.push(name); let stopped = false;
            setTimeout(() => {
              if (stopped) return;
              if (name === "retailers" && test.mode === "pending") return;
              if (name === "retailers" && test.mode === "denied") { error(Object.assign(new Error("Access denied"), { code: "permission-denied" })); return; }
              const rows = name === "retailers" ? test.profiles : [];
              next({ docs: rows.map(p => ({ id: p.id, data: () => p })), size: rows.length, exists: false, metadata: { fromCache: false } });
            }, 30);
            return () => { stopped = true; };
          } };
        return q;
      }
      const db = { settings() {}, collection: query };
      const funcs = { httpsCallable: name => async data => {
        test.calls.push({ name, data });
        if (name === "saveRetailer") return { data: { id: data.id } };
        if (name === "getOperationsWorkspace") return { data: { account: { uid: auth.currentUser.uid, role: "admin", permissions: {} }, profiles: [], runs: [], prompts: [], alerts: [] } };
        if (name === "meridianChat") return { data: data.action === "activity" ? { unreadChats: 0, events: [] } : { actor: { uid: auth.currentUser.uid, audience: "internal", admin: true, capabilities: {} }, workstreams: [] } };
        return { data: {} };
      } };
      window.firebase = { firestore: Object.assign(() => db, { Timestamp: { fromDate: date => ({ toDate: () => date }) } }), auth: () => auth, storage: () => ({ setMaxUploadRetryTime() {}, setMaxOperationRetryTime() {} }), app: () => ({ options: { projectId: "meridain-nexus" }, functions: () => funcs }) };
      test.signIn = async () => {
        auth.currentUser = { uid: "synthetic-admin", email: "admin@example.test", async getIdToken() { return "synthetic-token"; }, async getIdTokenResult() { return { claims: { admin: true, email: "admin@example.test" } }; } };
        await test.callback(auth.currentUser);
      };
    }, profiles);
    await page.goto(`http://127.0.0.1:${server.address().port}/#admin`, { waitUntil: "networkidle2" });
    await page.evaluate(() => { const original = showToast; showToast = (...args) => { profileTest.toasts.push(args[0]); original(...args); }; });
    await page.evaluate(() => profileTest.signIn());
    await new Promise(resolve => setTimeout(resolve, 500));
    const observed = await page.evaluate(() => ({ subscriptions: profileTest.subscriptions, toasts: profileTest.toasts, profileNames: state.retailers.map(p => p.name), admin: state.isAdmin, list: elements.retailerList.textContent }));
    console.log(JSON.stringify({ errors, observed }));
    assert.equal(observed.profileNames.length, 2, "Admin sign-in must start the profile listener and render saved profiles.");
    assert.deepEqual(errors, []);
    if (process.env.NEXUS_TEST_RUN_OPTIONS) {
      await page.evaluate(() => { window.location.hash = "automation"; renderOperationsWorkspace(); });
      await page.waitForSelector("#operationsRetailer", { visible: true });
      for (const profile of profiles) {
        await page.select("#operationsRetailer", profile.id);
        assert.equal(await page.$eval("#operationsRunExtraction", e => e.disabled), true);
        assert.match(await page.$eval("#operationsRetailerDetails", e => e.textContent), /Setup required/);
        assert.equal(await page.$eval("#operationsSchedulePanel", e => e.hidden), true);
      }
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 1000 });
        await page.$eval("#operationsRetailer", e => e.scrollIntoView({ block: "center" }));
        await page.screenshot({ path: path.join(screenshots, `run-options-${width}.png`) });
      }
      await page.setViewport({ width: 1440, height: 1000 });
      await page.evaluate(() => { window.location.hash = "admin"; });
      await page.waitForSelector('[data-admin-tab="retailers"]', { visible: true });
    }
    await page.click('[data-admin-tab="retailers"]');
    await page.click('#retailerList button[data-id="dataorbis-game-sales"]');
    assert.equal(await page.$eval("#retailerFormTitle", e => e.textContent), profiles[0].name);
    assert.equal(await page.$eval("#retailerPassword", e => e.value), "");
    await page.$eval("#retailerUsername", e => { e.value = "synthetic-login"; });
    await page.$eval("#retailerPassword", e => { e.value = "synthetic-password"; });
    const listenerCount = await page.evaluate(() => profileTest.subscriptions.filter(n => n === "retailers").length);
    await page.click('#retailerForm button[type="submit"]');
    await page.waitForFunction(before => profileTest.subscriptions.filter(n => n === "retailers").length > before && state.retailerLoadStatus === "ready", {}, listenerCount);
    assert.equal(await page.$eval("#retailerPassword", e => e.value), "");
    assert.equal(await page.evaluate(() => profileTest.calls.filter(c => c.name === "saveRetailer").length), 1);
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      await page.screenshot({ path: path.join(screenshots, `profiles-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => {
      state.retailers.push({ id: "linked-test", name: "Synthetic existing profile", username: "synthetic-user", webAddress: "https://example.test", extractionProfileId: "existing-steps", extractionName: "Existing workflow" });
      editRetailer("linked-test");
    });
    assert.equal(await page.$eval("#retailerExtractionProfile", e => e.value), "existing-steps");
    await page.click('#retailerForm button[type="submit"]');
    await page.waitForFunction(() => profileTest.calls.filter(c => c.name === "saveRetailer").length === 2 && state.retailerLoadStatus === "ready");
    assert.equal(await page.evaluate(() => profileTest.calls.filter(c => c.name === "saveRetailer").at(-1).data.extractionProfileId), "existing-steps");
    restMode = "failed";
    await page.evaluate(() => subscribeRetailerProfiles());
    await page.waitForFunction(() => state.retailerLoadStatus === "error");
    assert.equal(await page.$eval("#retailerCount", e => e.textContent), "Unavailable");
    assert.equal(await page.$eval("#retailerList", e => e.textContent.includes("No extraction profiles configured")), false);
    restMode = "success";
    await page.click("[data-retry-retailers]");
    await page.waitForFunction(() => state.retailerLoadStatus === "ready" && state.retailers.length === 2);
    restMode = "denied";
    await page.evaluate(() => subscribeRetailerProfiles());
    await page.waitForFunction(() => state.retailerLoadStatus === "error");
    assert.equal(await page.evaluate(() => state.retailers.length), 0);
    assert.match(await page.$eval("#retailerList", e => e.textContent), /not permitted/);
    restMode = "success";
    await page.click("[data-retry-retailers]");
    await page.waitForFunction(() => state.retailers.length === 2);
    await page.evaluate(() => auth.signOut());
    assert.equal(await page.evaluate(() => state.retailers.length), 0);
    assert.deepEqual(errors, []);
    console.log("Full-page stalled-stream recovery, profile editing, retry, access denial, logout and desktop/mobile views passed. Synthetic only.");
    if (process.env.NEXUS_TEST_RUN_OPTIONS) {
      const { hash } = require("../release-multi-admin.cjs");
      fs.writeFileSync(path.join(portal, "../browser-passed.json"), JSON.stringify({ at: new Date().toISOString(),
        assets: Object.fromEntries(["app.js", "index.html", "service-worker.js"].map(file => [file, hash(fs.readFileSync(path.join(portal, file)))])),
        checks: ["admin-setup-visible", "pending-run-disabled", "pending-schedule-hidden", "desktop", "mobile", "profile-edit", "logout"]
      }, null, 2));
    }
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
