'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createApp, profileFrom} = require('../server/main.cjs');
const {adminRoutes, directoryEntry} = require('../server/routes/admin.cjs');
const {previewRepo} = require('../server/fixtures.cjs');
const {MERIDIAN_TENANT} = require('../server/auth.cjs');

const principal = (email, roles) => Buffer.from(JSON.stringify({auth_typ: 'aad', role_typ: 'roles', claims: [
  {typ: 'tid', val: MERIDIAN_TENANT}, {typ: 'oid', val: '11111111-2222-3333-4444-555555555555'}, {typ: 'preferred_username', val: email}, ...roles.map(val => ({typ: 'roles', val}))
]})).toString('base64');

async function serve(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>');
  const repo = previewRepo();
  const server = createApp({publicDir: dir, env: {}, api: [adminRoutes(repo)], profileFor: profileFrom(repo), log: {error() {}}}).listen(0);
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('directory entries carry no credential-like fields and drop removed sections', () => {
  const e = directoryEntry({id: 'u1', data: {email: 'A@B.co', name: 'A', role: 'normal', passwordHash: 'x', permissions: {allowedNavigationIds: ['attendance', 'insights'], allowedRetailerIds: ['r1']}}}, new Map([['r1', 'Retailer One']]));
  assert.deepEqual(e.sections, ['attendance']); assert.deepEqual(e.retailers, [{id: 'r1', name: 'Retailer One'}]);
  assert.equal(e.email, 'a@b.co'); assert.ok(!JSON.stringify(e).includes('password'));
});

test('admin APIs need Nexus.Admin', () => serve(async base => {
  assert.equal((await fetch(`${base}/api/admin/users`, {headers: {'x-ms-client-principal': principal('field.lead@example.com', ['Nexus.Reader'])}})).status, 403);
  const res = await fetch(`${base}/api/admin/users`, {headers: {'x-ms-client-principal': principal('sample.admin@example.com', ['Nexus.Admin'])}});
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.sample, true); assert.ok(body.users.length >= 4);
  const sync = await (await fetch(`${base}/api/admin/sync`, {headers: {'x-ms-client-principal': principal('sample.admin@example.com', ['Nexus.Admin'])}})).json();
  assert.ok(sync.runs.length && sync.collections.length);
}));

test('/api/me uses the stored Nexus permissions; disabled accounts are refused', () => serve(async base => {
  const me = await (await fetch(`${base}/api/me`, {headers: {'x-ms-client-principal': principal('field.lead@example.com', ['Nexus.Reader'])}})).json();
  assert.deepEqual(me.sections, ['attendance', 'callcycle', 'franchiseorder', 'automation', 'chat', 'support']);
  assert.equal((await fetch(`${base}/api/me`, {headers: {'x-ms-client-principal': principal('former.staff@example.com', ['Nexus.Reader'])}})).status, 403);
}));
