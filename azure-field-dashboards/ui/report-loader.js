(function(global){
  'use strict';
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    return value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
  }
  function queryKey(path,input){
    const query={...input};delete query.refresh;
    if(query.filters){query.filters=Object.fromEntries(Object.entries(query.filters).filter(([,v])=>v!==''&&v!==undefined));if(!Object.keys(query.filters).length)delete query.filters;}
    for(const [key,value]of Object.entries({mode:'dashboard',page:1,sort:'newest',granularity:'auto',export:false,includeCancelled:false,query:'',orderKey:'',exception:'',missingFilter:''}))if(query[key]===value)delete query[key];
    for(const key of ['exceptions','missingFilters'])if(Array.isArray(query[key])){if(!query[key].length)delete query[key];else query[key]=[...query[key]].sort();}
    return path+':'+JSON.stringify(canonical(query));
  }
  function create({fetcher,now=Date.now,onStart=()=>{},onEnd=()=>{},freshMs=45000,maxAgeMs=300000,maxEntries=12,maxBytes=16*1024*1024}){
    const entries=new Map(),pending=new Map(),epochs=new Map();let bytes=0;
    const scope=(path,input)=>path+':'+(input.audience||'orders');
    function remove(key){const e=entries.get(key);if(e)bytes-=e.bytes;entries.delete(key);}
    function find(path,input){const key=queryKey(path,input),e=entries.get(key);if(e&&now()-e.at<maxAgeMs){entries.delete(key);entries.set(key,e);return e;}if(e)remove(key);return null;}
    function store(path,input,data){
      const key=queryKey(path,input),size=new TextEncoder().encode(JSON.stringify(data)).length;
      remove(key);if(size>maxBytes)return;
      while(entries.size&&(entries.size>=maxEntries||bytes+size>maxBytes))remove(entries.keys().next().value);
      entries.set(key,{data,bytes:size,at:now(),scope:scope(path,input)});bytes+=size;
    }
    async function read(path,input={}){
      const cacheable=!input.export&&(!input.mode||input.mode==='dashboard');
      const cached=cacheable&&find(path,input);
      if(cached&&!input.refresh&&now()-cached.at<freshMs)return cached.data;
      const key=queryKey(path,input)+(input.refresh?':refresh':''),group=scope(path,input);
      if(pending.has(key))return pending.get(key);
      if(input.refresh){epochs.set(group,(epochs.get(group)||0)+1);for(const [k,e]of entries)if(e.scope===group)remove(k);}
      const epoch=epochs.get(group)||0,finish=onStart(path,input);epochs.set(group,epoch);let error;
      const promise=Promise.resolve().then(()=>fetcher(path,input)).then(data=>{
        if(cacheable&&epoch===(epochs.get(group)||0)){
          store(path,input,data);
          if(path==='/api/orders'&&data.selection)store(path,data.selection,data);
        }
        return data;
      }).catch(e=>{error=e;throw e;}).finally(()=>{if(pending.get(key)===promise)pending.delete(key);onEnd(finish,error);});
      pending.set(key,promise);return promise;
    }
    return {read,peek:(path,input)=>find(path,input)?.data,fresh:(path,input)=>{const e=find(path,input);return !!e&&now()-e.at<freshMs;},clear(){entries.clear();bytes=0;for(const key of epochs.keys())epochs.set(key,epochs.get(key)+1);}};
  }
  const api={create,queryKey};if(typeof module==='object'&&module.exports)module.exports=api;else global.ReportLoader=api;
})(typeof window==='object'?window:globalThis);
