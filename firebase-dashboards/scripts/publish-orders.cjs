'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const h=require('../../scripts/repair-attendance-september-weeks.cjs'),ExcelJS=require('../backend/node_modules/exceljs');
const {parseOrders}=require('../backend/order-workbook.cjs');
const {fields}=require('./firestore-values.cjs');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'.tmp/public-dashboards-20260914');
async function main(){
  const evidence=JSON.parse(fs.readFileSync(path.join(dir,'fresh-geo-transaction.json'))),api=await h.apiClient();
  const parsed=await parseOrders(fs.readFileSync(path.join(root,evidence.file)),{ExcelJS,range:evidence.range,importedAt:evidence.downloadedAt,sha256:evidence.sha256});
  const query=await api(h.base+':runQuery','POST',{structuredQuery:{from:[{collectionId:'salesTransactions'}],select:{fields:['storeCode','storeName','region','channel','client','banner'].map(fieldPath=>({fieldPath}))},limit:30001}});
  assert.ok(query.filter(q=>q.document).length<=30000,'Historical store mapping exceeds read bound.');
  const byCode=new Map(),byName=new Map(),key=v=>String(v||'').trim().toUpperCase().replace(/\s+/g,' ');
  for(const document of query.filter(q=>q.document).map(q=>h.decode(q.document))){
    for(const [map,k]of [[byCode,key(document.storeCode)],[byName,key(document.storeName)]]){if(!k)continue;const rows=map.get(k)||[];rows.push(document);map.set(k,rows);}
  }
  for(const r of parsed.rows){
    const matches=byCode.get(key(r.storeCode))||byName.get(key(r.storeName))||[];
    for(const field of ['region','channel','client','banner']){const values=[...new Set(matches.map(m=>m[field]).filter(v=>v&&!/^(unmapped|unassigned|not supplied)$/i.test(v)))];if(!r[field]&&values.length===1)r[field]=values[0];}
    r.mapped=!!r.region;
  }
  const version=evidence.sha256,metadata={...parsed.metadata,version,period:evidence.range.startDate.slice(0,7),mappedRows:parsed.rows.filter(r=>r.mapped).length};
  const O=require('../backend/vendor/orders.cjs'),dashboard=O.report(parsed.rows.map(r=>O.normalise({id:r.id,data:()=>r})),O.selection({},metadata.period,Error),metadata.period);
  const audit={...metadata,defaultTotals:dashboard.totals,cancelled:dashboard.quality.cancelled,published:false};
  fs.writeFileSync(path.join(dir,'fresh-orders-audit.json'),JSON.stringify(audit,null,2));
  if(process.argv.includes('--publish')){
    assert.equal(evidence.range.startDate,metadata.period+'-01','Only complete month-to-date snapshots are supported.');
    const writes=[];
    for(let i=0;i<parsed.rows.length;i+=200){const rows=parsed.rows.slice(i,i+200);assert.ok(Buffer.byteLength(JSON.stringify(rows))<700000);writes.push({update:{name:`${h.resource}/publicDashboardOrderImports/${version}/chunks/${String(i/200).padStart(4,'0')}`,fields:fields({rows})}});}
    const commit=await api(h.base+':commit','POST',{writes});assert.equal(commit.writeResults.length,writes.length);
    const check=await api(`${h.base}/publicDashboardOrderImports/${version}/chunks?pageSize=200`);assert.equal((check.documents||[]).reduce((n,d)=>n+(h.decode(d).rows||[]).length,0),metadata.rowCount);
    await api('publicDashboardSources/orders','PATCH',{fields:fields(metadata)});
    audit.published=true;audit.publishedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'fresh-orders-audit.json'),JSON.stringify(audit,null,2));
  }
  console.log(JSON.stringify(audit,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
