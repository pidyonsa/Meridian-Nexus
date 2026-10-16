(function(global){
  "use strict";
  const STATUS={open:"Open",in_progress:"In progress",waiting:"Waiting for staff",resolved:"Resolved",closed:"Closed"};
  const PRIORITY={low:"Low",normal:"Normal",high:"High",urgent:"Urgent"};
  const MODULES=["General","Account & access","Insights","Franchise orders","Time & Attendance","Call Cycle","Stock Fix","Chat & tasks","No-ETLs","Resources","Report automation"];
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const icon=name=>`<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const when=value=>value?new Date(value).toLocaleString("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}):"Just now";
  const btn=(action,name,label,extra="")=>`<button type="button" data-sp-action="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(name)}</button>`;
  const badge=(status)=>`<span class="sp-status ${status}"><i></i>${STATUS[status]||"Unknown"}</span>`;
  function mount(root,{call,admin=false,onAdmin,onMine}){
    let stopped=false,listRequest=0,detailRequest=0,busy=false,loading=false,detailLoading=false;
    let tickets=[],next=null,cursors=[null],page=0,status="all",scope=admin?"all":"mine",current=null,messages=[],older=null,admins=[],mode="empty",error="",notice="";
    let createDraft={subject:"",module:"General",priority:"normal",description:""},reply="",files=[],updateDraft=null,lastSignature="",requestId="";
    const abort=new AbortController();
    const opts=(values,selected)=>Object.entries(values).map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("");
    const selectedFiles=()=>files.length?`<ul class="sp-selected-files">${files.map((f,i)=>`<li>${icon("paperclip")}<span>${esc(f.name)} <small>${Math.ceil(f.size/1024)} KB</small></span>${btn("removeFile","x","Remove attachment",`data-index="${i}" ${busy?"disabled":""}`)}</li>`).join("")}</ul>`:"";
    const fileInput=()=>`<label class="sp-file-input">${icon("paperclip")} Attach files <input type="file" data-sp-files multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" ${busy?"disabled":""}/></label><small>Up to 3 files, 3 MB each</small>${selectedFiles()}`;
    const attachments=(values,messageId="")=>values?.length?`<div class="sp-attachments">${values.map(f=>`<button type="button" data-sp-download="${esc(f.id)}" data-message="${esc(messageId)}" title="Download ${esc(f.name)}">${icon("file-arrow-down")}<span>${esc(f.name)}<small>${Math.ceil(f.size/1024)} KB</small></span></button>`).join("")}</div>`:"";
    function draftDirty(){return mode==="create"?createDraft.subject.trim()||createDraft.description.trim()||files.length:reply.trim()||files.length||updateDraft?.note?.trim();}
    function mayLeave(){return !busy && (!draftDirty() || global.confirm("Discard the unsaved ticket changes?"));}
    function clearDraft(){reply="";files=[];updateDraft=null;lastSignature="";requestId="";}
    function errorMessage(e){return e?.message||"Support could not complete this request. Please try again.";}
    function accessError(e){if(/permission-denied|unauthenticated/.test(e?.code||"")){current=null;messages=[];tickets=[];mode="empty";clearDraft();}}
    function renderList(){
      return `<aside class="sp-queue" aria-label="${admin?"Support queue":"My tickets"}"><div class="sp-queue-filters">${admin?`<label><span>Queue</span><select data-sp-scope ${busy?"disabled":""}>${opts({all:"All tickets",assigned:"Assigned to me",mine:"Reported by me"},scope)}</select></label>`:""}<label><span>Status</span><select data-sp-status ${busy?"disabled":""}>${opts({all:"All statuses",...STATUS},status)}</select></label></div><form class="sp-lookup"><label><span class="sr-only">Ticket reference</span><input name="reference" aria-label="Ticket reference" placeholder="Ticket reference" maxlength="20" pattern="SUP-[A-Fa-f0-9]{16}" required ${busy?"disabled":""}/></label><button type="submit" title="Find ticket" aria-label="Find ticket" ${busy?"disabled":""}>${icon("magnifying-glass")}</button></form><div class="sp-queue-label"><strong>${loading?"Refreshing...":`${tickets.length} tickets shown`}</strong><span>Newest updates</span></div><div class="sp-ticket-list" aria-busy="${loading}">${tickets.map(t=>`<button type="button" class="sp-ticket-row ${current?.id===t.id?"active":""}" data-sp-ticket="${t.id}" aria-current="${current?.id===t.id?"true":"false"}" ${busy?"disabled":""}><span class="sp-row-top"><small>${t.id}</small><i class="sp-priority ${t.priority}" title="${PRIORITY[t.priority]} priority">${PRIORITY[t.priority]}</i></span><strong>${esc(t.subject)}</strong><span>${esc(t.module)}${admin?` / ${esc(t.ownerName)}`:""}</span><div>${badge(t.status)}<small>${esc(when(t.updatedAt))}</small></div></button>`).join("") || `<div class="sp-list-empty">${icon("tray")}<p>${loading?"Loading tickets...":"No tickets in this queue"}</p></div>`}</div><footer class="sp-pagination"><small>Page ${page+1}</small><div>${btn("previous","caret-left","Previous ticket page",page===0||loading||busy?"disabled":"")}${btn("next","caret-right","Next ticket page",!next||loading||busy?"disabled":"")}</div></footer></aside>`;
    }
    function createForm(){return `<section class="sp-create"><header><div><p class="sp-eyebrow">ISSUE TICKETING</p><h2>New ticket</h2></div>${btn("cancel","x","Cancel new ticket",busy?"disabled":"")}</header><form class="sp-create-form"><fieldset ${busy?"disabled":""}><label><span>Subject</span><input name="subject" data-sp-draft="subject" value="${esc(createDraft.subject)}" maxlength="160" required placeholder="Short description of the issue"/></label><div class="sp-form-grid"><label><span>Module</span><select name="module" data-sp-draft="module">${MODULES.map(m=>`<option ${m===createDraft.module?"selected":""}>${esc(m)}</option>`).join("")}</select></label><label><span>Priority</span><select name="priority" data-sp-draft="priority">${opts(PRIORITY,createDraft.priority)}</select></label></div><label><span>Description</span><textarea name="description" data-sp-draft="description" rows="8" maxlength="6000" required placeholder="What happened, what you expected, and any error message">${esc(createDraft.description)}</textarea></label><div class="sp-upload-area">${fileInput()}</div><footer><button type="submit" class="sp-primary">${icon("paper-plane-tilt")} ${busy?"Submitting...":"Submit ticket"}</button><button type="button" data-sp-action="cancel">Cancel</button></footer></fieldset></form></section>`;}
    function adminControls(){
      if(!admin)return "";
      const draft=updateDraft||{status:current.status,priority:current.priority,assigneeUid:current.assigneeUid,note:""};
      const available=admins.some(a=>a.uid===draft.assigneeUid);
      return `<form class="sp-admin-form"><fieldset ${busy?"disabled":""}><div class="sp-form-grid admin"><label><span>Status</span><select data-sp-update="status">${opts(STATUS,draft.status)}</select></label><label><span>Priority</span><select data-sp-update="priority">${opts(PRIORITY,draft.priority)}</select></label><label><span>Assigned to</span><select data-sp-update="assigneeUid"><option value="">Unassigned</option>${draft.assigneeUid&&!available?`<option value="${esc(draft.assigneeUid)}" selected>${esc(current.assigneeName)} (unavailable)</option>`:""}${admins.map(a=>`<option value="${esc(a.uid)}" ${a.uid===draft.assigneeUid?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label></div><div class="sp-update-note"><label><span>Update / resolution note</span><input data-sp-update="note" maxlength="2000" value="${esc(draft.note)}" placeholder="Visible to the person who reported this issue"/></label><button type="submit">${icon("check")} Save update</button></div></fieldset></form>`;
    }
    function ticketDetail(){
      if(!current)return `<div class="sp-no-selection">${icon(detailLoading?"circle-notch":"lifebuoy")}<h2>${detailLoading?"Loading ticket...":"No ticket selected"}</h2></div>`;
      return `<section class="sp-detail" aria-busy="${detailLoading}"><header><div><div class="sp-reference"><span>${current.id}</span>${btn("copy","copy","Copy ticket reference")}</div><h2>${esc(current.subject)}</h2><p>${esc(current.module)} <span>/ ${PRIORITY[current.priority]} priority</span></p></div>${badge(current.status)}</header><div class="sp-owner-line"><span>${icon("user")} ${esc(current.ownerName)}</span><span>${icon("calendar-blank")} ${esc(when(current.createdAt))} SAST</span><span>${icon("user-circle-check")} ${esc(current.assigneeName)}</span></div>${adminControls()}<article class="sp-original"><h3>Reported issue</h3><p>${esc(current.description)}</p>${attachments(current.attachments)}</article><div class="sp-conversation-heading"><h3>Conversation &amp; history</h3><small>${current.messageCount} updates</small></div>${older?`<button type="button" data-sp-action="older" class="sp-older" ${busy?"disabled":""}>${icon("caret-up")} Earlier updates</button>`:""}<div class="sp-messages">${messages.map(m=>`<article class="sp-message ${m.kind==="update"?"system":""}"><header><strong>${esc(m.authorName)}</strong>${m.authorRole==="admin"?'<span class="sp-admin-label">Admin</span>':""}<time>${esc(when(m.createdAt))}</time></header><p>${esc(m.text)}</p>${attachments(m.attachments,m.id)}</article>`).join("") || '<p class="sp-no-replies">No replies yet.</p>'}</div>${["closed","resolved"].includes(current.status)?`<div class="sp-resolution">${icon("check-circle")}<span>${current.status==="closed"?"Ticket closed":"Ticket resolved"}</span><button type="button" data-sp-action="reopen" ${busy?"disabled":""}>Reopen ticket</button></div>`:""}${current.status!=="closed"?`<form class="sp-reply-form"><fieldset ${busy?"disabled":""}><label><span>Reply</span><textarea name="reply" rows="3" maxlength="6000" placeholder="Add an update...">${esc(reply)}</textarea></label><div class="sp-reply-footer"><div>${fileInput()}</div><button type="submit" class="sp-primary">${icon("paper-plane-tilt")} ${busy?"Sending...":"Send reply"}</button></div></fieldset></form>`:""}</section>`;
    }
    function render(){
      if(stopped)return;
      const focused=document.activeElement;
      const focusKey=root.contains(focused) ? ["data-sp-draft","data-sp-update","name"].map(key=>focused.hasAttribute(key)?[key,focused.getAttribute(key)]:null).find(Boolean) : null;
      const selection=focusKey && typeof focused.selectionStart==="number" ? [focused.selectionStart,focused.selectionEnd] : null;
      root.innerHTML=`<header class="sp-heading"><div><p class="sp-eyebrow">MERIDIAN NEXUS</p><h1>${admin?"Support":"My tickets"}</h1></div><div class="sp-heading-actions">${admin?`<button type="button" data-sp-action="mine">My tickets ${icon("arrow-up-right")}</button>`:onAdmin?`<button type="button" data-sp-action="admin">Admin Support ${icon("arrow-up-right")}</button>`:""}${btn("refresh","arrow-clockwise","Refresh tickets",loading||busy?"disabled":"")}${!admin?`<button class="sp-primary" type="button" data-sp-action="new" ${busy?"disabled":""}>${icon("plus")} New ticket</button>`:""}</div></header><p class="sp-feedback ${error?"error":""}" role="${error?"alert":"status"}" ${!error&&!notice?"hidden":""}>${esc(error||notice)}</p><div class="sp-layout ${mode!=="empty"?"has-detail":""}">${renderList()}<div class="sp-content">${mode!=="empty"?`<button type="button" class="sp-back" data-sp-action="back" ${busy?"disabled":""}>${icon("arrow-left")} Tickets</button>`:""}${mode==="create"?createForm():ticketDetail()}</div></div>`;
      if(focusKey){const target=root.querySelector(`[${focusKey[0]}="${CSS.escape(focusKey[1])}"]`);target?.focus({preventScroll:true});if(selection && target?.setSelectionRange)target.setSelectionRange(...selection);}
    }
    async function loadList(cursor=cursors[page],quiet=false){
      const serial=++listRequest;loading=true;if(!quiet)error="";render();
      try{const result=await call({action:"list",scope,status,cursor});if(stopped||serial!==listRequest)return;tickets=result.tickets;next=result.next;}
      catch(e){if(stopped||serial!==listRequest)return;tickets=[];next=null;accessError(e);error=errorMessage(e);}
      finally{if(!stopped&&serial===listRequest){loading=false;render();}}
    }
    async function openTicket(ticketId,{preserve=false,before=null}={}){
      const serial=++detailRequest;mode="detail";detailLoading=true;error="";
      if(!preserve){current=null;messages=[];older=null;clearDraft();}render();
      try{
        const result=await call({action:"get",ticketId,...(before?{before}:{})});if(stopped||serial!==detailRequest)return;
        current=result.ticket;messages=before?[...result.messages,...messages]:result.messages;older=result.older;
      }catch(e){if(stopped||serial!==detailRequest)return;accessError(e);error=errorMessage(e);}
      finally{if(!stopped&&serial===detailRequest){detailLoading=false;render();}}
    }
    async function encodeFiles(){
      return Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error(`Could not read ${file.name}`));reader.onload=()=>resolve({name:file.name,base64:String(reader.result).split(",")[1]});reader.readAsDataURL(file);})));
    }
    async function save(payload,withFiles=false){
      if(busy)return;busy=true;error="";notice="";render();
      try{
        const encoded=withFiles?await encodeFiles():[];if(stopped)return;
        const body={...payload,...(withFiles?{attachments:encoded}:{})},signature=JSON.stringify(body);
        if(signature!==lastSignature){lastSignature=signature;requestId=global.crypto.randomUUID();}
        const result=await call({...body,requestId});if(stopped)return;
        clearDraft();createDraft={subject:"",module:"General",priority:"normal",description:""};notice=payload.action==="create"?`Ticket ${result.ticketId} submitted.`:"Ticket updated.";
        await openTicket(result.ticketId);page=0;cursors=[null];await loadList(null,true);
      }catch(e){if(stopped)return;accessError(e);error=errorMessage(e);}
      finally{if(!stopped){busy=false;render();}}
    }
    root.addEventListener("input",e=>{
      const t=e.target;
      if(t.dataset.spDraft)createDraft[t.dataset.spDraft]=t.value;
      if(t.name==="reply")reply=t.value;
      if(t.dataset.spUpdate){updateDraft??={status:current.status,priority:current.priority,assigneeUid:current.assigneeUid,note:""};updateDraft[t.dataset.spUpdate]=t.value;}
    },{signal:abort.signal});
    root.addEventListener("change",e=>{
      const t=e.target;if(busy)return;
      if(t.matches("[data-sp-status],[data-sp-scope]")){if(t.matches("[data-sp-status]"))status=t.value;else scope=t.value;page=0;cursors=[null];loadList(null);}
      if(t.matches("[data-sp-files]")){
        const chosen=[...files,...t.files];
        if(chosen.length>3||chosen.some(f=>!f.size||f.size>3*1024*1024||!/\.(png|jpe?g|webp|pdf|txt|csv)$/i.test(f.name)))error="Attach up to three PNG, JPG, WebP, PDF, TXT or CSV files, no larger than 3 MB each.";
        else{files=chosen;error="";}render();
      }
    },{signal:abort.signal});
    root.addEventListener("submit",e=>{
      e.preventDefault();if(busy)return;
      if(e.target.matches(".sp-lookup")){if(mayLeave())openTicket(new FormData(e.target).get("reference").toUpperCase().trim());}
      if(e.target.matches(".sp-create-form"))save({action:"create",...createDraft},true);
      if(e.target.matches(".sp-reply-form")){if(!reply.trim()&&!files.length){error="Enter a reply or attach a file.";render();return;}save({action:"reply",ticketId:current.id,text:reply},true);}
      if(e.target.matches(".sp-admin-form")){const d=updateDraft||{status:current.status,priority:current.priority,assigneeUid:current.assigneeUid,note:""};save({action:"update",ticketId:current.id,revision:current.revision,...d});}
    },{signal:abort.signal});
    root.addEventListener("click",async e=>{
      const t=e.target.closest("button");if(!t||t.disabled)return;
      if(t.dataset.spTicket){if(mayLeave())openTicket(t.dataset.spTicket);return;}
      if(t.dataset.spDownload){
        t.disabled=true;const selected=current.id;
        try{const f=await call({action:"download",ticketId:selected,attachmentId:t.dataset.spDownload,messageId:t.dataset.message||undefined});if(stopped||current?.id!==selected)return;
          const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:"application/octet-stream"})),link=document.createElement("a");link.href=url;link.download=f.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }catch(err){if(!stopped){accessError(err);error=errorMessage(err);render();}}finally{t.disabled=false;}return;
      }
      const action=t.dataset.spAction;
      if(action==="new"&&mayLeave()){detailRequest++;detailLoading=false;messages=[];older=null;clearDraft();createDraft={subject:"",module:"General",priority:"normal",description:""};mode="create";current=null;error="";notice="";render();root.querySelector('[name="subject"]').focus();}
      if(["cancel","back"].includes(action)&&mayLeave()){detailRequest++;detailLoading=false;messages=[];older=null;mode="empty";current=null;clearDraft();error="";render();}
      if(action==="removeFile"){files.splice(Number(t.dataset.index),1);render();}
      if(action==="next"&&next){page++;cursors[page]=next;loadList(next);}
      if(action==="previous"&&page>0){page--;loadList(cursors[page]);}
      if(action==="refresh"){loadList();if(current)openTicket(current.id,{preserve:true});}
      if(action==="older"&&older)openTicket(current.id,{preserve:true,before:older});
      if(action==="reopen")save({action:"reopen",ticketId:current.id,revision:current.revision});
      if(action==="copy"){try{await navigator.clipboard.writeText(current.id);notice="Ticket reference copied.";error="";}catch{error="Could not copy the ticket reference.";}render();}
      if(action==="admin"&&mayLeave())onAdmin?.();
      if(action==="mine"&&mayLeave())onMine?.();
    },{signal:abort.signal});
    render();loadList();
    if(admin)call({action:"directory"}).then(result=>{if(!stopped){admins=result.admins;render();}}).catch(e=>{if(!stopped){accessError(e);error=errorMessage(e);render();}});
    return {stop(){stopped=true;listRequest++;detailRequest++;abort.abort();tickets=[];messages=[];current=null;files=[];root.replaceChildren();}};
  }
  global.MeridianSupport={mount};
})(window);
