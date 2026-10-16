const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { json, save, source, stage } = require('./release-multi-admin.cjs');
const { isStaffProfile } = require('../functions/admin-access');
const uid = 'auNcNaXnujgblAR9ZNzFgJFBv592';
const project = 'meridain-nexus';
const authUrl = `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`;
const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/adminUsers/${uid}`;
const evidence = `requested-grant/${uid}`;
function decode(value) {
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('timestampValue' in value) return value.timestampValue;
  return Object.values(value)[0];
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}
async function inspect() {
  const result = await json(`${authUrl}:lookup`, 'POST', { localId: [uid] });
  assert.equal(result.users?.length, 1, 'UID must match one existing Firebase Auth account.');
  const account = result.users[0]; assert.equal(account.localId, uid);
  const document = await json(docUrl);
  const profile = decode({ mapValue: { fields: document.fields } });
  const claims = JSON.parse(account.customAttributes || '{}');
  assert.ok(isStaffProfile(profile), 'Only an existing active staff profile can be promoted.');
  assert.notEqual(account.disabled, true, 'Disabled accounts are not enabled by this request.');
  assert.notEqual(claims.chatClient, true); assert.notEqual(claims.nexusRole, 'client');
  if (profile.uid) assert.equal(profile.uid, uid);
  const safe = { uid, email: account.email || '', disabled: account.disabled === true, claims, profile, document };
  return safe;
}
function report(current) {
  return { uid, email: current.email, currentRole: current.profile.role, authAdmin: current.claims.admin === true, accountType: current.profile.accountType || 'legacy-staff', disabled: current.disabled, eligibleStaff: true };
}
async function main() {
  const current = await inspect();
  if (process.argv[2] === 'inspect') { console.log(JSON.stringify(report(current))); return; }
  assert.equal(process.argv[2], 'grant');
  const marker = path.join(stage, `${evidence}/before.json`);
  assert.ok(!fs.existsSync(marker), 'This exact requested grant has already started; inspect its evidence before retrying.');
  const text = source(path.join(stage, 'sources/saveAdminUser/index.js'));
  const ids = text.match(/const navigationPermissionIds = new Set\(\[([^]*?)\]\);/);
  assert.ok(ids, 'Use the deployed navigation permissions.');
  const navigation = [...ids[1].matchAll(/"([a-z-]+)"/g)].map(m => m[1]);
  assert.ok(navigation.includes('insights') && navigation.includes('attendance') && navigation.includes('chat'));
  const chatEnabled = current.profile.permissions?.chatEnabled !== false;
  const claims = { ...current.claims, admin: true, operator: false, nexusRole: 'admin', chatClient: false };
  assert.ok(Buffer.byteLength(JSON.stringify(claims)) <= 1000);
  const at = new Date().toISOString();
  const permissions = { ...current.profile.permissions, manageAutomation: true, manageSchedules: true, manageUsers: true, runJobs: true, viewAllAudit: true, stopAnyJob: true, allowedRetailerIds: [], allowedNavigationIds: navigation.filter(id => id !== 'chat' || chatEnabled), chatEnabled };
  const fields = { role: encode('admin'), accountType: encode('staff'), permissions: encode(permissions), updatedAt: { timestampValue: at }, updatedBy: encode('approved-cli-admin-grant') };
  save(`${evidence}/before.json`, current);
  save(`${evidence}/intent.json`, { uid, requestedBy: 'User explicitly requested this UID receive Admin access', at, claims, fields });
  await json(`${authUrl}:update`, 'POST', { localId: uid, customAttributes: JSON.stringify(claims) });
  try {
    const database = `projects/${project}/databases/(default)`;
    const auditFields = encode({ event: 'access-user-saved', actorUid: '', actorEmail: '', actorName: 'Explicitly approved CLI maintenance', actorRole: 'administrator-maintenance', targetUid: uid, result: 'admin', message: `${current.email} was granted Admin access for the user-requested UID. Password and enabled status unchanged.` }).mapValue.fields;
    auditFields.createdAt = { timestampValue: at };
    await json(`https://firestore.googleapis.com/v1/${database}/documents:commit`, 'POST', { writes: [
      { update: { name: current.document.name, fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: current.document.updateTime } },
      { update: { name: `${database}/documents/accessAuditLogs/${crypto.randomUUID()}`, fields: auditFields }, currentDocument: { exists: false } }
    ] });
  } catch (error) {
    const latest = await json(`${authUrl}:lookup`, 'POST', { localId: [uid] });
    if (latest.users?.[0]?.customAttributes === JSON.stringify(claims)) {
      await json(`${authUrl}:update`, 'POST', { localId: uid, customAttributes: JSON.stringify(current.claims) });
      save(`${evidence}/recovered.json`, { at: new Date().toISOString(), reason: 'Profile update failed; original Auth claims restored.' });
    }
    throw error;
  }
  const after = await inspect();
  assert.equal(after.profile.role, 'admin'); assert.deepEqual(after.claims, claims);
  assert.deepEqual(after.profile.permissions, permissions);
  for (const [key, value] of Object.entries(current.document.fields)) if (!(key in fields)) assert.deepEqual(after.document.fields[key], value, `Unrelated profile field changed: ${key}`);
  save(`${evidence}/verified.json`, { ...report(after), at: new Date().toISOString(), permissions });
  console.log(JSON.stringify({ ...report(after), verified: true, otherUsersChanged: false, signInRequired: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
