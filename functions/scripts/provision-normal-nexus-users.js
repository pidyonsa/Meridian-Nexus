"use strict";

const { randomBytes } = require("crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const projectId = process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "meridain-nexus";
const accessToken = process.env.GCLOUD_ACCESS_TOKEN;

if (!accessToken) throw new Error("GCLOUD_ACCESS_TOKEN is required.");

const users = [
  { email: "snaidoo@meridiangroup.co.za", name: "S", surname: "Naidoo" },
  { email: "hjvzyl@meridiangroup.co.za", name: "HJV", surname: "Zyl" },
  { email: "jjooste@meridiangroup.co.za", name: "J", surname: "Jooste" }
];

initializeApp({
  credential: {
    async getAccessToken() {
      return { access_token: accessToken, expires_in: 3000 };
    }
  },
  projectId
});

function temporaryPassword() {
  return `Nexus!${randomBytes(24).toString("base64url")}`;
}

function normalPermissions() {
  return {
    runJobs: true,
    manageAutomation: false,
    manageSchedules: false,
    manageUsers: false,
    viewAllAudit: false,
    stopAnyJob: false
  };
}

function firestoreFields(entry, uid) {
  const permissions = normalPermissions();
  const now = new Date().toISOString();
  return {
    uid: { stringValue: uid },
    email: { stringValue: entry.email },
    name: { stringValue: entry.name },
    surname: { stringValue: entry.surname },
    role: { stringValue: "normal" },
    disabled: { booleanValue: false },
    permissions: {
      mapValue: {
        fields: Object.fromEntries(Object.entries(permissions).map(([key, value]) => [key, { booleanValue: value }]))
      }
    },
    passwordUpdatedAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
    updatedBy: { stringValue: "normal-user-provisioning" }
  };
}

function profileUrl(uid = "") {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/adminUsers`;
  return uid ? `${base}/${encodeURIComponent(uid)}` : base;
}

async function profileExists(uid) {
  const response = await fetch(profileUrl(uid), {
    headers: { Authorization: `Bearer ${accessToken}`, "X-Goog-User-Project": projectId }
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Could not check access profile: ${await response.text()}`);
  return true;
}

async function createProfile(entry, uid) {
  if (await profileExists(uid)) return false;
  const response = await fetch(`${profileUrl()}?documentId=${encodeURIComponent(uid)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Goog-User-Project": projectId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: firestoreFields(entry, uid) })
  });
  if (!response.ok) throw new Error(`Could not create access profile: ${await response.text()}`);
  return true;
}

async function provisionUser(entry) {
  const auth = getAuth();
  let existing = null;
  try {
    existing = await auth.getUserByEmail(entry.email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  if (existing) {
    const isNormal = existing.customClaims?.operator === true || existing.customClaims?.nexusRole === "normal";
    if (!isNormal) return "already exists (not changed)";
    const profileCreated = await createProfile(entry, existing.uid);
    return profileCreated ? "existing Normal account profile completed" : "already exists (not changed)";
  }

  const attributes = {
    email: entry.email,
    displayName: `${entry.name} ${entry.surname}`,
    password: temporaryPassword(),
    disabled: false
  };
  const user = await auth.createUser(attributes);
  await auth.setCustomUserClaims(user.uid, {
    admin: false,
    operator: true,
    nexusRole: "normal"
  });

  await createProfile(entry, user.uid);

  return "created";
}

async function main() {
  for (const entry of users) {
    const outcome = await provisionUser(entry);
    console.log(`${entry.email}: ${outcome} as Normal`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
