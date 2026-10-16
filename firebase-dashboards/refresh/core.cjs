'use strict';
const crypto=require('node:crypto');
const {parseOrders}=require('./order-workbook.cjs');
const RETAILER='geo-rep-sales-transactions';
const key=value=>String(value||'').trim().replace(/\s+/g,' ').toUpperCase();
const iso=value=>value?.toDate?.().toISOString()||value||'';
function candidate(run,file){
  if(run.retailerId!==RETAILER||run.status!=='completed'||!run.fileId)throw Error('A completed Geo Rep transaction download is required.');
  if(file.retailerId!==RETAILER||file.extractionRunId!==run.id)throw Error('The transaction file is not linked to this completed download.');
  const range={startDate:file.reportStartDate,endDate:file.reportEndDate};
  const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  if(!validDate(range.startDate)||!validDate(range.endDate)||!range.startDate.endsWith('-01')||range.startDate.slice(0,7)!==range.endDate.slice(0,7)||range.endDate<range.startDate)throw Error('Only complete month-to-date transaction snapshots can be published.');
  if(run.reportStartDate!==range.startDate||run.reportEndDate!==range.endDate)throw Error('The job and file reporting periods differ.');
  if(!/^[a-f0-9]{64}$/.test(file.sha256||''))throw Error('A verified workbook checksum is required.');
  if(!file.storagePath?.startsWith(`uploads/${run.fileId}/`)||file.storagePath.includes('..'))throw Error('Unexpected transaction workbook path.');
  const importedAt=iso(file.uploadedAt);if(!Number.isFinite(Date.parse(importedAt)))throw Error('The download timestamp is missing.');
  return {...file,id:run.fileId,range,importedAt};
}
function newer(file,current){
  if(!current)return true;
  if(file.range.endDate!==current.range?.endDate)return file.range.endDate>String(current.range?.endDate||'');
  return Date.parse(file.importedAt)>Date.parse(current.importedAt||0);
}
function enrich(rows,history){
  const maps=[new Map(),new Map()];
  for(const old of history)for(const [i,field]of ['storeCode','storeName'].entries()){
    const k=key(old[field]);if(!k)continue;const values=maps[i].get(k)||[];values.push(old);maps[i].set(k,values);
  }
  return rows.map(row=>{
    const r={...row},matches=maps[0].get(key(r.storeCode))||maps[1].get(key(r.storeName))||[];
    for(const field of ['region','channel','client','banner']){
      const values=[...new Map(matches.map(m=>m[field]).filter(v=>v&&!/^(unmapped|unassigned|not supplied)$/i.test(v)).map(v=>[key(v),v])).values()];
      if(!r[field]&&values.length===1)r[field]=values[0];
    }
    r.mapped=!!r.region;return r;
  });
}
async function refresh({repo,download,ExcelJS,now=()=>new Date().toISOString()}){
  const owner=crypto.randomUUID();if(!await repo.acquire(owner,now()))return {status:'busy'};
  try{
    const run=await repo.latestRun();
    if(!run||['queued','running','waiting'].includes(run.status)){await repo.finish(owner,{status:'waiting',checkedAt:now()});return {status:'waiting'};}
    if(run.status!=='completed')throw Error('The latest scheduled Geo Rep download has not completed successfully.');
    const file=candidate(run,await repo.file(run.fileId)),current=await repo.current();
    if(!newer(file,current)){await repo.finish(owner,{status:'current',checkedAt:now()});return {status:'current'};}
    const bytes=await download(file.storagePath);
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Workbook checksum mismatch; existing dashboard retained.');
    const parsed=await parseOrders(bytes,{ExcelJS,range:file.range,importedAt:file.importedAt,sha256:file.sha256});
    const rows=enrich(parsed.rows,await repo.history());
    const version=crypto.createHash('sha256').update(JSON.stringify([file.id,file.sha256,file.importedAt,rows])).digest('hex');
    const metadata={...parsed.metadata,version,period:file.range.startDate.slice(0,7),sourceFileId:file.id,sourceRunId:run.id,publishedAt:now(),mappedRows:rows.filter(r=>r.mapped).length,refreshSchedule:'06:00 Africa/Johannesburg'};
    await repo.stage(version,rows);
    const changed=await repo.publish(metadata,owner);
    const result={status:changed?'published':'superseded',checkedAt:now(),sourceFileId:file.id,version,rowCount:rows.length,through:file.range.endDate,importedAt:file.importedAt,publishedAt:metadata.publishedAt};
    await repo.finish(owner,result);return result;
  }catch(error){await repo.finish(owner,{status:'failed',checkedAt:now(),message:String(error.message).slice(0,500)});throw error;}
}
module.exports={RETAILER,candidate,newer,enrich,refresh,iso};
