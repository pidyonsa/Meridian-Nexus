const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const {execFileSync}=require('node:child_process'),sdk=require('node:module').createRequire(path.resolve('functions/package.json'));
const {initializeApp}=sdk('firebase-admin/app'),{getAuth}=sdk('firebase-admin/auth');
const {save}=require('./release-chat-app.cjs');
const {json}=require('./release-multi-admin.cjs');
process.env.GOOGLE_CLOUD_QUOTA_PROJECT='meridain-nexus';
initializeApp({projectId:'meridain-nexus',credential:{async getAccessToken(){return {access_token:execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim(),expires_in:3000};}}});
const auth=getAuth(),users=[0,1].map(i=>({uid:'chat-check-'+crypto.randomUUID(),label:`Temporary Chat Verification ${i+1}`}));
const database='projects/meridain-nexus/databases/(default)/documents',docs='https://firestore.googleapis.com/v1/'+database;
const encode=value=>typeof value==='boolean'?{booleanValue:value}:typeof value==='string'?{stringValue:value}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
const erase=ref=>json(`${docs}:commit`,'POST',{writes:[{delete:`${database}/${ref}`}]});
async function eraseChildren(ref){const result=await json(`${docs}/${ref}?pageSize=100`);assert.ok(!result.nextPageToken);for(const doc of result.documents||[])await erase(doc.name.slice(database.length+1));}
let roomId=null;const taskIds=[];
async function main(){
  save('smoke-accounts.json',{at:new Date().toISOString(),uids:users.map(u=>u.uid),purpose:'Synthetic staff-only Chat and task verification; no real staff/device tokens'});
  try{
    const config=await(await fetch('https://meridian-nexus.web.app/__/firebase/init.json')).json();
    for(const user of users){
      const email=user.uid+'@example.invalid',password=crypto.randomBytes(36).toString('base64url');
      await auth.createUser({uid:user.uid,email,password,displayName:user.label});user.created=true;
      await json(`${docs}/adminUsers?documentId=${user.uid}`,'POST',{fields:encode({uid:user.uid,email,name:user.label,role:'normal',accountType:'staff',disabled:false,permissions:{chatEnabled:true,allowedNavigationIds:['chat']},chatAccess:{audience:'internal',workRole:'Sales rep',assignTasks:true}}).mapValue.fields});
      await auth.setCustomUserClaims(user.uid,{admin:false,operator:true,nexusRole:'normal',chatClient:false});
      const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});assert.ok(response.ok);user.token=(await response.json()).idToken;
    }
    const call=async(user,data,denied=false)=>{
      const response=await fetch('https://us-central1-meridain-nexus.cloudfunctions.net/meridianChat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+user.token},body:JSON.stringify({data:{...data,expectedUid:user.uid}}),signal:AbortSignal.timeout(90000)}),body=await response.json();
      if(denied){assert.equal(response.status,403);return;}
      assert.ok(response.ok&&!body.error,`${data.action}: ${response.status} ${body.error?.message||''}`);return body.result;
    };
    const [alice,bob]=users;
    roomId=(await call(alice,{action:'create',type:'direct',name:'Synthetic verification only',memberIds:[bob.uid],workstream:'General',requestId:crypto.randomUUID()})).roomId;
    await call(bob,{action:'send',roomId,text:'Synthetic message for unread verification',requestId:crypto.randomUUID()});
    const unread=await call(alice,{action:'activity'});assert.equal(unread.unreadChats,1);
    await call(alice,{action:'read',roomId,sequence:1});assert.equal((await call(alice,{action:'activity'})).unreadChats,0);
    const input={action:'taskCreateDirect',roomId,requestId:crypto.randomUUID(),title:'Synthetic checklist verification',assigneeUid:bob.uid,priority:'high',dueDate:'2020-01-01',checklist:[{id:crypto.randomUUID(),text:'Verify synthetic record',done:false}],requireCompletionNote:true};
    const {taskId}=await call(alice,input);taskIds.push(taskId);assert.equal((await call(alice,input)).reused,true);
    const tasks=await call(bob,{action:'taskList',filters:{due:'overdue',priority:'high'}});assert.equal(tasks.tasks.length,1);assert.equal(tasks.counts.overdue,1);
    assert.ok((await call(bob,{action:'activity'})).events.some(e=>e.kind==='task'&&e.taskId===taskId));
    await call(bob,{action:'taskUpdate',taskId,revision:1,status:'completed',progressNote:'Synthetic check completed',checklist:input.checklist.map(s=>({...s,done:true})),requireCompletionNote:true});
    const task=(await call(bob,{action:'taskGet',taskId})).task;assert.equal(task.history.length,2);assert.equal(task.status,'completed');
    await json(`${docs}/adminUsers/${bob.uid}?updateMask.fieldPaths=permissions.chatEnabled`,'PATCH',{fields:encode({permissions:{chatEnabled:false}}).mapValue.fields});await call(bob,{action:'activity'},true);
    save('live-smoke-verified.json',{at:new Date().toISOString(),ok:true,unreadReadClear:true,directTask:true,checklistHistory:true,assignmentActivity:true,optOutDenied:true,realStaffTouched:false,pushDevicesRegistered:false});console.log('PASS: live synthetic staff unread/read, direct task, checklist, filters, assignment activity and opt-out.');
  }finally{
    const failures=[];
    const clean=async(label,work)=>{try{await work();}catch(e){failures.push({label,error:e.message});}};
    // Only IDs captured from this synthetic run may be removed.
    for(const user of users){assert.ok(user.uid.startsWith('chat-check-'));if(user.created)await clean('auth '+user.uid,()=>auth.deleteUser(user.uid));await clean('profile '+user.uid,()=>erase('adminUsers/'+user.uid));if(roomId)await clean('reads '+user.uid,()=>erase(`meridianChatReads/${user.uid}/rooms/${roomId}`));
      for(const action of ['create','send','tasks'])await clean('limit',()=>erase(`meridianChatLimits/${user.uid}_${action}`));
      await clean('audit',async()=>{const rows=await json(`${docs}:runQuery`,'POST',{structuredQuery:{from:[{collectionId:'meridianChatAudit'}],where:{fieldFilter:{field:{fieldPath:'actorUid'},op:'EQUAL',value:{stringValue:user.uid}}}}});for(const row of rows)if(row.document)await erase(row.document.name.slice(database.length+1));});
    }
    for(const id of taskIds)for(const ref of [`meridianChatTasks/${id}`,`meridianChatReminders/${id}`,`meridianChatReminders/assigned_${id}`])await clean(ref,()=>erase(ref));
    if(roomId)await clean('room',async()=>{for(const collection of ['messages','receipts'])await eraseChildren(`meridianChatRooms/${roomId}/${collection}`);await erase('meridianChatRooms/'+roomId);});
    save('smoke-cleanup.json',{at:new Date().toISOString(),uids:users.map(u=>u.uid),failures});assert.deepEqual(failures,[],'Synthetic cleanup needs attention');
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
