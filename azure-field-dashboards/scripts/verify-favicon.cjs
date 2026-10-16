'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.argv[2],hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
  assert.ok(base&&new URL(base).protocol==='https:');
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const checks=[];
  try{
    const page=await browser.newPage();
    for(const route of ['/attendance','/franchise-orders']){
      await page.goto(base+route,{waitUntil:'domcontentloaded'});
      const icon=page.locator('link[rel="icon"]');assert.equal(await icon.count(),1);
      assert.equal(await icon.getAttribute('href'),'/assets/favicon-32.png?v=20260918');
      const image=await page.evaluate(async()=>{
        const response=await fetch(document.querySelector('link[rel="icon"]').href);
        if(!response.ok)throw Error('Favicon returned '+response.status);
        const bitmap=await createImageBitmap(await response.blob());
        const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;
      });
      assert.deepEqual(image,{width:32,height:32});checks.push(route);
    }
    const response=await fetch(base+'/assets/favicon-32.png?v=20260918');assert.equal(response.status,200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(fs.readFileSync(path.resolve(__dirname,'../../public/assets/icons/favicon-32.png'))));
    const directory=path.resolve(__dirname,'../test-results/favicon');fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,checks,decoded:'32x32 PNG',identicalToMeridianAsset:true},null,2));
    console.log('Both live dashboard links load and decode the matching Meridian favicon.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
