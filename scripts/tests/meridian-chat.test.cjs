const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const sdk = createRequire(path.join(process.env.CHAT_TEST_SDK_ROOT || "C:/Users/PC/SIGDAHUILA", "package.json"));
const { initializeTestEnvironment, assertFails, assertSucceeds } = sdk("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, collection, query, where, orderBy, limit, setDoc, deleteDoc } = sdk("firebase/firestore");
const backendRequire = createRequire(path.resolve(process.env.CHAT_TEST_BACKEND_ROOT || path.join(__dirname, "../../functions"), "package.json"));
const { initializeApp, deleteApp } = backendRequire("firebase-admin/app");
const { getFirestore, FieldValue, FieldPath, Timestamp } = backendRequire("firebase-admin/firestore");
const { buildChat, chatEligible, canReadRoom, chatAccessFromInput } = require("../../functions/meridian-chat");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) throw new Error("This suite requires a local Firestore emulator; never run it against production.");
const projectId = "demo-meridian-chat";
const app = initializeApp({ projectId }, "chat-test");
const db = getFirestore(app);
const { HttpsError } = backendRequire("firebase-functions/v2/https");
const objects = new Map(), pushes = [];
const fakeAuth = () => ({ getUser: async uid => ({ disabled: uid === "disabledAuth", tokensValidAfterTime: uid === "revoked" ? new Date(Date.now() + 60000).toISOString() : "" }), getUsers: async ids => ({ users: ids.filter(({ uid }) => uid !== "orphan").map(({ uid }) => ({ uid, disabled: uid === "disabledAuth" })) }) });
const chat = buildChat({ db, getAuth: fakeAuth, onCall: (_, fn) => fn, HttpsError, FieldValue, FieldPath,
  bucket: () => ({ file: path => ({ async save(bytes, options) { if (objects.has(path)) throw Object.assign(new Error("Exists"), { code: 412 }); objects.set(path, { bytes, options }); }, async download() { return [objects.get(path).bytes]; }, async delete() { objects.delete(path); } }) }),
  getMessaging: () => ({ async send(message) { pushes.push(message); return "sent"; } }), onSchedule: (_, fn) => fn, onDocumentCreated: (_, fn) => fn });
const handler = chat.meridianChat;
const profile = (name, audience = "internal", clientId = "") => ({ name, surname: "Test", role: "normal", email: `${name}@example.test`, disabled: false, chatAccess: { audience, clientId, workRole: audience === "external" ? "Client" : "Sales rep", region: "Gauteng" }, permissions: { allowedNavigationIds: ["chat"] } });
const profiles = { admin: { ...profile("Admin"), role: "admin", email: "admin@nexus.co.za" }, alice: profile("Alice"), bob: profile("Bob"), outsider: profile("Outsider"), a1: profile("Client A", "external", "client-a"), a2: profile("Client A2", "external", "client-a"), b1: profile("Client B", "external", "client-b"), disabled: { ...profile("Disabled"), disabled: true }, disabledAuth: profile("DisabledAuth"), revoked: profile("Revoked"), noaccess: { ...profile("No access"), permissions: { allowedNavigationIds: ["chat"], chatEnabled: false } }, legacy: { name: "Existing staff", role: "normal", permissions: { allowedNavigationIds: ["attendance"] } }, orphan: profile("Orphan") };
const call = (uid, data) => handler({ auth: uid ? { uid, token: { auth_time: Math.floor(Date.now() / 1000), ...(uid === "admin" ? { admin: true, email: "admin@nexus.co.za" } : {}) } } : null, data });
const request = () => require("node:crypto").randomUUID();
const create = (type = "team", memberIds = ["alice", "bob"], extra = {}) => call("admin", { action: "create", type, name: "Field operations", memberIds, requestId: request(), ...extra });
const send = (uid, roomId, text = "Stock checked", extra = {}) => call(uid, { action: "send", roomId, text, requestId: request(), ...extra });
const taskInput = (roomId, messageId, extra = {}) => ({ action: "taskCreate", roomId, messageId, requestId: request(), title: "Replenish shelf", assigneeUid: "alice", dueDate: "2026-09-09", priority: "high", note: "Confirm stock count", ...extra });
const denied = promise => assert.rejects(promise, error => error.code === "permission-denied");
let env;
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: fs.readFileSync(process.env.ADMIN_TEST_RULES || path.join(__dirname, "../../firestore.rules"), "utf8") } });
});
beforeEach(async () => {
  objects.clear(); pushes.length = 0;
  await env.clearFirestore();
  const batch = db.batch(); Object.entries(profiles).forEach(([uid, p]) => batch.set(db.doc(`adminUsers/${uid}`), p)); await batch.commit();
});
after(async () => { await env?.cleanup(); await db.terminate(); await deleteApp(app); });
const browser = uid => uid ? env.authenticatedContext(uid, uid === "admin" ? { admin: true, email: "admin@nexus.co.za" } : {}).firestore() : env.unauthenticatedContext().firestore();

const mediaCall = (uid, data) => chat.meridianChatMedia({ auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } }, data });
const upload = (uid, roomId, extra = {}) => mediaCall(uid, { action: "upload", roomId, name: "Store-count.csv", base64: Buffer.from("Item,Count\nProduct A,24").toString("base64"), requestId: request(), ...extra });

test("global activity counts incoming unread conversations and clears read, removed and revoked rooms", async () => {
  const {roomId}=await create();
  const sent=await send('bob',roomId);
  await send('alice',roomId,'Own reply');
  let value=await call('alice',{action:'activity'});
  assert.equal(value.unreadChats,1);assert.equal(value.events[0].id,`message_${sent.messageId}`);
  assert.equal(JSON.stringify(value).includes('Stock checked'),false);
  await call('alice',{action:'read',roomId,sequence:2});
  assert.equal((await call('alice',{action:'activity'})).unreadChats,0);
  const next=await send('bob',roomId);
  await call('bob',{action:'remove',roomId,messageId:next.messageId});
  assert.equal((await call('alice',{action:'activity'})).unreadChats,0);
  await send('bob',roomId);
  await call('admin',{action:'members',roomId,memberIds:['bob']});
  assert.equal((await call('alice',{action:'activity'})).unreadChats,0);
  await denied(call('noaccess',{action:'activity'}));await denied(call('a1',{action:'activity'}));
});

