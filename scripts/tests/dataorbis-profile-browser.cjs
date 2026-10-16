'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const puppeteer=require('../../functions/node_modules/puppeteer-core');
const {definitions,setupDocument}=require('../setup-dataorbis-sales.cjs');
const root=path.resolve(__dirname,'../..'),portal=process.env.NEXUS_PORTAL_STAGE||path.join(root,'public');
const out=process.env.NEXUS_PROFILE_SCREENSHOTS||path.join(root,'.tmp/dataorbis-sales-20260922/browser');
const read=file=>fs.readFileSync(path.join(portal,file),'utf8').replace(/\r\n/g,'\n');
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    if(req.url==='/styles.css'){res.setHeader('Content-Type','text/css');res.end(read('styles.css'));return;}
    if(req.url==='/extraction-profile.css'){res.setHeader('Content-Type','text/css');res.end(read('extraction-profile.css'));return;}
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {
    browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions','--no-first-run']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'?r.continue():r.abort());
    await page.setViewport({width:1440,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle0'});
    await page.addStyleTag({url:`http://127.0.0.1:${server.address().port}/extraction-profile.css`});
    await page.evaluate(html=>{
      const doc=new DOMParser().parseFromString(html,'text/html'),panel=doc.querySelector('[data-admin-panel="retailers"]');panel.hidden=false;
      const main=document.createElement('main');main.id='adminView';main.className='admin-page view';main.append(panel);document.body.append(main);
      window.elements=Object.fromEntries([...document.querySelectorAll('[id]')].map(e=>[e.id,e]));
      window.state={retailers:[],extractionProfiles:[]};window.syncSalesforceConnectedAppFields=()=>{};
      window.escapeHtml=value=>{const e=document.createElement('span');e.textContent=String(value||'');return e.innerHTML.replaceAll('"','&quot;');};
      window.calls=[];window.callFunction=async(name,data)=>{calls.push({name,data});return {id:data.id};};
      window.subscribeRetailerProfiles=()=>{};
      window.showToast=message=>{window.lastToast=message;};window.friendlyError=e=>e.message;
    },read('index.html'));
    const app=read('app.js');
    for(const name of ['syncExtractionProfileOptions','renderRetailerSetupStatus','resetRetailerForm','editRetailer','hasExtractionSteps']) {
      const value=app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];assert.ok(value,name);await page.addScriptTag({content:value});
    }
    const submit=app.match(/elements\.retailerForm\.addEventListener\("submit", async \(event\) => \{[^]*?\n\}\);/)?.[0];assert.ok(submit);await page.addScriptTag({content:submit});
    const profiles=process.env.NEXUS_DATAORBIS_CLIENT_PLAN
      ?JSON.parse(fs.readFileSync(process.env.NEXUS_DATAORBIS_CLIENT_PLAN,'utf8')).map(p=>({id:p.id,...p.profile,...p.patch}))
      :definitions.map(d=>({id:d.id,...setupDocument(d,'a'.repeat(64))}));
    await page.evaluate(profiles=>{state.retailers=profiles;},profiles);
    for(const profile of profiles) {
      await page.evaluate(id=>editRetailer(id),profile.id);
      assert.equal(await page.$eval('#retailerFormTitle',e=>e.textContent),profile.name);
      assert.equal(await page.$eval('#retailerWebAddress',e=>e.value),'https://pyramid.dataorbis.com');
      assert.equal(await page.$eval('#retailerPassword',e=>e.value),'');assert.equal(await page.$eval('#retailerPassword',e=>e.type),'password');
      assert.match(await page.$eval('#retailerSetupStatus',e=>e.textContent),/not configured/);
      assert.equal(await page.evaluate(id=>hasExtractionSteps(state.retailers.find(p=>p.id===id)),profile.id),false);
      await page.$eval('#retailerSalesProcedure',e=>{e.open=true;});
      assert.equal(await page.$$eval('#retailerSalesProcedure li',items=>items.length),10);
      for(const width of [1440,390,320]) {
        await page.setViewport({width,height:1000});
        for(const selector of ['#retailerSetupStatus','#retailerSalesProcedure','#retailerForm']) {
          const size=await page.$eval(selector,e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(size.client>0 && size.scroll<=size.client+1,`${selector} overflows at ${width}`);
        }
        const buttons=await page.$$eval('#retailerForm .form-actions button, #retailerForm > header button',buttons=>buttons.filter(b=>!b.hidden).map(b=>({id:b.id,text:b.textContent,client:b.clientWidth,scroll:b.scrollWidth,height:b.clientHeight,contentHeight:b.scrollHeight})));
        assert.ok(buttons.every(b=>b.scroll<=b.client+1 && b.contentHeight<=b.height+1),`Button labels must fit at ${width}: ${JSON.stringify(buttons)}`);
        await page.screenshot({path:path.join(out,`${profile.id}-${width}.png`),fullPage:true});
      }
      await page.$eval('#retailerUsername',e=>{e.value='synthetic-login';});
      await page.$eval('#retailerWebAddress',e=>{e.value='https://pyramid.dataorbis.com/';});
      await page.$eval('#retailerPassword',e=>{e.value='synthetic-password';});
      const before=await page.evaluate(()=>calls.length);
      await page.click('#retailerForm button[type="submit"]');await page.waitForFunction(n=>calls.length>n,{},before);
      const call=await page.evaluate(()=>calls.at(-1));assert.equal(call.name,'saveRetailer');assert.equal(call.data.id,profile.id);
      assert.equal(call.data.username,'synthetic-login');assert.equal(call.data.password,'synthetic-password');assert.equal(call.data.webAddress,'https://pyramid.dataorbis.com/');
      assert.equal(await page.$eval('#retailerPassword',e=>e.value),'');
      await page.click('#retailerForm button[type="submit"]');assert.equal(await page.evaluate(()=>calls.at(-1).data.password),'');
      await page.evaluate(id=>{const p=state.retailers.find(p=>p.id===id);p.username='synthetic-login';p.credentialsUpdatedAt='2026-09-22';editRetailer(id);},profile.id);
      assert.match(await page.$eval('#retailerSetupStatus',e=>e.textContent),/Credentials saved; login not yet verified/);
    }
    await page.evaluate(()=>resetRetailerForm());assert.equal(await page.$eval('#retailerSalesProcedure',e=>e.hidden),true);
    assert.equal(await page.$$eval('#retailerSalesProcedure li',items=>items.length),0);
    assert.equal(await page.$eval('#retailerSetupStatus',e=>e.hidden),true);assert.deepEqual(errors,[]);
    console.log('Game and Makro profile edits, credential submission/clear/retain, procedure, disabled readiness and 1440/390/320 layouts passed. Synthetic only.');
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
