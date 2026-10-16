"use strict";

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const projectId = "meridain-nexus";
const users = [
  { email: "admin@nexus.co.za", role: "admin" },
  { email: "jukachukwu@meridiangroup.co.za", role: "normal" }
];

initializeApp({ credential: applicationDefault(), projectId });

function permissionsFor(role) {
  return role === "admin"
    ? { runJobs: true, manageAutomation: true, manageSchedules: true, manageUsers: true, viewAllAudit: true, stopAnyJob: true }
    : { runJobs: true, manageAutomation: false, manageSchedules: false, manageUsers: false, viewAllAudit: false, stopAnyJob: false };
}

async function main() {
  const auth = getAuth();
  const db = getFirestore();
  for (const entry of users) {
    const user = await auth.getUserByEmail(entry.email);
    const claims = { ...(user.customClaims || {}), admin: entry.role === "admin", operator: entry.role === "normal", nexusRole: entry.role };
    await auth.setCustomUserClaims(user.uid, claims);
    await db.collection("adminUsers").doc(user.uid).set({
      uid: user.uid,
      email: entry.email,
      role: entry.role,
      permissions: permissionsFor(entry.role),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "access-role-migration"
    }, { merge: true });
    console.log(`${entry.email}: ${entry.role}`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
