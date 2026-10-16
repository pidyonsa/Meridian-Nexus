const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const puppeteer = require(path.join(root, "functions/node_modules/puppeteer-core"));
const { createServer } = require("../chat-preview.cjs");
async function main() {
  const server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname === "/") return request.respond({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(root, "public/index.html")) });
      if (url.pathname.startsWith("/__/firebase/") || url.pathname === "/service-worker.js") return request.respond({ status: 200, contentType: "text/javascript", body: "/* mocked SDK: no production data */" });
      if (url.origin === origin) return request.continue();
      const name = url.hostname === "fonts.googleapis.com" ? "manrope.css" : path.basename(url.pathname);
      const vendor = path.join(root, ".tmp/chat-verification/vendor", name);
      if (fs.existsSync(vendor)) return request.respond({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: name.endsWith(".css") ? "text/css" : "font/woff2", body: fs.readFileSync(vendor) });
      return request.abort();
    });
    await page.evaluateOnNewDocument(() => {
      const test = window.chatShellTest = { calls: [], listeners: [], callback: null };
      const auth = { currentUser: null, onAuthStateChanged(callback) { test.callback = callback; setTimeout(() => callback(null), 0); },
        async signOut() { auth.currentUser = null; return test.callback(null); } };
      function query(name) {
        const q = { where: () => q, orderBy: () => q, limit: () => q, startAfter: () => q,
          doc: id => query(`${name}/${id}`), collection: id => query(`${name}/${id}`),
          async get() { return { docs: [], exists: false }; },
          onSnapshot(...args) {
            const next = args.find(arg => typeof arg === "function");
            const record = { name, stopped: false }; test.listeners.push(record);
            setTimeout(() => { if (!record.stopped) next({ docs: [], size: 0, exists: false, metadata: { fromCache: false } }); }, 0);
            return () => { record.stopped = true; };
          } };
        return q;
      }
      const db = { settings() {}, collection: query };
      const functions = { httpsCallable: name => async data => {
        test.calls.push({ name, action: data?.action, data });
        const user = auth.currentUser;
        if (name === "meridianChat") return { data: { actor: { uid: user.uid, name: "Test account", audience: user.kind === "client" ? "external" : "internal", admin: user.kind === "admin", clientId: user.kind === "client" ? "sample-client" : "" }, maxMembers: 50, workstreams: ["General"] } };
        if (name === "getOperationsWorkspace") return { data: { account: { uid: user.uid, role: user.kind, permissions: { allowedNavigationIds: ["automation"], ...(test.chatEnabled === undefined ? {} : { chatEnabled: test.chatEnabled }) } }, profiles: [], runs: [], prompts: [], alerts: [] } };
        if (name === "askNexusAssistant") return { data: { answer: "Your permitted Nexus summaries are available.", scope: "Staff account / assigned data" } };
        return { data: {} };
      } };
      window.firebase = { firestore: () => db, auth: () => auth,
        storage: () => ({ setMaxUploadRetryTime() {}, setMaxOperationRetryTime() {} }), app: () => ({ functions: () => functions }) };
      test.signIn = async kind => {
        const claims = kind === "admin" ? { email: "admin@nexus.co.za", admin: true } : kind === "client" ? { chatClient: true, nexusRole: "client" } : { operator: true, nexusRole: "normal" };
        auth.currentUser = { kind, uid: kind, email: claims.email || `${kind}@example.test`, async getIdTokenResult() { return { claims }; } };
        await test.callback(auth.currentUser);
      };
      test.signOut = () => auth.signOut();
    });
    await page.goto(`${origin}/#chat`, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => chatShellTest.callback !== null);
    assert.deepEqual(await page.evaluate(() => chatShellTest.listeners), []);
    await page.evaluate(() => chatShellTest.signIn("client"));
    assert.equal(await page.evaluate(() => chatShellTest.calls.length), 0, "Clients must not call staff or chat APIs");
    assert.equal(await page.$('#meridianChat .mc-layout'), null);
    assert.equal(await page.$eval('#chatPrimaryNav [data-open-view="chat"]', node => node.hidden), true);
    await page.evaluate(() => chatShellTest.signIn("normal"));
    await page.waitForFunction(() => document.querySelector(".mc-connection")?.textContent === "Connected");
    await page.waitForFunction(() => !document.getElementById("appLoader") || getComputedStyle(document.getElementById("appLoader")).opacity === "0");
    assert.equal(await page.$eval('#chatPrimaryNav [data-open-view="chat"]', node => node.hidden), false);
    assert.equal(await page.$eval('#nexusAssistantToggle', node => node.hidden), true, "AI launcher cannot cover Chat controls");
    await page.waitForFunction(() => !document.getElementById('toast').classList.contains('visible'));
    await page.screenshot({ path: path.join(root, ".tmp/chat-verification/full-shell-staff.png"), fullPage: true });
    await page.click('[data-action="assistant"]');
    await page.type('.mc-ai-compose textarea', 'Summarise my Nexus data.'); await page.click('.mc-ai-compose button[type=submit]');
    await page.waitForSelector('.mc-ai-turn:not(.own)');
    assert.deepEqual(await page.evaluate(() => chatShellTest.calls.filter(c => c.name === 'askNexusAssistant').map(c => c.data)), [{ question: 'Summarise my Nexus data.', model: 'gemini-3.5-flash' }]);
    assert.equal(await page.evaluate(() => chatShellTest.calls.some(c => c.name === 'meridianChat' && c.action === 'send')), false);
    await page.screenshot({ path: path.join(root, ".tmp/chat-verification/full-shell-assistant.png"), fullPage: true });
    assert.equal(await page.evaluate(() => chatShellTest.listeners.some(record => !record.stopped && ["files", "dashboardClients", "dashboardUploads"].includes(record.name))), false);
    await page.evaluate(() => chatShellTest.signOut());
    assert.equal(await page.$('.mc-ai-turn'), null, 'Sign-out clears the private AI session');
    await page.evaluate(() => chatShellTest.signIn("admin"));
    await page.waitForFunction(() => chatShellTest.listeners.filter(record => !record.stopped && ["files", "dashboardClients", "dashboardUploads"].includes(record.name)).length === 3);
    await page.evaluate(() => { location.hash = "admin"; });
    await page.waitForSelector('#adminUserForm');
    assert.equal(await page.$eval('#adminUserNavigation input[value="chat"]', node => node.checked), true);
    assert.equal(await page.$eval('#adminChatAssignTasks', node => node.checked), false, 'new staff assignment permission is opt-in');
    await page.evaluate(() => {
      state.adminUsers = [{ uid: "staff-default", role: "normal", email: "staff@example.test", permissions: { allowedNavigationIds: ["attendance"] } }];
      editAdminUser("staff-default");
    });
    assert.equal(await page.$eval('#adminUserNavigation input[value="chat"]', node => node.checked), true);
    await page.evaluate(() => { state.adminUsers[0].permissions.chatEnabled = false; editAdminUser("staff-default"); });
    assert.equal(await page.$eval('#adminUserNavigation input[value="chat"]', node => node.checked), false);
    await page.evaluate(() => { state.adminUsers[0].chatAccess = { createGroups: true, assignTasks: true, moderateMessages: false }; editAdminUser('staff-default'); });
    assert.equal(await page.$eval('#adminChatCreateGroups', n => n.checked), true);
    assert.equal(await page.$eval('#adminChatAssignTasks', n => n.checked), true);
    assert.equal(await page.$eval('#adminChatModerateMessages', n => n.checked), false);
    await page.evaluate(() => chatShellTest.signOut());
    assert.equal(await page.evaluate(() => chatShellTest.listeners.every(record => record.stopped)), true);
    assert.equal(await page.$('#meridianChat .mc-layout'), null, "Logout removes conversation UI and data");
    assert.deepEqual(errors, []);
    console.log("PASS: full Nexus shell, private Gemini Flash adapter, clients blocked, existing staff default-on, admin opt-out and AI/logout cleanup.");
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
