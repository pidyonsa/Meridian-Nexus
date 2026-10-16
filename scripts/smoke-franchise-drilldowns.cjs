const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const req=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp}=req('firebase-admin/app'),{getAuth}=req('firebase-admin/auth'),{json}=require('./release-multi-admin.cjs');
const project='meridain-nexus',base=`projects/${project}/databases/(default)/documents`,docs=`https://firestore.googleapis.com/v1/${base}`,stage=path.resolve(__dirname,'../.tmp/franchise-drilldowns-20260911');
const save=(name,value)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2));
process.env.GOOGLE_CLOUD_QUOTA_PROJECT=project;
initializeApp({projectId:project,credential:{async getAccessToken(){return{access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project='+project,'--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
async function main(){
  const auth=getAuth(),uid='franchise-check-'+crypto.randomUUID(),email=uid+'@example.invalid',password=crypto.randomBytes(36).toString('base64url');let created=false,profile=false,verified=false;
  save('smoke-started.json',{uid,at:new Date().toISOString()});
  try{
    await auth.createUser({uid,email,password,displayName:'Temporary Franchise verification'});created=true;
    await auth.setCustomUserClaims(uid,{operator:true,nexusRole:'normal',admin:false,chatClient:false});
    await json(`${docs}/adminUsers?documentId=${uid}`,'POST',{fields:{uid:{stringValue:uid},email:{stringValue:email},name:{stringValue:'Temporary Franchise verification'},role:{stringValue:'normal'},accountType:{stringValue:'staff'},disabled:{booleanValue:false},permissions:{mapValue:{fields:{allowedNavigationIds:{arrayValue:{values:[{stringValue:'franchiseorder'}]}}}}}}});profile=true;
    const config=await(await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json();
    const login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(login.ok);const token=(await login.json()).idToken;
    async function call(data){
      const response=await fetch(`https://us-central1-${project}.cloudfunctions.net/getFranchiseOrderDashboard`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(150000)}),body=await response.json();
      if(!response.ok||body.error)throw Object.assign(new Error(body.error?.message||'Franchise reader failed'),{status:body.error?.status});return body.result;
    }
    const original=await call({refresh:true});assert.ok(original.dailyTrend.length,'Live ledger must contain activity for this verification');
    for(const granularity of ['day','week','month']){
      const grouped=await call({...original.selection,granularity});assert.equal(grouped.trendKey,granularity);
      assert.equal(grouped.dailyTrend.length,original.dailyTrend.length);
      const bucket=grouped.trend.at(-1),detail=await call({...grouped.selection,start:bucket.start,end:bucket.end});
      for(const key of ['amount','orders','units','stores','averageOrder','lines'])assert.equal(detail.totals[key],bucket[key],`${granularity} ${key}`);
      assert.ok(detail.table.rows.every(row=>row.orderDate>=bucket.start&&row.orderDate<=bucket.end));
    }
    for(const key of ['region','product','storeName','rep','status']){
      const group=original.by[key][0];if(!group)continue;
      const detail=await call({...original.selection,filters:{...original.selection.filters,[key]:group.missing?'':group.label},missingFilter:group.missing?key:''});
      for(const field of ['amount','orders','units','stores','averageOrder','lines'])assert.equal(detail.totals[field],group[field],`${key} ${field}`);
    }
    const day=original.dailyTrend.find(r=>r.lines<=10000);assert.ok(day,'A bounded daily export is required');
    const exported=await call({...original.selection,start:day.start,end:day.end,export:true});assert.equal(exported.table.rows.length,day.lines);
    for(const field of ['amount','orders','units','stores','averageOrder','lines'])assert.equal(exported.totals[field],day[field]);
    for(const exception of ['unmapped','missingRep','missingOrderNumber','missingValues','missingUnits','cancelled']){
      const detail=await call({...original.selection,exception});assert.equal(detail.table.total,exception==='cancelled'?original.quality.cancelled.lines:original.quality[exception]);
    }
    await json(`${docs}/adminUsers/${uid}?updateMask.fieldPaths=permissions`,'PATCH',{fields:{permissions:{mapValue:{fields:{allowedNavigationIds:{arrayValue:{values:[]}}}}}}});
    await assert.rejects(call(original.selection),{status:'PERMISSION_DENIED'});
    verified=true;console.log('PASS: live daily/weekly/monthly and group drilldowns reconcile; filtered export and exceptions match; revoked staff access denied. No order records modified.');
  }finally{
    const failures=[];if(created)try{await auth.deleteUser(uid);}catch(e){failures.push(e.message);}
    if(profile)try{await json(`${docs}:commit`,'POST',{writes:[{delete:`${base}/adminUsers/${uid}`}]});}catch(e){failures.push(e.message);}
    save('smoke-cleanup.json',{at:new Date().toISOString(),uid,failures});assert.deepEqual(failures,[]);
    if(verified)save('smoke.json',{at:new Date().toISOString(),passed:true,temporaryAccountRemoved:true,ledgerModified:false});
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
