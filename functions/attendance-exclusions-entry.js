'use strict';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
initializeApp();
exports.manageSyndicatedAttendanceExclusions = onCall({region:'us-central1', memory:'512MiB', timeoutSeconds:60, maxInstances:2,
  serviceAccount:'730011371323-compute@developer.gserviceaccount.com', cors:['https://meridian-nexus.web.app','https://meridian-nexus.firebaseapp.com']},
  require('./attendance-exclusions-admin').createService({db:getFirestore(), getAuth, HttpsError,
    ExcelJS:require('exceljs'), JSZip:require('jszip'), hierarchy:require('./attendance-hierarchy.json')}));
