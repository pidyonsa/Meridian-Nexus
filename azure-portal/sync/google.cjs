'use strict';
// Google access token for Firestore, keyless.
// In Azure: the job's managed identity token -> Google STS (workload identity pool "azure-nexus-automations") ->
// impersonate a read-only service account. Locally: the gcloud CLI's own token.
const {execFileSync} = require('node:child_process');

async function azureToken(env, resource) {
  const url = `${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}&client_id=${env.AZURE_CLIENT_ID}`;
  const res = await fetch(url, {headers: {'X-IDENTITY-HEADER': env.IDENTITY_HEADER}});
  if (!res.ok) throw new Error(`Azure managed identity token: ${res.status}`);
  return (await res.json()).access_token;
}

async function federatedToken(env) {
  const subject = await azureToken(env, env.AUDIENCE);
  const sts = await fetch('https://sts.googleapis.com/v1/token', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', audience: env.GOOGLE_PROVIDER, scope: 'https://www.googleapis.com/auth/cloud-platform',
    requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token', subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', subjectToken: subject
  })});
  if (!sts.ok) throw new Error(`Google STS: ${sts.status} ${(await sts.text()).slice(0, 300)}`);
  const federated = (await sts.json()).access_token;
  const sa = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GOOGLE_SERVICE_ACCOUNT}:generateAccessToken`, {
    method: 'POST', headers: {Authorization: `Bearer ${federated}`, 'Content-Type': 'application/json'}, body: JSON.stringify({scope: ['https://www.googleapis.com/auth/datastore'], lifetime: '3600s'})
  });
  if (!sa.ok) throw new Error(`Google impersonation: ${sa.status} ${(await sa.text()).slice(0, 300)}`);
  return (await sa.json()).accessToken;
}

// Refreshes a little before the one-hour lifetime.
function tokenSource(env = process.env) {
  let cached = null;
  return async () => {
    if (cached && cached.expires > Date.now()) return cached.token;
    const token = env.IDENTITY_ENDPOINT
      ? await federatedToken(env)
      : execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', ['auth', 'print-access-token'], {encoding: 'utf8', shell: process.platform === 'win32'}).trim();
    cached = {token, expires: Date.now() + 50 * 60 * 1000};
    return token;
  };
}

module.exports = {tokenSource};
