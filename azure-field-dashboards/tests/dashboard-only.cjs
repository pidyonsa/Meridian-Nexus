'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR;
const portal='https://meridian-group-za.github.io/Meridian-Nexus/portal.html';
const attendance={overview:'MTD Overview',daily:'Daily Visit Log',users:'Roster',stores:'Attendance Detail by Store'};
const orders={overview:'Executive Overview',trend:'Trend Analysis',regions:'Regional Performance',products:'Product Performance',stores:'Store Performance',reps:'Rep Performance',orders:'Order Detail'};
(async()=>{
  assert.ok(base&&directory);fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[],responses=[];let activePage;
  try{
    for(const width of [1366,390,320]){
      const page=await browser.newPage({viewport:{width,height:900}});activePage=page;page.setDefaultTimeout(90000);
      page.on('response',r=>{if(r.url().includes('/api/'))responses.push({url:r.url(),status:r.status(),request:r.request().postDataJSON()});});
      page.on('requestfailed',r=>errors.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route(portal,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><title>Portal destination</title>'}));
      async function layout(){
        const isAttendance=new URL(page.url()).pathname.startsWith('/attendance');
        const sidebar=page.locator('#attendance-sidebar');
        if(!isAttendance||width<=760)await sidebar.waitFor({state:'hidden'});
        assert.equal(await sidebar.isVisible(),isAttendance&&width>760);
        const left=width>760?(isAttendance?196:244):0;
        const box=await page.locator('#main').boundingBox();assert.equal(box.x,left);assert.equal(box.width,width-left);
        if(isAttendance||width<=760)await page.locator('#orders-sidebar').waitFor({state:'hidden'});
        assert.equal(await page.locator('#orders-sidebar').isVisible(),!isAttendance&&width>760);
        if(isAttendance){
          const shellText=await page.locator('#attendance-sidebar,.attendance-header').allTextContents();
          assert.doesNotMatch(shellText.join(' '),/franchise|P&G/i);
          assert.equal(await page.locator('a[href^="/franchise-orders"]').count(),0);
          assert.equal(await page.locator('#attendance-sidebar #report-tabs a').count(),4);
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.locator('iframe,input[type=password]').count(),0);
        assert.equal(await page.locator('a[href$="/exclusions"],.exclusion-list').count(),0);
        const theme=await page.evaluate(()=>{
          const orders=document.querySelector('.fo'),attendance=document.querySelector('.attendance-shell');
          const style=node=>node?getComputedStyle(node):null;
          return orders?{area:'orders',background:style(orders).backgroundColor,accent:style(orders).getPropertyValue('--fo-orange').trim(),kpiBorder:style(orders.querySelector('.fo-kpi'))?.borderLeftWidth,schedule:document.querySelector('.fo-refresh-schedule')?.textContent}
            :{area:'attendance',background:style(attendance).backgroundColor,actual:style(document.querySelector('.pg-source-kpi:nth-child(2)')).getPropertyValue('--pg-accent').trim()};
        });
        if(theme.area==='orders'){
          assert.equal(theme.background,'rgb(8, 27, 52)');assert.equal(theme.accent,'#ec6d25');
          if(theme.kpiBorder)assert.equal(theme.kpiBorder,'3px');assert.ok(['Daily download 06:00 SAST','Azure import snapshot'].includes(theme.schedule));
        }else{assert.equal(theme.background,'rgb(0, 12, 33)');assert.equal(theme.actual,/\/(daily|users|stores)$/.test(new URL(page.url()).pathname)?'#eb543c':'#22c55e');}
      }
      for(const audience of ['rep','merchandiser']){
        await page.goto(base+`/attendance/${audience}/overview`);await page.waitForSelector('.attendance-analytics');
        for(const [view,title]of Object.entries(attendance)){
          if(width<=760)await page.locator('#attendance-nav-toggle').click();
          await page.locator(`#report-tabs a[href="/attendance/${audience}/${view}"]`).click();
          const heading=view==='users'?(audience==='rep'?'Rep Roster':'Merchandiser Roster'):title;
          await page.waitForFunction(title=>document.querySelector('#report-body h1')?.textContent===title,heading);
          await layout();assert.equal(await page.locator('#report-tabs [aria-current="page"]').count(),1);
          if(view==='overview'){
            await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(directory,`${audience}-${width}.png`)});
            await page.locator('[data-attendance-detail]').first().click();await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
            if(width===1366){
              const manager=page.locator('[data-manager-team]').first();await manager.click();
              assert.equal(await page.locator('.attendance-team-directory').getAttribute('open'),'');
              assert.equal(await page.locator('.attendance-team[open]').count(),1);
              await page.locator('.attendance-team-directory>summary').click();
              await page.locator('.attendance-manager-scorecard').scrollIntoViewIfNeeded();
              await page.screenshot({path:path.join(directory,`${audience}-managers-${width}.png`)});
              const weekly=page.locator('.attendance-weekly');await weekly.scrollIntoViewIfNeeded();
              assert.ok(await weekly.locator('tbody tr').count()>0);
              await page.screenshot({path:path.join(directory,`${audience}-weekly-${width}.png`)});
              const cell=weekly.locator('[data-attendance-detail]').filter({hasText:'%'}).last();
              const selection=JSON.parse(await cell.getAttribute('data-attendance-detail'));
              const response=page.waitForResponse(r=>r.url().includes('/api/attendance')&&r.request().postDataJSON()?.mode==='detail');
              await cell.click();const result=await(await response).json();
              assert.equal(result.metric,'target');assert.ok(selection.week);
              await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
              await page.locator('.attendance-visit-totals>summary').click();
              const weeklyMissed=page.locator('.attendance-visit-totals [data-attendance-detail]').filter({hasText:/\d/});
              const preserved=await weeklyMissed.evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.attendanceDetail)));
              assert.ok(preserved.some(s=>s.week&&s.metric==='missed'));
              assert.ok(preserved.some(s=>s.region&&s.metric==='unknown'&&s.unit==='stores'));
              await page.locator('.attendance-visit-totals>summary').click();
            }
            if(width===390){
              await page.locator('#attendance-nav-toggle').click();await page.locator('#attendance-sidebar').waitFor({state:'visible'});
              await page.waitForFunction(()=>Math.abs(document.getElementById('attendance-sidebar').getBoundingClientRect().left)<0.5);
              await page.screenshot({path:path.join(directory,`${audience}-mobile-menu.png`)});
              await page.keyboard.press('Escape');await page.locator('#attendance-sidebar').waitFor({state:'hidden'});
              assert.equal(await page.locator('#attendance-nav-toggle').getAttribute('aria-expanded'),'false');
            }
          }
          checks.push(`${width}/attendance/${audience}/${view}`);
        }
        const other=audience==='rep'?'merchandiser':'rep';
        if(width<=760)await page.locator('#attendance-nav-toggle').click();
        await page.locator(`#audience-switch a[href="/attendance/${other}/stores"]`).click();
        await page.waitForSelector('.attendance-analytics');
        assert.equal(new URL(page.url()).pathname,`/attendance/${other}/stores`);
        assert.equal(await page.locator('#audience-switch [aria-current="true"]').textContent(),other==='rep'?'Reps':'Merchandisers');
      }
      await page.goto(base+'/franchise-orders');await page.waitForSelector('.fo-results');
      for(const [view,title]of Object.entries(orders)){
        if(width<=760)await page.locator('#orders-nav-toggle').click();
        await page.locator(`#report-tabs a[href="/franchise-orders/${view}"]`).click();
        assert.equal(await page.locator('#report-body h1').innerText(),title);
        await layout();assert.equal(await page.locator('#audience-switch').isVisible(),false);
        assert.equal(await page.locator('#report-tabs [aria-current="page"]').count(),1);
        if(view==='overview'){
          assert.ok(await page.locator('.fo-chart-point').count());await page.screenshot({path:path.join(directory,`orders-${width}.png`)});
          await page.locator('[data-fo-total]').first().click();await page.waitForSelector('.fo-table-section');
          const previous=page.locator('[data-fo-action="back"]');await previous.click();await previous.waitFor({state:'detached'});
        }
        checks.push(`${width}/orders/${view}`);
      }
      await page.goBack();assert.equal(new URL(page.url()).pathname,'/franchise-orders/reps');
      assert.equal((await page.locator('#report-tabs [aria-current="page"]').textContent()).trim(),'Reps');
      if(width<=760)await page.locator('#orders-nav-toggle').click();
      await page.locator('[data-portal-home]').click();await page.waitForURL(portal);
      checks.push(`${width}/history-and-home`);
      await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(directory,'dashboard-only-verification.json'),JSON.stringify({at:new Date().toISOString(),url:base,checks,errors},null,2));
    console.log(`Passed ${checks.length} view/navigation checks; isolated Attendance and Orders sidebars, no page overflow or browser errors.`);
  }catch(error){
    const failure={at:new Date().toISOString(),error:error.message,checks,errors,responses};
    if(activePage&&!activePage.isClosed()){failure.page=await activePage.locator('body').innerText().catch(()=>null);await activePage.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});}
    fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify(failure,null,2));throw error;
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
