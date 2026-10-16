const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const req=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp}=req('firebase-admin/app'),{getAuth}=req('firebase-admin/auth');
const {json,api}=require('./release-multi-admin.cjs'),{save}=require('./release-meridian-support.cjs');
const project='meridain-nexus',bucket=project+'.firebasestorage.app',base=`projects/${project}/databases/(default)/documents`,docs=`https://firestore.googleapis.com/v1/${base}`;
process.env.GOOGLE_CLOUD_QUOTA_PROJECT=project;
initializeApp({projectId:project,credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project='+project,'--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const auth=getAuth(),created=[],profiles=[],operations=[],ticketIds=[];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),objects=[];
async function main(){
  const run=crypto.randomUUID();save('smoke-started.json',{run,at:new Date().toISOString()});let verified=false;
  try{
    const config=await(await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json(),users=[];
    for(const role of ['normal','normal','admin']){
      const uid='support-check-'+crypto.randomUUID(),email=uid+'@example.invalid',password=crypto.randomBytes(36).toString('base64url');
      await auth.createUser({uid,email,password,displayName:'Temporary Support verification'});created.push(uid);
      await auth.setCustomUserClaims(uid,{operator:true,nexusRole:role,admin:role==='admin',chatClient:false});
      await json(`${docs}/adminUsers?documentId=${uid}`,'POST',{fields:{uid:{stringValue:uid},email:{stringValue:email},name:{stringValue:'Temporary Support verification'},role:{stringValue:role},accountType:{stringValue:'staff'},disabled:{booleanValue:false}}});profiles.push(uid);
      const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(r.ok);users.push({uid,token:(await r.json()).idToken});
    }
    const [staff,other,admin]=users;
    async function call(user,data){
      if(['create','reply','update','reopen'].includes(data.action)){
        const opId=sha(`${user.uid}:${data.requestId}`);operations.push(opId);if(data.action==='create')ticketIds.push('SUP-'+opId.slice(0,16).toUpperCase());
        (data.attachments||[]).forEach((_,i)=>objects.push('support-ticket-attachments/'+opId+'-'+i));
      }
      const r=await fetch(`https://us-central1-${project}.cloudfunctions.net/meridianSupport`,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{})},body:JSON.stringify({data}),signal:AbortSignal.timeout(180000)}),body=await r.json();
      if(!r.ok||body.error)throw Object.assign(new Error(body.error?.message||'Support callable failed'),{status:body.error?.status});return body.result;
    }
    const denied=p=>assert.rejects(p,{status:'PERMISSION_DENIED'}),nonce=()=>crypto.randomUUID();
    await assert.rejects(call(null,{action:'list'}),{status:'UNAUTHENTICATED'});
    assert.equal((await call(staff,{action:'list'})).tickets.length,0);
    const input={action:'create',requestId:nonce(),subject:'Synthetic Support verification '+run,description:'Temporary deployment test. No staff action is required.',module:'General',priority:'normal',attachments:[{name:'verification.txt',base64:Buffer.from('Synthetic Support evidence').toString('base64')}]};
    const result=await call(staff,input);assert.deepEqual(await call(staff,input),result);
    const ticket=(await call(staff,{action:'get',ticketId:result.ticketId})).ticket;assert.equal(ticket.ownerUid,staff.uid);assert.equal(ticket.attachments.length,1);
    await denied(call(other,{action:'get',ticketId:ticket.id}));assert.equal((await call(other,{action:'list',scope:'all'})).tickets.length,0);
    const file=await call(staff,{action:'download',ticketId:ticket.id,attachmentId:ticket.attachments[0].id});assert.equal(Buffer.from(file.base64,'base64').toString(),'Synthetic Support evidence');
    await denied(call(other,{action:'download',ticketId:ticket.id,attachmentId:ticket.attachments[0].id}));await denied(call(staff,{action:'directory'}));
    const browser=await fetch(`${docs}/supportTickets/${ticket.id}`,{headers:{Authorization:`Bearer ${staff.token}`}});assert.equal(browser.status,403);
    const direct=await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent('support-ticket-attachments/'+ticket.attachments[0].id)}?alt=media`,{headers:{Authorization:`Firebase ${staff.token}`}});assert.equal(direct.status,403);
    await call(staff,{action:'reply',ticketId:ticket.id,requestId:nonce(),text:'Reply verification.'});
    const queue=await call(admin,{action:'list',scope:'all'});assert.ok(queue.tickets.some(t=>t.id===ticket.id));
    assert.ok((await call(admin,{action:'directory'})).admins.some(a=>a.uid===admin.uid));
    const current=(await call(admin,{action:'get',ticketId:ticket.id})).ticket;
    await call(admin,{action:'update',ticketId:ticket.id,requestId:nonce(),revision:current.revision,status:'resolved',priority:'high',assigneeUid:admin.uid,note:'Synthetic test completed.'});
    const resolved=(await call(staff,{action:'get',ticketId:ticket.id})).ticket;assert.equal(resolved.status,'resolved');assert.equal(resolved.assigneeUid,admin.uid);
    await call(staff,{action:'reopen',ticketId:ticket.id,requestId:nonce(),revision:resolved.revision});
    assert.equal((await call(staff,{action:'get',ticketId:ticket.id})).ticket.status,'open');
    assert.equal((await call(admin,{action:'list',scope:'assigned',status:'open'})).tickets.some(t=>t.id===ticket.id),true);
    assert.equal((await call(staff,{action:'list',status:'open'})).tickets.some(t=>t.id===ticket.id),true);
    await auth.updateUser(staff.uid,{disabled:true});await denied(call(staff,{action:'get',ticketId:ticket.id}));
    verified=true;console.log('PASS: live callable, staff isolation, private uploads/downloads, idempotency, admin assignment, resolution/reopen, indexes and revoked account denial.');
  }finally{
    const failures=[];
    for(const uid of created)try{await auth.deleteUser(uid);}catch(e){failures.push(e.message);}
    const paths=new Set(profiles.map(uid=>'adminUsers/'+uid));created.forEach(uid=>paths.add('supportQuotas/'+uid));operations.forEach(id=>paths.add('supportOperations/'+id));
    for(const id of new Set(ticketIds)){
      paths.add('supportTickets/'+id);
      try{const messages=await json(`${docs}/supportTickets/${id}/messages?pageSize=100`);assert.ok(!messages.nextPageToken);for(const m of messages.documents||[])paths.add(m.name.slice(base.length+1));}catch(e){failures.push(e.message);}
    }
    if(paths.size)try{await json(`${docs}:commit`,'POST',{writes:[...paths].map(p=>({delete:base+'/'+p}))});}catch(e){failures.push(e.message);}
    for(const object of new Set(objects))try{await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}`,'DELETE');}catch(e){if(!e.message.includes('404'))failures.push(e.message);}
    save('smoke-cleanup.json',{at:new Date().toISOString(),users:created,syntheticTickets:[...new Set(ticketIds)],failures});assert.deepEqual(failures,[]);
    if(verified)save('smoke.json',{at:new Date().toISOString(),passed:true,syntheticRecordsRemoved:true});
  }
}
main().catch(e=>{console.error(e.stack);if(e.cause)console.error({cause:e.cause.code||e.cause.message});process.exitCode=1;});
