'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createAzureEtlLauncher, etlLauncherFromEnv } = require('../../functions/etl-azure-launcher');
const JOB = '/subscriptions/02b268fe-e01a-453e-b287-eec83ccc0676/resourceGroups/rg-meridian-nexus-automations/providers/Microsoft.App/jobs/job-nexus-etl';
const config = { tenantId: 'cbe83df2-b350-4dab-8d5f-f78d21fe7d27', clientId: '99f25773-43a8-4b36-8b08-175ab7126ed7', jobId: JOB };
function fake(overrides = {}) {
  const calls = [];
  const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith('http://metadata.google.internal')) return overrides.google || reply(200, 'google-id-token');
    if (url.includes('login.microsoftonline.com')) return overrides.token || reply(200, { access_token: 'azure-token' });
    if (url.endsWith('/start?api-version=2024-03-01')) return overrides.start || reply(202, { name: 'job-nexus-etl-abc123' });
    return reply(200, { properties: { template: { containers: [{ name: 'worker', image: 'acr/nexus-etl/worker:gcp-2a1732a7', env: [{ name: 'ETL_RUN_ID', value: 'unset' }, { name: 'GOOGLE_CLOUD_PROJECT', value: 'meridain-nexus' }] }] } } });
  };
  return { calls, fetchImpl };
}
test('Google identity token is exchanged at Entra and only ETL_RUN_ID changes in the started execution', async () => {
  const f = fake(); const run = '0c19b8544f0e7c61ae28ff02b51aa243-29b4e834';
  const result = await createAzureEtlLauncher({ ...config, fetchImpl: f.fetchImpl })(run);
  assert.deepEqual(result, { name: 'azure:job-nexus-etl-abc123' });
  assert.equal(f.calls[0].init.headers['Metadata-Flavor'], 'Google');
  assert.match(f.calls[0].url, /audience=api%3A%2F%2FAzureADTokenExchange/);
  const form = new URLSearchParams(f.calls[1].init.body);
  assert.equal(form.get('client_assertion'), 'google-id-token'); assert.equal(form.get('client_id'), config.clientId); assert.equal(form.get('scope'), 'https://management.azure.com/.default');
  const body = JSON.parse(f.calls[3].init.body);
  assert.deepEqual(body.containers[0].env, [{ name: 'ETL_RUN_ID', value: run }, { name: 'GOOGLE_CLOUD_PROJECT', value: 'meridain-nexus' }]);
  assert.equal(body.containers[0].image, 'acr/nexus-etl/worker:gcp-2a1732a7');
  assert.equal(f.calls[3].init.headers.Authorization, 'Bearer azure-token');
});
test('invalid run ids and failed steps are refused without starting a job', async () => {
  const f = fake();
  await assert.rejects(createAzureEtlLauncher({ ...config, fetchImpl: f.fetchImpl })('../x'), /Invalid ETL run id/);
  assert.equal(f.calls.length, 0);
  const denied = fake({ token: { ok: false, status: 401, json: async () => ({}), text: async () => '' } });
  await assert.rejects(createAzureEtlLauncher({ ...config, fetchImpl: denied.fetchImpl })('0c19b8544f0e7c61ae28ff02b51aa243'), e => e.code === 401);
  assert.ok(!denied.calls.some(c => c.url.includes('/start')));
});
test('the executor switch defaults to Google and requires complete Azure settings', () => {
  assert.equal(etlLauncherFromEnv({}), undefined);
  assert.equal(etlLauncherFromEnv({ ETL_EXECUTOR: 'google' }), undefined);
  assert.throws(() => etlLauncherFromEnv({ ETL_EXECUTOR: 'azure' }), /not configured/);
  assert.equal(typeof etlLauncherFromEnv({ ETL_EXECUTOR: 'azure', AZURE_TENANT_ID: config.tenantId, AZURE_ETL_LAUNCHER_CLIENT_ID: config.clientId, AZURE_ETL_JOB_ID: JOB }), 'function');
});
