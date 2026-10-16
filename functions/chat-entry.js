"use strict";
// Scoped deployment entry: excludes dashboards, ETLs and extraction automations.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, FieldPath } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { buildChat } = require("./meridian-chat");
initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 3 });
Object.assign(exports, buildChat({ db: getFirestore(), getAuth, getMessaging, onCall, HttpsError, onSchedule, onDocumentCreated, FieldValue, FieldPath, bucket: () => getStorage().bucket("meridain-nexus.firebasestorage.app") }));