test("activity and task filters cover records beyond the first page",async()=>{
  const {roomId}=await create(),template=(await db.doc(`meridianChatRooms/${roomId}`).get()).data();
  const batch=db.batch();
  for(let i=0;i<105;i++){
    const ref=db.doc(`meridianChatRooms/activity-${i}`);
    batch.set(ref,{...template,lastSequence:1});
    batch.set(ref.collection('messages').doc('incoming'),{sequence:1,senderUid:'bob',removed:false,createdAt:Timestamp.now()});
    batch.set(db.doc(`meridianChatTasks/filter-${i}`),{roomId,assigneeUid:'alice',createdBy:'admin',title:`Task ${i}`,status:'open',priority:i===104?'high':'normal',dueDate:'2020-01-01',updatedAt:Timestamp.fromMillis(Date.now()-i*1000),createdAt:Timestamp.now()});
  }
  await batch.commit();
  assert.equal((await call('alice',{action:'activity'})).unreadChats,105);
  const result=await call('alice',{action:'taskList',filters:{priority:'high',due:'overdue',query:'Task 104'}});
  assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].id,'filter-104');assert.equal(result.counts.overdue,105);
});

test("direct tasks require membership, enforce checklist completion and retain progress history",async()=>{
  const {roomId}=await create();
  const input={...taskInput(roomId,null),action:'taskCreateDirect',checklist:[{id:'step_12345',text:'Check the shelf',done:false}],requireCompletionNote:true};
  await denied(call('outsider',input));
  const {taskId}=await call('admin',input);
  assert.equal((await call('admin',input)).reused,true);
  let context=await call('alice',{action:'taskGet',taskId});assert.equal(context.task.source,'direct');assert.equal(context.task.sourceMessageId,null);
  const update={action:'taskUpdate',taskId,revision:1,status:'completed',progressNote:'Shelf checked'};
  await assert.rejects(call('alice',update),/checklist/);
  await denied(call('alice',{...update,checklist:[{id:'step_12345',text:'Skip the shelf',done:true}]}));
  const complete={...update,checklist:[{id:'step_12345',text:'Check the shelf',done:true}]};
  await assert.rejects(call('alice',{...complete,progressNote:''}),/completion note/);
  await call('alice',complete);
  context=await call('alice',{action:'taskGet',taskId});assert.equal(context.task.history.length,2);assert.equal(context.task.status,'completed');
  assert.ok(context.task.completedAt);assert.equal(context.task.checklist[0].done,true);
  await assert.rejects(call('alice',{...complete,revision:2,status:'blocked',progressNote:''}),/blocked/);
});

test("task assignment alerts are generic, deduplicated and cancelled after access is removed",async()=>{
  const {roomId}=await create();
  await call('alice',{action:'notifications',enabled:true,deviceId:request(),token:'a'.repeat(140)});
  const {taskId}=await call('admin',{...taskInput(roomId,null),action:'taskCreateDirect'});
  const activity=await call('alice',{action:'activity'});assert.ok(activity.events.some(e=>e.id===`assigned_${taskId}_1`));
  await chat.deliverMeridianChatReminders();await chat.deliverMeridianChatReminders();
  assert.equal(pushes.length,1);assert.equal(pushes[0].data.kind,'task');assert.equal(JSON.stringify(pushes).includes('Replenish shelf'),false);
  const second=await call('admin',{...taskInput(roomId,null),action:'taskCreateDirect'});
  await call('admin',{action:'members',roomId,memberIds:['bob']});
  await chat.deliverMeridianChatReminders();assert.equal(pushes.length,1);assert.ok(second.taskId);
});
test("attachments validate bytes and limits, stay private and bind only once", async () => {
  const { roomId } = await create(), file = await upload("alice", roomId), requestId = request();
  assert.equal(objects.size, 1); assert.equal([...objects.values()][0].options.metadata.cacheControl, "private, no-store");
  assert.equal(JSON.stringify([...objects.values()][0].options).includes("firebaseStorageDownloadTokens"), false);
  await assert.rejects(upload("alice", roomId, { name: "malware.exe" }));
  await assert.rejects(upload("alice", roomId, { name: "not-a-photo.png" }));
  await assert.rejects(upload("alice", roomId, { base64: "%%%" }));
  await assert.rejects(upload("alice", roomId, { base64: Buffer.alloc(6 * 1024 * 1024 + 1).toString("base64") }));
  await denied(upload("outsider", roomId));
  await denied(upload("a1", roomId));
  await assert.rejects(send("bob", roomId, "", { attachmentIds: [file.id] }));
  const first = await send("alice", roomId, "", { requestId, attachmentIds: [file.id] });
  assert.equal((await send("alice", roomId, "", { requestId, attachmentIds: [file.id] })).messageId, first.messageId);
  await assert.rejects(send("alice", roomId, "", { attachmentIds: [file.id] }));
  const read = { action: "download", roomId, messageId: first.messageId, attachmentId: file.id };
  assert.ok((await mediaCall("bob", read)).base64);
  await denied(mediaCall("outsider", read));
  await call("admin", { action: "members", roomId, memberIds: ["alice"] });
  await denied(mediaCall("bob", read));
  await call("alice", { action: "remove", roomId, messageId: first.messageId });
  await denied(mediaCall("alice", read));
  await chat.deliverMeridianChatReminders(); assert.equal(objects.size, 0);
});

