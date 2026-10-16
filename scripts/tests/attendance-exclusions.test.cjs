'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const E = require('../../functions/attendance-exclusions-core'), A = require('../../functions/attendance-analytics');
const {createService, parseWorkbook} = require('../../functions/attendance-exclusions-admin');
const ExcelJS = require('../../functions/node_modules/exceljs'), JSZip = require('../../functions/node_modules/jszip');
const hierarchy = {rows:[{name:'Alex Rep',manager:'Line Manager',regionalManager:'Regional',assignment:'syndicated'}, {name:'Missing Rep',manager:'Line Manager',assignment:'syndicated'}]};
const visit = (values={}) => ({userName:'Alex Rep',userCode:'A',manager:'Line Manager',storeCode:'S1',customer:'Test store',date:'2026-09-01',week:'1',result:'Visited',...values});
const cfg = (...entries) => E.policy({revision:1,entries});
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
test('exact normalized names, optional staff codes and audience boundaries',()=>{
  const person={userName:'  Alex   Rep ',userCode:'A',managerPath:['Line Manager','Regional']};
  assert.equal(E.excluded(person,cfg({name:'alex rep'}).entries,'rep'),true);
  assert.equal(E.excluded(person,cfg({name:'Alex'}).entries,'rep'),false);
  assert.equal(E.excluded(person,cfg({name:'Alex Rep',userCode:'B'}).entries,'rep'),false);
  assert.equal(E.excluded(person,cfg({name:'Prior name',userCode:'A',audience:'rep'}).entries,'merchandiser'),false);
  assert.equal(E.excluded(person,cfg({name:'Alex Rep',enabled:false}).entries,'rep'),false);
  assert.throws(()=>E.rule({name:'x',type:'anything'}));assert.throws(()=>E.rule({name:'x',enabled:'false'}));
  assert.throws(()=>E.rule({name:'x',type:'manager',userCode:'A'}));
});
test('manager/team is explicit and follows the hierarchy, including merchandiser to rep',()=>{
  const person={userName:'Merch One',rep:'Alex Rep',manager:'Line Manager',managerPath:['Line Manager','Regional']};
  for(const name of ['Alex Rep','Line Manager','Regional'])assert.equal(E.excluded(person,cfg({name,type:'manager'}).entries,'merchandiser'),true);
  assert.equal(E.excluded(person,cfg({name:'Alex Rep',type:'person'}).entries,'merchandiser'),false);
});
test('compiled matching preserves all exclusion semantics across audiences',()=>{
  const entries=cfg({name:' Alex Rep '},{name:'Previous name',userCode:'B',audience:'rep'},
    {name:'Regional',type:'manager',audience:'merchandiser'},{name:'Disabled',enabled:false}).entries;
  const people=[{}, {userName:'ALEX   REP'}, {userName:'Alex'}, {userCode:'b'},
    {userName:'Disabled'}, {userName:'Team',managerPath:['Line','REGIONAL']},
    {userName:'Team',manager:'Regional'}, {userName:'Team',rep:'Regional'}];
  for(const audience of ['rep','merchandiser']) {
    const match=E.matcher(entries,audience);
    for(const person of people) assert.equal(Boolean(match(person)),E.excluded(person,entries,audience));
    assert.equal(E.matcher([],audience)({}),false);
  }
});
test('all metrics, roster, reconciliation, filters, detail and Excel exclude the same records; raw Call Cycle plan is unchanged',async()=>{
  const raw=A.buildDataset({visits:[visit(),visit({result:'Not Visited',storeCode:'S2'}),visit({userName:'Other',userCode:'B',manager:'Other Manager'})],sourceRows:[visit({scheduled:2,onSchedule:1}),visit({userName:'Other',userCode:'B',manager:'Other Manager',scheduled:1,onSchedule:1}),visit({userName:'No Schedule',userCode:'N',manager:'Line Manager'})],hierarchy,audience:'rep',version:'v1'});
  const data=A.applyExclusions(raw,cfg({name:'Line Manager',type:'manager'})),report=A.dashboard(data);
  assert.equal(report.metrics.scheduled,1);assert.equal(report.metrics.attended,1);assert.equal(report.metrics.users,1);
  assert.deepEqual(report.availableFilters.managers,['Other Manager']);assert.equal(report.rows[0].userName,'Other');
  assert.equal(report.reconciliation.some(p=>['Missing Rep','No Schedule','Alex Rep'].includes(p.userName)),false);
  assert.equal(report.quality.strikeRateTotals.scheduled,1);assert.equal(report.quality.adminExcludedVisits,2);
  assert.equal(raw.rows.length,3);assert.equal(data.planRows.length,3);
  const detail=A.detail(data,{},{}),book=new ExcelJS.Workbook();await book.xlsx.load(await A.excel(detail,{audience:'rep'},ExcelJS));
  assert.equal(detail.total,1);assert.equal(book.getWorksheet('Visits').rowCount,2);assert.equal(book.getWorksheet('Visits').getCell('H2').value,'Other');
  const restored=A.applyExclusions(raw,cfg({name:'Line Manager',type:'manager',enabled:false}));assert.equal(A.dashboard(restored).metrics.scheduled,3);
});
test('policy changes invalidate attendance versions without redownloading sources or affecting Call Cycle',async()=>{
  let policy,loads=0;
  const db={collection:name=>({doc:()=>({get:async()=>({exists:true,data:()=>name==='files'?{name:'Test.xlsx'}:name==='geoRepAttendanceConfig'?{dashboardExclusions:policy}:{source:{schedules:{fileId:'F'}},rows:[]}})})})};
  const service=A.createService({db,HttpsError,ExcelJS,hierarchy,loadVisits:async()=>{loads++;return [visit()];}});
  const before=await service({data:{}});policy=cfg({name:'Alex Rep'});
  const after=await service({data:{}});assert.equal(after.metrics.scheduled,0);assert.notEqual(after.version,before.version);
  await assert.rejects(service({data:{mode:'export',version:before.version}}),{code:'failed-precondition'});
  const cycle=await service({data:{mode:'callcycle'}});assert.equal(cycle.stores.length,1);assert.equal(loads,1);
});
async function workbook(rows){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Exclusions');rows.forEach(row=>sheet.addRow(row));return Buffer.from(await book.xlsx.writeBuffer()).toString('base64');}
test('Excel accepts names with or without headers and rejects unsafe/invalid sheets and rows',async()=>{
  const deps={ExcelJS,JSZip},defaults={type:'person',audience:'both'};
  assert.equal((await parseWorkbook(await workbook([['Alex Rep'],['Other']]),defaults,deps)).length,2);
  const rows=await parseWorkbook(await workbook([['Name','Type','Audience','Staff Code','Reason'],['Alex Rep','person','rep','A','Duplicate source identity']]),defaults,deps);
  assert.equal(rows[0].userCode,'A');assert.equal(rows[0].audience,'rep');
  for(const sheet of [[['Name','Unexpected'],['Alex','x']],[['Name'],[{formula:'1+1',result:2}]],[['Name','Type'],['Alex','unknown']],[['Name'],['']],Array.from({length:502},()=>['Name'])]) await assert.rejects(parseWorkbook(await workbook(sheet),defaults,deps));
  await assert.rejects(parseWorkbook('bad',defaults,deps));
});
function adminFixture(){
  const docs=new Map([['adminUsers/admin',{role:'admin',accountType:'staff',name:'Test Administrator'}],['geoRepAttendanceDashboard/current',{rows:[visit()]}],['geoRepAttendanceConfig/current',{operationalWeek:2}]]);
  let serial=0;const ref=p=>({path:p,get:async()=>({exists:docs.has(p),data:()=>docs.get(p)}),collection:name=>collection(p+'/'+name)});
  function collection(p){return {doc:id=>ref(p+'/'+(id||`id${++serial}`)),orderBy(){return this;},limit(){return this;},get:async()=>({docs:[...docs].filter(([k])=>k.startsWith(p+'/')).map(([k,v])=>({id:k.split('/').at(-1),data:()=>v}))})};}
  const db={collection,runTransaction:async fn=>{const writes=[];await fn({get:r=>r.get(),set:(r,v,options)=>writes.push([r,v,options])});for(const [r,v,options]of writes)docs.set(r.path,options?.merge?{...docs.get(r.path),...v}:v);}};
  const service=createService({db,ExcelJS,JSZip,HttpsError,hierarchy,getAuth:()=>({getUser:async()=>({customClaims:{admin:true},disabled:false})})});
  const auth={uid:'admin',token:{admin:true,email:'admin@example.test'}};
  return {docs,service,call:data=>service({auth,data})};
}
test('admin-only reviewed mutations are additive, deduplicated, reversible, audited and revision checked',async()=>{
  const {docs,service,call}=adminFixture();
  await assert.rejects(service({data:{action:'list'}}),{code:'permission-denied'});
  await assert.rejects(service({auth:{uid:'admin',token:{}},data:{action:'list'}}),{code:'permission-denied'});
  const preview=await call({action:'preview',entries:[{name:'Alex Rep'},{name:'  alex rep '}]});assert.equal(preview.adding,1);assert.equal(preview.duplicates,1);assert.equal(preview.review[0].matchedPeople,1);
  await assert.rejects(call({action:'commit',revision:0,entries:preview.entries,reviewId:'forged'}),{code:'failed-precondition'});
  const saved=await call({action:'commit',revision:preview.revision,entries:preview.entries,reviewId:preview.reviewId});assert.equal(saved.entries.length,1);assert.equal(saved.revision,1);assert.equal(saved.history.length,1);
  assert.equal(docs.get('geoRepAttendanceConfig/current').operationalWeek,2);
  await assert.rejects(call({action:'remove',id:saved.entries[0].id,revision:0}),{code:'aborted'});
  const off=await call({action:'setEnabled',id:saved.entries[0].id,enabled:false,revision:1});assert.equal(off.entries[0].enabled,false);
  const removed=await call({action:'remove',id:saved.entries[0].id,revision:2});assert.equal(removed.entries.length,0);assert.equal(removed.history.length,3);
  assert.equal(docs.get('geoRepAttendanceDashboard/current').rows.length,1);
  docs.set('adminUsers/admin',{role:'normal',accountType:'staff'});await assert.rejects(call({action:'list'}),{code:'permission-denied'});
});
