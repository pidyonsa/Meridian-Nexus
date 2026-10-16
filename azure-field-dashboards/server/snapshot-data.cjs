'use strict';
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const ALLOWED = /^(?:geoRepAttendanceDashboard\/(?:current|merchandisers)|geoRep(?:Merchandiser)?AttendanceConfig\/current|files\/[^/]+|attendanceStoreMasters\/[^/]+|portalResources\/geo-product-order-master|publicDashboardSources\/(?:orders|orderRegions)|salesTransactions\/[^/]+|publicDashboardOrderImports\/[a-f0-9]{64}\/chunks\/[^/]+)$/;
const storageAllowed = value => typeof value === 'string' && !value.includes('..') && ['uploads/', 'geo-rep-attendance-store-masters/', 'portal-resources/geo-product-order-master/'].some(prefix => value.startsWith(prefix));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function validate(snapshot) {
  if (snapshot?.schema !== 1 || !snapshot.documents || !snapshot.files || !Number.isFinite(Date.parse(snapshot.capturedAt))) throw Error('Invalid dashboard snapshot.');
  const docs = Object.entries(snapshot.documents), files = Object.entries(snapshot.files);
  if (docs.length > 31000 || files.length > 8) throw Error('Dashboard snapshot exceeds bounds.');
  for (const [name, data] of docs) if (!ALLOWED.test(name) || !data || typeof data !== 'object' || Array.isArray(data)) throw Error('Unsupported snapshot document.');
  for (const [name, file] of files) {
    if (!storageAllowed(name) || typeof file.base64 !== 'string' || file.base64.length > 36 * 1024 * 1024) throw Error('Unsupported snapshot workbook.');
    const bytes = Buffer.from(file.base64, 'base64');
    if (bytes.length !== file.size || file.size > 25 * 1024 * 1024 || hash(bytes) !== file.sha256) throw Error('Snapshot workbook checksum mismatch.');
  }
  for (const audience of ['current', 'merchandisers']) {
    const source = snapshot.documents['geoRepAttendanceDashboard/' + audience];
    const file = snapshot.documents['files/' + source?.source?.schedules?.fileId];
    if (!Array.isArray(source?.rows) || !file || !snapshot.files[file.storagePath]) throw Error('Incomplete attendance snapshot.');
  }
  const orders = snapshot.documents['publicDashboardSources/orders'];
  if (!orders || !/^[a-f0-9]{64}$/.test(orders.version)) throw Error('Incomplete Orders snapshot.');
  const rows = docs.filter(([key]) => key.startsWith('publicDashboardOrderImports/' + orders.version + '/chunks/')).flatMap(([,value]) => value.rows || []);
  if (rows.length !== orders.rowCount || rows.length > 30000) throw Error('Incomplete Orders chunks.');
  return snapshot;
}
function adapters(snapshot) {
  validate(snapshot);
  const document = name => ({id:name.split('/').at(-1), exists:Object.hasOwn(snapshot.documents, name), data:() => snapshot.documents[name]});
  function collection(name, conditions = [], sort, count) {
    return {
      doc:id => {
        if (typeof id !== 'string' || id.includes('/')) throw Error('Invalid document ID.');
        const key = name + '/' + id;
        return {get:async() => document(key), collection:child => collection(key + '/' + child)};
      },
      where:(field, op, value) => {
        if (name !== 'salesTransactions' || field !== 'periodKey' || !['>=', '<='].includes(op)) throw Error('Unsupported snapshot query.');
        return collection(name, [...conditions, [op, value]], sort, count);
      },
      orderBy:(field, direction) => {
        if (name !== 'salesTransactions' || field !== 'periodKey' || direction !== 'desc') throw Error('Unsupported snapshot order.');
        return collection(name, conditions, true, count);
      },
      limit:value => collection(name, conditions, sort, value),
      get:async() => {
        if (name !== 'salesTransactions' && !/^publicDashboardOrderImports\/[a-f0-9]{64}\/chunks$/.test(name)) throw Error('Unsupported snapshot collection.');
        let docs = Object.keys(snapshot.documents).filter(key => key.startsWith(name + '/') && !key.slice(name.length + 1).includes('/')).sort().map(document);
        docs = docs.filter(doc => conditions.every(([op, value]) => op === '>=' ? doc.data().periodKey >= value : doc.data().periodKey <= value));
        if (sort) docs.sort((a, b) => String(b.data().periodKey).localeCompare(String(a.data().periodKey)) || b.id.localeCompare(a.id));
        if (count !== undefined) docs = docs.slice(0, count);
        return {docs, size:docs.length};
      }
    };
  }
  const getStorage = () => ({bucket:() => ({file:name => ({download:async options => {
    if (!Object.hasOwn(snapshot.files, name)) throw Error('Workbook is not in the verified snapshot.');
    const bytes = Buffer.from(snapshot.files[name].base64, 'base64');
    if (options?.destination) await fs.writeFile(options.destination, bytes);
    return [bytes];
  }})})});
  return {db:{collection}, getStorage};
}
module.exports = {validate, adapters, hash, storageAllowed};
