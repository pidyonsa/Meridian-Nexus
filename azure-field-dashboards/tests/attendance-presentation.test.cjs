'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../ui/attendance-presentation.js');
const P=globalThis.AttendancePresentation;
test('Time gone uses the report month, including leap years, not the current clock',()=>{
  assert.equal(P.timeGone('2026-09-18'),60);
  assert.equal(P.timeGone('2026-09-30'),100);
  assert.equal(P.timeGone('2024-02-29'),100);
  for(const value of ['',null,'bad','2026-02-30','2026-13-01'])assert.equal(P.timeGone(value),null);
});
test('empty selections stay empty and do not fabricate weekly or division figures',()=>{
  globalThis.NexusAttendance={division:()=> 'CENTRAL'};
  const data={metrics:{},audience:'rep',rows:[],charts:{byRegion:[],byDivision:[],byRole:[],byManager:[]},scheduleAnalytics:{weekly:[],byRegionWeekly:[]}};
  const html=P.overview(data,{link:()=>'',exportButton:()=>'',table:()=>'',cells:()=>''});
  assert.doesNotMatch(html,/NaN|Infinity|undefined|P&G|Franchise/);
  assert.match(html,/No scheduled visits/);
});