test("orphan uploads expire; voice notes reject invalid duration and type", async () => {
  const { roomId } = await create();
  await assert.rejects(upload("alice", roomId, { kind: "voice", duration: 10 }));
  await assert.rejects(upload("alice", roomId, { name: "voice.webm", base64: Buffer.from("1a45dfa300000000", "hex").toString("base64"), kind: "voice", duration: 126 }));
  const file = await upload("alice", roomId);
  await db.doc(`meridianChatAttachments/${file.id}`).update({ expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(send("alice", roomId, "", { attachmentIds: [file.id] }));
  await chat.deliverMeridianChatReminders(); assert.equal(objects.size, 0);
});

test("standard Office attachments accept only matching containers without embedded executables", async () => {
  const JSZip = backendRequire("jszip"), { roomId } = await create();
  const zip = new JSZip(); zip.file("[Content_Types].xml", "<Types/>"); zip.file("xl/workbook.xml", "<workbook/>");
  const base64 = await zip.generateAsync({ type: "base64" });
  assert.equal((await upload("alice", roomId, { name: "Stock-count.xlsx", base64 })).mime, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await assert.rejects(upload("alice", roomId, { name: "Stock-count.docx", base64 }));
  zip.file("xl/vbaProject.bin", "not permitted");
  await assert.rejects(upload("alice", roomId, { name: "Stock-count.xlsx", base64: await zip.generateAsync({ type: "base64" }) }));
  await assert.rejects(upload("alice", roomId, { name: "Stock-count.xlsm", base64 }));
});

test("private attachment/token/memory documents reject all browser roles", async () => {
  for (const collection of ["meridianChatAttachments", "meridianChatUploadQuota", "meridianChatDevices", "meridianChatReminders", "meridianChatDeliveries", "meridianAssistantSessions"]) {
    await db.doc(`${collection}/alice`).set({ uid: "alice", value: "private" });
    for (const uid of [null, "alice", "admin", "a1"]) {
      await assertFails(getDoc(doc(browser(uid), `${collection}/alice`)));
      await assertFails(setDoc(doc(browser(uid), `${collection}/alice`), { value: "changed" }));
    }
  }
});

test("push is generic, duplicate-safe, excludes author and revoked members", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId), deviceId = request();
  await call("bob", { action: "notifications", enabled: true, deviceId, token: "b".repeat(100) });
  await denied(call("alice", { action: "notifications", enabled: true, deviceId, token: "x".repeat(100) }));
  await call("alice", { action: "notifications", enabled: true, deviceId: request(), token: "a".repeat(100) });
  const event = { params: { roomId, messageId } };
  await chat.notifyMeridianChatMessage(event); await chat.notifyMeridianChatMessage(event);
  assert.equal(pushes.length, 1); assert.equal(pushes[0].data.uid, "bob");
  assert.equal(JSON.stringify(pushes).includes("Stock checked"), false); assert.equal(pushes[0].notification, undefined);
  const next = await send("alice", roomId);
  await db.doc("adminUsers/bob").update({ "permissions.chatEnabled": false });
  await chat.notifyMeridianChatMessage({ params: { roomId, messageId: next.messageId } }); assert.equal(pushes.length, 1);
});

test("reminders fire once, use current assignee, and stop on task completion", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  for (const uid of ["alice", "bob"]) await call(uid, { action: "notifications", enabled: true, deviceId: request(), token: uid.repeat(30) });
  const remindAt = new Date(Math.floor((Date.now() - 60000) / 60000) * 60000).toISOString();
  const input = taskInput(roomId, messageId, { remindAt });
  const { taskId } = await call("admin", input);
  await call("admin", { action: "taskUpdate", taskId, revision: 1, status: "open", progressNote: "", fields: { ...input, assigneeUid: "bob" } });
  await chat.deliverMeridianChatReminders(); await chat.deliverMeridianChatReminders();
  assert.equal(pushes.length, 1); assert.equal(pushes[0].data.uid, "bob"); assert.equal(pushes[0].data.kind, "reminder");
  await call("bob", { action: "taskUpdate", taskId, revision: 2, status: "in-progress", progressNote: "Started" });
  await chat.deliverMeridianChatReminders(); assert.equal(pushes.length, 1, "progress notes must not send another reminder");
  const second = await call("alice", taskInput(roomId, messageId, { remindAt }));
  await call("alice", { action: "taskUpdate", taskId: second.taskId, revision: 1, status: "completed", progressNote: "Done" });
  await chat.deliverMeridianChatReminders(); assert.equal(pushes.length, 1);
  await assert.rejects(call("alice", taskInput(roomId, messageId, { remindAt: "2026-02-30T12:00:00.000Z" })));
});

test("AI follows up only in the same private session and resets on permission changes", async () => {
  const { buildAssistantMemory } = require("../../functions/assistant-memory");
  const memory = buildAssistantMemory({ db, HttpsError }), conversationId = request();
  const data = { question: "Which stores need a visit?", conversationId, requestId: request() };
  const first = await memory.begin("alice", profiles.alice, data);
  await first.commit("No attendance is assigned.", { answer: "No attendance is assigned." });
  assert.equal((await memory.begin("alice", profiles.alice, data)).cached.answer, "No attendance is assigned.");
  const followup = await memory.begin("alice", profiles.alice, { ...data, question: "What about last month?", requestId: request() });
  assert.equal(followup.turns.length, 2);
  assert.equal((await memory.begin("bob", profiles.bob, { ...data, requestId: request() })).turns.length, 0);
  const changed = { ...profiles.alice, permissions: { allowedNavigationIds: [] } };
  await db.doc("adminUsers/alice").set(changed);
  assert.equal((await memory.begin("alice", changed, { ...data, requestId: request() })).turns.length, 0);
  await denied(followup.commit("Private old answer", { answer: "Private old answer" }));
});

test("AI memory expiry, explicit clearing and concurrent turns cannot resurrect stale answers", async () => {
  const { buildAssistantMemory } = require("../../functions/assistant-memory");
  const memory = buildAssistantMemory({ db, HttpsError }), data = { question: "Hello", conversationId: request(), requestId: request() };
  const pending = await memory.begin("alice", profiles.alice, data);
  await memory.clear("alice");
  await assert.rejects(pending.commit("Late answer", { answer: "Late answer" }), e => e.code === "aborted");
  const next = await memory.begin("alice", profiles.alice, { ...data, requestId: request() });
  await next.commit("Answer", { answer: "Answer" });
  await db.doc("meridianAssistantSessions/alice").update({ expiresAt: new Date(Date.now() - 1) });
  assert.equal((await memory.begin("alice", profiles.alice, { ...data, requestId: request() })).turns.length, 0);
  await memory.cleanup(); assert.equal((await db.doc("meridianAssistantSessions/alice").get()).exists, false);
});

test("AI task drafts do not create tasks and require review, membership and current scope", async () => {
  const { buildAssistantMemory, reviewedDraft } = require("../../functions/assistant-memory"), memory = buildAssistantMemory({ db, HttpsError });
  const { roomId } = await create();
  const fields = { title: "Review shelf availability", note: "Confirm stock before assigning replenishment.", store: "", product: "", priority: "normal" };
  assert.deepEqual(reviewedDraft(fields, message => { throw new Error(message); }), fields);
  assert.throws(() => reviewedDraft({ ...fields, priority: "urgent" }, message => { throw new Error(message); }));
  const session = await memory.begin("alice", profiles.alice, { question: "Draft a task", intent: "task-draft", conversationId: request(), requestId: request() });
  const result = await session.commit(JSON.stringify(fields), { answer: fields.note }, fields);
  assert.equal((await db.collection("meridianChatTasks").get()).size, 0);
  const data = { action: "taskCreateReviewed", roomId, draftId: result.draftId, confirmed: true, ...fields, assigneeUid: "alice", requestId: request() };
  await assert.rejects(call("alice", { ...data, confirmed: false }));
  await denied(call("outsider", { ...data, assigneeUid: "outsider" }));
  await assert.rejects(call("bob", { ...data, assigneeUid: "bob" }));
  const task = await call("alice", data); assert.equal((await call("alice", data)).taskId, task.taskId);
  assert.equal((await db.doc(`meridianChatTasks/${task.taskId}`).get()).data().sourceMessageId, null);
  await db.doc("adminUsers/alice").update({ "permissions.allowedNavigationIds": ["stockfix"] });
  await assert.rejects(call("alice", { ...data, requestId: request() }), /access changed/);
});

