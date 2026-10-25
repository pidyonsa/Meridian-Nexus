'use strict';
// Firestore REST client for the Azure Nexus: reads, queries, writes and transactions on the Firebase-era documents,
// so the Google-side triggers and workers keep running unchanged while their screens move to Azure.
//   const fs = firestore({token});
//   await fs.get('extractionRuns/abc')                       -> {id, path, data, updateTime} | null
//   await fs.query('extractionRuns', {where: [['status', 'in', [...]]], orderBy: [['createdAt', 'desc']], limit: 50, select: ['status']})
//   await fs.create('extractionRuns', {status: 'queued', createdAt: SERVER_TIME})   -> new id
//   await fs.update('retailers/geo-rep', {'reportSchedule.enabled': true, updatedAt: SERVER_TIME})
//   await fs.transaction(async tx => { const d = await tx.get(path); tx.update(path, {...}); })
// Values: Date -> timestamp; SERVER_TIME -> server timestamp; DELETE -> remove the field; {$increment: n};
// {$arrayUnion: [...]} appends values that are not already in the array.
const crypto = require('node:crypto');

const SERVER_TIME = Symbol('serverTimestamp');
const DELETE = Symbol('deleteField');
const PAGE = 300;

function decode(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) { const n = Number(value.integerValue); return Number.isSafeInteger(n) ? n : value.integerValue; }
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return {$bytes: value.bytesValue};
  if ('referenceValue' in value) return {$ref: value.referenceValue.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, '')};
  if ('geoPointValue' in value) return {$geo: {lat: value.geoPointValue.latitude ?? 0, lng: value.geoPointValue.longitude ?? 0}};
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return null;
}
const decodeFields = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

function encode(value) {
  if (value === null || value === undefined) return {nullValue: null};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number') return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
  if (typeof value === 'string') return {stringValue: value};
  if (value instanceof Date) return {timestampValue: value.toISOString()};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
  if (typeof value === 'object') return {mapValue: {fields: encodeFields(value)}};
  throw new Error(`Cannot store a ${typeof value} in Firestore.`);
}
function encodeFields(object) {
  const out = {};
  for (const [k, v] of Object.entries(object)) if (v !== undefined) out[k] = encode(v);
  return out;
}

// Field path segments that are not plain identifiers are quoted with backticks.
const quote = segment => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment) ? segment : `\`${segment.replace(/[`\\]/g, '\\$&')}\``);
const fieldPath = dotted => dotted.split('.').map(quote).join('.');

// Splits {a: 1, 'b.c': SERVER_TIME, d: DELETE, e: {$increment: 1}, f: {$arrayUnion: [x]}} into fields to write, the update mask and transforms.
function plan(data) {
  const fields = {}, mask = [], transforms = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === SERVER_TIME) { transforms.push({fieldPath: fieldPath(key), setToServerValue: 'REQUEST_TIME'}); continue; }
    if (value && typeof value === 'object' && '$increment' in value) { transforms.push({fieldPath: fieldPath(key), increment: encode(value.$increment)}); continue; }
    if (value && typeof value === 'object' && '$arrayUnion' in value) { transforms.push({fieldPath: fieldPath(key), appendMissingElements: {values: value.$arrayUnion.map(encode)}}); continue; }
    mask.push(fieldPath(key));
    if (value === DELETE) continue;
    // Dotted keys write nested fields.
    const parts = key.split('.');
    let target = fields;
    for (const part of parts.slice(0, -1)) target = (target[part] ||= {});
    target[parts.at(-1)] = value;
  }
  return {fields, mask, transforms};
}

