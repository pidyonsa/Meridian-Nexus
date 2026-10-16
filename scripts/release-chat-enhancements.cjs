const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/approved-admin-chat-etl-20260909'),source=path.join(stage,'chat-feature');
const project='meridain-nexus',region='us-central1',account='730011371323-compute@developer.gserviceaccount.com',bucket='meridain-nexus.firebasestorage.app';
const gc=(...args)=>execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1',...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,stdio:['ignore','pipe','inherit']});
const save=(name,data)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(data,null,2));
async function prepare(){
 fs.mkdirSync(source,{recursive:true});
 for(const name of ['meridian-chat.js','chat-media.js','chat-notifications.js','assistant-memory.js','admin-access.js'])fs.copyFileSync(path.join(root,'functions',name),path.join(source,name));
 fs.copyFileSync(path.join(root,'functions/chat-entry.js'),path.join(source,'index.js'));
 fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({name:'meridian-chat-features',private:true,main:'index.js',engines:{node:'22'},dependencies:{'firebase-admin':'13.10.0','firebase-functions':'7.2.5',jszip:'3.10.1'},overrides:{uuid:'11.1.1',qs:'6.16.0'}},null,2));
 fs.writeFileSync(path.join(source,'.gcloudignore'),'node_modules\n.git\n');
 console.log(source);
}
async function infrastructure(){
 const before=JSON.parse(gc('storage','buckets','get-iam-policy',`gs://${bucket}`,`--project=${project}`,'--format=json'));
 if(!fs.existsSync(path.join(stage,'chat-bucket-iam.before.json')))save('chat-bucket-iam.before.json',before);
 const policy=structuredClone(before);policy.version=3;
 const binding={role:'roles/storage.objectAdmin',members:[`serviceAccount:${account}`],condition:{title:'NexusChatAttachments',expression:`resource.name.startsWith('projects/_/buckets/${bucket}/objects/meridian-chat-attachments/')`,description:'Private Meridian Chat attachments only; application-enforced conversation access'}};
 const exists=policy.bindings.find(x=>x.condition?.title===binding.condition.title);if(exists)assert.deepEqual(exists,binding);else policy.bindings.push(binding);
 save('chat-bucket-iam.desired.json',policy);
 if(!exists)gc('storage','buckets','set-iam-policy',`gs://${bucket}`,path.join(stage,'chat-bucket-iam.desired.json'),`--project=${project}`,'--quiet');
 const after=JSON.parse(gc('storage','buckets','get-iam-policy',`gs://${bucket}`,`--project=${project}`,'--format=json'));
 for(const b of before.bindings)assert.ok(after.bindings.some(a=>JSON.stringify(a)===JSON.stringify(b)));
 save('chat-bucket-iam.after.json',after);
 console.log('Only the chat attachment prefix grant was added; existing grants preserved.');
}
async function deploy(name){
 assert.ok(['meridianChat','meridianChatMedia','notifyMeridianChatMessage','deliverMeridianChatReminders'].includes(name));
 assert.ok(fs.existsSync(path.join(source,'package-lock.json')),'Lock dependencies before deploying.');
 const common=['functions','deploy',name,'--gen2',`--region=${region}`,`--project=${project}`,`--source=${source}`,`--entry-point=${name}`,'--runtime=nodejs22','--quiet','--format=json'];
 if(name==='meridianChat') {
  const before=JSON.parse(gc('functions','describe',name,'--gen2',`--region=${region}`,`--project=${project}`,'--format=json'));
  const baseline=JSON.parse(fs.readFileSync(path.join(stage,'functions.before.json'))).find(f=>f.name.endsWith('/meridianChat'));
  assert.equal(before.serviceConfig.revision,baseline.serviceConfig.revision,'Chat changed since audit.');
  gc(...common);
  const after=JSON.parse(gc('functions','describe',name,'--gen2',`--region=${region}`,`--project=${project}`,'--format=json'));
  for(const key of ['serviceAccountEmail','availableMemory','availableCpu','timeoutSeconds','maxInstanceCount','maxInstanceRequestConcurrency','environmentVariables','secretEnvironmentVariables','ingressSettings'])assert.deepEqual(after.serviceConfig[key],before.serviceConfig[key]);
  assert.equal(after.state,'ACTIVE');save(`${name}.feature-after.json`,after);console.log(`${name}: ${after.serviceConfig.revision}`);return;
 }
 const options=[`--service-account=${account}`,'--cpu=1'];
 if(name==='meridianChatMedia')options.push('--trigger-http','--allow-unauthenticated','--memory=512Mi','--timeout=60s','--concurrency=2','--max-instances=4');
 if(name==='notifyMeridianChatMessage')options.push('--trigger-location=nam5','--trigger-event-filters=type=google.cloud.firestore.document.v1.created','--trigger-event-filters=database=(default)','--trigger-event-filters=namespace=(default)','--trigger-event-filters-path-pattern=document=meridianChatRooms/{roomId}/messages/{messageId}',`--trigger-service-account=${account}`,'--retry','--memory=256Mi','--timeout=180s','--concurrency=4','--max-instances=3');
 if(name==='deliverMeridianChatReminders')options.push('--trigger-http','--no-allow-unauthenticated','--memory=256Mi','--timeout=540s','--concurrency=1','--max-instances=1');
 gc(...common,...options);
 const after=JSON.parse(gc('functions','describe',name,'--gen2',`--region=${region}`,`--project=${project}`,'--format=json'));
 assert.equal(after.state,'ACTIVE');assert.equal(after.serviceConfig.serviceAccountEmail,account);save(`${name}.feature-after.json`,after);console.log(`${name}: ${after.serviceConfig.revision}`);
}
async function scheduler(){
 const f=JSON.parse(fs.readFileSync(path.join(stage,'deliverMeridianChatReminders.feature-after.json')));
 const name='firebase-schedule-deliverMeridianChatReminders-us-central1';
 const jobs=JSON.parse(gc('scheduler','jobs','list',`--location=${region}`,`--project=${project}`,'--format=json'));
 assert.ok(!jobs.some(j=>j.name.endsWith('/'+name)),'Scheduler already exists; inspect it first.');
 gc('scheduler','jobs','create','http',name,`--location=${region}`,`--project=${project}`,'--schedule=*/5 * * * *','--time-zone=Africa/Johannesburg',`--uri=${f.serviceConfig.uri}`,'--http-method=POST',`--oidc-service-account-email=${account}`,`--oidc-token-audience=${f.serviceConfig.uri}`,'--headers=Content-Type=application/json','--message-body={}','--attempt-deadline=540s','--max-retry-attempts=3','--quiet');
 save('chat-scheduler.after.json',JSON.parse(gc('scheduler','jobs','describe',name,`--location=${region}`,`--project=${project}`,'--format=json')));console.log('Private OIDC-authenticated reminder scheduler created.');
}
const actions={prepare,infrastructure,scheduler};
Promise.resolve().then(()=>process.argv[2]==='deploy'?deploy(process.argv[3]):actions[process.argv[2]]?.()||Promise.reject(new Error('Choose prepare, infrastructure, deploy <name>, or scheduler.'))).catch(e=>{console.error(e.message.slice(0,2200));process.exitCode=1;});
