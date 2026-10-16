'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR;
(async()=>{
  fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[];
  try {
    const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(90000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    for(const audience of ['rep','merchandiser']){
      await page.goto(base+`/attendance/${audience}/overview`);
      await page.waitForSelector('.attendance-region-groups');await page.evaluate(()=>document.fonts.ready);
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});
        const panels=page.locator('.attendance-region-groups');assert.equal(await panels.count(),2);
        for(let i=0;i<2;i++){
          const panel=panels.nth(i);
          const headings=await panel.locator('h3').allTextContents();
          assert.deepEqual(headings,['CENTRAL','COASTAL','INLAND']);
          const boxes=await panel.locator(':scope>section').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,width:r.width};}));
          for(let n=1;n<boxes.length;n++){
            assert.ok(Math.abs(boxes[n].x-boxes[0].x)<1,'All divisions must share the same left edge');
            assert.ok(Math.abs(boxes[n].width-boxes[0].width)<1,'Divisions must occupy the same full column');
            assert.ok(boxes[n].y>boxes[n-1].bottom,'Divisions must stack without overlap');
          }
          assert.ok(await panel.locator('[data-attendance-detail]').count()>0,'Chart drilldowns retained');
          await panel.locator('..').screenshot({path:path.join(directory,`${audience}-${width}-${i}.png`)});
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        checks.push(`${audience}/${width}/both-regional-charts`);
      }
    }
    assert.deepEqual(errors,[]);
    const response=await fetch(base+'/attendance-layout.css');assert.equal(response.status,200);
    const actual=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    const expected=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../public/attendance-layout.css'))).digest('hex');
    assert.equal(actual,expected,'Published stylesheet must match the checked build');
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),url:base,checks,errors,stylesheetMatches:true},null,2));
    console.log(`Passed ${checks.length} audience/viewport checks: Central, Coastal, Inland stacked in both charts; stylesheet hash matches.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
