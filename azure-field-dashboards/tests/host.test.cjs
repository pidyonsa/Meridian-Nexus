'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {createApp, UPSTREAM} = require('../server/main.cjs');
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json', ...headers}});
async function host(t, options = {}) {
  const server = createApp({enabled: () => true, ...options}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {url, post: (body = {}, route = '/api/orders', extra = {}) => fetch(url + route, {method: 'POST', headers: {'content-type': 'application/json', ...extra}, body: JSON.stringify(body)})};
}

test('Azure data mode serves both reports without Google fallback and keeps raw data private', async t => {
  const seen=[];
  const {url,post}=await host(t,{fetchImpl:async()=>{throw Error('Google must not be called');},reportProvider:{kind:'azure-blob-snapshot',request:async(route,input)=>{seen.push({route,input});return {status:200,data:{rows:[],dataHosting:{provider:'Azure'}}};}}});
  for(const route of ['/api/orders','/api/attendance'])assert.equal((await post({refresh:true},route)).status,200);
  assert.equal((await(await fetch(url+'/healthz')).json()).dataService,'azure-blob-snapshot');
  assert.equal((await fetch(url+'/api/health')).status,200);
  for(const path of ['/snapshot.json.gz','/current.json','/server/report-engine/service.cjs','/api/import','/dashboard-data/current.json'])assert.equal((await fetch(url+path)).status,404);
  assert.deepEqual(seen.map(r=>r.route),['/api/orders','/api/attendance','/api/health']);
});
test('serves dashboard deep links with isolated Attendance and Franchise sidebars', async t => {
  const {url} = await host(t);
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  for (const route of ['/attendance', '/attendance/merchandiser/stores', '/attendance/rep/daily', '/franchise-orders', '/franchise-orders/trend']) {
    const response = await fetch(url + route);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), html);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  }
  // "Home" goes to the existing Nexus portal until every tool is in the Azure Nexus (user decision, 24 October 2026);
  // the Meridian Nexus brand opens the Azure Nexus workspace on this site.
  const portal = 'https://meridian-group-za.github.io/Meridian-Nexus/portal.html';
  assert.ok(html.includes(`<a href="${portal}" data-portal-home>`) && html.includes(`<a href="${portal}" data-attendance-home>`));
  assert.match(html, /<a class="orders-brand" href="\/"/);
  assert.equal((html.match(/github\.io/g) || []).length, 2);
  assert.match(html, /<aside id="attendance-sidebar"[^>]*hidden/);
  assert.match(html, /id="attendance-nav-toggle"/);
  assert.match(html, /id="report-tabs"/);
  assert.match(html, /<aside id="orders-sidebar"[^>]*hidden/);
  assert.match(html, /id="orders-nav-toggle"/);
  assert.doesNotMatch(html,/msal|support\.js|iframe|sign.out/i);
  assert.equal((await fetch(url + '/vendor/icons/style.css')).status, 200);
});
test('no admin, source code, manifest, arbitrary proxy or mutation routes', async t => {
  let calls = 0;
  const {url} = await host(t, {fetchImpl: async () => {calls++; return json({});}});
  for (const route of ['/admin', '/api/admin', '/api/imports', '/api/proxy', '/api/orders/other', '/server/main.cjs', '/package.json', '/.env', '/asset-manifest.json', '/attendance/client/overview', '/attendance/rep/exclusions', '/attendance/merchandiser/exclusions', '/franchise-orders/admin']) {
    assert.equal((await fetch(url + route)).status, 404, route);
  }
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await fetch(url + '/api/orders', {method})).status, 405);
  assert.equal((await fetch(url + '/', {method: 'POST'})).status, 405);
  assert.equal(calls, 0);
});

