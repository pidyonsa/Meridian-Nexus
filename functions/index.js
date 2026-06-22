const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const chromium = require("@sparticuz/chromium");
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
  const allowed = new Set(["navigate", "fillUsername", "fillPassword", "click", "waitFor", "wait", "select", "download"]);
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

async function waitForDownload(directory, startedAt, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const names = await fs.readdir(directory).catch(() => []);
    const complete = names.filter((name) => !name.endsWith(".crdownload") && !name.endsWith(".tmp"));
    for (const name of complete) {
      const filePath = path.join(directory, name);
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs >= startedAt && stat.size > 0) return { name, filePath, size: stat.size };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The portal did not finish a file download before the timeout.");
}

async function runStep(page, step, retailer, downloadDir) {
  const selector = step.selector;
  if (step.action === "navigate") return page.goto(step.value || retailer.webAddress, { waitUntil: "networkidle2", timeout: 90000 });
  if (step.action === "wait") return new Promise((resolve) => setTimeout(resolve, Math.min(120, Math.max(1, Number(step.value) || 1)) * 1000));
  if (!selector) throw new Error(`${step.action} requires a CSS selector.`);
  await page.waitForSelector(selector, { visible: true, timeout: 60000 });
  if (step.action === "fillUsername" || step.action === "fillPassword") {
    const value = step.action === "fillUsername" ? retailer.username : retailer.password;
    await page.click(selector, { clickCount: 3 });
    return page.type(selector, value, { delay: 20 });
  }
  if (step.action === "click") return page.click(selector);
  if (step.action === "waitFor") return;
  if (step.action === "select") {
    const choice = String(step.value || "").trim();
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
    const startedAt = Date.now();
    await page.click(selector);
    return waitForDownload(downloadDir, startedAt);
  }
  throw new Error(`Unsupported action: ${step.action}`);
}

exports.processExtraction = onDocumentCreated({ document: "extractionRuns/{runId}", secrets: [retailerKey], timeoutSeconds: 540, memory: "2GiB" }, async (event) => {
  const runRef = event.data.ref;
  const run = event.data.data();
  let browser;
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
    const retailer = { ...config, password: decryptPassword(secretDoc.data()) };
    const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-download-"));
    browser = await puppeteer.launch({ args: [...chromium.args, "--disable-dev-shm-usage"], defaultViewport: { width: 1440, height: 1000 }, executablePath: await chromium.executablePath(), headless: true });
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
    let downloaded;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      await runRef.update({ message: `Running step ${index + 1} of ${steps.length}: ${step.action}`, currentStep: index + 1 });
      const result = await runStep(page, step, retailer, downloadDir);
      if (step.action === "download") downloaded = result;
    }
    if (!downloaded) throw new Error("The extraction has no completed download step.");
    const fileId = crypto.randomUUID();
    const safeName = downloaded.name.replace(/[\\/#?%*:|"<>]/g, "_").slice(0, 240);
    const storagePath = `uploads/${fileId}/${safeName}`;
    await getStorage().bucket().upload(downloaded.filePath, { destination: storagePath, metadata: { contentType: "application/octet-stream", metadata: { extractionRunId: event.params.runId, retailerId: run.retailerId } } });
    await db.collection("files").doc(fileId).set({ name: safeName, size: downloaded.size, type: "application/octet-stream", storagePath, createdAt: FieldValue.serverTimestamp(), source: "retailer-extraction", retailerId: run.retailerId, extractionRunId: event.params.runId });
    await runRef.update({ status: "completed", message: `${safeName} has been saved under Files`, fileId, fileName: safeName, completedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    console.error("Extraction failed", event.params.runId, error);
    await runRef.update({ status: "failed", message: String(error.message || error).slice(0, 500), completedAt: FieldValue.serverTimestamp() });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});
