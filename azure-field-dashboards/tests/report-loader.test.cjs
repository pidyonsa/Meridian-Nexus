'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create,queryKey}=require('../ui/report-loader.js');
test('query cache normalizes defaults and filter ordering without mixing distinct selections',()=>{
  assert.equal(queryKey('/api/orders',{filters:{client:'A',region:'Gauteng'},page:1}),queryKey('/api/orders',{page:1,sort:'newest',export:false,filters:{region:'Gauteng',client:'A',rep:''}}));
  assert.notEqual(queryKey('/api/attendance',{audience:'rep'}),queryKey('/api/attendance',{audience:'merchandiser'}));
  for(const input of [{start:'2026-09-01'},{filters:{client:'B'}},{page:2},{includeCancelled:true},{query:'foo'}])assert.notEqual(queryKey('/api/orders',input),queryKey('/api/orders',{}));
});
test('duplicate in-flight requests coalesce; fresh tabs reuse results and loader events balance',async()=>{
  let done,calls=0,started=0,ended=0;
  const c=create({fetcher:()=>{calls++;return new Promise(r=>done=r);},onStart:()=>++started,onEnd:()=>ended++});
  const a=c.read('/api/orders',{}),b=c.read('/api/orders',{page:1});await Promise.resolve();done({totals:{lines:3}});
  assert.deepEqual(await a,await b);await c.read('/api/orders',{});assert.equal(calls,1);assert.equal(started,1);assert.equal(ended,1);
});
test('stale matching data remains available while background revalidation fetches fresh data',async()=>{
  let time=0,calls=0;const c=create({now:()=>time,fetcher:async()=>({value:++calls})});
  await c.read('/api/attendance',{audience:'rep'});time=46000;
  assert.equal(c.peek('/api/attendance',{audience:'rep'}).value,1);assert.equal(c.fresh('/api/attendance',{audience:'rep'}),false);
  assert.equal((await c.read('/api/attendance',{audience:'rep'})).value,2);
  assert.equal(c.peek('/api/attendance',{audience:'merchandiser'}),undefined);time+=300001;assert.equal(c.peek('/api/attendance',{audience:'rep'}),undefined);
});
test('refresh bypasses cache, passes refresh upstream and prevents older requests refilling cache',async()=>{
  const pending=[];const c=create({fetcher:(path,input)=>new Promise(resolve=>pending.push({input,resolve}))});
  const first=c.read('/api/orders',{});await Promise.resolve();const fresh=c.read('/api/orders',{refresh:true});await Promise.resolve();
  assert.equal(pending[1].input.refresh,true);pending[1].resolve({value:2});await fresh;pending[0].resolve({value:1});await first;
  assert.equal(c.peek('/api/orders',{}).value,2);
});
test('exports and drilldowns bypass cache; failures retry; clear invalidates pending cache writes',async()=>{
  let calls=0;const c=create({fetcher:async()=>{calls++;return {value:calls};}});
  for(const input of [{export:true},{export:true},{mode:'detail'},{mode:'detail'}])await c.read('/api/attendance',input);
  assert.equal(calls,4);
  let fail=true;const errors=[],f=create({fetcher:async()=>{if(fail)throw Error('offline');return {};},onEnd:(id,error)=>errors.push(error?.message)});
  await assert.rejects(f.read('/api/orders',{}),/offline/);fail=false;await f.read('/api/orders',{});assert.deepEqual(errors,['offline',undefined]);
  let done;const p=create({fetcher:()=>new Promise(r=>done=r)}),read=p.read('/api/orders',{});await Promise.resolve();p.clear();done({value:1});await read;assert.equal(p.peek('/api/orders',{}),undefined);
});
test('cache bounds and explicit period aliases keep back navigation fast without sharing exports',async()=>{
  const c=create({maxEntries:2,fetcher:async(path,input)=>({selection:{...input,start:input.start||'2026-09-01',end:'2026-09-30',page:1,filters:input.filters||{}}})});
  const first=await c.read('/api/orders',{});assert.equal(c.peek('/api/orders',first.selection),first);
  await c.read('/api/orders',{filters:{client:'B'}});assert.equal(c.peek('/api/orders',{}),undefined);
});
