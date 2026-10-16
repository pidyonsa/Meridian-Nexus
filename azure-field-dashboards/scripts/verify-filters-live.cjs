'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS=require('../../firebase-dashboards/backend/node_modules/exceljs');
const base=process.argv[2],dir=path.resolve(__dirname,'../test-results/all-filters-live');
const cents=n=>Math.round(n*100),ids=rows=>rows.map(r=>r.id).sort();
const fields=['manager','banner','client','region','rep','storeName','product','status','channel','brand','category','currency'];
const cancelled=value=>/^(cancelled|canceled|void|voided)$/i.test(value||'');
const personKey=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
async function api(route,body){
  const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
}
function verifyOrders(data,rows,complete=false){
  assert.equal(data.totals.lines,rows.length);assert.equal(data.table.total,rows.length);
  assert.equal(data.totals.orders,new Set(rows.map(r=>r.orderKey).filter(Boolean)).size);
  if(rows.every(r=>r.value!==null)&&new Set(rows.map(r=>r.currency)).size<=1)assert.equal(cents(data.totals.amount),cents(rows.reduce((s,r)=>s+r.value,0)));
  if(rows.every(r=>r.quantity!==null))assert.equal(data.totals.units,rows.reduce((s,r)=>s+r.quantity,0));
  assert.ok(data.table.rows.every(r=>rows.some(expected=>expected.id===r.id)));
  if(complete)assert.deepEqual(ids(data.table.rows),ids(rows));
  for(const group of [data.trend,data.dailyTrend,...Object.values(data.by)])assert.equal(group.reduce((s,r)=>s+r.lines,0),rows.length);
}
function attendanceMatch(row,filters){return Object.entries(filters).every(([field,value])=>field==='manager'?(row.managerPath||[row.manager]).some(v=>personKey(v)===personKey(value)):personKey(row[field])===personKey(value));}
async function main(){
  assert.equal(new URL(base).protocol,'https:');fs.mkdirSync(dir,{recursive:true});
  const results={at:new Date().toISOString(),url:base,orders:[],attendance:[],errors:[]};
  const ledger=await api('orders',{includeCancelled:true,export:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(90000);
    page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
    const orderIdle=()=>page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
    const responseFor=async(route,action,match=()=>true)=>{
      const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/'+route)&&match(r.request().postDataJSON()||{})),action()]);
      assert.equal(response.status(),200);return response.json();
    };
    await page.goto(base+'/franchise-orders');await orderIdle();
    const reset=async()=>{await page.locator('[data-fo-action="reset"]').click();await orderIdle();};
    for(const field of fields){
      const values=ledger.options[field]||[],input=page.locator(`[data-fo-filter="${field}"]`);
      const optional=['channel','brand','category','currency'].includes(field);
      if(!values.length||(optional&&!values.some(v=>!['Not supplied','Unassigned'].includes(v)))){
        if(optional)assert.equal(await input.count(),0);
        results.orders.push({filter:field,available:false});console.log(`Orders ${field}: no usable source values; unavailable as expected.`);continue;
      }
      if(await input.locator('xpath=ancestor::details').count())await page.locator('.fo-extra>summary').click();
      const value=field==='status'&&values.some(cancelled)?values.find(cancelled):values.find(v=>ledger.table.rows.some(r=>!r.cancelled&&r[field]===v))||values[0];
      const data=await responseFor('orders',()=>input.selectOption(value),body=>body.filters?.[field]===value);await orderIdle();
      const expected=ledger.table.rows.filter(r=>r[field]===value&&(!r.cancelled||(field==='status'&&cancelled(value))));
      verifyOrders(data,expected);assert.equal(await page.locator(`[data-fo-filter="${field}"]`).inputValue(),value);
      const exported=await api('orders',{...data.selection,export:true,version:data.version});verifyOrders(exported,expected,true);
      assert.equal(Number((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,'')),expected.length);
      if(field==='status'&&cancelled(value)){assert.equal(await page.locator('[data-fo-cancelled]').isChecked(),true);assert.equal(await page.locator('[data-fo-cancelled]').isDisabled(),true);}
      results.orders.push({filter:field,available:true,lines:expected.length,ui:true,export:true});console.log(`Verified Orders ${field}: ${expected.length} matching lines and export.`);await reset();
    }
    const included=await responseFor('orders',()=>page.locator('[data-fo-cancelled]').check());await orderIdle();verifyOrders(included,ledger.table.rows);
    results.orders.push({filter:'includeCancelled',lines:included.totals.lines});await reset();
    const sample=ledger.table.rows.find(r=>!r.cancelled&&r.orderNumber&&r.manager&&r.banner&&r.client);assert.ok(sample);
    const search=await responseFor('orders',async()=>{await page.locator('.fo-search input').fill(sample.orderNumber);await page.locator('.fo-search').evaluate(n=>n.requestSubmit());});await orderIdle();
    verifyOrders(search,ledger.table.rows.filter(r=>!r.cancelled&&[r.orderNumber,r.poNumber,r.storeName,r.storeCode,r.product,r.sku,r.rep].join(' ').toLowerCase().includes(sample.orderNumber.toLowerCase())));
    results.orders.push({filter:'search',lines:search.totals.lines});await reset();
    const combined={manager:sample.manager,banner:sample.banner,client:sample.client,brand:sample.client};
    const together=await api('orders',{...ledger.selection,includeCancelled:false,filters:combined,export:true});
    verifyOrders(together,ledger.table.rows.filter(r=>!r.cancelled&&Object.entries(combined).every(([k,v])=>r[k]===v)),true);
    results.orders.push({filter:'manager+banner+client+brand',lines:together.totals.lines});
    const customStart=ledger.selection.start,customEnd=ledger.table.rows.map(r=>r.orderDate).sort()[0];
    const dated=await responseFor('orders',async()=>{await page.locator('[data-fo-date="end"]').fill(customEnd);await page.locator('[data-fo-date="end"]').blur();});await orderIdle();
    verifyOrders(dated,ledger.table.rows.filter(r=>!r.cancelled&&r.orderDate>=customStart&&r.orderDate<=customEnd));
    assert.equal(await page.locator('[data-fo-preset]').inputValue(),'custom');results.orders.push({filter:'customDate',lines:dated.totals.lines});
    for(const months of [3,12]){
      const range=await responseFor('orders',()=>page.locator('[data-fo-preset]').selectOption(String(months)));await orderIdle();
      const [y,m]=range.latestPeriod.split('-').map(Number);assert.equal(range.selection.start,new Date(Date.UTC(y,m-months,1)).toISOString().slice(0,10));
      assert.ok(range.table.rows.every(r=>r.orderDate>=range.selection.start&&r.orderDate<=range.selection.end));
      for(const grouped of [range.trend,...Object.values(range.by)])assert.equal(grouped.reduce((s,r)=>s+r.lines,0),range.totals.lines);
      results.orders.push({filter:`${months}MonthPreset`,lines:range.totals.lines});
    }
    await reset();
    for(const sort of ['oldest','value','quantity']){
      await page.locator('#report-tabs a[href="/franchise-orders/orders"]').click();await orderIdle();
      const sorted=await responseFor('orders',()=>page.locator('[data-fo-sort]').selectOption(sort));await orderIdle();
      const expected=ledger.table.rows.filter(r=>!r.cancelled).sort((a,b)=>(sort==='oldest'?a.orderDate.localeCompare(b.orderDate):sort==='value'?(b.value??-Infinity)-(a.value??-Infinity):(b.quantity??-Infinity)-(a.quantity??-Infinity))||a.id.localeCompare(b.id));
      assert.deepEqual(sorted.table.rows.map(r=>r.id),expected.slice(0,50).map(r=>r.id));results.orders.push({filter:`sort:${sort}`,lines:sorted.totals.lines});
    }
    await reset();assert.equal(await page.locator('[data-fo-preset]').inputValue(),'1');
    await page.screenshot({path:path.join(dir,'orders-desktop.png')});
    fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({...results,passed:false},null,2));
    for(const audience of ['rep','merchandiser']){
      const initial=await responseFor('attendance',()=>page.goto(`${base}/attendance/${audience}/overview`));await page.waitForSelector('.attendance-analytics');
      for(const groups of [initial.charts.byManager,initial.charts.byRegion,initial.charts.byRole])assert.equal(new Set(groups.map(r=>personKey(r.label))).size,groups.length,'Case variants must not split a displayed total');
      const managerGroup=initial.charts.byManager.find(r=>personKey(r.label)==='YOLANDI MOUTON')||initial.charts.byManager.find(r=>r.scheduled>0);
      assert.ok(managerGroup);
      const teamIndex=await page.locator('.attendance-team').evaluateAll((nodes,label)=>nodes.findIndex(n=>n.querySelector('summary span').textContent.trim()===label),managerGroup.label);
      assert.ok(teamIndex>=0);await page.locator('.attendance-team-directory>summary').click();const team=page.locator('.attendance-team').nth(teamIndex);await team.locator('summary').click();
      const teamTarget=team.locator('.attendance-total [data-attendance-detail]').first();
      assert.equal(Number((await teamTarget.innerText()).replace(/\D/g,'')),managerGroup.scheduled);
      const teamDetail=await responseFor('attendance',()=>teamTarget.click(),body=>body.mode==='detail'&&body.selection?.lineManager===managerGroup.label);
      assert.equal(teamDetail.total,managerGroup.scheduled);await page.waitForSelector('.attendance-drilldown table');await page.locator('[data-attendance-close]').click();
      assert.equal(initial.rows.filter(r=>personKey(r.manager)===personKey(managerGroup.label)).reduce((s,r)=>s+(r.scheduled||0),0),managerGroup.scheduled);
      results.attendance.push({audience,filter:'managerScorecardIdentity',scheduled:managerGroup.scheduled,drilldown:true});
      const regionalWeeks=initial.scheduleAnalytics.byRegionWeekly;
      assert.ok(Array.isArray(regionalWeeks),'Regional weekly aggregates must come from the source service');
      assert.equal(regionalWeeks.reduce((s,r)=>s+r.scheduled,0),initial.metrics.scheduled);
      const weeklyCells=regionalWeeks.flatMap(r=>r.weeks.map(w=>({region:r.label,...w}))).filter(w=>w.scheduled>0&&w.scheduled<=10000);
      const weeklyCell=weeklyCells.sort((a,b)=>a.scheduled-b.scheduled)[0];assert.ok(weeklyCell);
      const weeklySelection={region:weeklyCell.region,week:weeklyCell.label,metric:'target'};
      const weeklyDetail=await api('attendance',{audience,mode:'detail',selection:weeklySelection,version:initial.version});
      assert.equal(weeklyDetail.total,weeklyCell.scheduled);
      const weeklyExport=await api('attendance',{audience,mode:'export',selection:weeklySelection,version:initial.version});
      const weeklyBook=new ExcelJS.Workbook();await weeklyBook.xlsx.load(Buffer.from(weeklyExport.base64,'base64'));
      assert.equal(weeklyBook.getWorksheet('Visits').rowCount-1,weeklyCell.scheduled);
      results.attendance.push({audience,filter:'region+weekHeatmap',scheduled:weeklyCell.scheduled,exportedRows:weeklyExport.total});
      const pairs={region:'regions',manager:'managers',division:'divisions',role:'roles',banner:'banners',channel:'channels',brand:'brands'};
      for(const [field,key]of Object.entries(pairs)){
        const values=initial.availableFilters[key]||[],input=page.locator(`#attendance-filters [name="${field}"]`);
        if(!values.length){
          if(['banner','brand','channel'].includes(field))assert.equal(await input.count(),0);else assert.equal(await input.isDisabled(),true);
          results.attendance.push({audience,filter:field,available:false});continue;
        }
        const value=field==='manager'?(initial.rows.find(r=>r.scheduled&&values.includes(r.manager))?.manager||values[0]):values[0];
        const selected=await responseFor('attendance',()=>input.selectOption(value),body=>body.audience===audience&&body.filters?.[field]===value);await page.waitForSelector('.attendance-analytics');
        assert.equal(await page.locator(`#attendance-filters [name="${field}"]`).inputValue(),value);
        const filters={[field]:value};
        const detail=await api('attendance',{audience,mode:'detail',filters,version:selected.version,selection:{metric:'target'}});
        assert.equal(detail.total,selected.metrics.scheduled);assert.ok(detail.rows.every(r=>attendanceMatch(r,filters)));
        if(field!=='manager'){
          const groups=initial.charts[{region:'byRegion',division:'byDivision',role:'byRole'}[field]]?.filter(r=>personKey(r.label)===personKey(value));
          if(groups?.length){assert.equal(selected.metrics.scheduled,groups.reduce((s,r)=>s+r.scheduled,0));assert.equal(selected.metrics.attended,groups.reduce((s,r)=>s+r.attended,0));}
        }
        const day=selected.scheduleAnalytics.daily.at(-1);assert.ok(day);
        const out=await api('attendance',{audience,mode:'export',filters,version:selected.version,selection:{metric:'target',date:day.label}});
        const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(out.base64,'base64'));
        assert.equal(book.getWorksheet('Visits').rowCount-1,day.scheduled);
        const sheet=book.getWorksheet('Visits');for(let n=2;n<=sheet.rowCount;n++)assert.equal(sheet.getCell(n,2).value,day.label);
        results.attendance.push({audience,filter:field,available:true,scheduled:selected.metrics.scheduled,exportedDayRows:day.scheduled});console.log(`Verified ${audience} ${field}: totals, detail and daily Excel.`);
        fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({...results,passed:false},null,2));
        await page.locator('#attendance-filters [type="reset"]').click();await page.waitForSelector('.attendance-analytics');assert.equal(await page.locator(`#attendance-filters [name="${field}"]`).inputValue(),'');
      }
      const row=initial.rows.find(r=>r.scheduled&&r.region&&r.manager);assert.ok(row);
      const filters={region:row.region,manager:row.manager};
      const data=await api('attendance',{audience,filters});
      for(const [metric,count]of [['target','scheduled'],['actual','attended'],['missed','missedVisits']]){
        const details=await api('attendance',{audience,mode:'detail',filters,selection:{metric},version:data.version});
        assert.equal(details.total,data.metrics[count]);assert.ok(details.rows.every(r=>attendanceMatch(r,filters)));
      }
      results.attendance.push({audience,filter:'region+manager',scheduled:data.metrics.scheduled,drilldowns:true});
      // Check daily selection and its exported records after a viewport change as well.
      await page.setViewportSize({width:390,height:900});
      await page.locator('#attendance-nav-toggle').click();
      await page.locator(`#report-tabs a[href="/attendance/${audience}/daily"]`).click();await page.waitForSelector('[data-attendance-date]');
      const day=initial.scheduleAnalytics.daily[0];await page.locator('[data-attendance-date]').selectOption(day.label);
      const next=page.waitForEvent('download');await page.locator('.pg-source-datebar [data-attendance-export]').click();
      const book=new ExcelJS.Workbook();await book.xlsx.readFile(await(await next).path());assert.equal(book.getWorksheet('Visits').rowCount-1,day.scheduled);
      const sheet=book.getWorksheet('Visits');for(let n=2;n<=sheet.rowCount;n++)assert.equal(sheet.getCell(n,2).value,day.label);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(dir,`${audience}-mobile.png`)});results.attendance.push({audience,filter:'dailyDateMobile',exportedDayRows:day.scheduled});
      await page.setViewportSize({width:1366,height:900});
    }
    assert.deepEqual(results.errors,[]);results.passed=true;fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));await page.close();
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
