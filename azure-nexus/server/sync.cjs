'use strict';
const {AzureStore}=require('./store.cjs');
const {GeoClient,syncOrders}=require('./geo.cjs');
const {parseAttendance,day}=require('./imports.cjs');
const {AppError}=require('./errors.cjs');
function filenameDate(name) {
  const base=name.split('/').at(-1);
  if(!base || base.startsWith('~$') || !/\.xlsx$/i.test(base))return null;
  const compact=base.match(/(?:^|\D)(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?=\D|$)/);
  const iso=base.match(/(20\d{2})-(\d{2})-(\d{2})[T _-](\d{2})[-:]?(\d{2})[-:]?(\d{2})/);
  const m=compact||iso;
  if(!m || !day(`${m[1]}-${m[2]}-${m[3]}`) || Number(m[4])>23 || Number(m[5])>59 || Number(m[6])>59)return null;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+02:00`);
}
function latestFiles(items,now=Date.now()) {
  const latest=new Map();
  for(const blob of items) {
    const match=blob.name.match(/^inbox\/attendance\/(rep|merchandiser)\/(\d{4}-(?:0[1-9]|1[0-2]))\/[^/]+\.xlsx$/i);
    const timestamp=filenameDate(blob.name);
    if(!match || timestamp===null || timestamp>now)continue;
    const key=`${match[1]}/${match[2]}`,previous=latest.get(key);
    if(previous && previous.timestamp===timestamp && previous.name!==blob.name)previous.ambiguous=true;
    if(!previous || timestamp>previous.timestamp)latest.set(key,{...blob,timestamp,audience:match[1],period:match[2],ambiguous:false});
  }
  if([...latest.values()].some(f=>f.ambiguous))throw new AppError('failed-precondition','Two attendance files have the same latest export timestamp. Resolve the duplicate before importing.');
  return [...latest.values()];
}
async function syncAttendance(store,assertLease=()=>{}) {
  const items=[];for await(const item of store.blobs.listBlobsFlat({prefix:'inbox/attendance/'}))items.push(item);
  const selected=latestFiles(items),results=[];
  for(const file of selected) {
    const current=await store.read(`attendance-${file.audience}`,file.period);
    if(current?.metadata.blobName===file.name && current?.metadata.blobEtag===file.properties.etag)continue;
    if(!file.properties.contentLength || file.properties.contentLength>8*1024*1024)throw new AppError('resource-exhausted','The newest attendance workbook exceeds 8 MB. No older fallback was used.');
    const bytes=await store.blobs.getBlobClient(file.name).downloadToBuffer(0,undefined,{conditions:{ifMatch:file.properties.etag}});
    const master=await store.read('stores','2000-01');
    const parsed=await parseAttendance(bytes,file.audience,file.period,master?.rows || []);
    assertLease();
    const result=await store.publish(`attendance-${file.audience}`,file.period,parsed.rows,{...parsed.metadata,blobName:file.name,blobEtag:file.properties.etag,fileName:file.name.split('/').at(-1),exportedAt:new Date(file.timestamp).toISOString()});
    results.push({audience:file.audience,period:file.period,count:result.count});
  }
  return results;
}
async function run(env=process.env) {
  const store=new AzureStore(env),lock=store.blobs.getBlockBlobClient('locks/import.lock');
  try{await lock.uploadData(Buffer.from('nexus'),{conditions:{ifNoneMatch:'*'}});}catch(e){if(e.statusCode!==409 && e.statusCode!==412)throw e;}
  const lease=lock.getBlobLeaseClient();
  try{await lease.acquireLease(60);}catch(e){if(e.statusCode===409){process.stdout.write('Another import is running.\n');return;}throw e;}
  let lost=false;
  const timer=setInterval(()=>lease.renewLease().catch(()=>{lost=true;}),20000);
  const assertLease=()=>{if(lost)throw new AppError('unavailable','Import lock was lost. Publication stopped.');};
  // Every publication, including orders, must still own the refresh lock.
  const publish=store.publish.bind(store);store.publish=async(...args)=>{assertLease();return publish(...args);};
  try {
    const results={};
    if(env.ATTENDANCE_INBOX_ENABLED==='true')results.attendance=await syncAttendance(store,assertLease);
    if(env.GEO_ORDERS_ENABLED==='true'){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const period=env.GEO_IMPORT_PERIOD || today.slice(0,7);
      results.orders=await syncOrders(store,new GeoClient(env),period);
    }
    process.stdout.write(JSON.stringify({event:'sync-completed',...results})+'\n');
  } finally {clearInterval(timer);await lease.releaseLease().catch(()=>{});}
}
if(require.main===module)run().catch(error=>{process.stderr.write(JSON.stringify({event:'sync-failed',code:error.code || 'internal',message:error instanceof AppError?error.message:'Azure import failed. Check the job diagnostics.'})+'\n');process.exitCode=1;});
module.exports={run,filenameDate,latestFiles,syncAttendance};
