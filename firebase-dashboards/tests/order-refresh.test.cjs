'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ExcelJS=require('../backend/node_modules/exceljs');
const {refresh,candidate,newer,enrich}=require('../refresh/core.cjs');
async function fixture(){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Order Details');
  sheet.addRow(['Date','Transaction Number','Store Code','Customer Name','Product SKU Code','Product Name','Quantity','Total','Banner']);
  sheet.addRow(['2026-09-17','Order1','S1','Store1','SKU1','Product1',2,12,'Retail group']);
  sheet.addRow(['2026-09-17','Order1','S1','Store1','SKU1','Product1',2,12,'Retail group']);
  const bytes=Buffer.from(await book.xlsx.writeBuffer()),run={id:'run1',retailerId:'geo-rep-sales-transactions',status:'completed',fileId:'file1',reportStartDate:'2026-09-01',reportEndDate:'2026-09-17'};
  const file={retailerId:run.retailerId,extractionRunId:run.id,storagePath:'uploads/file1/report.xlsx',uploadedAt:'2026-09-17T04:02:00Z',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reportStartDate:run.reportStartDate,reportEndDate:run.reportEndDate};
  const state={current:null,staged:[],downloads:0,finishes:[]};
  const repo={acquire:async()=>true,latestRun:async()=>run,file:async()=>file,current:async()=>state.current,history:async()=>[{storeCode:'S1',region:'Gauteng',banner:'Old banner'}],stage:async(version,rows)=>{state.staged=rows;},publish:async meta=>{state.current=meta;return true;},finish:async(owner,result)=>state.finishes.push(result)};
  const invoke=()=>refresh({repo,ExcelJS,download:async()=>{state.downloads++;return bytes;},now:()=> '2026-09-17T04:05:00Z'});
  return {bytes,run,file,state,repo,invoke};
}
test('publishes full detail without collapsing identical product lines, then skips unchanged sources',async()=>{
  const f=await fixture();assert.equal((await f.invoke()).status,'published');assert.equal(f.state.staged.length,2);assert.notEqual(f.state.staged[0].id,f.state.staged[1].id);
  assert.equal(f.state.staged[0].banner,'Retail group');assert.equal(f.state.staged[0].region,'Gauteng');assert.equal(f.state.current.detailTotal,24);assert.equal(f.state.current.importedAt,f.file.uploadedAt);
  assert.equal((await f.invoke()).status,'current');assert.equal(f.state.downloads,1);
});
test('retains previous snapshot on checksum or invalid-period failures',async()=>{
  const f=await fixture(),old={range:{endDate:'2026-09-14'},importedAt:'2026-09-14T04:00:00Z'};f.state.current=old;f.file.sha256='a'.repeat(64);
  await assert.rejects(f.invoke(),/checksum/);assert.equal(f.state.current,old);assert.equal(f.state.staged.length,0);assert.equal(f.state.finishes.at(-1).status,'failed');
  f.file.reportStartDate='2026-09-02';await assert.rejects(f.invoke(),/month-to-date/);assert.equal(f.state.current,old);
});
test('awaits active downloads and respects another publisher lease',async()=>{
  const f=await fixture();f.run.status='running';assert.equal((await f.invoke()).status,'waiting');assert.equal(f.state.downloads,0);
  f.repo.acquire=async()=>false;assert.equal((await f.invoke()).status,'busy');assert.equal(f.state.downloads,0);
});
test('older coverage cannot replace a newer snapshot even if re-exported later',()=>{
  assert.equal(newer({range:{endDate:'2026-09-16'},importedAt:'2026-09-18T04:00:00Z'},{range:{endDate:'2026-09-17'},importedAt:'2026-09-17T04:00:00Z'}),false);
  assert.equal(newer({range:{endDate:'2026-10-01'},importedAt:'2026-10-01T04:00:00Z'},{range:{endDate:'2026-09-30'},importedAt:'2026-09-30T04:00:00Z'}),true);
});
test('ambiguous store mappings remain unmapped; source banner is never overwritten',()=>{
  const rows=enrich([{storeCode:'S',banner:'Source'}],[{storeCode:'S',region:'Gauteng',banner:'A'},{storeCode:'S',region:'Eastern Cape',banner:'B'}]);
  assert.equal(rows[0].mapped,false);assert.equal(rows[0].banner,'Source');
});
test('rejects unlinked files and paths outside the exact download directory',async()=>{
  const f=await fixture();assert.throws(()=>candidate(f.run,{...f.file,storagePath:'portal-resources/private.xlsx'}),/path/);
  assert.throws(()=>candidate(f.run,{...f.file,extractionRunId:'other'}),/linked/);
});
