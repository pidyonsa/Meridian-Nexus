'use strict';
// Publishes the verified Google Franchise Orders source into the Azure snapshot.
// Only Orders inputs are replaced; Attendance documents and workbooks are carried over unchanged.
const zlib = require('node:zlib');
const {validate, hash} = require('../server/snapshot-data.cjs');
const {unpackSnapshot} = require('./core.cjs');
const MAX_BLOB = 30 * 1024 * 1024;
const CHUNK_ROWS = 200;
const isOrdersDocument = key => key.startsWith('publicDashboardOrderImports/') || key.startsWith('salesTransactions/') ||
  key.startsWith('publicDashboardSources/') || key === 'portalResources/geo-product-order-master';
const isOrdersFile = name => name.startsWith('portal-resources/geo-product-order-master/');
// The Google refresher stores rows in 200-row chunks named 0000, 0001, ...
const chunkIds = rowCount => Array.from({length:Math.ceil(rowCount / CHUNK_ROWS)}, (_, i) => String(i).padStart(4, '0'));
function checkOrders(source) {
  const orders = source.documents['publicDashboardSources/orders'], range = orders?.range || {};
  if (!orders || !/^[a-f0-9]{64}$/.test(orders.version || '') || !Number.isInteger(orders.rowCount) || orders.rowCount < 1 || orders.rowCount > 30000 ||
      !/^\d{4}-\d{2}-01$/.test(range.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate || '') || range.endDate < range.startDate ||
      range.startDate.slice(0, 7) !== range.endDate.slice(0, 7) || orders.period !== range.startDate.slice(0, 7)) throw Error('Incomplete Orders source');
  const prefix = 'publicDashboardOrderImports/' + orders.version + '/chunks/';
  const rows = Object.entries(source.documents).filter(([key]) => key.startsWith(prefix)).reduce((n, [, doc]) => n + (Array.isArray(doc.rows) ? doc.rows.length : 0), 0);
  if (rows !== orders.rowCount) throw Error('Incomplete Orders chunks');
  for (const key of Object.keys(source.documents)) if (!isOrdersDocument(key)) throw Error('Unexpected Orders source document');
  for (const name of Object.keys(source.files || {})) if (!isOrdersFile(name)) throw Error('Unexpected Orders source workbook');
  return orders;
}
function mergeOrders(baseline, source, now) {
  const orders = checkOrders(source), previous = baseline.documents['publicDashboardSources/orders'];
  if (previous?.range?.endDate && orders.range.endDate < previous.range.endDate) throw Error('Orders source would move backwards');
  const next = structuredClone(baseline);
  for (const key of Object.keys(next.documents)) if (isOrdersDocument(key)) { delete next.documents[key]; delete next.sourceUpdates?.[key]; }
  for (const name of Object.keys(next.files)) if (isOrdersFile(name)) delete next.files[name];
  Object.assign(next.documents, source.documents);
  Object.assign(next.files, source.files || {});
  next.sourceUpdates = {...next.sourceUpdates, ...source.versions};
  next.capturedAt = now.toISOString();
  for (const [key, value] of Object.entries(baseline.documents)) {
    if (!isOrdersDocument(key) && JSON.stringify(next.documents[key]) !== JSON.stringify(value)) throw Error('Attendance changed during Orders merge');
  }
  for (const [name, file] of Object.entries(baseline.files)) if (!isOrdersFile(name) && next.files[name]?.sha256 !== file.sha256) throw Error('Attendance workbook changed during Orders merge');
  return validate(next);
}
async function publishOrders({source, blobs, verifyReports, now = () => new Date()}) {
  const current = await blobs.read('current.json'), pointer = JSON.parse(current.bytes);
  if (!current.etag) throw Error('Azure pointer has no concurrency token');
  // Cheap check of the three Orders source documents; the full copy only runs after a new import.
  const head = await source.fingerprint();
  const sourceVersion = hash(JSON.stringify(Object.entries(head).sort(([a], [b]) => a.localeCompare(b))));
  if (pointer.ordersSourceVersion === sourceVersion) return {status:'unchanged', ordersImportedAt:pointer.ordersImportedAt, capturedAt:pointer.capturedAt};
  if (!/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(pointer.blob || '')) throw Error('Invalid Azure baseline path');
  const baseline = unpackSnapshot(pointer, (await blobs.read(pointer.blob)).bytes);
  const selected = await source.load(baseline);
  for (const [name, version] of Object.entries(head)) if (selected.versions[name] !== version) throw Error('Orders source changed during publishing');
  const next = mergeOrders(baseline, selected, now());
  const orders = await verifyReports(baseline, next);
  // Do not publish a mixed import if the refresher replaced the source while it was copied.
  await source.verify(selected);
  const bytes = zlib.gzipSync(Buffer.from(JSON.stringify(next)), {level:9}), sha256 = hash(bytes);
  if (bytes.length > MAX_BLOB) throw Error('Orders snapshot exceeds size limit');
  const blob = 'snapshots/' + sha256 + '.json.gz';
  await blobs.write(blob, bytes, {'If-None-Match':'*'});
  if (hash((await blobs.read(blob)).bytes) !== sha256) throw Error('Published snapshot read-back failed');
  const published = next.documents['publicDashboardSources/orders'];
  const updated = {...pointer, schema:1, blob, sha256, bytes:bytes.length, capturedAt:next.capturedAt,
    ordersImportedAt:published.importedAt, ordersThrough:published.range.endDate, ordersSourceVersion:sourceVersion, orders};
  // Keep Attendance untouched and reject concurrent pointer updates instead of losing them.
  await blobs.write('current.json', Buffer.from(JSON.stringify(updated)), {'If-Match':current.etag});
  return {status:'published', ordersThrough:updated.ordersThrough, ordersImportedAt:updated.ordersImportedAt, capturedAt:updated.capturedAt, sha256, orders};
}
module.exports = {publishOrders, mergeOrders, checkOrders, chunkIds, isOrdersDocument, isOrdersFile, CHUNK_ROWS};
