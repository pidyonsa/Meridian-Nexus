"use strict";
// Starts the Nexus ETL worker as an Azure Container Apps job execution instead of the Cloud Run job.
// Keyless: the function's Google identity token is exchanged at Microsoft Entra for an Azure token of
// the user-assigned identity id-nexus-gcp-launcher, which may only start and read job-nexus-etl.
const ARM = "https://management.azure.com";
const API = "api-version=2024-03-01";

function createAzureEtlLauncher({ tenantId, clientId, jobId, fetchImpl = fetch }) {
  if (!/^[0-9a-f-]{36}$/.test(tenantId || "") || !/^[0-9a-f-]{36}$/.test(clientId || "") || !/^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.App\/jobs\/[a-z0-9-]+$/i.test(jobId || "")) throw new Error("Azure ETL launcher is not configured.");
  async function ok(response, step) {
    if (response.ok) return response.json();
    throw Object.assign(new Error(`Azure ETL ${step} failed (${response.status}).`), { code: response.status });
  }
  async function azureToken() {
    const google = await fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=api%3A%2F%2FAzureADTokenExchange&format=full", { headers: { "Metadata-Flavor": "Google" } });
    if (!google.ok) throw Object.assign(new Error(`Google identity token failed (${google.status}).`), { code: google.status });
    const body = new URLSearchParams({ client_id: clientId, scope: `${ARM}/.default`, grant_type: "client_credentials", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: (await google.text()).trim() });
    return (await ok(await fetchImpl(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }), "token")).access_token;
  }
  return async function invokeJob(runId) {
    if (!/^[a-f0-9]{32}(?:-[a-f0-9]{8})?$/.test(runId || "")) throw new Error("Invalid ETL run id.");
    const headers = { Authorization: `Bearer ${await azureToken()}`, "Content-Type": "application/json" };
    const job = await ok(await fetchImpl(`${ARM}${jobId}?${API}`, { headers }), "job read");
    // Only ETL_RUN_ID changes; image, size, identity and the rest of the template stay as defined.
    const containers = job.properties.template.containers.map(c => ({ ...c, env: (c.env || []).map(e => e.name === "ETL_RUN_ID" ? { name: "ETL_RUN_ID", value: runId } : e) }));
    if (!containers[0]?.env?.some(e => e.name === "ETL_RUN_ID" && e.value === runId)) throw new Error("Azure ETL job template has no ETL_RUN_ID.");
    const started = await ok(await fetchImpl(`${ARM}${jobId}/start?${API}`, { method: "POST", headers, body: JSON.stringify({ containers }) }), "start");
    return { name: `azure:${started.name || String(started.id || "").split("/").pop()}` };
  };
}

// ETL_EXECUTOR=azure switches launches to Azure; anything else keeps the Cloud Run job (rollback).
function etlLauncherFromEnv(env = process.env) {
  if (env.ETL_EXECUTOR !== "azure") return undefined;
  return createAzureEtlLauncher({ tenantId: env.AZURE_TENANT_ID, clientId: env.AZURE_ETL_LAUNCHER_CLIENT_ID, jobId: env.AZURE_ETL_JOB_ID });
}

module.exports = { createAzureEtlLauncher, etlLauncherFromEnv };
