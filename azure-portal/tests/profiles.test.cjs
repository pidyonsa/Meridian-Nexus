'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {memoryFirestore} = require('./helpers/memory-firestore.cjs');
const {profileService, validateSteps} = require('../server/profiles/service.cjs');
const {keySource, decryptPassword} = require('../server/profiles/credentials.cjs');

const KEY = crypto.randomBytes(32);
const admin = {email: 'jpinto@meridiangroup.co.za', name: 'Jeorge Pinto'};
const world = () => {
  const fs = memoryFirestore({
    'adminUsers/uid-jp': {email: 'jpinto@meridiangroup.co.za'},
    'extractionProfiles/geo-steps': {name: 'Geo steps', steps: [{id: 's1', action: 'navigate', selector: '', value: ''}]},
    'retailers/geo-rep-sales-transactions': {name: 'Geo Rep Sales transactions', webAddress: 'https://meridian.georep.com', username: 'bot', extractionProfileId: 'geo-steps', reportSchedule: {enabled: true, time: '12:00'}, executor: 'azure'},
    'retailerSecrets/geo-rep-sales-transactions': {ciphertext: 'x', iv: 'y', tag: 'z', version: 1, updatedAt: '2026-09-01T00:00:00Z'},
    'retailers/idle': {name: 'Idle', webAddress: 'https://portal.example', username: 'u'},
    'extractionRuns/r1': {retailerId: 'idle', status: 'running'}
  });
  return {fs, service: profileService({fs, credentialKey: async () => KEY})};
};

test('a new profile needs a password, which is stored encrypted the way the workers decrypt it and never listed', async () => {
  const {fs, service} = world();
  await assert.rejects(service.saveProfile(admin, {name: 'Shoprite Portal', webAddress: 'https://portal.shoprite.example', username: 'meridian'}), /Add a login password/);
  await assert.rejects(service.saveProfile(admin, {name: 'Bad', webAddress: 'http://plain.example', username: 'u', password: 'p'}), /https/);
  await assert.rejects(service.saveProfile(admin, {name: 'Bad', webAddress: 'not a url', username: 'u', password: 'p'}), /valid portal web address/);
  const {id} = await service.saveProfile(admin, {name: 'Shoprite Portal', webAddress: 'https://portal.shoprite.example', username: 'meridian', password: 's3cret!', extractionProfileId: 'geo-steps'});
  assert.equal(id, 'shoprite-portal');
  const secret = fs.docs.get('retailerSecrets/shoprite-portal');
  assert.equal(secret.version, 1); assert.notEqual(secret.ciphertext, 's3cret!');
  assert.equal(decryptPassword(secret, KEY), 's3cret!');
  assert.equal(fs.docs.get('retailers/shoprite-portal').extractionName, 'Geo steps');
  const listed = JSON.stringify(await service.list());
  assert.ok(!listed.includes(secret.ciphertext) && !listed.includes('s3cret'), 'no secret material in the list');
  assert.equal((await service.list()).profiles.find(p => p.id === 'shoprite-portal').hasPassword, true);
});

test('editing without a password keeps the saved one and the scheduler fields; unlinking clears the step set', async () => {
  const {fs, service} = world();
  await service.saveProfile(admin, {id: 'geo-rep-sales-transactions', name: 'Geo Rep Sales transactions', webAddress: 'https://meridian.georep.com/portal', username: 'bot2', extractionProfileId: ''});
  const r = fs.docs.get('retailers/geo-rep-sales-transactions');
  assert.equal(r.username, 'bot2'); assert.equal(r.reportSchedule.time, '12:00'); assert.equal(r.executor, 'azure'); assert.ok(!('extractionProfileId' in r));
  assert.equal(fs.docs.get('retailerSecrets/geo-rep-sales-transactions').ciphertext, 'x');
});

test('profiles with a schedule or a running job cannot be deleted; otherwise profile and password go together', async () => {
  const {fs, service} = world();
  await assert.rejects(service.deleteProfile(admin, 'geo-rep-sales-transactions'), /schedule/);
  await assert.rejects(service.deleteProfile(admin, 'idle'), /job running/);
  fs.docs.get('extractionRuns/r1').status = 'completed';
  await service.deleteProfile(admin, 'idle');
  assert.equal(fs.docs.has('retailers/idle'), false); assert.equal(fs.docs.has('retailerSecrets/idle'), false);
});

test('step sets: 1 to 50 known actions; a linked set cannot be deleted', async () => {
  const {fs, service} = world();
  assert.throws(() => validateSteps([]), /between 1 and 50/);
  assert.throws(() => validateSteps([{action: 'rm -rf'}]), /unsupported action/);
  assert.equal(validateSteps([{action: 'salesforceOpenReport', selector: 'x'}])[0].action, 'salesforceOpenReport', 'older sets stay editable');
  const {id} = await service.saveStepSet(admin, {name: 'Shoprite steps', steps: [{action: 'navigate'}, {action: 'fillUsername', selector: '#u'}, {action: 'download', selector: 'a.export'}]});
  assert.equal(fs.docs.get(`extractionProfiles/${id}`).stepCount, 3);
  await assert.rejects(service.deleteStepSet(admin, 'geo-steps'), /linked/);
  await service.deleteStepSet(admin, id);
  assert.equal(fs.docs.has(`extractionProfiles/${id}`), false);
});

test('the credential key comes from Key Vault with the managed identity, and must be 32 bytes', async () => {
  assert.equal(keySource({env: {}}), null);
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).startsWith('http://identity.local')) return new Response(JSON.stringify({access_token: 't'}));
    return new Response(JSON.stringify({value: KEY.toString('base64')}));
  };
  const key = await keySource({env: {IDENTITY_ENDPOINT: 'http://identity.local/token', IDENTITY_HEADER: 'h'}, fetchImpl})();
  assert.ok(key.equals(KEY));
  assert.match(calls[0], /resource=https%3A%2F%2Fvault\.azure\.net/); assert.match(calls[1], /kv-nexusauto-p2fzlrpwgvn\.vault\.azure\.net\/secrets\/retailer-credential-key/);
  const short = async url => new Response(JSON.stringify(String(url).startsWith('http://identity.local') ? {access_token: 't'} : {value: Buffer.alloc(8).toString('base64')}));
  await assert.rejects(keySource({env: {IDENTITY_ENDPOINT: 'http://identity.local/token', IDENTITY_HEADER: 'h'}, fetchImpl: short})(), /32 bytes/);
});
