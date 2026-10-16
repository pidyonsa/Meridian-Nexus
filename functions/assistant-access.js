"use strict";
const { chatEligible } = require("./meridian-chat");
async function authorizeAssistant({ db, getAuth, HttpsError }, request, actor) {
  if (!request.auth?.uid || request.auth.uid !== actor.uid) throw new HttpsError("unauthenticated", "Sign in to Nexus.");
  if (request.data?.expectedUid && request.data.expectedUid !== actor.uid) throw new HttpsError("permission-denied", "Your account changed. Start a new AI session.");
  const profile = (await db.doc(`adminUsers/${actor.uid}`).get()).data(), account = await getAuth().getUser(actor.uid);
  if (!chatEligible(profile) || account.disabled || account.customClaims?.chatClient || account.customClaims?.nexusRole === "client" || request.auth.token.chatClient || request.auth.token.nexusRole === "client" || (account.tokensValidAfterTime && Number(request.auth.token.auth_time || 0) * 1000 < Date.parse(account.tokensValidAfterTime))) throw new HttpsError("permission-denied", "Your account is not permitted to use the staff assistant.");
  return { profile, actor: { ...actor, role: require("./admin-access").isAdminProfile(profile) && account.customClaims?.admin === true && actor.role === "admin" ? "admin" : "normal" } };
}
function workspaceAccess(actor, permissions) {
  const nav = new Set(permissions.navigation || []), admin = actor.role === "admin";
  return { sales: admin || nav.has("sales") || nav.has("insights"), attendance: admin || nav.has("attendance"), stockfix: admin || nav.has("stockfix"), adoption: admin || nav.has("adoption"), training: admin, integrationHealth: admin };
}
async function authorizeAssistantRun({ db, HttpsError }, actor, runId) {
  if (!runId) return {};
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(runId)) throw new HttpsError("invalid-argument", "Choose a valid extraction run.");
  const snapshot = await db.collection("extractionRuns").doc(runId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "The selected extraction run was not found.");
  const run = { ...snapshot.data(), id: snapshot.id };
  if (actor.role !== "admin" && run.createdBy !== actor.uid) throw new HttpsError("permission-denied", "You can analyse only jobs that you started.");
  return run;
}
module.exports = { authorizeAssistant, authorizeAssistantRun, workspaceAccess };
