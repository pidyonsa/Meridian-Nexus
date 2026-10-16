'use strict';
const crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const A=require('./vendor/attendance.cjs'),O=require('./vendor/orders.cjs'),hierarchy=require('./vendor/hierarchy.json');
const exclusions=require('./vendor/attendance-exclusions-core.js');
const clients=require('./product-clients.cjs');
const regions=require('./order-regions.cjs');
const regional=require('./order-regional-analytics.cjs');
const {regionalWeeks}=require('./attendance-overview.cjs');
const {canonical,createCache}=require('./report-cache.cjs');
const FILTERS=['region','division','role','banner','brand','channel','date','week','manager','lineManager','person','store','metric','unit'];
function filters(value,ErrorType) {
  if(value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ErrorType('invalid-argument','Invalid filters.');
  for(const [k,v]of Object.entries(value))if(!FILTERS.includes(k)||typeof v!=='string'||v.length>500)throw new ErrorType('invalid-argument','Invalid attendance filter.');
  return value;
}
function safeSource(source) {
  return {reportStartDate:source.reportStartDate||'',reportEndDate:source.reportEndDate||'',operationalWeek:source.operationalWeek||0,
    updatedAt:source.updatedAt?.toDate?.().toISOString()||source.updatedAt||null,sourceLabel:'Geo Rep attendance / latest completed Nexus import'};
}
function createService({db,getStorage,ExcelJS,HttpsError,now=Date.now}) {
  const cache=new Map();
  const reports=createCache({now});
  const reader=require('./vendor/source-reader.cjs')({db,getStorage,ExcelJS,path,NoReportDataError:Error});
  async function single(key,load,ttl=30000,force=false) {
    for(const [k,v]of cache)if(v.until<now())cache.delete(k);
    if(force)cache.delete(key);
    if(!cache.has(key)){
      while(cache.size>=16)cache.delete(cache.keys().next().value);
      const entry={until:Infinity,promise:null};
      entry.promise=Promise.resolve().then(load).then(value=>{entry.until=now()+ttl;return value;});cache.set(key,entry);
      entry.promise.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
    }
    const entry=cache.get(key);cache.delete(key);cache.set(key,entry);
    return entry.promise;
  }
  async function attendance(input={}) {
    const audience=input.audience||'rep',mode=input.mode||'dashboard';
    if(!['rep','merchandiser'].includes(audience)||!['dashboard','detail','export'].includes(mode))throw new HttpsError('invalid-argument','Only syndicated attendance viewing is available.');
    const chosen=filters(input.filters,HttpsError),selection=filters(input.selection,HttpsError);
    const doc=await single('source:'+audience,()=>db.collection('geoRepAttendanceDashboard').doc(audience==='rep'?'current':'merchandisers').get(),30000,input.refresh===true);
    if(!doc.exists)throw new HttpsError('not-found','No verified attendance report is available.');
    const source=doc.data(),fileId=source.source?.schedules?.fileId;
    if(!fileId||typeof fileId!=='string'||fileId.includes('/'))throw new HttpsError('failed-precondition','The latest attendance source is not linked.');
    const fileDoc=await single('file:'+fileId,()=>db.collection('files').doc(fileId).get(),30000,input.refresh===true);
    if(!fileDoc.exists)throw new HttpsError('not-found','The attendance source is unavailable.');
    const file=fileDoc.data();
    const version=crypto.createHash('sha256').update(JSON.stringify(['public-v1',fileId,file.sha256,source.updatedByRunId,hierarchy.sha256,audience])).digest('hex');
    const rawDataset=await single('attendance:'+version,async()=>{
      const directory=await fs.mkdtemp(path.join(os.tmpdir(),'public-nexus-attendance-'));
      try {
        const raw=await reader.readGeoRepAttendanceSource(file,'Schedules',directory,{roleGroup:audience});
        if(raw.rows.length>100000)throw new HttpsError('resource-exhausted','The attendance source exceeds the supported size.');
        const visits=reader.geoRepAttendanceScheduleRowsAsObjects(raw).map((row,i)=>({...row,id:`Schedules!${raw.sourceRowNumbers[i]}`}));
        const enriched=reader.geoRepAttendanceEnrichScheduleRows(visits,await reader.geoRepAttendanceStoreMasterEnrichment(audience,directory));
        return A.buildDataset({visits:enriched.rows,sourceRows:source.rows||[],hierarchy,audience,version,source:safeSource(source)});
      }finally{await fs.rm(directory,{recursive:true,force:true});}
    },20*60*1000);
    const config=exclusions.policy((await db.collection('geoRepAttendanceConfig').doc('current').get()).data()?.dashboardExclusions);
    const attendanceVersion=exclusions.revisionVersion(rawDataset.version,config);
    const dataset=await single('policy:'+attendanceVersion,()=>A.applyExclusions(rawDataset,config),20*60*1000);
    if(input.version&&input.version!==attendanceVersion)throw new HttpsError('failed-precondition','Attendance refreshed. Reload before opening or exporting records.');
    if(mode==='dashboard'){
      return reports.get('attendance:'+JSON.stringify([attendanceVersion,canonical(chosen)]),()=>{
        const result=A.dashboard(dataset,chosen);
        result.scheduleAnalytics.byRegionWeekly=regionalWeeks(dataset,chosen);
        if(chosen.brand)result.quality.strikeRateTotals=null;
        const unavailable=['banners','channels'].filter(key=>!result.availableFilters[key].length);
        if(unavailable.length)result.quality.warnings=[...result.quality.warnings,`Attendance has no mapped ${unavailable.join(' or ')} in its current source. The attendance store master needs those mappings before these filters are available.`];
        return result;
      },{ttl:120000,force:input.refresh===true});
    }
    let details;try{details=A.detail(dataset,chosen,selection);}catch{throw new HttpsError('invalid-argument','Invalid detail selection.');}
    if(mode==='export'){
      if(details.total>10000)throw new HttpsError('resource-exhausted','Select a day, manager or region to export at most 10,000 records.');
      const bytes=await A.excel(details,{audience,version:attendanceVersion,exclusionRevision:config.revision,filters:chosen,selection,reportStartDate:source.reportStartDate,reportEndDate:source.reportEndDate},ExcelJS);
      return {base64:bytes.toString('base64'),total:details.total,fileName:`Attendance-${audience}-${source.reportEndDate||'latest'}.xlsx`,version:attendanceVersion};
    }
    const page=input.page===undefined?1:Number(input.page),pageSize=100;
    if(!Number.isSafeInteger(page)||page<1||page>1000)throw new HttpsError('invalid-argument','Invalid detail page.');
    return {...details,rows:details.rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,pageCount:Math.max(1,Math.ceil(details.total/pageSize)),version:attendanceVersion};
  }
  async function clientCatalog(force){
    const resource=await single('product-resource',()=>db.collection('portalResources').doc(clients.RESOURCE_ID).get(),30000,force);
    if(!resource.exists||resource.data().active===false)return null;
    const master=resource.data();
    if(typeof master.storagePath!=='string'||master.storagePath.includes('..')||!master.storagePath.startsWith(`portal-resources/${clients.RESOURCE_ID}/`))throw new HttpsError('failed-precondition','The product master resource has an invalid source path.');
    const key=JSON.stringify([master.storagePath,master.updatedAt,master.sha256,master.clientOverrides]);
    return single('product-catalog:'+key,async()=>{
      const [bytes]=await getStorage().bucket().file(master.storagePath).download();
      return clients.index(await clients.parse(bytes,ExcelJS),master.clientOverrides||[]);
    },20*60*1000,force);
  }
  async function orders(input={}) {
    const force=input.refresh===true;
    const sourceDoc=await single('public-orders-source',()=>db.collection('publicDashboardSources').doc('orders').get(),30000,force);
    const snapshot=sourceDoc.exists?sourceDoc.data():null;
    const latest=await single('latest-order',()=>db.collection('salesTransactions').orderBy('periodKey','desc').limit(1).get(),30000,force);
    if(!latest.docs.length&&!snapshot)throw new HttpsError('not-found','No Geo Rep order data has been imported.');
    const period=[latest.docs[0]?.data().periodKey,snapshot?.period].filter(Boolean).sort().at(-1),selected=O.selection(input,period,HttpsError);
    const key=`orders:${selected.start.slice(0,7)}:${selected.end.slice(0,7)}`;
    let rows=await single(key,async()=>{
      const snap=await db.collection('salesTransactions').where('periodKey','>=',selected.start.slice(0,7)).where('periodKey','<=',selected.end.slice(0,7)).limit(30001).get();
      if(snap.size>30000)throw new HttpsError('resource-exhausted','Select a shorter date range; the source exceeds 30,000 lines.');
      return snap.docs.map(O.normalise);
    },30000,force);
    let snapshotApplied=false;
    if(snapshot&&snapshot.period>=selected.start.slice(0,7)&&snapshot.period<=selected.end.slice(0,7)){
      const periodRows=rows.filter(r=>r.orderDate?.startsWith(snapshot.period));
      const importedAt=periodRows.map(r=>r.importedAt||'').sort().at(-1)||'',ledgerThrough=periodRows.map(r=>r.orderDate||'').sort().at(-1)||'';
      // The ledger never stores banner/client/channel. Its import of the same workbook finishes a little after the
      // snapshot, so also prefer the snapshot whenever it covers at least the ledger's latest order date.
      if(snapshot.importedAt>importedAt||(snapshot.range?.endDate&&snapshot.range.endDate>=ledgerThrough)){
        const fresh=await single('order-import:'+snapshot.version,async()=>{
          if(!/^[a-f0-9]{64}$/.test(snapshot.version))throw Error('Invalid viewer source version.');
          const chunks=await db.collection('publicDashboardOrderImports').doc(snapshot.version).collection('chunks').get();
          const records=chunks.docs.flatMap(d=>d.data().rows||[]);
          if(records.length!==snapshot.rowCount||records.length>30000)throw Error('Incomplete viewer source snapshot.');
          return records.map(r=>O.normalise({id:r.id,data:()=>r}));
        },20*60*1000,force);
        rows=[...rows.filter(r=>!r.orderDate?.startsWith(snapshot.period)),...fresh];snapshotApplied=true;
      }
    }
    const catalog=await clientCatalog(force);
    const mapped=catalog?clients.enrich(rows,catalog):null;
    if(mapped)rows=mapped.rows;
    const regionDoc=await single('order-region-resource',()=>db.collection('publicDashboardSources').doc(regions.RESOURCE_ID).get(),30000,force);
    const regionResource=regionDoc.exists?regionDoc.data():null;
    const regionCatalog=regionResource&&regionResource.active!==false?await single('order-region-index:'+regionResource.version,()=>regions.index(regionResource),20*60*1000,force):null;
    if(regionCatalog)rows=regions.enrich(rows,regionCatalog);
    rows=regional.enrich(rows);
    const version=crypto.createHash('sha256').update(JSON.stringify([rows,catalog?.version||null,regionCatalog?.version||null])).digest('hex');
    if(input.version&&input.version!==version)throw new HttpsError('failed-precondition','Orders have refreshed. Reload before exporting these records.');
    const makeReport=()=>{
    const result=regional.report(rows,selected,period);result.version=version;
    result.regionMapping=regionCatalog?{version:regionCatalog.version,sourceName:regionCatalog.sourceName,method:'Exact store name; existing regions retained'}:null;
    if(result.quality.unmapped)result.quality.warnings.push(`${result.quality.unmapped} selected lines have no verified store-region match and remain Unmapped.`);
    if(result.totals.lines&&result.totals.amount===0&&result.totals.units>0&&result.by.product.every(r=>r.amount===0))result.quality.warnings.push(`Selected orders record zero amounts for ${result.totals.units.toLocaleString('en-ZA')} units in the imported Geo data. No sales values have been inferred.`);
    result.clientMapping=mapped?.summary||null;
    if(mapped){
      if(mapped.summary.unmatched||mapped.summary.ambiguous)result.quality.warnings.push(`${mapped.summary.unmatched} product lines have no exact client match; ${mapped.summary.ambiguous} have conflicting matches. These remain included as Unmapped client.`);
    }else result.quality.warnings.push('The Geo product master is not available. Client mappings have not been inferred.');
    if(snapshotApplied){
      result.source='Geo Rep transaction workbook / isolated Firebase viewer import';
      result.sourceCoverage={through:snapshot.range.endDate,brandColumn:snapshot.brandColumn||null,brandRows:snapshot.brandRows||0};
      if(!snapshot.brandColumn&&!mapped)result.quality.warnings.push('The latest Geo Rep export contains Banner but no Brand or Brands column. Brand values are not inferred.');
      if(Math.abs(snapshot.summaryDifference||0)>0.02)result.quality.warnings.push(`Totals use the original Order Details lines. Geo Rep's Order Summary differs by ${snapshot.summaryDifference.toFixed(2)} across the full export; no balancing amounts were added.`);
    }
    if(selected.export&&result.table.total>10000)throw new HttpsError('resource-exhausted','Narrow the export to at most 10,000 lines.');
    result.groupCounts=Object.fromEntries(Object.entries(result.by).map(([k,v])=>[k,v.length]));
    return result;
    };
    return selected.export?makeReport():reports.get('orders:'+JSON.stringify([version,canonical(selected),snapshotApplied]),makeReport,{ttl:120000,force});
  }
  return {attendance,orders};
}
module.exports={createService,filters,safeSource};
