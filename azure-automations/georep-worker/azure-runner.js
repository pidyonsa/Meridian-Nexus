"use strict";
// Runs one Nexus extraction run on Azure with the unchanged processExtraction handler from the deployed
// Google bundle. Keyless Google access: the Azure identity token is written for an external-account
// credentials file (Workload Identity Federation), then the handler is called with the same event shape
// the Firestore trigger delivers (id, params.runId, data = the run document snapshot).
const fs = require("node:fs");

async function googleCredentials(env) {
  const r = await fetch(`${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent(env.AUDIENCE)}&client_id=${env.AZURE_CLIENT_ID}`, { headers: { "X-IDENTITY-HEADER": env.IDENTITY_HEADER } });
  if (!r.ok) throw new Error(`Azure token ${r.status}`);
  fs.writeFileSync("/tmp/azure-token", (await r.json()).access_token, { mode: 0o600 });
  fs.writeFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, JSON.stringify({
    type: "external_account", audience: env.GOOGLE_PROVIDER,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt", token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GOOGLE_SERVICE_ACCOUNT}:generateAccessToken`,
    credential_source: { file: "/tmp/azure-token" }
  }), { mode: 0o600 });
}

// The deployed code reads these Firebase secret parameters from the environment; on Azure they come from
// Key Vault, fetched by this container's own identity at start (values stay in process memory only).
const SECRETS = { RETAILER_CREDENTIAL_KEY: "retailer-credential-key", SHAREPOINT_TENANT_ID: "sharepoint-tenant-id", SHAREPOINT_CLIENT_ID: "sharepoint-client-id", SHAREPOINT_CLIENT_SECRET: "sharepoint-client-secret", GEMINI_API_KEY: "gemini-api-key", GEO_REP_OPEN_API_ID: "geo-rep-open-api-id", GEO_REP_OPEN_API_KEY: "geo-rep-open-api-key" };
async function loadSecrets(env) {
  const t = await fetch(`${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent("https://vault.azure.net")}&client_id=${env.AZURE_CLIENT_ID}`, { headers: { "X-IDENTITY-HEADER": env.IDENTITY_HEADER } });
  if (!t.ok) throw new Error(`Key Vault token ${t.status}`);
  const token = (await t.json()).access_token;
  for (const [name, secret] of Object.entries(SECRETS)) {
    const r = await fetch(`${env.KEY_VAULT_URL}/secrets/${secret}?api-version=7.4`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Key Vault secret ${secret}: ${r.status}`);
    const value = (await r.json()).value;
    if (!value) throw new Error(`Key Vault secret ${secret} is empty`);
    env[name] = value;
  }
}

async function main() {
  const env = process.env;
  if (env.RUNNER_MODE !== "smoke") await loadSecrets(env);
  if (env.RUNNER_MODE === "smoke") {
    // Image check only: the bundle loads, the handler is callable and Chromium starts.
    const fn = require("./index.js").processExtraction;
    if (typeof fn?.run !== "function") throw new Error("processExtraction handler not found");
    // Same library entry point and flags as launchAutomationBrowser in the deployed index.js.
    const chromium = require("@sparticuz/chromium").default, puppeteer = require("puppeteer-core");
    const browser = await puppeteer.launch({ args: [...chromium.args, "--disable-dev-shm-usage", "--disable-popup-blocking"], executablePath: await chromium.executablePath(), headless: true, timeout: 90000 });
    const page = await browser.newPage(); await page.goto("https://meridian.georep.com/portal/", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(JSON.stringify({ event: "georep-portal-reachable", title: await page.title() }));
    const version = await browser.version(); await browser.close();
    console.log(JSON.stringify({ event: "georep-worker-smoke-ok", handler: true, browser: version }));
    return;
  }
  if (env.RUNNER_MODE === "check") {
    // Read-only: Google sign-in through the federation link, one Firestore read, secrets present (lengths only).
    await googleCredentials(env);
    const present = () => Object.fromEntries(Object.keys(SECRETS).map(s => [s, Boolean(process.env[s])]));
    const beforeLoad = present();
    const { getFirestore } = require("firebase-admin/firestore");
    require("./index.js");
    const doc = await getFirestore().doc("retailers/geo-rep-sales-transactions").get();
    console.log(JSON.stringify({ event: "georep-worker-check", firestoreRead: doc.exists, retailer: doc.get("name"), secretsBeforeLoad: beforeLoad, secretsAfterLoad: present() }));
    return;
  }
  if (env.RUNNER_MODE === "dispatch") {
    // Scheduled every 2 minutes: start one worker execution per run the Google trigger handed to Azure.
    await googleCredentials(env);
    const { getFirestore, FieldValue } = require("firebase-admin/firestore");
    require("./index.js");
    const db = getFirestore();
    const reserved = await db.collection("extractionRuns").where("status", "==", "azure-reserved").limit(10).get();
    const t = await fetch(`${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent("https://management.azure.com/")}&client_id=${env.AZURE_CLIENT_ID}`, { headers: { "X-IDENTITY-HEADER": env.IDENTITY_HEADER } });
    if (!t.ok) throw new Error(`Azure management token ${t.status}`);
    const arm = (await t.json()).access_token, job = `https://management.azure.com${env.WORKER_JOB_ID}`;
    for (const doc of reserved.docs) {
      // Claim for dispatch first so a later dispatcher pass cannot start it twice.
      const claimed = await db.runTransaction(async tx => {
        const run = (await tx.get(doc.ref)).data();
        if (run?.status !== "azure-reserved") return false;
        tx.set(doc.ref, { status: "azure-dispatching", lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
        return true;
      });
      if (!claimed) continue;
      try {
        const def = await (await fetch(`${job}?api-version=2024-03-01`, { headers: { Authorization: `Bearer ${arm}` } })).json();
        const containers = def.properties.template.containers.map(c => ({ ...c, env: (c.env || []).map(e => e.name === "RUN_ID" ? { name: "RUN_ID", value: doc.id } : e.name === "RUNNER_MODE" ? { name: "RUNNER_MODE", value: "run" } : e) }));
        const r = await fetch(`${job}/start?api-version=2024-03-01`, { method: "POST", headers: { Authorization: `Bearer ${arm}`, "Content-Type": "application/json" }, body: JSON.stringify({ containers }) });
        if (!r.ok) throw new Error(`start ${r.status}`);
        const started = await r.json();
        console.log(JSON.stringify({ event: "azure-dispatched", runId: doc.id, execution: started.name }));
      } catch (error) {
        // Return it to the queue for the next pass rather than losing it.
        await doc.ref.set({ status: "azure-reserved", message: `Azure dispatch retry: ${String(error.message).slice(0, 200)}`, lastActivityAt: FieldValue.serverTimestamp() }, { merge: true });
        console.log(JSON.stringify({ event: "azure-dispatch-failed", runId: doc.id, error: String(error.message).slice(0, 200) }));
      }
    }
    console.log(JSON.stringify({ event: "azure-dispatcher-pass", reserved: reserved.size }));
    return;
  }
  const runId = env.RUN_ID || "";
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(runId)) throw new Error("RUN_ID is required");
  await googleCredentials(env);
  const { processExtraction } = require("./index.js");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");
  const ref = getFirestore().collection("extractionRuns").doc(runId);
  const execution = env.CONTAINER_APP_JOB_EXECUTION_NAME || `azure-${Date.now()}`;
  // Runs for Azure are created as "azure-reserved", which the Google trigger ignores (it claims only "queued").
  // Hand the run to the unchanged handler by making it "queued" here, only if it is still reserved.
  await getFirestore().runTransaction(async transaction => {
    const run = (await transaction.get(ref)).data();
    if (!run) throw new Error(`Run ${runId} not found`);
    if (!["azure-reserved", "azure-dispatching"].includes(run.status)) throw new Error(`Run ${runId} is ${run.status}, not reserved for Azure`);
    transaction.set(ref, { status: "queued", executor: "azure", azureExecution: execution, lastActivityAt: FieldValue.serverTimestamp(),
      executionTimeline: FieldValue.arrayUnion({ event: "azure-dispatched", at: new Date().toISOString(), message: `Started on Azure (${execution}).` }) }, { merge: true });
  });
  const snapshot = await ref.get();
  console.log(JSON.stringify({ event: "azure-extraction-start", runId, execution }));
  await processExtraction.run({ id: `azure:${execution}`, params: { runId }, data: snapshot });
  console.log(JSON.stringify({ event: "azure-extraction-finished", runId, execution }));
}

main().then(() => process.exit(0)).catch(error => {
  console.log(JSON.stringify({ event: "azure-extraction-runner-failed", error: String(error.message || error).slice(0, 500) }));
  process.exit(1);
});