const autoId = () => Array.from(crypto.randomBytes(20), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
const OPS = {'==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'not-in': 'NOT_IN', 'array-contains': 'ARRAY_CONTAINS', 'array-contains-any': 'ARRAY_CONTAINS_ANY'};

function firestore({project = 'meridain-nexus', token, fetchImpl = fetch}) {
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const name = path => `${root}/${path}`;
  const toDoc = d => ({id: d.name.split('/').pop(), path: d.name.slice(root.length + 1), data: decodeFields(d.fields), updateTime: d.updateTime, createTime: d.createTime});

  async function call(url, body, {method = 'POST', allow404 = false} = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchImpl(url, {method, headers: {Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
      if (res.ok) return res.json();
      if (allow404 && res.status === 404) return null;
      if (attempt < 4 && [429, 500, 502, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, attempt * 1500)); continue; }
      const text = await res.text();
      const error = new Error(`Firestore ${res.status}: ${text.slice(0, 300)}`);
      error.status = res.status;
      error.aborted = res.status === 409 || /ABORTED/.test(text);
      error.precondition = /FAILED_PRECONDITION|NOT_FOUND|ALREADY_EXISTS/.test(text);
      throw error;
    }
  }

  async function get(path, transaction) {
    const d = await call(`${base}/${path}${transaction ? `?transaction=${encodeURIComponent(transaction)}` : ''}`, null, {method: 'GET', allow404: true});
    return d ? toDoc(d) : null;
  }

  // where: [[field, op, value]], orderBy: [[field, 'asc'|'desc']], limit (all pages when omitted, up to max).
  async function query(collection, {where = [], orderBy = [], limit = 0, max = 5000, parent = '', select = null, transaction} = {}) {
    const filters = where.map(([field, op, value]) => ({fieldFilter: {field: {fieldPath: fieldPath(field)}, op: OPS[op], value: encode(value)}}));
    const structured = {
      from: [{collectionId: collection}],
      ...(select ? {select: {fields: select.map(f => ({fieldPath: fieldPath(f)}))}} : {}),
      ...(filters.length ? {where: filters.length === 1 ? filters[0] : {compositeFilter: {op: 'AND', filters}}} : {}),
      orderBy: orderBy.map(([field, dir = 'asc']) => ({field: {fieldPath: fieldPath(field)}, direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING'}))
    };
    const url = `${base}${parent ? `/${parent}` : ''}:runQuery`;
    const want = limit || max, out = [];
    let offsetCursor = null;
    while (out.length < want) {
      const page = Math.min(PAGE, want - out.length);
      const body = {structuredQuery: {...structured, limit: page, ...(offsetCursor ? {startAt: offsetCursor} : {})}, ...(transaction ? {transaction} : {})};
      const docs = (await call(url, body)).filter(r => r.document).map(r => r.document);
      out.push(...docs.map(toDoc));
      if (docs.length < page) break;
      // Cursor on the ordered fields plus the document name, so the next page starts after the last one.
      const last = docs.at(-1);
      if (!structured.orderBy.length) structured.orderBy.push({field: {fieldPath: '__name__'}, direction: 'ASCENDING'});
      const valueAt = path => path.split('.').reduce((v, part) => (v?.mapValue ? v.mapValue.fields?.[part] : v?.[part]), last.fields) || {nullValue: null};
      const values = structured.orderBy.map(o => (o.field.fieldPath === '__name__' ? {referenceValue: last.name} : valueAt(o.field.fieldPath)));
      if (structured.orderBy.at(-1).field.fieldPath !== '__name__') { structured.orderBy.push({field: {fieldPath: '__name__'}, direction: structured.orderBy.at(-1).direction}); values.push({referenceValue: last.name}); }
      offsetCursor = {values, before: false};
    }
    return out;
  }

  // Writes for commit: set (replace), update (merge the given fields; the document must exist unless upsert), create.
  function write(kind, path, data) {
    const {fields, mask, transforms} = plan(data);
    const w = {update: {name: name(path), fields: encodeFields(fields)}};
    if (kind === 'update' || kind === 'merge') w.updateMask = {fieldPaths: mask};
    if (kind === 'update') w.currentDocument = {exists: true};
    if (kind === 'create') w.currentDocument = {exists: false};
    if (transforms.length) w.updateTransforms = transforms;
    return w;
  }

  async function commit(writes, transaction) {
    return call(`${base}:commit`, {writes, ...(transaction ? {transaction} : {})});
  }

  // fn(tx) reads with tx.get/tx.query and queues writes with tx.set/update/merge/create/delete; retried when Firestore
  // aborts it because a document read changed.
  async function transaction(fn) {
    for (let attempt = 1; ; attempt++) {
      const {transaction: id} = await call(`${base}:beginTransaction`, {});
      const writes = [];
      const tx = {
        get: path => get(path, id), query: (collection, options = {}) => query(collection, {...options, transaction: id}),
        set: (path, data) => writes.push(write('set', path, data)), update: (path, data) => writes.push(write('update', path, data)),
        merge: (path, data) => writes.push(write('merge', path, data)), create: (path, data) => writes.push(write('create', path, data)),
        delete: path => writes.push({delete: name(path)})
      };
      try {
        const result = await fn(tx);
        await commit(writes, id);
        return result;
      } catch (error) {
        if (!writes.length || !error.aborted || attempt >= 5) { await call(`${base}:rollback`, {transaction: id}).catch(() => {}); throw error; }
      }
    }
  }

  return {
    get, query, commit, transaction, write,
    set: (path, data) => commit([write('set', path, data)]),
    update: (path, data) => commit([write('update', path, data)]),
    merge: (path, data) => commit([write('merge', path, data)]),
    async create(collection, data, id = autoId()) { await commit([write('create', `${collection}/${id}`, data)]); return id; },
    delete: path => commit([{delete: name(path)}])
  };
}

module.exports = {firestore, encode, encodeFields, decode, decodeFields, plan, fieldPath, autoId, SERVER_TIME, DELETE};
