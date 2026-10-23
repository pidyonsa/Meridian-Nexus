'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createApp} = require('../server/main.cjs');
const {principalFromHeader, previewAllowed, MERIDIAN_TENANT} = require('../server/auth.cjs');
const {migrations} = require('../server/migrate.cjs');

const OID = '11111111-2222-3333-4444-555555555555';
const header = ({tenant = MERIDIAN_TENANT, roles = ['Nexus.Reader'], auth = 'aad', oid = OID} = {}) => Buffer.from(JSON.stringify({auth_typ: auth, role_typ: 'roles', claims: [
  {typ: 'http://schemas.microsoft.com/identity/claims/tenantid', val: tenant},
  ...(oid ? [{typ: 'http://schemas.microsoft.com/identity/claims/objectidentifier', val: oid}] : []),
  {typ: 'preferred_username', val: 'Staff@MeridianGroup.co.za'}, {typ: 'name', val: 'Staff Member'},
  ...roles.map(val => ({typ: 'roles', val}))
]})).toString('base64');

function publicDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-portal-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Nexus</title>');
  return dir;
}

async function serve(options = {}, fn) {
  const server = createApp({publicDir: publicDir(), env: {}, log: {error() {}}, ...options}).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { server.close(); }
}

test('principal: accepts a Meridian Entra user and reads roles', () => {
  const user = principalFromHeader(header({roles: ['Nexus.Admin']}));
  assert.equal(user.id, OID); assert.equal(user.email, 'staff@meridiangroup.co.za'); assert.equal(user.admin, true); assert.equal(user.reader, true);
});

test('principal: rejects other tenants, non-Entra providers, missing object id and junk', () => {
  assert.equal(principalFromHeader(header({tenant: '00000000-0000-0000-0000-000000000000'})), null);
  assert.equal(principalFromHeader(header({auth: 'google'})), null);
  assert.equal(principalFromHeader(header({oid: null})), null);
  assert.equal(principalFromHeader('not-base64-json'), null);
  assert.equal(principalFromHeader('x'.repeat(20000)), null);
});

test('principal: guests invited into the tenant (identity-provider claim) are refused, even with a Nexus role', () => {
  for (const idp of ['google.com', 'live.com', 'https://sts.windows.net/00000000-0000-0000-0000-000000000000/']) {
    const p = JSON.parse(Buffer.from(header({roles: ['Nexus.Admin']}), 'base64').toString());
    p.claims.push({typ: 'http://schemas.microsoft.com/identity/claims/identityprovider', val: idp});
    assert.equal(principalFromHeader(Buffer.from(JSON.stringify(p)).toString('base64')), null, idp);
  }
});

test('preview sign-in is impossible on App Service', () => {
  assert.equal(previewAllowed({NEXUS_PREVIEW: 'true', NODE_ENV: 'development'}), true);
  assert.equal(previewAllowed({NEXUS_PREVIEW: 'true', NODE_ENV: 'development', WEBSITE_SITE_NAME: 'x'}), false);
  assert.equal(previewAllowed({NEXUS_PREVIEW: 'true', NODE_ENV: 'production'}), false);
});

test('health check is open; pages redirect to Microsoft sign-in; APIs answer 401', () => serve({}, async base => {
  assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok');
  const page = await fetch(`${base}/attendance`, {redirect: 'manual'});
  assert.equal(page.status, 302); assert.match(page.headers.get('location'), /^\/\.auth\/login\/aad\?post_login_redirect_uri=%2Fattendance/);
  const api = await fetch(`${base}/api/me`);
  assert.equal(api.status, 401); assert.equal((await api.json()).error.code, 'unauthenticated');
}));

test('a signed-in user without a Nexus role is refused', () => serve({}, async base => {
  const res = await fetch(`${base}/api/me`, {headers: {'x-ms-client-principal': header({roles: []})}});
  assert.equal(res.status, 403);
}));

test('admin-only mode lets admins in and turns readers away', () => serve({env: {NEXUS_ADMIN_ONLY: 'true'}}, async base => {
  assert.equal((await fetch(`${base}/api/me`, {headers: {'x-ms-client-principal': header()}})).status, 403);
  assert.equal((await fetch(`${base}/api/me`, {headers: {'x-ms-client-principal': header({roles: ['Nexus.Admin']})}})).status, 200);
}));

test('a reader gets their profile and the app shell; unknown APIs are 404', () => serve({}, async base => {
  const headers = {'x-ms-client-principal': header()};
  assert.deepEqual(await (await fetch(`${base}/api/me`, {headers})).json(), {id: OID, email: 'staff@meridiangroup.co.za', name: 'Staff Member', admin: false, preview: false, sections: ['automation', 'chat', 'support']});
  const shell = await fetch(`${base}/orders/regions`, {headers});
  assert.equal(shell.status, 200); assert.match(await shell.text(), /<title>Nexus<\/title>/);
  assert.equal((await fetch(`${base}/api/nope`, {headers})).status, 404);
}));

test('cross-site state-changing API calls are refused', () => serve({api: [app => app.post('/api/echo', (req, res) => res.json(req.body))]}, async base => {
  const headers = {'x-ms-client-principal': header(), 'content-type': 'application/json'};
  assert.equal((await fetch(`${base}/api/echo`, {method: 'POST', headers: {...headers, origin: 'https://evil.example'}, body: '{}'})).status, 403);
  assert.deepEqual(await (await fetch(`${base}/api/echo`, {method: 'POST', headers: {...headers, origin: base}, body: '{"a":1}'})).json(), {a: 1});
}));

test('errors carry a request id and never leak internals', () => serve({api: [app => app.get('/api/boom', () => { throw new Error('secret connection string'); })]}, async base => {
  const res = await fetch(`${base}/api/boom`, {headers: {'x-ms-client-principal': header()}});
  const body = await res.json();
  assert.equal(res.status, 500); assert.equal(body.error.requestId, res.headers.get('x-request-id')); assert.doesNotMatch(JSON.stringify(body), /secret/);
}));

test('sections: admins see everything; staff get their permissions, never admin-only pages', () => {
  const {sectionsFor, SECTIONS} = require('../server/access.cjs');
  assert.deepEqual(sectionsFor({admin: true}), SECTIONS);
  assert.deepEqual(sectionsFor({admin: false}, {allowedNavigationIds: ['attendance', 'admin', 'etls', 'stockfix'], chatEnabled: false}, {}), ['attendance', 'callcycle', 'support']);
});

test('sections: NEXUS_STAFF_SECTIONS fixes what staff see (admins unaffected, admin pages never leak)', () => {
  const {sectionsFor, SECTIONS} = require('../server/access.cjs');
  const env = {NEXUS_STAFF_SECTIONS: 'attendance,franchiseorder,admin'};
  assert.deepEqual(sectionsFor({admin: false}, {allowedNavigationIds: ['automation', 'chat', 'training']}, env), ['attendance', 'franchiseorder']);
  assert.deepEqual(sectionsFor({admin: true}, {}, env), SECTIONS);
});

test('migrations are numbered, unique and split into batches', () => {
  const list = migrations();
  assert.ok(list.length >= 1);
  assert.equal(new Set(list.map(m => m.name.slice(0, 3))).size, list.length);
  assert.ok(list.every(m => m.batches.length >= 1 && !/^\s*GO\s*$/im.test(m.batches.join('\n'))));
});
