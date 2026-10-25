'use strict';
// Google access tokens for the Azure Nexus, keyless:
//   Azure managed identity token -> Google STS (workload identity pool "azure-nexus-automations", provider "entra")
//   -> impersonate GOOGLE_SERVICE_ACCOUNT (nexus-portal@: Firestore read/write and the Nexus storage bucket).
// App Service and Container Apps both expose IDENTITY_ENDPOINT/IDENTITY_HEADER; AZURE_CLIENT_ID picks a user-assigned
// identity (none for the site's system-assigned one). Locally the gcloud CLI's own token is used instead.
const {execFileSync} = require('node:child_process');

const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

async function azureToken(env, resource, fetchImpl) {
  const url = new URL(env.IDENTITY_ENDPOINT);
  url.searchParams.set('api-version', '2019-08-01');
  url.searchParams.set('resource', resource);
  if (env.AZURE_CLIENT_ID) url.searchParams.set('client_id', env.AZURE_CLIENT_ID);
  const res = await fetchImpl(url, {headers: {'X-IDENTITY-HEADER': env.IDENTITY_HEADER}});
  if (!res.ok) throw new Error(`Azure managed identity token: ${res.status}`);
  return (await res.json()).access_token;
}

async function federatedToken(env, fetchImpl) {
  const subject = await azureToken(env, env.GOOGLE_AUDIENCE, fetchImpl);
  const sts = await fetchImpl('https://sts.googleapis.com/v1/token', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', audience: env.GOOGLE_PROVIDER, scope: SCOPE,
    requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token', subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', subjectToken: subject
  })});
  if (!sts.ok) throw new Error(`Google STS: ${sts.status} ${(await sts.text()).slice(0, 300)}`);
  const federated = (await sts.json()).access_token;
  const sa = await fetchImpl(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GOOGLE_SERVICE_ACCOUNT}:generateAccessToken`, {
    method: 'POST', headers: {Authorization: `Bearer ${federated}`, 'Content-Type': 'application/json'}, body: JSON.stringify({scope: [SCOPE], lifetime: '3600s'})
  });
  if (!sa.ok) throw new Error(`Google impersonation: ${sa.status} ${(await sa.text()).slice(0, 300)}`);
  return (await sa.json()).accessToken;
}

// Configured when the site may reach Firestore and Storage (GOOGLE_PROVIDER, GOOGLE_AUDIENCE, GOOGLE_SERVICE_ACCOUNT).
const googleConfigured = (env = process.env) => Boolean(env.GOOGLE_PROVIDER && env.GOOGLE_AUDIENCE && env.GOOGLE_SERVICE_ACCOUNT);

// Refreshes ten minutes before the one-hour lifetime; concurrent callers share one refresh.
function tokenSource(env = process.env, fetchImpl = fetch) {
  let cached = null, pending = null;
  return async () => {
    if (cached && cached.expires > Date.now()) return cached.token;
    pending ||= (async () => {
      const token = env.IDENTITY_ENDPOINT
        ? await federatedToken(env, fetchImpl)
        : execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', ['auth', 'print-access-token'], {encoding: 'utf8', shell: process.platform === 'win32'}).trim();
      cached = {token, expires: Date.now() + 50 * 60 * 1000};
      return token;
    })().finally(() => { pending = null; });
    return pending;
  };
}

module.exports = {tokenSource, googleConfigured};
