const test=require('node:test'),assert=require('node:assert/strict');
const {isAdminProfile,assertActiveAdmin,guardCallables}=require('../../functions/admin-access');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const profile={role:'admin',email:'manager@example.test',accountType:'staff'};
const request={auth:{uid:'manager',token:{admin:true,auth_time:100}}};
const deps=(p=profile,account={customClaims:{admin:true}})=>({db:{collection:()=>({doc:()=>({get:async()=>({data:()=>p})})})},getAuth:()=>({getUser:async()=>account}),HttpsError});
test('full Admin is role based, not tied to an email address',async()=>{assert.equal(isAdminProfile(profile),true);assert.equal(await assertActiveAdmin(deps(),request),profile);});
test('current profile, Auth grant, session and staff status are all required',async()=>{
 for(const [p,a] of [[{...profile,role:'normal'},{customClaims:{admin:true}}],[{...profile,disabled:true},{customClaims:{admin:true}}],[{...profile,accountType:'client'},{customClaims:{admin:true}}],[{...profile,chatAccess:{workRole:'Client'}},{customClaims:{admin:true}}],[profile,{disabled:true,customClaims:{admin:true}}],[profile,{customClaims:{admin:false}}],[profile,{tokensValidAfterTime:new Date(101000).toISOString(),customClaims:{admin:true}}]])await assert.rejects(assertActiveAdmin(deps(p,a),request),{code:'permission-denied'});
 await assert.rejects(assertActiveAdmin(deps(),{auth:{uid:'manager',token:{admin:true,chatClient:true}}}),{code:'permission-denied'});
});
test('callable wrapper preserves ordinary calls and rejects stale administrator tokens before handler',async()=>{
 let called=0;const d=deps({...profile,role:'normal'});const onCall=guardCallables((...args)=>args.at(-1),{...d,db:()=>d.db});
 const handler=onCall({memory:'256MiB'},async(req,response)=>{called++;return response;});
 assert.equal(await handler({auth:{uid:'staff',token:{operator:true}}},'response'),'response');
 await assert.rejects(handler(request),{code:'permission-denied'});assert.equal(called,1);
});
