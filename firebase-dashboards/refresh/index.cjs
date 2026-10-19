'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {onRequest}=require('firebase-functions/v2/https');
const ExcelJS=require('exceljs');
const {refresh,newer,iso,RETAILER}=require('./core.cjs');
initializeApp({storageBucket:'meridain-nexus.firebasestorage.app'});
const db=getFirestore(),state=db.doc('publicDashboardRefresh/orders'),pointer=db.doc('publicDashboardSources/orders');
const repo={
  async acquire(owner,at){return db.runTransaction(async tx=>{const old=(await tx.get(state)).data()||{};if(Date.parse(old.leaseUntil)>Date.parse(at))return false;tx.set(state,{owner,leaseUntil:new Date(Date.parse(at)+360000).toISOString(),status:'running',startedAt:at},{merge:true});return true;});},
  async latestRun(){const retailer=(await db.doc(`retailers/${RETAILER}`).get()).data(),id=retailer?.reportSchedule?.lastQueuedRunId;if(!id)return null;const run=(await db.doc(`extractionRuns/${id}`).get()).data();return run?{...run,id}:null;},
  async file(id){return (await db.doc(`files/${id}`).get()).data()||{};},
  async current(){return (await pointer.get()).data();},
  async history(){const snap=await db.collection('salesTransactions').select('storeCode','storeName','region','channel','client','banner').limit(30001).get();if(snap.size>30000)throw Error('Store enrichment exceeds its validated read limit.');return snap.docs.map(d=>d.data());},
  async stage(version,rows){
    const chunks=db.collection(`publicDashboardOrderImports/${version}/chunks`),batch=db.batch();
    for(let offset=0;offset<rows.length;offset+=200){const part=rows.slice(offset,offset+200);if(Buffer.byteLength(JSON.stringify(part))>700000)throw Error('Order chunk is too large.');batch.set(chunks.doc(String(offset/200).padStart(4,'0')),{rows:part});}
    await batch.commit();const stored=await chunks.get();if(stored.docs.reduce((n,d)=>n+d.data().rows.length,0)!==rows.length)throw Error('Incomplete staged snapshot; existing dashboard retained.');
  },
  async publish(metadata,owner){return db.runTransaction(async tx=>{const current=(await tx.get(pointer)).data(),lock=(await tx.get(state)).data();if(lock?.owner!==owner)throw Error('Publisher lease changed; existing dashboard retained.');if(!newer(metadata,current))return false;tx.set(pointer,metadata);return true;});},
  async finish(owner,result){return db.runTransaction(async tx=>{const current=(await tx.get(state)).data();if(current?.owner===owner)tx.set(state,{...result,leaseUntil:null,...(result.status==='published'?{lastSuccessAt:result.publishedAt}:{}),...(result.status!=='failed'?{message:null}:{})},{merge:true});});}
};
// Shared by the Google function and the Azure publisher job.
const runRefresh=()=>refresh({repo,ExcelJS,download:async path=>{const file=getStorage().bucket().file(path),[meta]=await file.getMetadata();if(Number(meta.size)>40*1024*1024)throw Error('Workbook exceeds the 40 MB limit.');return (await file.download())[0];}});
exports.runRefresh=runRefresh;
exports.refreshPublicFranchiseOrders=onRequest({timeoutSeconds:300,memory:'1GiB',cpu:1,maxInstances:1,concurrency:1,invoker:'private'},async(req,res)=>{
  if(req.method!=='POST')return res.status(405).send('Method not allowed');
  try{
    const result=await runRefresh();
    console.log(JSON.stringify(result));res.json(result);
  }catch(error){console.error('Public order snapshot refresh failed:',error.message);res.status(500).json({error:'The source could not be published. The previous verified snapshot is retained.'});}
});
