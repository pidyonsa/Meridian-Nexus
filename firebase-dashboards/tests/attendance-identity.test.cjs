'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../backend/vendor/attendance.cjs');
const fold=value=>String(value).normalize('NFKC').toUpperCase();
test('case variants share one attendance filter, scorecard, person total and drilldown identity',()=>{
  for(const audience of ['rep','merchandiser']){
    const hierarchy={rows:audience==='rep'?[]:[{name:'Rep 1',manager:'YOLANDI MOUTON'},{name:'Rep 2',manager:'Yolandi Mouton'}]};
    const visits=[0,1,2].map((i)=>({id:`line-${i}`,date:'2026-09-15',week:'Week 3',userName:i<2?'Person A':'Person B',userCode:i<2?'101':'102',
      manager:audience==='rep'?(i===0?'YOLANDI MOUTON':'Yolandi Mouton'):(i===0?'Rep 1':'Rep 2'),
      region:i===0?'GAUTENG':'Gauteng',role:i===0?'SALES REP':'Sales Rep',storeCode:`store-${i}`,storeName:`Store ${i}`,
      banner:i===0?'BANNER':'Banner',brand:i===0?'CLIENT':'Client',channel:i===0?'CHANNEL':'Channel',result:i===1?'Not Visited':'Visited'}));
    const dataset=A.buildDataset({visits,hierarchy,audience,version:'identity-test'}),report=A.dashboard(dataset);
    assert.equal(report.metrics.scheduled,3);assert.equal(report.metrics.attended,2);assert.equal(report.rows.length,2);
    assert.equal(report.rows.find(r=>r.userCode==='101').scheduled,2);
    for(const field of ['managers','regions','roles','banners','brands','channels'])assert.equal(report.availableFilters[field].length,1,field);
    for(const [chart,field]of [['byManager','lineManager'],['byRegion','region'],['byRole','role']]){
      assert.equal(report.charts[chart].length,1,chart);const group=report.charts[chart][0];
      for(const [metric,count]of [['target','scheduled'],['actual','attended'],['missed','missedVisits']]){
        const detail=A.detail(dataset,{}, {[field]:group.label,metric});assert.equal(detail.total,group[count]);
      }
      if(field==='lineManager')assert.equal(report.rows.filter(r=>fold(r.manager)===fold(group.label)).reduce((s,r)=>s+r.scheduled,0),group.scheduled);
    }
    const manager=report.charts.byManager[0].label;
    for(const person of report.rows)assert.equal(A.detail(dataset,{}, {lineManager:manager,person:person.userCode}).total,person.scheduled);
    assert.equal(A.dashboard(dataset,{manager:'yolandi mouton'}).metrics.scheduled,3);
  }
});
