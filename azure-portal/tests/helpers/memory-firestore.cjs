'use strict';
// In-memory stand-ins for the Firestore and Storage clients (server/google), for service tests.
const {SERVER_TIME, DELETE} = require('../../server/google/firestore.cjs');

const NOW = '2026-10-25T10:00:00.000Z';
// In-memory Firestore with the client's surface: get, query (== and in), write/commit, transaction.
function memoryFirestore(seed = {}) {
  const docs = new Map(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  const value = v => (v === SERVER_TIME ? NOW : v);
  function apply(w) {
    if (w.kind === 'delete') { docs.delete(w.path); return; }
    const exists = docs.has(w.path);
    if (w.kind === 'create' && exists) throw Object.assign(new Error('ALREADY_EXISTS'), {precondition: true});
    if (w.kind === 'update' && !exists) throw Object.assign(new Error('NOT_FOUND'), {precondition: true});
    const target = w.kind === 'set' || w.kind === 'create' ? {} : structuredClone(docs.get(w.path) || {});
    for (const [key, v] of Object.entries(w.data)) {
      const parts = key.split('.');
      let o = target;
      for (const p of parts.slice(0, -1)) o = (o[p] ||= {});
      const last = parts.at(-1);
      if (v === DELETE) delete o[last];
      else if (v && typeof v === 'object' && '$arrayUnion' in v) o[last] = [...(o[last] || []), ...v.$arrayUnion];
      else if (v && typeof v === 'object' && '$increment' in v) o[last] = (o[last] || 0) + v.$increment;
      else o[last] = value(v);
    }
    docs.set(w.path, target);
  }
  const doc = path => (docs.has(path) ? {id: path.split('/').pop(), path, data: structuredClone(docs.get(path))} : null);
  async function query(collection, {where = [], limit = 0, parent = ''} = {}) {
    const prefix = parent ? `${parent}/${collection}/` : `${collection}/`, depth = prefix.split('/').length;
    let out = [...docs.keys()].filter(p => p.split('/').length === depth && p.startsWith(prefix)).map(doc);
    for (const [field, op, v] of where) out = out.filter(d => (op === 'in' ? v.includes(d.data[field]) : d.data[field] === v));
    return limit ? out.slice(0, limit) : out;
  }
  const write = (kind, path, data) => ({kind, path, data});
  const fs = {
    docs, write, query, get: async path => doc(path),
    commit: async writes => { for (const w of writes) apply(w); },
    update: async (p, d) => apply(write('update', p, d)), set: async (p, d) => apply(write('set', p, d)), merge: async (p, d) => apply(write('merge', p, d)),
    async transaction(fn) {
      const queued = [];
      const tx = {get: async p => doc(p), query, merge: (p, d) => queued.push(write('merge', p, d)), create: (p, d) => queued.push(write('create', p, d)), update: (p, d) => queued.push(write('update', p, d)), set: (p, d) => queued.push(write('set', p, d))};
      const result = await fn(tx);
      for (const w of queued) apply(w);
      return result;
    }
  };
  return fs;
}

// In-memory Storage: objects with generations; ifGenerationMatch: 0 refuses to overwrite.
function memoryStorage(seed = {}) {
  const objects = new Map(Object.entries(seed).map(([path, data]) => [path, {data: Buffer.from(data), generation: '1', contentType: 'application/octet-stream', metadata: {}}]));
  let generation = 100;
  const meta = (path, o) => ({name: path, size: String(o.data.length), generation: o.generation, contentType: o.contentType, metadata: o.metadata});
  return {
    objects,
    async metadata(path) { const o = objects.get(path); return o ? meta(path, o) : null; },
    async download(path) { const o = objects.get(path); return o ? {body: new Blob([o.data]).stream(), type: o.contentType, size: o.data.length} : null; },
    async upload(path, data, {type = 'application/octet-stream', metadata = {}, ifGenerationMatch} = {}) {
      if (ifGenerationMatch === 0 && objects.has(path)) throw new Error('Storage 412: precondition failed');
      const o = {data: Buffer.from(data), generation: String(++generation), contentType: type, metadata};
      objects.set(path, o); return meta(path, o);
    },
    async copy(from, to, {sourceGeneration, ifGenerationMatch, metadata = {}} = {}) {
      const o = objects.get(from);
      if (!o || (sourceGeneration && o.generation !== String(sourceGeneration))) throw new Error('Storage 404: source generation not found');
      if (ifGenerationMatch === 0 && objects.has(to)) throw new Error('Storage 412: precondition failed');
      const copy = {data: o.data, generation: String(++generation), contentType: o.contentType, metadata};
      objects.set(to, copy); return meta(to, copy);
    },
    async remove(path) { objects.delete(path); }
  };
}

module.exports = {memoryFirestore, memoryStorage, NOW};
