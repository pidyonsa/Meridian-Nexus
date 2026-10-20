'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp, MERIDIAN_TENANT} = require('../server/main.cjs');
const principal = (tenant, authType = 'aad', roles = []) => Buffer.from(JSON.stringify({auth_typ: authType, role_typ: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role', claims: [{typ: 'http://schemas.microsoft.com/identity/claims/tenantid', val: tenant}, {typ: 'name', val: 'Test User'}, ...roles.map(val => ({typ: 'roles', val}))]})).toString('base64');
async function host(t, requireLogin) {
  const reportProvider = {kind: 'test', request: async () => ({status: 200, data: {rows: []}})};
  const server = createApp({enabled: () => true, requireLogin: () => requireLogin, reportProvider}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  return (route, headers = {}, method = 'GET') => fetch(url + route, {method, redirect: 'manual', headers: {'content-type': 'application/json', ...headers}, ...(method === 'POST' ? {body: '{}'} : {})});
}

test('with Microsoft login required, every page, report and asset is refused without a signed-in Meridian user', async t => {
  const get = await host(t, true);
  // Pages and files go to Microsoft sign-in and come back to the same address; nothing is served.
  for (const route of ['/', '/attendance', '/franchise-orders/regions?from=2026-10-01', '/viewer.js', '/asset-manifest.json']) {
    const response = await get(route);
    assert.equal(response.status, 302, route);
    assert.equal(response.headers.get('location'), '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(route), route);
    assert.ok(!/<html|function|"files"/i.test(await response.text()), route);
  }
  // Reports are refused outright (a script can't follow a sign-in redirect).
  assert.equal((await get('/api/health')).status, 401);
  for (const route of ['/api/orders', '/api/attendance']) assert.equal((await get(route, {}, 'POST')).status, 401, route);
  // Another tenant, another sign-in provider or a malformed header is not a Meridian sign-in.
  for (const header of [principal('00000000-0000-0000-0000-000000000000'), principal(MERIDIAN_TENANT, 'google'), 'not-base64-json']) {
    assert.equal((await get('/attendance', {'x-ms-client-principal': header})).status, 302);
    assert.equal((await get('/api/orders', {'x-ms-client-principal': header}, 'POST')).status, 401);
  }
  // The App Service health check stays reachable and returns no report data.
  const health = await get('/healthz');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
});

test('a signed-in Meridian user reaches pages and reports', async t => {
  const get = await host(t, true), signedIn = {'x-ms-client-principal': principal(MERIDIAN_TENANT), 'x-ms-client-principal-name': 'test.user@meridiangroup.co.za'};
  for (const route of ['/', '/attendance', '/franchise-orders']) assert.equal((await get(route, signedIn)).status, 200, route);
  assert.equal((await get('/api/orders', signedIn, 'POST')).status, 200);
});

test('login can be switched off only through configuration', async t => {
  const get = await host(t, false);
  assert.equal((await get('/attendance')).status, 200);
});

test('every Meridian account sees Syndicated Attendance and Franchise Orders; the rest of Nexus needs Nexus.Admin', async t => {
  const get = await host(t, true);
  const staff = {'x-ms-client-principal': principal(MERIDIAN_TENANT, 'aad', ['Nexus.Reader'])};
  const admin = {'x-ms-client-principal': principal(MERIDIAN_TENANT, 'aad', ['Nexus.Admin'])};
  for (const headers of [staff, admin]) {
    for (const route of ['/', '/attendance/rep/daily', '/attendance/merchandiser/stores', '/franchise-orders/regions', '/viewer.js', '/api/health']) assert.equal((await get(route, headers)).status, 200, route);
    for (const route of ['/api/attendance', '/api/orders']) assert.equal((await get(route, headers, 'POST')).status, 200, route);
  }
  // Anything outside the two dashboards is the full Nexus: refused for staff, passed through for the admin
  // (this site has no such page yet, so the admin gets "not found").
  for (const route of ['/admin', '/files', '/api/etl']) {
    assert.equal((await get(route, staff)).status, 403, route);
    assert.equal((await get(route, admin)).status, 404, route);
  }
  assert.equal((await get('/api/import', staff, 'POST')).status, 403);
});
