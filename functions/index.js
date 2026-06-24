const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("node:crypto");
const { createReadStream } = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const chromium = require("@sparticuz/chromium").default;
const puppeteer = require("puppeteer-core");

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 3 });
const db = getFirestore();
const retailerKey = defineSecret("RETAILER_CREDENTIAL_KEY");

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Administrator access is required.");
}

function text(value, name, max = 500) {
  const result = String(value || "").trim();
  if (!result || result.length > max) throw new HttpsError("invalid-argument", `${name} is required.`);
  return result;
}

function optionalText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || crypto.randomUUID();
}

function encryptPassword(password) {
  const key = Buffer.from(retailerKey.value(), "base64");
  if (key.length !== 32) throw new Error("RETAILER_CREDENTIAL_KEY must decode to 32 bytes.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), version: 1 };
}

function decryptPassword(secret) {
  const key = Buffer.from(retailerKey.value(), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function validateSteps(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) throw new HttpsError("invalid-argument", "Add between 1 and 50 extraction steps.");
  const allowed = new Set([
    "navigate", "fillUsername", "fillPassword", "click", "clickText", "clickInSection",
    "waitFor", "waitText", "waitUrlContains", "waitNetworkIdle", "wait", "select", "selectReportPeriod", "export", "download"
  ]);
  return raw.map((step, index) => {
    const action = text(step.action, `Step ${index + 1} action`, 40);
    if (!allowed.has(action)) throw new HttpsError("invalid-argument", `Step ${index + 1} has an unsupported action.`);
    return { id: optionalText(step.id, 80) || crypto.randomUUID(), action, selector: optionalText(step.selector, 500), value: optionalText(step.value, 1000) };
  });
}

async function loadExtractionProfile(id) {
  const profileId = text(id, "Extraction step set", 64);
  const profile = await db.collection("extractionProfiles").doc(profileId).get();
  if (!profile.exists) throw new HttpsError("not-found", "Extraction step set was not found.");
  return { id: profile.id, ...profile.data() };
}

exports.saveExtractionProfile = onCall(async (request) => {
  requireAdmin(request);
  const name = text(request.data.name, "Step set name", 120);
  const id = optionalText(request.data.id, 64) || slugify(name);
  const steps = validateSteps(request.data.steps);
  await db.collection("extractionProfiles").doc(id).set({
    name,
    steps,
    stepCount: steps.length,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid
  }, { merge: true });
  return { id };
});

exports.deleteExtractionProfile = onCall(async (request) => {
  requireAdmin(request);
  const id = text(request.data.id, "Extraction step set", 64);
  const linkedRetailers = await db.collection("retailers").where("extractionProfileId", "==", id).limit(1).get();
  if (!linkedRetailers.empty) throw new HttpsError("failed-precondition", "This step set is linked to a retailer profile. Remove the link first.");
  await db.collection("extractionProfiles").doc(id).delete();
  return { id };
});

exports.saveRetailer = onCall({ secrets: [retailerKey] }, async (request) => {
  requireAdmin(request);
  const name = text(request.data.name, "Retailer name", 100);
  const webAddress = text(request.data.webAddress, "Retailer web address", 1000);
  try { new URL(webAddress); } catch { throw new HttpsError("invalid-argument", "Enter a valid retailer web address."); }
  const username = text(request.data.username, "Login username", 320);
  const id = optionalText(request.data.id, 64) || slugify(name);
  const extractionProfileId = optionalText(request.data.extractionProfileId, 64);
  const password = optionalText(request.data.password, 1000);
  const existingSecret = await db.collection("retailerSecrets").doc(id).get();
  if (!password && !existingSecret.exists) throw new HttpsError("invalid-argument", "Login password is required for a new retailer.");
  if (!extractionProfileId) throw new HttpsError("invalid-argument", "Link the retailer to an extraction step set.");
  const extractionProfile = await loadExtractionProfile(extractionProfileId);
  const batch = db.batch();
  batch.set(db.collection("retailers").doc(id), {
    name, webAddress, username, extractionProfileId, extractionName: extractionProfile.name,
    credentialsUpdatedAt: password ? FieldValue.serverTimestamp() : existingSecret.data()?.updatedAt || null,
    updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid
  }, { merge: true });
  if (password) batch.set(db.collection("retailerSecrets").doc(id), { ...encryptPassword(password), updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
  await batch.commit();
  return { id };
});

exports.deleteRetailer = onCall(async (request) => {
  requireAdmin(request);
  const id = text(request.data.id, "Retailer", 64);
  const batch = db.batch();
  batch.delete(db.collection("retailers").doc(id));
  batch.delete(db.collection("retailerSecrets").doc(id));
  await batch.commit();
  return { id };
});

exports.saveAdminUser = onCall(async (request) => {
  requireAdmin(request);
  const email = text(request.data.email, "Email", 320).toLowerCase();
  const name = text(request.data.name, "Name", 80);
  const surname = text(request.data.surname, "Surname", 80);
  const password = optionalText(request.data.password, 128);
  let uid = optionalText(request.data.uid, 128);
  if (!uid && password.length < 6) throw new HttpsError("invalid-argument", "A new admin password must contain at least 6 characters.");
  const attributes = { email, displayName: `${name} ${surname}`, disabled: request.data.disabled === true };
  if (password) attributes.password = password;
  const record = uid ? await getAuth().updateUser(uid, attributes) : await getAuth().createUser(attributes);
  uid = record.uid;
  await getAuth().setCustomUserClaims(uid, { ...(record.customClaims || {}), admin: true });
  const adminProfile = { uid, email, name, surname, disabled: attributes.disabled, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid };
  if (password) adminProfile.passwordUpdatedAt = FieldValue.serverTimestamp();
  await db.collection("adminUsers").doc(uid).set(adminProfile, { merge: true });
  return { uid };
});

exports.deleteAdminUser = onCall(async (request) => {
  requireAdmin(request);
  const uid = text(request.data.uid, "Admin user", 128);
  if (uid === request.auth.uid) throw new HttpsError("failed-precondition", "You cannot delete the account currently signed in.");
  await getAuth().deleteUser(uid);
  await db.collection("adminUsers").doc(uid).delete();
  return { uid };
});

exports.startExtraction = onCall(async (request) => {
  requireAdmin(request);
  const retailerId = text(request.data.retailerId, "Retailer", 64);
  const retailer = await db.collection("retailers").doc(retailerId).get();
  if (!retailer.exists) throw new HttpsError("not-found", "Retailer configuration was not found.");
  const retailerData = retailer.data();
  const extractionName = retailerData.extractionProfileId ? (await loadExtractionProfile(retailerData.extractionProfileId)).name : retailerData.extractionName;
  const run = await db.collection("extractionRuns").add({ retailerId, retailerName: retailerData.name, extractionProfileId: retailerData.extractionProfileId || null, extractionName, status: "queued", message: "Extraction queued", createdAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid });
  return { runId: run.id };
});

async function loadRetailerAutomation(retailerId) {
  const [retailerDoc, secretDoc] = await Promise.all([
    db.collection("retailers").doc(retailerId).get(),
    db.collection("retailerSecrets").doc(retailerId).get()
  ]);
  if (!retailerDoc.exists || !secretDoc.exists) throw new Error("Retailer configuration or credentials are missing.");
  return { ...retailerDoc.data(), password: decryptPassword(secretDoc.data()) };
}

async function launchAutomationBrowser(downloadDir = "") {
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--disable-dev-shm-usage"],
    defaultViewport: { width: 1440, height: 1000 },
    executablePath: await chromium.executablePath(),
    headless: true
  });
  const page = await browser.newPage();
  if (downloadDir) {
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  }
  return { browser, page };
}

async function loginToRetailerPortal(page, retailer) {
  await page.goto(retailer.webAddress, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector("#loginID", { visible: true, timeout: 60000 });
  await page.type("#loginID", retailer.username, { delay: 20 });
  await page.type("#loginPsw", retailer.password, { delay: 20 });
  await page.click("#btnLogin");
  await page.waitForSelector("#ddOwnCompany", { visible: true, timeout: 90000 });
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 }).catch(() => {});
}

exports.syncPicknPayProfiles = onCall({ secrets: [retailerKey], timeoutSeconds: 180, memory: "2GiB" }, async (request) => {
  requireAdmin(request);
  let browser;
  try {
    const retailer = await loadRetailerAutomation("picknpay");
    const launched = await launchAutomationBrowser();
    browser = launched.browser;
    await loginToRetailerPortal(launched.page, retailer);
    const profiles = await launched.page.$eval("#ddOwnCompany", (select) => Array.from(select.options)
      .map((option) => ({
        portalProfileId: String(option.value || "").trim(),
        name: String(option.textContent || "").replace(/\s+/g, " ").trim(),
        group: String(option.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "Profiles").trim() || "Profiles"
      }))
      .filter((profile) => profile.portalProfileId && profile.name));
    if (!profiles.length) throw new Error("No PicknPay profiles were discovered in the portal dropdown.");
    const existing = await db.collection("retailerPortalProfiles").where("retailerId", "==", "picknpay").get();
    const batch = db.batch();
    existing.docs.forEach((document) => batch.set(document.ref, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    profiles.forEach((profile, index) => {
      const id = `picknpay--${slugify(profile.portalProfileId)}`;
      batch.set(db.collection("retailerPortalProfiles").doc(id), {
        retailerId: "picknpay", portalProfileId: profile.portalProfileId, name: profile.name, group: profile.group,
        order: index, active: true, lastSeenAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    batch.set(db.collection("retailers").doc("picknpay"), { portalProfileCount: profiles.length, profilesSyncedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    return { profiles: profiles.map((profile) => ({ id: `picknpay--${slugify(profile.portalProfileId)}`, ...profile })) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

function extractionRunData(batch, profile, position) {
  return {
    retailerId: batch.retailerId,
    retailerName: batch.retailerName,
    extractionProfileId: batch.extractionProfileId,
    extractionName: batch.extractionName,
    extractionMode: "pnp-profile-sales",
    batchId: batch.id,
    portalProfileDocId: profile.id,
    portalProfileId: profile.portalProfileId,
    portalProfileName: profile.name,
    requestedReportPeriod: "Last month",
    reportPeriodFallbackEnabled: true,
    batchPosition: position,
    batchTotal: batch.profileQueue.length,
    status: "queued",
    message: `Queued ${profile.name}`,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: batch.createdBy
  };
}

exports.startPicknPayBatch = onCall(async (request) => {
  requireAdmin(request);
  const activeBatch = await db.collection("extractionBatches").where("status", "in", ["queued", "running"]).limit(10).get();
  if (activeBatch.docs.some((document) => document.data().retailerId === "picknpay")) throw new HttpsError("already-exists", "A PicknPay report batch is already running.");
  const requestedIds = Array.isArray(request.data?.profileIds) ? [...new Set(request.data.profileIds.map((id) => optionalText(id, 100)).filter(Boolean))] : [];
  if (requestedIds.length > 50) throw new HttpsError("invalid-argument", "Select no more than 50 profiles per batch.");
  const profileSnapshot = await db.collection("retailerPortalProfiles").where("retailerId", "==", "picknpay").get();
  let profiles = profileSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })).filter((profile) => profile.active === true);
  if (requestedIds.length) {
    const requested = new Set(requestedIds);
    profiles = profiles.filter((profile) => requested.has(profile.id));
    profiles.sort((left, right) => requestedIds.indexOf(left.id) - requestedIds.indexOf(right.id));
  } else {
    profiles.sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  }
  if (!profiles.length) throw new HttpsError("failed-precondition", "Refresh and select at least one active PicknPay profile.");
  const retailerDoc = await db.collection("retailers").doc("picknpay").get();
  if (!retailerDoc.exists) throw new HttpsError("not-found", "The PicknPay retailer configuration was not found.");
  const retailer = retailerDoc.data();
  const extractionProfile = await loadExtractionProfile(retailer.extractionProfileId);
  const batchRef = db.collection("extractionBatches").doc();
  const runRef = db.collection("extractionRuns").doc();
  const profileQueue = profiles.map((profile) => ({ id: profile.id, portalProfileId: String(profile.portalProfileId), name: profile.name }));
  const batchData = {
    id: batchRef.id, retailerId: "picknpay", retailerName: retailer.name || "PicknPay",
    extractionProfileId: retailer.extractionProfileId, extractionName: extractionProfile.name,
    profileQueue, totalProfiles: profileQueue.length, completedCount: 0, failedCount: 0,
    currentPosition: 1, currentProfileName: profileQueue[0].name, currentRunId: runRef.id,
    status: "running", message: `Processing profile 1 of ${profileQueue.length} — ${profileQueue[0].name}`,
    createdAt: FieldValue.serverTimestamp(), startedAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid
  };
  const writeBatch = db.batch();
  writeBatch.set(batchRef, batchData);
  writeBatch.set(runRef, extractionRunData(batchData, profileQueue[0], 1));
  await writeBatch.commit();
  return { batchId: batchRef.id, runId: runRef.id, totalProfiles: profileQueue.length };
});

async function waitForDownload(directory, startedAt, timeout = 180000) {
  const end = Date.now() + timeout;
  const observedSizes = new Map();
  while (Date.now() < end) {
    const names = await fs.readdir(directory).catch(() => []);
    const complete = names.filter((name) => !name.endsWith(".crdownload") && !name.endsWith(".tmp"));
    for (const name of complete) {
      const filePath = path.join(directory, name);
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs >= startedAt && stat.size > 0) {
        const priorSize = observedSizes.get(name);
        if (priorSize === stat.size) return { name, filePath, size: stat.size };
        observedSizes.set(name, stat.size);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The portal did not finish a file download before the timeout.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(operation, attempts = 3, delayMs = 1500) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(delayMs * attempt);
    }
  }
  throw lastError;
}

async function waitForVisibleText(page, expected, timeout = 60000) {
  if (!expected) throw new Error("A visible text value is required.");
  await page.waitForFunction((textValue) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const wanted = normalize(textValue);
    return [...document.querySelectorAll("body *")].some((element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || !bounds.width || !bounds.height) return false;
      const ownText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(" ");
      const normalized = normalize(ownText || element.textContent);
      return normalized === wanted || normalized.includes(wanted);
    });
  }, { timeout }, expected);
}

async function clickVisibleText(page, expected, sectionText = "") {
  const clicked = await page.evaluate(({ targetText, scopeText }) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const visible = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && bounds.width > 0 && bounds.height > 0;
    };
    const wanted = normalize(targetText);
    const clickableSelector = "a, button, input[type='button'], input[type='submit'], [role='button']";
    let roots = [document.body];
    if (scopeText) {
      const sectionWanted = normalize(scopeText);
      const labels = [...document.querySelectorAll("body *")]
        .filter((element) => visible(element) && normalize(element.textContent) === sectionWanted);
      roots = labels.map((label) => {
        let container = label.parentElement;
        for (let level = 0; container && level < 5; level += 1, container = container.parentElement) {
          const target = [...container.querySelectorAll(clickableSelector)]
            .find((element) => visible(element) && normalize(element.textContent || element.value).includes(wanted));
          if (target) return container;
        }
        return label.parentElement;
      }).filter(Boolean);
    }
    for (const root of roots) {
      const candidates = [...root.querySelectorAll(clickableSelector)].filter(visible);
      const exact = candidates.find((element) => normalize(element.textContent || element.value) === wanted);
      const partial = candidates.find((element) => normalize(element.textContent || element.value).includes(wanted));
      const target = exact || partial;
      if (target) {
        target.scrollIntoView({ block: "center", inline: "center" });
        target.click();
        return true;
      }
    }
    return false;
  }, { targetText: expected, scopeText: sectionText });
  if (!clicked) throw new Error(sectionText ? `Could not find visible text "${expected}" inside section "${sectionText}".` : `Could not find clickable visible text "${expected}".`);
}

async function selectReportPeriod(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 60000 });
  const options = await page.$eval(selector, (element) => Array.from(element.options || []).map((option, index) => ({
    value: option.value,
    label: String(option.textContent || "").replace(/\s+/g, " ").trim(),
    disabled: option.disabled,
    index
  })).filter((option) => option.value && option.label && !option.disabled));
  if (!options.length) throw new Error("No enabled Excel report periods are available for this profile.");
  const normalized = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let selected = options.find((option) => normalized(option.label) === "last month" || normalized(option.label).includes("last month"));
  if (!selected && options.length === 1) selected = options[0];
  if (!selected) {
    const completed = options.filter((option) => !/\b(this|current)\s+(month|period|week)\b/i.test(option.label));
    const dated = (completed.length ? completed : options).map((option) => {
      const match = option.label.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
      const parsed = match ? Date.parse(match[1]) : NaN;
      return { option, parsed };
    }).filter((item) => Number.isFinite(item.parsed) && item.parsed <= Date.now());
    if (dated.length) selected = dated.sort((left, right) => right.parsed - left.parsed)[0].option;
    if (!selected) selected = completed.find((option) => /latest|most recent|previous|last week|monthly/i.test(option.label)) || completed[0] || options[0];
  }
  await page.select(selector, selected.value);
  return { actualReportPeriod: selected.label, reportPeriodFallbackUsed: !/last month/i.test(selected.label) };
}

async function downloadLatestExistingReport(page, downloadDir) {
  await page.keyboard.press("Escape").catch(() => {});
  const directVisible = await page.$eval("body", () => {
    const link = document.querySelector("#ExcelReportInfoLink[href], a[href*='/Download/File']");
    if (!link) return false;
    const bounds = link.getBoundingClientRect();
    const style = getComputedStyle(link);
    return bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });
  if (!directVisible) {
    const startedAt = Date.now();
    const clicked = await page.evaluate(() => {
      const visible = (element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const icons = [...document.querySelectorAll("img[alt*='Excel' i], img[src*='excel' i]")]
        .filter((image) => visible(image) && !/new excel report/i.test(image.alt || ""))
        .sort((left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left);
      const icon = icons[icons.length - 1];
      if (!icon) return false;
      const target = icon.closest("a, button, [role='button']") || icon;
      target.click();
      return true;
    });
    if (!clicked) throw new Error("No existing PicknPay Excel report was available for fallback download.");
    const immediate = await waitForDownload(downloadDir, startedAt, 8000).catch(() => null);
    if (immediate) return { ...immediate, actualReportPeriod: "Latest available", reportPeriodFallbackUsed: true, reportSource: "existing-report" };
    await page.waitForSelector("#ExcelReportInfoLink, a[href*='/Download/File']", { visible: true, timeout: 60000 });
  }
  const selector = await page.$("#ExcelReportInfoLink") ? "#ExcelReportInfoLink" : "a[href*='/Download/File']";
  const startedAt = Date.now();
  await page.click(selector);
  const downloaded = await waitForDownload(downloadDir, startedAt, 75000);
  return { ...downloaded, actualReportPeriod: "Latest available", reportPeriodFallbackUsed: true, reportSource: "existing-report" };
}

async function runStep(page, step, retailer, downloadDir) {
  const selector = step.selector;
  if (step.action === "navigate") return page.goto(step.value || retailer.webAddress, { waitUntil: "networkidle2", timeout: 90000 });
  if (step.action === "wait") return delay(Math.min(120, Math.max(1, Number(step.value) || 1)) * 1000);
  if (step.action === "waitNetworkIdle") return page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 });
  if (step.action === "waitText") return waitForVisibleText(page, step.value);
  if (step.action === "waitUrlContains") {
    const expected = String(step.value || "").trim();
    if (!expected) throw new Error("Wait for URL requires a URL fragment.");
    const end = Date.now() + 60000;
    while (Date.now() < end) {
      if (page.url().includes(expected)) return;
      await delay(250);
    }
    throw new Error(`The URL did not contain "${expected}" before the timeout.`);
  }
  if (step.action === "clickText") {
    await waitForVisibleText(page, step.value);
    return retry(() => clickVisibleText(page, step.value), 3);
  }
  if (step.action === "clickInSection") {
    await waitForVisibleText(page, step.selector);
    await waitForVisibleText(page, step.value);
    return retry(() => clickVisibleText(page, step.value, step.selector), 3);
  }
  if (step.action === "export") {
    const downloadSelector = String(step.value || "").trim();
    if (!selector || !downloadSelector) throw new Error("Export requires an export-button selector and a download-link selector.");
    return retry(async (attempt) => {
      await page.waitForSelector(selector, { visible: true, timeout: 60000 });
      await page.click(selector);
      try {
        await page.waitForSelector(downloadSelector, { visible: true, timeout: 75000 });
      } catch (error) {
        if (attempt === 2) await page.reload({ waitUntil: "networkidle2", timeout: 90000 });
        throw error;
      }
    }, 3, 2500);
  }
  if (!selector) throw new Error(`${step.action} requires a CSS selector.`);
  await page.waitForSelector(selector, { visible: true, timeout: 60000 });
  if (step.action === "fillUsername" || step.action === "fillPassword") {
    const value = step.action === "fillUsername" ? retailer.username : retailer.password;
    await page.click(selector, { clickCount: 3 });
    return page.type(selector, value, { delay: 20 });
  }
  if (step.action === "click") return retry(() => page.click(selector), 3);
  if (step.action === "waitFor") return;
  if (step.action === "selectReportPeriod" || (step.action === "select" && retailer.dynamicReportPeriod && /ExportType/i.test(selector))) return selectReportPeriod(page, selector);
  if (step.action === "select") {
    const choice = /#ddOwnCompany/.test(selector) && retailer.portalProfileId ? retailer.portalProfileId : String(step.value || "").trim();
    if (!choice) throw new Error("Select steps require an option value or visible text.");
    const matched = await page.$eval(selector, (element, expected) => {
      const select = element;
      const options = Array.from(select.options || []);
      const direct = options.find((option) => option.value === expected);
      if (direct) return direct.value;
      const normalized = expected.trim().toLowerCase();
      const byLabel = options.find((option) => option.textContent.trim().toLowerCase() === normalized);
      if (byLabel) return byLabel.value;
      const partial = options.find((option) => option.textContent.trim().toLowerCase().includes(normalized));
      return partial ? partial.value : null;
    }, choice);
    if (!matched) throw new Error(`No option matched "${choice}" for ${selector}.`);
    return page.select(selector, matched);
  }
  if (step.action === "download") {
    return retry(async (attempt) => {
      const startedAt = Date.now();
      await page.waitForSelector(selector, { visible: true, timeout: 60000 });
      await page.click(selector);
      try {
        return await waitForDownload(downloadDir, startedAt, 75000);
      } catch (error) {
        if (attempt === 2) await page.reload({ waitUntil: "networkidle2", timeout: 90000 });
        throw error;
      }
    }, 3, 2500);
  }
  throw new Error(`Unsupported action: ${step.action}`);
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function captureFailureEvidence({ page, runRef, runId, step, stepNumber }) {
  const url = page?.url?.() || "";
  const failedSelector = String(step?.selector || step?.value || "").slice(0, 500);
  const basePath = `extraction-evidence/${runId}`;
  const evidence = { url: url.slice(0, 2000), stepNumber: stepNumber || null, action: step?.action || null, selector: failedSelector || null };
  if (page && !page.isClosed()) {
    const bucket = getStorage().bucket();
    const screenshotPath = `${basePath}/failure.png`;
    const htmlPath = `${basePath}/page.html`;
    try {
      const screenshot = await page.screenshot({ fullPage: true, type: "png" });
      await bucket.file(screenshotPath).save(screenshot, { contentType: "image/png", metadata: { metadata: { extractionRunId: runId } } });
      evidence.screenshotStoragePath = screenshotPath;
    } catch (captureError) {
      evidence.screenshotError = String(captureError.message || captureError).slice(0, 300);
    }
    try {
      const html = await page.content();
      await bucket.file(htmlPath).save(html, { contentType: "text/html; charset=utf-8", metadata: { metadata: { extractionRunId: runId } } });
      evidence.htmlStoragePath = htmlPath;
    } catch (captureError) {
      evidence.htmlError = String(captureError.message || captureError).slice(0, 300);
    }
  }
  await runRef.set({
    failedStep: stepNumber || null,
    failedAction: step?.action || null,
    failedSelector: failedSelector || null,
    failedUrl: url.slice(0, 2000) || null,
    failureEvidence: { ...evidence, capturedAt: new Date() }
  }, { merge: true });
}

async function advanceExtractionBatch(batchId, runId) {
  if (!batchId) return;
  const batchRef = db.collection("extractionBatches").doc(batchId);
  const runRef = db.collection("extractionRuns").doc(runId);
  await db.runTransaction(async (transaction) => {
    const [batchDoc, runDoc] = await Promise.all([transaction.get(batchRef), transaction.get(runRef)]);
    if (!batchDoc.exists || !runDoc.exists) return;
    const batch = batchDoc.data();
    const run = runDoc.data();
    if (batch.currentRunId !== runId || !["completed", "failed"].includes(run.status)) return;
    const completedCount = Number(batch.completedCount || 0) + (run.status === "completed" ? 1 : 0);
    const failedCount = Number(batch.failedCount || 0) + (run.status === "failed" ? 1 : 0);
    const nextPosition = Number(run.batchPosition || 0) + 1;
    if (nextPosition > batch.profileQueue.length) {
      const status = failedCount ? "completed_with_errors" : "completed";
      transaction.update(batchRef, {
        status, completedCount, failedCount,
        message: failedCount ? `${completedCount} reports saved; ${failedCount} profiles failed` : `${completedCount} reports saved under Files`,
        completedAt: FieldValue.serverTimestamp(), currentRunId: null
      });
      return;
    }
    const profile = batch.profileQueue[nextPosition - 1];
    const nextRunRef = db.collection("extractionRuns").doc();
    transaction.set(nextRunRef, extractionRunData({ ...batch, id: batchId }, profile, nextPosition));
    transaction.update(batchRef, {
      completedCount, failedCount, currentPosition: nextPosition, currentProfileName: profile.name,
      currentRunId: nextRunRef.id, status: "running",
      message: `Processing profile ${nextPosition} of ${batch.profileQueue.length} — ${profile.name}`
    });
  });
}

exports.processExtraction = onDocumentCreated({ document: "extractionRuns/{runId}", secrets: [retailerKey], timeoutSeconds: 540, memory: "2GiB" }, async (event) => {
  const runRef = event.data.ref;
  const run = event.data.data();
  let browser;
  let page;
  let downloadDir;
  let activeStep;
  let activeStepNumber;
  try {
    await runRef.update({ status: "running", message: `Logging in to ${run.retailerName}`, startedAt: FieldValue.serverTimestamp() });
    const [retailerDoc, secretDoc, extractionProfileDoc] = await Promise.all([
      db.collection("retailers").doc(run.retailerId).get(),
      db.collection("retailerSecrets").doc(run.retailerId).get(),
      run.extractionProfileId ? db.collection("extractionProfiles").doc(run.extractionProfileId).get() : Promise.resolve(null)
    ]);
    if (!retailerDoc.exists || !secretDoc.exists) throw new Error("Retailer configuration or credentials are missing.");
    const config = retailerDoc.data();
    const steps = extractionProfileDoc?.exists ? extractionProfileDoc.data().steps : config.steps;
    if (!Array.isArray(steps) || !steps.length) throw new Error("No extraction steps are linked to this retailer.");
    const retailer = {
      ...config,
      password: decryptPassword(secretDoc.data()),
      portalProfileId: run.portalProfileId || "",
      dynamicReportPeriod: run.extractionMode === "pnp-profile-sales"
    };
    downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-download-"));
    const launched = await launchAutomationBrowser(downloadDir);
    browser = launched.browser;
    page = launched.page;
    let downloaded;
    let actualReportPeriod = "Last month";
    let reportPeriodFallbackUsed = false;
    let reportSource = "new-export";
    let exportFlowStarted = false;
    for (let index = 0; index < steps.length; index += 1) {
      activeStep = steps[index];
      activeStepNumber = index + 1;
      await runRef.update({ message: run.portalProfileName ? `Extracting ${run.portalProfileName}: step ${activeStepNumber} of ${steps.length}` : `Running step ${activeStepNumber} of ${steps.length}: ${activeStep.action}`, currentStep: activeStepNumber });
      if (run.extractionMode === "pnp-profile-sales" && activeStep.action === "click" && /New Excel report/i.test(activeStep.selector || activeStep.value || "")) exportFlowStarted = true;
      try {
        const result = await runStep(page, activeStep, retailer, downloadDir);
        if (result?.actualReportPeriod) {
          actualReportPeriod = result.actualReportPeriod;
          reportPeriodFallbackUsed = result.reportPeriodFallbackUsed === true;
        }
        if (activeStep.action === "download") downloaded = result;
      } catch (stepError) {
        if (run.extractionMode !== "pnp-profile-sales" || !exportFlowStarted) throw stepError;
        await runRef.update({ message: `New export unavailable for ${run.portalProfileName}; checking existing Excel reports`, reportPeriodFallbackUsed: true });
        downloaded = await downloadLatestExistingReport(page, downloadDir);
        actualReportPeriod = downloaded.actualReportPeriod;
        reportPeriodFallbackUsed = true;
        reportSource = downloaded.reportSource;
        break;
      }
    }
    if (!downloaded) throw new Error("The extraction has no completed download step.");
    const verifiedStat = await fs.stat(downloaded.filePath);
    if (!verifiedStat.isFile() || verifiedStat.size <= 0 || verifiedStat.size !== downloaded.size) throw new Error("The downloaded file failed local size verification.");
    const sha256 = await hashFile(downloaded.filePath);
    const originalName = downloaded.name.replace(/[\\/#?%*:|"<>]/g, "_").slice(0, 240);
    const reportMetadata = {
      portalProfileDocId: run.portalProfileDocId || null,
      portalProfileId: run.portalProfileId || null,
      portalProfileName: run.portalProfileName || null,
      requestedReportPeriod: run.requestedReportPeriod || "Last month",
      actualReportPeriod,
      reportPeriodFallbackUsed,
      reportSource,
      extractionBatchId: run.batchId || null
    };
    const duplicateCandidates = await db.collection("files").where("sha256", "==", sha256).limit(20).get();
    const duplicate = duplicateCandidates.docs.find((document) => {
      const data = document.data();
      return data.retailerId === run.retailerId && data.size === downloaded.size && (data.originalName || data.name) === originalName;
    });
    if (duplicate) {
      const existing = duplicate.data();
      await runRef.update({
        status: "completed",
        message: `${originalName} is a duplicate of a file already saved under Files`,
        isDuplicate: true,
        duplicateOfFileId: duplicate.id,
        fileId: duplicate.id,
        fileName: existing.name,
        originalFileName: originalName,
        fileSize: downloaded.size,
        fileSha256: sha256,
        storagePath: existing.storagePath,
        ...reportMetadata,
        uploadedAt: existing.uploadedAt || existing.createdAt || null,
        completedAt: FieldValue.serverTimestamp()
      });
      return;
    }
    const fileId = crypto.randomUUID();
    const extension = path.extname(originalName) || ".xlsx";
    const cleanFilePart = (value) => String(value || "Report").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);
    const reportDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const generatedBaseName = `PicknPay_${cleanFilePart(run.portalProfileName)}_${cleanFilePart(actualReportPeriod)}_${reportDate}`;
    const safeName = run.extractionMode === "pnp-profile-sales"
      ? `${generatedBaseName.slice(0, Math.max(1, 240 - extension.length))}${extension}`
      : originalName;
    const storagePath = `uploads/${fileId}/${safeName}`;
    const bucket = getStorage().bucket();
    const [storedFile] = await bucket.upload(downloaded.filePath, { destination: storagePath, metadata: { contentType: "application/octet-stream", metadata: { extractionRunId: event.params.runId, extractionBatchId: run.batchId || "", retailerId: run.retailerId, portalProfileId: run.portalProfileId || "", sha256 } } });
    const [storedMetadata] = await storedFile.getMetadata();
    if (Number(storedMetadata.size) !== downloaded.size) {
      await storedFile.delete().catch(() => {});
      throw new Error("The Firebase Storage upload failed size verification.");
    }
    const fileRef = db.collection("files").doc(fileId);
    try {
      await fileRef.set({
        name: safeName, originalName, size: downloaded.size, type: "application/octet-stream", storagePath, sha256,
        isDuplicate: false, source: "retailer-extraction", retailerId: run.retailerId, extractionRunId: event.params.runId,
        ...reportMetadata,
        createdAt: FieldValue.serverTimestamp(), uploadedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp()
      });
      const verifiedFile = await fileRef.get();
      if (!verifiedFile.exists || verifiedFile.data().storagePath !== storagePath || verifiedFile.data().size !== downloaded.size) throw new Error("The Files record failed verification.");
    } catch (error) {
      await storedFile.delete().catch(() => {});
      throw error;
    }
    await runRef.update({
      status: "completed", message: `${safeName} has been saved under Files`, isDuplicate: false,
      fileId, fileName: safeName, originalFileName: originalName, fileSize: downloaded.size, fileSha256: sha256,
      storagePath, ...reportMetadata, uploadedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Extraction failed", event.params.runId, error);
    await captureFailureEvidence({ page, runRef, runId: event.params.runId, step: activeStep, stepNumber: activeStepNumber }).catch((captureError) => console.error("Failure evidence capture failed", event.params.runId, captureError));
    await runRef.update({ status: "failed", message: String(error.message || error).slice(0, 500), completedAt: FieldValue.serverTimestamp() });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (downloadDir) await fs.rm(downloadDir, { recursive: true, force: true }).catch(() => {});
    await advanceExtractionBatch(run.batchId, event.params.runId).catch((error) => console.error("Could not advance extraction batch", run.batchId, error));
  }
});
