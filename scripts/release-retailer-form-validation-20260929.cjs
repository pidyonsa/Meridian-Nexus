"use strict";
// Fixes Admin > Extraction profiles saving for non-Salesforce profiles (e.g. Pick n Pay): the hidden
// Salesforce API username (type=email) received a non-email login username and blocked form submission.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), zlib = require("node:zlib"), http = require("node:http");
const { hash, json } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/retailer-form-validation-20260929");
const host = "https://firebasehosting.googleapis.com/v1beta1", site = "meridian-nexus", project = "meridain-nexus", tag = "20260929-retailer-form";
const assets = ["app.js", "index.html", "service-worker.js"];
const live = () => json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const text = file => fs.readFileSync(path.join(stage, file), "utf8");
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
function once(value, from, to) { assert.equal(value.split(from).length, 2, `Expected one anchor: ${from.slice(0, 80)}`); return value.replace(from, () => to); }
const assetHashes = () => Object.fromEntries(assets.map(file => [file, hash(fs.readFileSync(path.join(stage, "portal", file)))]));
function patchApp(app) {
  app = once(app, "  elements.salesforceConnectedAppFields.hidden = !visible;\n  if (!visible) return;",
    "  elements.salesforceConnectedAppFields.hidden = !visible;\n  // A disabled fieldset is skipped by form validation, so hidden Salesforce-only fields cannot block other profiles from saving.\n  elements.salesforceConnectedAppFields.disabled = !visible;\n  if (!visible) return;");
  return once(app, "  if (!elements.retailerSalesforceApiUsername.value) elements.retailerSalesforceApiUsername.value = elements.retailerUsername.value;",
    "  if (!elements.salesforceConnectedAppFields.hidden && !elements.retailerSalesforceApiUsername.value) elements.retailerSalesforceApiUsername.value = elements.retailerUsername.value;");
}
function bump(source, name) {
  const pattern = /app\.js\?v=[\w-]+/g; assert.ok(source.match(pattern), `${name}: app.js version tag`);
  source = source.replace(pattern, `app.js?v=${tag}`);
  if (name === "service-worker.js") { assert.match(source, /const CACHE = "[^"]+";/); source = source.replace(/const CACHE = "[^"]+";/, `const CACHE = "meridian-nexus-${tag}";`); }
  return source;
}
async function prepare() {
  const before = await live(); save("hosting.before.json", before);
  const manifest = await json(`${host}/${before.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken); save("manifest.before.json", manifest);
  const hashes = Object.fromEntries(manifest.files.map(f => [f.path, f.hash]));
  for (const file of assets) {
    const response = await fetch(`https://${site}.web.app/${file}?baseline=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); assert.ok(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(zlib.gzipSync(bytes, { level: 9 })), hashes["/" + file], `${file}: fetched bytes do not match the live manifest`);
    save("baseline/" + file, bytes);
  }
  const app = patchApp(text("baseline/app.js"));
  let index = once(text("baseline/index.html"), '<fieldset class="connected-app-settings" id="salesforceConnectedAppFields" hidden>', '<fieldset class="connected-app-settings" id="salesforceConnectedAppFields" hidden disabled>');
  save("portal/app.js", app); save("portal/index.html", bump(index, "index.html")); save("portal/service-worker.js", bump(text("baseline/service-worker.js"), "service-worker.js"));
  save("prepared.json", { assets: assetHashes() }); console.log("Prepared app.js, index.html and service-worker.js from the live version.");
}
async function test() {
  const prepared = read("prepared.json"); assert.deepEqual(assetHashes(), prepared.assets);
  for (const file of ["app.js", "service-worker.js"]) require("node:child_process").execFileSync(process.execPath, ["--check", path.join(stage, "portal", file)], { stdio: "inherit", windowsHide: true });
  const puppeteer = require(path.join(root, "functions/node_modules/puppeteer-core"));
  const server = http.createServer((req, res) => { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><html><body></body></html>"); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
  const results = {};
  try {
    for (const variant of ["baseline", "portal"]) {
      const page = await browser.newPage(), errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, "text/html"), form = doc.querySelector("#retailerForm"); document.body.append(form);
        window.elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(el => [el.id, el]));
        window.formatDate = value => String(value);
      }, text(`${variant}/index.html`));
      const app = text(`${variant}/app.js`);
      for (const name of ["isSalesforceProfileForm", "syncSalesforceConnectedAppFields"]) { const body = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]; assert.ok(body, name); await page.addScriptTag({ content: body }); }
      const handler = app.match(/elements\.retailerUsername\.addEventListener\("input", \(\) => \{\n[^\n]+\n\}\);/)?.[0]; assert.ok(handler, "username input handler"); await page.addScriptTag({ content: handler });
      results[variant] = await page.evaluate(() => {
        const type = (el, value) => { el.value = value; el.dispatchEvent(new Event("input")); };
        const out = {};
        // Pick n Pay: non-email login username.
        elements.retailerId.value = "picknpay"; type(elements.retailerName, "Pick n Pay Sales"); type(elements.retailerWebAddress, "https://www.pnpportal.co.za/pnp_app/Account/Login");
        syncSalesforceConnectedAppFields({ id: "picknpay", name: "Pick n Pay Sales", webAddress: "https://www.pnpportal.co.za/pnp_app/Account/Login" });
        type(elements.retailerUsername, "meridian.pnp");
        out.pnpHidden = elements.salesforceConnectedAppFields.hidden; out.pnpValid = elements.retailerForm.checkValidity();
        // Salesforce: fields visible and still validated.
        elements.retailerApiReset = null; elements.retailerId.value = "salesforce-attendance"; elements.retailerSalesforceApiUsername.value = "";
        syncSalesforceConnectedAppFields({ id: "salesforce-attendance", name: "Salesforce", webAddress: "https://login.salesforce.com" });
        elements.retailerSalesforceApiUsername.value = "";
        type(elements.retailerUsername, "rep@example.com");
        out.sfVisible = !elements.salesforceConnectedAppFields.hidden && !elements.salesforceConnectedAppFields.disabled;
        out.sfCopied = elements.retailerSalesforceApiUsername.value; out.sfValid = elements.retailerForm.checkValidity();
        elements.retailerSalesforceApiUsername.value = "not-an-email"; out.sfInvalidBlocked = !elements.retailerForm.checkValidity();
        return out;
      });
      results[variant].errors = errors; await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(JSON.stringify(results, null, 2));
  assert.equal(results.baseline.pnpValid, false, "Baseline should reproduce the blocked save");
  assert.deepEqual(results.portal, { pnpHidden: true, pnpValid: true, sfVisible: true, sfCopied: "rep@example.com", sfValid: true, sfInvalidBlocked: true, errors: [] });
  save("tested.json", { ...prepared, at: new Date().toISOString(), results });
}
async function publish() {
  const before = read("hosting.before.json"); assert.deepEqual(assetHashes(), read("tested.json").assets);
  assert.equal((await live()).release.version.name, before.release.version.name, "Live Hosting changed since prepare");
  const files = Object.fromEntries(read("manifest.before.json").files.map(f => [f.path, f.hash])), uploads = new Map();
  for (const file of assets) { const bytes = zlib.gzipSync(fs.readFileSync(path.join(stage, "portal", file)), { level: 9 }), digest = hash(bytes); files["/" + file] = digest; uploads.set(digest, bytes); }
  const version = await json(`${host}/sites/${site}/versions`, "POST", { config: before.release.version.config }); save("hosting.created.json", { version, files });
  const upload = await json(`${host}/${version.name}:populateFiles`, "POST", { files }); assert.equal(new URL(upload.uploadUrl).hostname, "upload-firebasehosting.googleapis.com");
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  for (const digest of upload.uploadRequiredHashes || []) {
    assert.ok(uploads.has(digest));
    const response = await fetch(upload.uploadUrl.replace(/\/$/, "") + "/" + digest, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: uploads.get(digest) });
    await response.arrayBuffer(); assert.equal(response.status, 200);
  }
  await json(`${host}/${version.name}?updateMask=status`, "PATCH", { status: "FINALIZED" });
  assert.equal((await live()).release.version.name, before.release.version.name);
  await json(`${host}/projects/-/sites/${site}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`, "POST", { message: "Allow non-Salesforce extraction profiles (Pick n Pay) to save: hidden Salesforce fields no longer block validation" });
  console.log("Published " + version.name);
}
async function verify() {
  const current = await live(), created = read("hosting.created.json"); assert.equal(current.release.version.name.split("/").at(-1), created.version.name.split("/").at(-1));
  const manifest = await json(`${host}/${current.release.version.name}/files?pageSize=1000`); assert.ok(!manifest.nextPageToken);
  assert.deepEqual(Object.fromEntries(manifest.files.map(f => [f.path, f.hash])), created.files);
  assert.deepEqual(current.release.version.config, read("hosting.before.json").release.version.config);
  for (const file of assets) { const response = await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`); assert.ok(response.ok); assert.equal(hash(Buffer.from(await response.arrayBuffer())), read("tested.json").assets[file]); }
  save("verified.json", { at: new Date().toISOString(), hosting: current.release.version.name, changedAssets: assets });
  console.log("Verified live " + current.release.version.name);
}
const actions = { prepare, test, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
