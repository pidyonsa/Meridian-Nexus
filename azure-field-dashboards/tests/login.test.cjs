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

test('a guest invited into the Meridian tenant (identity-provider claim) is not a Meridian sign-in', async t => {
  const get = await host(t, true);
  for (const idp of ['google.com', 'live.com', 'mail', 'https://sts.windows.net/00000000-0000-0000-0000-000000000000/']) {
    for (const typ of ['idp', 'http://schemas.microsoft.com/identity/claims/identityprovider']) {
      const guest = JSON.parse(Buffer.from(principal(MERIDIAN_TENANT), 'base64').toString());
      guest.claims.push({typ, val: idp});
      const header = {'x-ms-client-principal': Buffer.from(JSON.stringify(guest)).toString('base64')};
      assert.equal((await get('/attendance', header)).status, 302, `${typ}=${idp}`);
      assert.equal((await get('/api/orders', header, 'POST')).status, 401, `${typ}=${idp}`);
    }
  }
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

const nexusHost = async (t, functionsFetch) => {
  const reportProvider = {kind: 'test', request: async () => ({status: 200, data: {rows: []}})};
  const server = createApp({enabled: () => true, requireLogin: () => true, reportProvider, functionsFetch}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return (route, init = {}) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {redirect: 'manual', ...init});
};
const as = roles => ({'x-ms-client-principal': principal(MERIDIAN_TENANT, 'aad', roles), 'x-ms-client-principal-name': 'someone@meridiangroup.co.za'});

test('Nexus workspace: home and module pages for every Meridian account; sections by role', async t => {
  const get = await nexusHost(t);
  for (const route of ['/', '/modules/geo', '/modules/admin']) {
    const page = await get(route, {headers: as([])});
    assert.equal(page.status, 200, route);
    const html = await page.text();
    assert.ok(html.includes('src="/app/main.js"') && html.includes('Meridian <b>Nexus</b>'), route);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'no third-party fonts');
  }
  const staff = await (await get('/api/me', {headers: as([])})).json();
  assert.deepEqual(staff.sections, ['attendance', 'franchiseorder']);
  assert.equal(staff.admin, false); assert.equal(staff.email, 'someone@meridiangroup.co.za'); assert.equal(staff.name, 'Test User');
  const admin = await (await get('/api/me', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(admin.admin, true); assert.ok(admin.sections.includes('admin') && admin.sections.includes('automation'));
  // Staff still cannot open the full Nexus; unknown module names are not workspace pages.
  assert.equal((await get('/nexus/', {headers: as([])})).status, 403);
  assert.equal((await get('/modules/../nexus', {headers: as([])})).status, 403);
  // The site config sends tools that have not moved to the full Nexus on this site.
  const config = await (await get('/app/config.js', {headers: as([])})).text();
  assert.match(config, /currentNexus: '\/nexus\/'/); assert.match(config, /built: \['attendance', 'franchiseorder', 'sirfruit-gaps', 'sirfruit-upload'\]/);
});

test('Sir Fruit gap tracker: Nexus.Admin only; admins upload and read', async t => {
  const get = await nexusHost(t);
  for (const route of ['/insights/sir-fruit', '/insights/sir-fruit/upload', '/api/gaps/sir-fruit']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/insights/sir-fruit/upload', {headers: as(['Nexus.Admin'])})).status, 200);
  const empty = await (await get('/api/gaps/sir-fruit', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(empty.manage, true); assert.ok(empty.banners.every(b => !b.weeks.length));
  const ExcelJS = require('exceljs'), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('PnP Family Gap Tracker');
  ws.addRows([['Date', 'Store', 'JUICE'], ['31.08.2026', 'Family A', 'Opportunity'], ['09.09.2026', 'Family A', 'No gap']]);
  const body = JSON.stringify({fileName: 'gaps.xlsx', data: Buffer.from(await wb.xlsx.writeBuffer()).toString('base64')});
  const saved = await get('/api/gaps/sir-fruit/upload', {method: 'POST', headers: {...as(['Nexus.Admin']), 'content-type': 'application/json'}, body});
  assert.equal(saved.status, 200);
  const staffUpload = await get('/api/gaps/sir-fruit/upload', {method: 'POST', headers: {...as([]), 'content-type': 'application/json'}, body});
  assert.equal(staffUpload.status, 403);
  const r = await (await get('/api/gaps/sir-fruit/compare?banner=PnP%20Family&from=2026-08-31&to=2026-09-09', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(r.metrics.converted, 1);
  const bad = await get('/api/gaps/sir-fruit/compare?banner=PnP%20Family&from=x&to=y', {headers: as(['Nexus.Admin'])});
  assert.equal(bad.status, 400); assert.match((await bad.json()).error.message, /Choose two weeks/);
});

test('full Nexus portal and its Firebase files: Nexus.Admin only; signed out goes to sign-in', async t => {
  const get = await nexusHost(t);
  for (const route of ['/nexus/', '/nexus/app.js', '/__/firebase/init.js']) {
    assert.equal((await get(route)).status, 302, route);
    assert.equal((await get(route, {headers: as(['Nexus.Reader'])})).status, 403, route);
    const response = await get(route, {headers: as(['Nexus.Admin'])});
    assert.equal(response.status, 200, route);
    assert.doesNotMatch(response.headers.get('content-security-policy'), /script-src/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  }
  const page = await (await get('/nexus/', {headers: as(['Nexus.Admin'])})).text();
  assert.match(page, /<script src="azure-bridge.js"><\/script>/);
  assert.equal((await get('/nexus', {headers: as(['Nexus.Admin'])})).headers.get('location'), '/nexus/');
  assert.equal((await get('/nexus/missing.js', {headers: as(['Nexus.Admin'])})).status, 404);
  assert.equal((await get('/nexus/manifest.json', {headers: as(['Nexus.Admin'])})).status, 404);
  assert.match(await (await get('/nexus/app.js', {headers: as(['Nexus.Admin'])})).text(), /functions\(window\.location\.origin \+ "\/nexus\/__fn"\)/);
});

test('Nexus function calls go to the Firebase function with the Nexus token, only for Nexus.Admin', async t => {
  const calls = [];
  const get = await nexusHost(t, async (url, init) => { calls.push({url, init}); return new Response(JSON.stringify({result: {ok: true}}), {status: 200, headers: {'content-type': 'application/json'}}); });
  const call = (name, headers) => get(`/nexus/__fn/${name}`, {method: 'POST', headers: {'content-type': 'application/json', 'x-firebase-authorization': 'Bearer nexus-token', ...headers}, body: JSON.stringify({data: {q: 1}})});
  assert.equal((await call('meridianEtl', as(['Nexus.Reader']))).status, 403);
  assert.equal((await call('meridianEtl', {})).status, 401);
  assert.equal(calls.length, 0);
  const response = await call('meridianEtl', as(['Nexus.Admin']));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {result: {ok: true}});
  assert.equal(calls[0].url, 'https://us-central1-meridain-nexus.cloudfunctions.net/meridianEtl');
  assert.equal(calls[0].init.headers.authorization, 'Bearer nexus-token');
  assert.equal(calls[0].init.body.toString(), JSON.stringify({data: {q: 1}}));
  assert.equal((await call('bad.name', as(['Nexus.Admin']))).status, 404);
  assert.equal(calls.length, 1);
});
