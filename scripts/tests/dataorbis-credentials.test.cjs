'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const source=fs.readFileSync(process.env.NEXUS_DATAORBIS_SOURCE||path.resolve(__dirname,'../../functions/index.js'),'utf8').replace(/\r\n/g,'\n');
const extract=name=>{const result=source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));assert.ok(result,name);return result[0];};
function fixture(existing=true,admin=true) {
  const writes=[];const key=crypto.randomBytes(32);
  const context={exports:{},Buffer,crypto,URL,retailerKey:{value:()=>key.toString('base64')},onCall:(opts,fn)=>fn,
    requireAdmin:()=>{if(!admin)throw Object.assign(new Error('Admin required'),{code:'permission-denied'});},
    text:(value)=>{assert.ok(value);return value;},optionalText:value=>value||'',slugify:value=>value,
    FieldValue:{delete:()=>({deleted:true}),serverTimestamp:()=>({serverTime:true})},
    HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}},
    db:{collection:name=>({doc:id=>({name,id,get:async()=>({exists:existing,data:()=>({updatedAt:'before'})})})}),
      batch:()=>({set:(ref,value,options)=>writes.push({ref,value,options}),commit:async()=>{}})}
  };
  vm.createContext(context);vm.runInContext(extract('encryptPassword')+'\n'+extract('decryptPassword'),context);
  const handler=source.match(/exports\.saveRetailer = onCall\(\{[^]*?\n\}\);/)?.[0];assert.ok(handler);vm.runInContext(handler,context);
  return {context,writes};
}
const request=password=>({auth:{uid:'synthetic-admin'},data:{id:'dataorbis-game-sales',name:'Game Sales (DataOrbis)',webAddress:'https://pyramid.dataorbis.com',username:'synthetic-user',password,extractionProfileId:''}});
test('existing credential API saves encrypted passwords separately and preserves procedure metadata',async()=>{
  const {context,writes}=fixture(false);await context.exports.saveRetailer(request('synthetic-only-password'));
  assert.equal(writes.length,2);const profile=writes.find(w=>w.ref.name==='retailers'),secret=writes.find(w=>w.ref.name==='retailerSecrets');
  assert.equal(profile.value.username,'synthetic-user');assert.equal(profile.value.webAddress,'https://pyramid.dataorbis.com');
  assert.equal(profile.value.password,undefined);assert.equal(profile.value.salesProcedure,undefined);assert.equal(profile.options.merge,true);
  assert.equal(secret.value.password,undefined);assert.equal(context.decryptPassword(secret.value),'synthetic-only-password');
  assert.ok(!JSON.stringify(writes).includes('synthetic-only-password'));
});
test('blank password retains the saved password while updating the connection',async()=>{
  const {context,writes}=fixture();await context.exports.saveRetailer(request(''));
  assert.equal(writes.length,1);assert.equal(writes[0].ref.name,'retailers');assert.equal(writes[0].options.merge,true);
});
test('new connections require a password and unauthorized callers cannot save',async()=>{
  const missing=fixture(false);await assert.rejects(missing.context.exports.saveRetailer(request('')),e=>e.code==='invalid-argument');assert.equal(missing.writes.length,0);
  const denied=fixture(true,false);await assert.rejects(denied.context.exports.saveRetailer(request('value')),e=>e.code==='permission-denied');assert.equal(denied.writes.length,0);
});

test('Wilmar and Espen saves encrypt into different profile-owned secret records',async()=>{
  const {context,writes}=fixture(false);
  const wilmar=request('synthetic-wilmar-password');
  wilmar.data.name='Wilmar - Game / Makro / Jumbo';wilmar.data.username='synthetic-wilmar-user';
  const espen=request('synthetic-espen-password');
  espen.data.id='dataorbis-makro-sales';espen.data.name='Espen - Game / Makro / Jumbo';espen.data.username='synthetic-espen-user';
  await context.exports.saveRetailer(wilmar);await context.exports.saveRetailer(espen);
  const secrets=writes.filter(w=>w.ref.name==='retailerSecrets');
  assert.equal(secrets.length,2);assert.notEqual(secrets[0].ref.id,secrets[1].ref.id);
  assert.equal(secrets[0].ref.id,wilmar.data.id);assert.equal(secrets[1].ref.id,espen.data.id);
  assert.equal(context.decryptPassword(secrets[0].value),'synthetic-wilmar-password');
  assert.equal(context.decryptPassword(secrets[1].value),'synthetic-espen-password');
  assert.equal(writes.filter(w=>w.ref.name==='retailers').every(w=>w.value.salesProcedure===undefined),true);
});
