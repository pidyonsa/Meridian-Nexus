const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPipelineRegistry,defaults,pipelineId}=require('../../functions/etl-pipelines');
function fixture(){
  const records=new Map(),calls=[];let nonce=0;
  const doc=key=>({key,get:async()=>({exists:records.has(key),data:()=>records.get(key)})});
  const db={
    collection:name=>({
      doc:id=>doc(`${name}/${id || ++nonce}`),
      limit:()=>({get:async()=>({docs:[...records].filter(([k])=>k.startsWith(name+'/')).map(([k,v])=>({id:k.split('/')[1],data:()=>v}))})})
    }),
    runTransaction:async fn=>{
      const writes=[];await fn({get:r=>r.get(),set:(r,v)=>writes.push([r.key,v]),create:(r,v)=>writes.push([r.key,v])});for(const [k,v] of writes)records.set(k,v);
    }
  };
  const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
  const resourceInput=async(role,id)=>{calls.push(role);const r=records.get('portalResources/'+id);if(!r || r.active===false)fail('failed-precondition','Resource unavailable');return {resourceId:id,sourcePath:r.storagePath,name:r.sourceName};};
  for(const id of ['raw','expected'])records.set('portalResources/'+id,{active:true,sourceName:id+'.xlsx',storagePath:'portal-resources/'+id+'/source.xlsx'});
  return {registry:createPipelineRegistry({db,fail,resourceInput,authorise:async()=>{calls.push('auth');}}),records,calls};
}
const input={customer:'Anchor',channelId:'clicks',reportName:'Inventory export',revision:0,resources:{raw:'raw',expected:'expected'},notes:'Join by article and store'};
test('all source clients inherit shared files; only validated raw formats are runnable',async()=>{
  const f=fixture(),list=await f.registry.list();assert.equal(list.length,24);assert.equal(list.filter(p=>p.runnable).length,11);assert.equal(list.find(p=>p.channelId==='clicks'&&p.customer==='Anchor').status,'mapping-required');
  assert.ok(list.every(p=>p.resourceMode==='shared' && p.referenceRoles.includes(p.kind==='Sales'?'salesSample':'inventorySample')));
  assert.ok(list.filter(p=>p.runnable).every(p=>p.rawInputs.length && p.transformerVersion));
  assert.ok(list.find(p=>p.customer==='Universal Paper').referenceRoles.includes('gln'));
  assert.equal(new Set(list.map(p=>p.customer)).size,8);
  assert.equal(new Set(list.map(p=>p.id)).size,list.length);
  assert.equal(list.filter(p=>p.kind==='Sales').length,9);
  assert.equal(list.some(p=>/Wilmar|Espen/.test(p.customer)),false,'Portal jobs must not be offered as inventory transformations');
});
test('setup persists separate customer/channel resources with revision and audit, never enables execution',async()=>{
  const f=fixture(),p=await f.registry.save({...input,runnable:true,status:'available',transformerVersion:'anchor-pnp-v1'},{},{uid:'admin'});
  assert.equal(p.status,'mapping-required');assert.equal(p.runnable,false);assert.equal(p.transformerVersion,null);assert.equal(p.revision,1);assert.equal(f.records.has('etlReferenceSets/anchor-pnp-v1'),false);
  assert.equal([...f.records.keys()].filter(k=>k.startsWith('etlPipelineSetupAudit/')).length,1);
  const second=await f.registry.save({...input,customer:'Another customer'},{},{uid:'admin'});assert.notEqual(second.id,p.id);
  assert.equal((await f.registry.list()).length,25);await assert.rejects(f.registry.save(input,{},{}),{code:'aborted'});
});
test('invalid setup, identity edits, missing files and PnP replacement are rejected without writes',async()=>{
  for(const data of [{...input,channelId:'../other'},{...input,customer:''},{...input,id:'someone-else'},{...input,revision:-1},{...input,resources:{raw:'missing'}},{...input,resources:{raw:'raw',expected:'raw'}},{...input,resources:{unknown:'raw'}},{...input,channelId:'pnp'}]){
    const f=fixture();await assert.rejects(f.registry.save(data,{},{}));assert.equal([...f.records.keys()].some(k=>k.startsWith('etlPipeline')),false);
  }
  assert.equal(pipelineId('ANCHOR','clicks'),pipelineId('Anchor','clicks'));
});
test('unvalidated raw formats remain blocked but inherit shared references without individual assignments',async()=>{
  const f=fixture(),p=await f.registry.save({...input,resources:{raw:'raw'}},{},{});assert.equal(p.status,'mapping-required');assert.equal(p.runnable,false);assert.ok(f.calls.includes('auth'));assert.equal(p.resourceMode,'shared');
});
test('sales and inventory configurations are distinct, preserve source type, and cannot enable an unvalidated adapter',async()=>{
  const f=fixture();
  const inventory=await f.registry.save({...input,customer:'Ethica',kind:'Inventory'},{},{});
  const sales=await f.registry.save({...input,customer:'Ethica',kind:'Sales',runnable:true},{},{});
  assert.notEqual(inventory.id,sales.id);assert.equal(sales.kind,'Sales');assert.equal(sales.runnable,true);assert.equal(inventory.runnable,true);
  assert.deepEqual(inventory.rawInputs.map(s=>s.role),['raw','dcStock','periodSales']);
  assert.equal((await f.registry.list()).find(p=>p.id===sales.id).revision,1);
  await assert.rejects(f.registry.save({...input,kind:'Anything'},{},{}),{code:'invalid-argument'});
  await assert.rejects(f.registry.save({...input,kind:'Sales',id:inventory.id},{},{}),{code:'invalid-argument'});
});
test('new PnP customers can use the validated adapter without duplicating reference assignments',async()=>{
  const f=fixture(),p=await f.registry.save({...input,customer:'New client',channelId:'pnp',resources:{}},{},{});
  assert.equal(p.runnable,true);assert.equal(p.transformerVersion,'pnp-inventory-v2');assert.deepEqual(p.resources,{});
  assert.deepEqual(await f.registry.get(p.id),p);assert.equal(await f.registry.get('../arbitrary'),null);
});
