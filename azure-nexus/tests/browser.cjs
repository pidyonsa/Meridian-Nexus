'use strict';
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {MemoryStore}=require('../server/store.cjs');
const {appFor}=require('../server/main.cjs');
const {seed}=require('./fixtures.cjs');
(async()=>{
  const store=new MemoryStore();await seed(store);
  const app=appFor(store,{NODE_ENV:'development',NEXUS_PREVIEW:'true'}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const directory=path.join(__dirname,'../test-results');fs.mkdirSync(directory,{recursive:true});
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const errors=[];
    for(const size of [{width:1366,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport:size});
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      for(const audience of ['rep','merchandiser'])for(const tab of ['overview','daily','users','stores']){
        await page.goto(`${url}/#attendance/${audience}/${tab}`);await page.waitForSelector('.attendance-analytics');
        assert.equal(await page.locator('#main h1').innerText(),({overview:'MTD Overview',daily:'Daily Visits',users:'Roster',stores:'Attendance by Store'})[tab]);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Attendance document overflow ${size.width}/${audience}/${tab}`);
        await page.locator('[data-attendance-detail]').first().click();await page.waitForSelector('.attendance-drilldown table');assert.ok(!(await page.locator('.attendance-drilldown').innerText()).includes('undefined'));
        if(tab==='overview' && audience==='rep'){await page.locator('[data-attendance-close]').click();await page.evaluate(()=>document.getElementById('main').scrollTop=0);await page.screenshot({path:path.join(directory,`attendance-${size.width}.png`)});}
      }
      for(const tab of ['overview','trend','regions','products','stores','reps','orders']){
        await page.goto(`${url}/#orders/${tab}`);await page.waitForSelector('.fo-results');
        await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')!=='true');
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        if(overflow){await page.screenshot({path:path.join(directory,'overflow.png')});process.stdout.write(JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).slice(0,20)})))+'\n');}
        assert.equal(overflow,false,`Order document overflow ${size.width}/${tab}`);
        assert.equal(await page.locator('#main').innerText().then(s=>s.includes('NaN')),false);
        if(tab==='overview' || tab==='trend')assert.ok(await page.locator('.fo-chart-point').count()>0,`Missing chart points ${tab}`);
        if(tab==='overview'){
          await page.evaluate(()=>document.getElementById('main').scrollTop=0);
          await page.screenshot({path:path.join(directory,`orders-${size.width}.png`)});
          await page.locator('[data-fo-total]').first().click();await page.waitForSelector('.fo-table-section');
        }
      }
      await page.goto(`${url}/#attendance/rep/overview`);await page.waitForSelector('.attendance-analytics');
      const requests=[];page.on('request',r=>{if(r.url().endsWith('/api/attendance'))requests.push(r.url());});
      await page.goto(`${url}/#attendance/rep/users`);await page.waitForFunction(()=>document.querySelector('#main h1')?.textContent==='Roster');
      assert.equal(requests.length,0,'Attendance tab switch should reuse the validated in-memory snapshot');
      if(size.width>760){
        const before=await page.locator('#sidebar').boundingBox();await page.evaluate(()=>document.getElementById('main').scrollTop=500);const after=await page.locator('#sidebar').boundingBox();assert.deepEqual(after,before,'Sidebar must not move with dashboard scroll');
      }
      await page.goto(`${url}/#orders/overview`);await page.waitForSelector('.fo-results');
      if(size.width<760){await page.locator('#nav-toggle').click();await page.locator('#sources').click();}else await page.locator('#sources').click();
      await page.waitForSelector('#source-status table');assert.ok((await page.locator('#source-status').innerText()).includes('orders'));
      await page.close();
    }
    assert.deepEqual(errors,[]);
    process.stdout.write('Browser checks passed: 30 dashboard/audience/viewport combinations, drilldowns, graphs, imports dialog, no console errors or document overflow.\n');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