test("AI authorisation rejects stale admin claims, clients, opt-outs and revoked sessions", async () => {
  const { authorizeAssistant, workspaceAccess } = require("../../functions/assistant-access");
  const dependencies = { db, getAuth: fakeAuth, HttpsError };
  const authRequest = uid => ({ auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
  await denied(authorizeAssistant(dependencies, { ...authRequest("alice"), data: { expectedUid: "bob" } }, { uid: "alice", role: "normal" }));
  await denied(call("alice", { action: "bootstrap", expectedUid: "bob" }));
  for (const uid of ["noaccess", "a1", "disabled", "disabledAuth", "revoked", "unknown"]) await assert.rejects(authorizeAssistant(dependencies, authRequest(uid), { uid, role: "admin" }));
  assert.equal((await authorizeAssistant(dependencies, authRequest("alice"), { uid: "alice", role: "admin" })).actor.role, "normal");
  assert.deepEqual(workspaceAccess({ role: "normal" }, { navigation: ["attendance"] }), { attendance: true, sales: false, stockfix: false, adoption: false, training: false, integrationHealth: false });
  for (const navigation of [[], ["chat"], ["insights"], ["stockfix"], ["attendance", "stockfix"]]) {
    const access = workspaceAccess({ role: "normal" }, { navigation });
    assert.equal(access.training, false); assert.equal(access.integrationHealth, false);
    assert.equal(access.sales, navigation.includes("insights")); assert.equal(access.stockfix, navigation.includes("stockfix"));
  }
});

test("retired file drops deny listing, reads, writes and deletes even with a room key", async () => {
  await db.doc("fileDropRooms/legacy").set({ accessKey: "known-room-key", expiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
  await db.doc("fileDrops/legacy-file").set({ roomId: "legacy", accessKey: "known-room-key", name: "Private.xlsx" });
  for (const uid of [null, "alice", "admin", "a1"]) {
    const client = browser(uid);
    await assertFails(getDocs(query(collection(client, "fileDrops"), limit(1))));
    await assertFails(getDocs(query(collection(client, "fileDrops"), where("accessKey", "==", "known-room-key"), limit(1))));
    await assertFails(getDoc(doc(client, "fileDrops/legacy-file")));
    await assertFails(setDoc(doc(client, "fileDrops/new-file"), { roomId: "legacy", accessKey: "known-room-key" }));
    await assertFails(deleteDoc(doc(client, "fileDrops/legacy-file")));
    await assertFails(getDoc(doc(client, "fileDropRooms/legacy")));
  }
});

test("attendance permits assigned normal staff to read all published views, never write or read admin config", async () => {
  const paths = ["geoRepAttendanceDashboard/current", "geoRepAttendanceDashboard/merchandisers", "geoRepAttendanceCoverage/rep/stores/s1", "geoRepAttendanceCoverage/merchandiser/visits/v1", "attendanceBlueprintUpdates/daily", "salesforceAttendanceWorkbookSnapshots/monthly", "salesforceAttendanceWorkbookSnapshots/monthly/rows/chunk1"];
  for (const p of paths) await db.doc(p).set({ count: 1 });
  const client = env.authenticatedContext("legacy", { nexusRole: "normal" }).firestore();
  for (const p of paths) {
    await assertSucceeds(getDoc(doc(client, p)));
    await assertSucceeds(getDocs(collection(client, p.split("/").slice(0, -1).join("/"))));
    await assertFails(setDoc(doc(client, p), { count: 2 }));
    await assertFails(deleteDoc(doc(client, p)));
  }
  for (const p of ["salesforceAttendanceConfig/current", "geoRepAttendanceConfig/current", "salesforceAttendanceMasters/master", "adminUsers/alice", "retailerSecrets/private", "extractionRuns/other", "files/source", "stockFixWeeks/current"]) await assertFails(getDoc(doc(client, p)));
  await db.doc("adminUsers/legacy").update({ "permissions.allowedNavigationIds": [] });
  await assertFails(getDoc(doc(client, paths[0])));
});

test("attendance rejects anonymous, unknown, unassigned, disabled and client accounts", async () => {
  await db.doc("geoRepAttendanceDashboard/current").set({ rows: [] });
  for (const uid of [null, "unknown", "alice", "disabled", "a1"]) {
    if (uid && uid !== "unknown" && uid !== "alice") await db.doc(`adminUsers/${uid}`).update({ "permissions.allowedNavigationIds": ["attendance"] });
    const client = uid ? env.authenticatedContext(uid, { nexusRole: "normal", operator: true }).firestore() : env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(client, "geoRepAttendanceDashboard/current")));
  }
  await assertFails(getDoc(doc(browser("legacy"), "geoRepAttendanceDashboard/current")));
  await assertFails(getDoc(doc(env.authenticatedContext("legacy", { nexusRole: "normal", chatClient: true }).firestore(), "geoRepAttendanceDashboard/current")));
});

test("attendance readers require workspace access but no longer require automation execution permission", () => {
  const code = fs.readFileSync(path.join(__dirname, "../../functions/index.js"), "utf8");
  for (const name of ["getGeoRepAttendanceDashboard", "getGeoRepAttendanceWorksheetView", "getSalesforceAttendanceDashboard", "getSalesforceAttendanceWorkbookSnapshotRows"]) {
    const handler = code.slice(code.indexOf(`exports.${name} =`)).split("\n});")[0];
    assert.ok(handler.includes('await requireNavigationPermission(request, "attendance");') || handler.includes("await requireAttendanceViewPermission(request);"));
    assert.ok(!handler.includes("requireRetailerPermission"));
  }
});

test("loaded staff default on; explicit opt-out and every client marker deny", () => {
  assert.equal(chatEligible(profiles.noaccess), false); assert.equal(chatEligible(profiles.disabled), false);
  assert.equal(chatEligible(profiles.a1), false);
  assert.equal(chatEligible(profiles.legacy), true);
  assert.equal(chatEligible(null), false); assert.equal(chatEligible({}), false);
  for (const marker of [{ accountType: "client" }, { role: "client" }, { chatAccess: { workRole: "Client" } }]) assert.equal(chatEligible({ ...profiles.alice, ...marker }), false);
  const fail = text => { throw new Error(text); };
  assert.throws(() => chatAccessFromInput({ audience: "external", clientId: "" }, fail), /client account/);
  assert.equal(chatAccessFromInput({ audience: "external", clientId: "CLIENT-A" }, fail).clientId, "client-a");
  assert.equal(canReadRoom(profiles.a1, "a1", { memberIds: ["a1"], type: "team" }), false);
});
test("unauthenticated, disabled, revoked and unassigned identities cannot bootstrap", async () => {
  for (const uid of [null, "disabled", "disabledAuth", "revoked", "noaccess", "unknown", "a1", "a2", "b1"]) await assert.rejects(call(uid, { action: "bootstrap" }));
  assert.equal((await call("legacy", { action: "bootstrap" })).actor.audience, "internal");
  await denied(handler({ auth: { uid: "alice", token: { chatClient: true, nexusRole: "client" } }, data: { action: "bootstrap" } }));
});
test("clients cannot browse contacts or create rooms", async () => {
  for (const action of ["directory", "create"]) await denied(call("a1", { action }));
  await denied(call("alice", { action: "directory", audience: "external", clientId: "client-a" }));
});
test("directory exposes only safe assigned contacts", async () => {
  await denied(call("admin", { action: "directory", audience: "external", clientId: "client-a" }));
  const data = await call("admin", { action: "directory" });
  assert.equal(JSON.stringify(data).includes("email"), false);
  const staff = await call("alice", { action: "directory" });
  assert.equal(staff.people.some(p => ["disabled", "disabledAuth", "orphan", "noaccess", "a1"].includes(p.uid)), false);
  assert.ok(staff.people.some(p => p.uid === "legacy"));
  assert.ok(staff.people.some(p => p.uid === "admin"));
});
test("cross-client membership is rejected; clients cannot join internal rooms", async () => {
  await assert.rejects(create("team", ["a1"]));
  await denied(create("client", ["alice", "a1", "b1"], { clientId: "client-a" }));
  await assert.rejects(create("team", ["disabled"]));
});
test("ordinary staff can create direct and team conversations, but never client rooms", async () => {
  const input = { action: "create", type: "direct", memberIds: ["bob"], requestId: request() };
  const one = await call("alice", input); const two = await call("bob", { ...input, memberIds: ["alice"] });
  assert.equal(one.roomId, two.roomId);
  assert.ok((await call("alice", { ...input, type: "team", name: "Team", requestId: request() })).roomId);
  await assert.rejects(call("alice", { ...input, type: "client", name: "Client", requestId: request() }));
  await assert.rejects(call("alice", { ...input, memberIds: "bob" }), /members/);
});
test("messages derive sender identity and retry exactly once", async () => {
  const { roomId } = await create(); const requestId = request();
  const first = await send("alice", roomId, "Hello", { requestId, senderUid: "admin" });
  const second = await send("alice", roomId, "Hello", { requestId });
  assert.equal(first.messageId, second.messageId); assert.equal(second.reused, true);
  assert.equal((await db.doc(`meridianChatRooms/${roomId}/messages/${first.messageId}`).get()).data().senderUid, "alice");
  assert.equal((await db.doc(`meridianChatRooms/${roomId}`).get()).data().lastSequence, 1);
  await assert.rejects(send("alice", roomId, "Different", { requestId }), error => error.code === "already-exists");
  await denied(send("outsider", roomId));
});
test("group creation defaults on for staff and remains immediately revocable", async () => {
  assert.equal((await call("alice", { action: "bootstrap" })).actor.capabilities.createGroups, true);
  await call("alice", { action: "create", type: "team", name: "Regional team", memberIds: ["bob"], requestId: request() });
  await db.doc("adminUsers/alice").update({ "chatAccess.createGroups": false });
  await denied(call("alice", { action: "create", type: "team", name: "Regional team", memberIds: ["bob"], requestId: request() }));
  assert.throws(() => chatAccessFromInput({ assignTasks: "true" }, message => { throw new Error(message); }), /permissions/);
});
test("reactions are one per member, retry safe, scoped and removable", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  const react = (uid, reaction) => call(uid, { action: "react", roomId, messageId, reaction, senderUid: "admin" });
  await react("alice", "like"); await react("alice", "like"); await react("bob", "heart");
  const ref = db.doc(`meridianChatRooms/${roomId}/messages/${messageId}`);
  assert.deepEqual((await ref.get()).data().reactions, { alice: "like", bob: "heart" });
  await react("alice", "thanks"); await react("bob", null);
  assert.deepEqual((await ref.get()).data().reactions, { alice: "thanks" });
  await denied(react("outsider", "like")); await denied(react("a1", "like"));
  await assert.rejects(react("alice", "invalid"));
  await call("alice", { action: "remove", roomId, messageId });
  assert.deepEqual((await ref.get()).data().reactions, {});
  await assert.rejects(react("bob", "heart"), /removed/);
});
test("task creation defaults to self and requires a live same-room source", async () => {
  const { roomId } = await create(), { messageId } = await send("bob", roomId);
  const input = taskInput(roomId, messageId), one = await call("alice", input), two = await call("alice", input);
  assert.equal(one.taskId, two.taskId); assert.equal(two.reused, true);
  assert.equal((await db.doc(`meridianChatTasks/${one.taskId}`).get()).data().createdBy, "alice");
  await assert.rejects(call("alice", { ...input, title: "Changed" }), e => e.code === "already-exists");
  const delegated = await call("alice", taskInput(roomId, messageId, { assigneeUid: "bob" }));
  assert.equal((await call("bob", {action:'taskGet',taskId:delegated.taskId})).task.assigneeUid,'bob');
  await db.doc('adminUsers/alice').update({'chatAccess.assignTasks':false});
  await denied(call("alice", taskInput(roomId, messageId, { assigneeUid: "bob" })));
  await denied(call("outsider", taskInput(roomId, messageId, { assigneeUid: "outsider" })));
  const other = await create(); await assert.rejects(call("alice", taskInput(other.roomId, messageId)), /source message/);
  await assert.rejects(call("alice", taskInput(roomId, messageId, { dueDate: "2026-02-30" })), /due date/);
  await call("bob", { action: "remove", roomId, messageId });
  await assert.rejects(call("alice", taskInput(roomId, messageId)), /source message/);
});
test("delegated assignment checks membership and active staff eligibility", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  await db.doc("adminUsers/alice").update({ "chatAccess.assignTasks": true });
  const result = await call("alice", taskInput(roomId, messageId, { assigneeUid: "bob" }));
  assert.equal((await call("bob", { action: "taskGet", taskId: result.taskId })).canUpdate, true);
  await denied(call("alice", taskInput(roomId, messageId, { assigneeUid: "outsider" })));
  await denied(call("alice", taskInput(roomId, messageId, { assigneeUid: "a1" })));
  await db.doc("adminUsers/bob").update({ "permissions.chatEnabled": false });
  await assert.rejects(call("alice", taskInput(roomId, messageId, { assigneeUid: "bob" })), /active staff/);
});
test("task updates check ownership, conflicts, and assignment permission", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  const { taskId } = await call("admin", taskInput(roomId, messageId));
  const input = { action: "taskUpdate", taskId, revision: 1, status: "in-progress", progressNote: "Checking back room" };
  await denied(call("bob", input)); await denied(call("outsider", input));
  await denied(call("alice", { ...input, fields: { title: "Changed" } }));
  await denied(call("alice", { ...input, status: "cancelled" }));
  await call("alice", input);
  await assert.rejects(call("alice", input), e => e.code === "aborted");
  await call("alice", { ...input, revision: 2, status: "completed" });
  assert.equal((await call("admin", { action: "taskGet", taskId })).task.status, "completed");
});
test("task lists and direct reads never bypass source conversation membership", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  const { taskId } = await call("admin", taskInput(roomId, messageId));
  assert.equal((await call("alice", { action: "taskList" })).tasks.length, 1);
  assert.equal((await call("bob", { action: "taskList" })).tasks.length, 0);
  assert.equal((await call("bob", { action: "taskList", roomId })).tasks.length, 1);
  await denied(call("outsider", { action: "taskList", roomId }));
  await assertSucceeds(getDoc(doc(browser("alice"), `meridianChatTasks/${taskId}`)));
  await assertFails(getDoc(doc(browser("outsider"), `meridianChatTasks/${taskId}`)));
  await assertFails(getDocs(query(collection(browser("alice"), "meridianChatTasks"), limit(50))));
  await assertFails(setDoc(doc(browser("admin"), `meridianChatTasks/${taskId}`), { title: "Tampered" }, { merge: true }));
  await call("admin", { action: "members", roomId, memberIds: ["bob"] });
  assert.equal((await call("alice", { action: "taskList" })).tasks.length, 0);
  await denied(call("alice", { action: "taskGet", taskId }));
  await assertFails(getDoc(doc(browser("alice"), `meridianChatTasks/${taskId}`)));
});
test("moderation grants apply only to assigned conversations", async () => {
  const { roomId } = await create(), { messageId } = await send("alice", roomId);
  await db.doc("adminUsers/bob").update({ "chatAccess.moderateMessages": true });
  await db.doc("adminUsers/outsider").update({ "chatAccess.moderateMessages": true });
  await denied(call("outsider", { action: "remove", roomId, messageId }));
  await call("bob", { action: "remove", roomId, messageId });
  assert.equal((await db.doc(`meridianChatRooms/${roomId}/messages/${messageId}`).get()).data().removed, true);
});
test("task cursor pagination is bounded and administrators cannot bypass private rooms", async () => {
  const { roomId } = await call("alice", { action: "create", type: "direct", memberIds: ["bob"], requestId: request() });
  const { messageId } = await send("alice", roomId);
  const { taskId } = await call("alice", taskInput(roomId, messageId));
  await denied(call("admin", { action: "taskGet", taskId }));
  await assertFails(getDoc(doc(browser("admin"), `meridianChatTasks/${taskId}`)));
  const batch = db.batch();
  for (let index = 0; index < 52; index++) batch.set(db.collection("meridianChatTasks").doc(`page-${String(index).padStart(3, '0')}`), { roomId, assigneeUid: "alice", title: `Task ${index}`, status: "open", updatedAt: Timestamp.now() });
  await batch.commit();
  const first = await call("alice", { action: "taskList" });
  assert.equal(first.tasks.length, 50); assert.ok(first.nextCursor);
  const second = await call("alice", { action: "taskList", cursor: first.nextCursor });
  assert.equal(second.tasks.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.tasks, ...second.tasks].map(t => t.id)).size, 53);
  await assert.rejects(call("bob", { action: "taskList", cursor: first.nextCursor }), /Refresh/);
});
test("archived conversations freeze task changes and disabled Auth assignees are refused", async () => {
  const { roomId } = await create("team", ["alice", "disabledAuth"]), { messageId } = await send("alice", roomId);
  await assert.rejects(call("admin", taskInput(roomId, messageId, { assigneeUid: "disabledAuth" })), /active staff/);
  const { taskId } = await call("admin", taskInput(roomId, messageId));
  await call("admin", { action: "archive", roomId, archived: true });
  await assert.rejects(call("alice", { action: "taskUpdate", taskId, revision: 1, status: "completed", progressNote: "Done" }), /Restore/);
  await assert.rejects(call("alice", taskInput(roomId, messageId)), /archived/);
});
test("replies cannot point to another room or removed messages", async () => {
  const a = await create(), b = await create(); const target = await send("alice", a.roomId);
  await assert.rejects(send("alice", b.roomId, "Reply", { replyToId: target.messageId }));
  await call("alice", { action: "remove", roomId: a.roomId, messageId: target.messageId });
  await assert.rejects(send("bob", a.roomId, "Reply", { replyToId: target.messageId }));
});
test("edits are owner/time limited; moderation removes text and previews", async () => {
  const { roomId } = await create(); const { messageId } = await send("alice", roomId);
  await denied(call("bob", { action: "edit", roomId, messageId, text: "No" }));
  await call("alice", { action: "edit", roomId, messageId, text: "Corrected" });
  await db.doc(`meridianChatRooms/${roomId}/messages/${messageId}`).update({ createdAt: Timestamp.fromMillis(Date.now() - 3600000) });
  await denied(call("alice", { action: "edit", roomId, messageId, text: "Late" }));
  await call("admin", { action: "pin", roomId, messageId });
  await call("admin", { action: "remove", roomId, messageId });
  assert.equal((await db.doc(`meridianChatRooms/${roomId}`).get()).data().pinnedMessageId, null);
  assert.equal((await db.doc(`meridianChatRooms/${roomId}/messages/${messageId}`).get()).data().text, "");
});
test("announcements are read-only for members and archive blocks all sends", async () => {
  const { roomId } = await create("announcement");
  await denied(send("alice", roomId)); await send("admin", roomId);
  await call("admin", { action: "archive", roomId, archived: true });
  await assert.rejects(send("admin", roomId), /archived/);
  await call("admin", { action: "archive", roomId, archived: false }); await send("admin", roomId);
});
test("read receipts are monotonic and owned by the authenticated member", async () => {
  const { roomId } = await create(); await send("alice", roomId); await send("alice", roomId);
  await call("bob", { action: "read", roomId, sequence: 2, uid: "alice" });
  await call("bob", { action: "read", roomId, sequence: 1 });
  assert.equal((await db.doc(`meridianChatReads/bob/rooms/${roomId}`).get()).data().sequence, 2);
  assert.equal((await db.doc(`meridianChatRooms/${roomId}/receipts/alice`).get()).exists, false);
  await assert.rejects(call("bob", { action: "read", roomId, sequence: 3 }));
});
test("members can be removed and staff opt-out revokes backend access", async () => {
  const { roomId } = await create();
  await send("alice", roomId);
  await denied(call("a1", { action: "members", roomId, memberIds: ["a2"] }));
  await assert.rejects(call("admin", { action: "members", roomId, memberIds: ["a1", "b1"] }));
  await db.doc("adminUsers/alice").update({ "permissions.chatEnabled": false });
  await denied(send("alice", roomId));
  await call("admin", { action: "members", roomId, memberIds: ["bob"] });
  await db.doc("adminUsers/alice").update({ "permissions.chatEnabled": true });
  await denied(send("alice", roomId));
});
test("server rate limit applies before a message is written", async () => {
  const { roomId } = await create();
  await db.doc("meridianChatLimits/alice_send").set({ window: Math.floor(Date.now() / 60000), count: 30 });
  await assert.rejects(send("alice", roomId), error => error.code === "resource-exhausted");
  assert.equal((await db.doc(`meridianChatRooms/${roomId}`).get()).data().lastSequence, 0);
});
test("Firestore denies guessed IDs, unassigned admins and all browser writes", async () => {
  const { roomId } = await call("alice", { action: "create", type: "direct", memberIds: ["bob"], requestId: request() });
  const path = `meridianChatRooms/${roomId}`;
  for (const uid of [null, "outsider", "a1", "admin"]) await assertFails(getDoc(doc(browser(uid), path)));
  await assertSucceeds(getDoc(doc(browser("alice"), path)));
  for (const uid of ["alice", "admin"]) await assertFails(setDoc(doc(browser(uid), `${path}/messages/forged`), { text: "Spoof", senderUid: "bob" }));
  await assertFails(setDoc(doc(browser("alice"), path), { memberIds: ["outsider"] }, { merge: true }));
});
test("Firestore denies clients even with historical assignments and matching client keys", async () => {
  const { roomId } = await create();
  await db.doc(`meridianChatRooms/${roomId}`).update({ type: "client", clientId: "client-a", memberIds: ["admin", "alice", "a1", "a2", "b1"] });
  const { messageId } = await send("alice", roomId);
  const path = `meridianChatRooms/${roomId}/messages/${messageId}`;
  await assertSucceeds(getDoc(doc(browser("alice"), path)));
  await assertFails(getDoc(doc(browser("a1"), path)));
  await assertFails(getDoc(doc(browser("a2"), path)));
  await assertFails(getDoc(doc(browser("b1"), path)));
  await db.doc(`meridianChatRooms/${roomId}`).update({ memberIds: ["admin", "alice", "b1", "a1"] });
  await assertFails(getDoc(doc(browser("b1"), path)));
  await db.doc("adminUsers/a1").update({ disabled: true });
  await assertFails(getDoc(doc(browser("a1"), path)));
  await assertFails(getDoc(doc(env.authenticatedContext("alice", { chatClient: true, nexusRole: "client" }).firestore(), path)));
});
test("Firestore inbox queries enforce scope, membership and bounds", async () => {
  await create();
  const staffQuery = query(collection(browser("alice"), "meridianChatRooms"), where("memberIds", "array-contains", "alice"), orderBy("updatedAt", "desc"), limit(50));
  await assertSucceeds(getDocs(staffQuery));
  const c = collection(browser("a1"), "meridianChatRooms");
  await assertFails(getDocs(query(c, where("memberIds", "array-contains", "a1"), limit(50))));
  await assertFails(getDocs(query(c, where("memberIds", "array-contains", "a1"), where("type", "==", "client"), where("clientId", "==", "client-a"), orderBy("updatedAt", "desc"), limit(50))));
  await assertFails(getDocs(query(collection(browser("alice"), "meridianChatRooms"), where("memberIds", "array-contains", "alice"))));
});
test("Firestore read cursors are private, message queries bounded and revocation immediate", async () => {
  const { roomId } = await create(); await send("alice", roomId); await call("bob", { action: "read", roomId, sequence: 1 });
  await assertSucceeds(getDoc(doc(browser("bob"), `meridianChatReads/bob/rooms/${roomId}`)));
  await assertSucceeds(getDocs(query(collection(browser("bob"), "meridianChatReads/bob/rooms"), where("__name__", "in", [roomId]))));
  await assertFails(getDoc(doc(browser("alice"), `meridianChatReads/bob/rooms/${roomId}`)));
  const c = collection(browser("alice"), `meridianChatRooms/${roomId}/messages`);
  await assertSucceeds(getDocs(query(c, orderBy("sequence", "desc"), limit(50))));
  await assertFails(getDocs(c));
  await db.doc("adminUsers/alice").update({ "permissions.chatEnabled": false });
  await assertFails(getDoc(doc(browser("alice"), `meridianChatRooms/${roomId}`)));
  await denied(send("alice", roomId));
});

