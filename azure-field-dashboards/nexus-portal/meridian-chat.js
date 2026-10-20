/* Meridian adaptation of SIGDAHUILA's direct/group messaging workflows. */
(() => {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const tool = (action, name, glyph, extra = "") => `<button type="button" class="mc-tool" data-action="${action}" title="${name}" aria-label="${name}" ${extra}>${icon(glyph)}</button>`;
  const millis = value => value?.toMillis?.() || (value ? new Date(value).getTime() : 0);
  const time = value => millis(value) ? new Date(millis(value)).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "";
  const date = value => millis(value) ? new Date(millis(value)).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "";
  const initials = name => String(name || "M").split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const rows = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const emoji = [
    ["like", 0x1f44d, "Thumbs up"], ["heart", 0x2764, "Heart"], ["laugh", 0x1f602, "Laugh"], ["celebrate", 0x1f389, "Celebrate"], ["surprised", 0x1f62e, "Surprised"], ["sad", 0x1f622, "Sad"], ["thanks", 0x1f64f, "Thanks"],
    ["smile", 0x1f60a, "Smile"], ["grin", 0x1f600, "Grin"], ["wink", 0x1f609, "Wink"], ["think", 0x1f914, "Thinking"], ["clap", 0x1f44f, "Applause"], ["wave", 0x1f44b, "Wave"], ["strong", 0x1f4aa, "Strong"], ["check", 0x2705, "Complete"], ["warn", 0x26a0, "Warning"], ["pin", 0x1f4cc, "Pin"], ["shop", 0x1f3ea, "Store"], ["box", 0x1f4e6, "Stock"], ["truck", 0x1f69a, "Delivery"], ["calendar", 0x1f4c5, "Calendar"], ["photo", 0x1f4f7, "Photo"], ["chart", 0x1f4c8, "Growth"], ["target", 0x1f3af, "Target"]
  ].map(([key, code, label]) => ({ key, glyph: String.fromCodePoint(code), label }));
  const statusLabels = { open: "Open", "in-progress": "In progress", blocked: "Blocked", completed: "Completed", cancelled: "Cancelled" };

  function firebaseAdapter(db, callFunction) {
    const rooms = db.collection("meridianChatRooms");
    return {
      call: data => callFunction("meridianChat", data),
      ask: (question, options = {}) => callFunction("askNexusAssistant", { ...options, question, model: "gemini-3.5-flash" }),
      media: data => callFunction("meridianChatMedia", data),
      profile(uid, next, error) { return db.collection('adminUsers').doc(uid).onSnapshot(s => next(s.exists ? s.data() : null), error); },
      rooms(actor, cursor, next, error) {
        let q = rooms.where("memberIds", "array-contains", actor.uid);
        if (actor.audience === "external") q = q.where("type", "==", "client").where("clientId", "==", actor.clientId);
        q = q.orderBy("updatedAt", "desc").limit(50);
        if (cursor) q = q.startAfter(cursor);
        return q.onSnapshot({ includeMetadataChanges: true }, s => next({ rows: rows(s), cursor: s.docs.at(-1), more: s.size === 50, cached: s.metadata.fromCache }), error);
      },
      room(id, next, error) { return rooms.doc(id).onSnapshot(s => s.exists ? next({ ...s.data(), id: s.id }) : error(new Error("Conversation no longer available.")), error); },
      task(id, next, error) { return db.collection("meridianChatTasks").doc(id).onSnapshot(s => s.exists ? next({ ...s.data(), id: s.id }) : error(new Error("Task no longer available.")), error); },
      messages(id, cursor, next, error) {
        let q = rooms.doc(id).collection("messages").orderBy("sequence", "desc").limit(50);
        if (cursor) q = q.startAfter(cursor);
        return q.onSnapshot(s => next({ rows: rows(s).reverse(), cursor: s.docs.at(-1), more: s.size === 50 }), error);
      },
      receipts(id, next, error) { return rooms.doc(id).collection("receipts").limit(50).onSnapshot(s => next(rows(s)), error); },
      reads(uid, ids, next, error) {
        const pages = new Map(), stops = [];
        for (let offset = 0; offset < ids.length; offset += 30) {
          const key = offset;
          stops.push(db.collection("meridianChatReads").doc(uid).collection("rooms").where("__name__", "in", ids.slice(offset, offset + 30)).onSnapshot(s => {
            pages.set(key, rows(s)); next([...pages.values()].flat());
          }, error));
        }
        if (!ids.length) next([]);
        return () => stops.forEach(stop => stop());
      },
      message(roomId, id) { return rooms.doc(roomId).collection("messages").doc(id).get().then(s => s.exists ? { ...s.data(), id: s.id } : null); }
    };
  }

  function mount(root, service, uid) {
    const originalService = service;
    service = { ...service, call: data => originalService.call({ ...data, expectedUid: uid }),
      ...(service.media ? { media: data => originalService.media({ ...data, expectedUid: uid }) } : {}),
      ...(service.ask ? { ask: (question, options = {}) => originalService.ask(question, { ...options, expectedUid: uid }) } : {}) };
    const extras = window.MeridianChatTools;
    let queued = [], selectedFiles = [], recording = null, recordingSeconds = 0, queueTimer, pushKey = "", queueVersion = 0;
    let assistantSession = crypto.randomUUID(), assistantRequest = null;
    const mediaUrls = new Map();
    let previewMessageId = null;
    let visibleInNexus = true;
    let alive = true, actor, streams = [], roomStreams = [], inboxStop, messagesStop, readsStop, readsKey = "", roomVersion = 0;
    let inbox = [], readPositions = new Map(), receipts = [], messages = [], current = null;
    let inboxPage = { more: false }, messagePage = { more: false }, inboxCursors = [], messageCursors = [];
    let query = "", mode = "all", reply = null, editing = null, sendRequest = null, sending = false;
    let directory = new Map(), selected = new Set(), directoryCursor = null, directoryMode = "internal", directoryVersion = 0;
    let dialogMode = "create", readTimer, lastRead = 0, bootTimer, profileStop, accessVersion = 0;
    let assistantOpen = false, assistantTurns = [], assistantDraft = "", assistantBusy = false, assistantError = "", assistantVersion = 0;
    let emojiTarget = null, emojiSelection = [0, 0], menuMessage = null, holdTimer;
    let tasksOpen = false, taskRoomId = null, taskRows = [], taskCursor = null, taskNextCursor = null, taskStops = [], taskListVersion = 0, taskFilter = "active";
    let taskContext = null, taskDialogVersion = 0, taskWatch, taskRequest = null;
    let taskDue="all",taskScope="mine",taskPriority="all",taskQuery="",taskSearchTimer;
    const drafts = new Map();
    root.innerHTML = `<header class="mc-workspace-head"><div><span class="mc-kicker">MERIDIAN NEXUS</span><h1>Chat</h1></div><span class="mc-connection" role="status">Connecting...</span>${tool("notifications", "Notification settings", "bell")}</header>
      <div class="mc-alert" role="alert" hidden></div>
      <div class="mc-layout">
        <section class="mc-inbox" aria-label="Conversations">
          <header><h2>Messages</h2>${tool("new", "New conversation", "note-pencil", "hidden")}</header>
          <button type="button" class="mc-assistant-entry" data-action="assistant" aria-current="false" hidden><span class="mc-avatar mc-ai-avatar">${icon("sparkle")}</span><span><strong>Nexus Assistant</strong><small>Private AI session</small></span>${icon("caret-right")}</button>
          <button type="button" class="mc-tasks-entry" data-action="my-tasks" hidden>${icon("check-square")}<span>My Tasks</span>${icon("caret-right")}</button>
          <label class="mc-search">${icon("magnifying-glass")}<input name="conversationSearch" type="search" placeholder="Search conversations" aria-label="Search this page of conversations" /></label>
          <div class="mc-tabs" role="group" aria-label="Conversation filter"><button data-mode="all" aria-pressed="true">All</button><button data-mode="unread" aria-pressed="false">Unread</button><button data-mode="archived" aria-pressed="false">Archived</button></div>
          <div class="mc-rooms"><p class="mc-empty">Loading conversations...</p></div>
          <footer class="mc-inbox-pages">${tool("inbox-back", "Previous conversations", "caret-left", "disabled")}<span>Recent conversations</span>${tool("inbox-next", "Older conversations", "caret-right", "disabled")}</footer>
        </section>
        <section class="mc-thread" aria-label="Selected conversation"><div class="mc-welcome">${icon("chats-circle")}<h2>Your Meridian conversations</h2><p>Select a conversation</p></div></section>
      </div>
      <dialog class="mc-dialog" aria-labelledby="mc-dialog-title"><form class="mc-room-form">
        <header><h2 id="mc-dialog-title">New conversation</h2>${tool("dialog-close", "Close", "x")}</header>
        <div class="mc-dialog-error" role="alert" hidden></div>
        <div class="mc-form-grid">
          <label>Conversation type<select name="type"><option value="direct">Direct message</option><option value="team">Team</option><option value="announcement">Announcements</option></select></label>
          <label data-group-field hidden>Name<input name="name" maxlength="80" /></label>
          <label data-client-field hidden>Client account key<input name="clientId" maxlength="64" pattern="[a-z0-9][a-z0-9_\\-]{1,63}" /></label>
          <label data-group-field hidden>Workstream<select name="workstream"></select></label>
          <label data-group-field hidden>Region<input name="region" maxlength="80" /></label>
          <label data-group-field hidden>Store<input name="store" maxlength="120" /></label>
          <label data-group-field class="mc-wide" hidden>Description<textarea name="description" maxlength="240" rows="2"></textarea></label>
        </div>
        <div class="mc-directory-tools"><label class="mc-search">${icon("magnifying-glass")}<input name="personSearch" type="search" placeholder="Search loaded people" aria-label="Search loaded people" /></label><input type="hidden" name="audience" value="internal" />${tool("directory-refresh", "Load staff", "arrows-clockwise")}</div>
        <div class="mc-selection" aria-live="polite"></div><div class="mc-people"></div><button class="mc-link" type="button" data-action="directory-more" hidden>Load more people</button>
        <p class="mc-history-notice">Assigned participants can read the entire conversation history.</p>
        <footer><button type="button" data-action="dialog-close">Cancel</button><button class="mc-primary" type="submit">Create conversation</button></footer>
      </form></dialog>
      <dialog class="mc-picker" aria-label="Emoji picker"><header><h2>Emoji</h2>${tool("picker-close", "Close", "x")}</header><input name="emojiSearch" type="search" aria-label="Search emoji" placeholder="Search emoji" /><div class="mc-emoji-grid"></div></dialog>
      <dialog class="mc-actions" aria-label="Message actions"><header><h2>Message</h2>${tool("actions-close", "Close", "x")}</header><div class="mc-action-list"></div></dialog>
      <dialog class="mc-task-dialog" aria-labelledby="mc-task-title"><form class="mc-task-form"><header><h2 id="mc-task-title">Create task</h2>${tool("task-close", "Close task", "x")}</header><p class="mc-task-audience">Visible to this conversation's participants.</p><div class="mc-task-error" role="alert" hidden></div><div class="mc-form-grid">
        <label class="mc-wide" data-ai-room hidden>Share task with<select name="taskRoom"></select></label>
        <label class="mc-wide">Task<input name="title" maxlength="180" required /></label>
        <label>Assigned to<select name="assigneeUid" required></select></label><label>Due date<input name="dueDate" type="date" /></label>
        <label class="mc-wide">Reminder (Johannesburg)<input name="remindAt" type="datetime-local" /></label>
        <label>Priority<select name="priority"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option></select></label>
        <label>Status<select name="status">${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label>
        <label>Store<input name="store" maxlength="120" /></label><label>Product<input name="product" maxlength="160" /></label>
        <label class="mc-wide">Task note<textarea name="note" rows="3" maxlength="2000"></textarea></label>
        <label class="mc-wide" data-progress>Progress / completion note<textarea name="progressNote" rows="3" maxlength="2000"></textarea></label>
        <section class="mc-wide mc-checklist-section"><header><h3>Checklist</h3><button type="button" data-action="task-add-step" title="Add checklist step"><i class="ph ph-plus" aria-hidden="true"></i> Add step</button></header><div class="mc-task-checklist"></div><label class="mc-completion-rule"><input type="checkbox" name="requireCompletionNote"> Completion note required</label></section><section class="mc-wide mc-task-history"></section>
      </div><footer><button type="button" data-action="task-close">Cancel</button><button type="submit" class="mc-primary">Create task</button></footer></form></dialog>
      <dialog class="mc-notification-dialog"><header><h2>Notifications</h2>${tool("notifications-close", "Close", "x")}</header><p>Message alerts and task reminders on this device. Message content stays off the lock screen.</p><p class="mc-notification-state" role="status"></p><footer><button data-action="notifications-off">Turn off</button><button data-action="notifications-on" class="mc-primary">Enable notifications</button></footer></dialog>
      <dialog class="mc-media-dialog"><header><h2>Attachment</h2>${tool("media-close", "Close attachment", "x")}</header><div class="mc-media-preview"></div></dialog>`;
    const $ = selector => root.querySelector(selector);
    const outbox = extras?.queue(uid, service, () => refreshQueue().catch(report), () => alive && !!actor);
    async function refreshQueue() {
      const version = ++queueVersion;
      const values = extras ? await extras.list(uid) : [];
      if (!alive || version !== queueVersion) return;
      queued = values;
      if ($(".mc-outbox")) $(".mc-outbox").innerHTML = queued.filter(row => row.data.roomId === current?.id).map(row => `<div class="mc-pending"><span><strong>${escape(row.data.text || row.files.map(file => file.name).join(", "))}</strong><small>${escape(row.status === "sending" ? "Sending..." : row.status === "failed" ? row.error : navigator.onLine ? "Queued for retry" : "Queued / offline")}</small></span>${row.status !== "sending" ? `${tool("queue-retry", "Retry queued message", "arrows-clockwise", `data-queue="${escape(row.id)}"`)}${tool("queue-remove", "Delete queued message", "trash", `data-queue="${escape(row.id)}"`)}` : ""}</div>`).join("");
    }
    function clearMedia() {
      recording?.cancel(); recording = null; selectedFiles = [];
      stopPlayback();
      for (const url of mediaUrls.values()) URL.revokeObjectURL(url);
      mediaUrls.clear(); $(".mc-media-dialog")?.close(); $(".mc-media-preview")?.replaceChildren();
      previewMessageId = null;
    }
    function renderFiles() {
      if (!$(".mc-attachments")) return;
      $(".mc-attachments").innerHTML = selectedFiles.map(file => `<div class="mc-pending"><span>${icon(file.kind === "voice" ? "microphone" : "paperclip")} ${escape(file.name)}<small>${(file.blob.size / 1024).toFixed(0)} KB${file.kind === "voice" ? ` / ${file.duration.toFixed(0)} sec` : ""}</small></span>${file.kind === "voice" ? tool("voice-preview", "Preview voice note", "play", `data-file="${file.localId}"`) : ""}${tool("file-remove", "Remove attachment", "x", `data-file="${file.localId}"`)}</div>`).join("") + (recording ? `<div class="mc-recording" role="status">${icon("microphone")} Recording ${recordingSeconds}s / 120s ${tool("voice-stop", "Finish recording", "stop")}${tool("voice-cancel", "Cancel recording", "x")}</div>` : "");
    }
    function attachmentMarkup(message) {
      return (message.attachments || []).map(file => `<button type="button" class="mc-attachment" data-action="file-open" data-file="${escape(file.id)}">${icon(file.kind === "voice" ? "play-circle" : "file-arrow-down")}<span>${escape(file.kind === "voice" ? "Voice note" : file.name)}<small>${Math.ceil(file.size / 1024)} KB${file.duration ? ` / ${file.duration}s` : ""}</small></span></button>`).join("");
    }
    function previewBlob(blob, name, play = false) {
      stopPlayback();
      previewMessageId = null;
      const old = mediaUrls.get("preview"); if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(blob); mediaUrls.set("preview", url);
      $(".mc-media-dialog h2").textContent = name;
      const container = $(".mc-media-preview"); container.replaceChildren();
      if (blob.type.startsWith("audio/")) { const player = document.createElement("audio"); player.controls = true; player.src = url; container.append(player); if (play) player.play().catch(() => {}); }
      else if (blob.type.startsWith("image/")) { const img = document.createElement("img"); img.alt = name; img.src = url; container.append(img); }
      const link = document.createElement("a"); link.href = url; link.download = name; link.textContent = "Download"; container.append(link);
      $(".mc-media-dialog").showModal();
    }
    function stopPlayback() {
      for (const player of root.querySelectorAll('.mc-media-preview audio')) { player.pause(); player.removeAttribute("src"); player.load(); }
    }
    async function downloadAttachment(message, attachmentId) {
      const version = roomVersion;
      const result = await service.media({ action: "download", roomId: current.id, messageId: message.id, attachmentId });
      if (!alive || version !== roomVersion || messages.find(row => row.id === message.id)?.removed) return;
      previewBlob(new Blob([Uint8Array.from(atob(result.base64), char => char.charCodeAt(0))], { type: result.mime }), result.name);
      previewMessageId = message.id;
    }
    function startRecording() {
      if (!extras || !writable() || recording || selectedFiles.length >= 3 || editing) return;
      const version = roomVersion; recordingSeconds = 0;
      recording = extras.recorder(file => { if (alive && version === roomVersion) { selectedFiles.push(file); recording = null; renderFiles(); } }, seconds => { if (alive && version === roomVersion) { recordingSeconds = seconds; renderFiles(); } }, error => { if (alive && version === roomVersion) { recording = null; renderFiles(); report(error); } });
      renderFiles();
    }
    const navToggle = root.closest("#chatView")?.querySelector(".mc-nav-toggle");
    const toggleNav = () => { const open = navToggle.getAttribute("aria-expanded") !== "true"; navToggle.setAttribute("aria-expanded", open); navToggle.closest("aside").classList.toggle("chat-nav-open", open); };
    navToggle?.addEventListener("click", toggleNav);
    const connection = message => { if (alive) $(".mc-connection").textContent = message; };
    function report(error, dialog = false) {
      if (!alive) return;
      const target = $(dialog ? ".mc-dialog-error" : ".mc-alert");
      target.hidden = false;
      target.textContent = error?.message || "Chat could not complete this request. Try again.";
    }
    function clearError() { $(".mc-alert").hidden = true; $(".mc-dialog-error").hidden = true; }
    function title(room) { return room.type === "direct" ? Object.values(room.members).find(person => person.uid !== uid)?.name || "Direct message" : room.name; }
    function manager() { return actor?.audience !== "external" && (actor?.admin || current?.ownerUid === uid); }
    function capability(key) { return actor?.capabilities?.[key] ?? actor?.admin ?? false; }
    function writable() { return actor && current && !current.archived && (current.type !== "announcement" || manager()); }
    function stopRoom() {
      window.NexusComms?.openRoom(null);
      clearMedia();
      ++roomVersion;
      assistantOpen = false;
      tasksOpen = false; taskRows = []; ++taskListVersion; taskStops.splice(0).forEach(stop => stop()); closeTask();
      $(".mc-picker").close(); $(".mc-actions").close(); clearTimeout(holdTimer);
      roomStreams.splice(0).forEach(stop => stop()); messagesStop?.(); messagesStop = null;
      clearTimeout(readTimer); current = null; receipts = []; messages = []; reply = null; editing = null; lastRead = 0; sendRequest = null;
    }
    function clearAssistant() {
      ++assistantVersion; assistantTurns = []; assistantDraft = ""; assistantBusy = false; assistantError = "";
      assistantSession = crypto.randomUUID(); assistantRequest = null;
    }
    function renderEmoji() {
      const query = $("[name=emojiSearch]").value.toLowerCase();
      $(".mc-emoji-grid").innerHTML = (emojiTarget ? emoji.slice(0, 7) : emoji).filter(item => item.label.toLowerCase().includes(query)).map(item => `<button type="button" data-action="emoji-pick" data-emoji="${item.key}" title="${item.label}" aria-label="${item.label}">${item.glyph}</button>`).join("") || '<p>No matching emoji.</p>';
    }
    function openEmoji(message = null) {
      if (!current || current.archived) return;
      emojiTarget = message?.id || null;
      if (!emojiTarget) { const input = $(".mc-compose textarea"); emojiSelection = [input.selectionStart, input.selectionEnd]; }
      $(".mc-picker h2").textContent = emojiTarget ? "React to message" : "Emoji";
      $("[name=emojiSearch]").value = ""; renderEmoji(); $(".mc-picker").showModal();
    }
    async function react(message, key) {
      if (!message || !current) return;
      const version = roomVersion, roomId = current.id;
      try { await service.call({ action: "react", roomId, messageId: message.id, reaction: message.reactions?.[uid] === key ? null : key }); }
      catch (error) { if (alive && version === roomVersion) report(error); }
    }
    function reactionMarkup(message) {
      return `<div class="mc-reactions">${emoji.slice(0, 7).map(item => {
        const people = Object.entries(message.reactions || {}).filter(([id, key]) => key === item.key && current.memberIds.includes(id)).map(([id]) => id);
        return people.length ? `<button type="button" data-action="reaction" data-emoji="${item.key}" aria-pressed="${people.includes(uid)}" ${current.archived ? "disabled" : ""} title="${escape(`${item.label}: ${people.map(id => current.members[id]?.name || "Participant").join(", ")}`)}" aria-label="${item.label}, ${people.length} reactions">${item.glyph}<span>${people.length}</span></button>` : "";
      }).join("")}</div>`;
    }
    function openMessageActions(message) {
      if (!message || message.removed || !current) return;
      menuMessage = message.id;
      const canEdit = message.senderUid === uid && Date.now() - millis(message.createdAt) <= 15 * 60000;
      const actions = [["copy-message", "Copy text", "copy"]];
      if (!current.archived) {
        actions.push(["react", "React", "smiley"], ["task-create", "Create task", "check-square"]);
        if (writable()) actions.push(["reply", "Reply", "arrow-bend-up-left"]);
        if (canEdit && writable()) actions.push(["edit", "Edit message", "pencil-simple"]);
        if (manager()) actions.push(["pin", "Pin or unpin", "push-pin"]);
        if (canEdit || current.ownerUid === uid || capability("moderateMessages")) actions.push(["remove", "Remove message", "trash"]);
      }
      $(".mc-action-list").innerHTML = actions.map(([action, label, glyph]) => `<button type="button" data-action="${action}" data-message-id="${escape(message.id)}">${icon(glyph)}${label}</button>`).join("");
      $(".mc-actions").showModal();
    }
    function closeTask() {
      ++taskDialogVersion; taskWatch?.(); taskWatch = null; taskContext = null; taskRequest = null;
      $(".mc-task-dialog")?.close(); $(".mc-task-form")?.reset();
      $(".mc-task-form [name=assigneeUid]")?.replaceChildren();
    }
    function taskError(error) {
      if (!alive || !$(".mc-task-dialog").open) return;
      $(".mc-task-error").textContent = error?.message || "Could not save the task."; $(".mc-task-error").hidden = false;
    }
    function taskForm(context) {
      taskContext = context;
      const form = $(".mc-task-form"), task = context.task || {}, create = !task.id;
      form.reset(); $(".mc-task-error").hidden = true;
      $("#mc-task-title").textContent = create ? "Create task" : "Task details";
      $("[data-ai-room]").hidden = !context.draftId && !context.manual;
      form.elements.remindAt.value = task.remindAt ? new Date(Date.parse(task.remindAt) + 7200000).toISOString().slice(0, 16) : "";
      form.elements.remindAt.disabled = context.archived || !context.canManage;
      if (context.draftId || context.manual) {
        form.elements.taskRoom.innerHTML = inbox.filter(room => !room.archived).map(room => `<option value="${escape(room.id)}">${escape(title(room))}</option>`).join("");
        form.elements.taskRoom.value = context.roomId;
      }
      for (const key of ["title", "store", "product", "note", "dueDate", "priority", "progressNote", "status"]) form.elements[key].value = task[key] || (key === "status" ? "open" : key === "priority" ? "normal" : "");
      const assigned = task.assigneeUid || uid, people = context.members.filter(p => p.audience !== "external");
      if (!people.some(p => p.uid === assigned)) people.push({ uid: assigned, name: task.assigneeName || "Former participant" });
      form.elements.assigneeUid.innerHTML = people.filter(person => context.canAssign || person.uid === uid || person.uid === assigned).map(person => `<option value="${escape(person.uid)}">${escape(person.name)}${person.uid === uid ? " (me)" : ""}</option>`).join("");
      form.elements.assigneeUid.value = assigned;
      for (const key of ["title", "store", "product", "note", "dueDate", "priority", "assigneeUid"]) form.elements[key].disabled = context.archived || !context.canManage;
      form.elements.status.disabled = create || context.archived || !context.canUpdate;
      form.elements.status.querySelector('[value=cancelled]').disabled = !context.canManage;
      form.elements.progressNote.disabled = context.archived || !context.canUpdate;
      form.elements.requireCompletionNote.checked=task.requireCompletionNote===true;
      form.elements.requireCompletionNote.disabled=context.archived||!context.canManage;
      $(".mc-task-checklist").innerHTML=(task.checklist||[]).map(step=>stepMarkup(step,context,create)).join('');
      $('[data-action="task-add-step"]').hidden=!context.canManage||context.archived;
      $(".mc-task-history").innerHTML=(task.history||[]).length?`<h3>Activity</h3><ol>${[...task.history].reverse().map(item=>`<li><strong>${escape(item.by)} <span>${escape(statusLabels[item.status]||item.status)}</span></strong><p>${escape(item.note)}</p><time>${escape(new Date(item.at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))}</time></li>`).join('')}</ol>`:'';
      $("[data-progress]").hidden = create;
      form.querySelector('[type=submit]').disabled = context.archived || !context.canUpdate;
      form.querySelector('[type=submit]').textContent = create ? "Create task" : "Save changes";
      $(".mc-task-audience").textContent = context.archived ? "Archived conversation / read-only task" : context.draftId ? "AI draft: review every field. Only this task will be shared with the selected conversation when you create it." : "Visible to this conversation's participants.";
    }
    function stepMarkup(step,context,create=false){return `<div class="mc-checklist-row" data-step-id="${escape(step.id)}"><input type="checkbox" aria-label="Step completed" ${step.done?'checked':''} ${create||context.archived||!context.canUpdate?'disabled':''}><input type="text" maxlength="160" aria-label="Checklist step" value="${escape(step.text)}" ${context.archived||!context.canManage?'readonly':''}>${context.canManage&&!context.archived?'<button type="button" data-action="task-remove-step" title="Remove step" aria-label="Remove step"><i class="ph ph-x" aria-hidden="true"></i></button>':''}</div>`;}
    function checklistInput(){return [...root.querySelectorAll('.mc-checklist-row')].map(row=>({id:row.dataset.stepId,text:row.querySelector('[type=text]').value,done:row.querySelector('[type=checkbox]').checked}));}
    function createDirectTask(){
      const room=inbox.find(r=>r.id===(current?.id||taskRoomId)&&!r.archived)||inbox.find(r=>!r.archived);
      if(!room){report(new Error('A staff conversation is required before creating a shared task.'));return;}
      closeTask();taskForm({manual:true,roomId:room.id,members:Object.values(room.members),canManage:true,canUpdate:true,canAssign:capability('assignTasks'),task:{title:'',store:room.store||'',assigneeUid:uid}});$('.mc-task-dialog').showModal();
    }
    function createTask(message) {
      if (!current || current.archived || !message || message.removed) return;
      closeTask();
      taskForm({ roomId: current.id, sourceMessageId: message.id, members: Object.values(current.members), canManage: true, canUpdate: true, canAssign: capability("assignTasks"), task: { title: message.text.split("\n")[0].slice(0, 180), note: message.text.slice(0, 2000), store: current.store, assigneeUid: uid } });
      $(".mc-task-dialog").showModal();
    }
    async function openTask(taskId) {
      closeTask(); const version = taskDialogVersion;
      try {
        const context = await service.call({ action: "taskGet", taskId });
        if (!alive || version !== taskDialogVersion) return;
        taskForm(context); $(".mc-task-dialog").showModal();
        taskWatch = service.task(taskId, value => {
          if (!alive || version !== taskDialogVersion) return;
          if (value.revision !== context.task.revision) { taskError(new Error("This task changed. Close and reopen it before saving.")); $(".mc-task-form [type=submit]").disabled = true; }
        }, error => { if (alive && version === taskDialogVersion) lock(error); });
      } catch (error) { if (alive && version === taskDialogVersion) report(error); }
    }
    async function saveTask(form) {
      if (!taskContext || form.querySelector('[type=submit]').disabled) return;
      const context = taskContext, version = taskDialogVersion;
      const fields = Object.fromEntries(["title", "store", "product", "note", "dueDate", "priority", "assigneeUid"].map(key => [key, form.elements[key].value]));
      fields.remindAt = form.elements.remindAt.value ? new Date(`${form.elements.remindAt.value}:00+02:00`).toISOString() : "";
      const data = context.task.id ? { action: "taskUpdate", taskId: context.task.id, revision: context.task.revision, status: form.elements.status.value, progressNote: form.elements.progressNote.value, ...(context.canManage ? { fields } : {}) } : context.draftId ? { action: "taskCreateReviewed", roomId: context.roomId, draftId: context.draftId, confirmed: true, ...fields } : { action: context.manual?"taskCreateDirect":"taskCreate", roomId: context.roomId, ...(context.manual?{}:{messageId:context.sourceMessageId}), ...fields };
      data.checklist=checklistInput();data.requireCompletionNote=form.elements.requireCompletionNote.checked;
      if (!context.task.id) {
        const fingerprint = JSON.stringify(data);
        if (taskRequest?.fingerprint !== fingerprint) taskRequest = { fingerprint, requestId: crypto.randomUUID() };
        data.requestId = taskRequest.requestId;
      }
      form.querySelector('[type=submit]').disabled = true;
      try {
        await service.call(data);
        window.NexusComms?.refresh();
        if (!alive || version !== taskDialogVersion) return;
        closeTask(); if (tasksOpen) loadTasks();
      } catch (error) { if (alive && version === taskDialogVersion) { taskError(error); form.querySelector('[type=submit]').disabled = false; } }
    }
    function renderTasks() {
      if (!alive || !tasksOpen) return;
      const visible = taskRows.filter(task => (taskRoomId || (taskScope==="created"?task.createdBy===uid:task.assigneeUid===uid)) && (taskFilter === "all" || (taskFilter === "active" ? !["completed", "cancelled"].includes(task.status) : task.status === taskFilter)));
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
      $(".mc-task-list").innerHTML = visible.map(task => `<button type="button" class="mc-task-row" data-action="task-open" data-task-id="${escape(task.id)}"><span class="mc-task-status ${escape(task.status)}">${escape(statusLabels[task.status] || task.status)}</span><strong>${escape(task.title)}</strong><span>${escape([task.assigneeName, task.store, task.product].filter(Boolean).join(" / "))}</span><small class="${task.dueDate && task.dueDate < today && !["completed", "cancelled"].includes(task.status) ? "mc-overdue" : ""}">${escape([task.dueDate ? `Due ${task.dueDate}` : "No due date", `${task.priority} priority`].join(" / "))}</small></button>`).join("") || '<p class="mc-empty">No tasks in this view.</p>';
      $('[data-action="tasks-next"]').disabled = !taskNextCursor;
      for(const row of root.querySelectorAll('.mc-task-row')){const task=visible.find(t=>t.id===row.dataset.taskId);if(task?.checklist?.length){const done=task.checklist.filter(s=>s.done).length;row.insertAdjacentHTML('beforeend',`<span class="mc-task-progress"><progress value="${done}" max="${task.checklist.length}" aria-label="Checklist completion"></progress><small>${done} / ${task.checklist.length} steps</small></span>`);}}
      $('[data-action="tasks-latest"]').disabled = !taskCursor;
    }
    async function loadTasks(cursor = null) {
      const version = ++taskListVersion; taskCursor = cursor; taskStops.splice(0).forEach(stop => stop());
      $(".mc-task-list").innerHTML = '<p class="mc-empty">Loading tasks...</p>'; $('[data-action="tasks-refresh"]').disabled = true;
      try {
        const page = await service.call({ action: "taskList", ...(taskRoomId ? { roomId: taskRoomId } : {scope:taskScope}), filters:{status:taskFilter,due:taskDue,priority:taskPriority,query:taskQuery}, cursor });
        if (!alive || !tasksOpen || version !== taskListVersion) return;
        taskRows = page.tasks; taskNextCursor = page.nextCursor; renderTasks();
        $('.mc-task-summary').innerHTML=Object.entries({active:'Active',today:'Due today',overdue:'Overdue',blocked:'Blocked'}).map(([key,label])=>`<button type="button" data-action="task-summary" data-summary="${key}" class="${key==='overdue'?'mc-overdue':''}"><span>${label}</span><strong>${page.counts?.[key] ?? '-'}</strong></button>`).join('');
        for (const task of taskRows) taskStops.push(service.task(task.id, value => {
          if (!alive || !tasksOpen || version !== taskListVersion) return;
          taskRows = taskRows.map(task => task.id === value.id ? value : task); renderTasks();
        }, error => { if (alive && version === taskListVersion) lock(error); }));
      } catch (error) { if (alive && tasksOpen && version === taskListVersion) { taskRows = []; taskNextCursor = null; renderTasks(); report(error); } }
      finally { if (alive && tasksOpen && version === taskListVersion) $('[data-action="tasks-refresh"]').disabled = false; }
    }
    function openTasks(roomId = null) {
      if (!actor) return;
      if (current) drafts.set(current.id, $(".mc-compose textarea").value);
      stopRoom(); tasksOpen = true; taskRoomId = roomId; taskFilter = "active";taskDue="all";taskScope="mine";taskPriority="all";taskQuery=""; root.classList.add("mc-room-open"); clearError(); renderInbox();
      $(".mc-thread").innerHTML = `<header class="mc-thread-head">${tool("back", "Back to conversations", "arrow-left")}<span class="mc-avatar">${icon("check-square")}</span><div class="mc-heading-copy"><h2>${roomId ? "Conversation tasks" : "My Tasks"}</h2><p>${roomId ? "Assigned participants" : "Assigned to me"}</p></div>${tool("tasks-refresh", "Refresh tasks", "arrows-clockwise")}</header><div class="mc-task-toolbar"><label>Status <select name="taskFilter"><option value="active">Active</option><option value="all">All</option>${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label></div><div class="mc-task-list"></div><footer class="mc-task-pages"><button data-action="tasks-latest">Latest tasks</button><button data-action="tasks-next" disabled>Older tasks</button></footer>`;
      $('.mc-thread-head').insertAdjacentHTML('beforeend',tool('task-new','Create task','plus'));
      $('.mc-task-toolbar').insertAdjacentHTML('beforeend',`${!roomId?'<label>Ownership<select name="taskScope"><option value="mine">Assigned to me</option><option value="created">Created by me</option></select></label>':''}<label>Due<select name="taskDue"><option value="all">Any date</option><option value="today">Today</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option><option value="none">No due date</option></select></label><label>Priority<select name="taskPriority"><option value="all">All priorities</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label class="mc-task-search">Search<input type="search" name="taskQuery" maxlength="160" placeholder="Task, store or product"></label>`);
      $('.mc-task-toolbar').insertAdjacentHTML('afterend','<div class="mc-task-summary"></div>');
      loadTasks();
    }
    function lock(error) {
      if (!alive) return;
      if (/permission-denied|unauthenticated/i.test(error?.code || "")) extras?.identity(null).catch(() => {});
      accessVersion++; profileStop?.(); profileStop = null;
      streams.splice(0).forEach(stop => stop()); inboxStop?.(); inboxStop = null; readsStop?.(); readsStop = null; readsKey = ""; stopRoom();
      inbox = []; drafts.clear(); readPositions.clear(); directory.clear(); selected.clear(); directoryVersion++; actor = null; clearAssistant();
      $('[data-action="assistant"]').hidden = true; $('[data-action="new"]').hidden = true;
      $('[data-action="my-tasks"]').hidden = true;
      $(".mc-dialog").close(); $(".mc-people").replaceChildren(); $(".mc-selection").replaceChildren();
      $(".mc-rooms").replaceChildren(); $(".mc-thread").innerHTML = `<div class="mc-welcome">${icon("lock-key")}<h2>Chat unavailable</h2><button data-action="reload">Reconnect</button></div>`;
      connection("Disconnected"); report(error);
    }
    function renderInbox() {
      if (!alive) return;
      $('[data-action="assistant"]').setAttribute("aria-current", String(assistantOpen));
      $('[data-action="my-tasks"]').setAttribute("aria-current", String(tasksOpen && !taskRoomId));
      const visible = inbox.filter(room => {
        const unread = room.lastSequence > (readPositions.get(room.id) || 0);
        return (mode === "archived" ? room.archived : !room.archived) && (mode !== "unread" || unread)
          && (mode !== "client" || room.type === "client") && [title(room), room.store, room.region, room.workstream].join(" ").toLowerCase().includes(query);
      });
      $(".mc-rooms").innerHTML = visible.map(room => {
        const unread = room.lastSequence > (readPositions.get(room.id) || 0);
        const unreadCount = Math.max(0, Number(room.lastSequence || 0) - Number(readPositions.get(room.id) || 0)), draft = drafts.get(room.id);
        return `<button type="button" class="mc-room ${room.id === current?.id ? "selected" : ""}" data-room="${escape(room.id)}" aria-current="${room.id === current?.id}"><span class="mc-avatar ${room.type === "client" ? "client" : ""}">${room.type === "direct" ? escape(initials(title(room))) : icon(room.type === "client" ? "handshake" : room.type === "announcement" ? "megaphone" : "users-three")}</span><span class="mc-room-copy"><strong>${escape(title(room))}</strong><span class="${draft ? 'mc-draft-preview' : ''}">${draft ? 'Draft: ' : ''}${escape(draft || room.lastPreview || room.description || "No messages yet")}</span><small>${escape([room.workstream, room.store || room.region].filter(Boolean).join(" / "))}</small></span><span class="mc-room-meta"><time>${escape(time(room.updatedAt))}</time>${unread ? `<span class="mc-unread-count" aria-label="${unreadCount} unread messages">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ""}</span></button>`;
      }).join("") || '<p class="mc-empty">No conversations in this view.</p>';
      $('[data-action="inbox-back"]').disabled = !inboxCursors.length;
      $('[data-action="inbox-next"]').disabled = !inboxPage.more;
    }
    function answerText(value) {
      return String(value || "").replace(/\r\n/g, "\n").replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/`([^`]+)`/g, "$1").trim();
    }
    function renderAssistant() {
      if (!alive || !assistantOpen || !actor) return;
      const log = $(".mc-ai-messages"), previous = log.scrollHeight - log.scrollTop - log.clientHeight;
      log.innerHTML = assistantTurns.length ? assistantTurns.map((turn, index) => `<article class="mc-ai-turn ${turn.role === "user" ? "own" : ""}"><header><strong>${turn.role === "user" ? "You" : "Nexus Assistant"}</strong>${turn.role === "assistant" ? `${tool("assistant-task", "Draft a task for review", "check-square", `data-turn="${index}"`)}${tool("assistant-copy", "Copy answer", "copy", `data-turn="${index}"`)}` : ""}</header><div class="mc-ai-answer">${escape(turn.text)}</div>${turn.scope ? `<p class="mc-ai-scope">${escape(turn.scope)}</p>` : ""}${turn.sources?.length ? `<small class="mc-ai-scope">${escape(turn.sources.join(", "))}</small>` : ""}</article>`).join("") : `<div class="mc-ai-welcome"><span class="mc-avatar mc-ai-avatar">${icon("sparkle")}</span><h2>What needs your attention?</h2><div class="mc-ai-prompts"><button type="button" data-action="assistant-prompt">Where are sales declining?</button><button type="button" data-action="assistant-prompt">Which store visits need attention?</button><button type="button" data-action="assistant-prompt">What are the current Stock Fix priorities?</button></div></div>`;
      const status = $(".mc-ai-status");
      status.textContent = assistantBusy ? "Checking Nexus data..." : ""; status.hidden = !assistantBusy;
      const error = $(".mc-ai-error"); error.hidden = !assistantError;
      error.querySelector("span").textContent = assistantError;
      $(".mc-ai-compose button[type=submit]").disabled = assistantBusy || !assistantDraft.trim();
      $('[data-action="assistant-retry"]').disabled = assistantBusy;
      if (previous < 100 || assistantBusy) log.scrollTop = log.scrollHeight;
    }
    function openAssistant() {
      if (!actor || typeof service.ask !== "function") return;
      if (current) drafts.set(current.id, $(".mc-compose textarea").value);
      stopRoom(); assistantOpen = true; root.classList.add("mc-room-open"); clearError();
      $(".mc-thread").innerHTML = `<header class="mc-thread-head">${tool("back", "Back to conversations", "arrow-left")}<span class="mc-avatar mc-ai-avatar">${icon("sparkle")}</span><div class="mc-heading-copy"><h2>Nexus Assistant</h2><p>Private AI session / Gemini Flash</p></div>${tool("assistant-clear", "Clear AI session", "trash")}</header><div class="mc-ai-messages" role="log" aria-label="Your AI questions and answers" aria-live="polite"></div><p class="mc-ai-status" role="status" hidden></p><div class="mc-ai-error" role="alert" hidden><span></span><button type="button" data-action="assistant-retry">Retry</button></div><form class="mc-ai-compose"><label class="sr-only" for="mc-ai-question">Ask Nexus Assistant</label><textarea id="mc-ai-question" name="assistantQuestion" maxlength="1400" rows="2" placeholder="Ask about your Nexus data..."></textarea><footer><small>AI can make mistakes. Verify important answers.</small><button type="submit" class="mc-primary mc-tool" title="Ask Nexus Assistant" aria-label="Ask Nexus Assistant">${icon("arrow-up")}</button></footer></form>`;
      $(".mc-ai-compose textarea").value = assistantDraft;
      renderAssistant(); renderInbox(); $(".mc-ai-messages").scrollTop = $(".mc-ai-messages").scrollHeight;
    }
    async function askAssistant(retry = false) {
      if (!alive || !actor || !assistantOpen || assistantBusy) return;
      const question = retry ? assistantTurns.at(-1)?.text : assistantDraft.trim();
      if (!question || question.length > 1400 || (retry && (!assistantError || assistantTurns.at(-1)?.role !== "user"))) return;
      if (!retry) {
        // Only the private AI conversation has follow-up memory, never staff messages.
        assistantTurns.push({ role: "user", text: question }); assistantTurns = assistantTurns.slice(-40);
        assistantDraft = ""; $(".mc-ai-compose textarea").value = "";
      }
      const version = assistantVersion;
      assistantBusy = true; assistantError = ""; renderAssistant();
      try {
        if (!retry || !assistantRequest) assistantRequest = crypto.randomUUID();
        const result = await service.ask(question, { conversationId: assistantSession, requestId: assistantRequest });
        if (!alive || !actor || version !== assistantVersion) return;
        const text = answerText(result?.answer);
        if (!text) throw new Error("No answer was returned. Please retry.");
        if (result.memoryReset) assistantTurns = assistantTurns.slice(-1);
        assistantTurns.push({ role: "assistant", text, scope: String(result.scope || ""), sources: result.sources || [] });
      } catch (error) {
        if (alive && actor && version === assistantVersion) assistantError = error?.message || "The assistant could not answer. Please retry.";
      } finally {
        if (alive && actor && version === assistantVersion) { assistantBusy = false; renderAssistant(); }
      }
    }
    async function draftAssistantTask(index) {
      if (assistantBusy || !actor) return;
      const turn = assistantTurns[index], room = inbox.find(room => !room.archived);
      if (!turn || turn.role !== "assistant") return;
      if (!room) throw new Error("Open or create a staff conversation before assigning a task.");
      const version = assistantVersion;
      assistantBusy = true; renderAssistant();
      try {
        const result = await service.ask(`Draft a task proposal based on this earlier answer; recheck it against current permitted evidence: ${turn.text.slice(0, 1200)}`, { intent: "task-draft", conversationId: assistantSession, requestId: crypto.randomUUID() });
        if (!alive || version !== assistantVersion) return;
        if (!result.draftId || !result.draft) throw new Error("The assistant did not return a valid task draft.");
        closeTask();
        taskForm({ draftId: result.draftId, roomId: room.id, members: Object.values(room.members), canManage: true, canUpdate: true, canAssign: capability("assignTasks"), task: { ...result.draft, assigneeUid: uid } });
        $(".mc-task-dialog").showModal();
      } finally { if (alive && version === assistantVersion) { assistantBusy = false; renderAssistant(); } }
    }
    function listenInbox() {
      inboxStop?.();
      inboxStop = service.rooms(actor, inboxCursors.at(-1), page => {
        if (!alive) return;
        inbox = page.rows; inboxPage = page;
        const ids = inbox.map(room => room.id).sort(), key = JSON.stringify(ids);
        if (key !== readsKey) {
          readsStop?.(); readsKey = key;
          readsStop = service.reads(uid, ids, values => { if (alive && readsKey === key) { readPositions = new Map(values.map(value => [value.id, value.sequence])); renderInbox(); } }, lock);
        }
        renderInbox(); connection(!navigator.onLine ? "Offline" : page.cached ? "Connecting..." : "Connected");
      }, lock);
    }
    function renderHeader() {
      if (!current || !alive) return;
      $(".mc-thread-head").innerHTML = `${tool("back", "Back to conversations", "arrow-left")}<span class="mc-avatar ${current.type === "client" ? "client" : ""}">${icon(current.type === "client" ? "handshake" : "chats-circle")}</span><div class="mc-heading-copy"><h2>${escape(title(current))}</h2><p>${escape(current.type === "client" ? `Client conversation / ${current.clientId}` : current.type === "announcement" ? "Announcements" : "Meridian staff")} / ${current.memberIds.length} participants${current.archived ? " / Archived" : ""}</p></div>${tool("room-tasks", "Conversation tasks", "check-square")}${tool("details", "Conversation details", "info")}`;
      $(".mc-context").textContent = [current.workstream, current.region, current.store].filter(Boolean).join(" / ");
      $(".mc-compose textarea").disabled = !writable();
      $(".mc-compose textarea").placeholder = current.archived ? "Conversation archived" : !writable() ? "Only the owner or an assigned administrator can post" : "Message your team...";
      $(".mc-compose button[type=submit]").disabled = !writable() || sending;
      for (const button of root.querySelectorAll('[data-action="attach"], [data-action="voice"]')) button.disabled = !writable() || !!editing || !!recording;
      renderDetails();
    }
    function renderDetails() {
      $(".mc-details").innerHTML = `<header><h3>Conversation details</h3>${tool("details", "Close details", "x")}</header><p>${escape(current.description || current.workstream)}</p><h4>Participants</h4><ul>${Object.values(current.members).map(person => `<li><span class="mc-avatar">${escape(initials(person.name))}</span><span><strong>${escape(person.name)}</strong><small>${escape([person.workRole, person.audience === "external" ? "External client" : person.region].filter(Boolean).join(" / "))}</small></span></li>`).join("")}</ul>${manager() ? `<footer>${current.type !== "direct" && !current.archived ? '<button data-action="members">Manage participants</button>' : ""}<button data-action="archive">${current.archived ? "Restore conversation" : "Archive conversation"}</button></footer>` : ""}`;
    }
    function markRead() {
      clearTimeout(readTimer);
      if (!visibleInNexus || !current || messageCursors.length || document.hidden || !messages.length) return;
      const list = $(".mc-messages");
      if (list.scrollHeight - list.scrollTop - list.clientHeight > 90) return;
      const sequence = messages.at(-1).sequence, roomId = current.id, version = roomVersion;
      if (sequence <= lastRead) return;
      readTimer = setTimeout(async () => {
        if (!alive || !visibleInNexus || version !== roomVersion || document.hidden) return;
        try {
          await service.call({ action: "read", roomId, sequence });
          window.NexusComms?.refresh();
          if (alive && version === roomVersion) { lastRead = sequence; readPositions.set(roomId, sequence); renderInbox(); }
        } catch (error) { if (alive && version === roomVersion) report(error); }
      }, 700);
    }
    function renderMessages(scroll = false) {
      if (!current || !alive) return;
      const list = $(".mc-messages"), atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90, oldTop = list.scrollTop;
      let lastDate = "";
      list.innerHTML = messages.map(message => {
        const stamp = date(message.createdAt), divider = stamp !== lastDate ? `<p class="mc-date">${escape(stamp)}</p>` : "";
        lastDate = stamp;
        const own = message.senderUid === uid;
        const canEdit = own && Date.now() - millis(message.createdAt) <= 15 * 60000;
        const seen = receipts.filter(receipt => receipt.id !== uid && current.memberIds.includes(receipt.id) && receipt.sequence >= message.sequence).length;
        const controls = !message.removed ? `<div class="mc-message-tools">${!current.archived ? `${tool("react", "React", "smiley")}${writable() ? tool("reply", "Reply", "arrow-bend-up-left") : ""}${canEdit && writable() ? tool("edit", "Edit message", "pencil-simple") : ""}${tool("task-create", "Create task", "check-square")}` : ""}${tool("message-actions", "More message actions", "dots-three")}</div>` : "";
        const linkedTasks = (message.taskIds || []).map((taskId, index) => `<button type="button" data-action="task-open" data-task-id="${escape(taskId)}">${icon("check-square")} Linked task${index ? ` ${index + 1}` : ""}</button>`).join("");
        return `${divider}<article class="mc-message ${own ? "own" : ""}" data-message="${escape(message.id)}"><div class="mc-message-meta"><strong>${escape(message.senderName)}</strong><time>${escape(time(message.createdAt))}</time>${message.editedAt && !message.removed ? "<span>Edited</span>" : ""}${message.priority === "urgent" && !message.removed ? '<span class="mc-urgent">Priority</span>' : ""}${current.pinnedMessageId === message.id ? icon("push-pin") : ""}</div><div class="mc-bubble">${message.replyToId && !message.removed ? `<button class="mc-reply-link" data-action="reply-target" data-target="${escape(message.replyToId)}">${icon("arrow-bend-up-left")} Reply to message</button>` : ""}<p>${escape(message.removed ? "Message removed" : message.text)}</p>${message.removed ? "" : attachmentMarkup(message)}</div>${!message.removed ? reactionMarkup(message) : ""}<div class="mc-linked-tasks">${linkedTasks}</div><div class="mc-message-foot">${own && !message.removed ? `<small>${seen ? `Seen by ${seen}` : "Sent"}</small>` : ""}${controls}</div></article>`;
      }).join("") || '<p class="mc-empty">No messages yet.</p>';
      list.scrollTop = scroll || atBottom ? list.scrollHeight : oldTop;
      $('[data-action="older"]').disabled = !messagePage.more;
      $('[data-action="latest"]').hidden = !messageCursors.length;
      markRead();
    }
    function listenMessages(scroll = true) {
      messagesStop?.();
      const version = roomVersion;
      messagesStop = service.messages(current.id, messageCursors.at(-1), page => {
        if (!alive || version !== roomVersion) return;
        messages = page.rows; messagePage = page; renderMessages(scroll); scroll = false;
        if (previewMessageId && !messages.some(row => row.id === previewMessageId && !row.removed)) { stopPlayback(); $(".mc-media-dialog").close(); $(".mc-media-preview").replaceChildren(); const url = mediaUrls.get("preview"); if (url) URL.revokeObjectURL(url); mediaUrls.delete("preview"); previewMessageId = null; }
      }, error => { if (alive && version === roomVersion) lock(error); });
    }
    function openRoom(room) {
      if (current) drafts.set(current.id, $(".mc-compose textarea")?.value || "");
      stopRoom(); current = room; messageCursors = []; sending = false;
      window.NexusComms?.openRoom(visibleInNexus ? room.id : null);
      const version = roomVersion;
      root.classList.add("mc-room-open"); clearError();
      $(".mc-thread").innerHTML = `<header class="mc-thread-head"></header><div class="mc-context"></div><div class="mc-message-pages"><button data-action="older">Earlier messages</button><button data-action="latest" hidden>Latest messages</button><button data-action="pinned" hidden>${icon("push-pin")} Pinned message</button></div><div class="mc-messages" role="log" aria-label="Messages" aria-live="polite"></div><aside class="mc-details" hidden></aside><div class="mc-reply-preview" hidden></div><form class="mc-compose"><textarea name="message" maxlength="4000" rows="2" aria-label="Message" placeholder="Message your team..."></textarea><footer><label><input name="priority" type="checkbox" /> Priority</label><span class="mc-character-count">0 / 4,000</span><button class="mc-primary mc-tool" type="submit" title="Send message" aria-label="Send message">${icon("paper-plane-tilt")}</button></footer></form>`;
      $(".mc-compose textarea").value = drafts.get(room.id) || "";
      $(".mc-compose footer").insertAdjacentHTML("afterbegin", tool("emoji", "Insert emoji", "smiley"));
      if (extras) {
        $(".mc-compose footer").insertAdjacentHTML("afterbegin", `${tool("attach", "Attach files (6 MB each)", "paperclip")}${tool("voice", "Record voice note", "microphone")}<input type="file" name="attachments" multiple hidden accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.xlsx,.docx,.pptx,.webm,.ogg,.m4a,.mp4" />`);
        $(".mc-compose").insertAdjacentHTML("afterbegin", '<div class="mc-attachments"></div>');
        $(".mc-compose").insertAdjacentHTML("beforebegin", '<div class="mc-outbox" aria-live="polite"></div>');
        refreshQueue().catch(report);
      }
      renderHeader(); renderInbox();
      roomStreams.push(service.room(room.id, value => {
        if (!alive || version !== roomVersion) return;
        current = value; renderHeader(); renderMessages(); $('[data-action="pinned"]').hidden = !value.pinnedMessageId;
      }, error => { if (alive && version === roomVersion) lock(error); }));
      roomStreams.push(service.receipts(room.id, value => { if (alive && version === roomVersion) { receipts = value; renderMessages(); } }, error => { if (version === roomVersion) lock(error); }));
      listenMessages();
      $(".mc-messages").addEventListener("scroll", markRead);
    }
    function composerMode(message, edit) {
      if (edit) { clearMedia(); renderFiles(); }
      editing = edit ? message : null; reply = edit ? null : message; sendRequest = null;
      $(".mc-reply-preview").hidden = false;
      $(".mc-reply-preview").innerHTML = `<span><strong>${edit ? "Editing message" : `Replying to ${escape(message.senderName)}`}</strong><span>${escape(message.text.slice(0, 150))}</span></span>${tool("composer-clear", "Cancel", "x")}`;
      if (edit) $(".mc-compose textarea").value = message.text;
      $(".mc-compose textarea").focus();
    }
    async function send(form) {
      const text = form.elements.message.value.trim();
      if ((!text && !selectedFiles.length) || !writable() || sending) return;
      if (recording) { report(new Error("Finish or cancel the voice note before sending.")); return; }
      const roomId = current.id, version = roomVersion;
      const data = editing ? { action: "edit", roomId, messageId: editing.id, text } : { action: "send", roomId, text, replyToId: reply?.id || null, priority: form.elements.priority.checked ? "urgent" : "normal" };
      const fingerprint = JSON.stringify(data);
      if (!editing) {
        if (sendRequest?.fingerprint !== fingerprint) sendRequest = { fingerprint, requestId: crypto.randomUUID() };
        data.requestId = sendRequest.requestId;
      }
      sending = true; renderHeader(); clearError();
      try {
        if (!editing && extras) { await extras.add(uid, data, selectedFiles); selectedFiles = []; renderFiles(); refreshQueue().catch(report); outbox.flush().catch(report); }
        else await service.call(data);
        if (!alive || version !== roomVersion) return;
        if (form.elements.message.value.trim() === text) { form.reset(); form.elements.message.dispatchEvent(new Event("input", { bubbles: true })); }
        drafts.delete(roomId); reply = null; editing = null; sendRequest = null;
        $(".mc-reply-preview").hidden = true; messageCursors = []; listenMessages();
      } catch (error) { if (alive && version === roomVersion) report(error); }
      finally { if (alive && version === roomVersion) { sending = false; renderHeader(); } }
    }
    function dialogFields() {
      const form = $(".mc-room-form"), type = form.elements.type.value, group = type !== "direct";
      root.querySelectorAll("[data-group-field]").forEach(node => { node.hidden = !group; });
      root.querySelectorAll("[data-client-field]").forEach(node => { node.hidden = type !== "client"; });
      form.elements.name.required = group;
      form.elements.clientId.required = type === "client";
      form.elements.audience.hidden = type !== "client";
      if (type !== "client") form.elements.audience.value = "internal";
    }
    function renderPeople() {
      const search = $("[name=personSearch]").value.toLowerCase();
      $(".mc-people").innerHTML = [...directory.values()].filter(person => [person.name, person.workRole, person.region].join(" ").toLowerCase().includes(search)).map(person => `<label class="mc-person"><input type="checkbox" value="${escape(person.uid)}" ${selected.has(person.uid) ? "checked" : ""} ${person.uid === current?.ownerUid && dialogMode === "members" ? "disabled" : ""} /><span class="mc-avatar ${person.audience === "external" ? "client" : ""}">${escape(initials(person.name))}</span><span><strong>${escape(person.name)}</strong><small>${escape([person.workRole, person.region, person.audience === "external" ? "External client" : "Meridian"].filter(Boolean).join(" / "))}</small></span></label>`).join("") || '<p class="mc-empty">No eligible contacts on this page.</p>';
      $(".mc-selection").textContent = `${selected.size} selected / ${[...selected].map(id => directory.get(id)?.name || "Participant").join(", ")}`;
    }
    async function loadPeople(more = false) {
      const form = $(".mc-room-form"), version = ++directoryVersion;
      directoryMode = form.elements.audience.value;
      if (!more) directoryCursor = null;
      clearError();
      try {
        const response = await service.call({ action: "directory", audience: directoryMode, clientId: form.elements.clientId.value.trim().toLowerCase(), cursor: directoryCursor });
        if (!alive || version !== directoryVersion || !$(".mc-dialog").open) return;
        if (!more) for (const id of directory.keys()) if (!selected.has(id)) directory.delete(id);
        response.people.forEach(person => directory.set(person.uid, person)); directoryCursor = response.nextCursor;
        $('[data-action="directory-more"]').hidden = !directoryCursor; renderPeople();
      } catch (error) { if (alive && version === directoryVersion) report(error, true); }
    }
    function openDialog(mode) {
      if (!actor || actor.audience === "external") return;
      dialogMode = mode; directory.clear(); selected.clear(); clearError();
      const form = $(".mc-room-form"); form.reset();
      for (const name of ["type", "name", "clientId", "workstream", "region", "store", "description"]) form.elements[name].disabled = mode === "members";
      if (mode === "members") {
        for (const name of ["type", "name", "clientId", "workstream", "region", "store", "description"]) form.elements[name].value = current[name] || "";
        Object.values(current.members).filter(person => person.uid !== uid).forEach(person => { directory.set(person.uid, person); selected.add(person.uid); });
      }
      $("#mc-dialog-title").textContent = mode === "members" ? "Manage participants" : "New conversation";
      form.querySelector("button[type=submit]").textContent = mode === "members" ? "Save participants" : "Create conversation";
      dialogFields(); renderPeople(); $(".mc-dialog").showModal(); loadPeople();
    }
    async function saveRoom(form) {
      const button = form.querySelector("button[type=submit]"); button.disabled = true;
      const data = { action: dialogMode === "members" ? "members" : "create", ...(dialogMode === "members" ? { roomId: current.id } : {}), memberIds: [...selected], requestId: crypto.randomUUID() };
      for (const name of ["type", "name", "clientId", "workstream", "region", "store", "description"]) data[name] = form.elements[name].value;
      try {
        const response = await service.call(data);
        if (!alive) return;
        $(".mc-dialog").close();
        if (dialogMode === "create") {
          // Subscribe to the new room directly; it need not be in the current inbox page yet.
          let stop, received = false;
          stop = service.room(response.roomId, room => { received = true; stop?.(); if (alive) openRoom(room); }, report);
          if (received) stop(); else streams.push(stop);
        }
      } catch (error) { report(error, true); }
      finally { if (alive) button.disabled = false; }
    }
    async function click(event) {
      const roomButton = event.target.closest("[data-room]");
      if (roomButton) return openRoom(inbox.find(room => room.id === roomButton.dataset.room));
      const filter = event.target.closest("[data-mode]");
      if (filter) { mode = filter.dataset.mode; root.querySelectorAll("[data-mode]").forEach(node => node.setAttribute("aria-pressed", node === filter)); return renderInbox(); }
      const button = event.target.closest("[data-action]"); if (!button) return;
      const action = button.dataset.action, message = messages.find(item => item.id === (button.dataset.messageId || button.closest("[data-message]")?.dataset.message));
      if (button.closest(".mc-actions")) $(".mc-actions").close();
      clearError();
      try {
        if (action === "new") openDialog("create");
        else if (action === "my-tasks") openTasks();
        else if (action === "room-tasks") openTasks(current.id);
        else if (action === "tasks-refresh" || action === "tasks-latest") await loadTasks();
        else if (action === "tasks-next") await loadTasks(taskNextCursor);
        else if (action === "task-create") createTask(message);
        else if (action === "task-new") createDirectTask();
        else if (action === "task-add-step" && taskContext?.canManage && !taskContext.archived) {
          if (checklistInput().length >= 20) throw new Error("A task can have up to 20 checklist steps.");
          $('.mc-task-checklist').insertAdjacentHTML('beforeend',stepMarkup({id:crypto.randomUUID(),text:'',done:false},taskContext,!taskContext.task.id));
          $('.mc-task-checklist').lastElementChild.querySelector('[type=text]').focus();
        }
        else if (action === "task-remove-step" && taskContext?.canManage && !taskContext.archived) button.closest('.mc-checklist-row').remove();
        else if (action === "task-summary") {
          taskFilter=button.dataset.summary==='blocked'?'blocked':'active';taskDue=['overdue','today'].includes(button.dataset.summary)?button.dataset.summary:'all';
          $('[name=taskFilter]').value=taskFilter;$('[name=taskDue]').value=taskDue;await loadTasks();
        }
        else if (action === "task-open") await openTask(button.dataset.taskId);
        else if (action === "task-close") closeTask();
        else if (action === "emoji" || action === "react") openEmoji(action === "react" ? message : null);
        else if (action === "picker-close") $(".mc-picker").close();
        else if (action === "reaction") await react(message, button.dataset.emoji);
        else if (action === "message-actions") openMessageActions(message);
        else if (action === "actions-close") $(".mc-actions").close();
        else if (action === "copy-message") { if (message) await navigator.clipboard.writeText(message.text); }
        else if (action === "emoji-pick") {
          const item = emoji.find(item => item.key === button.dataset.emoji); $(".mc-picker").close();
          if (emojiTarget) await react(messages.find(message => message.id === emojiTarget), item.key);
          else if (current && writable()) {
            const input = $(".mc-compose textarea");
            if (input.value.length - (emojiSelection[1] - emojiSelection[0]) + item.glyph.length > 4000) throw new Error("Message limit reached.");
            input.setRangeText(item.glyph, ...emojiSelection, "end"); input.dispatchEvent(new Event("input", { bubbles: true })); input.focus();
          }
        }
        else if (action === "assistant") openAssistant();
        else if (action === "assistant-prompt") { assistantDraft = button.textContent; $(".mc-ai-compose textarea").value = assistantDraft; renderAssistant(); $(".mc-ai-compose textarea").focus(); }
        else if (action === "assistant-retry") await askAssistant(true);
        else if (action === "assistant-clear") { if (window.confirm("Clear your private AI questions and follow-up memory?")) { await service.call({ action: "assistantClear" }); if (!alive) return; clearAssistant(); openAssistant(); } }
        else if (action === "assistant-task") await draftAssistantTask(Number(button.dataset.turn));
        else if (action === "attach") { if (writable() && !editing) $('[name="attachments"]').click(); }
        else if (action === "voice") startRecording();
        else if (action === "voice-stop") { if (recording?.stop() === false) { recording = null; renderFiles(); } }
        else if (action === "voice-cancel") { recording?.cancel(); recording = null; renderFiles(); }
        else if (action === "file-remove") { selectedFiles = selectedFiles.filter(file => file.localId !== button.dataset.file); renderFiles(); }
        else if (action === "voice-preview") { const file = selectedFiles.find(file => file.localId === button.dataset.file); if (file) previewBlob(file.blob, file.name); }
        else if (action === "file-open") { button.disabled = true; try { await downloadAttachment(message, button.dataset.file); } finally { if (button.isConnected) button.disabled = false; } }
        else if (action === "media-close") { stopPlayback(); $('.mc-media-dialog').close(); $('.mc-media-preview').replaceChildren(); const url = mediaUrls.get("preview"); if (url) URL.revokeObjectURL(url); mediaUrls.delete("preview"); }
        else if (action === "queue-retry") await outbox?.retry(button.dataset.queue);
        else if (action === "queue-remove") { if (window.confirm("Delete this unsent message from this device?")) await outbox?.remove(button.dataset.queue); }
        else if (action === "notifications") { if(window.NexusComms)return window.NexusComms.settings(); $('.mc-notification-state').textContent = !pushKey ? "Not configured on Firebase yet." : localStorage.getItem(`mc-push-enabled-${uid}`) ? "Enabled on this device" : "Off on this device"; $('.mc-notification-dialog').showModal(); }
        else if (action === "notifications-close") $('.mc-notification-dialog').close();
        else if (action === "notifications-on" || action === "notifications-off") {
          button.disabled = true;
          try {
            if (action === "notifications-on") { await extras.enablePush(uid, pushKey, service); if (alive) $('.mc-notification-state').textContent = "Enabled on this device"; }
            else {
              await extras.disablePush();
              const deviceId = localStorage.getItem(`mc-device-${uid}`);
              if (deviceId) await service.call({ action: "notifications", deviceId, enabled: false });
              localStorage.removeItem(`mc-push-enabled-${uid}`); if (alive) $('.mc-notification-state').textContent = "Off on this device";
            }
          } catch (error) { if (alive) $('.mc-notification-state').textContent = error.message; }
          finally { if (button.isConnected) button.disabled = false; }
        }
        else if (action === "assistant-copy") { const turn = assistantTurns[Number(button.dataset.turn)]; if (turn?.role === "assistant") { await navigator.clipboard.writeText(turn.text); if (button.isConnected) { button.title = "Copied"; button.setAttribute("aria-label", "Copied"); } } }
        else if (action === "members") openDialog("members");
        else if (action === "dialog-close") { directoryVersion++; $(".mc-dialog").close(); }
        else if (action === "directory-refresh" || action === "directory-more") await loadPeople(action === "directory-more");
        else if (action === "back") { if (current) drafts.set(current.id, $(".mc-compose textarea").value); stopRoom(); root.classList.remove("mc-room-open"); renderInbox(); }
        else if (action === "details") $(".mc-details").hidden = !$(".mc-details").hidden;
        else if (action === "older") { messageCursors.push(messagePage.cursor); listenMessages(); }
        else if (action === "latest") { messageCursors = []; listenMessages(); }
        else if (action === "inbox-next" || action === "inbox-back") { action === "inbox-next" ? inboxCursors.push(inboxPage.cursor) : inboxCursors.pop(); listenInbox(); }
        else if (action === "reply" || action === "edit") composerMode(message, action === "edit");
        else if (action === "composer-clear") { if (editing) $(".mc-compose textarea").value = ""; reply = null; editing = null; sendRequest = null; $(".mc-reply-preview").hidden = true; }
        else if (action === "pin" || action === "remove") {
          if (action === "remove" && !window.confirm("Remove this message for every participant?")) return;
          await service.call({ action, roomId: current.id, messageId: message.id });
        } else if (action === "archive") {
          if (!window.confirm(current.archived ? "Restore this conversation?" : "Archive this conversation and stop new messages?")) return;
          await service.call({ action, roomId: current.id, archived: !current.archived });
        } else if (action === "reply-target" || action === "pinned") {
          const version = roomVersion;
          const target = await service.message(current.id, action === "pinned" ? current.pinnedMessageId : button.dataset.target);
          if (alive && version === roomVersion) report({ message: target && !target.removed ? `${target.senderName}: ${target.text}` : "Message no longer available." });
        } else if (action === "reload") { clearError(); await boot(); }
      } catch (error) { report(error); }
    }
    function input(event) {
      const name = event.target.name;
      if (name === "taskRoom" && (taskContext?.draftId || taskContext?.manual)) {
        const room = inbox.find(room => room.id === event.target.value && !room.archived);
        if (room) {
          const form = $('.mc-task-form');
          const edited = Object.fromEntries(["title", "store", "product", "note", "dueDate", "priority"].map(key => [key, form.elements[key].value]));
          edited.remindAt = form.elements.remindAt.value ? new Date(`${form.elements.remindAt.value}:00+02:00`).toISOString() : "";
          edited.checklist=checklistInput();edited.requireCompletionNote=form.elements.requireCompletionNote.checked;
          taskForm({ ...taskContext, roomId: room.id, members: Object.values(room.members), task: { ...edited, assigneeUid: uid } });
        }
      }
      if (name === "conversationSearch") { query = event.target.value.toLowerCase(); renderInbox(); }
      if (name === "personSearch") renderPeople();
      if (name === "message") $(".mc-character-count").textContent = `${event.target.value.length.toLocaleString()} / 4,000`;
      if (name === "emojiSearch") renderEmoji();
      if (["taskFilter","taskDue","taskScope","taskPriority","taskQuery"].includes(name)) {
        if(name==='taskFilter')taskFilter=event.target.value;
        if(name==='taskDue')taskDue=event.target.value;
        if(name==='taskScope')taskScope=event.target.value;
        if(name==='taskPriority')taskPriority=event.target.value;
        if(name==='taskQuery')taskQuery=event.target.value;
        clearTimeout(taskSearchTimer);taskSearchTimer=setTimeout(()=>{if(alive&&tasksOpen)loadTasks();},name==='taskQuery'?300:0);
      }
      if (name === "assistantQuestion") { assistantDraft = event.target.value; $(".mc-ai-compose button[type=submit]").disabled = assistantBusy || !assistantDraft.trim(); }
      if (name === "type") { selected.clear(); directory.clear(); dialogFields(); renderPeople(); loadPeople(); }
      if (name === "clientId") { selected.clear(); directory.clear(); renderPeople(); ++directoryVersion; }
      if (event.target.closest(".mc-person")) { event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value); renderPeople(); }
    }
    function submit(event) { event.preventDefault(); if (event.target.matches(".mc-compose")) send(event.target); else if (event.target.matches(".mc-ai-compose")) askAssistant(); else if (event.target.matches(".mc-task-form")) saveTask(event.target); else if (event.target.matches(".mc-room-form")) saveRoom(event.target); }
    const cancelHold = () => clearTimeout(holdTimer);
    const pointerDown = event => {
      cancelHold(); if (event.pointerType === "mouse" || event.target.closest("button")) return;
      const id = event.target.closest("[data-message]")?.dataset.message, version = roomVersion;
      if (id) holdTimer = setTimeout(() => { if (alive && version === roomVersion) openMessageActions(messages.find(message => message.id === id)); }, 550);
    };
    const contextMenu = event => {
      const id = event.target.closest("[data-message]")?.dataset.message;
      if (!id || window.getSelection()?.toString()) return;
      event.preventDefault(); openMessageActions(messages.find(message => message.id === id));
    };
    const cancelDialog = event => {
      if (event.target.matches(".mc-task-dialog")) closeTask();
      if (event.target.matches(".mc-media-dialog")) { stopPlayback(); $('.mc-media-preview').replaceChildren(); const url = mediaUrls.get("preview"); if (url) URL.revokeObjectURL(url); mediaUrls.delete("preview"); previewMessageId = null; }
    };
    const online = () => { connection(navigator.onLine ? "Reconnecting..." : "Offline / new messages will queue"); refreshQueue().catch(report); if (navigator.onLine) outbox?.flush().catch(report); };
    const fileChange = event => {
      if (event.target.name !== "attachments") return;
      try {
        if (!writable() || editing) return;
        const files = [...event.target.files];
        if (files.length + selectedFiles.length > 3) throw new Error("Attach up to three files per message.");
        selectedFiles.push(...files.map(file => extras.fileInput(file))); renderFiles();
      } catch (error) { report(error); }
      finally { event.target.value = ""; }
    };
    const visible = () => markRead();
    const keydown = event => {
      if (!event.target.matches('.mc-compose textarea') || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229 || !matchMedia('(pointer: fine)').matches) return;
      event.preventDefault(); if (writable() && !sending) event.target.form.requestSubmit();
    };
    root.addEventListener("click", click); root.addEventListener("input", input); root.addEventListener("submit", submit);
    root.addEventListener('keydown', keydown);
    root.addEventListener("change", fileChange);
    root.addEventListener("pointerdown", pointerDown); root.addEventListener("pointermove", cancelHold); root.addEventListener("pointerup", cancelHold); root.addEventListener("pointercancel", cancelHold); root.addEventListener("contextmenu", contextMenu); root.addEventListener("cancel", cancelDialog, true);
    window.addEventListener("online", online); window.addEventListener("offline", online); document.addEventListener("visibilitychange", visible);
    async function boot() {
      connection("Connecting...");
      try {
        const result = await service.call({ action: "bootstrap" });
        if (result.actor?.audience !== "internal") throw new Error("Meridian Chat is currently available to staff only.");
        if (!alive) return;
        actor = result.actor; if (actor.uid !== uid) throw new Error("Your Nexus account changed. Reopen Chat.");
        pushKey = result.pushPublicKey || "";
        inboxCursors = []; listenInbox();
        profileStop?.(); let profileKey;
        profileStop = service.profile?.(uid, profile => {
          if (!alive || !actor) return;
          if (!profile || profile.disabled === true || profile.permissions?.chatEnabled === false || profile.accountType === 'client' || profile.role === 'client' || profile.chatAccess?.audience === 'external' || profile.chatAccess?.workRole === 'Client') return lock(Object.assign(new Error('Chat access has changed. Contact a Nexus administrator.'),{code:'permission-denied'}));
          const key = JSON.stringify([profile.role,profile.chatAccess]);
          if (profileKey === undefined) { profileKey = key; return; }
          if (profileKey === key) return; profileKey = key;
          const version = ++accessVersion;
          service.call({action:'bootstrap'}).then(data => {
            if (!alive || version !== accessVersion || !actor) return;
            if (data.actor?.uid !== uid || data.actor.audience !== 'internal') return lock(new Error('Chat access changed.'));
            actor = data.actor;
            [...$('.mc-room-form').elements.type.options].forEach(option=>{option.disabled=!capability('createGroups') && option.value!=='direct';});
            if (current) renderHeader();
          }).catch(error=>{if(alive && version===accessVersion)lock(error);});
        }, lock);
        if (extras) { await extras.identity(uid); if (!alive) return; await refreshQueue(); outbox.flush().catch(report); clearInterval(queueTimer); queueTimer = setInterval(() => outbox.flush().catch(report), 10000); }
        if (extras && pushKey && localStorage.getItem(`mc-push-enabled-${uid}`) && window.Notification?.permission === "granted") extras.enablePush(uid, pushKey, service).catch(error => { if (alive) report(error); });
        $('[data-action="assistant"]').hidden = typeof service.ask !== "function";
        $('[data-action="my-tasks"]').hidden = false;
        $('[data-action="new"]').hidden = actor.audience === "external";
        const form = $(".mc-room-form");
        [...form.elements.type.options].forEach(option => { option.disabled = !capability("createGroups") && option.value !== "direct"; });
        form.elements.workstream.innerHTML = result.workstreams.map(value => `<option>${escape(value)}</option>`).join("");
        const url = new URL(location.href), notificationRoom = url.searchParams.get("chatRoom"), notificationTask = url.searchParams.get("chatTask");
        if(url.searchParams.has('chatTasks')){url.searchParams.delete('chatTasks');history.replaceState(null,'',url);openTasks();}
        if (notificationRoom) {
          url.searchParams.delete("chatRoom"); url.searchParams.delete("chatTask"); history.replaceState(null, "", url);
          const result = await service.call({ action: "roomGet", roomId: notificationRoom });
          if (!alive) return;
          openRoom(result.room); if (notificationTask) await openTask(notificationTask);
        }
      } catch (error) { lock(error); }
    }
    bootTimer = setTimeout(boot, 0);
    return { uid, setVisible(visible) {
      visibleInNexus = visible;
      window.NexusComms?.openRoom(visible ? current?.id || null : null);
      if (visible) { markRead(); return; }
      clearTimeout(readTimer);
      recording?.cancel(); recording = null; stopPlayback();
      for (const dialog of root.querySelectorAll("dialog[open]")) dialog.close();
    }, stop() {
      alive = false; accessVersion++; profileStop?.(); clearTimeout(bootTimer); clearTimeout(taskSearchTimer); clearInterval(queueTimer); stopRoom(); streams.splice(0).forEach(stop => stop()); inboxStop?.(); readsStop?.();
      drafts.clear(); directory.clear(); selected.clear(); readPositions.clear(); inbox = []; actor = null; clearAssistant();
      root.removeEventListener("click", click); root.removeEventListener("input", input); root.removeEventListener("submit", submit);
      root.removeEventListener('keydown', keydown);
      root.removeEventListener("change", fileChange);
      root.removeEventListener("pointerdown", pointerDown); root.removeEventListener("pointermove", cancelHold); root.removeEventListener("pointerup", cancelHold); root.removeEventListener("pointercancel", cancelHold); root.removeEventListener("contextmenu", contextMenu); root.removeEventListener("cancel", cancelDialog, true);
      window.removeEventListener("online", online); window.removeEventListener("offline", online); document.removeEventListener("visibilitychange", visible);
      $(".mc-dialog")?.close(); root.classList.remove("mc-room-open"); root.replaceChildren();
      navToggle?.removeEventListener("click", toggleNav);
      navToggle?.setAttribute("aria-expanded", "false"); navToggle?.closest("aside").classList.remove("chat-nav-open");
    } };
  }
  window.MeridianChat = { mount, firebaseAdapter };
})();
