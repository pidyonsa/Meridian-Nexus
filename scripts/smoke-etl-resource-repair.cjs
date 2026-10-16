const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const {execFileSync}=require('node:child_process'),sdk=require('node:module').createRequire(path.resolve('functions/package.json'));
const {initializeApp}=sdk('firebase-admin/app'),{getAuth}=sdk('firebase-admin/auth');
const {json,api}=require('./release-multi-admin.cjs'),{bucket,save}=require('./repair-etl-resources.cjs');
process.env.GOOGLE_CLOUD_QUOTA_PROJECT='meridain-nexus';
initializeApp({projectId:'meridain-nexus',credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const auth=getAuth(),uid='etl-check-'+crypto.randomUUID(),resourceId='resource-'+crypto.randomUUID();
const database='projects/meridain-nexus/databases/(default)/documents',docs='https://firestore.googleapis.com/v1/'+database;
const encode=v=>typeof v==='boolean'?{booleanValue:v}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,value])=>[k,encode(value)]))}};
const objectPath=`portal-resources/${resourceId}/synthetic-verification.xlsx`;
async function main(){
  let created=false,uploaded=false;
  save('smoke-started.json',{at:new Date().toISOString(),uid,resourceId,objectPath,synthetic:true});
  try{
    const email=uid+'@example.invalid',password=crypto.randomBytes(36).toString('base64url');
    await auth.createUser({uid,email,password,displayName:'Temporary No-ETLs Verification'});created=true;
    await json(`${docs}/adminUsers?documentId=${uid}`,'POST',{fields:encode({uid,email,name:'Temporary No-ETLs Verification',role:'admin',accountType:'staff',disabled:false,permissions:{chatEnabled:false,allowedNavigationIds:['resources','etls']}}).mapValue.fields});
    await auth.setCustomUserClaims(uid,{admin:true,operator:true,nexusRole:'admin',chatClient:false});
    const config=await(await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json();
    const signIn=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(signIn.ok);const token=(await signIn.json()).idToken;
    const call=async(name,data,expected)=>{
      const r=await fetch(`https://us-central1-meridain-nexus.cloudfunctions.net/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({data}),signal:AbortSignal.timeout(180000)}),body=await r.json();
      if(expected){assert.equal(body.error?.status,expected,`${name}: ${r.status} ${body.error?.message}`);return body.error;}
      assert.ok(r.ok&&!body.error,`${name}: ${r.status} ${body.error?.message||''}`);return body.result;
    };
    const roles=['products','stores','staffing','dc','status','template'];
    // Duplicate roles fail before the reference-set transaction, but only after
    // all six metadata reads succeed under the callable's actual runtime identity.
    const templateCheck=await call('meridianEtl',{action:'saveReferences',revision:0,resources:Object.fromEntries(roles.map(role=>[role,'inventory-anchor-template']))},'INVALID_ARGUMENT');
    assert.ok(templateCheck.message.includes('own workbook'),'The previously blocked template must be readable before duplicate-role validation');
    const ExcelJS=require('../functions/node_modules/exceljs'),wb=new ExcelJS.Workbook();wb.addWorksheet('Synthetic').addRow(['Test only']);const bytes=Buffer.from(await wb.xlsx.writeBuffer());
    const access=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
    const upload=await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(objectPath)}`,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:bytes});assert.ok(upload.ok);uploaded=true;
    const input={id:resourceId,title:'Temporary No-ETLs Verification',category:'Reference',storagePath:objectPath,sourceName:'synthetic-verification.xlsx',tags:['synthetic-verification'],active:true};
    const saved=(await call('savePortalResource',input)).resource;assert.equal(saved.id,resourceId);assert.equal(saved.size,bytes.length);
    const references=await json(`${docs}/etlReferenceSets/anchor-pnp-v1`);
    const validation=await call('meridianEtl',{action:'saveReferences',revision:0,resources:Object.fromEntries(roles.map(role=>[role,resourceId]))},'INVALID_ARGUMENT');
    assert.ok(validation.message.includes('own workbook'),'Validation must reach the duplicate-role check after reading all six file references');
    assert.deepEqual(await json(`${docs}/etlReferenceSets/anchor-pnp-v1`),references,'Shared reference configuration must remain unchanged');
    await call('savePortalResource',{...input,storagePath:`portal-resources/${resourceId}/missing.xlsx`},'NOT_FOUND');
    await auth.setCustomUserClaims(uid,{admin:false,operator:true,nexusRole:'normal',chatClient:false});await call('meridianEtl',{action:'catalogue'},'PERMISSION_DENIED');
    save('smoke-verified.json',{at:new Date().toISOString(),ok:true,runtimeTemplateReadable:true,resourceUploadSaved:true,referenceReadsValidated:true,missingFileIs404:true,revokedAdminDenied:true,referenceSetUnchanged:true,workerRunStarted:false,businessDataChanged:false});console.log('PASS: runtime template access, live resource upload/save, ETL reference reads, correct 404 and Admin revocation. No business run started.');
  }finally{
    const failures=[],clean=async(label,fn)=>{try{await fn();}catch(e){failures.push({label,error:e.message});}};
    if(created)await clean('temporary account',()=>auth.deleteUser(uid));
    await clean('temporary documents',()=>json(`${docs}:commit`,'POST',{writes:[{delete:`${database}/adminUsers/${uid}`},{delete:`${database}/portalResources/${resourceId}`}]}));
    assert.ok(objectPath.startsWith(`portal-resources/${resourceId}/`));if(uploaded)await clean('temporary workbook',()=>api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`,'DELETE'));
    save('smoke-cleanup.json',{at:new Date().toISOString(),uid,resourceId,failures,auditLogRetained:true});assert.deepEqual(failures,[]);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
