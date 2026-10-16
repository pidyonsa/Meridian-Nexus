'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});await page.goto('https://meridian-field-dashboards.web.app/franchise-orders');await page.waitForSelector('.fo-results',{timeout:90000});
    await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')!=='true');
    console.log(JSON.stringify(await page.evaluate(()=>({body:document.body.getBoundingClientRect().toJSON(),side:document.getElementById('sidebar').getBoundingClientRect().toJSON(),scroll:document.getElementById('sidebar').scrollTop,children:[...document.getElementById('sidebar').children].map(e=>({tag:e.tagName,box:e.getBoundingClientRect().toJSON(),style:{display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity}}))})),null,2));
    await page.screenshot({path:'test-results/orders-sidebar-check.png'});
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
