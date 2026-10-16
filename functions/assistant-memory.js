"use strict";
const crypto = require("node:crypto");
const { chatEligible } = require("./meridian-chat");
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function scopeKey(profile, runId = "") {
  return digest([profile.role, profile.email, profile.disabled === true, profile.accountType || "", profile.permissions || {}, profile.chatAccess || {}, runId]);
}
function reviewedDraft(value, fail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("The assistant could not produce a valid task draft.");
  const draft = {};
  for (const [key, max] of [["title", 180], ["note", 2000], ["store", 120], ["product", 160]]) {
    if (typeof value[key] !== "string" || value[key].length > max) fail("The assistant returned an invalid task draft. Please retry.");
    draft[key] = value[key].trim();
  }
  if (!draft.title || !["low", "normal", "high"].includes(value.priority)) fail("The assistant returned an incomplete task draft.");
  return { ...draft, priority: value.priority };
}
function buildAssistantMemory({ db, HttpsError }) {
  const fail = (message, code = "failed-precondition") => { throw new HttpsError(code, message); };
  const refFor = uid => db.collection("meridianAssistantSessions").doc(uid);
  async function begin(uid, profile, data) {
    const sessionId = data.conversationId;
    if (!sessionId) return { turns: [], commit: async () => ({}) };
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId) || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId || "")) fail("Invalid AI session.", "invalid-argument");
    const scope = scopeKey(profile, data.runId || ""), ref = refFor(uid);
    const snapshot = await ref.get(), old = snapshot.data() || {};
    const reusable = old.sessionId === sessionId && old.scope === scope && old.expiresAt?.toMillis() > Date.now();
    const turns = reusable ? old.turns || [] : [];
    const fingerprint = digest([data.question, data.intent || "answer", data.runId || ""]);
    if (reusable && old.requestId === data.requestId) {
      if (old.fingerprint !== fingerprint) fail("AI request identifier already used.", "already-exists");
      return { cached: old.response, turns };
    }
    return { turns, reset: !!old.scope && !reusable, async commit(answer, response, draft = null) {
      const draftId = draft ? crypto.randomUUID() : null;
      const result = { ...response, ...(draft ? { draft, draftId } : {}), memoryReset: !!old.scope && !reusable };
      await db.runTransaction(async tx => {
        const freshProfile = (await tx.get(db.doc(`adminUsers/${uid}`))).data();
        const fresh = (await tx.get(ref)).data() || {};
        if (!freshProfile || !chatEligible(freshProfile) || scopeKey(freshProfile, data.runId || "") !== scope) fail("Your permissions changed. Start a new AI session.", "permission-denied");
        if ((fresh.revision || 0) !== (old.revision || 0)) fail("This AI session changed. Please retry.", "aborted");
        const savedTurns = [...turns, { role: "user", text: data.question.slice(0, 1400) }, { role: "model", text: answer.slice(0, 8000) }].slice(-12);
        tx.set(ref, { sessionId, scope, revision: (old.revision || 0) + 1, requestId: data.requestId, fingerprint, response: result, turns: savedTurns,
          draft: draft ? { id: draftId, fields: draft, scope, runId: data.runId || "", expiresAt: new Date(Date.now() + 1800000) } : null, expiresAt: new Date(Date.now() + 1800000) });
      });
      return result;
    } };
  }
  async function readDraft(tx, uid, profile, draftId) {
    const draft = (await tx.get(refFor(uid))).data()?.draft;
    if (!draft || draft.id !== draftId || draft.expiresAt.toMillis() <= Date.now() || draft.scope !== scopeKey(profile, draft.runId)) fail("This draft expired or your access changed. Ask the assistant for a new draft.");
    if (draft.runId) {
      const run = await tx.get(db.doc(`extractionRuns/${draft.runId}`));
      const admin = require("./admin-access").isAdminProfile(profile);
      if (!run.exists || (!admin && run.data().createdBy !== uid)) fail("The draft's source job is no longer available to you.", "permission-denied");
    }
    return draft.fields;
  }
  async function clear(uid) { await db.runTransaction(async tx => { const ref = refFor(uid), old = (await tx.get(ref)).data(); tx.set(ref, { revision: (old?.revision || 0) + 1, turns: [], expiresAt: new Date(Date.now() + 1800000) }); }); }
  async function cleanup() {
    const expired = await db.collection("meridianAssistantSessions").where("expiresAt", "<=", new Date()).limit(200).get();
    // Transactional expiry prevents cleanup from deleting a newly refreshed session.
    for (const doc of expired.docs) await db.runTransaction(async tx => { const fresh = await tx.get(doc.ref); if (fresh.data()?.expiresAt?.toMillis() <= Date.now()) tx.delete(doc.ref); });
  }
  return { begin, readDraft, clear, cleanup };
}
module.exports = { buildAssistantMemory, reviewedDraft, scopeKey };
