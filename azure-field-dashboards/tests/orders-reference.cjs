'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR,portal='/',portalUrl=new URL('/',base).href;
const views={overview:'Executive Overview',trend:'Trend Analysis',regions:'Regional Performance',products:'Product Performance',stores:'Store Performance',reps:'Rep Performance',orders:'Order Detail'};
const cents=value=>Math.round(value*100);
function verify(data,rows){
  assert.equal(data.totals.lines,rows.length);assert.equal(data.table.total,rows.length);
  assert.equal(data.totals.orders,new Set(rows.map(r=>r.orderKey).filter(Boolean)).size);
  if(rows.every(r=>r.value!==null)&&new Set(rows.map(r=>r.currency)).size<=1)assert.equal(cents(data.totals.amount),cents(rows.reduce((sum,r)=>sum+r.value,0)));
  if(rows.every(r=>r.quantity!==null))assert.equal(data.totals.units,rows.reduce((sum,r)=>sum+r.quantity,0));
  const ids=new Set(rows.map(r=>r.id));assert.ok(data.table.rows.every(r=>ids.has(r.id)));
  for(const group of [data.trend,data.dailyTrend,...Object.values(data.by)])assert.equal(group.reduce((sum,r)=>sum+r.lines,0),rows.length);
}
(async()=>{
  fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[];let page;
  try {
    page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(120000);
    let requests=0;const network=[];
    page.on('request',r=>{network.push(r.url());if(r.url().endsWith('/api/orders'))requests++;});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const idle=async()=>{await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');await page.locator('#loading-status').waitFor({state:'hidden'});};
    const report=(match=()=>true)=>page.waitForResponse(r=>r.url().endsWith('/api/orders')&&match(r.request().postDataJSON()||{}));
    async function action(callback,match){await page.evaluate(()=>reports.clear());const event=report(match);await callback();const response=await event;assert.equal(response.status(),200);const data=await response.json();await idle();return data;}
    const reset=()=>action(()=>page.locator('[data-fo-action="reset"]').click());
    const initialEvent=report();await page.goto(base+'/franchise-orders',{waitUntil:'domcontentloaded'});const initial=await(await initialEvent).json();await idle();
    const ledgerResponse=await page.request.post(base+'/api/orders',{data:{includeCancelled:true,export:true},timeout:120000});assert.equal(ledgerResponse.status(),200);const ledger=await ledgerResponse.json();
    const normal=ledger.table.rows.filter(r=>!r.cancelled);verify(initial,normal);
    assert.doesNotMatch(await page.locator('body').innerText(),/Attendance|P&G|Sales Insights|Sign out|Sign in/i);
    assert.equal(await page.locator('iframe,input[type=password]').count(),0);
    assert.equal(await page.locator('#orders-sidebar #report-tabs a').count(),7);
    assert.equal(await page.locator('#orders-sidebar [data-portal-home]').getAttribute('href'),portal);
    const calls=requests;
    for(const [view,title]of Object.entries(views)){
      await page.locator(`#report-tabs a[href="/franchise-orders/${view}"]`).click();assert.equal(await page.locator('.fo h1').innerText(),title);
      assert.equal(await page.locator('#report-tabs [aria-current="page"]').getAttribute('data-franchise-page'),view);
      checks.push('tab/'+view);
    }
    assert.equal(requests,calls,'Sidebar view changes must reuse the loaded report');
    await page.locator('#report-tabs a[href$="/overview"]').click();
    const paths=await page.locator('.fo-reference-trace path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
    assert.ok(paths.length>=5);assert.ok(paths.every(d=>/^M[\d.-]+ [\d.-]+/.test(d)&&!/[{}]|NaN|undefined|Infinity/.test(d)));
    assert.equal(await page.locator('.fo-kpis article').count(),5);
    checks.push('source-coordinates-and-five-kpis');
    for(const field of ['manager','banner','client','region','rep','storeName','product','status','brand','channel','category','currency']){
      const values=ledger.options[field]||[],optional=['brand','channel','category','currency'].includes(field),input=page.locator(`[data-fo-filter="${field}"]`);
      if(!values.length||(optional&&!values.some(v=>!['Not supplied','Unassigned'].includes(v)))){
        if(optional)assert.equal(await input.count(),0);checks.push('filter/'+field+'/not-in-source');continue;
      }
      if(await input.locator('xpath=ancestor::details').count())await page.locator('.fo-extra>summary').click();
      const value=values.find(v=>normal.some(r=>r[field]===v))||values[0];
      const filtered=await action(()=>input.selectOption(value),q=>q.filters?.[field]===value);verify(filtered,normal.filter(r=>r[field]===value));
      assert.equal(await page.locator(`[data-fo-filter="${field}"]`).inputValue(),value);
      if(field==='client'){
        const exportResponse=report(q=>q.export===true),downloadEvent=page.waitForEvent('download');downloadEvent.catch(()=>{});
        await page.locator('.fo-tools [data-fo-action="export"]').click();const response=await exportResponse;assert.equal(response.status(),200);const exported=await response.json();
        verify(exported,normal.filter(r=>r.client===value));assert.equal(response.request().postDataJSON().version,filtered.version);
        const book=new ExcelJS.Workbook(),sheet=await book.csv.readFile(await(await downloadEvent).path(),{map:value=>value});assert.equal(sheet.rowCount,exported.table.rows.length+1);
        const headers=sheet.getRow(1).values,order=headers.indexOf('Order'),store=headers.indexOf('Store'),product=headers.indexOf('Product');
        assert.deepEqual(sheet.getRows(2,exported.table.rows.length).map(r=>[String(r.getCell(order).value||''),r.getCell(store).value,r.getCell(product).value]),exported.table.rows.map(r=>[r.orderNumber,r.storeName,r.product]));
        checks.push('client-filter-full-source-export');
      }
      checks.push('filter/'+field);console.log('Verified filter: '+field);await reset();
    }
    const included=await action(()=>page.locator('[data-fo-cancelled]').check());verify(included,ledger.table.rows);await reset();checks.push('include-cancelled');
    const sample=normal.find(r=>r.orderNumber);
    const searched=await action(async()=>{await page.locator('.fo-search input').fill(sample.orderNumber);await page.locator('.fo-search button').click();});
    verify(searched,normal.filter(r=>[r.orderNumber,r.poNumber,r.storeName,r.storeCode,r.product,r.sku,r.rep].join(' ').toLowerCase().includes(sample.orderNumber.toLowerCase())));await reset();checks.push('order-search');
    const lastDate=normal.map(r=>r.orderDate).sort().at(-1);
    const custom=await action(async()=>{await page.locator('[data-fo-date="end"]').fill(lastDate);await page.locator('[data-fo-date="end"]').blur();});
    assert.equal(custom.selection.end,lastDate);verify(custom,normal.filter(r=>r.orderDate<=lastDate));checks.push('custom-dates');await reset();
    for(const months of [3,12]){
      const selected=await action(()=>page.locator('[data-fo-preset]').selectOption(String(months)));const [year,month]=selected.latestPeriod.split('-').map(Number);
      assert.equal(selected.selection.start,new Date(Date.UTC(year,month-months,1)).toISOString().slice(0,10));assert.ok(selected.table.rows.every(r=>r.orderDate>=selected.selection.start&&r.orderDate<=selected.selection.end));
      checks.push('period/'+months);
    }
    await reset();
    await page.locator('#report-tabs a[href$="/trend"]').click();
    for(const granularity of ['day','week','month']){const result=await action(()=>page.locator('[data-fo-granularity]').selectOption(granularity));verify(result,normal);checks.push('trend/'+granularity);}
    await reset();
    await page.locator('#report-tabs a[href$="/overview"]').click();
    const point=page.locator('.fo-chart-panel .fo-chart-point').first(),from=await point.getAttribute('data-fo-period'),to=await point.getAttribute('data-end');
    const drilled=await action(()=>point.press('Enter'));verify(drilled,normal.filter(r=>r.orderDate>=from&&r.orderDate<=to));
    assert.equal(await page.locator('#report-tabs [aria-current="page"]').getAttribute('data-franchise-page'),'orders');
    const back=await action(()=>page.locator('[data-fo-action="back"]').click());verify(back,normal);checks.push('keyboard-chart-drilldown-and-back');
    for(const width of [1366,1024,390,320]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);await idle();
      if(width<=760)await page.waitForFunction(()=>document.querySelector('#orders-sidebar').getBoundingClientRect().right<=0);
      for(const [view,title]of Object.entries(views)){
        if(width<=760)await page.locator('#orders-nav-toggle').click();
        await page.locator(`#report-tabs a[href="/franchise-orders/${view}"]`).click();assert.equal(await page.locator('.fo h1').innerText(),title);
        if(width<=760)await page.locator('#orders-sidebar').waitFor({state:'hidden'});
        await idle();
        assert.equal(await page.locator('#main').evaluate(n=>n.inert),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.locator('#attendance-sidebar').isVisible(),false);
        assert.doesNotMatch(await page.locator('body').innerText(),/Attendance|P&G|Sales Insights|Sign out/i);
        const box=await page.locator('#main').boundingBox();assert.equal(box.x,width>760?244:0);assert.equal(box.width,width-(width>760?244:0));
        await page.evaluate(()=>document.getElementById('main').scrollTop=0);
        await page.screenshot({path:path.join(directory,`${view}-${width}.png`)});
      }
      if(width<=760){
        await page.locator('#orders-nav-toggle').click();await page.waitForFunction(()=>document.querySelector('#orders-sidebar').getBoundingClientRect().left===0);
        assert.equal(await page.locator('#main').evaluate(n=>n.inert),true);await page.screenshot({path:path.join(directory,`menu-${width}.png`)});
        await page.keyboard.press('Escape');assert.equal(await page.locator('#orders-nav-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#main').evaluate(n=>n.inert),false);
        if(await page.locator('[data-fo-action="filters"]').getAttribute('aria-expanded')==='false')await page.locator('[data-fo-action="filters"]').click();
        assert.equal(await page.locator('[data-fo-filter="client"]').isVisible(),true);checks.push('mobile/filter-toggle/'+width);
      }
      checks.push('responsive/'+width+'/all-seven-views');
    }
    assert.ok(network.filter(url=>url.includes('/api/')).every(url=>url.startsWith(base+'/api/orders')),'Only the Geo orders endpoint is used');
    assert.ok(network.filter(url=>/\.js(?:\?|$)/.test(url)).every(url=>url.startsWith(base+'/')),'No source MSAL/DC runtime or external scripts');
    await page.route(portalUrl,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><title>Home destination</title>'}));
    await page.locator('#orders-nav-toggle').click();await page.locator('[data-portal-home]').click();await page.waitForURL(portalUrl);checks.push('home');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,checks,errors},null,2));console.log(`Passed ${checks.length} Franchise reference checks.`);
  }catch(error){if(page){await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:error.message,checks,errors},null,2));}throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
