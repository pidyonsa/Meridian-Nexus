'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.argv[2],directory=process.env.VIEWER_TEST_RESULTS_DIR;
const key=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const state=row=>row.attended>0?'visited':row.unknownVisits>0?'unknown':'missed';
const rank={missed:0,unknown:1,visited:2};
const expected=(data,query='',status='all')=>data.stores.filter(row=>(status==='all'||state(row)===status)&&[row.storeName,...row.storeCodes,...row.resources,...row.reps].some(value=>key(value).includes(key(query))))
  .sort((a,b)=>rank[state(a)]-rank[state(b)]||a.storeName.localeCompare(b.storeName)||a.storeId.localeCompare(b.storeId));
(async()=>{
  fs.mkdirSync(directory,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[],checks=[];let page;
  try {
    page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(120000);
    let apiCalls=0;page.on('request',r=>{if(r.url().endsWith('/api/attendance'))apiCalls++;});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const report=()=>page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&(!r.request().postDataJSON()?.mode||r.request().postDataJSON().mode==='dashboard'));
    const ready=()=>page.waitForSelector('[data-store-root][data-rows]');
    async function search(query){await page.locator('[data-store-search]').fill(query);await page.waitForFunction(query=>document.querySelector('[data-store-root]')?.dataset.query===query,query);}
    async function select(status){await page.locator(`[data-store-filter="${status}"]`).first().click();await page.waitForFunction(status=>document.querySelector('[data-store-root]')?.dataset.status===status,status);}
    async function verify(data,query='',status='all') {
      const rows=expected(data,query,status),all=expected(data,query),counts=[all.length,...['visited','missed'].map(s=>all.filter(r=>state(r)===s).length)];
      assert.equal(Number(await page.locator('[data-store-root]').getAttribute('data-rows')),rows.length);
      const cards=await page.locator('.attendance-store-kpis strong').allTextContents();assert.equal(cards.length,4);
      assert.deepEqual(cards.slice(0,3).map(s=>Number(s.replace(/\D/g,''))),counts);
      assert.equal(cards[3],all.length?(counts[2]/counts[0]*100).toFixed(1)+'%':'--');
      assert.deepEqual(await page.locator('[data-store-table] tr[data-store-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.storeId)),rows.slice(0,100).map(r=>r.storeId));
      const headers=await page.locator('[data-store-table] thead th').allTextContents();
      const banner=data.availableFilters.banners.length>0;
      assert.deepEqual(headers,['Status','Store',data.audience==='rep'?'Rep':'Merchandiser',...(data.audience==='rep'?[]:['Rep']),'Region',...(banner?['Banner']:[]),data.audience==='rep'?'Manager':'Line / Channel Manager','Missed dates','Target','Actual']);
      const cells=await page.locator('[data-store-table] tr[data-store-id]').evaluateAll(nodes=>nodes.map(n=>[...n.querySelectorAll('td')].slice(-2).map(td=>Number(td.textContent.replace(/\D/g,'')))));
      assert.deepEqual(cells,rows.slice(0,100).map(r=>[r.scheduled,r.attended]));
      const preserved=await page.locator('[data-store-verification] [data-attendance-detail]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.attendanceDetail)));
      if(rows.length)assert.ok(preserved.some(s=>s.store===rows[0].storeId&&s.metric==='missed'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      return rows;
    }
    async function exported(data,query,status,filters) {
      const downloadEvent=page.waitForEvent('download'),validation=report();downloadEvent.catch(()=>{});
      await page.locator('[data-store-export]').click();const response=await validation;
      assert.equal(response.status(),200);const input=response.request().postDataJSON();assert.equal(input.version,data.version);assert.equal(input.refresh,true);assert.deepEqual(input.filters,filters);
      const book=new ExcelJS.Workbook();await book.xlsx.readFile(await(await downloadEvent).path());
      const sheet=book.worksheets[0],rows=expected(data,query,status),headers=sheet.getRow(1).values;
      assert.equal(sheet.rowCount,rows.length+1);
      assert.deepEqual(sheet.getRows(2,rows.length).map(r=>r.getCell(headers.indexOf('Store ID')).value),rows.map(r=>r.storeId));
      assert.deepEqual(sheet.getRows(2,rows.length).map(r=>[r.getCell(headers.indexOf('Target')).value,r.getCell(headers.indexOf('Actual')).value]),rows.map(r=>[r.scheduled,r.attended]));
      const metaSheet=book.getWorksheet('Selection'),meta=Object.fromEntries(metaSheet.getRows(1,metaSheet.rowCount).map(r=>[r.getCell(1).value,r.getCell(2).value]));
      assert.equal(meta.search||'',query);assert.equal(meta.status,status);assert.deepEqual(JSON.parse(meta.filters),filters);assert.equal(meta.version,data.version);
      await page.waitForFunction(()=>!document.querySelector('[data-store-search]').disabled);
    }
    async function drill(button,expectedTotal,filters) {
      const selection=JSON.parse(await button.getAttribute('data-attendance-detail'));
      const responseEvent=page.waitForResponse(r=>r.url().endsWith('/api/attendance')&&r.request().postDataJSON()?.mode==='detail');
      await button.click();const response=await responseEvent;assert.equal(response.status(),200);const result=await response.json();
      assert.deepEqual(response.request().postDataJSON().filters,filters);assert.equal(result.total,expectedTotal);assert.ok(result.rows.every(r=>r.storeId===selection.store));
      await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
    }
    for(const audience of ['rep','merchandiser']) {
      await page.setViewportSize({width:1366,height:900});const initial=report();
      await page.goto(base+`/attendance/${audience}/stores`,{waitUntil:'domcontentloaded'});const response=await initial;assert.equal(response.status(),200);const data=await response.json();await ready();
      const rows=await verify(data);assert.equal(rows.length,data.metrics.totalStores);
      assert.equal(rows.filter(r=>state(r)==='visited').length,data.metrics.visitedStores);assert.equal(rows.filter(r=>state(r)==='missed').length,data.metrics.missedStores);
      assert.equal(await page.locator('h1').innerText(),'Attendance Detail by Store');assert.equal(await page.evaluate(()=>!!window.ExcelJS),false);
      const calls=apiCalls;
      for(const status of ['visited','missed',...(data.metrics.unknownStores?['unknown']:[]),'all']){await select(status);await verify(data,'',status);}
      const rep=rows.find(r=>r.resources.length)?.resources[0];if(rep){const query=' '+rep.toLowerCase()+' ';await search(query);await verify(data,query);}
      await search(rows[0].storeName);await verify(data,rows[0].storeName);
      await search('no-such-store-780998');await verify(data,'no-such-store-780998');assert.equal(await page.locator('[data-store-export]').isDisabled(),true);
      await search('');await verify(data);
      if(rows.length>100){await page.locator('[data-store-page="next"]').click();assert.deepEqual(await page.locator('[data-store-table] tr[data-store-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.storeId)),rows.slice(100,200).map(r=>r.storeId));await page.locator('[data-store-page="previous"]').click();await verify(data);}
      assert.equal(apiCalls,calls,'Search, cards and pagination must not fetch reports');checks.push(audience+'/cards-search-pagination-source-reconciliation');
      await drill(page.locator('[data-store-table] tbody tr[data-store-id] td:nth-last-child(2) button').first(),rows[0].scheduled,{});
      await drill(page.locator('[data-store-table] tbody tr[data-store-id] td:last-child button').first(),rows[0].attended,{});
      await drill(page.locator('[data-store-table] .attendance-store-badge').first(),1,{});checks.push(audience+'/target-actual-status-drilldowns');
      await exported(data,'','all',{});checks.push(audience+'/all-pages-excel');
      console.log(audience+': store cards, source drilldowns and full Excel verified.');
      const manager=data.availableFilters.managers.find(value=>data.stores.some(r=>r.managers.includes(value)));
      if(manager){
        const changed=report(),old=await page.locator('[data-store-root]').elementHandle();await page.locator('#attendance-filters [name="manager"]').selectOption(manager);
        const filtered=await(await changed).json();await page.waitForFunction(node=>!node.isConnected,old);await old.dispose();await ready();await verify(filtered);
        const candidate=expected(filtered)[0],query=candidate.storeName,selected=state(candidate);await search(query);await select(selected);await verify(filtered,query,selected);await exported(filtered,query,selected,{manager});
        await drill(page.locator('[data-store-table] tbody tr[data-store-id] td:nth-last-child(2) button').first(),candidate.scheduled,{manager});
        checks.push(audience+'/manager-search-status-excel-and-drilldown');
        await page.locator('#report-tabs a[href$="/overview"]').click();await page.waitForSelector('.attendance-overview-charts');await page.locator('#report-tabs a[href$="/stores"]').click();await ready();await verify(filtered,query,selected);checks.push(audience+'/tab-return-selection-preserved');
        const reset=report(),oldRoot=await page.locator('[data-store-root]').elementHandle();await page.locator('#attendance-filters button[type="reset"]').click();await reset;await page.waitForFunction(node=>!node.isConnected,oldRoot);await oldRoot.dispose();await ready();await verify(data);
      }
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
        if(width<=760)await page.waitForFunction(()=>document.querySelector('#attendance-sidebar').getBoundingClientRect().right<=0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.evaluate(()=>document.getElementById('main').scrollTop=0);await page.screenshot({path:path.join(directory,`${audience}-${width}.png`)});
        const cards=await page.locator('.attendance-store-kpis article').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        assert.ok(width>760?cards[3].x>=cards[2].right:cards[2].y>=cards[0].bottom);
        const searchBox=await page.locator('[data-store-search]').boundingBox(),exportBox=await page.locator('[data-store-export]').boundingBox();
        assert.ok(exportBox.x>=searchBox.x+searchBox.width||exportBox.y>=searchBox.y+searchBox.height);
        if(width===1366&&!data.availableFilters.banners.length){
          const actual=await page.locator('[data-store-table] thead th').last().boundingBox(),wrap=await page.locator('[data-store-table] .pg-source-table-wrap').boundingBox();
          assert.ok(actual.x+actual.width<=wrap.x+wrap.width,'Actual must be visible without sideways scrolling at desktop width');
        }
        checks.push(audience+'/'+width+'/responsive-layout');
      }
      let unexpectedDownloads=0;const countDownload=()=>unexpectedDownloads++;
      const mismatch=async route=>{const body=route.request().postDataJSON();if(body.version&&body.refresh)await route.fulfill({contentType:'application/json',body:JSON.stringify({version:'changed-version'})});else await route.continue();};
      await page.route('**/api/attendance',mismatch);page.on('download',countDownload);
      await page.locator('[data-store-export]').click();await page.waitForFunction(()=>document.querySelector('[data-store-status]')?.textContent.includes('Attendance refreshed'));
      assert.equal(unexpectedDownloads,0);await page.unroute('**/api/attendance',mismatch);page.off('download',countDownload);checks.push(audience+'/changed-source-export-blocked');
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({at:new Date().toISOString(),base,checks,errors},null,2));console.log(`Passed ${checks.length} store checks.`);
  }catch(error){if(page){await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:error.message,checks,errors},null,2));}throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
