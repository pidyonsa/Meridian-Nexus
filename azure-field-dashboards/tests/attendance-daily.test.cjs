'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../../firebase-dashboards/backend/vendor/attendance.cjs');
require('../ui/attendance-presentation.js');require('../ui/attendance-daily.js');
globalThis.NexusAttendance={division:A.division};
const D=globalThis.AttendanceDaily;
const visits=[
  {date:'2026-09-16',userName:'Rep A',manager:'Manager A',storeCode:'1',storeName:'Store 1',region:'Free State',result:'Visited'},
  {date:'2026-09-17',userName:'Rep A',manager:'Manager A',storeCode:'1',storeName:'Store 1',region:'Free State',result:'Not Visited'},
  {date:'2026-09-17',userName:'Rep B',manager:'Manager B',storeCode:'2',storeName:'Store <two>',region:'Gauteng',result:'Early visit on: 2026-09-16'},
  {date:'2026-09-17',userName:'Rep A',manager:'Manager A',storeCode:'3',storeName:'Store 3',region:'Western Cape',result:'Caught up on: 2026-09-18'},
  {date:'2026-09-17',userName:'Rep B',manager:'Manager B',storeCode:'4',storeName:'Store 4',region:'Gauteng',result:'Needs review'},
  {date:'2026-09-17',userName:'Rep B',manager:'Manager B',storeCode:'1',storeName:'Store 1',region:'Free State',result:'Not Visited'}
];
const dataset=A.buildDataset({visits,hierarchy:{rows:[]},audience:'rep',version:'v1',source:{reportEndDate:'2026-09-17'}});
const monthly=A.dashboard(dataset);
const helper={link:(v,s)=>JSON.stringify({v,s}),exportButton:s=>JSON.stringify({export:s}),table:(h,r)=>h.join('|')+r.join(''),cells:()=>''};
function container(){
  const slot={isConnected:true,innerHTML:'',dataset:{},setAttribute(){}},role={innerHTML:'',setAttribute(){}};
  return {slot,role,querySelector:s=>s==='[data-daily-details]'?slot:role,contains:s=>s===slot};
}
test('daily date defaults to the latest source day and history has no future dates',()=>{
  assert.equal(D.selectedDate(monthly,''),'2026-09-17');
  assert.equal(D.selectedDate(monthly,'2026-09-16'),'2026-09-16');
  const data={scheduleAnalytics:{daily:Array.from({length:30},(_,i)=>({label:'2026-09-'+String(i+1).padStart(2,'0'),scheduled:1,strikeRate:100}))}};
  assert.equal(D.historyRows(data,'2026-09-17').length,13);
  assert.equal(D.historyRows(data,'2026-09-17')[0].label,'2026-09-05');
  assert.equal(D.historyRows(data,'2026-09-17').at(-1).label,'2026-09-17');
});
test('daily KPI and history selections carry their exact scheduled dates',()=>{
  const html=D.html(monthly,'2026-09-17',helper);
  assert.match(html,/Attendance \(day\)/);assert.match(html,/Last 2 Report Days/);
  assert.match(html,/"date":"2026-09-17","metric":"actual"/);
  assert.match(html,/&quot;date&quot;:&quot;2026-09-16&quot;/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('selected-day service request retains filters and source version; stores reconcile without classifying unknowns as missed',async()=>{
  const c=container(),calls=[];
  await D.mount(c,monthly,'2026-09-17',helper,{filters:{region:'Free State'},current:()=>true,request:async input=>{calls.push(input);return A.dashboard(dataset,input.filters);}});
  assert.deepEqual(calls,[{mode:'dashboard',audience:'rep',filters:{region:'Free State',date:'2026-09-17'},version:'v1'}]);
  assert.match(c.slot.innerHTML,/1 distinct stores/);
  assert.match(c.slot.innerHTML,/Store 1/);assert.doesNotMatch(c.slot.innerHTML,/Store 4/);
  assert.equal(c.slot.dataset.date,'2026-09-17');
  const day=A.dashboard(dataset,{date:'2026-09-17'});
  assert.equal(day.metrics.attended,2);assert.equal(day.metrics.missedStores,1);assert.equal(day.metrics.unknownStores,1);
  assert.equal(day.stores.filter(s=>s.status==='missed').length,A.detail(dataset,{}, {date:'2026-09-17',unit:'stores',metric:'missed'}).total);
});
test('late day responses cannot overwrite a newer date or navigated view',async()=>{
  const c=container();let resolve;
  const pending=D.mount(c,monthly,'2026-09-16',helper,{filters:{},current:()=>true,request:()=>new Promise(r=>resolve=r)});
  c.slot.isConnected=false;resolve(A.dashboard(dataset,{date:'2026-09-16'}));await pending;
  assert.equal(c.slot.innerHTML,'');
});
test('fresh cache renders immediately and a source version mismatch is not mixed into the page',async()=>{
  const c=container(),request=()=>{throw Error('Unexpected network request');};request.cached=()=>A.dashboard(dataset,{date:'2026-09-17'});
  await D.mount(c,monthly,'2026-09-17',helper,{filters:{},current:()=>true,request});
  assert.match(c.slot.innerHTML,/Line manager daily scorecard/);
  const invalid=container();
  await D.mount(invalid,monthly,'2026-09-17',helper,{filters:{},current:()=>true,request:async()=>({...monthly,version:'v2'})});
  assert.match(invalid.slot.innerHTML,/Attendance refreshed/);assert.doesNotMatch(invalid.slot.innerHTML,/<table/);
});
test('empty daily selections do not fetch data or render fabricated percentages',async()=>{
  const empty=A.dashboard(dataset,{manager:'Nobody'}),c=container();
  assert.doesNotMatch(D.html(empty,'',helper),/NaN|Infinity|undefined/);
  await D.mount(c,empty,'',helper,{current:()=>true,request:()=>{throw Error('Unexpected request');}});
  assert.match(c.slot.innerHTML,/No scheduled visits/);
  for(const value of [0,50,80,100,101])assert.match(D.heat(value),/^rgb\(\d+,\d+,\d+\)$/);
});
