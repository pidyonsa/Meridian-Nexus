(() => {
  const external = new URL(location.href).searchParams.has("client");
  const actor = { uid: external ? "client" : "admin", name: external ? "Client contact" : "Meridian administrator", audience: external ? "external" : "internal", admin: !external, clientId: external ? "sample-client" : "" };
  const people = [
    { uid: "admin", name: "Meridian administrator", audience: "internal", workRole: "Administration" },
    { uid: "rep", name: "Alex Jacobs", audience: "internal", workRole: "Sales rep", region: "Gauteng" },
    { uid: "merch", name: "Lerato Nkosi", audience: "internal", workRole: "Merchandiser", region: "Gauteng" },
    { uid: "manager", name: "Sam Williams", audience: "internal", workRole: "Manager", region: "Gauteng" },
    { uid: "client", name: "Client contact", audience: "external", workRole: "Client" }
  ];
  const members = ids => Object.fromEntries(people.filter(p => ids.includes(p.uid)).map(p => [p.uid, p]));
  const now = Date.now();
  const room = (id, name, type, ids, extra = {}) => ({ id, name, type, memberIds: ids, members: members(ids), ownerUid: "admin", workstream: "General", region: "Gauteng", store: "", description: "", archived: false, lastSequence: 0, lastPreview: "No messages yet", updatedAt: now, ...extra });
  const rooms = [
    room("field", "Gauteng / Field operations", "team", ["admin", "rep", "merch", "manager"], { description: "Daily coordination for Gauteng field teams.", workstream: "Stock Fix", lastPreview: "Confirmed. The shelf has been replenished.", lastSequence: 3 }),
    room("announcements", "Field team announcements", "announcement", ["admin", "rep", "merch", "manager"], { description: "Weekly priorities and operational updates.", lastPreview: "September store visit priorities", lastSequence: 1 }),
    room("direct", "Direct message", "direct", ["admin", "manager"], { lastPreview: "Can we review tomorrow's call cycle?", lastSequence: 1 })
  ];
  const message = (id, senderUid, text, sequence) => ({ id, senderUid, senderName: people.find(p => p.uid === senderUid).name, text, sequence, createdAt: now - (6 - sequence) * 60000 });
  const messages = {
    field: [message("m1", "rep", "Morning team. The stock count at our Sandton store is complete. There is stock in the back room, but two lines are not on shelf.", 1), message("m2", "admin", "Please confirm replenishment with the store manager and update Stock Fix after the shelf check.", 2), message("m3", "merch", "Confirmed. The shelf has been replenished.", 3)],
    "client-room": [message("c1", "rep", "The store checks are ready for your review.", 1)],
    announcements: [message("a1", "admin", "September store visit priorities", 1)],
    direct: [message("d1", "manager", "Can we review tomorrow's call cycle?", 1)]
  };
  const listeners = new Set(), calls = [], reads = [], aiCalls = [], aiOptions = [], tasks = [], mediaFiles = new Map();
  function watch(produce, next, error) { const run = () => { try { next(produce()); } catch (e) { error(e); } }; listeners.add(run); queueMicrotask(run); return () => listeners.delete(run); }
  let revoked = false;
  const assigned = id => { const found = rooms.find(r => r.id === id); if (revoked || !found?.memberIds.includes(actor.uid)) throw new Error("This conversation is no longer assigned to you."); return found; };
  const emit = () => listeners.forEach(fn => fn());
  const service = {
    async ask(question, options = {}) {
      aiCalls.push(question);
      aiOptions.push(options);
      if (window.chatTest.holdAI) await new Promise(resolve => { window.chatTest.finishAI = resolve; });
      await new Promise(resolve => setTimeout(resolve, 60));
      if (window.chatTest.failAI) throw new Error("The assistant is temporarily unavailable.");
      if (options.intent === "task-draft") return { draftId: "draft-123", draft: { title: "Review missed store visits", note: "Confirm the gaps with the manager before changing the call cycle.", store: "Sandton", product: "", priority: "normal" } };
      return { answer: window.chatTest.aiAnswer || "Start with the stores showing repeated missed visits.\n\nCompare the current attendance report with the planned call cycle, then confirm any gaps with the assigned manager.\n\nThe next step is to review the affected stores before changing the schedule.", scope: "Sample data / permitted attendance and call cycle summaries" };
    },
    async media(data) {
      calls.push({ ...data, base64: undefined }); assigned(data.roomId);
      if (data.action === "upload") { const value = { ...data, id: data.requestId, size: atob(data.base64).length, mime: data.kind === "voice" ? "audio/webm" : "text/csv" }; mediaFiles.set(value.id, value); return value; }
      return mediaFiles.get(data.attachmentId);
    },
    rooms(_, cursor, next, error) { return watch(() => { if (revoked) throw new Error("Chat access has been removed."); return { rows: rooms.filter(r => r.memberIds.includes(actor.uid)), more: false }; }, next, error); },
    room(id, next, error) { return watch(() => ({ ...assigned(id) }), next, error); },
    task(id, next, error) { return watch(() => { const task = tasks.find(task => task.id === id); assigned(task.roomId); return { ...task }; }, next, error); },
    messages(id, cursor, next, error) { return watch(() => { assigned(id); return { rows: [...(messages[id] || [])], more: false }; }, next, error); },
    receipts(id, next, error) { return watch(() => { assigned(id); return [{ id: "rep", sequence: 2 }]; }, next, error); },
    reads(uid, ids, next, error) { return watch(() => reads.filter(value => ids.includes(value.id)), next, error); },
    async message(roomId, id) { assigned(roomId); return messages[roomId].find(m => m.id === id); },
    async call(data) {
      calls.push(data);
      await new Promise(resolve => setTimeout(resolve, 60));
      if (revoked) throw new Error("Chat access has been removed.");
      if (data.action === "assistantClear" || data.action === "notifications") return {};
      if (data.action === "roomGet") return { room: assigned(data.roomId) };
      if (data.action === "bootstrap") return { actor, workstreams: ["General", "Stock Fix", "Time & Attendance", "Call Cycle", "Orders", "Sales & Inventory"] };
      if (data.action === "directory") return { people: people.filter(p => p.uid !== actor.uid && p.audience === (data.audience || "internal")), nextCursor: null };
      if (data.action === "create") {
        const id = crypto.randomUUID(); rooms.unshift(room(id, data.name, data.type, [actor.uid, ...data.memberIds], { ...data, memberIds: [actor.uid, ...data.memberIds] })); messages[id] = []; emit(); return { roomId: id };
      }
      if (data.action === "taskList") {
        const all=tasks.filter(task=>data.roomId?task.roomId===data.roomId:data.scope==='created'?task.createdBy===actor.uid:task.assigneeUid===actor.uid);
        const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}),active=t=>!['completed','cancelled'].includes(t.status),f=data.filters||{};
        const counts={active:all.filter(active).length,today:all.filter(t=>active(t)&&t.dueDate===today).length,overdue:all.filter(t=>active(t)&&t.dueDate&&t.dueDate<today).length,blocked:all.filter(t=>t.status==='blocked').length};
        return {tasks:all.filter(t=>(!f.status||f.status==='all'||(f.status==='active'?active(t):t.status===f.status))&&(!f.priority||f.priority==='all'||t.priority===f.priority)&&(!f.query||[t.title,t.store,t.product].join(' ').toLowerCase().includes(f.query.toLowerCase()))&&(!f.due||f.due==='all'||(f.due==='none'?!t.dueDate:active(t)&&(f.due==='today'?t.dueDate===today:f.due==='overdue'?t.dueDate&&t.dueDate<today:t.dueDate>today)))).map(t=>({...t})),nextCursor:null,counts};
      }
      if (data.action === "taskGet") { const task = tasks.find(task => task.id === data.taskId), r = assigned(task.roomId); return { task: { ...task }, members: Object.values(r.members), canManage: true, canUpdate: true, canAssign: true, archived: r.archived }; }
      if (data.action === "taskUpdate") {
        const task = tasks.find(task => task.id === data.taskId); assigned(task.roomId);
        if (task.revision !== data.revision) throw new Error("This task changed. Reopen it.");
        Object.assign(task, data.fields || {}, { status: data.status, checklist:data.checklist||task.checklist||[],requireCompletionNote:data.requireCompletionNote===true, progressNote: data.progressNote, revision: task.revision + 1, updatedAt: Date.now() });
        task.assigneeName = people.find(p => p.uid === task.assigneeUid).name;
        emit(); return { taskId: task.id, revision: task.revision };
      }
      const r = assigned(data.roomId);
      if (data.action === "taskCreate" || data.action === "taskCreateReviewed" || data.action === "taskCreateDirect") {
        const existing = tasks.find(task => task.requestId === data.requestId); if (existing) return { taskId: existing.id };
        const task = { ...data, id: crypto.randomUUID(), sourceMessageId: data.messageId, createdBy: actor.uid, assigneeName: people.find(p => p.uid === data.assigneeUid).name, status: "open", revision: 1, updatedAt: Date.now() }; tasks.push(task);
        const source = messages[r.id].find(m => m.id === data.messageId); if (source) source.taskIds = [...(source.taskIds || []), task.id]; emit();
        if (window.chatTest.failTaskAfterSave) throw new Error("Connection interrupted after task creation. Retry safely.");
        return { taskId: task.id };
      }
      if (data.action === "react") { const message = messages[r.id].find(m => m.id === data.messageId); message.reactions ||= {}; if (data.reaction) message.reactions[actor.uid] = data.reaction; else delete message.reactions[actor.uid]; }
      if (data.action === "send") {
        if (window.chatTest.failSend) throw new Error("Connection interrupted. Retry your message.");
        const existing = messages[r.id].find(m => m.requestId === data.requestId); if (existing) return { messageId: existing.id };
        const value = { ...message(crypto.randomUUID(), actor.uid, data.text, ++r.lastSequence), ...data, attachments: (data.attachmentIds || []).map(id => { const file = mediaFiles.get(id); return { id, name: file.name, size: file.size, kind: file.kind, mime: file.mime, duration: file.duration }; }) }; messages[r.id].push(value); r.lastPreview = data.text; emit();
        if (window.chatTest.failSendAfterSave) { window.chatTest.failSendAfterSave = false; throw Object.assign(new Error("Connection interrupted after send."), { code: "unavailable" }); }
        return { messageId: value.id };
      }
      if (data.action === "read") { const old = reads.find(value => value.id === r.id); if (old) old.sequence = data.sequence; else reads.push({ id: r.id, sequence: data.sequence }); }
      if (data.action === "archive") r.archived = data.archived;
      if (data.action === "members") { r.memberIds = [...new Set([actor.uid, ...data.memberIds])]; r.members = members(r.memberIds); }
      if (data.action === "pin") r.pinnedMessageId = r.pinnedMessageId === data.messageId ? null : data.messageId;
      if (["edit", "remove"].includes(data.action)) { const value = messages[r.id].find(m => m.id === data.messageId); value.text = data.text || ""; value.removed = data.action === "remove"; value.editedAt = Date.now(); }
      emit(); return {};
    }
  };
  const nav = document.querySelector(".nexus-workspace-nav");
  for (const [name, glyph] of [["Insights", "chart-line"], ["Call Cycle", "clock-counter-clockwise"], ["Training hub", "graduation-cap"], ["Stock Fix", "package"], ["Meridian Chat", "chats-circle"], ["Resources", "files"]]) {
    const button = document.createElement("button"); button.innerHTML = `<i class="ph ph-${glyph}"></i><span>${name}</span>`;
    if (name === "Meridian Chat") button.className = "active";
    nav.insertBefore(button, nav.querySelector("[data-open-view=automation]"));
  }
  if (external) [...nav.children].forEach(node => { node.hidden = !node.textContent.includes("Meridian Chat"); });
  const session = MeridianChat.mount(document.getElementById("meridianChat"), service, actor.uid);
  window.chatTest = { session, service, calls, aiCalls, aiOptions, rooms, messages, tasks, emit, failSend: false, revoke() { revoked = true; emit(); }, listeners: () => listeners.size };
  document.querySelector(".nexus-session-button").textContent = "Local preview / sample data";
})();
