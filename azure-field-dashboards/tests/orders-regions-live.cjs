'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const R=require('../../firebase-dashboards/backend/order-regions.cjs');
const base='https://meridian-field-dashboards.azurewebsites.net',directory=path.resolve(__dirname,'../test-results/order-regions');
const source=path.resolve(__dirname,'../../firebase-dashboards/test-results/order-regions');
async function response(input){return fetch(base+'/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});}
async function report(input){const r=await response(input);assert.equal(r.status,200);return r.json();}
async function main(){
  fs.mkdirSync(directory,{recursive:true});
  const before=JSON.parse(fs.readFileSync(path.join(source,'before.json'))),resource=JSON.parse(fs.readFileSync(path.join(source,'resource.json')));
  const all=await report({export:true,includeCancelled:true,refresh:true});assert.equal(all.regionMapping.version,resource.version);
  assert.equal(all.latestImport,before.latestImport,'Source changed; repeat baseline audit.');assert.deepEqual(all.totals,before.totals);
  const expected=R.enrich(before.table.rows,R.index(resource)),byId=new Map(expected.map(r=>[r.id,r]));
  assert.equal(all.table.total,expected.length);
  for(const r of all.table.rows)for(const field of ['id','orderNumber','orderKey','storeName','storeCode','value','quantity','unitPrice','region','client','brand','banner','status'])assert.equal(r[field],byId.get(r.id)?.[field],field+' '+r.id);
  const aq=await report({filters:{client:'aQuelle'},export:true});
  assert.equal(aq.quality.unmapped,0);assert.equal(aq.totals.lines,471);assert.equal(aq.totals.orders,55);assert.equal(aq.totals.units,2140);assert.equal(aq.totals.amount,0);assert.equal(aq.by.region.length,6);
  assert.match(aq.quality.warnings.join(' '),/zero amounts/);assert.equal(aq.by.region.reduce((n,r)=>n+r.units,0),2140);
  for(const group of aq.by.region){
    const filtered=await report({filters:{client:'aQuelle',region:group.label},export:true,version:aq.version});
    assert.deepEqual(filtered.table.rows.map(r=>r.id),aq.table.rows.filter(r=>r.region===group.label).map(r=>r.id));
    for(const field of ['lines','orders','units','amount'])assert.equal(filtered.totals[field],group[field]);
    console.log('Verified aQuelle region: '+group.label+' / '+group.units+' units');
  }
  const brand=await report({filters:{brand:'aQuelle'},export:true});assert.deepEqual(brand.table,aq.table);
  assert.equal((await response({export:true,version:before.version})).status,409);
  const errors=[],browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:950}});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const idle=async()=>{await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');await page.locator('#loading-status').waitFor({state:'hidden'});};
    await page.goto(base+'/franchise-orders');await idle();
    await page.locator('[data-fo-filter="client"]').selectOption('aQuelle');await idle();
    const panel=page.locator('.fo-ranking').filter({has:page.getByRole('heading',{name:'Regional contribution',exact:true})});
    assert.doesNotMatch(await panel.innerText(),/Unmapped/);for(const group of aq.by.region)assert.ok((await panel.innerText()).includes(group.label));
    await page.locator('[name="fo-metric"][value="units"]').check();await idle();
    await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(directory,'aQuelle-regions-desktop.png')});
    const drill=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().postDataJSON()?.filters?.region==='Western Cape');
    await panel.locator('[data-fo-pick="region"][data-value="Western Cape"]').first().click();
    const selected=await(await drill).json();await idle();assert.equal(selected.totals.units,834);assert.equal(selected.selection.filters.client,'aQuelle');assert.ok(selected.table.rows.every(r=>r.region==='Western Cape'));
    await page.locator('[data-fo-action="back"]').click();await idle();
    await page.setViewportSize({width:390,height:900});await page.locator('#orders-sidebar').waitFor({state:'hidden'});await panel.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(directory,'aQuelle-regions-mobile.png')});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
  const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../public/asset-manifest.json')));
  for(const file of manifest.files){const r=await fetch(base+'/'+file.path);assert.equal(r.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),file.sha256);}
  for(const [route,method,status]of [['/api/admin','POST',404],['/api/import/orders','POST',404],['/api/orders','DELETE',405]])assert.equal((await fetch(base+route,{method})).status,status);
  const result={at:new Date().toISOString(),url:base,version:all.version,mappingVersion:resource.version,allSourceRowsUnchanged:true,allTotalsUnchanged:true,aQuelle:aq.totals,regions:aq.by.region.map(r=>({region:r.label,lines:r.lines,units:r.units})),filtersAndDrilldowns:true,staleExportRejected:true,assetsUnchanged:manifest.files.length,errors};
  fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