test("legacy staff file and dashboard metadata is not public or client-readable", async () => {
  for (const name of ["files", "dashboardClients", "dashboardUploads"]) {
    await db.doc(`${name}/private`).set({ name: "Private staff data" });
    for (const uid of [null, "a1", "alice"]) {
      await assertFails(getDoc(doc(browser(uid), `${name}/private`)));
      await assertFails(getDocs(collection(browser(uid), name)));
    }
    await assertSucceeds(getDoc(doc(browser("admin"), `${name}/private`)));
  }
});

function adminSaver(authOverrides = {}) {
  const source = fs.readFileSync(process.env.ADMIN_TEST_FUNCTIONS || path.join(__dirname, "../../functions/index.js"), "utf8");
  const claims = [], authCalls = [];
  const auth = {
    getUser: async uid => ({ uid, customClaims: { admin: uid === "admin", nexusRole: uid === "admin" ? "admin" : "normal" } }),
    createUser: async attrs => { authCalls.push("create"); return { uid: "new-client", ...attrs }; },
    updateUser: async (uid, attrs) => { authCalls.push("update"); return { uid, ...attrs }; },
    setCustomUserClaims: async (uid, value) => claims.push({ uid, ...value }),
    ...authOverrides
  };
  const context = { exports: {}, onCall: fn => fn, requireAdmin: () => {}, HttpsError, chatAccessFromInput,
    console: { warn() {} }, require: name => { assert.ok(["./admin-user-errors", "./admin-access"].includes(name)); return require(`../../functions/${name.slice(2)}`); },
    text: value => String(value), optionalText: value => String(value || ""), nexusAdminEmail: "admin@nexus.co.za",
    navigationPermissionIds: new Set(["chat", "automation", "insights"]), db, getAuth: () => auth,
    FieldValue, requestActor: () => ({}), recordAccessAudit: async () => {} };
  require("node:vm").runInNewContext(source.match(/exports\.saveAdminUser = onCall\(async \(request\) => \{[\s\S]*?\r?\n\}\);/)[0], context);
  return { save: data => context.exports.saveAdminUser({ auth: { uid: "admin", token: { admin: true } }, data: { email: "new@example.test", name: "Staff", surname: "Test", password: "test-only-pass", role: "normal", allowedNavigationIds: ["chat", "automation", "insights"], ...data } }), claims, authCalls };
}
test("Admin save reports duplicate email without writing a staff profile", async () => {
  const harness = adminSaver({ createUser: async () => { throw Object.assign(new Error("private provider detail"), { code: "auth/email-already-exists" }); } });
  await assert.rejects(harness.save({}), error => error.code === "already-exists" && /existing user/.test(error.message));
  assert.equal((await db.doc("adminUsers/new-client").get()).exists, false);
});
test("Admin save preserves the account UID when its access claim write fails", async () => {
  const harness = adminSaver({ setCustomUserClaims: async () => { throw new Error("synthetic Auth interruption"); } });
  await assert.rejects(harness.save({}), error => error.code === "unavailable" && error.details.savedUid === "new-client" && error.details.incomplete === true);
  assert.deepEqual(harness.authCalls, ["create"]);
  assert.equal((await db.doc("adminUsers/new-client").get()).exists, false);
});
test("An existing administrator can explicitly grant any staff email full Admin access", async () => {
  const harness = adminSaver();
  await harness.save({ role: "admin" });
  assert.equal(harness.claims[0].admin, true);
  assert.equal((await db.doc("adminUsers/new-client").get()).data().role, "admin");
  assert.equal((await db.doc("adminUsers/new-client").get()).data().permissions.manageUsers, true);
});
test("any assigned staff Admin can read admin data, but stale roles and client markers cannot", async () => {
  const uid = "second-admin", ref = db.doc(`adminUsers/${uid}`);
  await ref.set({ ...profile("Manager"), role: "admin", email: "manager@example.test" });
  const client = env.authenticatedContext(uid, { admin: true, email: "manager@example.test" }).firestore();
  await assertSucceeds(getDoc(doc(client, "adminUsers/alice")));
  await assertFails(setDoc(doc(client, `adminUsers/${uid}`), { role: "admin" }));
  for (const fields of [{ role: "normal" }, { role: "admin", disabled: true }, { role: "admin", disabled: false, accountType: "client" }]) {
    await ref.update(fields); await assertFails(getDoc(doc(client, "adminUsers/alice")));
  }
});
test("serialized Admin changes prevent mutual disable and reject self-demotion", async () => {
  const { withAdminMutation, protectAdminSelf } = require("../../functions/admin-access");
  await db.doc("adminUsers/second-admin").set({ ...profile("Manager"), role: "admin" });
  const deps = { db, HttpsError, getAuth: () => ({ getUser: async () => ({ customClaims: { admin: true } }) }) };
  const requestFor = uid => ({ auth: { uid, token: { admin: true } } });
  assert.throws(() => protectAdminSelf(requestFor("admin"), "admin", "normal", false, HttpsError), /own Administrator/);
  assert.throws(() => protectAdminSelf(requestFor("admin"), "admin", "admin", true, HttpsError), /own Administrator/);
  let entered, finish;
  const start = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { finish = resolve; });
  const first = withAdminMutation(deps, requestFor("admin"), async () => { entered(); await hold; await db.doc("adminUsers/second-admin").update({ disabled: true }); });
  await start;
  await assert.rejects(withAdminMutation(deps, requestFor("second-admin"), async () => assert.fail("Concurrent mutation started")), error => error.code === "aborted");
  finish(); await first;
  await assert.rejects(withAdminMutation(deps, requestFor("second-admin"), async () => assert.fail("Disabled admin modified another account")), error => error.code === "permission-denied");
  assert.notEqual((await db.doc("adminUsers/admin").get()).data().disabled, true);
});
test("creating external accounts is unavailable and rejected before Auth writes", async () => {
  const harness = adminSaver();
  await assert.rejects(harness.save({ chatAccess: { audience: "external", clientId: "client-a" } }), /staff-only/);
  assert.deepEqual(harness.authCalls, []);
});
test("existing staff cannot become client identities with still-valid staff tokens", async () => {
  const harness = adminSaver();
  await assert.rejects(harness.save({ uid: "alice", chatAccess: { audience: "external", clientId: "client-a" } }), /staff-only/);
  assert.deepEqual(harness.authCalls, []);
});
test("client identities cannot be promoted to internal and old editor requests preserve restrictions", async () => {
  const harness = adminSaver();
  await db.doc("adminUsers/a1").update({ accountType: "client" });
  await assert.rejects(harness.save({ uid: "a1", chatAccess: { audience: "internal" } }), /cannot hold staff/);
  assert.deepEqual(harness.authCalls, []);
  await harness.save({ uid: "a1" });
  assert.equal(harness.claims[0].operator, false);
  assert.deepEqual((await db.doc("adminUsers/a1").get()).data().permissions.allowedNavigationIds, []);
  assert.equal((await db.doc("adminUsers/a1").get()).data().permissions.chatEnabled, false);
});
test("invalid chat input is rejected before changing authentication", async () => {
  const harness = adminSaver();
  await assert.rejects(harness.save({ chatAccess: { audience: "external", clientId: "../../client" } }));
  assert.deepEqual(harness.authCalls, []);
});
test("Admin responsibility grants persist, preserve old-editor omissions and reject invalid booleans", async () => {
  const harness = adminSaver();
  await assert.rejects(harness.save({ uid: "alice", chatAccess: { assignTasks: "true" } }), /permissions/);
  assert.deepEqual(harness.authCalls, []);
  await harness.save({ uid: "alice", chatAccess: { audience: "internal", createGroups: true, assignTasks: true, moderateMessages: false } });
  await harness.save({ uid: "alice", chatAccess: { audience: "internal", region: "Coastal" } });
  const saved = (await db.doc("adminUsers/alice").get()).data();
  assert.equal(saved.chatAccess.createGroups, true); assert.equal(saved.chatAccess.assignTasks, true); assert.equal(saved.chatAccess.moderateMessages, false);
  await harness.save({ uid: "alice", chatAccess: { audience: "internal", assignTasks: false } });
  assert.equal((await call("alice", { action: "bootstrap" })).actor.capabilities.assignTasks, false);
});

