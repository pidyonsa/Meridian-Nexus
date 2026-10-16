'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ExcelJS=require('../backend/node_modules/exceljs'),R=require('../backend/order-regions.cjs');
const h=require('../../scripts/repair-attendance-september-weeks.cjs'),{fields}=require('./firestore-values.cjs');
const directory=path.resolve(__dirname,'../test-results/order-regions');
async function main(){
  const bytes=fs.readFileSync(path.join(directory,'master.xlsx')),source=JSON.parse(fs.readFileSync(path.join(directory,'sources.json'))).master;
  const entries=await R.parseMaster(bytes,ExcelJS),evidence=JSON.parse(fs.readFileSync(path.join(directory,'additional-store-evidence.json')));
  const allowed=['DURBANVILLE KWIKSPAR','SPAR OLD OAK','SPAR MORNINGFIELD','OBZ KWIKSPAR'];
  assert.deepEqual(evidence.map(e=>e.name).sort(),allowed.sort());
  for(const e of evidence){assert.ok(e.version&&e.stores.length);assert.ok(e.stores.every(s=>s.storeName===e.name&&s.region==='Western Cape'));entries.push(...e.stores);}
  const compiled=R.compile(entries),resource={...compiled,active:true,sourceName:source.sourceName,sourceSheet:'Call Cycle Master',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),additionalEvidence:evidence,updatedAt:new Date().toISOString(),scope:'Temporary public Orders region lookup; no original ledger changes'};
  const encoded=fields(resource);assert.ok(Buffer.byteLength(JSON.stringify(encoded))<900000,'Store-region resource exceeds the safe document bound.');
  const before=JSON.parse(fs.readFileSync(path.join(directory,'before.json'))),after=R.enrich(before.table.rows,R.index(resource)),aq=after.filter(r=>r.client==='aQuelle');
  assert.equal(after.length,before.table.rows.length);assert.equal(aq.filter(r=>R.missing(r.region)).length,0,'Every affected aQuelle store must have exact evidence.');
  for(let i=0;i<after.length;i++)for(const field of ['id','orderNumber','orderKey','value','quantity','unitPrice','storeName','storeCode','client','brand','banner'])assert.equal(after[i][field],before.table.rows[i][field],field+' changed');
  const audit={at:new Date().toISOString(),version:resource.version,sourceSha256:resource.sourceSha256,names:Object.keys(resource.regions).length,bytes:Buffer.byteLength(JSON.stringify(encoded)),mappedAdditional:after.filter((r,i)=>R.missing(before.table.rows[i].region)&&!R.missing(r.region)).length,aQuelle:{lines:aq.length,units:aq.reduce((n,r)=>n+r.quantity,0),amount:aq.reduce((n,r)=>n+r.value,0),regions:Object.fromEntries([...new Set(aq.map(r=>r.region))].sort().map(region=>[region,{lines:aq.filter(r=>r.region===region).length,units:aq.filter(r=>r.region===region).reduce((n,r)=>n+r.quantity,0)}]))},remainingUnmapped:after.filter(r=>R.missing(r.region)).length,published:false};
  fs.writeFileSync(path.join(directory,'resource.json'),JSON.stringify(resource));
  if(process.argv.includes('--publish')){
    const api=await h.apiClient();let previous=null;
    try{previous=await api('publicDashboardSources/'+R.RESOURCE_ID);}catch(e){if(!e.message.startsWith('API 404:'))throw e;}
    if(previous)fs.writeFileSync(path.join(directory,'resource-before.json'),JSON.stringify(previous));
    await api(h.base+':commit','POST',{writes:[{update:{name:h.resource+'/publicDashboardSources/'+R.RESOURCE_ID,fields:encoded},currentDocument:previous?{updateTime:previous.updateTime}:{exists:false}}]});
    const saved=h.decode(await api('publicDashboardSources/'+R.RESOURCE_ID));assert.equal(R.index(saved).version,resource.version);audit.published=true;
  }
  fs.writeFileSync(path.join(directory,'mapping-audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
