'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHandler}=require('../backend/handler.cjs');
const {filters,safeSource}=require('../backend/service.cjs');
const {HttpsError}=require('node:module').createRequire(path.join(__dirname,'../backend/package.json'))('firebase-functions/v2/https');
function response(){return {statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;}};}
test('public viewer permits exactly the two read routes, not source files or administration',async()=>{
  const called=[];const handler=createHandler({attendance:async input=>(called.push(input),{metrics:{scheduled:10}}),orders:async()=>({totals:{orders:2}})},{enabled:()=>true});
  for(const route of ['/api/import/attendance','/api/sources','/api/admin','/api/chat','/api/files','/api/attendance/../../admin']){const res=response();await handler({path:route,method:'POST',body:{}},res);assert.equal(res.statusCode,404);}
  for(const method of ['PUT','PATCH','DELETE','GET']){const res=response();await handler({path:'/api/attendance',method,body:{}},res);assert.equal(res.statusCode,405);}
  const res=response();await handler({path:'/api/attendance',method:'POST',body:{},ip:'test'},res);assert.equal(res.statusCode,200);assert.equal(called.length,1);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('public kill switch defaults closed; malformed payloads cannot reach service',async()=>{
  const disabled=createHandler({}, {enabled:()=>false}),res=response();await disabled({path:'/api/orders',method:'POST',body:{}},res);assert.equal(res.statusCode,503);
  const handler=createHandler({}, {enabled:()=>true});
  for(const body of [null,[],123,'text',{query:'x'.repeat(33000)}]){const r=response();await handler({path:'/api/orders',method:'POST',body},r);assert.equal(r.statusCode,400);}
});
test('errors do not leak storage URLs, secrets or stack traces',async()=>{
  const handler=createHandler({orders:async()=>{throw Error('secret https://private-source/example');}},{enabled:()=>true});
  const res=response();await handler({path:'/api/orders',method:'POST',body:{}},res);assert.equal(res.statusCode,500);assert.ok(!JSON.stringify(res.body).includes('secret'));
});
test('bounded requests and per-instance request throttling',async()=>{
  const handler=createHandler({orders:async()=>({})},{enabled:()=>true,now:()=>1});
  let res;for(let i=0;i<91;i++){res=response();await handler({path:'/api/orders',method:'POST',body:{},ip:'same'},res);}assert.equal(res.statusCode,429);
});
test('attendance source metadata excludes raw file links and internal tracker data',()=>{
  const result=safeSource({reportEndDate:'2026-09-13',tracker:{webUrl:'private'},source:{schedules:{fileId:'private'}},updatedByRunId:'private',updatedAt:{toDate:()=>new Date('2026-09-14T08:00:00Z')}});
  assert.equal(result.updatedAt,'2026-09-14T08:00:00.000Z');assert.ok(!JSON.stringify(result).includes('private'));
  assert.throws(()=>filters({fileId:'private'},HttpsError));assert.throws(()=>filters({manager:[]},HttpsError));
});
test('reused attendance calculations count early and caught-up visits positively',()=>{
  const A=require('../backend/vendor/attendance.cjs');
  for(const result of ['Visited','Early visit on: 2026-09-10','Caught up on: 2026-09-13'])assert.equal(A.resultStatus(result),'visited');
  assert.equal(A.resultStatus('Not Visited'),'missed');assert.equal(A.division('Free State'),'CENTRAL');assert.equal(A.division('North West'),'CENTRAL');
});
test('deployment contains only the new site/function and no original rules or hosting target',()=>{
  const config=require('../firebase.json');assert.equal(config.hosting.site,'meridian-field-dashboards');assert.equal(config.functions[0].codebase,'public-dashboard-viewer');assert.ok(!config.firestore&&!config.storage);
  const manifest=require('../PORT_MANIFEST.json');assert.ok(manifest.files.every(f=>!f.target.includes('fixtures')));
  const index=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');assert.ok(!/firebase-auth|sign.in|Data imports|sample data|iframe/i.test(index));
  assert.equal(config.hosting.rewrites.filter(r=>r.function).length,1);
});
