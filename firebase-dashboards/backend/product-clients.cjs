'use strict';
const crypto = require('node:crypto');
const RESOURCE_ID = 'geo-product-order-master';
const UNMAPPED = 'Unmapped client';
const text = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const key = value => text(value).toUpperCase();
function cell(value) {
  if (value && typeof value === 'object') return value.result ?? value.text ?? value.richText?.map(r => r.text).join('') ?? '';
  return value ?? '';
}
async function parse(bytes, ExcelJS) {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  const sheet = book.worksheets.find(s => key(s.name) === 'PRODUCTS');
  if (!sheet || sheet.rowCount > 50001) throw Error('A Products worksheet with at most 50,000 products is required.');
  const headers = sheet.getRow(1).values.slice(1).map(v => key(cell(v)));
  const columns = Object.fromEntries(['Product ID','Product Name','Brand','SKU Code','Barcode'].map(h => [h, headers.indexOf(key(h)) + 1]));
  for (const h of ['Product Name','Brand','SKU Code']) if (!columns[h]) throw Error(`Product master is missing ${h}.`);
  const rows = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const read = h => columns[h] ? text(cell(sheet.getCell(n, columns[h]).value)) : '';
    const row = {productId:read('Product ID'), product:read('Product Name'), client:read('Brand'), sku:read('SKU Code'), barcode:read('Barcode')};
    if (!Object.values(row).some(Boolean)) continue;
    if (!row.product || !row.client || (!row.sku && !row.barcode && !row.productId)) throw Error(`Product master row ${n} has incomplete mapping fields.`);
    rows.push(row);
  }
  if (!rows.length) throw Error('Product master contains no products.');
  return {version:crypto.createHash('sha256').update(bytes).digest('hex'), rows};
}
function index(catalog, overrides=[]) {
  if(!Array.isArray(overrides)||overrides.length>100)throw Error('Invalid approved client mappings.');
  const approved=new Map(),knownClients=new Set(catalog.rows.map(r=>r.client));
  for(const row of overrides){
    const sku=key(row.sku),client=text(row.client);
    if(!sku||!knownClients.has(client)||approved.has(sku))throw Error('Approved client mappings need unique SKUs and a client in the master.');
    approved.set(sku,client);
  }
  const maps = Object.fromEntries(['productId','sku','barcode','product'].map(field => [field, new Map()]));
  for (const row of catalog.rows) for (const field of Object.keys(maps)) {
    const value = key(row[field]); if (!value) continue;
    if (!maps[field].has(value)) maps[field].set(value, new Set());
    maps[field].get(value).add(row.client);
  }
  return {...catalog,workbookVersion:catalog.version,version:approved.size?crypto.createHash('sha256').update(JSON.stringify([catalog.version,[...approved].sort()])).digest('hex'):catalog.version,maps,approved};
}
function match(row, catalog) {
  const matches = new Set(); let method = '';
  // Codes are exact strings, including leading zeroes. Conflicting codes never fall back to a name.
  for (const [field, value] of [['productId',row.productId],['sku',row.sku],['barcode',row.barcode || row.sku]]) {
    const found = catalog.maps[field].get(key(value));
    if (found) { for (const client of found) matches.add(client); method ||= field; }
  }
  if(!matches.size&&catalog.approved.has(key(row.sku)))return {client:catalog.approved.get(key(row.sku)),clientMatch:'approvedOverride'};
  if (!matches.size) {
    const found = catalog.maps.product.get(key(row.product));
    if (found) { for (const client of found) matches.add(client); method = 'productName'; }
  }
  return matches.size === 1 ? {client:[...matches][0], clientMatch:method} : {client:UNMAPPED, clientMatch:matches.size ? 'ambiguous' : 'unmatched'};
}
function enrich(rows, catalog) {
  const mapped = rows.map(row => {
    const identity = match(row, catalog);
    return {...row, sourceBrand:row.sourceBrand ?? row.brand ?? '', ...identity, brand:identity.client};
  });
  return {rows:mapped, summary:{version:catalog.version,workbookVersion:catalog.workbookVersion,source:'Geo Product Order Master.xlsx / Brand',products:catalog.rows.length,approvedMappings:catalog.approved.size,
    matched:mapped.filter(r => !['unmatched','ambiguous'].includes(r.clientMatch)).length,
    unmatched:mapped.filter(r => r.clientMatch === 'unmatched').length, ambiguous:mapped.filter(r => r.clientMatch === 'ambiguous').length}};
}
module.exports = {RESOURCE_ID, UNMAPPED, parse, index, match, enrich};
