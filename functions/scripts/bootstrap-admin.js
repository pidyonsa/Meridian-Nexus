const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const projectId = process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || "meridain-nexus";
const accessToken = process.env.GCLOUD_ACCESS_TOKEN;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME || "Nexus";
const surname = process.env.BOOTSTRAP_ADMIN_SURNAME || "Admin";

if (!accessToken) throw new Error("GCLOUD_ACCESS_TOKEN is required.");
if (!email) throw new Error("BOOTSTRAP_ADMIN_EMAIL is required.");
if (!password || password.length < 6) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters.");

initializeApp({
  credential: {
    async getAccessToken() {
      return { access_token: accessToken, expires_in: 3000 };
    }
  },
  projectId
});

async function main() {
  const auth = getAuth();
  const db = getFirestore();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, {
      email,
      password,
      displayName: `${name} ${surname}`,
      disabled: false
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email,
      password,
      displayName: `${name} ${surname}`,
      disabled: false
    });
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  await db.collection("adminUsers").doc(user.uid).set({
    uid: user.uid,
    email,
    name,
    surname,
    disabled: false,
    passwordUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "bootstrap-admin"
  }, { merge: true });

  console.log(`Bootstrapped admin user ${user.uid}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
