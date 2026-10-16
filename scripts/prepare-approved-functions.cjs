const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/approved-admin-chat-etl-20260909');
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const local=file=>read(path.join(root,'functions',file));
const block=(text,re)=>{const value=text.match(re)?.[0];assert.ok(value,`Missing source block: ${re}`);return value;};
const fn=name=>new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`);
function once(text,from,to){assert.equal(text.split(from).length,2,`Ambiguous anchor ${from.slice(0,90)}`);return text.replace(from,()=>to);}
const full=local('index.js'),manifest=[];
for(const item of JSON.parse(fs.readFileSync(path.join(stage,'callables.before.json')))) {
 const source=path.join(stage,'sources',item.name),dest=path.join(stage,'deploy',item.name);fs.mkdirSync(dest,{recursive:true});
 fs.cpSync(source,dest,{recursive:true,filter:name=>!name.split(path.sep).includes('node_modules')});
 const baseline=read(path.join(source,'index.js'));let updated=baseline;const changes=[],replacements=[];
 const replace=(from,to)=>{updated=once(updated,from,to);replacements.push([from,to]);};
 if(item.name==='meridianChat') {
  updated=local('chat-entry.js');changes.push('chat enhancements and staff administrator policy');
  for(const name of ['meridian-chat.js','chat-media.js','chat-notifications.js','assistant-memory.js'])fs.writeFileSync(path.join(dest,name),local(name));
 } else if(item.name==='getFranchiseOrderDashboard') {
  const before=read(path.join(source,'franchise-orders.js'));
  const from='const admin = claims.admin === true && user.email?.toLowerCase() === "admin@nexus.co.za";';
  fs.writeFileSync(path.join(dest,'franchise-orders.js'),once(before,from,'const admin = claims.admin === true && request.auth.token?.admin === true && require("./admin-access").isAdminProfile(profile);'));
  changes.push('Franchise Order administrator guard only');
 } else {
  replace(block(updated,fn('requestRole')),block(full,fn('requestRole')));
  replace('const { onCall, HttpsError } = require("firebase-functions/v2/https");','const { onCall: firebaseOnCall, HttpsError } = require("firebase-functions/v2/https");');
  replace('initializeApp();','const onCall = require("./admin-access").guardCallables(firebaseOnCall, { db: () => getFirestore(), getAuth, HttpsError });\ninitializeApp();');
  changes.push('requestRole and fresh administrator verification only');
  if(['saveAdminUser','deleteAdminUser'].includes(item.name)) {
   const re=new RegExp(`exports\\.${item.name} = onCall\\([^]*?\\n\\}\\);`);
   replace(block(updated,re),block(full,re));changes.push('serialized account changes and self-removal protection');
   fs.writeFileSync(path.join(dest,'admin-user-errors.js'),local('admin-user-errors.js'));
  }
  if(item.name==='askNexusAssistant') {
   for(const re of [fn('askGemini'),fn('nexusAssistantWorkspaceContext'),/exports\.askNexusAssistant = onCall\([^]*?\n\}\);/])replace(block(updated,re),block(full,re));
   for(const name of ['assistant-access.js','assistant-memory.js','meridian-chat.js','chat-media.js','chat-notifications.js'])fs.writeFileSync(path.join(dest,name),local(name));
   changes.push('private AI memory, reviewed drafts, provider retries and source-job access checks');
  }
  let reversed=updated;for(const [from,to] of [...replacements].reverse())reversed=once(reversed,to,from);assert.equal(reversed,baseline);
 }
 fs.writeFileSync(path.join(dest,'admin-access.js'),local('admin-access.js'));
 fs.writeFileSync(path.join(dest,'index.js'),updated);
 fs.writeFileSync(path.join(dest,'.gcloudignore'),'.git\nnode_modules\n');
 execFileSync(process.execPath,['--check',path.join(dest,'index.js')]);
 manifest.push({...item,changes,indexSha256:crypto.createHash('sha256').update(updated).digest('hex')});
}
fs.writeFileSync(path.join(stage,'functions.manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({callables:manifest.length,unrelatedHandlersPreserved:true,scheduledAndEventFunctionsChanged:0}));
