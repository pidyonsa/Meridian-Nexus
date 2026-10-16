'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const h=require('../../scripts/repair-attendance-september-weeks.cjs');
const ExcelJS=require('../backend/node_modules/exceljs');
const directory=path.resolve(__dirname,'../test-results/order-regions');
async function main(){
  fs.mkdirSync(directory,{recursive:true});
  const api=await h.apiClient(),source=h.decode(await api('publicDashboardSources/orders'));
  const config=h.decode(await api('salesDashboardConfig/current'));
  const master=h.decode(await api('salesStoreMasters/'+config.storeMasterId));
  const file=h.decode(await api('files/'+source.sourceFileId));
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  for(const [name,metadata]of [['master',master],['transactions',file]]){
    let bytes;
    if(name==='master'){
      const local=path.join('C:/Users/PC/Documents/Meridian Nexus/GEO REP STORE MASTER',master.sourceName);
      if(path.basename(local)!=='Rep & Merchandiser Meridian Store Master 13.08.2026.xlsx')throw Error('Review changed master filename.');
      bytes=fs.readFileSync(local);
    }else{
      const response=await fetch('https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/o/'+encodeURIComponent(metadata.storagePath)+'?alt=media',{headers:{Authorization:'Bearer '+token,'x-goog-user-project':'meridain-nexus'},signal:AbortSignal.timeout(120000)});
      if(!response.ok){console.log(name+' download unavailable: '+response.status+'; retaining published source values for audit');continue;}
      bytes=Buffer.from(await response.arrayBuffer());
    }
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    if(metadata.sha256&&metadata.sha256!==sha256)throw Error(name+' checksum mismatch');
    fs.writeFileSync(path.join(directory,name+'.xlsx'),bytes);
    const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
    console.log(name,JSON.stringify({id:metadata.id,sha256,sheets:book.worksheets.map(s=>({name:s.name,rows:s.rowCount,headers:s.getRow(1).values.slice(1)}))}));
  }
  const response=await fetch('https://meridian-field-dashboards.azurewebsites.net/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({export:true,includeCancelled:true,refresh:true}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Live report failed: '+response.status);
  const report=await response.json();
  fs.writeFileSync(path.join(directory,'before.json'),JSON.stringify(report));
  fs.writeFileSync(path.join(directory,'sources.json'),JSON.stringify({source,master},null,2));
  const aq=report.table.rows.filter(r=>r.client==='aQuelle');
  console.log(JSON.stringify({lines:report.table.rows.length,aQuelle:{lines:aq.length,unmapped:aq.filter(r=>r.region==='Unmapped').length,amount:aq.reduce((n,r)=>n+(r.value||0),0),units:aq.reduce((n,r)=>n+(r.quantity||0),0)},totalUnmapped:report.table.rows.filter(r=>r.region==='Unmapped').length}));
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(path.join(directory,'master.xlsx'));
  const sheet=book.getWorksheet('Call Cycle Master'),names=new Map(),key=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  sheet.eachRow((row,n)=>{if(n===1)return;const name=key(row.getCell(2).value),region=String(row.getCell(8).value||'').trim();if(!name||!region)return;if(!names.has(name))names.set(name,new Set());names.get(name).add(region);});
  const missing=[...new Set(aq.map(r=>r.storeName))].map(name=>({name,regions:[...(names.get(key(name))||[])]}));
  console.log('aQuelle exact name matches',JSON.stringify(missing,null,2));
  console.log('All unmapped source rows with a unique master region',report.table.rows.filter(r=>r.region==='Unmapped'&&names.get(key(r.storeName))?.size===1).length);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
