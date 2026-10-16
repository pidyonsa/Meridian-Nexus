const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { adminUserSaveError } = require('../../functions/admin-user-errors');
class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }

test('Admin Auth errors are actionable without leaking provider internals', () => {
  for (const [code, expected] of [['auth/email-already-exists', 'already-exists'], ['auth/invalid-email', 'invalid-argument'], ['auth/insufficient-permission', 'failed-precondition'], ['auth/user-not-found', 'not-found']]) {
    const result = adminUserSaveError({ code, message: 'private provider detail' }, HttpsError);
    assert.equal(result.code, expected); assert.ok(!result.message.includes('private provider'));
  }
  const denied = new HttpsError('permission-denied', 'Forbidden');
  assert.equal(adminUserSaveError(denied, HttpsError), denied);
});
test('partial account saves return the UID for an explicit update retry', () => {
  const result = adminUserSaveError(new Error('internal'), HttpsError, 'created-uid');
  assert.equal(result.code, 'unavailable');
  assert.deepEqual(result.details, { savedUid: 'created-uid', incomplete: true });
});

function formHarness(callFunction = async () => ({ uid: 'created-uid', role: 'normal' })) {
  const source = fs.readFileSync(process.env.ADMIN_TEST_APP || path.join(__dirname, '../../public/app.js'), 'utf8');
  const block = source.match(/elements\.adminUserForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?\n\}\);/)[0];
  let handler;
  const submit = { disabled: false }, status = { hidden: true, textContent: '' };
  const form = { dataset: {}, querySelector: () => submit, addEventListener: (_, fn) => { handler = fn; } };
  const elements = { adminUserForm: form, adminUserAllowedRetailers: { selectedOptions: [] }, adminUserNavigation: [{ checked: true, value: 'chat' }], adminUserDisabled: { checked: false }, deleteAdminUser: {}, adminUserFormTitle: {} };
  for (const [key, value] of Object.entries({ Id: '', Name: 'Test', Surname: 'Staff', Email: 'staff@example.test', Role: 'normal', Password: 'test-password' })) elements[`adminUser${key}`] = { value };
  const document = { getElementById: id => id === 'adminUserSaveStatus' ? status : { value: '', checked: false } };
  vm.runInNewContext(block, { elements, document, callFunction, auth: { currentUser: { uid: 'admin' } }, showToast() {}, friendlyError: e => e.message });
  return { elements, form, status, submit, send: () => handler({ preventDefault() {}, submitter: null }) };
}
test('keyboard/programmatic submission works without a submitter', async () => {
  const h = formHarness(); await h.send();
  assert.equal(h.elements.adminUserId.value, 'created-uid');
  assert.equal(h.status.textContent, 'User saved.'); assert.equal(h.submit.disabled, false);
});
test('duplicate submissions are blocked while the first save is pending', async () => {
  let resolve, calls = 0;
  const h = formHarness(() => { calls++; return new Promise(r => { resolve = r; }); });
  const first = h.send(); await h.send(); assert.equal(calls, 1);
  resolve({ uid: 'created-uid' }); await first; assert.equal(h.form.dataset.saving, undefined);
});
test('partial save retry updates the same account and does not resubmit its password', async () => {
  const payloads = [];
  const h = formHarness(async (_, data) => {
    payloads.push(data);
    if (payloads.length === 1) throw adminUserSaveError(new Error('db'), HttpsError, 'partial-uid');
    return { uid: data.uid, role: 'normal' };
  });
  await h.send(); assert.equal(h.elements.adminUserId.value, 'partial-uid');
  assert.equal(h.elements.adminUserFormTitle.textContent, 'Complete user setup');
  await h.send(); assert.equal(payloads[1].uid, 'partial-uid'); assert.equal(payloads[1].password, '');
});
test('staff Admin grants are allowed, but self-demotion and missing new passwords are blocked', async () => {
  let calls = 0; const h = formHarness(async () => { calls++; return { uid: 'created-uid', role: 'admin' }; });
  h.elements.adminUserRole.value = 'admin'; await h.send();
  assert.equal(calls, 1);
  h.elements.adminUserId.value = 'admin'; h.elements.adminUserRole.value = 'normal'; await h.send();
  assert.match(h.status.textContent, /Another administrator/); assert.equal(calls, 1);
  h.elements.adminUserId.value = '';
  h.elements.adminUserRole.value = 'normal'; h.elements.adminUserPassword.value = ''; await h.send();
  assert.match(h.status.textContent, /at least six/); assert.equal(calls, 1);
});
