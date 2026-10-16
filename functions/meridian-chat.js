"use strict";

// Adapted from SIGDAHUILA's chatService / GroupChat workflows. Identity,
// membership, moderation and writes are enforced here rather than in the UI.
const crypto = require("node:crypto");
const { buildMedia } = require("./chat-media");
const { buildNotifications, reminderFields } = require("./chat-notifications");
const { isAdminProfile } = require("./admin-access");
const workflow = require("./chat-workflow");
const MAX_MEMBERS = 50;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const WORK_ROLES = ["Sales rep", "Merchandiser", "Manager", "Director", "Administration", "BI team", "Client"];
const TYPES = ["direct", "team", "announcement"];
const CAPABILITIES = ["createGroups", "assignTasks", "moderateMessages"];
const REACTIONS = ["like", "heart", "laugh", "celebrate", "surprised", "sad", "thanks"];
const TASK_STATUSES = ["open", "in-progress", "blocked", "completed", "cancelled"];
const STREAMS = ["General", "Stock Fix", "Time & Attendance", "Call Cycle", "Orders", "Sales & Inventory"];
const capabilities = profile => Object.fromEntries(CAPABILITIES.map(key => [key, isAdminProfile(profile) || (key === "moderateMessages" ? profile?.chatAccess?.[key] === true : profile?.chatAccess?.[key] !== false)]));
function chatEligible(profile) {
  return !!profile && profile.disabled !== true && profile.permissions?.chatEnabled !== false
    && profile.accountType !== "client" && profile.role !== "client"
    && profile.chatAccess?.audience !== "external" && profile.chatAccess?.workRole !== "Client"
    && (profile.accountType === "staff" || ["admin", "normal"].includes(profile.role));
}
function canReadRoom(profile, uid, room) {
  return chatEligible(profile) && !!room && (room.memberIds || []).includes(uid)
    && (profile.chatAccess?.audience !== "external" || (room.type === "client" && room.clientId === profile.chatAccess.clientId));
}
function chatAccessFromInput(input = {}, fail) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Choose valid chat access settings.");
  const audience = input.audience || "internal";
  if (!["none", "internal", "external"].includes(audience)) fail("Choose a valid chat audience.");
  const clientId = String(input.clientId || "").trim().toLowerCase();
  if (audience === "external" && !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(clientId)) fail("External chat access requires a client account key (2-64 letters, numbers, hyphens or underscores).");
  const workRole = String(input.workRole || "");
  if (workRole && !WORK_ROLES.includes(workRole)) fail("Choose a valid Meridian work role.");
  const grants = {};
  for (const key of CAPABILITIES) if (input[key] !== undefined) {
    if (typeof input[key] !== "boolean") fail("Chat permissions must be checked or unchecked.");
    grants[key] = audience === "external" ? false : input[key];
  }
  return { ...grants, audience, clientId: audience === "external" ? clientId : "", workRole: audience === "external" ? "Client" : workRole,
    region: String(input.region || "").trim().slice(0, 80), department: String(input.department || "").trim().slice(0, 80) };
}
function memberSummary(uid, profile) {
  return { uid, name: [profile.name, profile.surname].filter(Boolean).join(" ").slice(0, 160) || "Nexus member",
    audience: "internal",
    workRole: profile.chatAccess?.workRole || (isAdminProfile(profile) ? "Administration" : ""),
    region: profile.chatAccess?.region || "", department: profile.chatAccess?.department || "" };
}
function buildChat({ db, getAuth, onCall, HttpsError, FieldValue, FieldPath, bucket, getMessaging, onSchedule, onDocumentCreated }) {
  const fail = (message, code = "invalid-argument") => { throw new HttpsError(code, message); };
  const requireValue = (value, max, label) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label} must contain 1-${max} characters.`);
    return value.trim();
  };
  const id = (value, label = "Identifier") => {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) fail(`${label} is invalid.`);
    return value;
  };
  const nonce = value => {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) fail("A valid request identifier is required.");
    return value;
  };
  const hash = value => crypto.createHash("sha256").update(value).digest("hex");
  const now = () => FieldValue.serverTimestamp();
  const profiles = db.collection("adminUsers");
  const rooms = db.collection("meridianChatRooms");
  const tasks = db.collection("meridianChatTasks");
  const activity = require("./chat-activity").buildActivity({db,canReadRoom});
  const memory = require("./assistant-memory").buildAssistantMemory({ db, HttpsError });
  const media = buildMedia({ db, bucket, authenticate, roomContext, limiter, fail, id, nonce, hash, now });
  const notifications = buildNotifications({ db, getAuth, getMessaging, chatEligible, canReadRoom, fail, nonce, now, onSchedule, onDocumentCreated, cleanup: async () => { await media.cleanup(); await memory.cleanup(); } });
  async function authenticate(request) {
    if (!request.auth?.uid) fail("Sign in to Nexus to open chat.", "unauthenticated");
    if (request.data?.expectedUid && request.data.expectedUid !== request.auth.uid) fail("Your account changed. Reopen Chat before sending.", "permission-denied");
    if (request.auth.token.chatClient === true || request.auth.token.nexusRole === "client") fail("Meridian Chat is available to staff only.", "permission-denied");
    const uid = id(request.auth.uid, "Account");
    const account = await getAuth().getUser(uid);
    if (account.customClaims?.chatClient === true || account.customClaims?.nexusRole === "client") fail("Meridian Chat is available to staff only.", "permission-denied");
    if (account.disabled || (account.tokensValidAfterTime && Number(request.auth.token.auth_time || 0) * 1000 < Date.parse(account.tokensValidAfterTime))) fail("Your session has expired. Sign in again.", "unauthenticated");
    const snapshot = await profiles.doc(uid).get();
    const profile = snapshot.exists ? snapshot.data() : null;
    if (!chatEligible(profile)) fail("Meridian Chat is staff-only. Your account may be disabled or Chat access switched off by an administrator.", "permission-denied");
    return { uid, profile, ...memberSummary(uid, profile), admin: isAdminProfile(profile), capabilities: capabilities(profile) };
  }
  async function transactionActor(tx, actor) {
    const snapshot = await tx.get(profiles.doc(actor.uid));
    const profile = snapshot.exists ? snapshot.data() : null;
    if (!chatEligible(profile)) fail("Chat access has been removed.", "permission-denied");
    return profile;
  }
  async function roomContext(tx, actor, roomId) {
    const profile = await transactionActor(tx, actor);
    const ref = rooms.doc(id(roomId, "Conversation"));
    const snapshot = await tx.get(ref);
    const room = snapshot.exists ? snapshot.data() : null;
    if (!canReadRoom(profile, actor.uid, room)) fail("This conversation is not assigned to you.", "permission-denied");
    return { ref, room, profile };
  }
  async function limiter(tx, uid, action, maximum) {
    const ref = db.collection("meridianChatLimits").doc(`${uid}_${action}`);
    const snapshot = await tx.get(ref);
    const old = snapshot.data() || {};
    const window = Math.floor(Date.now() / 60000);
    const count = old.window === window ? Number(old.count || 0) : 0;
    if (count >= maximum) fail("Too many requests. Please wait a minute and retry.", "resource-exhausted");
    return () => tx.set(ref, { window, count: count + 1 });
  }
  function audit(tx, actor, action, roomId, messageId = null) {
    tx.create(db.collection("meridianChatAudit").doc(), { actorUid: actor.uid, action, roomId, messageId, createdAt: now() });
  }
  async function validatedMembers(tx, actor, ids, type, clientId) {
    if (!Array.isArray(ids) || ids.some(uid => typeof uid !== "string")) fail("Select conversation members.");
    const members = [...new Set([...ids.map(uid => id(uid, "Member")), actor.uid])].sort();
    if (members.length < 2 || members.length > MAX_MEMBERS || (type === "direct" && members.length !== 2)) fail(`Choose 2-${MAX_MEMBERS} members; direct messages require two people.`);
    const snapshots = await tx.getAll(...members.map(uid => profiles.doc(uid)));
    const summaries = {};
    for (let index = 0; index < snapshots.length; index += 1) {
      const profile = snapshots[index].exists ? snapshots[index].data() : null;
      if (!chatEligible(profile)) fail("One or more selected accounts cannot use chat.", "failed-precondition");
      if (profile.chatAccess?.audience === "external" && (type !== "client" || profile.chatAccess.clientId !== clientId)) fail("External members must belong to this conversation's client account.", "permission-denied");
      summaries[members[index]] = memberSummary(members[index], profile);
    }
    return { memberIds: members, members: summaries };
  }
  async function directory(actor, data) {
    if (data.audience && data.audience !== "internal") fail("Only the Meridian staff directory is available.", "permission-denied");
    const query = String(data.query || "").trim().toLowerCase().slice(0, 80);
    // Page before projecting public contact fields; never return emails,
    // automation permissions, credentials or arbitrary user profile data.
    let q = profiles.orderBy(FieldPath.documentId()).limit(100);
    if (data.cursor) q = q.startAfter(id(data.cursor, "Directory cursor"));
    const snapshot = await q.get();
    const eligible = snapshot.docs.filter(doc => chatEligible(doc.data()));
    const accounts = eligible.length ? await getAuth().getUsers(eligible.map(doc => ({ uid: doc.id }))) : { users: [] };
    const activeIds = new Set(accounts.users.filter(user => !user.disabled && user.customClaims?.chatClient !== true && user.customClaims?.nexusRole !== "client").map(user => user.uid));
    const people = eligible.filter(doc => activeIds.has(doc.id))
      .map(doc => memberSummary(doc.id, doc.data()))
      .filter(person => person.uid !== actor.uid && (!query || [person.name, person.region, person.department, person.workRole].join(" ").toLowerCase().includes(query)));
    return { people, nextCursor: snapshot.size === 100 ? snapshot.docs.at(-1).id : null };
  }
  async function create(actor, data) {
    if (actor.audience === "external") fail("Client conversations must be assigned by Meridian.", "permission-denied");
    const type = TYPES.includes(data.type) ? data.type : fail("Only staff conversations are available.", "permission-denied");
    if (type !== "direct" && !actor.capabilities.createGroups) fail("Group creation permission is required.", "permission-denied");
    const name = type === "direct" ? "Direct message" : requireValue(data.name, 80, "Conversation name");
    const clientId = "";
    const requestId = nonce(data.requestId);
    if (!Array.isArray(data.memberIds)) fail("Select conversation members.");
    const roomId = type === "direct" ? `dm_${hash(JSON.stringify([...new Set([...(data.memberIds || []), actor.uid])].sort()))}` : `room_${hash(`${actor.uid}:${requestId}`)}`;
    return db.runTransaction(async tx => {
      const profile = await transactionActor(tx, actor);
      if (profile.chatAccess?.audience === "external" || (type !== "direct" && !capabilities(profile).createGroups)) fail("You cannot create this conversation.", "permission-denied");
      const members = await validatedMembers(tx, actor, data.memberIds, type, clientId);
      const ref = rooms.doc(roomId);
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (!canReadRoom(profile, actor.uid, existing.data())) fail("Conversation access denied.", "permission-denied");
        return { roomId, reused: true };
      }
      const consume = await limiter(tx, actor.uid, "create", 5);
      consume();
      tx.create(ref, { type, name, clientId, ...members, ownerUid: actor.uid,
        region: String(data.region || "").trim().slice(0, 80), store: String(data.store || "").trim().slice(0, 120),
        workstream: STREAMS.includes(data.workstream) ? data.workstream : "General",
        description: String(data.description || "").trim().slice(0, 240), archived: false, lastSequence: 0,
        lastMessageId: null, lastPreview: "", lastSenderUid: null, pinnedMessageId: null, createdAt: now(), updatedAt: now() });
      audit(tx, actor, "room-created", roomId);
      return { roomId };
    });
  }
  async function send(actor, data) {
    const attachmentIds = data.attachmentIds || [];
    if (!Array.isArray(attachmentIds) || attachmentIds.length > 3) fail("Attach up to three files.");
    const text = attachmentIds.length && data.text === "" ? "" : requireValue(data.text, 4000, "Message");
    const messageId = hash(`${actor.uid}:${nonce(data.requestId)}`);
    return db.runTransaction(async tx => {
      const { ref, room, profile } = await roomContext(tx, actor, data.roomId);
      if (room.archived) fail("This conversation is archived.", "failed-precondition");
      if (room.type === "announcement" && room.ownerUid !== actor.uid && !isAdminProfile(profile)) fail("Only the conversation owner or an assigned administrator can post announcements.", "permission-denied");
      const messageRef = ref.collection("messages").doc(messageId);
      const existing = await tx.get(messageRef);
      const replyToId = data.replyToId ? id(data.replyToId, "Reply") : null;
      const priority = data.priority === "urgent" ? "urgent" : "normal";
      const payloadHash = hash(JSON.stringify(attachmentIds.length ? [text, replyToId, priority, attachmentIds] : [text, replyToId, priority]));
      if (existing.exists) {
        if (existing.data().payloadHash !== payloadHash) fail("That request was already used for a different message.", "already-exists");
        return { messageId, reused: true };
      }
      if (replyToId) {
        const reply = await tx.get(ref.collection("messages").doc(replyToId));
        if (!reply.exists || reply.data().removed) fail("The reply target is no longer available.", "failed-precondition");
      }
      const bound = await media.bind(tx, actor, ref.id, messageId, attachmentIds);
      const consume = await limiter(tx, actor.uid, "send", 30);
      const sequence = room.lastSequence + 1;
      consume(); bound.commit();
      tx.create(messageRef, { senderUid: actor.uid, senderName: memberSummary(actor.uid, profile).name, text, replyToId, priority, payloadHash,
        attachments: bound.attachments, sequence, createdAt: now(), editedAt: null, removed: false });
      tx.update(ref, { lastSequence: sequence, lastMessageId: messageId, lastPreview: text.slice(0, 160) || (bound.attachments[0]?.kind === "voice" ? "Voice note" : "Attachment"), lastSenderUid: actor.uid, updatedAt: now() });
      return { messageId, sequence };
    });
  }
  async function change(actor, data, action) {
    return db.runTransaction(async tx => {
      const { ref, room, profile } = await roomContext(tx, actor, data.roomId);
      const manager = room.ownerUid === actor.uid || isAdminProfile(profile);
      if (action === "read") {
        const sequence = Number(data.sequence);
        if (!Number.isInteger(sequence) || sequence < 0 || sequence > room.lastSequence) fail("Read position is invalid.");
        const receipt = ref.collection("receipts").doc(actor.uid);
        const existing = await tx.get(receipt);
        if (sequence > (existing.data()?.sequence || 0)) {
          tx.set(receipt, { sequence, readAt: now() });
          tx.set(db.collection("meridianChatReads").doc(actor.uid).collection("rooms").doc(ref.id), { sequence, readAt: now() });
        }
        return { sequence: Math.max(sequence, existing.data()?.sequence || 0) };
      }
      if (room.archived && action !== "archive") fail("This conversation is archived.", "failed-precondition");
      if (["members", "archive", "pin"].includes(action) && (!manager || profile.chatAccess?.audience === "external")) fail("Conversation management access is required.", "permission-denied");
      if (action === "members") {
        if (room.type === "direct") fail("Direct message membership cannot change.");
        if (!Array.isArray(data.memberIds)) fail("Select conversation members.");
        const members = await validatedMembers(tx, actor, [...(data.memberIds || []), room.ownerUid], room.type, room.clientId);
        const consume = await limiter(tx, actor.uid, "manage", 20);
        consume();
        tx.update(ref, { ...members, updatedAt: now() });
        audit(tx, actor, "members-updated", ref.id);
        return { roomId: ref.id };
      }
      if (action === "archive") {
        if (typeof data.archived !== "boolean") fail("Choose archive or restore.");
        const consume = await limiter(tx, actor.uid, "manage", 20);
        consume(); tx.update(ref, { archived: data.archived, updatedAt: now() });
        audit(tx, actor, data.archived ? "room-archived" : "room-restored", ref.id);
        return { archived: data.archived };
      }
      const messageRef = ref.collection("messages").doc(id(data.messageId, "Message"));
      const snapshot = await tx.get(messageRef);
      if (!snapshot.exists) fail("Message not found.", "not-found");
      const message = snapshot.data();
      if (action === "react") {
        if (message.removed) fail("This message was removed.", "failed-precondition");
        if (data.reaction !== null && !REACTIONS.includes(data.reaction)) fail("Choose a supported reaction.");
        const reactions = Object.fromEntries(Object.entries(message.reactions || {}).filter(([uid]) => room.memberIds.includes(uid)));
        if (data.reaction === null) delete reactions[actor.uid]; else reactions[actor.uid] = data.reaction;
        if (JSON.stringify(reactions) === JSON.stringify(message.reactions || {})) return { messageId: messageRef.id };
        const consume = await limiter(tx, actor.uid, "react", 40);
        consume(); tx.update(messageRef, { reactions });
        return { messageId: messageRef.id };
      }
      if (action === "pin") {
        if (message.removed) fail("A removed message cannot be pinned.");
        const consume = await limiter(tx, actor.uid, "manage", 20);
        consume(); tx.update(ref, { pinnedMessageId: room.pinnedMessageId === messageRef.id ? null : messageRef.id });
        audit(tx, actor, "pin-updated", ref.id, messageRef.id);
        return { messageId: messageRef.id };
      }
      const own = message.senderUid === actor.uid;
      const timely = Date.now() - message.createdAt.toMillis() <= EDIT_WINDOW_MS;
      if ((!own || !timely) && !(action === "remove" && (room.ownerUid === actor.uid || capabilities(profile).moderateMessages))) fail("You may change your own messages for 15 minutes.", "permission-denied");
      if (message.removed) fail("This message was removed.", "failed-precondition");
      const text = action === "edit" ? requireValue(data.text, 4000, "Message") : "";
      const consume = await limiter(tx, actor.uid, "manage", 20);
      consume(); tx.update(messageRef, { text, removed: action === "remove", editedAt: now(), ...(action === "remove" ? { reactions: {} } : {}) });
      if (action === "remove") for (const attachment of message.attachments || []) tx.update(db.doc(`meridianChatAttachments/${attachment.id}`), { expiresAt: new Date(), status: "removed" });
      if (room.lastMessageId === messageRef.id) tx.update(ref, { lastPreview: action === "remove" ? "Message removed" : text.slice(0, 160) });
      if (action === "remove" && room.pinnedMessageId === messageRef.id) tx.update(ref, { pinnedMessageId: null });
      audit(tx, actor, action === "remove" ? "message-removed" : "message-edited", ref.id, messageRef.id);
      return { messageId: messageRef.id };
    });
  }
  function taskFields(data) {
    const title = requireValue(data.title, 180, "Task title");
    const dueDate = String(data.dueDate || "");
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(`${dueDate}T00:00:00Z`)) || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) fail("Choose a valid due date.");
    const priority = data.priority || "normal";
    if (!["low", "normal", "high"].includes(priority)) fail("Choose a valid priority.");
    const fields = { title, dueDate, priority, assigneeUid: id(data.assigneeUid, "Assignee"), remindAt: reminderFields(data.remindAt, fail) };
    for (const [key, max] of [["store", 120], ["product", 160], ["note", 2000]]) {
      if (data[key] != null && (typeof data[key] !== "string" || data[key].length > max)) fail(`Task ${key} is too long or invalid.`);
      fields[key] = String(data[key] || "").trim();
    }
    return fields;
  }
  const taskManager = (actor, profile, room, task) => task.createdBy === actor.uid || room.ownerUid === actor.uid || isAdminProfile(profile);
  const taskData = snapshot => {
    const { payloadHash, ...value } = snapshot.data();
    return { ...value, id: snapshot.id, createdAt: value.createdAt?.toDate().toISOString() || null, updatedAt: value.updatedAt?.toDate().toISOString() || null };
  };
  async function validateAssignee(tx, actor, profile, room, assigneeUid) {
    if (!room.memberIds.includes(assigneeUid)) fail("The assignee must belong to this conversation.", "permission-denied");
    if (assigneeUid !== actor.uid && !capabilities(profile).assignTasks) fail("Permission to assign tasks to other staff is required.", "permission-denied");
    const snapshot = await tx.get(profiles.doc(assigneeUid));
    const account = await getAuth().getUser(assigneeUid).catch(() => null);
    if (!snapshot.exists || !chatEligible(snapshot.data()) || !account || account.disabled || account.customClaims?.chatClient || account.customClaims?.nexusRole === "client") fail("Choose an active staff member with Chat access.", "failed-precondition");
    return memberSummary(assigneeUid, snapshot.data()).name;
  }
  async function createTask(actor, data) {
    const reviewed = data.action === "taskCreateReviewed";
    if (reviewed && (data.confirmed !== true || typeof data.draftId !== "string")) fail("Review and confirm the task before creating it.");
    const standalone = data.action === "taskCreateDirect";
    const fields = taskFields(data), sourceMessageId = reviewed || standalone ? null : id(data.messageId, "Source message");
    const steps = workflow.checklist(data.checklist, fail);
    if (data.requireCompletionNote !== undefined && typeof data.requireCompletionNote !== "boolean") fail("Choose a valid completion-note setting.");
    fields.checklist = steps.map(s=>({...s,done:false})); fields.requireCompletionNote = data.requireCompletionNote === true;
    const taskId = hash(`${actor.uid}:${nonce(data.requestId)}`);
    return db.runTransaction(async tx => {
      const { ref, room, profile } = await roomContext(tx, actor, data.roomId);
      if (room.archived) fail("This conversation is archived.", "failed-precondition");
      const taskRef = tasks.doc(taskId), existing = await tx.get(taskRef);
      const payloadHash = hash(JSON.stringify([ref.id, sourceMessageId, fields, ...(reviewed ? [data.draftId] : [])]));
      if (existing.exists) {
        if (existing.data().payloadHash !== payloadHash) fail("That request already created a different task.", "already-exists");
        return { taskId, reused: true };
      }
      if (reviewed) await memory.readDraft(tx, actor.uid, profile, data.draftId);
      const messageRef = sourceMessageId ? ref.collection("messages").doc(sourceMessageId) : null, message = messageRef ? await tx.get(messageRef) : null;
      if (!reviewed && !standalone && (!message.exists || message.data().removed)) fail("The source message is no longer available.", "failed-precondition");
      const linked = message?.data().taskIds || [];
      if (linked.length >= 10) fail("This message already has ten linked tasks.", "resource-exhausted");
      const assigneeName = await validateAssignee(tx, actor, profile, room, fields.assigneeUid);
      const consume = await limiter(tx, actor.uid, "tasks", 20);
      consume();
      const task = { ...fields, roomId: ref.id, sourceMessageId, source: reviewed ? "reviewed-ai-draft" : standalone ? "direct" : "message", assigneeName, createdBy: actor.uid, createdByName: memberSummary(actor.uid, profile).name, status: "open", progressNote: "", revision: 1, reminderVersion: 1, assignmentVersion:1, assignedAt:now(), history:[{at:new Date().toISOString(),by:memberSummary(actor.uid,profile).name,status:"open",note:"Task created"}], payloadHash, createdAt: now(), updatedAt: now() };
      tx.create(taskRef, task); notifications.scheduleTask(tx, taskId, task);
      notifications.scheduleAssignment(tx,taskId,task,actor.uid);
      if (messageRef) tx.update(messageRef, { taskIds: [...linked, taskId] });
      tx.update(ref, { updatedAt: now() });
      audit(tx, actor, "task-created", ref.id, taskId);
      return { taskId };
    });
  }
  async function getTask(actor, data) {
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(tasks.doc(id(data.taskId, "Task")));
      if (!snapshot.exists) fail("Task unavailable.", "permission-denied");
      const task = snapshot.data(), { room, profile } = await roomContext(tx, actor, task.roomId);
      return { task: taskData(snapshot), members: Object.values(room.members).filter(member => room.memberIds.includes(member.uid)), archived: room.archived,
        canManage: taskManager(actor, profile, room, task), canUpdate: task.assigneeUid === actor.uid || taskManager(actor, profile, room, task), canAssign: capabilities(profile).assignTasks };
    });
  }
  async function updateTask(actor, data) {
    return db.runTransaction(async tx => {
      const ref = tasks.doc(id(data.taskId, "Task")), snapshot = await tx.get(ref);
      if (!snapshot.exists) fail("Task unavailable.", "permission-denied");
      const task = snapshot.data(), { room, profile } = await roomContext(tx, actor, task.roomId);
      const manage = taskManager(actor, profile, room, task);
      if (room.archived) fail("Restore the conversation before updating its tasks.", "failed-precondition");
      if (!manage && task.assigneeUid !== actor.uid) fail("Only the assignee or task manager can update this task.", "permission-denied");
      if (data.revision !== task.revision) fail("This task changed. Reopen it before saving.", "aborted");
      if (!TASK_STATUSES.includes(data.status) || (data.status === "cancelled" && !manage)) fail("Choose an allowed task status.", "permission-denied");
      if (typeof data.progressNote !== "string" || data.progressNote.length > 2000) fail("Progress note must be at most 2,000 characters.");
      const updates = { status: data.status, progressNote: data.progressNote.trim() };
      Object.assign(updates,workflow.progress(task,data,manage,fail));
      if (data.fields !== undefined) {
        if (!manage) fail("Only the task manager can change assignment details.", "permission-denied");
        const fields = taskFields(data.fields);
        let assigneeName = task.assigneeName;
        if (fields.assigneeUid !== task.assigneeUid) assigneeName = await validateAssignee(tx, actor, profile, room, fields.assigneeUid);
        Object.assign(updates, fields, { assigneeName });
      }
      const changedReminder = (updates.remindAt !== undefined && updates.remindAt !== task.remindAt) || (updates.assigneeUid !== undefined && updates.assigneeUid !== task.assigneeUid) || ["completed", "cancelled"].includes(task.status) !== ["completed", "cancelled"].includes(updates.status);
      if (changedReminder) updates.reminderVersion = (task.reminderVersion || 1) + 1;
      if (updates.assigneeUid && updates.assigneeUid !== task.assigneeUid) { updates.assignmentVersion=(task.assignmentVersion||1)+1;updates.assignedAt=now(); }
      if (updates.status !== task.status) updates.completedAt = updates.status === "completed" ? now() : null;
      updates.history = [...(task.history || []),{at:new Date().toISOString(),by:memberSummary(actor.uid,profile).name,status:updates.status,note:updates.progressNote || "Task updated"}].slice(-30);
      const consume = await limiter(tx, actor.uid, "tasks", 20);
      consume(); tx.update(ref, { ...updates, revision: task.revision + 1, updatedAt: now(), updatedBy: actor.uid });
      if(updates.assignmentVersion) notifications.scheduleAssignment(tx,ref.id,{...task,...updates},actor.uid);
      tx.update(rooms.doc(task.roomId),{updatedAt:now()});
      if (changedReminder) notifications.scheduleTask(tx, ref.id, { ...task, ...updates, revision: task.revision + 1 });
      audit(tx, actor, "task-updated", task.roomId, ref.id);
      return { taskId: ref.id, revision: task.revision + 1 };
    });
  }
  async function listTasks(actor, data) {
    const mine = !data.roomId;
    return db.runTransaction(async tx => {
      const profile = mine ? await transactionActor(tx, actor) : (await roomContext(tx, actor, data.roomId)).profile;
      if (data.scope && !["mine","created"].includes(data.scope)) fail("Invalid task view.");
      const query = tasks.where(mine ? data.scope === "created" ? "createdBy" : "assigneeUid" : "roomId", "==", mine ? actor.uid : id(data.roomId));
      const snapshot = await tx.get(query);
      const roomIds = [...new Set(snapshot.docs.map(doc => doc.data().roomId))];
      const allowed = new Set();
      for (let offset=0;offset<roomIds.length;offset+=100) {
        const values = await tx.getAll(...roomIds.slice(offset,offset+100).map(roomId => rooms.doc(roomId)));
        values.forEach(value => { if (value.exists && canReadRoom(profile, actor.uid, value.data())) allowed.add(value.id); });
      }
      const all=snapshot.docs.filter(doc=>allowed.has(doc.data().roomId)).map(taskData).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))||a.id.localeCompare(b.id));
      const today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Johannesburg"});
      const selected=workflow.selectTasks(all,data.filters,today,fail);
      let offset=0;
      if(data.cursor){const index=selected.findIndex(t=>t.id===id(data.cursor,"Task cursor"));if(index<0)fail("This task list changed. Refresh it.","failed-precondition");offset=index+1;}
      const page=selected.slice(offset,offset+50);
      return {tasks:page,nextCursor:offset+50<selected.length?page.at(-1).id:null,total:selected.length,counts:workflow.counts(all,today)};
    });
  }
  const handler = async request => {
    const actor = await authenticate(request);
    const data = request.data || {};
    switch (data.action) {
      case "bootstrap": return { actor: { uid: actor.uid, name: actor.name, audience: actor.audience, admin: actor.admin, capabilities: actor.capabilities, clientId: actor.profile.chatAccess?.clientId || "" }, maxMembers: MAX_MEMBERS, workstreams: STREAMS, pushPublicKey: process.env.CHAT_WEB_PUSH_PUBLIC_KEY || "" };
      case "notifications": return notifications.register(actor, data);
      case "activity": return activity(actor);
      case "assistantClear": await memory.clear(actor.uid); return { cleared: true };
      case "directory": return directory(actor, data);
      case "roomGet": return db.runTransaction(async tx => { const { ref, room } = await roomContext(tx, actor, data.roomId); return { room: { ...room, id: ref.id } }; });
      case "create": return create(actor, data);
      case "send": return send(actor, data);
      case "read": case "edit": case "remove": case "members": case "archive": case "pin": case "react": return change(actor, data, data.action);
      case "taskCreate": case "taskCreateReviewed": case "taskCreateDirect": return createTask(actor, data);
      case "taskGet": return getTask(actor, data);
      case "taskUpdate": return updateTask(actor, data);
      case "taskList": return listTasks(actor, data);
      default: fail("Unsupported chat action.");
    }
  };
  return { meridianChat: onCall({ timeoutSeconds: 60, memory: "256MiB", maxInstances: 8, concurrency: 40 }, handler),
    meridianChatMedia: onCall({ timeoutSeconds: 60, memory: "512MiB", maxInstances: 4, concurrency: 2 }, media.handler), ...notifications.exports };
}
module.exports = { buildChat, chatEligible, canReadRoom, chatAccessFromInput, memberSummary, WORK_ROLES };
