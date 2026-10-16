'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), zlib = require('node:zlib');
const {api, json} = require('../../scripts/release-multi-admin.cjs');
const {validate, hash, storageAllowed} = require('../server/snapshot-data.cjs');
const base = 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
const bucket = 'meridain-nexus.firebasestorage.app';
const directory = path.resolve(__dirname, '../../.tmp/azure-dashboard-migration');
const pick = (data, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
function decode(value) {
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  for (const key of ['stringValue','timestampValue','doubleValue','booleanValue']) if (key in value) return value[key];
  if ('nullValue' in value) return null;
  throw Error('Unsupported source field type.');
}
const data = doc => decode({mapValue:{fields:doc.fields || {}}});
async function main() {
  const snapshot = {schema:1, capturedAt:new Date().toISOString(), documents:{}, files:{}, sourceUpdates:{}};
  async function document(name, fields) {
    let doc;
    try { doc = await json(base + '/' + name); }
    catch (error) { if (error.message.startsWith('GET 404:')) return null; throw error; }
    const value = data(doc);
    snapshot.documents[name] = fields ? pick(value, fields) : value;
    snapshot.sourceUpdates[name] = doc.updateTime;
    return snapshot.documents[name];
  }
  async function workbook(storagePath, expectedHash) {
    if (snapshot.files[storagePath]) return;
    if (!storageAllowed(storagePath)) throw Error('Unsupported source workbook path.');
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}`;
    const meta = await json(url);
    if (Number(meta.size) > 25 * 1024 * 1024) throw Error('Source exceeds workbook bound.');
    const bytes = Buffer.from(await (await api(url + '?alt=media&generation=' + meta.generation)).arrayBuffer());
    const sha256 = hash(bytes);
    if (expectedHash && /^[a-f0-9]{64}$/.test(expectedHash) && expectedHash !== sha256) throw Error('Source workbook checksum mismatch.');
    snapshot.files[storagePath] = {size:bytes.length, sha256, base64:bytes.toString('base64')};
    console.log(JSON.stringify({workbook:meta.name.split('/').at(-1), bytes:bytes.length, verified:true}));
  }
  for (const audience of ['current','merchandisers']) {
    const source = await document('geoRepAttendanceDashboard/' + audience, ['reportStartDate','reportEndDate','operationalWeek','updatedAt','updatedByRunId','rows','source']);
    if (!source?.source?.schedules?.fileId) throw Error('Missing attendance source.');
    source.source = {schedules:{fileId:source.source.schedules.fileId}};
    const file = await document('files/' + source.source.schedules.fileId, ['name','storagePath','sha256']);
    await workbook(file.storagePath, file.sha256);
    const configName = audience === 'current' ? 'geoRepAttendanceConfig' : 'geoRepMerchandiserAttendanceConfig';
    const config = await document(configName + '/current', ['storeMasterId','dashboardExclusions']);
    const master = await document('attendanceStoreMasters/' + (config?.storeMasterId || 'geo-rep-attendance-store-master'), ['storagePath','name','sourceName','sha256']);
    if (master?.storagePath) await workbook(master.storagePath, master.sha256);
  }
  const resource = await document('portalResources/geo-product-order-master', ['active','storagePath','updatedAt','sha256','clientOverrides']);
  if (resource?.active !== false && resource?.storagePath) await workbook(resource.storagePath, resource.sha256);
  await document('publicDashboardSources/orderRegions', ['active','regions','version','sourceName']);
  const orders = await document('publicDashboardSources/orders', ['version','period','rowCount','importedAt','range','brandColumn','brandRows','summaryDifference']);
  if (!/^[a-f0-9]{64}$/.test(orders?.version)) throw Error('Missing verified Orders source.');
  let token;
  do {
    const q = new URLSearchParams({pageSize:'1000', ...(token ? {pageToken:token} : {})});
    const chunks = await json(base + '/publicDashboardOrderImports/' + orders.version + '/chunks?' + q);
    for (const doc of chunks.documents || []) snapshot.documents[doc.name.split('/documents/')[1]] = {rows:data(doc).rows};
    token = chunks.nextPageToken;
  } while (token);
  const fields = ['periodKey','orderDate','orderNumber','storeCode','sku','poNumber','quantity','value','unitPrice','mapped','importedAt','sourceSystem','region','province','rep','manager','storeName','product','status','client','banner','channel','brand','category','currency','Brands','brands','Brand','Brand Name'];
  const result = await json(base + ':runQuery', 'POST', {structuredQuery:{from:[{collectionId:'salesTransactions'}], select:{fields:fields.map(fieldPath => ({fieldPath:fieldPath.includes(' ') ? '`' + fieldPath + '`' : fieldPath}))}, limit:30001}});
  const ledger = result.filter(row => row.document).map(row => row.document);
  if (ledger.length > 30000) throw Error('Ledger exceeds snapshot bound.');
  for (const doc of ledger) snapshot.documents['salesTransactions/' + doc.name.split('/').at(-1)] = data(doc);
  // Refuse a mixed generation if an import or exclusion update raced the copy.
  for (const [name, updateTime] of Object.entries(snapshot.sourceUpdates)) {
    const latest = await json(base + '/' + name + '?mask.fieldPaths=updatedAt');
    if (latest.updateTime !== updateTime) throw Error('Source changed during migration; repeat the snapshot.');
  }
  validate(snapshot);
  const bytes = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)), {level:9});
  if (bytes.length > 30 * 1024 * 1024) throw Error('Snapshot exceeds compressed bound.');
  const sha256 = hash(bytes), blob = 'snapshots/' + sha256 + '.json.gz';
  const pointer = {schema:1, blob, sha256, bytes:bytes.length, capturedAt:snapshot.capturedAt, attendanceThrough:snapshot.documents['geoRepAttendanceDashboard/current'].reportEndDate, ordersImportedAt:orders.importedAt};
  await fs.mkdir(directory, {recursive:true});
  await fs.writeFile(path.join(directory, 'snapshot.json.gz'), bytes);
  await fs.writeFile(path.join(directory, 'current.json'), JSON.stringify(pointer, null, 2));
  console.log(JSON.stringify({snapshot:pointer, ledgerRecords:ledger.length, orderImportRows:orders.rowCount, workbookCount:Object.keys(snapshot.files).length}));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {decode};
