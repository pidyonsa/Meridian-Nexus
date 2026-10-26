'use strict';
// Key Vault secrets for the Azure Nexus, read with the site's managed identity. The identity may read only the
// secrets it was granted (retailer-credential-key; the three SharePoint app secrets). Values are cached briefly so a
// burst of Graph calls does not re-read them; the credential key is never cached (see profiles/credentials.cjs).
const VAULT = 'https://kv-nexusauto-p2fzlrpwgvn.vault.azure.net';

function keyVault({env = process.env, fetchImpl = fetch, ttlMs = 10 * 60 * 1000} = {}) {
  if (!env.IDENTITY_ENDPOINT) return null;
  const cache = new Map();
  async function token() {
    const url = new URL(env.IDENTITY_ENDPOINT);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', 'https://vault.azure.net');
    if (env.AZURE_CLIENT_ID) url.searchParams.set('client_id', env.AZURE_CLIENT_ID);
    const res = await fetchImpl(url, {headers: {'X-IDENTITY-HEADER': env.IDENTITY_HEADER}});
    if (!res.ok) throw new Error(`Azure managed identity token: ${res.status}`);
    return (await res.json()).access_token;
  }
  async function read(name) {
    const res = await fetchImpl(`${env.KEY_VAULT_URL || VAULT}/secrets/${name}?api-version=7.4`, {headers: {Authorization: `Bearer ${await token()}`}});
    if (!res.ok) throw new Error(`Key Vault ${name}: ${res.status}`);
    return (await res.json()).value;
  }
  return {
    read,
    async cached(name) {
      const hit = cache.get(name);
      if (hit && hit.expires > Date.now()) return hit.value;
      const value = await read(name);
      cache.set(name, {value, expires: Date.now() + ttlMs});
      return value;
    }
  };
}

module.exports = {keyVault};
