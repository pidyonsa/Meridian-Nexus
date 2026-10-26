'use strict';
// Portal passwords for extraction profiles, encrypted exactly as the Firebase-era saveRetailer did (AES-256-GCM,
// 12-byte IV, base64 fields, version 1) with RETAILER_CREDENTIAL_KEY, so the Azure workers that decrypt retailerSecrets
// keep working. The key comes from Key Vault (secret retailer-credential-key), read per save and never cached.
const crypto = require('node:crypto');
const {keyVault} = require('../azure/keyvault.cjs');

function keySource({env = process.env, fetchImpl = fetch} = {}) {
  const vault = keyVault({env, fetchImpl});
  if (!vault) return null;
  return async function credentialKey() {
    const key = Buffer.from(await vault.read('retailer-credential-key'), 'base64');
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
