'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url='https://meridian-field-dashboards.web.app',directory=path.resolve(__dirname,'../test-results');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const errors=[],checks=[];
    for(const width of [1366,390])for(const audience of ['rep','merchandiser']){
      const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      const response=page.waitForResponse(r=>r.url().endsWith('/api/attendance'));
      await page.goto(`${url}/attendance/${audience}/daily`);const d=await (await response).json();await page.waitForSelector('.attendance-analytics');
      for(const [field,key] of [['region','regions'],['manager','managers'],['division','divisions'],['role','roles'],['banner','banners'],['channel','channels']]){
        const input=page.locator(`#attendance-filters select[name="${field}"]`);
        if(field==='banner'&&!d.availableFilters[key].length){assert.equal(await input.count(),0,'Banner must be absent without source values');continue;}
        assert.equal(await input.isDisabled(),!d.availableFilters[key].length,field);
        if(!d.availableFilters[key].length)assert.equal(await input.locator('option').innerText(),'Not in source');
      }
      const sample=d.rows.find(r=>r.date&&d.availableFilters.regions.includes(r.region));assert.ok(sample);
      await page.locator('[data-attendance-date]').selectOption(sample.date);
      const changed=page.waitForResponse(r=>r.url().endsWith('/api/attendance'));
      await page.locator('#attendance-filters [name="region"]').selectOption(sample.region);
      const selected=await (await changed).json();await page.waitForSelector('.attendance-analytics');
      assert.equal(await page.locator('[data-attendance-date]').inputValue(),sample.date);
      assert.equal(JSON.parse(await page.locator('.pg-source-datebar [data-attendance-export]').getAttribute('data-attendance-export')).date,sample.date);
      const count=page.locator('.pg-source-kpis [aria-label="Target Visits"]');
      const day=selected.scheduleAnalytics.daily.find(r=>r.label===sample.date);
      assert.equal(Number((await count.innerText()).replace(/\D/g,'')),day.scheduled);
      await count.click();await page.waitForSelector('.attendance-drilldown table');
      const dates=await page.locator('.attendance-drilldown tbody tr td:first-child').allTextContents();assert.ok(dates.every(v=>v===sample.date));
      await page.locator('[data-attendance-close]').click();
      if(width===390)await page.locator('#nav-toggle').click();
      const tree=page.locator('#attendance-tree');if(!await tree.evaluate(n=>n.open))await tree.locator(':scope>summary').click();
      const branch=page.locator('.audience').nth(audience==='rep'?0:1);if(!await branch.evaluate(n=>n.open))await branch.locator(':scope>summary').click();
      await page.locator(`nav a[href="/attendance/${audience}/users"]`).click();await page.waitForSelector('.attendance-analytics');
      assert.equal(await page.locator('#attendance-filters [name="region"]').inputValue(),sample.region,'Filter must survive tab navigation');
      const reset=page.waitForResponse(r=>r.url().endsWith('/api/attendance'));await page.locator('#attendance-filters [type="reset"]').click();await reset;await page.waitForSelector('.attendance-analytics');
      assert.equal(await page.locator('#attendance-filters [name="region"]').inputValue(),'');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(directory,`live-attendance-filters-${audience}-${width}.png`)});
      checks.push(`${width}/${audience}`);await page.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'live-filter-ui.json'),JSON.stringify({url,at:new Date().toISOString(),checks,errors},null,2));
    console.log('Live attendance filter availability, selected-day persistence, drilldowns, tab navigation and reset passed on desktop and mobile for both audiences.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
