"use strict";
const crypto = require("node:crypto");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const terminal = task => ["completed", "cancelled"].includes(task.status);
function reminderFields(value, fail) {
  if (!value) return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("Choose a valid reminder date and time.");
  return value;
}
function buildNotifications({ db, getAuth, getMessaging, chatEligible, canReadRoom, fail, nonce, now, onSchedule, onDocumentCreated, cleanup }) {
  const devices = db.collection("meridianChatDevices"), deliveries = db.collection("meridianChatDeliveries"), reminders = db.collection("meridianChatReminders");
  async function register(actor, data) {
    const deviceId = nonce(data.deviceId), ref = devices.doc(hash(deviceId));
    if (typeof data.enabled !== "boolean") fail("Choose a notification setting.");
    if (data.enabled && (typeof data.token !== "string" || data.token.length < 30 || data.token.length > 4096)) fail("A valid notification token is required.");
    return db.runTransaction(async tx => {
      const old = await tx.get(ref);
      if (old.exists && old.data().uid !== actor.uid) fail("This device belongs to a different signed-in account. Disable its notifications first.", "permission-denied");
      const count = await tx.get(devices.where("uid", "==", actor.uid).limit(10));
      if (data.enabled && !old.exists && count.size >= 10) fail("Notification device limit reached.", "resource-exhausted");
      if (!data.enabled) tx.delete(ref);
      else tx.set(ref, { uid: actor.uid, token: data.token, updatedAt: now() });
      return { enabled: data.enabled };
    });
  }
  function scheduleTask(tx, taskId, task) {
    const ref = reminders.doc(taskId);
    if (!task.remindAt || terminal(task)) tx.delete(ref);
    else tx.set(ref, { taskId, revision: task.reminderVersion || 1, nextAt: new Date(task.remindAt), expiresAt: new Date(Date.parse(task.remindAt) + 7 * 86400000) });
  }
  function scheduleAssignment(tx,taskId,task,actorUid){
    const ref=reminders.doc(`assigned_${taskId}`),due=Date.parse(task.remindAt || "");
    if(task.assigneeUid===actorUid || terminal(task) || (due<=Date.now()+300000 && due>=Date.now()-7*86400000)){tx.delete(ref);return;}
    tx.set(ref,{taskId,kind:"task",revision:task.assignmentVersion||1,nextAt:new Date(),expiresAt:new Date(Date.now()+7*86400000)});
  }
  async function allowed(uid, roomId) {
    const profile = await db.doc(`adminUsers/${uid}`).get(), account = await getAuth().getUser(uid).catch(() => null);
    const room = await db.doc(`meridianChatRooms/${roomId}`).get();
    return account && !account.disabled && !account.customClaims?.chatClient && account.customClaims?.nexusRole !== "client" && chatEligible(profile.data()) && room.exists && !room.data().archived && canReadRoom(profile.data(), uid, room.data());
  }
  async function deliver(uid, roomId, eventId, kind, taskId = "", stillValid = async () => true) {
    const tokens = await devices.where("uid", "==", uid).limit(10).get();
    for (const device of tokens.docs) {
      if (!await allowed(uid, roomId) || !await stillValid()) return;
      const value = device.data();
      if (value.updatedAt?.toMillis() < Date.now() - 90 * 86400000) { await device.ref.delete(); continue; }
      const ref = deliveries.doc(hash(`${eventId}:${device.id}`));
      const leased = await db.runTransaction(async tx => {
        const old = (await tx.get(ref)).data();
        if (old?.done) return false;
        if (old?.leaseUntil?.toMillis() > Date.now()) throw new Error("Notification delivery is already in progress.");
        tx.set(ref, { leaseUntil: new Date(Date.now() + 120000), expiresAt: new Date(Date.now() + 7 * 86400000) }); return true;
      });
      if (!leased) continue;
      try {
        // Data-only push: no employee, message, store or customer text on lock screens.
        await getMessaging().send({ token: value.token, data: { nexusChat: "1", uid, roomId, taskId, kind, eventId }, webpush: { headers: { TTL: "3600", Urgency: kind === "reminder" ? "high" : "normal" } } });
        await ref.set({ done: true, expiresAt: new Date(Date.now() + 7 * 86400000) });
      } catch (error) {
        await ref.delete();
        if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error.code)) await device.ref.delete();
        else throw error;
      }
    }
  }
  async function messageCreated(event) {
    const { roomId, messageId } = event.params;
    const messageRef = db.doc(`meridianChatRooms/${roomId}/messages/${messageId}`);
    const message = (await messageRef.get()).data();
    if (!message || message.removed || message.createdAt?.toMillis() < Date.now() - 3600000) return;
    const room = (await db.doc(`meridianChatRooms/${roomId}`).get()).data();
    for (const uid of room?.memberIds || []) if (uid !== message.senderUid) await deliver(uid, roomId, `message_${messageId}`, "message", "", async () => {
      const fresh = (await messageRef.get()).data();
      const receipt=(await db.doc(`meridianChatReads/${uid}/rooms/${roomId}`).get()).data();
      return fresh && !fresh.removed && (receipt?.sequence || 0)<fresh.sequence;
    });
  }
  async function sweep() {
    const due = await reminders.where("nextAt", "<=", new Date()).limit(100).get();
    for (const reminder of due.docs) {
      const assignment=reminder.data().kind==="task",taskId=reminder.data().taskId || reminder.id;
      const taskRef = db.doc(`meridianChatTasks/${taskId}`), task = (await taskRef.get()).data(), expected = reminder.data().revision;
      const valid = value => value && !terminal(value) && (assignment ? (value.assignmentVersion||1)===expected && reminder.data().expiresAt?.toMillis()>Date.now() : (value.reminderVersion || 1) === expected && value.remindAt && Date.parse(value.remindAt) <= Date.now() && Date.parse(value.remindAt) >= Date.now() - 7 * 86400000);
      if (valid(task)) await deliver(task.assigneeUid, task.roomId, `${assignment?"assigned":"task"}_${taskId}_${expected}`, assignment?"task":"reminder", taskId, async () => valid((await taskRef.get()).data()));
      await db.runTransaction(async tx => { const fresh = await tx.get(reminder.ref); if (fresh.data()?.revision === expected) tx.delete(reminder.ref); });
    }
    const old = await deliveries.where("expiresAt", "<=", new Date()).limit(200).get();
    if (old.size) { const batch = db.batch(); old.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); }
    await cleanup();
  }
  const exports = {};
  if (onDocumentCreated) exports.notifyMeridianChatMessage = onDocumentCreated({ document: "meridianChatRooms/{roomId}/messages/{messageId}", retry: true, timeoutSeconds: 180, memory: "256MiB", concurrency: 4, maxInstances: 3 }, messageCreated);
  if (onSchedule) exports.deliverMeridianChatReminders = onSchedule({ schedule: "every 5 minutes", timeZone: "Africa/Johannesburg", timeoutSeconds: 540, memory: "256MiB", concurrency: 1, maxInstances: 1, retryCount: 3 }, sweep);
  return { register, scheduleTask, scheduleAssignment, deliver, sweep, messageCreated, exports };
}
module.exports = { buildNotifications, reminderFields };
