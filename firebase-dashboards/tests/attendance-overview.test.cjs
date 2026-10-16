'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../backend/vendor/attendance.cjs'),{regionalWeeks}=require('../backend/attendance-overview.cjs');
const visits=[
  ['1','Gauteng','Week 1','A','Visited'],['2','gauteng','Week 2','A','Not Visited'],
  ['3','Gauteng','Week 2','B','Early visit on: 2026-09-07'],['4','Free State','Week 2','C','Caught up on: 2026-09-12'],
  ['5','Free State','Week 2','D','Pending'],['6','Free State','Week 2','E','Not Visited']
].map(([id,region,week,storeCode,result])=>({id,region,week,storeCode,result,userName:'Rep A',manager:'Manager A',role:'Sales Rep'}));
const dataset=A.buildDataset({visits,hierarchy:{rows:[]},audience:'rep',version:'test'});
test('regional weekly cells reconcile with their exact visit and store drilldowns',()=>{
  for(const filters of [{},{division:'CENTRAL'},{manager:'Manager A'},{region:'gauteng'},{role:'Sales Rep'}]){
    const report=regionalWeeks(dataset,filters);
    assert.equal(report.reduce((s,r)=>s+r.scheduled,0),A.dashboard(dataset,filters).metrics.scheduled);
    for(const region of report){
      assert.equal(region.missedStores,A.detail(dataset,filters,{region:region.label,metric:'missed',unit:'stores'}).total);
      for(const week of region.weeks){
        for(const [metric,field] of [['target','scheduled'],['actual','attended'],['missed','missedVisits']]){
          assert.equal(week[field],A.detail(dataset,filters,{region:region.label,week:week.label,metric}).total);
        }
      }
    }
  }
});
test('weeks are source-defined, case-normalised, and never fabricated as future zeros',()=>{
  const result=regionalWeeks(dataset);assert.equal(result.length,2);
  const gauteng=result.find(r=>r.label==='Gauteng');assert.equal(gauteng.missedStores,0);
  assert.deepEqual(gauteng.weeks.map(w=>w.label),['Week 1','Week 2']);
  assert.deepEqual(regionalWeeks(dataset,{region:'No such region'}),[]);
});
test('regional weekly analytics honour applied exclusions',()=>{
  const excluded={...dataset,rows:dataset.rows.filter(r=>r.id!=='6')};
  assert.equal(regionalWeeks(excluded).find(r=>r.label==='Free State').missedStores,0);
});
