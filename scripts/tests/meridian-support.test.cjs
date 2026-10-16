const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const functionRoot=process.env.SUPPORT_FUNCTIONS_ROOT||path.resolve(__dirname,'../../functions');
const {createRequire}=require('node:module'),sdk=createRequire('C:/Users/PC/SIGDAHUILA/package.json'),backend=createRequire(path.join(functionRoot,'package.json'));
const {initializeTestEnvironment,assertFails}=sdk('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,collection,getDocs}=sdk('firebase/firestore');
const {initializeApp,deleteApp}=backend('firebase-admin/app'),{getFirestore,FieldValue,FieldPath,Timestamp}=backend('firebase-admin/firestore'),{HttpsError}=backend('firebase-functions/v2/https');
const {buildSupport,PREFIX}=require(path.join(functionRoot,'meridian-support'));
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Local emulator required; never run against production.');
const projectId='demo-meridian-support',app=initializeApp({projectId},'support-tests'),db=getFirestore(app);
let env,accounts,objects,breakSave,afterDownload;
const profiles={alice:{role:'normal',name:'Alice',accountType:'staff'},bob:{role:'normal',name:'Bob',accountType:'staff'},admin:{role:'admin',name:'Admin',accountType:'staff'},admin2:{role:'admin',name:'Admin Two',accountType:'staff'},client:{role:'client',accountType:'client'},disabled:{role:'normal',disabled:true},orphan:{role:'normal'},revoked:{role:'normal'},noClaims:{role:'normal'}};
const auth=()=>({getUser:async uid=>{if(!accounts[uid])throw new Error('Missing account');return accounts[uid];},getUsers:async ids=>({users:ids.map(({uid})=>accounts[uid]).filter(Boolean)})});
const api=buildSupport({db,getAuth:auth,FieldValue,FieldPath,Timestamp,HttpsError,onCall:(_,fn)=>fn,onSchedule:(_,fn)=>fn,bucket:()=>({file:object=>({save:async(bytes,options)=>{if(breakSave)throw new Error('Storage unavailable');if(objects.has(object))throw Object.assign(new Error('Exists'),{code:412});objects.set(object,{bytes,options});},download:async()=>{if(afterDownload)await afterDownload();return [objects.get(object).bytes];},delete:async()=>objects.delete(object)})})});
const call=(uid,data,token={})=>api.meridianSupport({auth:uid?{uid,token:{auth_time:Math.floor(Date.now()/1000),operator:true,nexusRole:'normal',...(uid.startsWith('admin')?{admin:true,nexusRole:'admin'}:{}),...token}}:null,data});
const nonce=()=>crypto.randomUUID(),denied=p=>assert.rejects(p,e=>e.code==='permission-denied');
const input=extra=>({action:'create',requestId:nonce(),subject:'Attendance not updating',description:'The latest month is missing from the dashboard.',module:'Time & Attendance',priority:'normal',...extra});
const create=(uid='alice',extra={})=>call(uid,input(extra));
const file={name:'evidence.txt',base64:Buffer.from('Synthetic issue evidence').toString('base64')};
before(async()=>{const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync(process.env.SUPPORT_TEST_RULES||path.join(__dirname,'../../firestore.rules'),'utf8')}});});
beforeEach(async()=>{
  await env.clearFirestore();objects=new Map();breakSave=false;afterDownload=null;
  accounts=Object.fromEntries(Object.keys(profiles).filter(uid=>uid!=='orphan').map(uid=>[uid,{uid,disabled:false,customClaims:uid.startsWith('admin')?{admin:true,nexusRole:'admin'}:uid==='noClaims'?{}:{operator:true,nexusRole:'normal'}}]));
  accounts.client.customClaims={chatClient:true,nexusRole:'client'};accounts.revoked.tokensValidAfterTime=new Date(Date.now()+60000).toISOString();
  const batch=db.batch();for(const [uid,value] of Object.entries(profiles))batch.set(db.doc('adminUsers/'+uid),value);await batch.commit();
});
after(async()=>{await env.cleanup();await db.terminate();await deleteApp(app);});
test('only active registered staff can open support',async()=>{
  await assert.rejects(call(null,{action:'list'}),{code:'unauthenticated'});
  for(const uid of ['client','disabled','orphan','revoked','missing','noClaims'])await denied(call(uid,{action:'list'}));
  accounts.bob.disabled=true;await denied(call('bob',{action:'list'}));
  assert.equal((await call('alice',{action:'list'})).tickets.length,0);
});
test('external claims and external profile flags fail closed',async()=>{
  await denied(call('alice',{action:'list'},{chatClient:true}));
  for(const value of [{accountType:'client'},{chatAccess:{audience:'external'}},{chatAccess:{workRole:'Client'}}]){await db.doc('adminUsers/alice').set({...profiles.alice,...value});await denied(call('alice',{action:'list'}));}
});
test('staff ticket ownership cannot be overridden and other staff cannot read it',async()=>{
  const {ticketId}=await create('alice',{ownerUid:'bob',status:'resolved',assigneeUid:'admin'});
  const result=await call('alice',{action:'get',ticketId});assert.equal(result.ticket.ownerUid,'alice');assert.equal(result.ticket.status,'open');assert.equal(result.ticket.assigneeUid,'');
  await denied(call('bob',{action:'get',ticketId}));assert.equal((await call('bob',{action:'list',scope:'all'})).tickets.length,0);
  assert.equal((await call('admin',{action:'list'})).tickets.length,1);
});
test('duplicate creates reuse the same ticket and mismatched payload is rejected',async()=>{
  const payload=input();const one=await call('alice',payload),two=await call('alice',payload);assert.equal(one.ticketId,two.ticketId);assert.equal((await db.collection('supportTickets').get()).size,1);
  await assert.rejects(call('alice',{...payload,subject:'Different issue'}),{code:'already-exists'});
});
test('concurrent retries create only one ticket',async()=>{
  const payload=input();await Promise.allSettled([call('alice',payload),call('alice',payload)]);const retry=await call('alice',payload);assert.ok(retry.ticketId);assert.equal((await db.collection('supportTickets').get()).size,1);
});
test('subject, body, module, priority, nonce and file types are validated',async()=>{
  for(const changes of [{subject:''},{subject:'a'.repeat(161)},{description:'a'.repeat(6001)},{module:'unknown'},{priority:'owner'},{requestId:'../../x'},{attachments:[{...file,name:'execute.exe'}]},{attachments:[{...file,name:'photo.png'}]},{attachments:[{...file,name:'bad/path.txt'}]},{attachments:Array(4).fill(file)},{attachments:[{...file,base64:Buffer.alloc(3*1024*1024+1).toString('base64')}]}])await assert.rejects(create('alice',changes),{code:'invalid-argument'});
});
test('attachments stay private and can only be downloaded from their bound ticket',async()=>{
  const {ticketId}=await create('alice',{attachments:[file]}),other=await create('bob');const result=await call('alice',{action:'get',ticketId}),attachmentId=result.ticket.attachments[0].id;
  assert.equal([...objects.values()][0].options.metadata.cacheControl,'private, no-store');assert.equal(JSON.stringify([...objects.values()][0].options).includes('firebaseStorageDownloadTokens'),false);
  assert.equal((await call('alice',{action:'download',ticketId,attachmentId})).base64,file.base64);
  assert.equal((await call('admin',{action:'download',ticketId,attachmentId})).base64,file.base64);
  await denied(call('bob',{action:'download',ticketId,attachmentId}));await denied(call('bob',{action:'download',ticketId:other.ticketId,attachmentId}));
  await assert.rejects(call('alice',{action:'download',ticketId,attachmentId:'../secret'}),{code:'invalid-argument'});
});
test('download rechecks account access after storage IO',async()=>{
  const {ticketId}=await create('alice',{attachments:[file]}),attachmentId=(await call('alice',{action:'get',ticketId})).ticket.attachments[0].id;
  afterDownload=async()=>{accounts.alice.disabled=true;};await denied(call('alice',{action:'download',ticketId,attachmentId}));
});
test('failed uploads preserve retry identity without partially creating tickets',async()=>{
  const payload=input({attachments:[file]});breakSave=true;await assert.rejects(call('alice',payload),{code:'unavailable'});assert.equal((await db.collection('supportTickets').get()).size,0);
  breakSave=false;const result=await call('alice',payload);assert.equal((await call('alice',{action:'get',ticketId:result.ticketId})).ticket.attachments.length,1);
});
test('staff and administrators can reply, outsiders cannot; retries do not duplicate messages',async()=>{
  const {ticketId}=await create(),payload={action:'reply',ticketId,text:'More details',requestId:nonce(),attachments:[file]};
  await denied(call('bob',payload));await call('alice',payload);await call('alice',payload);await call('admin',{...payload,text:'Investigating',requestId:nonce(),attachments:[]});
  const value=await call('alice',{action:'get',ticketId});assert.equal(value.messages.length,2);assert.equal(value.messages[1].authorRole,'admin');assert.equal(value.ticket.revision,3);
  const m=value.messages[0];assert.equal((await call('alice',{action:'download',ticketId,attachmentId:m.attachments[0].id,messageId:m.id})).base64,file.base64);
  await denied(call('alice',{action:'download',ticketId,attachmentId:m.attachments[0].id}));
});
test('only fully verified admins can assign, prioritise and resolve tickets',async()=>{
  const {ticketId}=await create(),payload={action:'update',ticketId,requestId:nonce(),revision:1,status:'resolved',priority:'high',assigneeUid:'admin2',note:'Import verified.'};
  await denied(call('alice',payload));await denied(call('alice',payload,{admin:true}));
  await db.doc('adminUsers/alice').update({role:'admin'});await denied(call('alice',payload,{admin:true}));
  await call('admin',payload);const result=await call('admin',{action:'get',ticketId});assert.equal(result.ticket.assigneeUid,'admin2');assert.equal(result.ticket.status,'resolved');assert.ok(result.messages[0].text.includes('Import verified.'));
  await assert.rejects(call('admin',{...payload,requestId:nonce()}),{code:'aborted'});
});
test('inactive and non-admin assignees are rejected; resolution notes required',async()=>{
  const {ticketId}=await create(),payload={action:'update',ticketId,requestId:nonce(),revision:1,status:'resolved',priority:'normal',assigneeUid:'admin2',note:'Fixed'};
  await assert.rejects(call('admin',{...payload,note:''}),{code:'invalid-argument'});await assert.rejects(call('admin',{...payload,assigneeUid:'bob'}),{code:'failed-precondition'});
  accounts.admin2.disabled=true;await assert.rejects(call('admin',payload),{code:'failed-precondition'});
});
test('waiting tickets return to open on staff reply; closed tickets require reopen',async()=>{
  const {ticketId}=await create();await call('admin',{action:'update',ticketId,revision:1,requestId:nonce(),status:'waiting',priority:'normal',assigneeUid:'admin',note:'Please send details.'});
  await call('alice',{action:'reply',ticketId,requestId:nonce(),text:'Here are the details.'});assert.equal((await call('alice',{action:'get',ticketId})).ticket.status,'open');
  await call('admin',{action:'update',ticketId,revision:3,requestId:nonce(),status:'closed',priority:'normal',assigneeUid:'admin',note:'Confirmed with reporter.'});
  await assert.rejects(call('alice',{action:'reply',ticketId,requestId:nonce(),text:'Still an issue'}),{code:'failed-precondition'});await denied(call('bob',{action:'reopen',ticketId,requestId:nonce(),revision:4}));
  await call('alice',{action:'reopen',ticketId,requestId:nonce(),revision:4});assert.equal((await call('alice',{action:'get',ticketId})).ticket.status,'open');
});
test('server list and cursor preserve staff scope and nanosecond ordering',async()=>{
  const {ticketId}=await create(),template=(await db.doc('supportTickets/'+ticketId).get()).data();await db.doc('supportTickets/'+ticketId).delete();
  const batch=db.batch();for(let i=0;i<65;i++)batch.set(db.doc('supportTickets/SUP-'+i.toString(16).toUpperCase().padStart(16,'0')),{...template,ownerUid:i<60?'alice':'bob',updatedAt:new Timestamp(1800000000,500000+i)});await batch.commit();
  const first=await call('alice',{action:'list',scope:'all'}),second=await call('alice',{action:'list',cursor:first.next});assert.equal(first.tickets.length,50);assert.equal(second.tickets.length,10);assert.equal(second.next,null);assert.equal(new Set([...first.tickets,...second.tickets].map(t=>t.id)).size,60);
});
test('messages page backwards without losing history',async()=>{
  const {ticketId}=await create(),ref=db.doc('supportTickets/'+ticketId);const batch=db.batch();for(let i=2;i<=61;i++)batch.set(ref.collection('messages').doc(String(i)),{sequence:i,text:'Update '+i,createdAt:Timestamp.now(),authorUid:'admin',authorName:'Admin',authorRole:'admin',kind:'reply',attachments:[]});await batch.commit();
  const first=await call('alice',{action:'get',ticketId}),second=await call('alice',{action:'get',ticketId,before:first.older});assert.equal(first.messages.length,50);assert.equal(second.messages.length,10);assert.equal(second.messages[0].sequence,2);
});
test('directory is admin only and omits disabled admins',async()=>{
  await denied(call('alice',{action:'directory'}));accounts.admin2.disabled=true;assert.deepEqual((await call('admin',{action:'directory'})).admins.map(a=>a.uid),['admin']);
});
test('submission quotas bound creates and files',async()=>{
  await db.doc('supportQuotas/alice').set({day:new Date().toISOString().slice(0,10),tickets:20});await assert.rejects(create(),{code:'resource-exhausted'});
});
test('cleanup deletes only expired unbound uploads and retains completed evidence',async()=>{
  const {ticketId}=await create('alice',{attachments:[file]});assert.ok(ticketId);const expired='f'.repeat(64),object=PREFIX+expired+'-0';objects.set(object,{bytes:Buffer.from('orphan')});await db.doc('supportOperations/'+expired).set({status:'pending',leaseUntil:new Date(0),expiresAt:new Date(0),paths:[object]});
  await api.cleanupMeridianSupportUploads();assert.equal(objects.size,1);assert.equal((await db.doc('supportOperations/'+expired).get()).data().status,'failed');
});
test('browser Firestore access to tickets, messages, operations and quotas is denied, including admins',async()=>{
  const {ticketId}=await create();for(const uid of ['alice','bob','admin',null]){const store=uid?env.authenticatedContext(uid,{admin:uid==='admin',operator:true,nexusRole:uid==='admin'?'admin':'normal'}).firestore():env.unauthenticatedContext().firestore();
    for(const key of ['supportTickets/'+ticketId,'supportTickets/'+ticketId+'/messages/x','supportOperations/x','supportQuotas/alice']){await assertFails(getDoc(doc(store,key)));await assertFails(setDoc(doc(store,key),{ownerUid:uid}));}
    await assertFails(getDocs(collection(store,'supportTickets')));
  }
});
