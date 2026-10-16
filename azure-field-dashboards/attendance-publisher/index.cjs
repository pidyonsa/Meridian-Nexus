'use strict';
const {publish} = require('./core.cjs');
const {publishOrders, chunkIds} = require('./orders.cjs');
const {hash, adapters, storageAllowed} = require('../server/snapshot-data.cjs');
const PROJECT = 'meridain-nexus', BUCKET = PROJECT + '.firebasestorage.app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/`;
const CONTAINER = 'https://meridianfield730011.blob.core.windows.net/dashboard-data/';
const TENANT = 'cbe83df2-b350-4dab-8d5f-f78d21fe7d27';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A one-day range (the 2nd of each month covers only the 1st) is saved without the "_to_" end date.
const ATTENDANCE_WORKBOOK = /^uploads\/[^/]+\/Geo_Rep_Strike_Rate_Report_\d{4}-\d{2}-\d{2}(?:_to_\d{4}-\d{2}-\d{2})?\.xlsx$/;
async function request(url, options = {}, max = 2 * 1024 * 1024) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try { response = await fetch(url, {...options, redirect:'error', signal:AbortSignal.timeout(60000)}); }
    catch (error) { if (attempt < 2) { await sleep(1000 * (attempt + 1)); continue; } throw Error('Publisher network request failed'); }
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) { await response.body?.cancel(); await sleep(1000 * (attempt + 1)); continue; }
    if (!response.ok) { await response.body?.cancel(); const error = Error('Publisher HTTP ' + response.status); error.status = response.status; throw error; }
    const chunks = []; let size = 0;
    for await (const chunk of response.body || []) { size += chunk.length; if (size > max) throw Error('Publisher response exceeds bound: ' + new URL(url).hostname + ' (' + max + ' bytes)'); chunks.push(chunk); }
    return {bytes:Buffer.concat(chunks), etag:response.headers.get('etag')};
  }
}
function decode(v) {
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if ('integerValue' in v) return Number(v.integerValue);
  for (const key of ['stringValue', 'timestampValue', 'doubleValue', 'booleanValue', 'nullValue']) if (key in v) return v[key];
  throw Error('Unsupported source value');
}
async function metadata(path) {
  return (await request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/' + path, {headers:{'Metadata-Flavor':'Google'}}, 32768)).bytes.toString();
}
async function dependencies() {
  const googleToken = JSON.parse(await metadata('token')).access_token;
  const assertion = await metadata('identity?audience=' + encodeURIComponent('api://AzureADTokenExchange'));
  if (!/^[a-f0-9-]{36}$/.test(process.env.AZURE_PUBLISHER_CLIENT_ID || '')) throw Error('Publisher identity is not configured');
  const token = JSON.parse((await request(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({
      client_id:process.env.AZURE_PUBLISHER_CLIENT_ID, scope:'https://storage.azure.com/.default', grant_type:'client_credentials',
      client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion:assertion
    }).toString()
  }, 32768)).bytes).access_token;
  if (!googleToken || !token) throw Error('Publisher identity token is missing');
  const google = async (url, max) => request(url, {headers:{Authorization:'Bearer ' + googleToken}}, max);
  const googlePost = async (url, body, max) => request(url, {method:'POST', headers:{Authorization:'Bearer ' + googleToken, 'content-type':'application/json'}, body:JSON.stringify(body)}, max);
  async function document(name, fields, optional = false) {
    const query = new URLSearchParams({prettyPrint:'false'}); fields.forEach(key => query.append('mask.fieldPaths', key));
    // Firestore's typed JSON representation can exceed the stored document size.
    try { const doc = JSON.parse((await google(BASE + name + '?' + query, 8 * 1024 * 1024)).bytes); return {data:decode({mapValue:{fields:doc.fields || {}}}), version:doc.updateTime}; }
    catch (error) { if (optional && error.status === 404) return {data:null, version:null}; throw error; }
  }
  function objectUrl(name) {
    if (!storageAllowed(name)) throw Error('Unsupported attendance workbook');
    return `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(name)}`;
  }
  const source = {
    async load() {
      const selected = {documents:{}, versions:{}, objects:{}};
      async function add(name, fields, optional) {
        const doc = await document(name, fields, optional); selected.versions[name] = doc.version;
        if (doc.data) selected.documents[name] = doc.data;
        return doc.data;
      }
      for (const id of ['current','merchandisers']) {
        const report = await add('geoRepAttendanceDashboard/' + id, ['reportStartDate','reportEndDate','operationalWeek','updatedAt','updatedByRunId','rows','source']);
        const fileId = report.source?.schedules?.fileId;
        if (!/^[a-zA-Z0-9_-]+$/.test(fileId || '') || !/^[a-zA-Z0-9_-]+$/.test(report.updatedByRunId || '')) throw Error('Invalid attendance import identifiers');
        const run = await document('extractionRuns/' + report.updatedByRunId, ['status']);
        if (run.data.status !== 'completed') throw Error('Attendance import is not complete');
        report.source = {schedules:{fileId}};
        const file = await add('files/' + fileId, ['name','storagePath','sha256']);
        if (!ATTENDANCE_WORKBOOK.test(file.storagePath || '')) throw Error('Not a Geo Rep attendance workbook');
        const config = await add((id === 'current' ? 'geoRepAttendanceConfig' : 'geoRepMerchandiserAttendanceConfig') + '/current', ['storeMasterId','dashboardExclusions'], true);
        const masterId = config?.storeMasterId || 'geo-rep-attendance-store-master';
        if (!/^[a-zA-Z0-9_-]+$/.test(masterId)) throw Error('Invalid attendance master identifier');
        await add('attendanceStoreMasters/' + masterId, ['storagePath','name','sourceName','sha256'], true);
      }
      for (const doc of Object.values(selected.documents)) {
        if (!doc.storagePath || selected.objects[doc.storagePath]) continue;
        const meta = JSON.parse((await google(objectUrl(doc.storagePath) + '?fields=generation,size')).bytes);
        if (!/^\d+$/.test(meta.generation) || Number(meta.size) > 25 * 1024 * 1024) throw Error('Invalid workbook generation or size');
        selected.objects[doc.storagePath] = {...meta, expectedHash:doc.sha256};
        selected.versions['object:' + doc.storagePath] = meta.generation;
      }
      return selected;
    },
    async workbooks(selected) {
      const files = {};
      for (const [name, meta] of Object.entries(selected.objects)) {
        const {bytes} = await google(objectUrl(name) + '?alt=media&generation=' + meta.generation, 25 * 1024 * 1024);
        const sha256 = hash(bytes);
        if (bytes.length !== Number(meta.size) || (meta.expectedHash && sha256 !== meta.expectedHash)) throw Error('Attendance workbook checksum mismatch');
        files[name] = {size:bytes.length, sha256, base64:bytes.toString('base64')};
      }
      return files;
    },
    async verify(selected) {
      for (const [name, version] of Object.entries(selected.versions)) {
        const latest = name.startsWith('object:') ? JSON.parse((await google(objectUrl(name.slice(7)) + '?fields=generation')).bytes).generation : (await document(name, ['updatedAt'], true)).version;
        if (latest !== version) throw Error('Attendance source changed during publishing');
      }
    }
  };
  function blobUrl(name) {
    if (name !== 'current.json' && !/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(name)) throw Error('Unsupported Azure blob');
    return CONTAINER + name;
  }
  const headers = {Authorization:'Bearer ' + token, 'x-ms-version':'2023-11-03'};
  const blobs = {
    read:name => request(blobUrl(name), {headers}, name === 'current.json' ? 16384 : 30 * 1024 * 1024),
    async write(name, body, condition) {
      try { await request(blobUrl(name), {method:'PUT', body, headers:{...headers, ...condition, 'x-ms-blob-type':'BlockBlob', 'content-type':name.endsWith('.gz') ? 'application/gzip' : 'application/json', 'x-ms-blob-cache-control':'no-store'}}, 16384); }
      catch (error) { if (name !== 'current.json' && [409,412].includes(error.status)) return; throw error; }
    }
  };
  async function verifyReports(snapshot) {
    const service = require('../server/report-engine/service.cjs').createService({...adapters(snapshot), ExcelJS:require('exceljs'), HttpsError:class extends Error {constructor(code, message) {super(message); this.code = code;}}});
    const result = {};
    for (const audience of ['rep','merchandiser']) {
      const report = await service.attendance({audience});
      const m = report.metrics;
      if (!m || m.scheduled < 1 || [m.attended,m.missedVisits,m.unknownVisits].some(n => !Number.isFinite(n) || n < 0) || m.attended + m.missedVisits + m.unknownVisits !== m.scheduled) throw Error('Attendance report reconciliation failed');
      result[audience] = {through:report.reportEndDate, scheduled:m.scheduled, attended:m.attended, version:report.version};
    }
    return result;
  }
  const ORDER_FIELDS = ['version','period','rowCount','importedAt','range','brandColumn','brandRows','summaryDifference'];
  const LEDGER_FIELDS = ['periodKey','orderDate','orderNumber','storeCode','sku','poNumber','quantity','value','unitPrice','mapped','importedAt','sourceSystem','region','province','rep','manager','storeName','product','status','client','banner','channel','brand','category','currency','Brands','brands','Brand','Brand Name'];
  const ordersSource = {
    async fingerprint() {
      const head = {};
      head['publicDashboardSources/orders'] = (await document('publicDashboardSources/orders', ['version'])).version;
      head['publicDashboardSources/orderRegions'] = (await document('publicDashboardSources/orderRegions', ['version'], true)).version;
      head['portalResources/geo-product-order-master'] = (await document('portalResources/geo-product-order-master', ['sha256'], true)).version;
      return head;
    },
    async load(baseline) {
      const selected = {documents:{}, versions:{}, files:{}};
      async function add(name, fields, optional) {
        const doc = await document(name, fields, optional); selected.versions[name] = doc.version;
        if (doc.data) selected.documents[name] = doc.data;
        return doc.data;
      }
      const orders = await add('publicDashboardSources/orders', ORDER_FIELDS);
      if (!/^[a-f0-9]{64}$/.test(orders.version || '') || !Number.isInteger(orders.rowCount) || orders.rowCount < 1 || orders.rowCount > 30000) throw Error('Incomplete Orders source');
      await add('publicDashboardSources/orderRegions', ['active','regions','version','sourceName'], true);
      const master = await add('portalResources/geo-product-order-master', ['active','storagePath','updatedAt','sha256','clientOverrides'], true);
      for (const id of chunkIds(orders.rowCount)) {
        const name = 'publicDashboardOrderImports/' + orders.version + '/chunks/' + id;
        selected.documents[name] = {rows:(await document(name, ['rows'])).data.rows};
      }
      const result = JSON.parse((await googlePost(BASE.slice(0, -1) + ':runQuery', {structuredQuery:{from:[{collectionId:'salesTransactions'}],
        select:{fields:LEDGER_FIELDS.map(field => ({fieldPath:field.includes(' ') ? '`' + field + '`' : field}))}, limit:30001}}, 128 * 1024 * 1024)).bytes);
      const ledger = result.filter(row => row.document).map(row => row.document);
      if (ledger.length > 30000) throw Error('Orders ledger exceeds snapshot bound');
      for (const doc of ledger) selected.documents['salesTransactions/' + doc.name.split('/').at(-1)] = decode({mapValue:{fields:doc.fields || {}}});
      if (master && master.active !== false && master.storagePath) {
        const held = baseline.files[master.storagePath];
        // The product master changes rarely; reuse the verified copy when its checksum is unchanged.
        if (held && /^[a-f0-9]{64}$/.test(master.sha256 || '') && held.sha256 === master.sha256) selected.files[master.storagePath] = held;
        else {
          const meta = JSON.parse((await google(objectUrl(master.storagePath) + '?fields=generation,size')).bytes);
          if (!/^\d+$/.test(meta.generation) || Number(meta.size) > 25 * 1024 * 1024) throw Error('Invalid product master generation or size');
          const {bytes} = await google(objectUrl(master.storagePath) + '?alt=media&generation=' + meta.generation, 25 * 1024 * 1024), sha256 = hash(bytes);
          if (bytes.length !== Number(meta.size) || (master.sha256 && sha256 !== master.sha256)) throw Error('Product master checksum mismatch');
          selected.files[master.storagePath] = {size:bytes.length, sha256, base64:bytes.toString('base64')};
        }
      }
      return selected;
    },
    async verify(selected) {
      for (const [name, version] of Object.entries(selected.versions)) {
        if ((await document(name, ['updatedAt'], true)).version !== version) throw Error('Orders source changed during publishing');
      }
    }
  };
  async function verifyOrders(baseline, snapshot) {
    const service = require('../server/report-engine/service.cjs').createService({...adapters(snapshot), ExcelJS:require('exceljs'), HttpsError:class extends Error {constructor(code, message) {super(message); this.code = code;}}});
    const report = await service.orders({}), t = report.totals, source = snapshot.documents['publicDashboardSources/orders'];
    if (!t || !(t.lines > 0) || ![t.amount, t.units, t.orders].every(Number.isFinite)) throw Error('Orders report reconciliation failed');
    return {through:source.range.endDate, importedAt:source.importedAt, rowCount:source.rowCount, lines:t.lines, orders:t.orders, units:t.units, amount:t.amount, version:report.version};
  }
  return {source, blobs, verifyReports, orders:{source:ordersSource, blobs, verifyReports:verifyOrders}};
}
exports.publishAzureAttendance = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error:'POST required'});
  let deps;
  try { deps = await dependencies(); }
  catch (error) {
    console.error(JSON.stringify({event:'azure-attendance-publisher-failed', error:error.message, status:error.status, retainedPreviousSnapshot:true}));
    return res.status(503).json({error:'Publisher identity unavailable; previous verified reports retained.'});
  }
  // Attendance and Orders publish independently: one failing never blocks the other.
  const result = {}, failed = [];
  try {
    result.attendance = await publish(deps);
    console.info(JSON.stringify({event:'azure-attendance-publisher', ...result.attendance}));
  } catch (error) {
    failed.push('Attendance');
    console.error(JSON.stringify({event:'azure-attendance-publisher-failed', error:error.message, status:error.status, retainedPreviousSnapshot:true}));
  }
  try {
    result.orders = await publishOrders(deps.orders);
    console.info(JSON.stringify({event:'azure-orders-publisher', ...result.orders}));
  } catch (error) {
    failed.push('Orders');
    console.error(JSON.stringify({event:'azure-orders-publisher-failed', error:error.message, status:error.status, retainedPreviousSnapshot:true}));
  }
  if (failed.length) return res.status(503).json({...result, error:failed.join(' and ') + ' publication failed; previous verified report retained.'});
  return res.status(200).json(result);
};
module.exports.decode = decode;
module.exports.ATTENDANCE_WORKBOOK = ATTENDANCE_WORKBOOK;
