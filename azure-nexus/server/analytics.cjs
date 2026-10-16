'use strict';
const A = require('./domain/attendance.cjs');
const O = require('./domain/orders.cjs');
const ExcelJS = require('exceljs');
const {AppError} = require('./errors.cjs');
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
function fields(value={}) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new AppError('invalid-argument','Invalid filters.');
  for(const [key,v] of Object.entries(value)) if(!['region','division','role','banner','channel','date','week','manager','lineManager','person','store','metric','unit'].includes(key) || typeof v!=='string' || v.length>500) throw new AppError('invalid-argument','Invalid attendance filter.');
  return value;
}
function service(store) {
  return {
    async attendance(input={}) {
      if(!input || typeof input!=='object' || Array.isArray(input))throw new AppError('invalid-argument','Invalid attendance request.');
      const audience=input.audience || 'rep', mode=input.mode || 'dashboard';
      if(!['rep','merchandiser'].includes(audience) || !['dashboard','detail','export'].includes(mode)) throw new AppError('invalid-argument','Invalid attendance request.');
      const filters=fields(input.filters), selection=fields(input.selection);
      const periods=await store.list(`attendance-${audience}`), period=input.period || periods[0]?.period;
      if(!period) throw new AppError('not-found','No syndicated attendance report has been imported.');
      if(!MONTH.test(period)) throw new AppError('invalid-argument','Choose a valid report month.');
      const source=await store.read(`attendance-${audience}`,period);
      if(!source) throw new AppError('not-found','No attendance report for this month.');
      const ref=await store.read('hierarchy','2000-01');
      const hierarchy={rows:ref?.rows || [],sourceName:ref?.metadata?.fileName || 'Hierarchy not loaded',sha256:ref?.version || 'none'};
      const version=`${source.version}:${hierarchy.sha256}`;
      if(input.version && input.version!==version) throw new AppError('failed-precondition','Attendance has refreshed. Reload before opening or exporting these records.');
      const dataset=A.buildDataset({visits:source.rows,sourceRows:source.metadata.sourceRows || [],hierarchy,audience,version,source:{reportStartDate:`${period}-01`,reportEndDate:source.metadata.reportEndDate || '',updatedAt:source.updatedAt}});
      if(mode==='dashboard') {
        const result=A.dashboard(dataset,filters);
        if(!dataset.sourceRows.length)result.quality.strikeRateTotals=null;
        return {...result,period,periods:periods.map(s=>s.period)};
      }
      const result=A.detail(dataset,filters,selection);
      if(mode==='export') {
        if(result.total>10000) throw new AppError('resource-exhausted','Narrow the selection to 10,000 records before exporting.');
        const bytes=await A.excel(result,{audience,period,version,filters,selection},ExcelJS);
        return {base64:bytes.toString('base64'),fileName:`Syndicated-${audience}-${period}.xlsx`,total:result.total};
      }
      const page=Number(input.page || 1), pageSize=100;
      if(!Number.isSafeInteger(page) || page<1 || page>1000) throw new AppError('invalid-argument','Invalid detail page.');
      return {...result,rows:result.rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,pageCount:Math.max(1,Math.ceil(result.total/pageSize)),version};
    },
    async orders(input={}) {
      if(!input || typeof input!=='object' || Array.isArray(input))throw new AppError('invalid-argument','Invalid order request.');
      const manifests=await store.list('orders');
      if(!manifests.length) throw new AppError('not-found','No Geo Rep orders have been imported.');
      const selected=O.selection(input,manifests[0].period,AppError);
      const rows=[];
      for(const meta of manifests.filter(m=>m.period>=selected.start.slice(0,7) && m.period<=selected.end.slice(0,7))) {
        const snapshot=await store.read('orders',meta.period);
        rows.push(...snapshot.rows.map(O.normalise));
        if(rows.length>100000) throw new AppError('resource-exhausted','Narrow the reporting period below 100,000 lines.');
      }
      const report=O.report(rows,selected,manifests[0].period);
      if(selected.export && report.table.total>10000) throw new AppError('resource-exhausted','Narrow the export to 10,000 lines.');
      report.groupCounts=Object.fromEntries(Object.entries(report.by).map(([k,v])=>[k,v.length]));
      // No silent top-N truncation: the retained UI exports exactly the groups displayed.
      return report;
    }
  };
}
module.exports={service,fields};
