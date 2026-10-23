'use strict';
// Firestore REST reads: paged runQuery with cursors (never offsets, which bill skipped documents), and conversion
// of Firestore typed values to plain JSON.

const PAGE = 500;

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

function client({project = 'meridain-nexus', token, fetchImpl = fetch}) {
  const root = `projects/${project}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${root}:runQuery`;
  let reads = 0;

  async function runQuery(structuredQuery) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchImpl(url, {method: 'POST', headers: {Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json'}, body: JSON.stringify({structuredQuery})});
      if (res.ok) return (await res.json()).filter(r => r.document).map(r => r.document);
      if (attempt < 4 && [429, 500, 502, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, attempt * 2000)); continue; }
      throw new Error(`Firestore runQuery ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }

  // Yields pages of {path, updateTime, data}. `after` = {field, value}: only documents with field > value.
  async function* scan({collection, group = false, after = null}) {
    const orderBy = [...(after ? [{field: {fieldPath: after.field}, direction: 'ASCENDING'}] : []), {field: {fieldPath: '__name__'}, direction: 'ASCENDING'}];
    const where = after ? {fieldFilter: {field: {fieldPath: after.field}, op: 'GREATER_THAN', value: {timestampValue: after.value}}} : undefined;
    let cursor = null;
    for (;;) {
      const docs = await runQuery({from: [{collectionId: collection, allDescendants: group}], where, orderBy, limit: PAGE, ...(cursor ? {startAt: {values: cursor, before: false}} : {})});
      reads += docs.length;
      if (!docs.length) return;
      yield docs.map(d => ({path: d.name.slice(root.length + 1), updateTime: d.updateTime, data: decodeFields(d.fields)}));
      if (docs.length < PAGE) return;
      const last = docs.at(-1);
      cursor = [...(after ? [last.fields?.[after.field] || {nullValue: null}] : []), {referenceValue: last.name}];
    }
  }

  return {scan, reads: () => reads};
}

module.exports = {client, decode, decodeFields, PAGE};
