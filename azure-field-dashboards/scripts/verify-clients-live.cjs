'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require('../../azure-nexus/node_modules/@playwright/test');
const ExcelJS = require('../../firebase-dashboards/backend/node_modules/exceljs');
const {Readable} = require('node:stream');
const base = process.argv[2];
const dir = path.resolve(__dirname, '../test-results/clients-live');
const cents = value => Math.round(value * 100);
async function orders(body = {}) {
  const start = performance.now();
  const response = await fetch(base + '/api/orders', {method:'POST', headers:{'content-type':'application/json', 'accept-encoding':'gzip'}, body:JSON.stringify(body), signal:AbortSignal.timeout(90000)});
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return {data, ms:Math.round(performance.now()-start), encoding:response.headers.get('content-encoding')};
}
function reconcile(data) {
  const rows = data.table.rows;
  assert.equal(rows.length, data.totals.lines);
  assert.equal(cents(rows.reduce((n,r)=>n+r.value,0)), cents(data.totals.amount));
  assert.equal(rows.reduce((n,r)=>n+r.quantity,0), data.totals.units);
  assert.equal(new Set(rows.map(r=>r.orderKey).filter(Boolean)).size, data.totals.orders);
  for (const grouped of [data.trend, data.dailyTrend, ...Object.values(data.by)]) {
    assert.equal(grouped.reduce((n,r)=>n+r.lines,0), data.totals.lines);
    assert.equal(cents(grouped.reduce((n,r)=>n+r.amount,0)), cents(data.totals.amount));
  }
}
async function main() {
  assert.equal(new URL(base).protocol, 'https:'); fs.mkdirSync(dir,{recursive:true});
  const refreshed = await orders({refresh:true});
  const warm = await orders({});
  assert.equal(warm.encoding, 'gzip');
  const all = (await orders({...warm.data.selection, export:true, version:warm.data.version})).data;
  reconcile(all);
  assert.deepEqual(all.options.client.slice().sort(), ['Danone','SOILL','aQuelle'].sort());
  assert.deepEqual(all.options.brand,all.options.client);
  assert.ok(all.table.rows.every(r=>r.brand===r.client));
  assert.equal(all.clientMapping.unmatched, 0); assert.equal(all.clientMapping.ambiguous, 0);
  assert.equal(all.clientMapping.approvedMappings, 2);
  for (const sku of ['6009612472391','6009612472421']) {
    const rows=all.table.rows.filter(r=>r.sku===sku); assert.ok(rows.length);
    assert.ok(rows.every(r=>r.client==='aQuelle'&&r.clientMatch==='approvedOverride'));
  }
  const baselinePath=path.resolve(__dirname,'../../.tmp/dashboard-performance-clients-20260916/orders-before.json');
  let unchangedLedger=false;
  if(fs.existsSync(baselinePath)) {
    const before=JSON.parse(fs.readFileSync(baselinePath));
    if(before.latestImport===all.latestImport) {
      assert.deepEqual(all.totals,before.totals);
      const unchanged=rows=>rows.map(r=>{const {client,clientMatch,sourceBrand,...rest}=r;return {...rest,brand:sourceBrand??rest.brand};}).sort((a,b)=>a.id.localeCompare(b.id));
      assert.deepEqual(unchanged(all.table.rows),unchanged(before.table.rows)); unchangedLedger=true;
    }
  }
  const clients=[];
  for(const client of all.options.client) {
    const result=await orders({...all.selection,filters:{client},export:true,version:all.version});
    reconcile(result.data);assert.ok(result.data.table.rows.every(r=>r.client===client));
    const expected=all.table.rows.filter(r=>r.client===client);
    assert.equal(result.data.totals.lines,expected.length);
    const branded=(await orders({...all.selection,filters:{brand:client},export:true,version:all.version})).data;
    assert.deepEqual(branded.table,result.data.table);assert.deepEqual(branded.totals,result.data.totals);
    assert.deepEqual(branded.by,result.data.by);assert.deepEqual(branded.trend,result.data.trend);
    clients.push({client,totals:result.data.totals,ms:result.ms});
  }
  assert.equal(clients.reduce((n,c)=>n+c.totals.lines,0),all.totals.lines);
  assert.equal(cents(clients.reduce((n,c)=>n+c.totals.amount,0)),cents(all.totals.amount));
  const row=all.table.rows.find(r=>r.client&&r.banner&&r.manager);
  assert.ok(row);
  const combined=(await orders({...all.selection,filters:{client:row.client,banner:row.banner,manager:row.manager},export:true,version:all.version})).data;
  reconcile(combined);assert.ok(combined.table.rows.every(r=>r.client===row.client&&r.banner===row.banner&&r.manager===row.manager));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const views=[],errors=[];
  try {
    for(const width of [1366,390]) {
      const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      let requests=0;page.on('request',r=>{if(r.url().includes('/api/orders'))requests++;});
      const idle=()=>page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
      await page.goto(base+'/franchise-orders');await idle();
      if(width<641)await page.locator('[data-fo-action="filters"]').click();
      const client=page.locator('[data-fo-filter="client"]');
      assert.ok((await client.locator('option').allTextContents()).includes('aQuelle'));
      const response=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().postDataJSON()?.filters?.client==='aQuelle');
      await client.selectOption('aQuelle');const selected=await (await response).json();await idle();
      const before=requests,times=[];
      for(const tab of ['trend','regions','products','stores','reps','orders','overview']) {
        const start=performance.now();await page.locator(`#report-tabs a[href="/franchise-orders/${tab}"]`).click();await idle();
        times.push({tab,ms:Math.round(performance.now()-start)});
        assert.equal(await page.locator('[data-fo-filter="client"]').inputValue(),'aQuelle');
        assert.equal(Number((await page.locator('.fo-period-tools [data-fo-total="lines"]').innerText()).replace(/\D/g,'')),selected.totals.lines);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      assert.equal(requests,before,'Loaded tabs must reuse the matching live report');
      const extraTabRequests=requests-before;
      await page.screenshot({path:path.join(dir,`clients-${width}.png`)});
      const downloaded=page.waitForEvent('download');await page.locator('[data-fo-action="export"]').click();
      const csv=fs.readFileSync(await (await downloaded).path(),'utf8');
      assert.ok(csv.includes('Client'));assert.ok(csv.includes('aQuelle'));assert.ok(!csv.includes(',Danone,'));assert.ok(!csv.includes(',SOILL,'));
      const csvBook=new ExcelJS.Workbook();const sheet=await csvBook.csv.read(Readable.from([csv]));
      const headings=sheet.getRow(1).values,clientColumn=headings.indexOf('Client'),brandColumn=headings.indexOf('Brand');
      assert.ok(clientColumn>0&&brandColumn>0);assert.equal(sheet.rowCount-1,selected.totals.lines);
      for(let n=2;n<=sheet.rowCount;n++){assert.equal(sheet.getCell(n,clientColumn).value,'aQuelle');assert.equal(sheet.getCell(n,brandColumn).value,'aQuelle');}
      assert.equal(await page.locator('#loading-status').evaluate(n=>getComputedStyle(n).pointerEvents),'none');
      await page.locator('[data-fo-action="reset"]').click();await idle();
      await page.locator('.fo-extra>summary').click();
      const brandResponse=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().postDataJSON()?.filters?.brand==='Danone');
      await page.locator('[data-fo-filter="brand"]').selectOption('Danone');const branded=await (await brandResponse).json();await idle();
      assert.ok(branded.table.rows.every(r=>r.brand==='Danone'&&r.client==='Danone'));
      assert.equal(branded.totals.lines,clients.find(c=>c.client==='Danone').totals.lines);
      await page.locator('#report-tabs a[href="/franchise-orders/orders"]').click();await idle();
      assert.equal(await page.locator('[data-fo-filter="brand"]').inputValue(),'Danone');
      assert.ok((await page.locator('.fo-active-filters').innerText()).includes('Danone'));
      await page.screenshot({path:path.join(dir,`brand-client-${width}.png`)});
      views.push({width,times,extraTabRequests,exportClientVerified:true,brandFilterVerified:true,brandClientCsvVerified:true});await page.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
  const result={at:new Date().toISOString(),url:base,refreshedMs:refreshed.ms,warmMs:warm.ms,encoding:warm.encoding,unchangedLedger,totals:all.totals,clientMapping:all.clientMapping,clients,combinedLines:combined.totals.lines,views,errors};
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
