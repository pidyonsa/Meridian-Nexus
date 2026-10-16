'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const express=require('../../azure-nexus/node_modules/express');
const {MemoryStore}=require('../../azure-nexus/server/store.cjs');
const {appFor}=require('../../azure-nexus/server/main.cjs');
const {service}=require('../../azure-nexus/server/analytics.cjs');
const {seed}=require('../../azure-nexus/tests/fixtures.cjs');
const {createHandler}=require('../backend/handler.cjs');
const PORTAL='https://meridian-group-za.github.io/Meridian-Nexus/portal.html';

(async()=>{
  const servers=[],targets=[],checks=[],errors=[];
  const directory=process.env.VIEWER_TEST_RESULTS_DIR?path.join(process.env.VIEWER_TEST_RESULTS_DIR,'portal-navigation'):path.resolve(__dirname,'../test-results/portal-navigation');
  fs.mkdirSync(directory,{recursive:true});
  let browser;
  async function listen(app){
    const server=app.listen(0,'127.0.0.1');servers.push(server);
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    return `http://127.0.0.1:${server.address().port}`;
  }
  try{
    const flag=process.argv.indexOf('--url');
    if(flag>=0){
      assert.ok(process.argv[flag+1],'--url requires a public dashboard URL');
      targets.push({name:'live-public',url:process.argv[flag+1]});
    }else{
      const store=new MemoryStore();await seed(store);
      targets.push({name:'azure',url:await listen(appFor(store,{NODE_ENV:'development',NEXUS_PREVIEW:'true'}))});
      const app=express(),handler=createHandler(service(store),{enabled:()=>true});
      app.use(express.json());
      app.use((req,res,next)=>req.path.startsWith('/api/')?handler(req,res):next());
      app.use(express.static(path.resolve(__dirname,'../dist')));
      app.use((req,res)=>/^\/(attendance|franchise-orders)(\/|$)/.test(req.path)||req.path==='/'?res.sendFile(path.resolve(__dirname,'../dist/index.html')):res.status(404).send('Not found'));
      targets.push({name:'public',url:await listen(app)});
    }
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    for(const target of targets)for(const width of [1366,390,320]){
      const page=await browser.newPage({viewport:{width,height:900}});
      page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(`${target.name}/${width}: ${e.message}`));
      page.on('console',m=>{if(m.type()==='error')errors.push(`${target.name}/${width}: ${m.text()}`);});
      // Intercept only the destination page, never authenticate to or alter the real portal.
      await page.route(PORTAL,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Portal navigation test</title><link rel="icon" href="data:,"><main>Destination reached</main>'}));
      const routes=target.name==='azure'?['/#attendance/merchandiser/stores','/#orders/overview']:['/attendance/merchandiser/stores','/franchise-orders/overview'];
      for(const [index,route] of routes.entries()){
        const links=['.brand[data-portal-home]','nav [data-portal-home]','footer [data-portal-back]'];
        if(width<760)links.push('.mobile-bar [data-portal-home]','.mobile-bar [data-portal-back]');
        for(const [linkIndex,selector] of links.entries()){
          await page.goto(target.url+route);
          try{
            await page.waitForSelector(index?'.fo-results':'.attendance-analytics');
          }catch(error){
            const failure={at:new Date().toISOString(),target:target.name,width,route,selector,url:page.url(),errors:[...errors],notice:await page.locator('.page-message[role="alert"], .fo-error').allTextContents()};
            fs.writeFileSync(path.join(directory,'navigation-failure.json'),JSON.stringify(failure,null,2));
            await page.screenshot({path:path.join(directory,'navigation-failure.png')});
            throw error;
          }
          const destinations=await page.locator('[data-portal-home], [data-portal-back]').evaluateAll(anchors=>anchors.map(a=>({url:a.href,target:a.target,current:a.getAttribute('aria-current')})));
          assert.equal(destinations.length,5);
          assert.ok(destinations.every(a=>a.url===PORTAL&&!a.target&&!a.current),'All portal links must use the fixed destination in the same tab');
          if(width<760&&!selector.startsWith('.mobile-bar')){
            await page.locator('#nav-toggle').click();
            await page.waitForFunction(()=>document.getElementById('sidebar').getBoundingClientRect().left>=-1);
          }
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Navigation overflow ${target.name}/${width}`);
          if(linkIndex===0){
            await page.evaluate(()=>document.fonts.ready);
            await page.screenshot({path:path.join(directory,`${target.name}-${index?'orders':'attendance'}-${width}.png`)});
          }
          if(selector==='.mobile-bar [data-portal-back]')await page.screenshot({path:path.join(directory,`${target.name}-${index?'orders':'attendance'}-${width}-closed.png`)});
          await page.locator(selector).click();
          await page.waitForURL(PORTAL);
          assert.equal(page.url(),PORTAL);
          checks.push(`${target.name}/${width}/${index?'orders':'attendance'}/${selector}`);
        }
      }
      await page.goto(target.url+routes[1]);
      await page.waitForSelector('.fo-kpis');
      await page.locator('[data-fo-total]').first().click();
      const previous=page.locator('[data-fo-action="back"]');
      await previous.waitFor();
      assert.equal((await previous.innerText()).trim(),'Previous selection');
      await previous.click();
      await previous.waitFor({state:'detached'});
      assert.equal(new URL(page.url()).origin,new URL(target.url).origin,'Restoring a report selection must not leave the dashboard');
      checks.push(`${target.name}/${width}/previous-selection`);
      await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(directory,process.argv.includes('--url')?'live-verification.json':'local-verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),destination:PORTAL,destinationIntercepted:true,checks,errors},null,2));
    console.log(`Passed ${checks.length} portal-link and previous-selection checks at desktop, mobile and narrow mobile widths. Destination navigation was intercepted; no real portal state was changed.`);
  }finally{
    await browser?.close();
    for(const server of servers)await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
