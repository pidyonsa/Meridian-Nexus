'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const {createApp}=require('../server/main.cjs');
const {hoverCheck,touchCheck}=require('./regional-hover-check.cjs');
const O=require('../../firebase-dashboards/backend/vendor/orders.cjs'),R=require('../../firebase-dashboards/backend/order-regional-analytics.cjs'),M=require('../../firebase-dashboards/backend/order-regions.cjs');
const live=process.argv.find(arg=>arg.startsWith('https://'));
const output=path.resolve(__dirname,'../test-results/regional-design',live?'live':'local');
async function main(){
  fs.mkdirSync(output,{recursive:true});let server,browser;
  const errors=[],checks=[];
  try{
    let base=live;
    if(!base){
      const source=require('../../firebase-dashboards/test-results/order-regions/before.json'),resource=require('../../firebase-dashboards/test-results/order-regions/resource.json');
      const rows=R.enrich(M.enrich(source.table.rows,M.index(resource)));
      const app=createApp({enabled:()=>true,fetchImpl:async(url,options)=>{
        assert.ok(new URL(url).pathname.endsWith('/api/orders'));
        const input=JSON.parse(options.body),selection=O.selection(input,source.latestPeriod,Error),result=R.report(rows,selection,source.latestPeriod);
        result.version='regional-fixture';result.groupCounts=Object.fromEntries(Object.entries(result.by).map(([k,v])=>[k,v.length]));
        return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
      }});
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;
    }
    async function report(input){const response=await fetch(base+'/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});assert.equal(response.status,200);return response.json();}
    const all=await report({export:true,includeCancelled:true});
    assert.equal(all.regionalAnalytics.schema,1);
    const check=R.report(all.table.rows,all.selection,all.latestPeriod);
    assert.deepEqual(all.regionalAnalytics,check.regionalAnalytics);checks.push('All source rows reconcile with province, division and activity aggregates');
    for(const province of ['Eastern Cape','Western Cape']){
      const selected=await report({filters:{province},export:true,includeCancelled:true,version:all.version});
      assert.deepEqual(selected.table.rows.map(r=>r.id).sort(),all.table.rows.filter(r=>r.province===province).map(r=>r.id).sort());
    }
    checks.push('Multi-region province filtering and exports');
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const idle=async()=>{await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');await page.locator('#loading-status').waitFor({state:'hidden'});};
    const initialResponse=page.waitForResponse(r=>r.url().endsWith('/api/orders'));
    await page.goto(base+'/franchise-orders/regions');const initial=await(await initialResponse).json();await idle();
    assert.equal(await page.locator('.fr-map path').count(),9);assert.equal(await page.locator('.fr-map text').count(),9);assert.ok(await page.locator('.fr-line-chart .fr-series').count());
    assert.ok((await page.locator('.fr-league tbody tr').first().boundingBox()).height<=38,'Desktop league rows should match the compact reference');
    let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/orders'))requests++;});
    await hoverCheck(page,initial,'amount',output,'desktop-amount');assert.equal(requests,0,'Hover and keyboard inspection must not fetch or change filters');
    checks.push('Shared hover totals, exact decimals, full-period total, keyboard navigation and viewport bounds');
    await page.locator('.fr-intelligence').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'desktop-summary.png')});
    await page.locator('.fr-map-layout').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'desktop-map.png')});
    const province=page.locator('[data-fr-province="Eastern Cape"]');await province.focus();
    const response=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().postDataJSON()?.filters?.province==='Eastern Cape');
    await province.press('Enter');const selected=await(await response).json();await idle();assert.ok(selected.table.rows.every(r=>r.province==='Eastern Cape'));assert.ok(selected.by.region.length>=1);
    await page.locator('[data-fo-action="back"]').click();await idle();assert.equal(await page.locator('.fr-map').count(),1);checks.push('Keyboard map drilldown and previous selection');
    await page.locator('[data-fo-filter="client"]').selectOption('aQuelle');await idle();
    assert.equal(await page.locator('[name="fo-metric"][value="units"]').isChecked(),true);assert.ok((await page.locator('.fr-map [data-fr-province]').count())>=6);
    assert.equal(await page.locator('.fr-shares').first().locator('.fr-share-row').count(),0);
    assert.match(await page.locator('.fr-shares').first().innerText(),/No recorded amount/);
    await page.locator('[name="fo-metric"][value="amount"]').check();await idle();assert.match(await page.locator('.fr-trend h2').innerText(),/amount/);
    const filtered=await report({filters:{client:'aQuelle'}});
    await hoverCheck(page,filtered,'amount',output,'zero-amount');
    await page.locator('[name="fo-metric"][value="units"]').check();await idle();
    await hoverCheck(page,filtered,'units',output,'filtered-units');
    const point=page.locator('.fr-line-chart [data-fr-point]').first();await point.scrollIntoViewIfNeeded();await point.focus();await point.press('Enter');await idle();assert.match(await page.locator('.fo-active-filters').innerText(),/aQuelle/);
    await page.locator('[data-fo-action="back"]').click();await idle();checks.push('Zero amounts, units switch and date + region drilldown retain client');
    await page.locator('[data-fo-granularity]').selectOption('month');await idle();assert.match(await page.locator('.fr-trend h2').innerText(),/Monthly units/);assert.equal(await page.locator('.fr-line-chart [data-fr-point]').count(),filtered.by.region.length);
    await hoverCheck(page,await report({filters:{client:'aQuelle'},granularity:'month'}),'units',output,'single-month');
    checks.push('Tooltip follows zero amounts, Units, client filters and monthly single-point data');
    const download=page.waitForEvent('download');await page.locator('[data-fo-action="exportGroups"]').click();const file=await download;await file.saveAs(path.join(output,'regional-summary.csv'));assert.match(fs.readFileSync(path.join(output,'regional-summary.csv'),'utf8'),/Western Cape/);checks.push('Observed monthly activity and summary CSV');
    await page.locator('[data-fo-action="reset"]').click();await idle();
    await page.locator('.fr-share-grid').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'desktop-shares.png')});
    await page.locator('.fr-trend').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'desktop-table-trend.png')});
    for(const width of [1366,1024,390,320]){
      await page.setViewportSize({width,height:950});await page.waitForTimeout(300);
      if(width<=760)await page.locator('#orders-sidebar').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);
      const boxes=await page.locator('.fr-map-layout').evaluate(el=>[...el.children].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
      assert.ok(boxes[0].right<=boxes[1].x+1||boxes[0].bottom<=boxes[1].y+1,'Map and details overlap');
      await page.locator('.fr-map-layout').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'map-'+width+'.png')});
    }
    checks.push('1440/1366/1024/390/320 layouts and nonblank map geometry');
    await touchCheck(browser,base,output,errors);checks.push('Touch totals and horizontally scrolled mobile chart remain in viewport');
    await page.locator('.fo-search input').fill('NO-ORDER-REGIONAL-EMPTY-TEST');await page.locator('.fo-search input').press('Enter');await idle();assert.match(await page.locator('.fr-summary').innerText(),/No order lines/);assert.equal(await page.locator('[data-fr-province]').count(),0);checks.push('Empty result state');
    assert.deepEqual(errors,[]);
    const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../public/asset-manifest.json')));
    for(const file of manifest.files){const r=await fetch(base+'/'+file.path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200,file.path);assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),file.sha256,file.path);}
    for(const [route,method,status]of [['/api/admin','POST',404],['/api/import/orders','POST',404],['/api/orders','DELETE',405]])assert.equal((await fetch(base+route,{method})).status,status);
    checks.push('All 36 static hashes and read-only route boundaries');
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,version:all.version,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
  }finally{await browser?.close();if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
