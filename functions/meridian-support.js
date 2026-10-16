"use strict";
const crypto = require("node:crypto");
const {isStaffProfile, isAdminProfile} = require("./admin-access");
const {validateAttachment} = require("./chat-media");
const STATUS = {open:"Open", in_progress:"In progress", waiting:"Waiting for staff", resolved:"Resolved", closed:"Closed"};
const PRIORITY = {low:"Low", normal:"Normal", high:"High", urgent:"Urgent"};
const MODULES = ["General", "Account & access", "Insights", "Franchise orders", "Time & Attendance", "Call Cycle", "Stock Fix", "Chat & tasks", "No-ETLs", "Resources", "Report automation"];
const PREFIX = "support-ticket-attachments/";
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const stamp = value => value?.toDate?.().toISOString() || null;
const ticketData = doc => { const v=doc.data(); return {id:doc.id, subject:v.subject, description:v.description, module:v.module, priority:v.priority, status:v.status, ownerUid:v.ownerUid, ownerName:v.ownerName, assigneeUid:v.assigneeUid, assigneeName:v.assigneeName, revision:v.revision, createdAt:stamp(v.createdAt), updatedAt:stamp(v.updatedAt), attachments:v.attachments || [], messageCount:v.messageCount || 0}; };

function buildSupport({db, getAuth, bucket, FieldValue, FieldPath, Timestamp, HttpsError, onCall, onSchedule}) {
  const tickets=db.collection("supportTickets"), operations=db.collection("supportOperations");
  const fail=(message,code="invalid-argument")=>{throw new HttpsError(code,message);};
  const text=(value,max,label,required=true)=>{
    if (typeof value!=="string" || value.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || (required && !value.trim())) fail(`Enter a valid ${label} (up to ${max} characters).`);
    return value.trim();
  };
  const id=value=>/^SUP-[A-F0-9]{16}$/.test(value || "") ? value : fail("Choose a valid ticket reference.");
  const enumValue=(value,values,label)=>Object.hasOwn(values,value) ? value : fail(`Choose a valid ${label}.`);
  const person=p=>[p.name,p.surname].filter(Boolean).join(" ").trim().slice(0,160) || "Nexus staff";
  async function authenticate(request) {
    if (!request.auth?.uid) fail("Sign in to Nexus.","unauthenticated");
    const uid=request.auth.uid, token=request.auth.token || {};
    const account=await getAuth().getUser(uid).catch(()=>null), p=(await db.collection("adminUsers").doc(uid).get()).data();
    const claims=account?.customClaims || {};
    if (!account || account.disabled || !isStaffProfile(p) || claims.chatClient===true || token.chatClient===true || claims.nexusRole==="client" || token.nexusRole==="client"
      || (account.tokensValidAfterTime && Number(token.auth_time || 0)*1000<Date.parse(account.tokensValidAfterTime))) fail("An active Nexus staff account is required.","permission-denied");
    const admin=isAdminProfile(p) && token.admin===true && claims.admin===true;
    if (!admin && !(p.role==="normal" && (claims.operator===true || claims.nexusRole==="normal") && (token.operator===true || token.nexusRole==="normal"))) fail("Your Nexus access has changed. Sign in again.","permission-denied");
    return {uid,admin,name:person(p)};
  }
  async function context(tx,actor,ticketId) {
    const p=(await tx.get(db.collection("adminUsers").doc(actor.uid))).data();
    if (!isStaffProfile(p) || (actor.admin ? !isAdminProfile(p) : p.role!=="normal")) fail("Your Nexus access has changed.","permission-denied");
    if (!ticketId) return null;
    const doc=await tx.get(tickets.doc(id(ticketId)));
    if (!doc.exists || (!actor.admin && doc.data().ownerUid!==actor.uid)) fail("Ticket not available to this account.","permission-denied");
    return doc;
  }
  async function ticket(actor,ticketId) { return db.runTransaction(tx=>context(tx,actor,ticketId)); }
  function attachments(input) {
    if (input===undefined) return [];
    if (!Array.isArray(input) || input.length>3) fail("Attach up to three files.");
    return input.map(file=>{
      if (!file || !/\.(png|jpe?g|webp|pdf|txt|csv)$/i.test(file.name || "") || file.kind==="voice") fail("Attach a PNG, JPG, WebP, PDF, TXT or CSV file.");
      if (typeof file.base64!=="string" || file.base64.length>4*1024*1024) fail("Each attachment must be no larger than 3 MB.");
      const value=validateAttachment(file,fail);if(value.bytes.length>3*1024*1024)fail("Each attachment must be no larger than 3 MB.");
      return value;
    });
  }
  async function quota(tx,actor,bytes,create) {
    const ref=db.collection("supportQuotas").doc(actor.uid), old=(await tx.get(ref)).data() || {}, day=new Date().toISOString().slice(0,10);
    const count=old.windowUntil>Date.now() ? old.count || 0 : 0, daily=old.day===day ? old : {};
    if (count>=30 || (create && (daily.tickets || 0)>=20) || (daily.bytes || 0)+bytes>30*1024*1024) fail("Support submission limit reached. Please try again later.","resource-exhausted");
    return ()=>tx.set(ref,{day,count:count+1,windowUntil:old.windowUntil>Date.now()?old.windowUntil:Date.now()+60000,tickets:(daily.tickets || 0)+(create?1:0),bytes:(daily.bytes || 0)+bytes});
  }
  async function assignee(uid) {
    if (!uid) return {uid:"",name:"Unassigned"};
    if (typeof uid!=="string" || uid.length>128 || uid.includes("/")) fail("Choose an active administrator.");
    const p=(await db.collection("adminUsers").doc(uid).get()).data(), account=await getAuth().getUser(uid).catch(()=>null);
    if (!isAdminProfile(p) || !account || account.disabled || account.customClaims?.admin!==true || account.customClaims?.chatClient===true || account.customClaims?.nexusRole==="client") fail("The assigned administrator is no longer available.","failed-precondition");
    return {uid,name:person(p)};
  }
  async function mutate(request,actor,input) {
    const action=input.action, nonce=text(input.requestId,80,"request identifier");
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(nonce)) fail("Invalid request identifier.");
    const opId=digest(`${actor.uid}:${nonce}`), ref=operations.doc(opId);
    const ticketId=action==="create" ? `SUP-${opId.slice(0,16).toUpperCase()}` : id(input.ticketId);
    const files=attachments(input.attachments), body={action,ticketId};
    if (action==="create") {
      body.subject=text(input.subject,160,"subject"); body.description=text(input.description,6000,"issue description");
      body.module=MODULES.includes(input.module) ? input.module : fail("Choose a Nexus module.");
      body.priority=enumValue(input.priority || "normal",PRIORITY,"priority");
    } else if (action==="reply") {
      body.text=text(input.text || "",6000,"reply",false); if (!body.text && !files.length) fail("Enter a reply or attach a file.");
    } else {
      if (files.length) fail("Attach files to a reply, not a status update.");
      if (!Number.isSafeInteger(input.revision) || input.revision<1) fail("Reload this ticket before updating it.");
      body.revision=input.revision;
      if (action==="update") {
        if (!actor.admin) fail("Administrator access is required.","permission-denied");
        body.status=enumValue(input.status,STATUS,"status");body.priority=enumValue(input.priority,PRIORITY,"priority");
        body.assignee=await assignee(input.assigneeUid);
        body.note=text(input.note || "",2000,"update note",false);
        if (["resolved","closed"].includes(body.status) && !body.note) fail("Add a resolution note before resolving or closing this ticket.");
      } else if (action!=="reopen") fail("Unknown ticket action.");
    }
    const hash=digest(JSON.stringify([body,files.map(f=>[f.info,f.digest])])), lease=crypto.randomUUID();
    const info=files.map((f,i)=>({id:`${opId}-${i}`,name:f.info.name,mime:f.info.mime,size:f.info.size}));
    const paths=info.map(f=>PREFIX+f.id);
    const reserved=await db.runTransaction(async tx=>{
      const current=await context(tx,actor,action==="create"?null:ticketId), old=(await tx.get(ref)).data();
      if (old && old.hash!==hash) fail("Request identifier already used for another submission.","already-exists");
      if (old?.status==="done") return old.result;
      if (old?.status==="deleting" || old?.leaseUntil?.toMillis()>Date.now()) fail("This submission is still being saved. Please wait before retrying.","aborted");
      if (current && action!=="reply" && current.data().revision!==body.revision) fail("The ticket changed. Refresh it before saving.","aborted");
      if (current?.data().status==="closed" && action==="reply") fail("Reopen the closed ticket before replying.","failed-precondition");
      if (action==="reopen" && !["closed","resolved"].includes(current.data().status)) fail("This ticket is already open.","failed-precondition");
      const consume=old ? ()=>{} : await quota(tx,actor,files.reduce((s,f)=>s+f.bytes.length,0),action==="create");
      consume();tx.set(ref,{hash,ownerUid:actor.uid,ticketId,status:"pending",lease,leaseUntil:new Date(Date.now()+180000),paths,expiresAt:new Date(Date.now()+86400000)});
      return null;
    });
    if (reserved) return reserved;
    try {
      for (let i=0;i<files.length;i++) await bucket().file(paths[i]).save(files[i].bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:files[i].info.mime,cacheControl:"private, no-store",contentDisposition:"attachment"}}).catch(e=>{if(Number(e.code)!==412)throw e;});
      const freshActor=await authenticate(request);
      if (freshActor.admin!==actor.admin) fail("Your Nexus access has changed.","permission-denied");
      return await db.runTransaction(async tx=>{
        const current=await context(tx,actor,action==="create"?null:ticketId), old=(await tx.get(ref)).data();
        if (old?.status==="done") return old.result;
        if (old?.lease!==lease || old.status!=="pending") fail("Submission expired. Please try again.","aborted");
        const target=tickets.doc(ticketId), at=FieldValue.serverTimestamp();let revision, message;
        if(action==="create") {
          const exists=await tx.get(target);if(exists.exists)fail("Ticket reference already exists.","already-exists");
          revision=1;
          tx.create(target,{subject:body.subject,description:body.description,module:body.module,priority:body.priority,status:"open",ownerUid:actor.uid,ownerName:actor.name,assigneeUid:"",assigneeName:"Unassigned",createdAt:at,updatedAt:at,revision,messageCount:0,attachments:info});
        } else {
          const value=current.data();revision=value.revision+1;
          if(action!=="reply" && value.revision!==body.revision)fail("The ticket changed. Refresh it before saving.","aborted");
          if(action==="reply" && value.status==="closed")fail("Reopen the closed ticket before replying.","failed-precondition");
          let changes={};
          if(action==="update") {
            if(body.assignee.uid){const profile=(await tx.get(db.collection("adminUsers").doc(body.assignee.uid))).data();if(!isAdminProfile(profile))fail("Choose an active administrator.","failed-precondition");}
            changes={status:body.status,priority:body.priority,assigneeUid:body.assignee.uid,assigneeName:body.assignee.name};
            message=`Status: ${STATUS[body.status]}. Priority: ${PRIORITY[body.priority]}. Assigned to: ${body.assignee.name}.${body.note ? "\n"+body.note : ""}`;
          } else if(action==="reopen") {
            if(!["closed","resolved"].includes(value.status))fail("This ticket is already open.","failed-precondition");
            changes.status="open";message="Ticket reopened.";
          } else {
            message=body.text;
            if(!actor.admin && value.status==="waiting")changes.status="open";
          }
          tx.update(target,{...changes,revision,messageCount:value.messageCount+1,updatedAt:at});
          tx.create(target.collection("messages").doc(opId),{sequence:revision,authorUid:actor.uid,authorName:actor.name,authorRole:actor.admin?"admin":"staff",kind:action==="reply"?"reply":"update",text:message,attachments:info,createdAt:at});
        }
        const result={ticketId,revision};
        tx.update(ref,{status:"done",result,expiresAt:FieldValue.delete(),leaseUntil:FieldValue.delete(),completedAt:at});
        return result;
      });
    } catch(error) {
      // Retain failed uploads privately for the cleanup job; never race a retry's files.
      await db.runTransaction(async tx=>{const op=(await tx.get(ref)).data();if(op?.lease===lease && op.status==="pending")tx.update(ref,{leaseUntil:new Date(0)});}).catch(()=>{});
      if(error instanceof HttpsError)throw error;
      console.error("Support submission failed",{code:error.code || "unknown",operation:opId});
      fail("The ticket could not be saved. Retry the same submission.","unavailable");
    }
  }
  async function list(actor,input) {
    const scope=actor.admin ? input.scope || "all" : "mine";
    if(!["mine","all","assigned"].includes(scope))fail("Choose a valid queue.");
    let query=tickets;
    if(scope==="mine")query=query.where("ownerUid","==",actor.uid);
    if(scope==="assigned")query=query.where("assigneeUid","==",actor.uid);
    if(input.status && input.status!=="all")query=query.where("status","==",enumValue(input.status,STATUS,"status"));
    query=query.orderBy("updatedAt","desc").orderBy(FieldPath.documentId(),"desc");
    if(input.cursor){const c=input.cursor;if(!Number.isSafeInteger(c.seconds) || c.seconds<0 || !Number.isSafeInteger(c.nanoseconds) || c.nanoseconds<0 || c.nanoseconds>=1e9)fail("Invalid ticket page.");query=query.startAfter(new Timestamp(c.seconds,c.nanoseconds),id(c.id));}
    const result=await query.limit(51).get(), docs=result.docs.slice(0,50), last=docs.at(-1);
    return {tickets:docs.map(ticketData),next:result.size>50?{seconds:last.data().updatedAt.seconds,nanoseconds:last.data().updatedAt.nanoseconds,id:last.id}:null,scope};
  }
  async function get(actor,input) {
    const doc=await ticket(actor,input.ticketId);let query=doc.ref.collection("messages").orderBy("sequence","desc");
    if(input.before!==undefined){if(!Number.isSafeInteger(input.before) || input.before<2)fail("Invalid conversation page.");query=query.startAfter(input.before);}
    const result=await query.limit(51).get(), docs=result.docs.slice(0,50);
    return {ticket:ticketData(doc),messages:docs.reverse().map(d=>({id:d.id,...d.data(),createdAt:stamp(d.data().createdAt)})),older:result.size>50?docs[0].data().sequence:null};
  }
  async function download(actor,input) {
    const doc=await ticket(actor,input.ticketId), attachmentId=text(input.attachmentId,80,"attachment reference");
    if(!/^[a-f0-9]{64}-[0-2]$/.test(attachmentId))fail("Invalid attachment reference.");
    let files=doc.data().attachments || [];
    if(input.messageId){if(!/^[a-f0-9]{64}$/.test(input.messageId))fail("Invalid message reference.");const m=await doc.ref.collection("messages").doc(input.messageId).get();if(!m.exists)fail("Attachment unavailable.","not-found");files=m.data().attachments || [];}
    const file=files.find(f=>f.id===attachmentId);if(!file)fail("Attachment unavailable.","permission-denied");
    const [bytes]=await bucket().file(PREFIX+attachmentId).download();
    if(bytes.length>3*1024*1024)fail("Attachment exceeds the download limit.","failed-precondition");
    await ticket(actor,input.ticketId);
    return {name:file.name,mime:file.mime,base64:bytes.toString("base64")};
  }
  async function directory(actor) {
    if(!actor.admin)fail("Administrator access is required.","permission-denied");
    const snapshot=await db.collection("adminUsers").where("role","==","admin").limit(101).get();
    if(snapshot.size>100)fail("Administrator directory exceeds the current limit.","resource-exhausted");
    const candidates=snapshot.docs.filter(doc=>isAdminProfile(doc.data()));
    const auths=candidates.length ? (await getAuth().getUsers(candidates.map(d=>({uid:d.id})))).users : [];
    const active=new Set(auths.filter(u=>!u.disabled && u.customClaims?.admin===true && u.customClaims?.chatClient!==true && u.customClaims?.nexusRole!=="client").map(u=>u.uid));
    return {admins:candidates.filter(d=>active.has(d.id)).map(d=>({uid:d.id,name:person(d.data())})).sort((a,b)=>a.name.localeCompare(b.name))};
  }
  async function cleanup() {
    const expired=await operations.where("expiresAt","<=",new Date()).limit(100).get();
    for(const doc of expired.docs){
      const paths=await db.runTransaction(async tx=>{const v=(await tx.get(doc.ref)).data();if(!v || v.status==="done" || v.leaseUntil?.toMillis()>Date.now() || !v.expiresAt || v.expiresAt.toMillis()>Date.now())return null;tx.update(doc.ref,{status:"deleting"});return v.paths || [];});
      if(!paths)continue;
      for(const object of paths){if(!object.startsWith(PREFIX+doc.id+"-"))throw new Error("Invalid support cleanup path");await bucket().file(object).delete({ignoreNotFound:true});}
      await doc.ref.update({status:"failed",expiresAt:FieldValue.delete(),leaseUntil:new Date(0)});
    }
  }
  const handler=async request=>{
    const actor=await authenticate(request), input=request.data || {};let result;
    if(["create","reply","update","reopen"].includes(input.action))result=await mutate(request,actor,input);
    else if(input.action==="list")result=await list(actor,input);
    else if(input.action==="get")result=await get(actor,input);
    else if(input.action==="download")result=await download(actor,input);
    else if(input.action==="directory")result=await directory(actor);
    else fail("Choose a valid support action.");
    const fresh=await authenticate(request);if(fresh.admin!==actor.admin)fail("Your Nexus access has changed.","permission-denied");
    return result;
  };
  return {meridianSupport:onCall({timeoutSeconds:120,memory:"512MiB",maxInstances:3,concurrency:20,cors:["https://meridian-nexus.web.app","https://meridian-nexus.firebaseapp.com"]},handler),cleanupMeridianSupportUploads:onSchedule({schedule:"every day 03:40",timeZone:"Africa/Johannesburg",timeoutSeconds:120,memory:"256MiB",maxInstances:1},cleanup)};
}
module.exports={buildSupport,STATUS,PRIORITY,MODULES,PREFIX};
