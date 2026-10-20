'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {onRequest,HttpsError}=require('firebase-functions/v2/https');
const ExcelJS=require('exceljs');
initializeApp({storageBucket:'meridain-nexus.firebasestorage.app'});
const db=getFirestore();db.settings({preferRest:true});
const allowed=new Set(['geoRepAttendanceDashboard','geoRepAttendanceConfig','geoRepMerchandiserAttendanceConfig','files','attendanceStoreMasters','salesTransactions','publicDashboardSources','publicDashboardOrderImports']);
const masterId=require('./product-clients.cjs').RESOURCE_ID;
const boundedDb={collection:name=>{
  if(name==='portalResources')return {doc:id=>{if(id!==masterId)throw Error('Resource is not exposed by this viewer.');return db.collection(name).doc(id);}};
  if(!allowed.has(name))throw Error('Dataset is not exposed by this viewer.');return db.collection(name);
}};
const boundedStorage=()=>({bucket:()=>({file:storagePath=>{
  if(typeof storagePath!=='string'||storagePath.includes('..')||!['uploads/','geo-rep-attendance-store-masters/',`portal-resources/${masterId}/`].some(prefix=>storagePath.startsWith(prefix)))throw Error('Unsupported report storage path.');
  const file=getStorage().bucket().file(storagePath);
  return {download:async options=>{const[meta]=await file.getMetadata();if(Number(meta.size)>25*1024*1024)throw new HttpsError('resource-exhausted','The source workbook exceeds 25 MB.');return file.download(options);}};
}})});
const service=require('./service.cjs').createService({db:boundedDb,getStorage:boundedStorage,ExcelJS,HttpsError});
exports.publicMeridianDashboards=onRequest({region:'us-central1',memory:'1GiB',cpu:1,timeoutSeconds:120,maxInstances:2,concurrency:4,
  serviceAccount:'nexus-public-viewer@meridain-nexus.iam.gserviceaccount.com',
  // Locked 20 October: the dashboards are on Azure behind Microsoft sign-in and the old site redirects there.
  invoker:'private',cors:false},require('./handler.cjs').createHandler(service));
