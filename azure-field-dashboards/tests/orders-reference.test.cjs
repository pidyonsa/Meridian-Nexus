'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../ui/orders-reference.js');const R=globalThis.FranchiseReference;
test('reference trace uses supplied Geo geometry unchanged and never smooths across missing values',()=>{
  const points=[{x:12,y:50},{x:32,y:10},{x:52,y:null},{x:72,y:40},{x:92,y:0}],before=structuredClone(points);
  const html=R.trace({points},'amount',false);
  assert.match(html,/d="M12\.000 50\.000 L32\.000 10\.000 M72\.000 40\.000 L92\.000 0\.000"/);
  assert.deepEqual(points,before);assert.doesNotMatch(html,/NaN|undefined|Infinity|<foreignObject|\{\{/);
  assert.equal((html.match(/<circle/g)||[]).length,4);assert.match(html,/pointer-events="none"/);
});
test('single-point, empty, negative and zero plots do not fabricate history',()=>{
  assert.equal(R.trace({points:[]},'amount',true),'');
  assert.equal(R.trace({points:[{x:NaN,y:40}]},'units',false),'');
  assert.match(R.trace({points:[{x:12,y:30}]},'amount',true),/d="M12\.000 30\.000"/);
  assert.match(R.trace({points:[{x:-1,y:0},{x:0,y:20}]},'units',false),/stroke="#5b9bd5"/);
});
test('styling adapter preserves the original Geo numeric helpers and tab inventory',()=>{
  const load=file=>{const scope={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),scope);return scope.window.FranchiseOrders;};
  const original=load('../firebase-dashboards/dist/orders.js'),adapted=load('public/orders.js');
  assert.deepEqual(Object.keys(adapted.pages),Object.keys(original.pages));
  for(const name of ['csvCell','periodRange','ranked','share','chartGeometry'])assert.equal(adapted[name].toString(),original[name].toString());
  assert.deepEqual(Object.keys(R.labels),Object.keys(adapted.pages));
});
