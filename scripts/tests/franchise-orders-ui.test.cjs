const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../public/franchise-orders.js'),'utf8'),context);
const {periodRange,ranked,share,csvCell,chartGeometry}=context.window.FranchiseOrders;
test('reporting presets anchor to imported month, including year boundaries',()=>{
  assert.equal(periodRange('2026-01',3).start,'2025-11-01');
  assert.equal(periodRange('2026-01',3).end,'2026-01-31');
  assert.equal(periodRange('2026-09',12).start,'2025-10-01');
  assert.equal(periodRange('2026-09',12).end,'2026-09-30');
});
test('presets handle leap months and reject invalid ledger periods',()=>{
  assert.equal(periodRange('2024-02').end,'2024-02-29');
  for(const input of ['bad','2026-13','2026-00',null]) assert.equal(periodRange(input),null);
});
test('amount and units rank independently without mutating API data',()=>{
  const rows=[{label:'A',amount:100,units:2},{label:'B',amount:40,units:9}];
  assert.equal(ranked(rows,'amount')[0].label,'A');
  assert.equal(ranked(rows,'units')[0].label,'B');
  assert.equal(rows[0].label,'A');
});
test('unavailable values do not outrank negatives or create a false zero',()=>{
  const rows=[{label:'Unknown',amount:null},{label:'Negative',amount:-5}];
  assert.equal(ranked(rows,'amount')[0].label,'Negative');
});
test('share calculations require comparable, non-negative values',()=>{
  assert.equal(share(20,100,[{amount:20},{amount:80}],'amount'),20);
  for(const rows of [[{amount:null}],[{amount:-5}],[{amount:NaN}]]) assert.equal(share(20,100,rows,'amount'),null);
  assert.equal(share(null,100,[],'amount'),null);
  assert.equal(share(0,0,[],'amount'),null);
});
test('CSV cells escape formulas, quotes and newlines',()=>{
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('A "name"\nB'),'"A ""name""\nB"');
});

test('activity bars keep real dates, zero baseline, negatives and missing values',()=>{
  const rows=[{label:'2026-09-01',amount:50},{label:'2026-09-02',amount:-20},{label:'2026-09-09',amount:0},{label:'2026-09-10',amount:null}];
  const chart=chartGeometry(rows,'amount',420,250);
  assert.ok(chart.points[2].x-chart.points[1].x > 6*(chart.points[1].x-chart.points[0].x));
  assert.equal(chart.min,-20);assert.equal(chart.max,50);
  assert.ok(chart.points[0].y<chart.zero);assert.ok(chart.points[1].y>chart.zero);
  assert.equal(chart.points[2].height,2);assert.equal(chart.points[3].height,null);
});

test('single, identical, zero and unavailable dates never invent a trend',()=>{
  assert.equal(chartGeometry([{label:'2026-09-01',units:null}],'units',240,72,true),null);
  for(const values of [[0],[20],[20,20,20],[-10,-10]]){
    const chart=chartGeometry(values.map((units,i)=>({label:`2026-09-0${i+1}`,units})),'units',240,72,true);
    assert.equal(new Set(chart.points.map(p=>p.height)).size,1);
    for(const point of chart.points){assert.ok(Number.isFinite(point.x));assert.ok(Number.isFinite(point.y));assert.ok(point.height>0);}
  }
});
