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
  let url=process.argv.includes('--url')?process.argv[process.argv.indexOf('--url')+1]:null;
  const directory=path.resolve(__dirname,'../test-results');fs.mkdirSync(directory,{recursive:true});
  try {
    if(!url){
      const store=new MemoryStore();await seed(store);
      const app=express();app.use(express.json());
      const handler=createHandler(service(store),{enabled:()=>true});
      app.use((req,res,next)=>req.path.startsWith('/api/')?handler(req,res):next());
      app.use(express.static(path.resolve(__dirname,'../dist')));
      app.get('/franchise-orders',(_,res)=>res.sendFile(path.resolve(__dirname,'../dist/index.html')));
      server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      url=`http://127.0.0.1:${server.address().port}`;
    }
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const errors=[],checked=[];
    for(const width of [320,390,768,1280,1366,1920]){
      const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto(`${url}/franchise-orders`);
      const idle=()=>page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
      await idle();await page.evaluate(()=>document.fonts.ready);
      const fields=page.locator('.fo-period-fields');
      assert.deepEqual(await fields.locator('label>span').allTextContents(),['Reporting period','From','To']);
      assert.equal(await page.locator('.fo-filter-grid [data-fo-date]').count(),0);
      assert.deepEqual(await page.locator('.fo-filter-grid select').evaluateAll(nodes=>nodes.map(n=>n.dataset.foFilter)),['manager','banner','region','rep','storeName','product','status']);
      assert.equal(await page.locator('.fo-extra [data-fo-filter="manager"],.fo-extra [data-fo-filter="banner"]').count(),0);
      if(width<641)await page.locator('[data-fo-action="filters"]').click();
      const period=await fields.locator('select').boundingBox();
      const start=await fields.locator('[data-fo-date="start"]').boundingBox();
      const end=await fields.locator('[data-fo-date="end"]').boundingBox();
      assert.ok(Math.abs(start.y-end.y)<1,'Dates must align');
      assert.ok(start.x+start.width<=end.x,'Dates must not overlap');
      if(width>640){assert.ok(Math.abs(period.y-start.y)<1,'Dates must align with period');assert.ok(period.x+period.width<=start.x);}
      else assert.ok(period.y+period.height<start.y,'Mobile dates must wrap below period');
      const boxes=await page.locator('.fo-filter-grid select').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};}));
      if(width>1250)assert.ok(boxes.every(r=>Math.abs(r.y-boxes[0].y)<1),'Main filters must share one desktop row');
      assert.ok(boxes.every(r=>r.x>=0&&r.right<=width&&r.width>0),'Filter controls must fit viewport');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow');
      assert.equal(await page.locator('.fo-filter-band').evaluate(n=>n.scrollWidth>n.clientWidth),false,'No filter band overflow');
      await page.screenshot({path:path.join(directory,`orders-filters-${width}.png`)});
      if(width===390||width===1366){
        const choose=async(key)=>{
          const input=page.locator(`[data-fo-filter="${key}"]`);
          const value=await input.locator('option').nth(1).getAttribute('value');assert.ok(value);
          await input.selectOption(value);await idle();
          assert.equal(await page.locator(`[data-fo-filter="${key}"]`).inputValue(),value);
          assert.ok((await page.locator('.fo-active-filters').innerText()).includes(value));
        };
        await choose('manager');await choose('banner');
        const from=await page.locator('[data-fo-date="start"]').inputValue();
        const to=await page.locator('[data-fo-date="end"]').inputValue();
        const shorter=from.slice(0,8)+'02';
        await page.locator('[data-fo-date="start"]').fill(shorter);await page.locator('[data-fo-date="start"]').blur();await idle();
        assert.equal(await page.locator('[data-fo-preset]').inputValue(),'custom');
        assert.equal(await page.locator('[data-fo-date="start"]').inputValue(),shorter);
        await page.locator('[data-fo-preset]').selectOption('1');await idle();
        assert.equal(await page.locator('[data-fo-date="start"]').inputValue(),from);
        assert.equal(await page.locator('[data-fo-date="end"]').inputValue(),to);
        await page.locator('[data-fo-action="reset"]').click();await idle();
        assert.equal(await page.locator('[data-fo-filter="manager"]').inputValue(),'');
        assert.equal(await page.locator('[data-fo-filter="banner"]').inputValue(),'');
      }
      checked.push(width);await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(directory,'order-filters-verification.json'),JSON.stringify({url,at:new Date().toISOString(),checked,errors},null,2));
    console.log(`Passed filter layout at ${checked.join(', ')}px; date presets, custom dates, Manager/Banner filtering and reset; no console errors.`);
  } finally {await browser?.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
