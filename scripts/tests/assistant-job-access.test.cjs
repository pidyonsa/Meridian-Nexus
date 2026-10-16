const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { authorizeAssistantRun } = require('../../functions/assistant-access');
const { buildAssistantMemory, scopeKey } = require('../../functions/assistant-memory');
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function harness({ owner = 'staff', exists = true, cached = true, reassignDuringAnswer = false } = {}) {
  let currentOwner = owner, calls = 0, commits = 0;
  const actor = { uid: 'staff', role: 'normal' }, profile = { email: 'staff@example.test', role: 'normal', accountType: 'staff', permissions: { chatEnabled: true } };
  const db = { collection: () => ({ doc: id => ({ get: async () => { calls++; return { id, exists, data: () => ({ createdBy: currentOwner }) }; } }) }) };
  const access = { authorizeAssistant: async () => ({ actor, profile }), authorizeAssistantRun };
  const memory = { buildAssistantMemory: () => ({ begin: async () => cached ? { cached: { answer: 'private answer' } } : { turns: [], commit: async () => { commits++; return {}; } } }), scopeKey };
  const context = { exports: {}, requireOperator() {}, requestActor: () => ({ ...actor }), onCall: (_, fn) => fn, HttpsError,
    geminiApiKey: {}, sharePointTenantId: {}, sharePointClientId: {}, sharePointClientSecret: {},
    require: name => name === './assistant-access' ? access : memory, db, getAuth() {},
    text: v => String(v), optionalText: v => String(v || ''), reserveGeminiUsage: async () => {},
    nexusAssistantWorkspaceContext: async () => ({ accessScope: 'staff', workspaces: {} }), assistantRunContext: run => run,
    askGemini: async () => { if (reassignDuringAnswer) currentOwner = 'someone-else'; return 'answer'; }, recordAccessAudit: async () => {} };
  const source = fs.readFileSync(path.join(__dirname, '../../functions/index.js'), 'utf8');
  vm.runInNewContext(source.match(/exports\.askNexusAssistant = onCall\([^]*?\n\}\);/)[0], context);
  return { request: () => context.exports.askNexusAssistant({ auth: { uid: actor.uid }, data: { question: 'Explain this job', runId: 'job-1', conversationId: 'synthetic-session' } }), counts: () => ({ calls, commits }) };
}
test('cached answers still require ownership of their selected job', async () => {
  const h = harness({ owner: 'other-staff' });
  await assert.rejects(h.request(), error => error.code === 'permission-denied');
  assert.equal(h.counts().calls, 1);
});
test('deleted jobs cannot replay cached AI answers', async () => {
  await assert.rejects(harness({ exists: false }).request(), error => error.code === 'not-found');
});
test('a retry of an authorised cached job answer returns without a model call', async () => {
  assert.equal((await harness().request()).answer, 'private answer');
});
test('job ownership is rechecked after an in-flight answer before memory commit', async () => {
  const h = harness({ cached: false, reassignDuringAnswer: true });
  await assert.rejects(h.request(), error => error.code === 'permission-denied');
  assert.equal(h.counts().commits, 0); assert.equal(h.counts().calls, 2);
});
test('invalid job paths never reach Firestore', async () => {
  await assert.rejects(authorizeAssistantRun({ db: {}, HttpsError }, { uid: 'staff', role: 'normal' }, 'jobs/other/private'), error => error.code === 'invalid-argument');
});
test('reviewed drafts are invalid after their source job is reassigned or deleted', async () => {
  const profile = { role: 'normal', email: 'staff@example.test' }, draft = { id: 'draft', runId: 'job-1', scope: scopeKey(profile, 'job-1'), expiresAt: { toMillis: () => Date.now() + 60000 }, fields: { title: 'Review' } };
  const db = { collection: () => ({ doc: uid => `memory/${uid}` }), doc: id => id };
  const memory = buildAssistantMemory({ db, HttpsError });
  for (const exists of [true, false]) {
    const tx = { get: async ref => ref.startsWith('memory/') ? { data: () => ({ draft }) } : { exists, data: () => ({ createdBy: 'someone-else' }) } };
    await assert.rejects(memory.readDraft(tx, 'staff', profile, 'draft'), error => error.code === 'permission-denied');
  }
});
