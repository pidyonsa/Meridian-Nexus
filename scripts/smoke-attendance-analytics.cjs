const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const req=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp}=req('firebase-admin/app'),{getAuth}=req('firebase-admin/auth');
const verifyEarly=process.argv.includes('--early-visits');
const {json}=require('./release-multi-admin.cjs'),{save,read,stage}=require(verifyEarly?'./release-attendance-early-visits.cjs':'./release-attendance-analytics.cjs');
process.env.GOOGLE_CLOUD_QUOTA_PROJECT='meridain-nexus';
initializeApp({projectId:'meridain-nexus',credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const auth=getAuth(),uid='attendance-verification-'+crypto.randomUUID(),email=uid+'@example.invalid';
const docs='https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
async function main(){
  const password=crypto.randomBytes(36).toString('base64url');let created=false,profile=false;
  save('smoke-account.json',{uid,email,startedAt:new Date().toISOString(),purpose:'Temporary normal viewer for authorised read-only Attendance verification'});
  try{
    await auth.createUser({uid,email,password,displayName:'Temporary Attendance Verification',disabled:false});created=true;
    const fields={uid:{stringValue:uid},email:{stringValue:email},name:{stringValue:'Temporary Attendance Verification'},role:{stringValue:'normal'},accountType:{stringValue:'staff'},disabled:{booleanValue:false},permissions:{mapValue:{fields:{allowedNavigationIds:{arrayValue:{values:[{stringValue:'attendance'}]}},chatEnabled:{booleanValue:false}}}}};
    await json(`${docs}/adminUsers?documentId=${uid}`,'POST',{fields});profile=true;
    await auth.setCustomUserClaims(uid,{admin:false,operator:true,nexusRole:'normal',chatClient:false});
    const config=await (await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json();
    const signIn=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(signIn.ok,`Synthetic sign-in failed: ${signIn.status}`);const session=await signIn.json();
    const call=async data=>{const response=await fetch('https://us-central1-meridain-nexus.cloudfunctions.net/getGeoRepAttendanceDashboard',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.idToken}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(150000)});const body=await response.json();if(!response.ok||body.error)throw new Error(`Attendance ${data.mode || 'dashboard'} failed: ${response.status}: ${body.error?.message || ''}`);return body.result;};
    const summary=[];
    for(const audience of ['rep','merchandiser']){
      const started=Date.now(),d=await call({audience,filters:{}});save(`live-${audience}.json`,d);
      const cycle=await call({audience,mode:'callcycle',filters:{}});save(`live-callcycle-${audience}.json`,cycle);
      assert.equal(cycle.stores.reduce((n,r)=>n+r.scheduled,0),d.metrics.scheduled+d.quality.excludedVisits);
      assert.equal(d.analyticsVersion,1);assert.ok(d.metrics.scheduled>0);
      assert.ok(d.metrics.caughtUpVisits>0,'Expected caught-up visits in the current Geo report');
      const completed=await call({audience,mode:'detail',version:d.version,selection:{metric:'actual'},page:1,pageSize:250});assert.equal(completed.total,d.metrics.attended);
      assert.ok(completed.rows.every(r=>r.status==='visited' && r.completedDate));
      assert.equal(d.metrics.scheduled,d.metrics.attended+d.metrics.missedVisits+d.metrics.unknownVisits);
      assert.equal(d.scheduleAnalytics.daily.reduce((n,r)=>n+r.attended,0),d.metrics.attended);
      assert.equal(d.scheduleAnalytics.weekly.reduce((n,r)=>n+r.scheduled,0),d.metrics.scheduled);
      const detail=await call({audience,mode:'detail',version:d.version,selection:{metric:'missed',unit:'stores'},page:1,pageSize:100});assert.equal(detail.total,d.metrics.missedStores);
      const manager=d.availableFilters.managers[0];
      const filtered=await call({audience,filters:{manager}});
      const rows=await call({audience,mode:'detail',version:filtered.version,filters:{manager},selection:{metric:'target'},page:1,pageSize:100});assert.equal(rows.total,filtered.metrics.scheduled);
      const exported=await call({audience,mode:'export',version:filtered.version,filters:{manager},selection:{metric:'target'}});assert.equal(exported.total,rows.total);
      const ExcelJS=require('../functions/node_modules/exceljs'),w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(exported.base64,'base64'));assert.equal(w.getWorksheet('Visits').rowCount,exported.total+1);
      if(verifyEarly){
        assert.ok(d.metrics.earlyVisits>0,'Expected early visits in the current Geo report');
        assert.ok(!(d.quality.unverifiedResults || []).some(r=>/^Early visit on: \d{4}-\d{2}-\d{2}$/i.test(r.result)),'Early visits must not remain unverified');
        for(const groups of [d.rows,d.stores,d.charts.byRegion,d.charts.byDivision,d.charts.byManager,d.scheduleAnalytics.daily,d.scheduleAnalytics.weekly])assert.equal(groups.reduce((n,r)=>n+(r.earlyVisits || 0),0),d.metrics.earlyVisits);
        const store=d.stores.find(r=>r.earlyVisits>0),selection={store:store.storeId,metric:'actual'};
        const detail=await call({audience,mode:'detail',version:d.version,selection,pageSize:250});assert.equal(detail.total,store.attended);
        const early=detail.rows.find(r=>r.earlyVisit);assert.ok(early,'Early visit missing from Actual detail');assert.equal(early.status,'visited');assert.equal(early.caughtUp,false);assert.equal(early.completedDate,early.result.match(/\d{4}-\d{2}-\d{2}$/)[0]);
        const earlyExport=await call({audience,mode:'export',version:d.version,selection});assert.equal(earlyExport.total,detail.total);
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(earlyExport.base64,'base64'));const sheet=workbook.getWorksheet('Visits');
        assert.equal(sheet.rowCount,earlyExport.total+1);let checked=false;
        sheet.eachRow((row,n)=>{if(n>1 && row.getCell(1).value===early.id){assert.equal(row.getCell(6).value,'visited');assert.equal(row.getCell(17).value,1);assert.equal(row.getCell(20).value,early.result);assert.equal(row.getCell(21).value,early.completedDate);checked=true;}});assert.ok(checked,'Early visit missing from Excel');
      }
      summary.push({audience,metrics:d.metrics,rows:d.rows.length,managers:d.charts.byManager.length,elapsedMs:Date.now()-started,filteredAndExportReconciled:true,unknownResults:d.quality.unknownVisits});
      console.log(JSON.stringify(summary.at(-1)));
    }
    save('live-read-verified.json',{at:new Date().toISOString(),summary,readOnly:true,earlyVisitsVerified:verifyEarly});
  }finally{
    const failures=[];let authDeleted=false,profileDeleted=false;
    if(created)try{await auth.deleteUser(uid);authDeleted=true;}catch(e){failures.push(`Auth cleanup: ${e.message}`);}
    if(profile)try{await json(`${docs}:commit`,'POST',{writes:[{delete:`projects/meridain-nexus/databases/(default)/documents/adminUsers/${uid}`}]});profileDeleted=true;}catch(e){failures.push(`Profile cleanup: ${e.message}`);}
    save('smoke-account-cleanup.json',{uid,deletedAt:new Date().toISOString(),authDeleted,profileDeleted,failures});
    assert.deepEqual(failures,[],'Temporary viewer cleanup failed');
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
