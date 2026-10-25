'use strict';
// Starts the ETL worker (Container Apps job job-nexus-etl) for one run, with the site's own managed identity, which
// holds only the custom role "Nexus ETL Job Starter" on that job (read, start, read executions; approved 25 Oct 2026).
// Same request as the Firebase launcher (functions/etl-azure-launcher.js): only ETL_RUN_ID changes.
const ARM = 'https://management.azure.com';
const API = 'api-version=2024-03-01';
const JOB = '/subscriptions/02b268fe-e01a-453e-b287-eec83ccc0676/resourceGroups/rg-meridian-nexus-automations/providers/Microsoft.App/jobs/job-nexus-etl';
const RUN_ID = /^[a-f0-9]{32}(?:-[a-f0-9]{8})?$/;

function etlLauncher({env = process.env, jobId = env.AZURE_ETL_JOB_ID || JOB, fetchImpl = fetch} = {}) {
  if (!env.IDENTITY_ENDPOINT) return null;
  async function token() {
    const url = new URL(env.IDENTITY_ENDPOINT);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', `${ARM}/`);
    if (env.AZURE_CLIENT_ID) url.searchParams.set('client_id', env.AZURE_CLIENT_ID);
    const res = await fetchImpl(url, {headers: {'X-IDENTITY-HEADER': env.IDENTITY_HEADER}});
    if (!res.ok) throw new Error(`Azure managed identity token: ${res.status}`);
    return (await res.json()).access_token;
  }
  async function ok(res, step) {
    if (res.ok) return res.json();
    throw Object.assign(new Error(`Azure ETL ${step} failed (${res.status}).`), {code: res.status});
  }
  return async function invokeJob(runId) {
    if (!RUN_ID.test(runId || '')) throw new Error('Invalid ETL run id.');
    const headers = {Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json'};
    const job = await ok(await fetchImpl(`${ARM}${jobId}?${API}`, {headers}), 'job read');
    const containers = job.properties.template.containers.map(c => ({...c, env: (c.env || []).map(e => (e.name === 'ETL_RUN_ID' ? {name: 'ETL_RUN_ID', value: runId} : e))}));
    if (!containers[0]?.env?.some(e => e.name === 'ETL_RUN_ID' && e.value === runId)) throw new Error('Azure ETL job template has no ETL_RUN_ID.');
    const started = await ok(await fetchImpl(`${ARM}${jobId}/start?${API}`, {method: 'POST', headers, body: JSON.stringify({containers})}), 'start');
    return {name: `azure:${started.name || String(started.id || '').split('/').pop()}`};
  };
}

module.exports = {etlLauncher};
