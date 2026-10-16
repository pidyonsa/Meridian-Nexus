'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCache,canonical}=require('../backend/report-cache.cjs');
test('cached report promises coalesce, expire from completion, and honor force refresh',async()=>{
  let time=0,calls=0,done;const c=createCache({now:()=>time});
  const loader=()=>{calls++;return new Promise(r=>done=r);};
  const a=c.get('key',loader),b=c.get('key',loader);await Promise.resolve();time=90000;done({version:1});await a;await b;
  assert.equal((await c.get('key',loader)).version,1);assert.equal(calls,1);
  assert.equal((await c.get('key',async()=>({version:2}),{force:true})).version,2);
  time+=60001;assert.equal((await c.get('key',async()=>({version:3}))).version,3);
});
test('cache bounds, failed loads and canonical filters are safe',async()=>{
  const c=createCache({maxEntries:1,maxBytes:100});await assert.rejects(c.get('a',async()=>{throw Error('retry');}));
  await c.get('a',async()=>({ok:true}));await c.get('b',async()=>({ok:true}));let reload=0;await c.get('a',async()=>{reload++;return {};});assert.equal(reload,1);
  let large=0;for(let i=0;i<2;i++)await c.get('big',async()=>{large++;return 'x'.repeat(101);});assert.equal(large,2);
  assert.deepEqual(canonical({b:2,a:{d:4,c:3}}),{a:{c:3,d:4},b:2});
});
