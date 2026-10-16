'use strict';
const path=require('node:path');
const crypto=require('node:crypto');
const express=require('express');
const helmet=require('helmet');
const {authentication,admin,previewAllowed}=require('./auth.cjs');
const {AzureStore}=require('./store.cjs');
const {service}=require('./analytics.cjs');
const {parseAttendance,workbookTables,readTable,pick}=require('./imports.cjs');
const {AppError}=require('./errors.cjs');
function appFor(store,env=process.env) {
  const app=express(),api=service(store);
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","blob:"],fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:env.NODE_ENV==='production'?[]:null}},strictTransportSecurity:env.NODE_ENV==='production'?undefined:false}));
  app.get('/healthz',(req,res)=>res.json({status:'ok'}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();},authentication(env),(req,res,next)=>{
    if(req.method!=='GET' && !previewAllowed(env) && req.get('origin')!==env.PUBLIC_ORIGIN) return next(new AppError('permission-denied','Untrusted request origin.'));
    next();
  });
  const limits=new Map();
  app.use('/api',(req,res,next)=>{
    const now=Date.now();for(const [k,v] of limits)if(v.until<=now)limits.delete(k);
    const key=req.user.id,entry=limits.get(key)||{count:0,until:now+60000};entry.count++;limits.set(key,entry);
    if(entry.count>120) {res.set('Retry-After','60');return res.status(429).json({error:'Too many requests. Please wait a minute.'});}next();
  });
  app.get('/api/session',(req,res)=>res.json(req.user));
  app.post('/api/attendance',express.json({limit:'32kb'}),async(req,res)=>res.json(await api.attendance(req.body)));
  app.post('/api/orders',express.json({limit:'32kb'}),async(req,res)=>res.json(await api.orders(req.body)));
  app.get('/api/sources',admin,async(req,res)=>{
    const output={};for(const dataset of ['attendance-rep','attendance-merchandiser','orders','hierarchy','stores'])output[dataset]=await store.list(dataset);
    res.json(output);
  });
  app.post('/api/import/attendance',admin,express.raw({type:'application/octet-stream',limit:'8mb'}),async(req,res)=>{
    const {audience,period}=req.query,master=await store.read('stores','2000-01');
    const parsed=await parseAttendance(req.body,audience,period,master?.rows || []);
    const fileName=decodeURIComponent(String(req.get('x-file-name')||'Geo schedule.xlsx')).slice(0,250);
    const result=await store.publish(`attendance-${audience}`,period,parsed.rows,{...parsed.metadata,fileName,actor:req.user.id});
    res.json({count:result.count,version:result.version});
  });
  app.post('/api/import/reference/:kind',admin,express.raw({type:'application/octet-stream',limit:'8mb'}),async(req,res)=>{
    const kind=req.params.kind;
    if(!['hierarchy','stores'].includes(kind))throw new AppError('invalid-argument','Invalid reference type.');
    const aliases=kind==='hierarchy'?{name:['Rep','Name','Rep Name'],manager:['Line Manager','Channel Manager','Manager'],regionalManager:['Regional Manager'],generalManager:['General Manager'],head:['Head of Syndicated','Head'],region:['Region','Province'],division:['Division']}:{storeCode:['Store Code','Geo Rep Store Code','Customer Code','Diplomat Customer no'],storeName:['Store Name','Customer Name'],rep:['Rep','Rep Name'],manager:['Manager','Line Manager','Channel Manager'],region:['Region','Province'],banner:['Banner','Retailer'],channel:['Channel'],client:['Client']};
    const sheets=await workbookTables(req.body);let table;
    for(const sheet of sheets){table=readTable(sheet,[kind==='hierarchy'?aliases.name:aliases.storeName,kind==='hierarchy'?aliases.manager:aliases.storeCode]);if(table)break;}
    if(!table)throw new AppError('invalid-argument',kind==='hierarchy'?'Hierarchy requires Rep/Name and Line Manager/Manager columns.':'Store master requires Store Code and Store Name columns.');
    const rows=table.map(row=>({...Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,String(pick(row,a)).trim()])),...(kind==='hierarchy'?{assignment:'syndicated'}:{})}));
    const result=await store.publish(kind,'2000-01',rows,{actor:req.user.id,fileName:String(req.get('x-file-name')||kind).slice(0,250)});
    res.json({count:result.count,version:result.version});
  });
  app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API route.'}));
  app.use('/vendor/icons',express.static(path.join(__dirname,'../node_modules/@phosphor-icons/web/src/regular'),{index:false}));
  app.use('/vendor/fonts',express.static(path.join(__dirname,'../node_modules/@fontsource/poppins/files'),{index:false}));
  app.use(express.static(path.join(__dirname,'../public'),{setHeaders(res){res.set('Cache-Control','no-cache');}}));
  app.use((error,req,res,next)=>{
    const id=crypto.randomUUID();
    const status=error instanceof AppError?error.status:error.status===413?413:500;
    if(status>=500) process.stderr.write(JSON.stringify({event:'request-failed',id,route:req.path,code:error.code || 'internal'})+'\n');
    res.status(status).json({error:error instanceof AppError?error.message:status===413?'Upload exceeds the allowed size.':'The request could not be completed. Contact your administrator.',code:error.code || 'internal',requestId:id});
  });
  return app;
}
if(require.main===module) {
  if(process.env.NEXUS_PREVIEW) throw Error('Use the local preview command; preview mode is forbidden on the production entry point.');
  if(!process.env.PUBLIC_ORIGIN || !process.env.ENTRA_TENANT_ID || !process.env.ENTRA_CLIENT_ID) throw Error('Configure PUBLIC_ORIGIN, ENTRA_TENANT_ID and ENTRA_CLIENT_ID before starting Azure Nexus.');
  appFor(new AzureStore()).listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>process.stdout.write('Azure Nexus is listening.\n'));
}
module.exports={appFor};