test("new staff default on; untick and retick persist without changing other menu grants", async () => {
  const harness = adminSaver();
  await harness.save({ allowedNavigationIds: undefined });
  assert.equal((await db.doc("adminUsers/new-client").get()).data().permissions.chatEnabled, true);
  await harness.save({ uid: "alice", allowedNavigationIds: ["insights"] });
  let saved = (await db.doc("adminUsers/alice").get()).data();
  assert.equal(chatEligible(saved), false); assert.deepEqual(saved.permissions.allowedNavigationIds, ["insights"]);
  await harness.save({ uid: "alice", allowedNavigationIds: undefined });
  assert.equal((await db.doc("adminUsers/alice").get()).data().permissions.chatEnabled, false, "An older editor cannot restore opted-out access");
  await harness.save({ uid: "alice", allowedNavigationIds: ["insights", "chat"] });
  saved = (await db.doc("adminUsers/alice").get()).data();
  assert.equal(chatEligible(saved), true); assert.deepEqual(saved.permissions.allowedNavigationIds, ["insights", "chat"]);
});

test("legacy staff can read assigned rooms by default; admin opt-out applies to admins too", async () => {
  const { roomId } = await create("team", ["legacy"]);
  await assertSucceeds(getDoc(doc(browser("legacy"), `meridianChatRooms/${roomId}`)));
  const saver = adminSaver();
  await saver.save({ uid: "admin", email: "admin@nexus.co.za", role: "admin", allowedNavigationIds: ["automation"] });
  await denied(call("admin", { action: "bootstrap" }));
  await assertFails(getDoc(doc(browser("admin"), `meridianChatRooms/${roomId}`)));
});
