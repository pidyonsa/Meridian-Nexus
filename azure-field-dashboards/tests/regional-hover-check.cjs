'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const normal=value=>String(value).replace(/\s/g,'');
function format(value,metric,currency){
  if(!Number.isFinite(value))return 'Not available';
  return new Intl.NumberFormat('en-ZA',metric==='amount'&&/^[A-Z]{3}$/.test(currency||'')?{style:'currency',currency,maximumFractionDigits:2}:{maximumFractionDigits:metric==='amount'?2:10}).format(value);
}
async function coordinates(page,index,point=false){
  return page.locator('.fr-line-chart').evaluate((svg,{index,point})=>{
    const positions=JSON.parse(svg.dataset.frPositions),p=svg.createSVGPoint();p.x=positions[index];p.y=point?Number(svg.querySelector(`.fr-series [data-fr-period-index="${index}"]`).getAttribute('cy')):120;
    const screen=p.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y};
  },{index,point});
}
async function totals(page,data,metric,index){
  const tip=page.locator('.fr-tooltip');await tip.waitFor({state:'visible'});
  assert.equal(await tip.getAttribute('data-period-index'),String(index));
  const period=data.regionalAnalytics.series[index];
  const leaders=[...data.by.region].sort((a,b)=>Number(Number.isFinite(b[metric]))-Number(Number.isFinite(a[metric]))||(Number.isFinite(a[metric])&&Number.isFinite(b[metric])?b[metric]-a[metric]:0)||a.label.localeCompare(b.label)).slice(0,6);
  const rows=await tip.locator('.fr-tooltip-row').evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('span').textContent,value:n.querySelector('strong').textContent})));
  assert.equal(rows.length,leaders.length);
  leaders.forEach((leader,i)=>{
    const actual=period.regions.find(row=>row.label===leader.label);
    assert.equal(rows[i].label,leader.label);assert.equal(normal(rows[i].value),normal(format(actual?actual[metric]:0,metric,data.totals.currency)));
  });
  const total=data.trend.find(row=>row.label===period.label)[metric];
  assert.equal(normal(await tip.locator('.fr-tooltip-total>strong').textContent()),normal(format(total,metric,data.totals.currency)));
  assert.equal(await tip.locator('.fr-tooltip-total small').textContent(),'All selected regions');
  const box=await tip.boundingBox(),viewport=page.viewportSize();
  assert.ok(box.x>=7&&box.y>=7&&box.x+box.width<=viewport.width-7&&box.y+box.height<=viewport.height-7,'Tooltip must fit the viewport');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
async function hoverCheck(page,data,metric,directory,label){
  const index=Math.min(1,data.regionalAnalytics.series.length-1),last=data.regionalAnalytics.series.length-1;
  await page.locator('.fr-chart-scroll').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  const before=await page.locator('.fr-chart-stage').boundingBox(),point=await coordinates(page,index);
  await page.mouse.move(point.x,point.y);await totals(page,data,metric,index);
  assert.equal((await page.locator('.fr-chart-stage').boundingBox()).height,before.height,'Hover cannot resize the chart');
  await page.screenshot({path:path.join(directory,'hover-'+label+'.png')});
  await page.locator('.fr-tooltip').hover();await totals(page,data,metric,index);
  await page.keyboard.press('Escape');await page.locator('.fr-tooltip').waitFor({state:'hidden'});
  await page.mouse.move(1,1);
  await page.locator('.fr-chart-scroll').focus();await page.locator('.fr-chart-scroll').press('Home');await page.waitForFunction(()=>document.querySelector('.fr-tooltip')?.dataset.periodIndex==='0');await totals(page,data,metric,0);
  await page.locator('.fr-chart-scroll').press('End');await page.waitForFunction(index=>document.querySelector('.fr-tooltip')?.dataset.periodIndex===String(index),last);await totals(page,data,metric,last);
  if(last){await page.locator('.fr-chart-scroll').press('ArrowLeft');await page.waitForFunction(index=>document.querySelector('.fr-tooltip')?.dataset.periodIndex===String(index),last-1);await totals(page,data,metric,last-1);}
  await page.keyboard.press('Escape');await page.locator('.fr-tooltip').waitFor({state:'hidden'});
  const dot=page.locator('.fr-series [data-fr-period-index="0"]').first();await dot.focus();
  if(last){await dot.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.fr-tooltip')?.dataset.periodIndex==='1');assert.equal(await page.evaluate(()=>document.activeElement.dataset.frPeriodIndex),'1');await totals(page,data,metric,1);}
  await page.keyboard.press('Escape');await page.locator('.fr-tooltip').waitFor({state:'hidden'});
}
async function touchCheck(browser,base,directory,errors){
  const page=await browser.newPage({viewport:{width:320,height:900},hasTouch:true,isMobile:true});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  try{
    const response=page.waitForResponse(r=>r.url().endsWith('/api/orders'));
    await page.goto(base+'/franchise-orders/regions');const data=await(await response).json();
    await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
    await page.locator('#loading-status').waitFor({state:'hidden'});
    await page.locator('.fr-chart-scroll').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
    const point=await coordinates(page,0,true);await page.touchscreen.tap(point.x,point.y);await totals(page,data,'amount',0);
    assert.equal(await page.locator('.fo h1').textContent(),'Regional Performance','A tap shows totals instead of accidentally drilling');
    await page.screenshot({path:path.join(directory,'hover-mobile-touch.png')});
    await page.locator('.fr-chart-scroll').evaluate(el=>{el.scrollLeft=el.scrollWidth;});await page.locator('.fr-tooltip').waitFor({state:'hidden'});
    const last=data.regionalAnalytics.series.length-1,lastPoint=await coordinates(page,last);
    await page.touchscreen.tap(lastPoint.x,lastPoint.y);await totals(page,data,'amount',last);
    await page.screenshot({path:path.join(directory,'hover-mobile-last-period.png')});
    await page.touchscreen.tap(5,5);await page.locator('.fr-tooltip').waitFor({state:'hidden'});
  }finally{await page.close();}
}
module.exports={hoverCheck,touchCheck};
