const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../..');
const portal = process.env.NEXUS_PORTAL_STAGE || path.join(root,'public');
const puppeteer = require(path.join(root,'functions/node_modules/puppeteer-core'));
const {createServer} = require('../chat-preview.cjs');
const {normalise,selection,report} = require('../../functions/franchise-orders');
const out = path.join(root,'.tmp/franchise-verification');
const rows = Array.from({length:125},(_,i)=>normalise({id:String(i),data:()=>({periodKey:'2026-09',orderDate:`2026-09-${String(i%8+1).padStart(2,'0')}`,orderNumber:`ORDER-${Math.floor(i/2)}`,storeCode:`STORE-${Math.floor(i/2)%8}`,storeName:`Test franchise ${Math.floor(i/2)%8+1}`,region:['Gauteng','Western Cape','KwaZulu-Natal','Free State'][i%4],rep:`Test rep ${i%5+1}`,product:['Household detergent 2 litre','Baby care value pack','Personal care 400 ml'][i%3],sku:`SKU-${i%3}`,quantity:(i%9+1)*12,value:(i%9+1)*270.5,unitPrice:22.54,status:i%10===0?'Cancelled':i%3===0?'Processed':'Ordered',mapped:i%9!==0,importedAt:'2026-09-03T04:26:00Z'})}));
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const server=createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`; let browser;
  try {
    browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions','--no-first-run']});
    const page=await browser.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1440,height:1000});
    await page.exposeFunction('franchiseFixture',input=>{
      const source=input.__fixture==='empty'?[]:input.__fixture==='mixed'?rows.map((r,i)=>({...r,currency:i%2?'ZAR':'USD'})):input.__fixture==='unsafe'?rows.map(r=>({...r,product:'Very long product name <img src=x onerror=window.injected=true> ' + 'label '.repeat(25)})):rows;
      const result=report(source,selection(input,'2026-09',Error),'2026-09'); result.groupCounts=Object.fromEntries(Object.entries(result.by).map(([key,rows])=>[key,rows.length])); return result;
    });
    await page.setRequestInterception(true);
    page.on('request',request=>{
      const url=new URL(request.url());
      if(url.origin===origin && (url.pathname==='/' || ['app.js','franchise-orders.js','franchise-orders.css','styles.css','job-status.js','job-status.css'].includes(url.pathname.slice(1)))) {
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const staged=path.join(portal,file);
        return request.respond({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(fs.existsSync(staged)?staged:path.join(root,'public',file))});
      }
      if(url.pathname.startsWith('/__/firebase/') || url.pathname==='/service-worker.js') return request.respond({status:200,contentType:'text/javascript',body:'/* isolated test SDK */'});
      if(url.origin===origin) return request.continue();
      const name=url.hostname==='fonts.googleapis.com'?'manrope.css':path.basename(url.pathname);
      const preferred=path.join(out,'vendor',name), vendor=fs.existsSync(preferred)?preferred:path.join(root,'.tmp/chat-verification/vendor',name);
      if(fs.existsSync(vendor)) return request.respond({status:200,headers:{'access-control-allow-origin':'*'},contentType:name.endsWith('.css')?'text/css':'font/woff2',body:fs.readFileSync(vendor)});
      return request.abort();
    });
    await page.evaluateOnNewDocument(()=>{
      const test=window.foTest={calls:[],callback:null,allowed:true};
      const auth={currentUser:null,onAuthStateChanged(cb){test.callback=cb;setTimeout(()=>cb(null),0);},async signOut(){auth.currentUser=null;return test.callback(null);}};
      function query(){const q={where:()=>q,orderBy:()=>q,limit:()=>q,doc:()=>q,collection:()=>q,get:async()=>({docs:[],exists:false}),onSnapshot(...args){const cb=args.find(a=>typeof a==='function');let stopped=false;setTimeout(()=>{if(!stopped)cb({docs:[],size:0,exists:false,metadata:{fromCache:false}});},0);return()=>stopped=true;}};return q;}
      const db={settings(){},collection:query};
      const functions={httpsCallable:name=>async data=>{test.calls.push({name,data});if(name==='getFranchiseOrderDashboard') {if(test.fail) throw Object.assign(new Error('Simulated reader failure'),{code:test.failCode}); if(test.delay) await new Promise(r=>setTimeout(r,1000)); test.result=await window.franchiseFixture({...data,__fixture:test.fixture}); return {data:test.result};}
        if(name==='getOperationsWorkspace')return {data:{account:{uid:auth.currentUser.uid,role:auth.currentUser.kind,permissions:{allowedNavigationIds:test.allowed?['automation','franchiseorder']:['automation'],chatEnabled:false}},profiles:[],runs:[],prompts:[],alerts:[]}};
        return {data:{}};}};
      window.firebase={firestore:()=>db,auth:()=>auth,storage:()=>({setMaxUploadRetryTime(){},setMaxOperationRetryTime(){}}),app:()=>({functions:()=>functions})};
      test.signIn=async kind=>{const claims=kind==='admin'?{email:'admin@nexus.co.za',admin:true}:kind==='client'?{chatClient:true,nexusRole:'client'}:{operator:true,nexusRole:'normal'};auth.currentUser={kind,uid:kind,email:claims.email||`${kind}@example.test`,async getIdTokenResult(){return{claims};}};await test.callback(auth.currentUser);};
      test.signOut=()=>auth.signOut();
    });
    await page.goto(`${origin}/#franchiseorder`,{waitUntil:'networkidle2'});
    assert.equal(await page.evaluate(()=>foTest.calls.filter(c=>c.name==='getFranchiseOrderDashboard').length),0);
    assert.equal(await page.$eval('#nexusLoginDialog',e=>e.open),true);
    await page.evaluate(()=>{
      const mount=FranchiseOrders.mount;
      FranchiseOrders.mount=(root,api,...args)=>mount(root,async input=>{if(foTest.failAll)throw new Error('Simulated complete transport failure');const result=await api(input);foTest.result=result;return result;},...args);
      return foTest.signIn('normal');
    });
    await page.waitForSelector('.fo-kpi');
    assert.equal(await page.evaluate(()=>location.hash),'#franchiseorder','Direct report link must survive staff sign-in');
    await page.waitForFunction(()=>!document.getElementById('appLoader') || getComputedStyle(document.getElementById('appLoader')).opacity==='0');
    if(process.env.NEXUS_JOB_STATUS_TEST)await require('./job-status-browser.cjs')(page);
    assert.equal(await page.$eval('#homeView',e=>e.hidden),true);
    assert.equal(await page.$eval('#franchiseOrderView',e=>e.hidden),false);
    assert.equal(await page.$eval('#franchisePrimaryNav .nexus-franchise-submenu',e=>e.hidden),true);
    assert.equal(await page.$$eval('#franchiseOrders iframe',els=>els.length),0);
    assert.equal(await page.$eval('.fo-mobile-filters',e=>getComputedStyle(e).display),'none');
    assert.equal(await page.$eval('#franchisePrimaryNav [data-tree-toggle="franchiseorder"] span',e=>e.textContent),'Franchise orders');
    const overlap=await page.$$eval('.fo-filter-grid label',els=>els.some((a,i)=>els.slice(i+1).some(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.left<y.right && x.right>y.left && x.top<y.bottom && x.bottom>y.top;})));
    assert.equal(overlap,false,'Filter boxes do not overlap');
    await page.screenshot({path:path.join(out,'overview-desktop.png')});
    await page.click('#franchisePrimaryNav [data-tree-toggle="franchiseorder"]');
    for(const tab of ['trend','regions','products','stores','reps','orders']){
      await page.click(`#franchisePrimaryNav [data-franchise-page="${tab}"]`);
      await page.waitForFunction(tab=>document.querySelector('.fo-heading h1')?.textContent===FranchiseOrders.pages[tab],{},tab);
      if(tab==='trend') assert.equal(await page.$$('.fo-chart').then(r=>r.length),2);
      await page.screenshot({path:path.join(out,`${tab}-desktop.png`)});
    }
    assert.equal(await page.$$eval('.fo-table-wrap tbody tr',els=>els.length),50);
    await page.click('[data-fo-action="next"]'); await page.waitForFunction(()=>document.querySelector('.fo-pagination')?.textContent.includes('page 2'));
    await page.select('[data-fo-filter="region"]','Gauteng');
    await page.waitForFunction(()=>document.querySelector('.fo-results')?.getAttribute('aria-busy')==='false');
    assert.equal(await page.$eval('[data-fo-filter="region"]',e=>e.value),'Gauteng');
    assert.ok((await page.$$eval('.fo-table-wrap tbody tr',e=>e.length))<50);
    await page.click('[data-fo-action="reset"]'); await page.waitForFunction(()=>document.querySelector('.fo-pagination')?.textContent.includes('page 1 of 3'));
    await page.click('.fo-columns summary'); await page.click('[data-fo-column="rep"]'); assert.ok((await page.$$eval('th',els=>els.map(e=>e.textContent))).includes('Rep'));
    await page.click('[data-fo-order]'); await page.waitForSelector('.fo-drill'); assert.ok((await page.$$eval('.fo-table-wrap tbody tr',e=>e.length))<=2);
    await page.click('[data-fo-action="clearOrder"]'); await page.waitForFunction(()=>!document.querySelector('.fo-drill'));
    const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
    await page.click('[data-fo-action="export"]');await page.waitForFunction(()=>document.querySelector('.fo-message')?.textContent.includes('exported'));
    assert.equal(await page.evaluate(()=>FranchiseOrders.csvCell('=SUM(A1)')),`"'=SUM(A1)"`);
    await page.click('.fo-columns summary'); await page.click('[data-fo-action="resetColumns"]');
    assert.equal((await page.$$eval('.fo-table-wrap th',els=>els.map(e=>e.textContent))).includes('Rep'),false);
    await page.select('[data-fo-preset]','3');
    await page.waitForFunction(()=>document.querySelector('[data-fo-date="start"]').value==='2026-07-01');
    await page.select('[data-fo-preset]','1');
    await page.waitForFunction(()=>document.querySelector('[data-fo-date="start"]').value==='2026-09-01');
    await page.select('[data-fo-filter="region"]','Gauteng'); await page.waitForSelector('[data-fo-action="removeFilter"]');
    await page.click('[data-fo-action="removeFilter"]'); await page.waitForFunction(()=>document.querySelector('[data-fo-filter="region"]').value==='');
    await page.click('#franchisePrimaryNav [data-franchise-page="trend"]');
    await page.$eval('[data-fo-action="exportTrend"]',e=>e.click()); await page.waitForFunction(()=>document.querySelector('.fo-message').textContent.includes('periods exported'));
      const date=await page.$eval('[data-fo-period]',e=>e.dataset.foPeriod); await page.$eval('[data-fo-period]',e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    await page.waitForFunction(date=>document.querySelector('[data-fo-date="start"]').value===date && document.querySelector('.fo-heading h1').textContent==='Order Detail',{},date);
    assert.equal(await page.$eval('[data-fo-date="end"]',e=>e.value),date);
    await page.click('[data-fo-action="reset"]'); await page.waitForFunction(()=>document.querySelector('[data-fo-date="end"]').value==='2026-09-30');
    await page.click('#franchisePrimaryNav [data-franchise-page="products"]');
    await page.$eval('[name="fo-metric"][value="units"]',e=>e.click());
    await page.select('[data-fo-group-sort]','units');
    const quantities=await page.$$eval('.fo-table-wrap tbody tr',els=>els.map(e=>Number(e.children[3].textContent.replace(/[^0-9.-]/g,''))));
    assert.deepEqual(quantities,[...quantities].sort((a,b)=>b-a));
    await page.$eval('[data-fo-action="exportGroups"]',e=>e.click()); await page.waitForFunction(()=>document.querySelector('.fo-message').textContent.includes('summary rows exported'));
    const product=await page.$eval('[data-fo-pick="product"]',e=>e.dataset.value); await page.$eval('[data-fo-pick="product"]',e=>e.click());
    await page.waitForFunction(product=>document.querySelector('[data-fo-filter="product"]').value===product && document.querySelector('.fo-heading h1').textContent==='Order Detail',{},product);
    await page.click('[data-fo-action="reset"]'); await page.waitForFunction(()=>document.querySelector('[data-fo-filter="product"]').value==='');
    for(const width of [390,320]) {
      await page.setViewport({width,height:844});
      await page.evaluate(()=>{location.hash='franchiseorder';}); await new Promise(r=>setTimeout(r,200));
      await page.waitForSelector('#franchiseNavToggle');
      await page.click('#franchiseNavToggle');
      const expanded=await page.$eval('#franchisePrimaryNav [data-tree-toggle="franchiseorder"]',e=>e.getAttribute('aria-expanded'));
      if(expanded!=='true') await page.click('#franchisePrimaryNav [data-tree-toggle="franchiseorder"]');
      await page.click('#franchisePrimaryNav [data-franchise-page="overview"]');
      assert.equal(await page.$eval('#franchiseNavToggle',e=>e.getAttribute('aria-expanded')),'false','Selecting a mobile page closes its menu');
      await page.screenshot({path:path.join(out,`overview-mobile-${width}.png`)});
      assert.equal(await page.$eval('#nexusAssistantToggle',e=>getComputedStyle(e).display),'none','Use the report header AI control, not an overlay over KPIs');
      await page.click('[data-fo-action="filters"]');
      assert.equal(await page.$eval('[data-fo-filter="region"]',e=>getComputedStyle(e.closest('label')).display),'block');
      await page.click('[data-fo-action="filters"]');
      const dimensions=await page.$eval('#franchiseOrders',e=>({width:e.clientWidth,scrollWidth:e.scrollWidth}));
      assert.ok(dimensions.scrollWidth<=dimensions.width+1,`Mobile overflow: ${JSON.stringify(dimensions)}`);
      await page.$eval('#franchiseOrders',e=>e.scrollTo(0,900));await page.screenshot({path:path.join(out,`charts-mobile-${width}.png`)});
      assert.ok(await page.$$eval('.fo-chart .fo-activity-bar',els=>els.length>0 && els.every(e=>Number(e.getAttribute('height'))>0 && Number.isFinite(Number(e.getAttribute('x'))))));
      for(const tab of ['trend','regions','products','stores','reps','orders']) {
        await page.$eval(`#franchisePrimaryNav [data-franchise-page="${tab}"]`,e=>e.click());
        const size=await page.$eval('#franchiseOrders',e=>({w:e.clientWidth,s:e.scrollWidth}));
        assert.ok(size.s<=size.w+1,`${tab} overflow at ${width}: ${JSON.stringify(size)}`);
        await page.screenshot({path:path.join(out,`${tab}-mobile-${width}.png`)});
      }
    }
    await page.setViewport({width:1440,height:1000}); await new Promise(r=>setTimeout(r,200));
    await require('./franchise-drilldowns-browser.cjs')(page,out);
    await page.$eval('#franchisePrimaryNav [data-franchise-page="overview"]',e=>e.click());
    await page.evaluate(()=>{foTest.fixture='mixed';document.querySelector('[data-fo-action="refresh"]').click();});
    await page.waitForFunction(()=>document.querySelector('.fo-kpi').textContent.includes('Mixed currencies'));
    assert.equal(await page.$eval('[name="fo-metric"][value="amount"]',e=>e.disabled),true);
    assert.equal(await page.$$('.fo-chart').then(r=>r.length),1,'No misleading cross-currency amount line');
    await page.evaluate(()=>{foTest.fixture='empty';document.querySelector('[data-fo-action="refresh"]').click();});
    await page.waitForFunction(()=>document.querySelector('.fo-period-tools').textContent.includes('0 selected lines'));
    assert.equal(await page.$$('.fo-chart').then(r=>r.length),0);
    await page.evaluate(()=>{foTest.fixture='unsafe';document.querySelector('[data-fo-action="refresh"]').click();});
    await page.waitForFunction(()=>document.querySelector('.fo-results').textContent.includes('<img'));
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    assert.equal(await page.$$('#franchiseOrders img').then(r=>r.length),0);
    await page.evaluate(()=>{foTest.fixture='';document.querySelector('[data-fo-action="refresh"]').click();});
    await page.waitForFunction(()=>!document.querySelector('.fo-results').textContent.includes('<img'));
    await page.$eval('[data-fo-action="assistant"]',e=>e.click());await page.waitForSelector('#nexusAssistantDialog[open]');await page.click('#nexusAssistantClose');
    await page.evaluate(()=>foTest.fail=true); await page.$eval('[data-fo-action="refresh"]',e=>e.click()); await page.waitForSelector('.fo-message.error');
    assert.ok(await page.$('.fo-kpi'),'A refresh failure retains the labelled last loaded selection');
    await page.evaluate(()=>foTest.fail=false); await page.$eval('[data-fo-action="refresh"]',e=>e.click()); await page.waitForFunction(()=>document.querySelector('.fo-message')?.hidden);
    await page.evaluate(()=>{foTest.fail=true;foTest.failCode='functions/permission-denied';document.querySelector('[data-fo-action="refresh"]').click();});
    await page.waitForSelector('.fo-empty'); assert.equal(await page.$('.fo-kpi'),null,'Permission errors clear all previously loaded data');
    await page.evaluate(()=>{foTest.fail=false;foTest.failCode='';}); await page.click('[data-fo-action="retry"]'); await page.waitForSelector('.fo-kpi');
    await page.evaluate(()=>{foTest.delay=true;document.querySelector('[data-fo-action="refresh"]').click();});
    await page.evaluate(()=>foTest.signOut());await new Promise(r=>setTimeout(r,1200));assert.equal(await page.$('.fo-kpi'),null,'Late response must not restore signed-out data');
    await page.evaluate(()=>{foTest.allowed=false;return foTest.signIn('normal');});
    await page.evaluate(()=>{location.hash='franchiseorder';});await new Promise(r=>setTimeout(r,200));assert.notEqual(await page.evaluate(()=>location.hash),'#franchiseorder');
    await page.evaluate(()=>foTest.signIn('admin'));assert.ok(await page.$('#adminUserNavigation input[value="franchiseorder"]'));
    assert.deepEqual(errors,[]);
    console.log('Franchise Order: seven pages, shell auth/access, filters, pagination, drilldown, columns, CSV, desktop/mobile layout, error retry and sign-out race passed.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
