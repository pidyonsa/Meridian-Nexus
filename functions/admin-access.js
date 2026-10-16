"use strict";
const crypto = require("node:crypto");
function isStaffProfile(profile) {
  return !!profile && profile.disabled !== true && profile.accountType !== "client" && profile.role !== "client"
    && profile.chatAccess?.audience !== "external" && profile.chatAccess?.workRole !== "Client"
    && (profile.accountType === "staff" || ["admin", "normal"].includes(profile.role));
}
const isAdminProfile = profile => isStaffProfile(profile) && profile.role === "admin";
async function assertActiveAdmin({ db, getAuth, HttpsError }, request) {
  const uid = request.auth?.uid, token = request.auth?.token || {};
  if (!uid || token.admin !== true || token.chatClient === true || token.nexusRole === "client") throw new HttpsError("permission-denied", "Administrator access is required.");
  const profile = (await db.collection("adminUsers").doc(uid).get()).data();
  const account = await getAuth().getUser(uid).catch(() => null);
  const claims = account?.customClaims || {};
  if (!isAdminProfile(profile) || !account || account.disabled || claims.admin !== true || claims.chatClient === true || claims.nexusRole === "client"
    || (account.tokensValidAfterTime && Number(token.auth_time || 0) * 1000 < Date.parse(account.tokensValidAfterTime))) throw new HttpsError("permission-denied", "Your administrator access has changed. Sign in again or contact another administrator.");
  return profile;
}
function guardCallables(onCall, dependencies) {
  return (...args) => {
    const handler = args.pop();
    return onCall(...args, async (request, response) => {
      if (request.auth?.token?.admin === true) await assertActiveAdmin({ ...dependencies, db: dependencies.db() }, request);
      return handler(request, response);
    });
  };
}
async function withAdminMutation(dependencies, request, action) {
  const { db, HttpsError } = dependencies;
  await assertActiveAdmin(dependencies, request);
  const ref = db.collection("nexusSecurity").doc("adminUserMutation"), owner = crypto.randomUUID();
  // Serialize Auth/profile changes. The lease exceeds the callable timeout;
  // another active administrator remains because self-removal is forbidden.
  await db.runTransaction(async tx => {
    const lease = (await tx.get(ref)).data();
    const profile = (await tx.get(db.collection("adminUsers").doc(request.auth.uid))).data();
    if (!isAdminProfile(profile)) throw new HttpsError("permission-denied", "Your administrator access has changed.");
    if (lease?.until?.toMillis() > Date.now()) throw new HttpsError("aborted", "Another account change is being saved. Wait a moment and retry.");
    tx.set(ref, { owner, actorUid: request.auth.uid, until: new Date(Date.now() + 600000) });
  });
  try {
    await assertActiveAdmin(dependencies, request);
    return await action();
  } finally {
    await db.runTransaction(async tx => { if ((await tx.get(ref)).data()?.owner === owner) tx.delete(ref); }).catch(error => console.warn("Admin mutation lease cleanup failed", { code: error.code || "unknown" }));
  }
}
function protectAdminSelf(request, uid, role, disabled, HttpsError) {
  if (uid === request.auth.uid && (role !== "admin" || disabled)) throw new HttpsError("failed-precondition", "You cannot remove or disable your own Administrator access. Another administrator must make that change.");
}
module.exports = { isStaffProfile, isAdminProfile, assertActiveAdmin, guardCallables, withAdminMutation, protectAdminSelf };
