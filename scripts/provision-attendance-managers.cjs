const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const sdkRequire=require('node:module').createRequire(path.resolve(__dirname,'../functions/package.json'));
const {initializeApp}=sdkRequire('firebase-admin/app');
const {getAuth}=sdkRequire('firebase-admin/auth');
process.env.GOOGLE_CLOUD_QUOTA_PROJECT='meridain-nexus';
const {json}=require('./release-multi-admin.cjs');
const {stage,read,save,decode}=require('./release-attendance-analytics.cjs');
const base='https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
const encode=v=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
initializeApp({projectId:'meridain-nexus',credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const auth=getAuth();
async function profile(uid) {try {const doc=await json(`${base}/adminUsers/${uid}`);return {doc,data:decode({mapValue:{fields:doc.fields}})};}catch(e){if(e.message.startsWith('GET 404:'))return null;throw e;}}
function eligible(account,p) {
  return !account.disabled && account.customClaims?.chatClient!==true && account.customClaims?.nexusRole!=='client' && (!p || (p.data.disabled!==true && p.data.accountType!=='client' && p.data.role!=='client' && p.data.chatAccess?.audience!=='external' && p.data.chatAccess?.workRole!=='Client'));
}
async function inspect() {
  const list=read('hierarchy.json').access;assert.equal(list.length,33);assert.equal(new Set(list.map(x=>x.email)).size,33);
  const found=await auth.getUsers(list.map(p=>({email:p.email})));
  const rows=[];
  for(const person of list) {
    const account=found.users.find(u=>u.email?.toLowerCase()===person.email),p=account?await profile(account.uid):null;
    rows.push({...person,uid:account?.uid || null,claims:account?.customClaims || {},disabled:account?.disabled || false,profile:p,
      action:!account?'create-viewer':!eligible(account,p)?'review-disabled-or-external':account.customClaims?.admin===true?(p?.data.role==='admin'?'already-admin':'review-inconsistent-admin'):!p?'create-profile':p.data.role!=='normal'?'review-role':p.data.permissions?.allowedNavigationIds?.includes('attendance') && account.customClaims?.operator===true?'already-viewer':'enable-viewer'});
  }
  save('manager-provision-inspect.json',rows);
  console.log(JSON.stringify({people:rows.length,actions:rows.reduce((a,r)=>(a[r.action]=(a[r.action]||0)+1,a),{})}));
  return rows;
}
async function provision() {
  const rows=await inspect(), stateFile=path.join(stage,'manager-provision-state.json');
  const completed=fs.existsSync(stateFile)?read('manager-provision-state.json'):{};
  for(const person of rows) {
    if(person.action.startsWith('review-')) continue;
    if(['already-admin','already-viewer'].includes(person.action)) {completed[person.email]={uid:person.uid,status:person.action};continue;}
    if(completed[person.email]?.status==='started') throw new Error(`Review interrupted provisioning for ${person.email}; no existing identity will be overwritten.`);
    let user=person.uid ? await auth.getUser(person.uid) : null;
    if(user) assert.ok(eligible(user,await profile(user.uid)),'Staff identity changed; stop and review');
    completed[person.email]={uid:person.uid,status:'started'};save('manager-provision-state.json',completed);
    const created=!user;
    if(created) user=await auth.createUser({email:person.email,displayName:person.name,disabled:true});
    completed[person.email].uid=user.uid;save('manager-provision-state.json',completed);
    const current=await profile(user.uid);
    const existing=current?.data || {};
    assert.ok(!current || eligible({...user,disabled:false},current),'Profile is disabled or external');
    assert.notEqual(user.customClaims?.admin,true,'Admin identities must not be downgraded');
    const permissions=current ? {...existing.permissions,allowedNavigationIds:[...new Set([...(existing.permissions?.allowedNavigationIds || []),'attendance'])]} : {allowedNavigationIds:['attendance','chat'],allowedRetailerIds:[],chatEnabled:true,runJobs:false,manageAutomation:false,manageSchedules:false,manageUsers:false,viewAllAudit:false,stopAnyJob:false};
    const now=new Date().toISOString();
    const data=current?{permissions,updatedAt:now,updatedBy:'approved-attendance-manager-access'}:{uid:user.uid,email:person.email,name:person.name,surname:'',role:'normal',accountType:'staff',disabled:false,permissions,updatedAt:now,updatedBy:'approved-attendance-manager-access'};
    const fields=encode(data).mapValue.fields;fields.updatedAt={timestampValue:now};
    const audit=encode({event:'attendance-manager-access',targetUid:user.uid,targetEmail:person.email,result:'view-only',actorName:'User-approved manager workbook',sourceSha256:read('hierarchy.json').sha256}).mapValue.fields;audit.createdAt={timestampValue:now};
    await json(`${base}:commit`,'POST',{writes:[{update:{name:`projects/meridain-nexus/databases/(default)/documents/adminUsers/${user.uid}`,fields},...(current?{updateMask:{fieldPaths:Object.keys(fields)},currentDocument:{updateTime:current.doc.updateTime}}:{currentDocument:{exists:false}})},{update:{name:`projects/meridain-nexus/databases/(default)/documents/accessAuditLogs/${crypto.randomUUID()}`,fields:audit},currentDocument:{exists:false}}]});
    const fresh=await auth.getUser(user.uid);assert.notEqual(fresh.customClaims?.admin,true,'Concurrent Admin promotion; do not overwrite claims');
    await auth.setCustomUserClaims(user.uid,{...fresh.customClaims,admin:false,operator:true,nexusRole:'normal',chatClient:false});
    if(created) await auth.updateUser(user.uid,{disabled:false});
    const after=await auth.getUser(user.uid),p=await profile(user.uid);
    assert.ok(eligible(after,p));assert.equal(after.customClaims.operator,true);assert.equal(p.data.role,'normal');assert.ok(p.data.permissions.allowedNavigationIds.includes('attendance'));
    completed[person.email]={uid:user.uid,status:'verified-viewer',created,passwordSetupRequired:created,at:now};save('manager-provision-state.json',completed);
    console.log(`Verified view-only access: ${person.email}`);
  }
  save('manager-provision-state.json',completed);console.log(JSON.stringify({verified: Object.keys(completed).length,newAccounts:Object.values(completed).filter(r=>r.created).length,adminRolesGranted:0,passwordsEmailed:false}));
}
(process.argv[2]==='provision'?provision:inspect)().catch(e=>{console.error(e.message);process.exitCode=1;});