test('both dashboard links use the same square Meridian favicon',async t=>{
  const {url}=await host(t);
  const iconPath='/assets/favicon-32.png?v=20260918';
  for(const route of ['/attendance','/franchise-orders']){
    const html=await(await fetch(url+route)).text();
    assert.ok(html.includes(`<link rel="icon" type="image/png" sizes="32x32" href="${iconPath}">`));
  }
  const response=await fetch(url+iconPath);assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/image\/png/);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.deepEqual(bytes,fs.readFileSync(path.resolve(__dirname,'../../public/assets/icons/favicon-32.png')));
  assert.equal(bytes.readUInt32BE(16),32);assert.equal(bytes.readUInt32BE(20),32);
});

test('large reports and static scripts are compressed without weakening no-store',async t=>{
  const data={rows:Array.from({length:400},(_,i)=>({id:i,product:'Synthetic product',client:'Client A'}))};
  const {url,post}=await host(t,{fetchImpl:async()=>json(data)});
  const response=await post({},'/api/orders',{'accept-encoding':'gzip'});
  assert.equal(response.headers.get('content-encoding'),'gzip');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),data);
  const asset=await fetch(url+'/viewer.js',{headers:{'accept-encoding':'gzip'}});assert.equal(asset.headers.get('content-encoding'),'gzip');assert.match(await asset.text(),/ReportLoader/);
});
test('fixed upstream with no caller credentials, cookies, IP or query forwarding', async t => {
  let call;
  const {post} = await host(t, {fetchImpl: async (...args) => {call = args; return json({lines: [1]});}});
  const response = await post({filters: {banner: 'Test'}, url: 'https://example.invalid'}, '/api/orders?url=https://example.invalid', {authorization: 'Bearer test-only', cookie: 'test=only', 'x-forwarded-for': '192.0.2.1'});
  assert.equal(response.status, 200);
  assert.equal(call[0], UPSTREAM + '/api/orders');
  assert.deepEqual(call[1].headers, {accept: 'application/json', 'content-type': 'application/json'});
  assert.equal(call[1].redirect, 'error');
  assert.equal(call[1].method, 'POST');
});
test('rejects malformed, missing, oversized, array and compressed inputs', async t => {
  let calls = 0;
  const {url, post} = await host(t, {fetchImpl: async () => {calls++; return json({});}});
  for (const body of [[], null, 'text']) assert.equal((await post(body)).status, 400);
  assert.equal((await post({text: 'x'.repeat(33000)})).status, 413);
  assert.equal((await fetch(url + '/api/orders', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{'})).status, 400);
  assert.equal((await fetch(url + '/api/orders', {method: 'POST', body: 'text'})).status, 400);
  assert.equal((await fetch(url + '/api/orders', {method: 'POST', headers: {'content-type': 'application/json', 'content-encoding': 'gzip'}, body: 'x'})).status, 415);
  assert.equal(calls, 0);
});
test('both APIs preserve filter and export payloads and successful responses', async t => {
  const {post} = await host(t, {fetchImpl: async (url, options) => json({route: url, query: JSON.parse(options.body), rows: [{name: 'Synthetic test'}]})});
  for (const route of ['/api/orders', '/api/attendance']) {
    const body = {audience: 'rep', filters: {manager: 'Synthetic manager'}, export: true};
    const response = await post(body, route);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).query, body);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
test('memory cache expires, separates audiences/filters and never caches exports or refreshes', async t => {
  let calls = 0, time = 1000;
  const {post} = await host(t, {now: () => time, fetchImpl: async () => json({call: ++calls})});
  assert.equal((await (await post({audience: 'rep'})).json()).call, 1);
  assert.equal((await (await post({audience: 'rep'})).json()).call, 1);
  assert.equal((await (await post({audience: 'merchandiser'})).json()).call, 2);
  time += 15001;
  assert.equal((await (await post({audience: 'rep'})).json()).call, 3);
  for (const body of [{export: true}, {export: true}, {mode: 'export'}, {mode: 'export'}, {refresh: true}, {refresh: true}]) await post(body);
  assert.equal(calls, 9);
});
test('coalesces identical in-flight requests', async t => {
  let calls = 0;
  const {post} = await host(t, {fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 30)); return json({ok: true}); }});
  const responses = await Promise.all([post({}), post({})]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(calls, 1);
});
test('public suspension denies cached and in-flight data, while health describes the host only', async t => {
  let enabled = true, calls = 0;
  const {url, post} = await host(t, {enabled: () => enabled, fetchImpl: async () => {calls++; return json({ok: true});}});
  await post({}); enabled = false;
  assert.equal((await post({})).status, 503);
  assert.equal(calls, 1);
  const health = await (await fetch(url + '/healthz')).json();
  assert.equal(health.publicAccessEnabled, false);
  assert.equal(health.dataService, 'existing-public-viewer');
  const inflight = await host(t, {enabled: () => enabled, fetchImpl: async () => {enabled = false; return json({ok: true});}});
  enabled = true;
  assert.equal((await inflight.post({})).status, 503);
});
test('preserves useful upstream failure statuses without leaking internal failure details', async t => {
  for (const status of [400, 409, 413, 429, 503, 500, 401]) {
    const {post} = await host(t, {fetchImpl: async () => json({error: 'Source unavailable'}, status)});
    const response = await post({});
    assert.equal(response.status, [500, 401].includes(status) ? 502 : status);
    if (status === 429) assert.equal(response.headers.get('retry-after'), '60');
    if (status === 500) assert.doesNotMatch(await response.text(), /Source unavailable/);
  }
});
test('rejects bad, oversized and non-JSON upstream responses', async t => {
  for (const response of [new Response('<html>Login</html>'), json([], 200), json({}, 200, {'content-length': String(10 * 1024 * 1024)}), new Response('x'.repeat(9 * 1024 * 1024 + 1), {headers: {'content-type': 'application/json'}})]) {
    const {post} = await host(t, {fetchImpl: async () => response});
    assert.equal((await post({})).status, 502);
  }
});
test('timeouts abort upstream requests and return a clean error', async t => {
  const {post} = await host(t, {timeoutMs: 20, fetchImpl: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort'))))});
  assert.equal((await post({})).status, 504);
});

test('retries platform HTML capacity failures without changing the read-only request', async t => {
  const calls = [];
  const {post} = await host(t, {retryDelayMs: 1, fetchImpl: async (url, options) => {
    calls.push({url, body: options.body, headers: options.headers});
    return calls.length < 3 ? new Response('Rate exceeded.', {status: 429}) : json({totals: {lines: 12}});
  }});
  const result = await post({filters: {client: 'Test'}, refresh: true});
  assert.equal(result.status, 200);
  assert.equal((await result.json()).totals.lines, 12);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], calls[1]); assert.deepEqual(calls[1], calls[2]);
});

test('platform retries are bounded, preserve busy status, and never cache errors', async t => {
  let calls = 0, recover = false;
  const {post} = await host(t, {retryDelayMs: 1, fetchImpl: async () => {
    calls++; return recover ? json({ok: true}) : new Response('Private platform diagnostic', {status: 503});
  }});
  const response = await post();
  assert.equal(response.status, 503); assert.equal(calls, 3);
  assert.equal(response.headers.get('retry-after'), '5');
  assert.doesNotMatch(await response.text(), /Private platform diagnostic/);
  recover = true; assert.equal((await post()).status, 200); assert.equal(calls, 4);
});

test('long platform Retry-After is returned without retrying early', async t => {
  let calls = 0;
  const {post} = await host(t, {retryDelayMs: 1, fetchImpl: async () => {
    calls++; return new Response('Rate exceeded.', {status: 429, headers: {'retry-after': '60'}});
  }});
  const response = await post();
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60'); assert.equal(calls, 1);
});

test('retry waits share the original request deadline', async t => {
  let calls = 0;
  const {post} = await host(t, {timeoutMs: 20, retryDelayMs: 100, fetchImpl: async () => {
    calls++; return new Response('Unavailable', {status: 503});
  }});
  assert.equal((await post()).status, 504); assert.equal(calls, 1);
});
test('per-IP request limits include cached requests', async t => {
  const {post} = await host(t, {fetchImpl: async () => json({ok: true})});
  for (let i = 0; i < 90; i++) assert.equal((await post({})).status, 200);
  assert.equal((await post({})).status, 429);
});
