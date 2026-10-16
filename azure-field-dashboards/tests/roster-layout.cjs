'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR;
const key=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const scheduled=r=>!r.noSchedule&&r.scheduled>0;
const expected=(data,query='')=>data.rows.filter(r=>key(r.userName).includes(key(query))).sort((a,b)=>Number(scheduled(b))-Number(scheduled(a))||(scheduled(a)?a.strikeRate-b.strikeRate:0)||a.userName.localeCompare(b.userName)||String(a.manager||'').localeCompare(String(b.manager||'')));
(async()=>{
  fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[];let page;
  try {
    page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(120000);
    let apiCalls=0;page.on('request',r=>{if(r.url().endsWith('/api/attendance'))apiCalls++;});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const report=()=>page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&(!r.request().postDataJSON()?.mode||r.request().postDataJSON().mode==='dashboard'));
    const ready=()=>page.waitForSelector('[data-roster-root][data-rows]');
    async function search(query){await page.locator('[data-roster-search]').fill(query);await page.waitForFunction(query=>document.querySelector('[data-roster-root]')?.dataset.query===query,query);}
    async function verify(data,query='') {
      const rows=expected(data,query),visible=rows.slice(0,100);
      assert.equal(Number(await page.locator('[data-roster-root]').getAttribute('data-rows')),rows.length);
      assert.equal(await page.locator('.attendance-roster-kpis article').count(),4);
      assert.deepEqual(await page.locator('[data-roster-table] tr[data-roster-person]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rosterPerson)),visible.map(r=>key(r.userCode||r.userName)));
      assert.equal(Number((await page.locator('.attendance-roster-kpis strong').first().innerText()).replace(/\D/g,'')),new Set(rows.map(r=>key(r.userCode||r.userName))).size);
      const headers=await page.locator('[data-roster-table] thead th').allTextContents();
      assert.deepEqual(headers,[data.audience==='rep'?'Rep':'Merchandiser',...(data.audience==='rep'?[]:['Rep']),'Region','Manager','Stores','Target','Actual','Progress']);
      const percentages=await page.locator('[data-roster-table] .attendance-roster-progress b').allTextContents();
      assert.deepEqual(percentages,visible.filter(scheduled).map(r=>r.strikeRate.toFixed(1)+'%'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      return rows;
    }
    async function exported(data,query,filters) {
      const downloadEvent=page.waitForEvent('download'),validation=report();
      downloadEvent.catch(()=>{});
      await page.locator('[data-roster-export]').click();
      const response=await validation;assert.equal(response.status(),200);const request=response.request().postDataJSON();
      assert.equal(request.version,data.version);assert.equal(request.refresh,true);assert.deepEqual(request.filters,filters);
      const download=await downloadEvent,book=new ExcelJS.Workbook();await book.xlsx.readFile(await download.path());
      const sheet=book.worksheets[0],rows=expected(data,query);assert.equal(sheet.rowCount,rows.length+1);
      assert.deepEqual(sheet.getRows(2,rows.length).map(r=>r.getCell(2).value),rows.map(r=>r.userCode||''));
      assert.deepEqual(sheet.getRows(2,rows.length).map(r=>r.getCell(1).value),rows.map(r=>r.userName));
      const metaSheet=book.getWorksheet('Selection'),meta=Object.fromEntries(metaSheet.getRows(1,metaSheet.rowCount).map(r=>[r.getCell(1).value,r.getCell(2).value]));
      assert.equal(meta.search||'',query);assert.deepEqual(JSON.parse(meta.filters),filters);assert.equal(meta.version,data.version);
      await page.waitForFunction(()=>!document.querySelector('[data-roster-search]').disabled);
    }
    for(const audience of ['rep','merchandiser']) {
      await page.setViewportSize({width:1366,height:900});const responsePromise=report();
      await page.goto(base+`/attendance/${audience}/users`,{waitUntil:'domcontentloaded'});const response=await responsePromise;assert.equal(response.status(),200);const data=await response.json();await ready();
      const rows=await verify(data);console.log(audience+': roster cards, order and progress verified.');
      assert.equal(await page.evaluate(()=>!!window.ExcelJS),false,'Excel is not loaded until export');
      const calls=apiCalls,query=' '+rows.find(scheduled).userName.toLowerCase()+' ';
      await search(query);await verify(data,query);assert.equal(apiCalls,calls,'Name search must not fetch reports');
      await search('no-such-person-908172');await verify(data,'no-such-person-908172');assert.equal(await page.locator('[data-roster-export]').isDisabled(),true);assert.match(await page.locator('[data-roster-table]').innerText(),/No records match/);
      await search('');await verify(data);
      if(rows.length>100){
        await page.locator('[data-roster-page="next"]').click();
        assert.deepEqual(await page.locator('[data-roster-table] tr[data-roster-person]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rosterPerson)),rows.slice(100,200).map(r=>key(r.userCode||r.userName)));
        await page.locator('[data-roster-page="previous"]').click();await verify(data);assert.equal(apiCalls,calls);
      }
      checks.push(audience+'/search-empty-pagination-no-refetch');
      const progress=page.locator('[data-roster-table] .attendance-roster-progress').first(),selection=JSON.parse(await progress.getAttribute('data-attendance-detail'));
      const detailResponse=page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&r.request().postDataJSON()?.mode==='detail');await progress.click();const details=await(await detailResponse).json();
      assert.equal(details.total,rows.find(scheduled).scheduled);assert.ok(details.rows.every(r=>key(r.userCode||r.userName)===key(selection.person)&&key(r.manager)===key(selection.lineManager)));
      await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();checks.push(audience+'/progress-drilldown');
      await exported(data,'',{});checks.push(audience+'/all-filtered-rows-excel');console.log(audience+': complete roster Excel and source drilldown verified.');
      const manager=data.availableFilters.managers.find(value=>data.rows.some(r=>r.manager===value&&scheduled(r)));
      if(manager){
        const changed=report(),old=await page.locator('[data-roster-root]').elementHandle();await page.locator('#attendance-filters [name="manager"]').selectOption(manager);
        const filtered=await(await changed).json();await page.waitForFunction(node=>!node.isConnected,old);await old.dispose();await ready();await verify(filtered);
        const name=filtered.rows.find(scheduled).userName;await search(name);await verify(filtered,name);await exported(filtered,name,{manager});checks.push(audience+'/manager-plus-name-excel');
        const resetReport=report(),beforeReset=await page.locator('[data-roster-root]').elementHandle();await page.locator('#attendance-filters button[type="reset"]').click();await resetReport;
        await page.waitForFunction(node=>!node.isConnected,beforeReset);await beforeReset.dispose();await ready();assert.equal(await page.locator('[data-roster-search]').inputValue(),'');await verify(data);
      }
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
        if(width<=760)await page.waitForFunction(()=>document.querySelector('#attendance-sidebar').getBoundingClientRect().right<=0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.evaluate(()=>document.getElementById('main').scrollTop=0);await page.screenshot({path:path.join(directory,`${audience}-${width}.png`)});
        const cards=await page.locator('.attendance-roster-kpis article').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        assert.ok(width>760?cards[3].x>=cards[2].right:cards[2].y>=cards[0].bottom);
        const searchBox=await page.locator('[data-roster-search]').boundingBox(),exportBox=await page.locator('[data-roster-export]').boundingBox();
        assert.ok(exportBox.x>=searchBox.x+searchBox.width||exportBox.y>=searchBox.y+searchBox.height);
        checks.push(audience+'/'+width+'/responsive-layout');
      }
      let unexpectedDownloads=0;const countDownload=()=>unexpectedDownloads++;
      const mismatch=async route=>{const body=route.request().postDataJSON();if(body.version&&body.refresh)await route.fulfill({contentType:'application/json',body:JSON.stringify({version:'newer-source-version'})});else await route.continue();};
      await page.route('**/api/attendance',mismatch);page.on('download',countDownload);
      await page.locator('[data-roster-export]').click();await page.waitForFunction(()=>document.querySelector('[data-roster-status]')?.textContent.includes('Attendance refreshed'));
      assert.equal(unexpectedDownloads,0);await page.unroute('**/api/attendance',mismatch);page.off('download',countDownload);checks.push(audience+'/changed-version-export-blocked');
      console.log(audience+': manager, name search, export and responsive checks passed.');
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,checks,errors},null,2));
    console.log(`Passed ${checks.length} roster checks.`);
  }catch(error){
    if(page){await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:error.message,checks,errors},null,2));}
    throw error;
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
