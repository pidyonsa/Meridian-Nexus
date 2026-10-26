'use strict';
// Portal passwords for extraction profiles, encrypted exactly as the Firebase-era saveRetailer did (AES-256-GCM,
// 12-byte IV, base64 fields, version 1) with RETAILER_CREDENTIAL_KEY, so the Azure workers that decrypt retailerSecrets
// keep working. The key comes from Key Vault kv-nexusauto-p2fzlrpwgvn (secret retailer-credential-key) with the site's
// managed identity, which may read that one secret only (approved 25 Oct 2026). It is fetched per save, never cached.
const crypto = require('node:crypto');

const VAULT = 'https://kv-nexusauto-p2fzlrpwgvn.vault.azure.net';
const SECRET = 'retailer-credential-key';

function keySource({env = process.env, fetchImpl = fetch} = {}) {
  if (!env.IDENTITY_ENDPOINT) return null;
  return async function credentialKey() {
    const url = new URL(env.IDENTITY_ENDPOINT);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', 'https://vault.azure.net');
    if (env.AZURE_CLIENT_ID) url.searchParams.set('client_id', env.AZURE_CLIENT_ID);
    const tokenRes = await fetchImpl(url, {headers: {'X-IDENTITY-HEADER': env.IDENTITY_HEADER}});
    if (!tokenRes.ok) throw new Error(`Azure managed identity token: ${tokenRes.status}`);
    const {access_token: token} = await tokenRes.json();
    const res = await fetchImpl(`${env.KEY_VAULT_URL || VAULT}/secrets/${SECRET}?api-version=7.4`, {headers: {Authorization: `Bearer ${token}`}});
    if (!res.ok) throw new Error(`Key Vault ${SECRET}: ${res.status}`);
    const key = Buffer.from((await res.json()).value, 'base64');
    if (key.length !== 32) throw new Error('RETAILER_CREDENTIAL_KEY must decode to 32 bytes.');
    return key;
  };
}

function encryptPassword(password, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return {ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), version: 1};
}

function decryptPassword(secret, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = {keySource, encryptPassword, decryptPassword};
