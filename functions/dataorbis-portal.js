"use strict";

const assert = require("node:assert/strict");
const ORIGIN = "https://pyramid.dataorbis.com";
const FOLDERS = { game: "Massdiscounters Supplier Reports", wholesale: "Massmart Wholesale Supplier Reports" };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function portalNumber(value) {
  assert.match(value, /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/, "Unexpected DataOrbis numeric format.");
  const number = Number(value.replaceAll(",", ""));
  assert.ok(Number.isFinite(number));
  return number;
}
async function login(page, { url, username, password, requestOtp }) {
  assert.equal(new URL(url).origin, ORIGIN);
  assert.ok(username && password && typeof requestOtp === "function");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.equal(new URL(page.url()).origin, ORIGIN);
  await page.waitForSelector("#presented-username", { visible: true, timeout: 30000 });
  assert.equal(await page.$eval("#login-form", e => new URL(e.action).origin), ORIGIN);
  await page.type("#presented-username", username);
  await page.type("#password", password);
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }), page.click("#btnSubmit")]);
  for (let attempt = 1; /totp/i.test(new URL(page.url()).pathname) && attempt <= 3; attempt++) {
    assert.equal(new URL(page.url()).origin, ORIGIN);
    assert.equal(await page.$eval("#totop-insert-code-form", e => new URL(e.action).origin), ORIGIN);
    const value = await requestOtp(attempt);
    assert.match(value, /^\d{6}$/, "Enter the six-digit code in Nexus.");
    for (let i = 0; i < 6; i++) {
      const selector = `#presented-code-${i + 1}`;
      await page.$eval(selector, e => { e.focus(); e.select(); });
      await page.type(selector, value[i]);
    }
    const [request] = await Promise.all([
      page.waitForRequest(r => new URL(r.url()).pathname === "/totp-insert-code" && r.method() === "POST", { timeout: 30000 }),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }), page.click("#btnSubmit")
    ]);
    assert.ok(new URLSearchParams(request.postData()).get("codeinput") === value, "Portal did not submit the entered code correctly.");
  }
  assert.equal(new URL(page.url()).origin, ORIGIN);
  assert.ok(!/login|totp/i.test(new URL(page.url()).pathname), "DataOrbis did not accept sign-in. Start a new run with a fresh code.");
  await page.waitForSelector("#side-menu-button-folder", { visible: true, timeout: 60000 });
}
async function waitReady(page) {
  await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 90000 });
  await delay(600);
}
async function slicer(page, label) {
  const handle = await page.evaluateHandle(name => [...document.querySelectorAll(".slicer-container")]
    .find(e => e.getClientRects().length && e.querySelector('[data-for="slicer-title-tooltip"]')?.textContent.trim() === name), label);
  const element = handle.asElement();
  assert.ok(element, `The ${label} filter was not found.`);
  return element;
}
async function selectSingle(page, label, value) {
  assert.equal(new URL(page.url()).origin, ORIGIN);
  await waitReady(page);
  const control = await slicer(page, label);
  const current = await control.$eval(".drop-down-text", e => e.textContent.trim());
  assert.notEqual(current, "Disabled", `${label} must be enabled before selecting its value.`);
  if (current === value) return { filter: label, selected: value };
  await page.mouse.click(1, 1);
  await (await control.$(".drop-down")).click();
  await page.waitForSelector('.popup input[placeholder="Search"]', { visible: true });
  const search = await page.$('.popup input[placeholder="Search"]');
  assert.ok(search, "The filter search was not found.");
  await search.evaluate(e => { e.focus(); e.select(); });
  await search.press("Backspace");
  await page.waitForSelector(".popup input[aria-label='(All)']", { visible: true });
  const all = await page.$(".popup input[aria-label='(All)']");
  if (!await all.evaluate(e => e.checked)) await all.click();
  await (await page.$(".popup input[aria-label='(All)']")).click();
  const present = await page.$$eval('.popup input[type="checkbox"]', (nodes, expected) => nodes.some(e => e.getAttribute("aria-label") === expected), value);
  if (!present || label === "Supplier") {
    const freshSearch = await page.$('.popup input[placeholder="Search"]');
    await freshSearch.evaluate(e => { e.focus(); e.select(); });
    await freshSearch.type(value);
  }
  await page.waitForFunction(expected => [...document.querySelectorAll('.popup input[type="checkbox"]')].some(e => e.getAttribute("aria-label") === expected), { timeout: 30000 }, value);
  const target = await page.evaluateHandle(expected => [...document.querySelectorAll('.popup input[type="checkbox"]')].find(e => e.getAttribute("aria-label") === expected), value);
  assert.ok(target.asElement());
  if (!await target.evaluate(e => e.checked)) await target.asElement().click();
  await page.waitForFunction(expected => [...document.querySelectorAll('.popup input[type="checkbox"]')].some(e => e.getAttribute("aria-label") === expected && e.checked), { timeout: 10000 }, value);
  await delay(400);
  await page.mouse.click(1, 1);
  await page.waitForFunction(({ name, value }) => [...document.querySelectorAll(".slicer-container")].some(e => e.querySelector('[data-for="slicer-title-tooltip"]')?.textContent.trim() === name && e.querySelector(".drop-down-text")?.textContent.trim() === value), { timeout: 30000 }, { name: label, value });
  await waitReady(page);
  return { filter: label, selected: value };
}
async function selectSupplier(page, { supplier }) {
  assert.equal(typeof supplier, "string");
  assert.ok(supplier.trim() && supplier.length < 150 && !/^(all|\(all\))$/i.test(supplier));
  return selectSingle(page, "Supplier", supplier);
}
async function configureMonth(page, { month, inspectOnly = false }) {
  assert.match(month, /^\d{4}-(0[1-9]|1[0-2])$/);
  const control = await slicer(page, "Months");
  const disabled = await control.$(".slicer-off");
  if (disabled) { await disabled.click(); await waitReady(page); }
  if (inspectOnly) {
    await page.mouse.click(1, 1);
    await (await control.$(".drop-down")).click();
    const search = await page.waitForSelector('.popup input[placeholder="Search"]', { visible: true });
    await search.evaluate(e => { e.focus(); e.select(); });
    await search.press("Backspace");
    await delay(1000);
    return page.$$eval('.popup input[type="checkbox"]', nodes => nodes.map(e => ({ label: e.getAttribute("aria-label"), title: e.title, checked: e.checked })));
  }
  const wholesale = await page.$$eval('[data-for="slicer-title-tooltip"]', nodes => nodes.some(e => e.textContent.trim() === "Site Retailer"));
  return selectSingle(page, "Months", `${month}-01${wholesale ? "" : " 00:00"}`);
}
async function menuItem(page, label) {
  await page.waitForFunction(text => [...document.querySelectorAll(".menu-item-inner-wrapper")].some(e => e.getClientRects().length && e.textContent.trim() === text), { timeout: 15000 }, label);
  const item = await page.evaluateHandle(text => [...document.querySelectorAll(".menu-item-inner-wrapper")].find(e => e.getClientRects().length && e.textContent.trim() === text), label);
  return item.asElement();
}
async function configureDimensions(page, { mode = "Swap", table = "Sites", dimension, inspectOnly = false } = {}) {
  assert.ok(["Swap", "Add"].includes(mode));
  assert.ok(["Sites", "Products", "Weekly Sales"].includes(table));
  await waitReady(page);
  const anchor = await page.evaluateHandle(() => {
    const cells = [...document.querySelectorAll(".gridMatrixRows")].filter(e => e.getClientRects().length);
    const top = Math.min(...cells.map(e => e.getBoundingClientRect().top));
    return cells.filter(e => Math.abs(e.getBoundingClientRect().top - top) < 2).sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
  });
  assert.ok(anchor.asElement());
  await anchor.asElement().click({ button: "right" });
  await (await menuItem(page, mode)).hover();
  await (await menuItem(page, table)).hover();
  await delay(700);
  if (inspectOnly) return inspectReport(page);
  assert.ok(["Site Code", "Site", "Region", "Category", "Brand", "Product"].includes(dimension));
  await (await menuItem(page, dimension)).click();
  await waitReady(page);
  await page.waitForFunction(expected => document.querySelector(".gridGeneral")?.innerText.split("\n").includes(expected), { timeout: 60000 }, dimension);
  return { dimension, mode };
}
async function copyRawData(page, { inspectOnly = false } = {}) {
  const grid = await page.$(".gridGeneral");
  assert.ok(grid);
  const box = await grid.boundingBox();
  await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2, { button: "right" });
  if (inspectOnly) return inspectReport(page);
  await page.browserContext().overridePermissions(ORIGIN, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  await page.bringToFront();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await (await menuItem(page, "Copy Content")).hover();
  await (await menuItem(page, "Copy Raw Data")).click();
  await page.waitForFunction(async () => (await navigator.clipboard.readText()).length > 0, { timeout: 90000 });
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(text.length < 30 * 1024 * 1024, "Export exceeds the validation limit.");
  const matrix = await page.evaluate(html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.querySelectorAll("table").length !== 1 || doc.querySelector("script,iframe,img,object,style")) throw new Error("Unexpected raw export content.");
    return [...doc.querySelectorAll("tr")].map(row => [...row.cells].map(cell => cell.textContent.trim()));
  }, text);
  const headers = matrix.shift();
  const rows = matrix.map((row, index) => {
    assert.equal(row.length, headers.length, `Raw row ${index + 2} has missing columns.`);
    return row.map((value, i) => i >= row.length - 2 ? portalNumber(value) : value);
  });
  return { text, headers, rows, totals: detailTotals(rows.filter(r => !isTotalRow(r))) };
}
async function inspectReport(page) {
  assert.equal(new URL(page.url()).origin, ORIGIN);
  return page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText.slice(0, 10000),
    controls: [...document.querySelectorAll("select, input, [role=combobox], [role=menuitem], .menu-item-inner-wrapper")].filter(e => e.getClientRects().length).map(e => ({
      tag: e.tagName, id: e.id, name: e.name, type: e.type, title: e.title, role: e.getAttribute("role"), className: e.className,
      text: (e.innerText || "").slice(0, 300), disabled: e.disabled,
      options: e.tagName === "SELECT" ? [...e.options].map(o => ({ label: o.text, value: o.value, selected: o.selected })) : undefined
    }))
  }));
}
async function openReport(page, { channel }) {
  assert.equal(new URL(page.url()).origin, ORIGIN);
  assert.ok(FOLDERS[channel], "Choose Game or Wholesale.");
  const close = await page.$('.icon-container[title="Close"]');
  if (close) { await close.click(); await delay(1000); }
  await page.waitForSelector("#side-menu-button-folder", { visible: true, timeout: 60000 });
  await page.click("#side-menu-button-folder");
  for (let level = 0; level < 4; level++) {
    await delay(700);
    if (await page.$(`[title="${FOLDERS[channel]}"]`)) break;
    const up = await page.$('[title="Move Up a Folder"]');
    if (!up) break;
    await up.click();
  }
  await page.waitForFunction(folder => [...document.querySelectorAll("[title]")].some(e => e.title === folder), { timeout: 45000 }, FOLDERS[channel]);
  // Use the portal's own context action instead of depending on double-click behavior.
  await page.click(`[title="${FOLDERS[channel]}"]`, { button: "right" });
  await page.waitForSelector(".menu-item-inner-wrapper", { visible: true });
  await page.click("text/Open Folder");
  const report = `${FOLDERS[channel].replace(/ Reports$/, "")} Sales Extract`;
  await page.waitForSelector(`[title="${report}"]`, { visible: true, timeout: 45000 });
  await page.click(`[title="${report}"]`, { button: "right" });
  await page.waitForSelector(".menu-item-inner-wrapper", { visible: true });
  await page.click("text/View");
  await page.waitForSelector("text/Monthly Sales Performance", { visible: true, timeout: 60000 });
  await page.click("text/Monthly Sales Performance");
  await page.waitForFunction(() => /Sales Quantity/.test(document.body.innerText) && /Sales Value Excl/.test(document.body.innerText) && /Supplier/.test(document.body.innerText), { timeout: 90000 });
  await waitReady(page);
  return inspectReport(page);
}
const isTotalRow = row => String(row[0] ?? "").trim().toUpperCase() === "TOTAL";
function detailTotals(rows) {
  return rows.reduce((sum, row) => {
    assert.ok(row.slice(-2).every(value => typeof value === "number" && Number.isFinite(value)), "Sales measures must be finite numbers.");
    return { units: sum.units + row.at(-2), value: sum.value + row.at(-1) };
  }, { units: 0, value: 0 });
}
function validateExport(raw, baseline, month, channel = "wholesale") {
  assert.ok(["game", "wholesale"].includes(channel));
  assert.deepEqual(raw.headers, ["date F454_YYYYMM", "Site Code", "Site", "Region", "Category", "Brand", "Product", "Sales Quantity", "Sales Value Excl"]);
  assert.ok(raw.rows.length && raw.rows.length < 100000);
  assert.ok(raw.rows.every(r => r[0] === `${month}-01` || isTotalRow(r)), "The portal exported a different reporting month.");
  assert.ok(baseline.rows.length && baseline.rows.every(r => r[0] === `${month}-01` || isTotalRow(r)), "Summary month differs from the requested month.");
  const rows = raw.rows.filter(r => !isTotalRow(r)), detail = baseline.rows.filter(r => !isTotalRow(r));
  const totals = baseline.rows.filter(isTotalRow);
  assert.ok(rows.length && detail.length, "The portal export must contain dated sales detail, not only subtotals.");
  if (channel !== "game" && totals.length) assert.deepEqual(totals.map(r => JSON.stringify(r.slice(1))).sort(), detail.map(r => JSON.stringify(r.slice(1))).sort(), "Summary Total block does not match its detail.");
  const exported = detailTotals(rows), summary = detailTotals(detail);
  assert.equal(exported.units, summary.units, "Exported quantity does not reconcile with the portal summary.");
  // The portal rounds Copy Raw Data monetary cells to whole currency units.
  const roundingLimit = (rows.length + detail.length) / 2;
  const difference = exported.value - summary.value;
  assert.ok(Math.abs(difference) <= roundingLimit, "Exported sales value does not reconcile within the portal's rounding precision.");
  return { detailTotals: exported, summaryTotals: summary, excludedSubtotalRows: raw.rows.length - rows.length, roundingDifference: difference, roundingLimit };
}
async function extractChannel(page, { channel, supplier, month, progress = async () => {} }) {
  await progress(`Opening ${channel} monthly sales.`);
  await openReport(page, { channel });
  await progress(`Selecting ${channel} supplier.`);
  await selectSupplier(page, { supplier });
  await progress(`Selecting ${channel} reporting month.`);
  await configureMonth(page, { month });
  await progress(`Checking ${channel} summary totals.`);
  const baseline = await copyRawData(page);
  assert.deepEqual(baseline.headers, ["date F454_YYYYMM", "Group", "Sales Quantity", "Sales Value Excl"]);
  for (const [i, dimension] of ["Site Code", "Site", "Region", "Category", "Brand", "Product"].entries()) {
    await progress(`Configuring ${channel}: ${dimension}.`);
    await configureDimensions(page, { mode: i ? "Add" : "Swap", table: i < 3 ? "Sites" : "Products", dimension });
  }
  assert.equal(await (await slicer(page, "Supplier")).$eval(".drop-down-text", e => e.textContent.trim()), supplier);
  const raw = await copyRawData(page);
  const reconciliation = validateExport(raw, baseline, month, channel);
  return { ...raw, channel, supplier, month, reconciliation, capturedAt: new Date().toISOString() };
}
module.exports = { ORIGIN, FOLDERS, login, inspectReport, openReport, selectSupplier, configureMonth, configureDimensions, copyRawData, portalNumber, validateExport, extractChannel, selectSingle, slicer, waitReady };
