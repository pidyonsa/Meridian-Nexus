const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {resourceStorageError}=require('../../functions/resource-storage-error');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
test('Storage error mapping distinguishes missing objects, denied runtime access and temporary failures',()=>{
  for(const [code,expected] of [[404,'not-found'],[403,'failed-precondition'],[7,'failed-precondition'],[503,'unavailable'],[429,'unavailable'],[999,'internal']]){
    const result=resourceStorageError({code,message:'PRIVATE provider body'},HttpsError,'test workbook');assert.equal(result.code,expected);assert.equal(result.message.includes('PRIVATE'),false);
  }
  const denied=new HttpsError('permission-denied','Actor access denied');assert.equal(resourceStorageError(denied,HttpsError),denied);
});
test('savePortalResource does not turn denied Storage access into a missing-file 404',async()=>{
  const source=fs.readFileSync('functions/index.js','utf8').match(/exports\.savePortalResource = onCall\([^]*?\n\}\);/)[0];
  for(const [code,expected] of [[403,'failed-precondition'],[404,'not-found'],[503,'unavailable']]){
    let writes=0;
    const context={exports:{},onCall:fn=>fn,HttpsError,requireAdmin(){},requestActor:()=>({uid:'synthetic'}),optionalText:v=>v||'',text:v=>v,portalResourceCategory:v=>v,portalResourceTags:()=>[],portalResourceStoragePath:(_,v)=>v,require:()=>({resourceStorageError}),db:{collection:()=>({doc:()=>({get:async()=>({exists:false}),set:async()=>{writes++;}})})},getStorage:()=>({bucket:()=>({file:()=>({getMetadata:async()=>{throw Object.assign(new Error('private storage path'),{code});}})})})};
    vm.runInNewContext(source,context);
    await assert.rejects(context.exports.savePortalResource({data:{id:'synthetic-resource',title:'Test',sourceName:'Test.xlsx',storagePath:'portal-resources/synthetic-resource/Test.xlsx'}}),{code:expected});assert.equal(writes,0);
  }
});
