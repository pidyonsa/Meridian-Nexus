"use strict";
// Runs Nexus scheduled functions on Azure Container Apps jobs with the code deployed on Google: loads the function's
// deployed bundle and calls its onSchedule handler with the event Cloud Scheduler would deliver. FUNCTIONS (comma
// list) run one after another; one failing does not stop the others. Google access is keyless (Workload Identity
// Federation as georep-worker@); secrets come from Key Vault, only those Google mounts for the function.
const fs = require("node:fs"), path = require("node:path");
const { FUNCTIONS } = require("./functions.cjs");
const SECRET_NAMES = { GEO_REP_OPEN_API_ID: "geo-rep-open-api-id", GEO_REP_OPEN_API_KEY: "geo-rep-open-api-key" };

async function azureToken(env, resource) {
  const r = await fetch(`${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}&client_id=${env.AZURE_CLIENT_ID}`, { headers: { "X-IDENTITY-HEADER": env.IDENTITY_HEADER } });
  if (!r.ok) throw new Error(`Azure token ${r.status}`);
  return (await r.json()).access_token;
}
async function googleCredentials(env) {
  fs.writeFileSync("/tmp/azure-token", await azureToken(env, env.AUDIENCE), { mode: 0o600 });
  fs.writeFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, JSON.stringify({
    type: "external_account", audience: env.GOOGLE_PROVIDER,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt", token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GOOGLE_SERVICE_ACCOUNT}:generateAccessToken`,
    credential_source: { file: "/tmp/azure-token" }
  }), { mode: 0o600 });
}
async function loadSecrets(env, names) {
  if (!names.length) return;
  const token = await azureToken(env, "https://vault.azure.net");
  for (const name of names) {
    const r = await fetch(`${env.KEY_VAULT_URL}/secrets/${SECRET_NAMES[name]}?api-version=7.4`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Key Vault secret ${SECRET_NAMES[name]}: ${r.status}`);
    const value = (await r.json()).value;
    if (!value) throw new Error(`Key Vault secret ${SECRET_NAMES[name]} is empty`);
    env[name] = value;
  }
}

async function main() {
  const env = process.env;
  const names = String(env.FUNCTIONS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!names.length || names.some(n => !FUNCTIONS[n])) throw new Error(`Unknown FUNCTIONS: ${env.FUNCTIONS}`);
  if (new Set(names.map(n => FUNCTIONS[n].set)).size > 1) throw new Error("FUNCTIONS must share one code set");
  await googleCredentials(env);
  await loadSecrets(env, [...new Set(names.flatMap(n => FUNCTIONS[n].secrets))]);
  const bundle = require(path.join(__dirname, "fns", FUNCTIONS[names[0]].set, "index.js"));
  // Cloud Scheduler delivers the scheduled minute; the job starts on the minute, so use the current minute.
  const scheduleTime = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  let failed = 0;
  for (const name of names) {
    const started = Date.now();
    try {
      if (typeof bundle[name]?.run !== "function") throw new Error("handler not found");
      await bundle[name].run({ scheduleTime, jobName: `azure/${env.CONTAINER_APP_JOB_NAME || "manual"}/${name}` });
      console.log(JSON.stringify({ event: "scheduled-function-ok", function: name, ms: Date.now() - started }));
    } catch (error) {
      failed++;
      console.log(JSON.stringify({ event: "scheduled-function-failed", function: name, ms: Date.now() - started, error: String(error?.stack || error).slice(0, 800) }));
    }
  }
  return failed;
}

main().then(failed => process.exit(failed ? 1 : 0)).catch(error => {
  console.log(JSON.stringify({ event: "scheduled-runner-failed", error: String(error.message || error).slice(0, 500) }));
  process.exit(1);
});
