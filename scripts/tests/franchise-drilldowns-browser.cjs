const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async(page,out)=>{
  const click=selector=>page.$eval(selector,e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  const ready=()=>page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
  const result=()=>page.evaluate(()=>foTest.result);
  const tab=async name=>{await click(`#franchisePrimaryNav [data-franchise-page="${name}"]`);await ready();};
  const reset=async()=>{await click('[data-fo-action="reset"]');await ready();};
  const back=async()=>{await click('[data-fo-action="back"]');await ready();};
  const title=()=>page.$eval('.fo-heading h1',e=>e.textContent);
  await reset();await tab('overview');
  const original=await result();
  for(const name of ['overview','trend','regions','products','stores','reps','orders']){
    await tab(name);
    for(const field of ['amount','orders','units','stores','averageOrder']){
      await click(`.fo-kpi [data-fo-total="${field}"]`);await ready();
      assert.equal(await title(),'Order Detail');
      assert.deepEqual((await result()).totals,original.totals,`${name} ${field} keeps the complete selection`);
      assert.ok(await page.$('.fo-reconciliation'));
      if(name!=='orders'){await back();assert.equal(await title(),await page.evaluate(name=>FranchiseOrders.pages[name],name));}
    }
  }
  await tab('overview');await click('.fo-kpi>div');await ready();assert.equal(await title(),'Order Detail','Whole card opens lines');await back();
  for(const [name,key] of [['regions','region'],['products','product'],['stores','storeName'],['reps','rep']]){
    await tab(name);
    for(const field of ['orders','units','amount',name==='stores'?'averageOrder':'stores']){
      const selector=`.fo-table-wrap tbody [data-metric="${field}"]`;
      const label=await page.$eval(selector,e=>e.dataset.value), before=await result(), group=before.by[key].find(r=>r.label===label);
      await click(selector);await ready();const detail=await result();
      assert.equal(detail.totals[field],group[field],`${name} ${field} reconciles ${JSON.stringify({label,before:before.selection,after:detail.selection,group})}`);
      assert.ok(detail.table.rows.every(r=>r[key]===label));
      await back();
    }
    await click('.fo-table-wrap tfoot [data-fo-total]');await ready();assert.deepEqual((await result()).totals,original.totals);await back();
  }
  await tab('trend');
  for(const granularity of ['day','week','month']){
    await page.select('[data-fo-granularity]',granularity);await ready();const grouped=await result();
    assert.equal(grouped.trendKey,granularity);
    const selector='.fo-chart .fo-chart-point', range=await page.$eval(selector,e=>({start:e.dataset.foPeriod,end:e.dataset.end}));
    await page.$eval(selector,e=>e.focus());await page.keyboard.press('Enter');await ready();
    const detail=await result(), expected=grouped.trend.find(r=>r.start===range.start&&r.end===range.end);
    assert.equal(detail.selection.start,range.start);assert.equal(detail.selection.end,range.end);
    for(const field of ['amount','orders','units','stores','averageOrder','lines'])assert.equal(detail.totals[field],expected[field],`${granularity} chart ${field}`);
    await back();assert.equal(await page.$eval('[data-fo-granularity]',e=>e.value),granularity);
    await click('.fo-table-wrap tbody td.fo-number [data-fo-period]');await ready();assert.equal((await result()).totals.lines,expected.lines);await back();
  }
  await reset();await tab('overview');
  const point=await page.$eval('.fo-spark .fo-chart-point',e=>e.dataset.foPeriod);await click('.fo-spark .fo-chart-point');await ready();
  assert.equal((await result()).selection.start,point);assert.equal((await result()).selection.end,point);await back();
  const status=await page.$eval('.fo-status-track button',e=>e.dataset.value);await click('.fo-status-track button');await ready();
  assert.ok((await result()).table.rows.every(r=>r.status===status));await back();
  await page.select('[data-fo-filter="region"]','Gauteng');await ready();
  const filtered=await result();await page.$eval('.fo-quality',e=>e.open=true);await click('[data-fo-exception="unmapped"]');await ready();
  const unmapped=await result();assert.equal(unmapped.table.total,filtered.quality.unmapped);assert.ok(unmapped.table.rows.every(r=>!r.mapped&&r.region==='Gauteng'));
  await click('[data-fo-action="export"]');await page.waitForFunction(()=>document.querySelector('.fo-message').textContent.includes('order lines exported'));
  const exported=await result();assert.equal(exported.table.rows.length,unmapped.table.total);assert.ok(exported.selection.export);assert.deepEqual(exported.selection.exceptions,['unmapped']);
  await back();assert.equal((await result()).selection.filters.region,'Gauteng');
  await page.$eval('.fo-quality',e=>e.open=true);await click('[data-fo-exception="cancelled"]');await ready();
  assert.equal((await result()).table.total,filtered.quality.cancelled.lines);assert.ok((await result()).table.rows.every(r=>r.cancelled));await back();
  await reset();await tab('orders');
  await click('[data-fo-order]');await ready();const order=await result();
  await click('.fo-table-wrap [data-fo-pick="product"]');await ready();assert.equal((await result()).selection.orderKey,order.selection.orderKey,'Nested product drilldown retains exact selected order');
  await click('[data-fo-line]');assert.ok(await page.$('.fo-line-detail dl'));await page.$eval('.fo-line-detail',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,'source-line-detail-desktop.png')});
  await click('[data-fo-action="closeLine"]');await back();assert.deepEqual((await result()).totals,order.totals);await back();
  await reset();await tab('overview');
  await page.evaluate(()=>{foTest.failAll=true;});await click('.fo-kpi [data-fo-total="amount"]');await page.waitForSelector('.fo-message.error');
  assert.equal(await title(),'Executive Overview','Failed drill keeps source page');
  await page.evaluate(()=>{foTest.failAll=false;});await click('[data-fo-action="refresh"]');await ready();
  console.log('PASS: all 35 KPI routes, whole cards, numeric group and period cells, chart keyboard interaction, clipped buckets, nested order scope, return context, source-line expansion, exceptions, scoped export and failed drill recovery.');
};
