'use strict';
const zlib = require('node:zlib');
const {adapters, hash} = require('./snapshot-data.cjs');
const MAX_BLOB = 30 * 1024 * 1024;
class ReportError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
async function bounded(response, limit) {
  if (!response.ok) { await response.body?.cancel(); const error = Error('Azure data read failed: ' + response.status); error.status = response.status; throw error; }
  if (Number(response.headers.get('content-length') || 0) > limit) { await response.body?.cancel(); throw Error('Azure data exceeds bound.'); }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw Error('Azure data exceeds bound.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
function blobReader({containerUrl = process.env.AZURE_DASHBOARD_CONTAINER_URL, env = process.env, fetchImpl = fetch, now = Date.now} = {}) {
  if (!/^https:\/\/[a-z0-9]{3,24}\.blob\.core\.windows\.net\/dashboard-data\/$/.test(containerUrl || '')) throw Error('A private Azure dashboard container is required.');
  let token, tokenUntil = 0;
  async function accessToken() {
    if (token && tokenUntil > now() + 60000) return token;
    if (!env.IDENTITY_ENDPOINT || !env.IDENTITY_HEADER) throw Error('Azure managed identity is required.');
    const url = new URL(env.IDENTITY_ENDPOINT);
    url.searchParams.set('resource', 'https://storage.azure.com/');
    url.searchParams.set('api-version', '2019-08-01');
    const response = await fetchImpl(url, {headers:{'X-IDENTITY-HEADER':env.IDENTITY_HEADER}, redirect:'error', signal:AbortSignal.timeout(10000)});
    const result = JSON.parse((await bounded(response, 32768)).toString('utf8'));
    if (!result.access_token || !Number.isFinite(Number(result.expires_on))) throw Error('Invalid managed identity response.');
    token = result.access_token; tokenUntil = Number(result.expires_on) * 1000;
    return token;
  }
  return async name => {
    if (name !== 'current.json' && !/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(name)) throw Error('Unsupported dashboard blob.');
    const response = await fetchImpl(containerUrl + name, {headers:{Authorization:'Bearer ' + await accessToken(), 'x-ms-version':'2023-11-03'}, redirect:'error', signal:AbortSignal.timeout(45000)});
    return bounded(response, name === 'current.json' ? 16384 : MAX_BLOB);
  };
}
function createAzureReports({readBlob = blobReader(), now = Date.now, serviceFactory, ExcelJS} = {}) {
  let active, pending, nextCheck = 0, refreshFailed = false;
  async function load(force) {
    if (active && !force && now() < nextCheck) return active;
    if (!pending) {
      let stage = 'pointer';
      const started = now();
      pending = (async() => {
        const pointer = JSON.parse((await readBlob('current.json')).toString('utf8'));
        if (pointer.schema !== 1 || !/^[a-f0-9]{64}$/.test(pointer.sha256) || pointer.blob !== 'snapshots/' + pointer.sha256 + '.json.gz' || !Number.isInteger(pointer.bytes) || pointer.bytes < 1 || pointer.bytes > MAX_BLOB) throw Error('Invalid Azure snapshot pointer.');
        if (active?.pointer.sha256 !== pointer.sha256) {
          stage = 'snapshot';
          const bytes = await readBlob(pointer.blob);
          stage = 'integrity';
          if (bytes.length !== pointer.bytes || hash(bytes) !== pointer.sha256) throw Error('Azure snapshot checksum mismatch.');
          const snapshot = JSON.parse(zlib.gunzipSync(bytes, {maxOutputLength:128 * 1024 * 1024}).toString('utf8'));
          if (snapshot.capturedAt !== pointer.capturedAt) throw Error('Azure snapshot generation mismatch.');
          const deps = adapters(snapshot);
          stage = 'engine';
          const make = serviceFactory || require('./report-engine/service.cjs').createService;
          const service = make({...deps, ExcelJS:ExcelJS || require('exceljs'), HttpsError:ReportError});
          active = {pointer, service};
          console.info(JSON.stringify({event:'azure-dashboard-source-loaded', ms:now()-started}));
        }
        refreshFailed = false;
        nextCheck = now() + 60000;
        return active;
      })().catch(error => {
        refreshFailed = true; nextCheck = now() + 15000;
        console.error(JSON.stringify({event:'azure-dashboard-source-unavailable', stage, ms:now()-started,
          failure: error.name === 'TimeoutError' ? 'timeout' : error.status ? 'http' : error.cause?.code || 'validation-or-runtime',
          status:error.status, retainedVerifiedSnapshot:!!active}));
        if (active) return active;
        throw new ReportError('unavailable', 'The Azure report data is temporarily unavailable. Please try again shortly.');
      }).finally(() => { pending = null; });
    }
    return pending;
  }
  return {
    kind:'azure-blob-snapshot',
    async request(route, input = {}) {
      if (!['/api/orders','/api/attendance','/api/health'].includes(route)) return {status:404, data:{error:'Report not found.'}};
      try {
        const {pointer, service} = await load(input.refresh === true);
        const dataHosting = {provider:'Azure', mode:'verified-import-snapshot', capturedAt:pointer.capturedAt, attendanceThrough:pointer.attendanceThrough, ordersImportedAt:pointer.ordersImportedAt, refreshFailed};
        if (route === '/api/health') return {status:200, data:{status:refreshFailed ? 'degraded' : 'ok', readOnly:true, dataService:'azure-blob-snapshot', dataHosting}};
        const data = await service[route === '/api/orders' ? 'orders' : 'attendance'](input);
        if (route === '/api/orders' && data.source?.includes('isolated Firebase viewer import')) data.source = data.source.replace('isolated Firebase viewer import', 'verified import hosted on Azure');
        return {status:200, data:{...data, dataHosting}};
      } catch (error) {
        const status = {'invalid-argument':400,'failed-precondition':409,'not-found':404,'resource-exhausted':413,'unavailable':503}[error.code];
        if (!status) console.error(JSON.stringify({event:'azure-dashboard-report-failed', route}));
        return {status:status || 500, data:{error:status ? error.message : 'The report could not be loaded. Please try again shortly.'}};
      }
    }
  };
}
module.exports = {createAzureReports, blobReader, bounded, ReportError};
