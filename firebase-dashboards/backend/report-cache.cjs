'use strict';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])])) : value;
}
function createCache({maxEntries=24,maxBytes=32*1024*1024,now=Date.now}={}) {
  const entries = new Map(); let bytes = 0;
  function remove(key) { const entry=entries.get(key); if(entry)bytes-=entry.bytes; entries.delete(key); }
  async function get(key, load, {ttl=60000,force=false}={}) {
    for(const [k,e] of entries) if(e.until <= now())remove(k);
    if(force)remove(key);
    if(entries.has(key)){const e=entries.get(key);entries.delete(key);entries.set(key,e);return e.promise;}
    while(entries.size>=maxEntries)remove(entries.keys().next().value);
    const entry={bytes:0,until:Infinity};
    entry.promise=Promise.resolve().then(load).then(value=>{
      if(entries.get(key)!==entry)return value;
      const size=Buffer.byteLength(JSON.stringify(value));
      if(size>maxBytes){remove(key);return value;}
      entry.bytes=size;entry.until=now()+ttl;bytes+=size;
      while(bytes>maxBytes)remove(entries.keys().next().value);
      return value;
    },error=>{if(entries.get(key)===entry)remove(key);throw error;});
    entries.set(key,entry);return entry.promise;
  }
  return {get};
}
module.exports={canonical,createCache};
