'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {pages,readWithRetry} = require('../nexus-azure-inventory.cjs');

test('paginates metadata without dropping existing GET filters',async()=>{
  const calls=[];
  const result=await pages('https://example.test/items?versions=true','items',undefined,async(url,method)=>{
    calls.push({url:new URL(url),method});
    return calls.length===1 ? {items:[1],nextPageToken:'a b'} : {items:[2]};
  });
  assert.deepEqual(result,[1,2]);
  assert.equal(calls[1].url.searchParams.get('versions'),'true');
  assert.equal(calls[1].url.searchParams.get('pageToken'),'a b');
});
test('paginates read-only POST metadata without changing the original body',async()=>{
  const body={pageSize:1000}; const calls=[];
  const result=await pages('https://example.test/list','collectionIds',body,async(url,method,data)=>{
    calls.push(data); assert.equal(method,'POST');
    return calls.length===1 ? {collectionIds:['a'],nextPageToken:'next'} : {collectionIds:['b']};
  });
  assert.deepEqual(result,['a','b']); assert.equal(calls[1].pageToken,'next');
  assert.deepEqual(body,{pageSize:1000});
});
test('unreachable regions and repeated tokens cannot silently pass',async()=>{
  await assert.rejects(pages('https://example.test','items',undefined,async()=>({unreachable:['region']})),/unreachable/);
  await assert.rejects(pages('https://example.test','items',undefined,async()=>({nextPageToken:'again'})),/repeated/);
});
test('retries temporary metadata failures with a bound',async()=>{
  let attempts=0;
  const value=await readWithRetry('https://example.test','GET',undefined,async()=>{
    if(++attempts<3) throw new Error('GET 503: temporary');
    return {ok:true};
  },async()=>{});
  assert.equal(attempts,3); assert.equal(value.ok,true);
  attempts=0;
  await assert.rejects(readWithRetry('https://example.test','GET',undefined,async()=>{
    attempts++; throw new Error('fetch failed');
  },async()=>{}),/fetch failed/);
  assert.equal(attempts,4);
});
test('does not retry permission failures',async()=>{
  let attempts=0;
  await assert.rejects(readWithRetry('https://example.test','GET',undefined,async()=>{
    attempts++; throw new Error('GET 403: denied');
  },async()=>{}),/403/);
  assert.equal(attempts,1);
});
