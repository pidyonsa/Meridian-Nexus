// Standalone deployment entry: no automation handlers or third-party credentials.
const {onCall,HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
initializeApp();
exports.getFranchiseOrderDashboard = onCall({timeoutSeconds:120,memory:"512MiB",cpu:1,maxInstances:3,concurrency:20,cors:["https://meridian-nexus.web.app","https://meridian-nexus.firebaseapp.com"]},require("./franchise-orders").createReader({db:getFirestore(),getAuth,HttpsError}));
