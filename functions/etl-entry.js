"use strict";
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
initializeApp();
exports.meridianEtl = onCall({ timeoutSeconds: 180, memory: "512MiB", cpu: 1, maxInstances: 3, concurrency: 10, cors: ["https://meridian-nexus.web.app", "https://meridian-nexus.firebaseapp.com", /^http:\/\/localhost:\d+$/] }, require("./meridian-etl").createApi({ db: getFirestore(), getAuth, bucket: getStorage().bucket("meridain-nexus.firebasestorage.app"), HttpsError, invokeJob: require("./etl-azure-launcher").etlLauncherFromEnv() }));
