'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR;
const number=text=>Number(text.replace(/[^0-9.]/g,''));
(async()=>{
  fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[];let page;
  try {
    page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const api=async input=>{const response=await page.request.post(base+'/api/attendance',{data:input,timeout:120000});assert.equal(response.status(),200,await response.text());return response.json();};
    const idle=()=>page.waitForFunction(()=>{const date=document.querySelector('[data-attendance-date]')?.value,detail=document.querySelector('[data-daily-details]');return !!date&&detail?.dataset.date===date&&detail.getAttribute('aria-busy')==='false';});
    async function verify(audience,filters={}) {
      await idle();
      const date=await page.locator('[data-attendance-date]').inputValue(),day=await api({audience,filters:{...filters,date}}),m=day.metrics;
      const kpis=await page.locator('.attendance-daily-kpis strong').allTextContents();
      assert.equal(number(kpis[0]),m.scheduled);assert.equal(number(kpis[1]),m.attended);
      assert.equal(number(kpis[2]),Number(m.strikeRate.toFixed(1)));assert.equal(number(kpis[3]),m.missedStores);
      assert.equal(number(kpis[4]),Number((m.missedStores/m.totalStores*100).toFixed(1)));
      const managerRows=page.locator('.attendance-daily-managers tbody tr');assert.equal(await managerRows.count(),Math.max(2,day.charts.byManager.length));
      const missed=day.stores.filter(r=>r.status==='missed');
      assert.equal(await page.locator('.attendance-daily-missed tbody tr').count(),Math.max(1,missed.length));
      assert.equal(await page.locator('.attendance-daily-roles .attendance-role').count(),day.charts.byRole.length);
      const selections=await page.locator('.attendance-daily-kpis [data-attendance-detail],.attendance-daily-details [data-attendance-detail],.attendance-daily-roles [data-attendance-detail]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.attendanceDetail)));
      assert.ok(selections.every(s=>s.date===date));
      assert.ok(selections.some(s=>s.metric==='missed'&&s.unit==='stores'));
      const history=await page.locator('.attendance-history-day').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.attendanceDetail)));
      assert.ok(history.length<=13&&history.every(s=>s.date<=date));
      const divisions=await page.locator('.attendance-daily-divisions .attendance-region-groups h3').allTextContents();
      assert.deepEqual(divisions,day.charts.byDivision.map(r=>r.label).sort());
      assert.equal(await page.locator('a[href^="/franchise-orders"]').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      return {date,day};
    }
    for(const audience of ['rep','merchandiser']){
      await page.setViewportSize({width:1366,height:900});
      await page.goto(base+`/attendance/${audience}/daily`,{waitUntil:'domcontentloaded'});await idle();
      console.log(audience+': daily view loaded.');
      assert.equal(await page.locator('h1').innerText(),'Daily Visit Log');
      const initial=await verify(audience);
      const detailResponse=page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&r.request().postDataJSON()?.mode==='detail');
      await page.locator('.attendance-daily-kpis article:nth-child(4) button').click();
      const detail=await(await detailResponse).json();
      assert.equal(detail.total,initial.day.metrics.missedStores);assert.ok(detail.rows.every(r=>r.status==='missed'&&r.dates.includes(initial.date)));
      await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
      for(const selector of ['.attendance-history-day','.attendance-daily-managers tbody th button']){
        const button=page.locator(selector).first(),selection=JSON.parse(await button.getAttribute('data-attendance-detail'));
        const response=page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&r.request().postDataJSON()?.mode==='detail');
        await button.click();const result=await(await response).json();
        assert.equal(result.metric,'target');assert.ok(result.rows.every(row=>row.date===selection.date));
        if(selection.lineManager){assert.ok(result.rows.every(row=>row.manager.toUpperCase()===selection.lineManager.toUpperCase()));assert.equal(result.total,initial.day.charts.byManager.find(row=>row.label===selection.lineManager).scheduled);}
        await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
        checks.push(audience+(selection.lineManager?'/manager-daily-drilldown':'/history-chart-drilldown'));
      }
      const exportedResponse=page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&r.request().postDataJSON()?.mode==='export');
      const downloaded=page.waitForEvent('download');await page.locator('.attendance-daily-missed [data-attendance-export]').click();
      const exported=await(await exportedResponse).json();await downloaded;
      assert.equal(exported.total,initial.day.metrics.missedStores);
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exported.base64,'base64'));
      assert.equal(workbook.getWorksheet('Stores').rowCount,exported.total+1);
      const exportedIds=workbook.getWorksheet('Stores').getRows(2,exported.total)||[];
      assert.deepEqual(exportedIds.map(row=>row.getCell(1).value).sort(),initial.day.stores.filter(row=>row.status==='missed').map(row=>row.id).sort());
      assert.ok(workbook.getWorksheet('Selection').getRows(1,workbook.getWorksheet('Selection').rowCount).some(row=>row.getCell(1).value==='selection'&&JSON.parse(row.getCell(2).value).date===initial.date));
      checks.push(audience+'/daily-kpi-detail-excel-reconciliation');
      console.log(audience+': daily totals, missed-store detail and Excel reconcile.');
      const options=await page.locator('[data-attendance-date] option').evaluateAll(nodes=>nodes.map(n=>n.value));
      const previous=options.at(-2);
      if(previous){await page.locator('[data-attendance-date]').selectOption(previous);await verify(audience);await page.locator('[data-attendance-date]').selectOption(initial.date);await verify(audience);checks.push(audience+'/date-change-and-return');}
      for(const field of ['manager','region','division','role']){
        const offered=await page.locator(`#attendance-filters [name="${field}"] option`).evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
        const value=offered.find(value=>initial.day.rows.some(r=>r.scheduled&&String(r[field]).toUpperCase()===value.toUpperCase()));if(!value)continue;
        const previousDetails=await page.locator('[data-daily-details]').elementHandle();
        await page.locator(`#attendance-filters [name="${field}"]`).selectOption(value);
        await page.waitForFunction(node=>!node.isConnected,previousDetails);await previousDetails.dispose();
        await idle();
        const filtered=await verify(audience,{[field]:value});assert.ok(filtered.day.metrics.scheduled<=initial.day.metrics.scheduled||filtered.date!==initial.date);
        checks.push(audience+'/filter/'+field);
        console.log(audience+': '+field+' filter verified.');
        const filteredDetails=await page.locator('[data-daily-details]').elementHandle();
        await page.locator('#attendance-filters button[type="reset"]').click();
        await page.waitForFunction(node=>!node.isConnected,filteredDetails);await filteredDetails.dispose();await idle();
        await page.waitForFunction(field=>document.querySelector(`#attendance-filters [name="${field}"]`)?.value==='',field);
      }
      await verify(audience);
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
        if(width<=760)await page.waitForFunction(()=>document.querySelector('#attendance-sidebar').getBoundingClientRect().right<=0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.evaluate(()=>document.getElementById('main').scrollTop=0);
        await page.screenshot({path:path.join(directory,`${audience}-${width}-top.png`)});
        for(const [name,selector]of [['divisions','.attendance-daily-divisions'],['managers','.attendance-daily-managers'],['missed','.attendance-daily-missed']]){
          await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,`${audience}-${width}-${name}.png`)});
        }
        const panels=await page.locator('.attendance-daily-charts>article').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        assert.ok(width>760?panels[1].x>=panels[0].right:panels[1].y>=panels[0].bottom);
        checks.push(audience+'/'+width+'/responsive-daily-layout');
      }
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,checks,errors},null,2));
    console.log(`Passed ${checks.length} daily layout, date, filter, detail and Excel checks.`);
  }catch(error){
    if(page){await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:error.message,checks,errors},null,2));}
    throw error;
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
