const { execFileSync } = require('node:child_process');
async function main() {
  const token = execFileSync('powershell.exe', ['-NoProfile', '-Command', "& 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1' auth print-access-token"], { encoding: 'utf8', windowsHide: true }).trim();
  const base = 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
  async function post(method, body) {
    const result = await fetch(`${base}:${method}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': 'meridain-nexus', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!result.ok) throw new Error(`Source audit HTTP ${result.status}`);
    return result.json();
  }
  const count = await post('runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'salesTransactions' }] }, aggregations: [{ alias: 'rows', count: {} }] } });
  if (process.argv.includes('--reconcile')) {
    const {normalise,selection,report}=require('../functions/franchise-orders');
    const fields=['periodKey','orderDate','orderNumber','storeCode','storeName','rep','value','quantity','status','currency','mapped','importedAt'];
    const result=await post('runQuery',{structuredQuery:{from:[{collectionId:'salesTransactions'}],select:{fields:fields.map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:'periodKey'},direction:'DESCENDING'}],limit:30001}});
    const documents=result.filter(x=>x.document).map(x=>x.document);
    if(documents.length>30000)throw new Error('Audit limit exceeded; no partial reconciliation was produced.');
    const decode=v=>v.stringValue??v.timestampValue??v.booleanValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??null);
    const records=documents.map(doc=>({id:doc.name.split('/').at(-1),data:()=>Object.fromEntries(Object.entries(doc.fields).map(([key,value])=>[key,decode(value)]))}));
    const latest=records[0]?.data().periodKey;
    const dashboard=report(records.map(normalise),selection({},latest,Error),latest);
    console.log(JSON.stringify({checkedRows:records.length,totalRows:Number(count[0]?.result?.aggregateFields?.rows?.integerValue),period:latest,selection:dashboard.selection.start+' to '+dashboard.selection.end,totals:dashboard.totals,cancelled:dashboard.quality.cancelled,latestImport:dashboard.latestImport},null,2));
    return;
  }
  const fields = ['periodKey','sourceSystem','status','client','banner','channel','division','currency','orderDate','importedAt','value','quantity','mapped','repMissing'];
  const result = await post('runQuery', { structuredQuery: { from: [{ collectionId: 'salesTransactions' }], select: { fields: fields.map(fieldPath => ({fieldPath})) }, orderBy: [{field: {fieldPath: 'periodKey'}, direction: 'DESCENDING'}], limit: 500 } });
  const rows = result.filter(x => x.document).map(x => x.document.fields);
  const values = key => rows.map(r => r[key]?.stringValue || '').filter(Boolean);
  console.log(JSON.stringify({ totalRows: count[0]?.result?.aggregateFields?.rows, sampleSize: rows.length, sample: 'Latest 500 ledger rows by period, not a reconciliation', populated: Object.fromEntries(fields.map(f => [f, rows.filter(r => r[f] && !r[f].nullValue && r[f].stringValue !== '').length])), dimensions: Object.fromEntries(['periodKey','sourceSystem','status','client','banner','channel','division','currency'].map(f => [f,[...new Set(values(f))].slice(0,40)])), latestImport: rows.map(r=>r.importedAt?.timestampValue || '').sort().at(-1) }, null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
