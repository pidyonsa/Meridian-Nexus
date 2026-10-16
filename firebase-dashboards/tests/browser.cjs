'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const backendRequire=require('node:module').createRequire(path.resolve(__dirname,'../backend/package.json'));
const express=backendRequire('express');
const {MemoryStore}=require('../../azure-nexus/server/store.cjs');
const {service}=require('../../azure-nexus/server/analytics.cjs');
const {seed}=require('../../azure-nexus/tests/fixtures.cjs');
const {createHandler}=require('../backend/handler.cjs');
(async()=>{
  let server,browser;
  const directory=process.env.VIEWER_TEST_RESULTS_DIR||path.resolve(__dirname,'../test-results');fs.mkdirSync(directory,{recursive:true});
  let url=process.env.PUBLIC_VIEWER_URL||(process.argv.includes('--url')?process.argv[process.argv.indexOf('--url')+1]:null);
  if(!url){
    const store=new MemoryStore();await seed(store);
    const app=express();app.use(express.json());
    const handler=createHandler(service(store),{enabled:()=>true});
    app.use((req,res,next)=>req.path.startsWith('/api/')?handler(req,res):next());
    app.use(express.static(path.resolve(__dirname,'../dist')));
    app.use((req,res)=>/^\/(attendance|franchise-orders)(\/|$)/.test(req.path)||req.path==='/'?res.sendFile(path.resolve(__dirname,'../dist/index.html')):res.status(404).send('Not found'));
    server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));url=`http://127.0.0.1:${server.address().port}`;
  }
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const errors=[],counts=[];
    for(const size of [{width:1366,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport:size});page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      const open=async route=>{await page.goto(`${url}${route}`);assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('input[type=password]').count(),0);};
      for(const audience of ['rep','merchandiser'])for(const tab of ['overview','daily','users','stores']){
        await open(`/attendance/${audience}/${tab}`);await page.waitForSelector('.attendance-analytics');
        assert.equal(await page.locator('#main h1').innerText(),({overview:'MTD Overview',daily:'Daily Visits',users:'Roster',stores:'Attendance by Store'})[tab]);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Attendance overflow ${size.width}/${audience}/${tab}`);
        const drill=page.locator('[data-attendance-detail]').first();await drill.click();await page.waitForSelector('.attendance-drilldown table');
        assert.ok(!(await page.locator('.attendance-drilldown').innerText()).includes('undefined'));
        await page.locator('[data-attendance-close]').click();
        if(tab==='overview'&&audience==='rep'){
          await page.evaluate(()=>document.getElementById('main').scrollTop=0);await page.screenshot({path:path.join(directory,`attendance-${size.width}.png`)});
        }
        counts.push(`${size.width}/attendance/${audience}/${tab}`);
      }
      for(const tab of ['overview','trend','regions','products','stores','reps','orders']){
        await open(`/franchise-orders/${tab}`);await page.waitForSelector('.fo-results');
        await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')!=='true');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Orders overflow ${size.width}/${tab}`);
        assert.ok(!(await page.locator('#main').innerText()).includes('NaN'));
        if(tab==='overview'||tab==='trend')assert.ok(await page.locator('.fo-chart-point').count()>0,`Missing chart ${tab}`);
        if(tab==='overview'){
          await page.screenshot({path:path.join(directory,`orders-${size.width}.png`)});
          await page.locator('[data-fo-total]').first().click();await page.waitForSelector('.fo-table-section');
        }
        counts.push(`${size.width}/orders/${tab}`);
      }
      await open('/attendance');await page.waitForSelector('.attendance-analytics');
      if(size.width<760)await page.locator('#nav-toggle').click();
      await page.locator('#attendance-tree > summary').click();await page.locator('.audience > summary').first().click();
      const requests=[];page.on('request',r=>{if(r.url().endsWith('/api/attendance'))requests.push(r.url());});
      await page.locator('a[href="/attendance/rep/users"]').click();await page.waitForFunction(()=>document.querySelector('#main h1')?.textContent==='Roster');
      assert.equal(requests.length,0,'Tab navigation must reuse cached attendance');
      if(size.width>760){const before=await page.locator('#sidebar').boundingBox();await page.evaluate(()=>document.getElementById('main').scrollTop=500);assert.deepEqual(await page.locator('#sidebar').boundingBox(),before);}
      assert.equal(await page.locator('#attendance-nav a, #orders-nav a').count(),15);
      await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(directory,'browser-verification.json'),JSON.stringify({url,checkedAt:new Date().toISOString(),counts,errors},null,2));
    console.log(`Passed ${counts.length} dashboard/viewport combinations, drilldowns, charts, cached navigation and independent scrolling; no page or console errors.`);
  }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
