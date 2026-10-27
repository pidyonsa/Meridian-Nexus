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
  // Admin › Migration health is a workspace page for administrators.
  assert.equal((await get('/admin', staff)).status, 403); assert.equal((await get('/admin', admin)).status, 200);
  for (const route of ['/admin/secret', '/files', '/api/etl']) {
    assert.equal((await get(route, staff)).status, 403, route);
    assert.equal((await get(route, admin)).status, 404, route);
  }
  assert.equal((await get('/api/import', staff, 'POST')).status, 403);
});

const nexusHost = async (t, functionsFetch, salesStore = null, permissionStore = null) => {
  const reportProvider = {kind: 'test', request: async () => ({status: 200, data: {rows: []}})};
  const server = createApp({enabled: () => true, requireLogin: () => true, reportProvider, functionsFetch, salesStore, permissionStore}).listen(0, '127.0.0.1');
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
  assert.deepEqual(staff.sections, ['attendance', 'franchiseorder', 'gaps']);
  assert.equal(staff.admin, false); assert.equal(staff.email, 'someone@meridiangroup.co.za'); assert.equal(staff.name, 'Test User');
  const admin = await (await get('/api/me', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(admin.admin, true); assert.ok(admin.sections.includes('admin') && admin.sections.includes('automation'));
  // Staff still cannot open the full Nexus; unknown module names are not workspace pages.
  assert.equal((await get('/nexus/', {headers: as([])})).status, 403);
  assert.equal((await get('/modules/../nexus', {headers: as([])})).status, 403);
  // The site config sends tools that have not moved to the full Nexus on this site.
  const config = await (await get('/app/config.js', {headers: as([])})).text();
  assert.match(config, /currentNexus: '\/nexus\/'/); assert.match(config, /built: \['attendance', 'franchiseorder', 'gaps', 'gap-upload', 'sales', 'automation', 'resources', 'etls', 'admin-profiles', 'admin-geo-attendance', 'admin-integrations'\]/);
});

test('Sir Fruit gap tracker: everyone views; only Nexus.Admin uploads', async t => {
  const get = await nexusHost(t);
  for (const route of ['/gap-tracker', '/gap-tracker/sir-fruit', '/api/gaps', '/api/gaps/sir-fruit']) assert.equal((await get(route, {headers: as([])})).status, 200, route);
  // Adding clients is for admins only.
  assert.equal((await get('/api/gaps/clients', {method: 'POST', headers: {...as([]), 'content-type': 'application/json'}, body: '{"label":"Acme"}'})).status, 403);
  for (const route of ['/admin/gap-upload', '/api/gaps/sir-fruit/uploads']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  // Old Insights addresses redirect.
  for (const [from, to] of [['/insights/sir-fruit', '/gap-tracker/sir-fruit'], ['/insights/sir-fruit/upload', '/admin/gap-upload']]) {
    const moved = await get(from, {headers: as([])}); assert.equal(moved.status, 301, from); assert.equal(moved.headers.get('location'), to, from);
  }
  assert.equal((await get('/api/gaps/sir-fruit', {headers: {}})).status, 401);
  assert.equal((await (await get('/api/gaps/sir-fruit', {headers: as([])})).json()).manage, false);
  assert.ok((await (await get('/api/me', {headers: as([])})).json()).sections.includes('gaps'));
  assert.ok(!(await (await get('/api/me', {headers: as([])})).json()).sections.includes('gaps-upload'));
  assert.equal((await get('/admin/gap-upload', {headers: as(['Nexus.Admin'])})).status, 200);
  const empty = await (await get('/api/gaps/sir-fruit', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(empty.manage, true); assert.ok(empty.banners.every(b => !b.weeks.length));
  const ExcelJS = require('exceljs'), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('PnP Family Gap Tracker');
  ws.addRows([['Date', 'Store', 'JUICE'], ['31.08.2026', 'Family A', 'Opportunity'], ['09.09.2026', 'Family A', 'No gap']]);
  const body = JSON.stringify({fileName: 'gaps.xlsx', data: Buffer.from(await wb.xlsx.writeBuffer()).toString('base64')});
  const saved = await get('/api/gaps/sir-fruit/upload', {method: 'POST', headers: {...as(['Nexus.Admin']), 'content-type': 'application/json'}, body});
  assert.equal(saved.status, 200);
  const staffUpload = await get('/api/gaps/sir-fruit/upload', {method: 'POST', headers: {...as([]), 'content-type': 'application/json'}, body});
  assert.equal(staffUpload.status, 403);
  const r = await (await get('/api/gaps/sir-fruit/compare?banner=PnP%20Family&from=2026-08-31&to=2026-09-09', {headers: as([])})).json();
  assert.equal(r.metrics.converted, 1);
  assert.equal((await get('/api/gaps/sir-fruit/export?banner=all&from=2026-08-31&to=2026-09-09', {headers: as([])})).status, 200);
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

test('Sales dashboard: Nexus.Admin only, from Azure SQL', async t => {
  const {memorySalesStore} = require('../server/shared/sales/store.cjs');
  const rows = [{periodKey: '2026-10', orderNumber: 'A1', orderDate: '2026-10-02', storeName: 'Store 1', region: 'Gauteng', rep: 'Rep 1', manager: 'M', product: 'P', sku: 'S', status: 'Ordered', quantity: 2, value: 100, mapped: true}];
  const get = await nexusHost(t, undefined, memorySalesStore({rows}));
  for (const route of ['/sales', '/api/sales', '/api/sales/drilldown?metric=orders', '/api/sales/export']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/api/sales', {headers: {}})).status, 401);
  assert.equal((await get('/sales', {headers: as(['Nexus.Admin'])})).status, 200);
  const d = await (await get('/api/sales?period=2026-10', {headers: as(['Nexus.Admin'])})).json();
  assert.equal(d.metrics.salesValue, 100); assert.deepEqual(d.periods, [{period: '2026-10', lines: 1}]);
  assert.equal((await get('/api/sales?period=bad', {headers: as(['Nexus.Admin'])})).status, 400);
  const x = await get('/api/sales/export?period=2026-10', {headers: as(['Nexus.Admin'])});
  assert.equal(x.status, 200); assert.match(x.headers.get('content-type'), /spreadsheetml/);
});

test('Report automation: Nexus.Admin only; unavailable until the Google link is configured', async t => {
  const get = await nexusHost(t);
  for (const route of ['/automation', '/api/automation', '/api/automation/runs/abc']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/api/automation/runs', {method: 'POST', headers: {...as([]), 'content-type': 'application/json'}, body: '{"retailerId":"x"}'})).status, 403);
  assert.equal((await get('/automation', {headers: as(['Nexus.Admin'])})).status, 200);
  const r = await get('/api/automation', {headers: as(['Nexus.Admin'])});
  assert.equal(r.status, 503); assert.equal((await r.json()).error.code, 'unavailable');
});

test('Resources and ETLs: Nexus.Admin only; unavailable until the Google link is configured', async t => {
  const get = await nexusHost(t);
  for (const route of ['/resources', '/etls', '/api/resources', '/api/etls', '/api/etls/runs/abc']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/api/resources/upload?name=x.xlsx', {method: 'POST', headers: {...as([]), 'content-type': 'application/octet-stream'}, body: 'x'})).status, 403);
  for (const route of ['/resources', '/etls']) assert.equal((await get(route, {headers: as(['Nexus.Admin'])})).status, 200, route);
  for (const route of ['/api/resources', '/api/etls']) assert.equal((await get(route, {headers: as(['Nexus.Admin'])})).status, 503, route);
});

test('Extraction profiles: Nexus.Admin only; unavailable until the Google link is configured', async t => {
  const get = await nexusHost(t);
  for (const route of ['/admin/profiles', '/api/profiles']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/api/profiles/profiles', {method: 'PUT', headers: {...as([]), 'content-type': 'application/json'}, body: '{}'})).status, 403);
  assert.equal((await get('/admin/profiles', {headers: as(['Nexus.Admin'])})).status, 200);
  assert.equal((await get('/api/profiles', {headers: as(['Nexus.Admin'])})).status, 503);
});

test('Geo attendance and SharePoint inventory: Nexus.Admin only; unavailable until the Google link is configured', async t => {
  const get = await nexusHost(t);
  for (const route of ['/admin/geo-attendance', '/admin/integrations', '/api/geo-attendance', '/api/integrations', '/api/geo-attendance/exclusions/template']) assert.equal((await get(route, {headers: as([])})).status, 403, route);
  assert.equal((await get('/api/geo-attendance/week', {method: 'PUT', headers: {...as([]), 'content-type': 'application/json'}, body: '{"operationalWeek":2}'})).status, 403);
  for (const route of ['/admin/geo-attendance', '/admin/integrations']) assert.equal((await get(route, {headers: as(['Nexus.Admin'])})).status, 200, route);
  for (const route of ['/api/geo-attendance', '/api/integrations']) assert.equal((await get(route, {headers: as(['Nexus.Admin'])})).status, 503, route);
});

test('Nexus.GapUploader: gap report uploads and the upload page, nothing else an admin may open', async t => {
  const get = await nexusHost(t);
  const uploader = as(['Nexus.GapUploader']);
  assert.deepEqual((await (await get('/api/me', {headers: uploader})).json()).sections, ['attendance', 'franchiseorder', 'gaps', 'gaps-upload']);
  assert.equal((await get('/admin/gap-upload', {headers: uploader})).status, 200);
  assert.equal((await get('/api/gaps/sir-fruit/uploads', {headers: uploader})).status, 200);
  for (const route of ['/automation', '/api/automation', '/admin/profiles', '/sales', '/api/resources', '/nexus/']) assert.equal((await get(route, {headers: uploader})).status, 403, route);
  assert.equal((await get('/api/gaps/sir-fruit/uploads', {headers: as([])})).status, 403);
});

test('Permissions set in Admin › Users open exactly their tools; blocked people see nothing; only administrators manage them', async t => {
  const {memoryPermissionStore} = require('../server/shared/permissions/store.cjs');
  const store = memoryPermissionStore({permissions: [
    {email: 'someone@meridiangroup.co.za', sections: ['automation', 'gaps-upload']},
    {email: 'blocked@meridiangroup.co.za', disabled: true},
    {email: 'boss@meridiangroup.co.za', admin: true}
  ]});
  const get = await nexusHost(t, undefined, null, store);
  const asEmail = (email, roles = []) => ({'x-ms-client-principal': principal(MERIDIAN_TENANT, 'aad', roles), 'x-ms-client-principal-name': email});
  const someone = asEmail('someone@meridiangroup.co.za');
  assert.deepEqual((await (await get('/api/me', {headers: someone})).json()).sections, ['attendance', 'franchiseorder', 'gaps', 'gaps-upload', 'automation']);
  assert.equal((await get('/automation', {headers: someone})).status, 200);
  assert.equal((await get('/api/automation', {headers: someone})).status, 503, 'allowed through; Google is not configured in tests');
  assert.equal((await get('/admin/gap-upload', {headers: someone})).status, 200);
  for (const route of ['/etls', '/api/sales', '/admin/users', '/api/permissions', '/nexus/']) assert.equal((await get(route, {headers: someone})).status, 403, route);
  const blocked = asEmail('blocked@meridiangroup.co.za');
  assert.equal((await (await get('/api/me', {headers: blocked})).json()).blocked, true);
  assert.equal((await get('/franchise-orders/overview', {headers: blocked})).status, 403);
  const boss = asEmail('boss@meridiangroup.co.za');
  assert.equal((await (await get('/api/me', {headers: boss})).json()).admin, true);
  const list = await (await get('/api/permissions', {headers: boss})).json();
  assert.ok(list.people.some(p => p.email === 'someone@meridiangroup.co.za'));
  const grant = await get('/api/permissions/new.person@meridiangroup.co.za', {method: 'PUT', headers: {...boss, 'content-type': 'application/json'}, body: JSON.stringify({sections: ['etls'], admin: false, disabled: false})});
  assert.equal(grant.status, 200);
  assert.equal((await get('/etls', {headers: asEmail('new.person@meridiangroup.co.za')})).status, 200, 'takes effect immediately');
  const crossSite = await get('/api/permissions/x@meridiangroup.co.za', {method: 'PUT', headers: {...boss, origin: 'https://evil.example', 'content-type': 'application/json'}, body: '{"sections":[],"admin":true}'});
  assert.equal(crossSite.status, 403);
  assert.equal((await get('/api/permissions/x@meridiangroup.co.za', {method: 'PUT', headers: {...someone, 'content-type': 'application/json'}, body: '{"sections":[],"admin":true}'})).status, 403);
});
