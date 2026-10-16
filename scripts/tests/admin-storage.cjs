const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const sdk = createRequire('C:/Users/PC/SIGDAHUILA/package.json');
const { initializeTestEnvironment, assertFails, assertSucceeds } = sdk('@firebase/rules-unit-testing');
const { doc, setDoc } = sdk('firebase/firestore');
const { ref, uploadBytes, getMetadata, deleteObject } = sdk('firebase/storage');
const { stage, save, hash } = require('../release-multi-admin.cjs');
async function main() {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-meridian-multi-admin');
  const rules = fs.readFileSync(path.join(stage, 'storage.rules'), 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-meridian-multi-admin', firestore: { host: '127.0.0.1', port: 8194, rules: fs.readFileSync(path.join(stage, 'firestore.rules'), 'utf8') }, storage: { host: '127.0.0.1', port: 9294, rules } });
  let passed = 0;
  const staff = { role: 'admin', accountType: 'staff', disabled: false, chatAccess: { audience: 'internal' } };
  const profile = async fields => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'adminUsers/synthetic-manager'), { ...staff, ...fields }));
  const storage = env.authenticatedContext('synthetic-manager', { email: 'manager@example.test', admin: true, nexusRole: 'admin' }).storage();
  const file = ref(storage, 'stockfix-source/synthetic-run/test.csv');
  try {
    await profile({});
    await assertSucceeds(uploadBytes(file, new TextEncoder().encode('test'), { customMetadata: { uploadId: 'synthetic-run' } })); passed++;
    await assertSucceeds(getMetadata(file)); passed++;
    for (const change of [{ role: 'normal' }, { disabled: true }, { accountType: 'client' }, { chatAccess: { audience: 'external' } }, { chatAccess: { workRole: 'Client' } }]) {
      await profile(change); await assertFails(getMetadata(file)); await assertFails(deleteObject(file)); passed += 2;
    }
    await profile({});
    for (const claims of [{ admin: false }, { admin: true, chatClient: true }, { admin: true, nexusRole: 'client' }]) {
      const other = env.authenticatedContext('synthetic-manager', claims).storage();
      await assertFails(getMetadata(ref(other, file.fullPath))); passed++;
    }
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), file.fullPath))); passed++;
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'stockFixOperationalTasks/synthetic-task'), { assignedUid: 'someone-else' }));
    const evidence = ref(storage, 'stockfix-evidence/synthetic-task/evidence.png');
    await assertSucceeds(uploadBytes(evidence, new Uint8Array([1, 2, 3]), { contentType: 'image/png', customMetadata: { taskId: 'synthetic-task' } })); passed++;
    await profile({ role: 'normal' }); await assertFails(getMetadata(evidence)); passed++;
    await profile({}); await assertSucceeds(deleteObject(file)); passed++;
    save('tests/storage-emulator.json', { passed, rulesSha256: hash(rules), syntheticOnly: true, at: new Date().toISOString() });
    console.log(`PASS: ${passed} Storage checks; non-reserved staff Admin allowed, stale/disabled/client/anonymous access denied.`);
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
