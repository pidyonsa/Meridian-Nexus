'use strict';
const crypto = require('node:crypto');
const {AppError} = require('./errors.cjs');
const MAX_ROWS = 100000;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function chunks(rows) {
  const output = []; let batch = [], bytes = 0;
  for (const row of rows) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (size > 150000) throw new AppError('resource-exhausted', 'A source row is too large.');
    if (batch.length && bytes + size > 180000) { output.push(batch); batch = []; bytes = 0; }
    batch.push(row); bytes += size;
  }
  if (batch.length) output.push(batch);
  return output;
}
class MemoryStore {
  constructor() { this.data = new Map(); }
  async list(dataset) { return [...this.data.values()].filter(s=>s.dataset===dataset).map(({rows,...meta})=>meta).sort((a,b)=>b.period.localeCompare(a.period)); }
  async read(dataset, period) { return this.data.get(`${dataset}/${period}`) || null; }
  async publish(dataset, period, rows, metadata = {}) {
    if (!rows.length || rows.length > MAX_ROWS) throw new AppError('invalid-argument','Import must contain 1 to 100,000 rows.');
    const version=digest({rows,metadata}); const snapshot={dataset,period,rows,metadata,version,updatedAt:new Date().toISOString(),count:rows.length};
    this.data.set(`${dataset}/${period}`,snapshot); return snapshot;
  }
}
class AzureStore {
  constructor(env = process.env) {
    if (!env.COSMOS_ENDPOINT || !env.STORAGE_ACCOUNT_URL) throw new AppError('unavailable', 'Azure data services are not configured.');
    const {CosmosClient} = require('@azure/cosmos'), {DefaultAzureCredential} = require('@azure/identity'), {BlobServiceClient} = require('@azure/storage-blob');
    const credential = new DefaultAzureCredential();
    this.container = new CosmosClient({endpoint:env.COSMOS_ENDPOINT,aadCredentials:credential}).database(env.COSMOS_DATABASE || 'nexus').container(env.COSMOS_CONTAINER || 'snapshots');
    this.blobs = new BlobServiceClient(env.STORAGE_ACCOUNT_URL,credential).getContainerClient(env.STORAGE_CONTAINER || 'sources');
    this.cache = new Map();
  }
  async list(dataset) {
    const {resources} = await this.container.items.query({query:'SELECT c.id,c.dataset,c.period,c.version,c.metadata,c.count,c.updatedAt FROM c WHERE c.kind = @kind ORDER BY c.period DESC',parameters:[{name:'@kind',value:'manifest'}]}, {partitionKey:dataset,maxItemCount:100}).fetchAll();
    return resources;
  }
  async read(dataset, period) {
    let resource;
    try { ({resource} = await this.container.item(`current-${period}`,dataset).read()); } catch (e) { if (e.code===404) return null; throw e; }
    if (!resource) return null;
    const key=`${dataset}/${period}/${resource.version}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const rows=[];
    for (let i=0;i<resource.chunks;i++) {
      const {resource:part} = await this.container.item(`${period}-${resource.version}-${i}`,dataset).read();
      if (!part) throw new AppError('unavailable','The published dataset is incomplete. Contact support.');
      rows.push(...part.rows);
    }
    if (rows.length !== resource.count) throw new AppError('unavailable','Dataset verification failed.');
    while (this.cache.size>=8) this.cache.delete(this.cache.keys().next().value);
    const snapshot={...resource,rows}; this.cache.set(key,snapshot); return snapshot;
  }
  async publish(dataset, period, rows, metadata = {}) {
    if (!/^[a-z-]+$/.test(dataset) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new AppError('invalid-argument','Invalid dataset or month.');
    if (!rows.length || rows.length>MAX_ROWS) throw new AppError('invalid-argument','Import must contain 1 to 100,000 rows.');
    if (Buffer.byteLength(JSON.stringify(metadata))>500000) throw new AppError('resource-exhausted','Source metadata exceeds the supported size. Existing data is unchanged.');
    const version=crypto.randomUUID(), parts=chunks(rows), updatedAt=new Date().toISOString();
    let previous;
    try { ({resource:previous}=await this.container.item(`current-${period}`,dataset).read()); } catch(e) { if(e.code!==404) throw e; }
    // Immutable rows and a private archive are durable before the atomic manifest switch.
    await this.blobs.getBlockBlobClient(`archive/${dataset}/${period}/${version}.json`).uploadData(Buffer.from(JSON.stringify({rows,metadata})), {conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:'application/json'}});
    for (let i=0;i<parts.length;i++) await this.container.items.create({id:`${period}-${version}-${i}`,dataset,kind:'chunk',rows:parts[i]});
    const manifest={id:`current-${period}`,dataset,kind:'manifest',period,version,chunks:parts.length,count:rows.length,metadata,updatedAt};
    if (previous) await this.container.item(manifest.id,dataset).replace(manifest,{accessCondition:{type:'IfMatch',condition:previous._etag}});
    else await this.container.items.create(manifest);
    this.cache.clear(); return manifest;
  }
}
module.exports = {AzureStore,MemoryStore,chunks,MAX_ROWS};
