"use strict";
// Standalone Support deployment; no imports of the automation entry point.
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue,FieldPath,Timestamp}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const {getStorage}=require("firebase-admin/storage");
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {onSchedule}=require("firebase-functions/v2/scheduler");
const {setGlobalOptions}=require("firebase-functions/v2");
initializeApp();
setGlobalOptions({region:"us-central1",maxInstances:3,serviceAccount:"730011371323-compute@developer.gserviceaccount.com"});
Object.assign(exports,require("./meridian-support").buildSupport({db:getFirestore(),FieldValue,FieldPath,Timestamp,getAuth,onCall,HttpsError,onSchedule,bucket:()=>getStorage().bucket("meridain-nexus.firebasestorage.app")}));
