'use strict';
// Compare an Azure shadow ETL run's outputs with the Google run it was staged from.
// Usage: node compare-etl-shadow.cjs <google run id> <shadow run id>
const crypto=require('node:crypto');
const {api,json}=require('../../scripts/release-multi-admin.cjs');
const BUCKET='meridain-nexus.firebasestorage.app',O=`https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
const [source,shadow]=process.argv.slice(2);
const FILES=['result.json','facts.jsonl','exceptions.jsonl','dc.jsonl','assignments.jsonl','inventory.xlsx','inventory-draft.xlsx','sales.xlsx','sales-draft.xlsx','failure.json'];
const bytes=async(id,f)=>{try{return Buffer.from(await (await api(`${O}/${encodeURIComponent(`etl-results/${id}/${f}`)}?alt=media`)).arrayBuffer());}catch(e){if(/ 404:/.test(e.message))return null;throw e;}};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
// Run ids and timings legitimately differ between runs; everything else must match.
const normal=(b,id)=>b.toString('utf8').split(id).join('<RUN>').replace(/"(startedAt|finishedAt|completedAt|createdAt|at|updatedAt|durationMs|ms|elapsedMs)":\s*("[^"]*"|\d+)/g,'"$1":"<T>"');
async function xlsxRows(b){const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');const w=new ExcelJS.Workbook();await w.xlsx.load(b);
  return w.worksheets.map(s=>s.name+'\n'+s.getSheetValues().map(r=>JSON.stringify(r)).join('\n')).join('\n#\n');}
async function main(){
  for(const f of FILES){
    const [a,b]=await Promise.all([bytes(source,f),bytes(shadow,f)]);
    if(!a&&!b)continue;
    if(!a||!b){console.log(f.padEnd(22),'MISSING in',a?'azure':'google');continue;}
    let same=a.equals(b),how='bytes';
    if(!same&&f.endsWith('.xlsx')){same=(await xlsxRows(a))===(await xlsxRows(b));how='cell values';}
    if(!same&&!f.endsWith('.xlsx')){same=normal(a,source)===normal(b,shadow);how='ignoring run id/timings';}
    console.log(f.padEnd(22),same?'IDENTICAL':'DIFFERENT','('+how+')','google',a.length,sha(a),'azure',b.length,sha(b));
  }
  const r=await bytes(shadow,'result.json');if(r)console.log('azure result:',r.toString('utf8').slice(0,400));
}
main().catch(e=>{console.error(String(e.message).slice(0,400));process.exitCode=1;});
