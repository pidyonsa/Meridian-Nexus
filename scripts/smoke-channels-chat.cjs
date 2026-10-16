const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const req=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp}=req('firebase-admin/app');
const {getAuth}=req('firebase-admin/auth');
const {json}=require('./release-multi-admin.cjs'),{save}=require('./release-channels-chat.cjs');
const {pipelineId}=require('../functions/etl-pipelines');
process.env.GOOGLE_CLOUD_QUOTA_PROJECT='meridain-nexus';
initializeApp({projectId:'meridain-nexus',credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const uid='workspace-check-'+crypto.randomUUID(),email=uid+'@example.invalid',password=crypto.randomBytes(36).toString('base64url');
const docs='https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents',auth=getAuth();
async function main(){
  const customer='Synthetic verification '+uid,id=pipelineId(customer,'clicks');
  let created=false,profile=false,setup=false;
  save('smoke-started.json',{uid,pipelineId:id,at:new Date().toISOString()});
  try{
    await auth.createUser({uid,email,password,displayName:'Temporary workspace verification'});created=true;
    await auth.setCustomUserClaims(uid,{admin:false,operator:true,nexusRole:'normal',chatClient:false});
    await json(`${docs}/adminUsers?documentId=${uid}`,'POST',{fields:{uid:{stringValue:uid},email:{stringValue:email},name:{stringValue:'Temporary workspace verification'},role:{stringValue:'normal'},accountType:{stringValue:'staff'},disabled:{booleanValue:false}}});profile=true;
    const config=await(await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json();
    const signIn=async()=>{const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(r.ok);return (await r.json()).idToken;};
    let token=await signIn();
    const call=async(name,data)=>{const r=await fetch(`https://us-central1-meridain-nexus.cloudfunctions.net/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(180000)});const body=await r.json();if(!r.ok || body.error)throw Object.assign(new Error(body.error?.message || 'Callable failed'),{status:body.error?.status});return body.result;};
    const initial=await call('meridianChat',{action:'bootstrap',expectedUid:uid});
    assert.equal(initial.actor.capabilities.createGroups,true);assert.equal(initial.actor.capabilities.assignTasks,true);assert.equal(initial.actor.capabilities.moderateMessages,false);
    await json(`${docs}/adminUsers/${uid}?updateMask.fieldPaths=chatAccess`,'PATCH',{fields:{chatAccess:{mapValue:{fields:{createGroups:{booleanValue:false},assignTasks:{booleanValue:false}}}}}});
    const restricted=await call('meridianChat',{action:'bootstrap',expectedUid:uid});assert.equal(restricted.actor.capabilities.createGroups,false);assert.equal(restricted.actor.capabilities.assignTasks,false);
    await assert.rejects(call('meridianEtl',{action:'catalogue'}),{status:'PERMISSION_DENIED'});
    await json(`${docs}/adminUsers/${uid}?updateMask.fieldPaths=role`,'PATCH',{fields:{role:{stringValue:'admin'}}});
    await auth.setCustomUserClaims(uid,{admin:true,operator:true,nexusRole:'admin',chatClient:false});token=await signIn();
    const catalogue=await call('meridianEtl',{action:'catalogue'});assert.ok(catalogue.pipelines.length>=10);assert.deepEqual(catalogue.pipelines.filter(p=>p.runnable).map(p=>p.id),['anchor-pnp-v1']);
    const sharedBefore=await json(`${docs}/etlReferenceSets/anchor-pnp-v1`);
    const result=await call('meridianEtl',{action:'savePipeline',customer,channelId:'clicks',reportName:'Verification-only sample',resources:{},notes:'Temporary synthetic test. No business processing.',revision:0});setup=true;
    assert.equal(result.pipeline.id,id);assert.equal(result.pipeline.runnable,false);assert.equal(result.pipeline.status,'files-required');
    await assert.rejects(call('meridianEtl',{action:'run',pipelineId:id,resources:{},rules:{}}),{status:'FAILED_PRECONDITION'});
    await assert.rejects(call('meridianEtl',{action:'savePipeline',id,customer,channelId:'clicks',reportName:'Stale update',resources:{},revision:0}),{status:'ABORTED'});
    assert.deepEqual(await json(`${docs}/etlReferenceSets/anchor-pnp-v1`),sharedBefore);
    save('smoke-verified.json',{at:new Date().toISOString(),staffDefaults:true,explicitOptOutPreserved:true,moderationNotGranted:true,staffEtlDenied:true,multiChannelCatalogue:true,setupSaved:true,unvalidatedRunBlocked:true,staleSetupBlocked:true,sharedReferencesUnchanged:true,noBusinessRunsStarted:true});
    console.log('PASS: live staff defaults and opt-outs, Admin-only ETL catalogue, isolated setup save, revision conflict and unsupported-transformer rejection. No business runs started.');
  }finally{
    const failures=[];
    if(created)try{await auth.deleteUser(uid);}catch(e){failures.push(e.message);}
    const paths=[];if(profile)paths.push('adminUsers/'+uid);if(setup)paths.push('etlPipelineSetups/'+id);
    if(paths.length)try{await json(`${docs}:commit`,'POST',{writes:paths.map(p=>({delete:'projects/meridain-nexus/databases/(default)/documents/'+p}))});}catch(e){failures.push(e.message);}
    save('smoke-cleanup.json',{uid,pipelineId:id,at:new Date().toISOString(),failures,auditRetained:true});assert.deepEqual(failures,[]);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
