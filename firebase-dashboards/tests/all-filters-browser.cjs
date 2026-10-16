'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const express=require('node:module').createRequire(path.resolve(__dirname,'../backend/package.json'))('express');
const ExcelJS=require('../backend/node_modules/exceljs');
const {fixtureService}=require('./filter-fixture.cjs');
const {createHandler}=require('../backend/handler.cjs');
(async()=>{
  let server,browser;
  const azure=process.argv.includes('--azure');
  const dir=path.resolve(__dirname,azure?'../../azure-field-dashboards/test-results/filters':'../test-results');fs.mkdirSync(dir,{recursive:true});
  try{
    // Rate limiting has separate tests; advance its clock during this local UI matrix.
    let tick=Date.now();
    const app=express();app.use(express.json());const handler=createHandler(fixtureService(),{enabled:()=>true,now:()=>tick+=1000});
    app.use((req,res,next)=>req.path.startsWith('/api/')?handler(req,res):next());
    const publicDir=path.resolve(__dirname,azure?'../../azure-field-dashboards/public':'../dist');
    app.use(express.static(publicDir));app.use((_,res)=>res.sendFile(path.join(publicDir,'index.html')));
    server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const errors=[],checks=[];
    for(const width of [1366,390]){
      const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(15000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      let requests=0,first=true,racing=false;
      page.on('request',r=>{if(r.url().includes('/api/'))requests++;});
      if(azure)await page.route('**/api/orders',async route=>{
        const body=route.request().postDataJSON();
        const delay=first?700:racing&&body.filters?.client==='Client 0'?600:racing?25:0;first=false;
        if(delay)await new Promise(r=>setTimeout(r,delay));await route.continue();
      });
      const ordersIdle=()=>page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
      const resetOrders=async()=>{await page.locator('[data-fo-action="reset"]').click();await ordersIdle();};
      const chooseOrder=async(key,value)=>{
        const input=page.locator(`[data-fo-filter="${key}"]`);
        if(await input.locator('xpath=ancestor::details').count())await page.locator('.fo-extra>summary').click();
        await input.selectOption(value);await ordersIdle();assert.equal(await page.locator(`[data-fo-filter="${key}"]`).inputValue(),value);
      };
      await page.goto(url+'/franchise-orders');
      if(azure){await page.waitForSelector('#loading-status:not([hidden])');assert.equal(await page.locator('#loading-status').evaluate(n=>getComputedStyle(n).pointerEvents),'none');await page.screenshot({path:path.join(dir,`loading-${width}.png`)});}
      await ordersIdle();
      if(width<641)await page.locator('[data-fo-action="filters"]').click();
      if(azure){
        racing=true;await page.locator('[data-fo-filter="client"]').selectOption('Client 0');await page.locator('[data-fo-filter="client"]').selectOption('Client 1');await ordersIdle();await page.waitForTimeout(700);racing=false;
        const expected=await fixtureService().orders({filters:{client:'Client 1'}});
        assert.equal(await page.locator('[data-fo-filter="client"]').inputValue(),'Client 1');
        assert.equal(Number((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,'')),expected.table.total);
        const before=requests,tabTimes=[];
        for(const tab of ['trend','regions','products','stores','reps','orders','overview']){
          const start=performance.now();await page.locator(`#report-tabs a[href="/franchise-orders/${tab}"]`).click();await ordersIdle();tabTimes.push(Math.round(performance.now()-start));
          assert.equal(await page.locator('[data-fo-filter="client"]').inputValue(),'Client 1');assert.equal(Number((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,'')),expected.table.total);
        }
        assert.equal(requests,before,'Loaded order tabs must not repeat requests');checks.push({width,orderTabsWithoutRequests:7,tabTimes});
        await resetOrders();
      }
      for(const field of ['manager','banner','region','rep','storeName','product','status','client','channel','brand','category','currency']){
        const options=await page.locator(`[data-fo-filter="${field}"] option`).evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
        assert.ok(options.length,field);await chooseOrder(field,field==='status'?'Cancelled':options[0]);
        assert.ok((await page.locator('.fo-active-filters').innerText()).includes(field==='status'?'Cancelled':options[0]));
        assert.notEqual((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,''),'0',field);
        if(field==='status'){assert.equal(await page.locator('[data-fo-cancelled]').isChecked(),true);assert.equal(await page.locator('[data-fo-cancelled]').isDisabled(),true);}
        await resetOrders();checks.push(`${width}/orders/${field}`);
      }
      await chooseOrder('manager','Manager 0');await chooseOrder('banner','Banner 0');
      const download=page.waitForEvent('download');await page.locator('[data-fo-action="export"]').click();
      const downloaded=await download;const csv=fs.readFileSync(await downloaded.path(),'utf8');
      assert.ok(csv.includes('Banner 0'));assert.ok(!csv.includes('Banner 1'));
      await page.locator('.fo-period-tools [data-fo-total="lines"]').click();await ordersIdle();await page.waitForSelector('.fo-table-section');
      assert.equal(await page.locator('[data-fo-filter="manager"]').inputValue(),'Manager 0');assert.equal(await page.locator('[data-fo-filter="banner"]').inputValue(),'Banner 0');
      await resetOrders();
      await chooseOrder('brand','Brand 0');
      await page.locator('[data-fo-date="start"]').fill('2026-08-01');await page.locator('[data-fo-date="start"]').blur();await ordersIdle();
      await page.locator('[data-fo-date="end"]').fill('2026-08-31');await page.locator('[data-fo-date="end"]').blur();await ordersIdle();
      assert.equal(await page.locator('[data-fo-filter="brand"]').inputValue(),'Brand 0','Unavailable selection must not silently show All');
      assert.ok((await page.locator('.fo-active-filters').innerText()).includes('Brand 0'));
      assert.equal((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,''),'0');
      await resetOrders();assert.equal(await page.locator('[data-fo-filter="brand"]').inputValue(),'');
      for(const audience of ['rep','merchandiser']){
        await page.goto(`${url}/attendance/${audience}/daily`);await page.waitForSelector('.attendance-analytics');
        const changeAttendance=async(field,value)=>{
          await page.locator(`#attendance-filters select[name="${field}"]`).selectOption(value);
          await page.waitForSelector('.attendance-analytics');
          assert.equal(await page.locator(`#attendance-filters select[name="${field}"]`).inputValue(),value);
        };
        const resetAttendance=async()=>{await page.locator('#attendance-filters [type="reset"]').click();await page.waitForSelector('.attendance-analytics');};
        for(const field of ['region','manager','division','role','banner','channel','brand']){
          const value=await page.locator(`#attendance-filters select[name="${field}"] option`).nth(1).getAttribute('value');
          await changeAttendance(field,value);await resetAttendance();checks.push(`${width}/${audience}/${field}`);
        }
        await page.locator('[data-attendance-date]').selectOption('2026-09-01');await changeAttendance('region','Gauteng');
        assert.equal(await page.locator('[data-attendance-date]').inputValue(),'2026-09-01','Selected day must survive a filter update');
        const chosen=page.locator('.pg-source-datebar [data-attendance-export]');
        assert.equal(JSON.parse(await chosen.getAttribute('data-attendance-export')).date,'2026-09-01');
        const nextDownload=page.waitForEvent('download');await chosen.click();const excel=await nextDownload;
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await excel.path());
        const rows=workbook.getWorksheet('Visits').getSheetValues().slice(2).filter(Boolean);assert.ok(rows.length);
        assert.ok(rows.every(r=>r[2]==='2026-09-01'&&r[11]==='Gauteng'));
        const count=page.locator('.pg-source-kpis [aria-label="Target visits"],.pg-source-kpis [aria-label="Target Visits"]').first();
        assert.equal(Number((await count.innerText()).replace(/\D/g,'')),rows.length);
        await count.click();await page.waitForSelector('.attendance-drilldown table');
        assert.equal(await page.locator('.attendance-drilldown tbody tr').count(),rows.length);
        await page.locator('[data-attendance-close]').click();
        await changeAttendance('region','Free State');
        assert.notEqual(await page.locator('[data-attendance-date]').inputValue(),'2026-09-01','Unavailable day must switch to an actual matching day');
        await resetAttendance();
        if(azure){
          const before=requests;
          for(const tab of ['overview','users','stores','daily']){await page.locator(`#report-tabs a[href="/attendance/${audience}/${tab}"]`).click();await page.waitForSelector('.attendance-analytics');}
          assert.equal(requests,before,'Loaded attendance tabs must not repeat requests');checks.push(`${width}/${audience}/cached-tabs`);
        }
        await page.screenshot({path:path.join(dir,`filters-${audience}-${width}.png`)});
      }
      await page.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'all-filters-browser.json'),JSON.stringify({at:new Date().toISOString(),checks,errors},null,2));
    console.log(`Passed ${checks.length} filter/viewport checks, cancelled status, empty results, combined-filter drilldowns and real CSV/Excel downloads.`);
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
