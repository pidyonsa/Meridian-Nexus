"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { createServer } = require("../chat-preview.cjs");
const root = path.resolve(__dirname, "../.."), out = process.env.NEXUS_ETL_TEST_OUTPUT || path.join(root, ".tmp/etl-browser-verification");
const source = JSON.parse(fs.readFileSync(path.join(root, ".tmp/anchor-etl-validation/result.json")));
const { facts, exceptions, assignments, dcFacts, ...summary } = source;
const id = "a".repeat(32);
const result = { ...summary, headers: require("../../etl-worker/engine.cjs").HEADERS, preview: facts.slice(0, 100).map(r => r.values), exceptionPreview: exceptions.slice(0, 100), assignmentCount: assignments.length, inputs: {}, checksums: {}, output: { name: "inventory-draft.xlsx" } };
const run = { id, sourceName: "PnPSiteDaysCover_20260902082929- PNP INVENTORY RAW.xlsx", createdAt: "2026-09-09T07:00:00Z", status: "review", totals: source.totals };
const fixtureResources = [...Object.keys(require("../../etl-worker/engine.cjs").SCHEMAS), "inventorySample", "salesSample", "template", "products-new"].map(role => ({ id: role, title: `Anchor ${role}`, sourceName: `${role}.xlsx`, size: 100, category: "Reference", active: true, tags: [`etl-anchor-${role}`] }));
let fixtureReferences = { revision: 1, resources: Object.fromEntries(["products", "stores", "staffing", "dc", "status", "inventorySample", "salesSample"].map(role => [role, role])) };
const {defaults,CHANNELS,pipelineId}=require('../../functions/etl-pipelines');
let pipelines=defaults();
let approvalFixture = false;
let salesFixture = false;
const salesTotals={inputRows:2,readyRows:2,outputRows:1,exceptionRows:0,dcRows:0,invalidDcRows:0,warningRows:0,excludedRows:0,sourceUnits:2,validUnits:2,exceptionUnits:0,sourceValue:8.5,validValue:8.5,exceptionValue:0};
const salesRun={...run,client:'Ethica',channel:'Clicks',kind:'Sales',status:'ready',pipelineId:pipelineId('Ethica','clicks','Sales'),sourceName:'Clicks-sales.xlsx',totals:salesTotals};
const salesResult={...result,kind:'Sales',status:'ready',totals:salesTotals,reconciled:true,periodStart:'2026-08-01',periodEnd:'2026-08-02',issueCounts:{},exceptionPreview:[],headers:require('../../etl-worker/shared-layout.cjs').SALES_HEADERS,
  preview:[['2026-08-01','ETHICA','CLICKS','CLICKS','001','Raw Clicks Name','','','GAUTENG','','','','','Category','Brand','Item',2,8.5,null,'YES']],output:{name:'sales.xlsx'}};
const readyTotals = { inputRows: 2, storeRows: 1, dcRows: 1, readyRows: 1, exceptionRows: 0, invalidDcRows: 0, sourceStoreSOH: 115, validStoreSOH: 115, exceptionStoreSOH: 0, unknownStoreSOHRows: 0, dcSOH: 500 };
const readyRun = { ...run, sourceName: 'PnPSiteDaysCover_20260902082929-synthetic.xlsx', status: 'ready', totals: readyTotals };
const readyResult = { ...result, status: 'ready', issueCounts: {}, exceptionPreview: [], totals: readyTotals, assignmentCount: 1,
  preview: [['2026-09-01', 'Pick n Pay Corporate', 'GAUTENG', 'TEST001', 'Synthetic Store', '00012', 'Test', 'Test', '00012', 'Synthetic Item', 'Synthetic Item', 500, 115, 136.8, 'Active', 'ANCHOR', null]] };
async function main() {
  if (process.env.NEXUS_ETL_MAPPING_POLICY) {
    Object.assign(readyTotals, { inputRows: 3, storeRows: 2, warningRows: 1, excludedRows: 1, excludedStoreSOH: 40, sourceStoreSOH: 155 });
    Object.assign(readyResult, { mappingPolicy: require("../../etl-worker/engine.cjs").ACCEPTED_MAPPING_POLICY,
      warningCounts: { PRODUCT_MAPPING: 1, DC_MAPPING: 1 },
      warningPreview: [{ line: 2, siteCode: "TEST001", article: "00012", outcome: "included", errors: [{ code: "DC_MAPPING", detail: "Missing balance; left blank." }] }],
      exclusionPreview: [{ line: 4, siteCode: "TEST002", rawName: "PNP LIQUOR TEST", article: "00012", soh: 40 }] });
    readyResult.preview[0][11] = null;
  }
  fs.mkdirSync(out, { recursive: true }); const server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; let browser;
  try {
    browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--disable-extensions", "--no-first-run"] });
    const page = await browser.newPage(), errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.exposeFunction("etlFixture", data => {
      if (data.action === 'testReady') { approvalFixture = true; return {}; }
      if (data.action === "catalogue") return { pipelines, channels:CHANNELS, referenceSet: fixtureReferences, resources: fixtureResources };
      if (data.action === 'savePipeline') { const id=pipelineId(data.customer,data.channelId,data.kind),channel=CHANNELS.find(c=>c.id===data.channelId);const pipeline={...data,id,channel:channel.name,kind:data.kind || 'Inventory',runnable:false,status:data.resources.raw&&data.resources.expected?'mapping-required':'files-required',revision:data.revision+1};pipelines=[pipeline,...pipelines.filter(p=>p.id!==id)];return {pipeline}; }
      if (data.action === "resourceList") return { resources: fixtureResources, categories: ["Reference", "Template"] };
      if (data.action === "saveReferences") { assert.equal(data.revision, fixtureReferences.revision); assert.equal(data.resources.products, "products-new"); fixtureReferences = { revision: fixtureReferences.revision + 1, resources: data.resources }; return { referenceSet: fixtureReferences }; }
      if (data.action === "history") return { runs: [salesFixture ? salesRun : approvalFixture ? readyRun : run] };
      if (data.action === "detail") return { run: salesFixture ? salesRun : approvalFixture ? readyRun : run, result: salesFixture ? salesResult : approvalFixture ? readyResult : result, progress: { percent: 100 } };
      if (data.action === 'approve') {
        assert.equal(data.confirm, true); assert.equal(readyRun.status, 'ready');
        readyRun.status = 'approved'; readyRun.approval = { by: { email: 'admin@example.test' }, at: new Date().toISOString() };
        return { run: readyRun, result: readyResult, progress: { percent: 100 } };
      }
      if (data.action === "run") { salesFixture=data.pipelineId===salesRun.pipelineId;assert.equal(data.rules.confirmed, true); assert.equal(data.rules.salesDays, 30); assert.deepEqual(data.resources, { raw: "raw" }); assert.equal(data.referenceRevision, salesFixture ? 2 : 1); return { id }; }
      if (data.action === "download") {
        assert.ok([0, 4].includes(data.offset)); if (data.offset === 4) assert.equal(data.generation, "123");
        return { size: 8, offset: data.offset, generation: "123", nextOffset: data.offset === 0 ? 4 : null, dataBase64: Buffer.from(data.offset === 0 ? "test" : "data").toString("base64"), name: "synthetic-inventory.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
      }
      return {};
    });
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      const staged = process.env.NEXUS_PORTAL_STAGE
        ? path.join(process.env.NEXUS_PORTAL_STAGE, url.pathname === "/" ? "index.html" : path.basename(url.pathname))
        : path.join(root, ".tmp/etl-release-20260909", `preview-${url.pathname === "/" ? "index.html" : path.basename(url.pathname)}`);
      if (url.origin === origin && url.pathname !== '/service-worker.js' && (url.pathname === '/' || /\.(js|css)$/.test(url.pathname)) && fs.existsSync(staged)) return request.respond({ status: 200, contentType: url.pathname === "/" ? "text/html" : url.pathname.endsWith(".css") ? "text/css" : "text/javascript", body: fs.readFileSync(staged) });
      if (url.origin === origin && url.pathname === "/") return request.respond({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(root, "public/index.html")) });
      if (url.pathname.startsWith("/__/firebase/") || url.pathname === "/service-worker.js") return request.respond({ status: 200, contentType: "text/javascript", body: "/* isolated SDK test */" });
      if (url.origin === origin) return request.continue();
      const name = url.hostname === "fonts.googleapis.com" ? "manrope.css" : path.basename(url.pathname), vendor = path.join(root, ".tmp/chat-verification/vendor", name);
      if (fs.existsSync(vendor)) return request.respond({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: name.endsWith(".css") ? "text/css" : "font/woff2", body: fs.readFileSync(vendor) });
      return request.abort();
    });
    await page.evaluateOnNewDocument(() => {
      const test = window.etlTest = { calls: [], callback: null };
      const createUrl = URL.createObjectURL.bind(URL), click = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = blob => { test.downloadBlob = blob; return createUrl(blob); };
      HTMLAnchorElement.prototype.click = function () { if (this.href.startsWith("blob:")) { test.downloadName = this.download; return; } return click.call(this); };
      const auth = { currentUser: null, onAuthStateChanged(cb) { test.callback = cb; setTimeout(() => cb(null), 0); }, async signOut() { auth.currentUser = null; return test.callback(null); } };
      function query() { const q = { where: () => q, orderBy: () => q, limit: () => q, doc: () => q, collection: () => q, get: async () => ({ docs: [], exists: false }), onSnapshot(...args) { const cb = args.find(a => typeof a === "function"); let stopped = false; setTimeout(() => { if (!stopped) cb({ docs: [], size: 0, exists: false, metadata: { fromCache: false } }); }, 0); return () => { stopped = true; }; } }; return q; }
      const db = { settings() {}, collection: query };
      const functions = { httpsCallable: name => async data => {
        test.calls.push({ name, data });
        if (name === "meridianEtl") { if (test.fail) throw new Error("Simulated ETL service unavailable"); if (test.delay) await new Promise(r => setTimeout(r, 1000)); return { data: await window.etlFixture(data) }; }
        if (name === "getPortalResources") return { data: await window.etlFixture({ action: "resourceList" }) };
        if (name === "getOperationsWorkspace") return { data: { account: { uid: auth.currentUser.uid, role: auth.currentUser.kind, permissions: { allowedNavigationIds: ["automation"], chatEnabled: false } },
          profiles: [{id:'dataorbis-game-sales',name:'Wilmar Game / Makro / Jumbo',ready:true,portal:'pyramid.dataorbis.com'}, {id:'dataorbis-makro-sales',name:'Espen Game / Makro / Jumbo',ready:false}, ...(test.pnpReady ? [{id:'picknpay',name:'Pick n Pay Sales',ready:true,portal:'www.pnpportal.co.za'}] : [])],
          runs: test.portalQueued ? [{id:'portal-test',retailerId:'dataorbis-game-sales',retailerName:'Wilmar',status:'queued',createdAt:'2026-09-23T09:00:00Z',createdBy:auth.currentUser.uid,message:'Waiting for verification'}] : [], reports: [], reportsStatus: 'ready', prompts: [], alerts: [] } };
        if (name === "startExtraction") { if(data.retailerId!=='picknpay') test.portalQueued=true; return {data:{runId:data.retailerId==='picknpay'?'pnp-test':'portal-test'}}; }
        if (name === "abortExtraction") { test.portalQueued=false; return {data:{}}; }
        return { data: {} };
      } };
      window.firebase = { firestore: () => db, auth: () => auth, storage: () => ({ setMaxUploadRetryTime() {}, setMaxOperationRetryTime() {} }), app: () => ({ options: { projectId: 'test-project' }, functions: () => functions }) };
      test.signIn = async kind => { const claims = kind === "admin" ? { email: "admin@nexus.co.za", admin: true } : { operator: true, nexusRole: "normal" }; auth.currentUser = { kind, uid: kind, email: claims.email || "staff@example.test", async getIdTokenResult() { return { claims }; } }; await test.callback(auth.currentUser); };
      test.signOut = () => auth.signOut();
    });
    await page.goto(`${origin}/#etls`, { waitUntil: "networkidle2" });
    assert.equal(await page.evaluate(() => etlTest.calls.filter(c => c.name === "meridianEtl").length), 0);
    assert.equal(await page.$eval("#nexusLoginDialog", e => e.open), true);
    await page.evaluate(() => etlTest.signIn("normal")); await new Promise(r => setTimeout(r, 500));
    assert.equal(await page.$eval('#etlPrimaryNav [data-open-view="etls"]', e => e.hidden), true);
    await page.evaluate(() => etlTest.signIn("admin")); await page.evaluate(() => { location.hash = "etls"; });
    await page.waitForSelector(".etl-section"); await page.waitForFunction(() => !document.getElementById("appLoader") || getComputedStyle(document.getElementById("appLoader")).opacity === "0");
    assert.equal(await page.$eval("#etlsView", e => e.hidden), false); assert.equal(await page.$eval("#homeView", e => e.hidden), true);
    if (process.env.NEXUS_ETL_LABEL) {
      assert.equal(await page.$eval("#meridianEtls h1", e => e.textContent), process.env.NEXUS_ETL_LABEL);
      assert.equal(await page.$eval('#etlPrimaryNav [data-open-view="etls"] span', e => e.textContent), process.env.NEXUS_ETL_LABEL);
      assert.equal(await page.title(), `${process.env.NEXUS_ETL_LABEL} | Meridian Nexus`);
    }
    assert.equal(await page.$$eval("#meridianEtls iframe", e => e.length), 0);
    await page.screenshot({ path: path.join(out, "pipelines-desktop.png") });
    await page.click('.etl-tabs [data-tab="portals"]');
    await page.waitForSelector('#etlPortalRun');
    await page.click('[data-portal-select="dataorbis-makro-sales"]');
    assert.equal(await page.$eval('#etlPortalRun [type="submit"]',e=>e.disabled),true,'Unvalidated Espen remains blocked');
    await page.click('[data-portal-select="dataorbis-game-sales"]');
    await page.$eval('#etl-portal-month',e=>{e.value='2026-08';e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.click('#etlPortalRun [type="submit"]');
    await page.waitForSelector('[data-portal-abort="portal-test"]');
    assert.equal(await page.evaluate(()=>location.hash),'#etls','Portal jobs stay inside ETLs');
    const starts=await page.evaluate(()=>etlTest.calls.filter(c=>c.name==='startExtraction'));
    assert.equal(starts.length,1);assert.deepEqual(starts[0].data,{retailerId:'dataorbis-game-sales',reportStartDate:'2026-08-01',reportEndDate:'2026-08-31'});
    assert.equal(await page.$eval('#etlPortalRun [type="submit"]',e=>e.disabled),true,'An active monthly job prevents duplicate submissions');
    await page.screenshot({path:path.join(out,'portal-run-desktop.png')});
    await page.evaluate(()=>{etlTest.portalQueued=false;});
    await page.click('[data-portal-refresh]');
    await page.waitForFunction(()=>!document.querySelector('[data-portal-abort]'));
    if (process.env.NEXUS_ETL_PNP_PORTAL) {
      await page.click('[data-portal-select="picknpay"]');
      assert.equal(await page.$eval('#etlPortalRun [type="submit"]', e=>e.disabled), true, 'Unlinked Pick n Pay stays unavailable');
      assert.ok(await page.$eval('.etl-body', e=>e.textContent.includes('Pick n Pay monthly sales')));
      assert.ok(!await page.$eval('.etl-portal-run', e=>e.textContent.includes('ALL Clients by SKU')));
      await page.screenshot({path:path.join(out,'picknpay-setup-desktop.png')});
      for (const width of [390,320]) {
        await page.setViewport({width,height:950});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), 'Portal selector fits mobile');
        await page.screenshot({path:path.join(out,'picknpay-setup-'+width+'.png')});
      }
      await page.setViewport({width:1440,height:1000});
      await page.evaluate(()=>{etlTest.pnpReady=true;});
      await page.click('[data-portal-refresh]');
      await page.waitForFunction(()=>!document.querySelector('#etlPortalRun [type="submit"]').disabled);
      await page.click('#etlPortalRun [type="submit"]');
      await page.waitForFunction(()=>etlTest.calls.some(c=>c.name==='startExtraction'&&c.data.retailerId==='picknpay'));
      const pnpStarts=await page.evaluate(()=>etlTest.calls.filter(c=>c.name==='startExtraction'&&c.data.retailerId==='picknpay'));
      assert.equal(pnpStarts.length,1);
      assert.deepEqual(pnpStarts[0].data,{retailerId:'picknpay',reportStartDate:'2026-08-01',reportEndDate:'2026-08-31'});
      assert.equal(await page.evaluate(()=>location.hash),'#etls');
      await page.waitForFunction(()=>!document.querySelector('#etlPortalRun [type="submit"]').disabled);
    }
    await page.click('.etl-tabs [data-tab="pipelines"]');
    if(process.env.NEXUS_ETL_CHANNELS){
      assert.equal(await page.$$eval('.etl-pipeline-table tbody tr',rows=>rows.length),new Set(defaults().map(p=>p.channelId)).size);
      assert.equal(await page.$eval('#etl-row-customer-pnp',e=>e.value),'','A channel must not silently select Anchor');
      await page.select('#etl-row-customer-pnp','Penflex');
      assert.ok(await page.$(`[data-pipeline="${pipelineId('Penflex','pnp')}"][data-destination="setup"]`));
      assert.equal(await page.$('[data-pipeline="anchor-pnp-v1"][data-destination="run"]'),null,'Penflex must not inherit Anchor Run');assert.ok(await page.$(`[data-pipeline="${pipelineId('Penflex','pnp')}"][data-destination="run"]`),'Penflex uses its own client-aware Run');
      await page.select('#etl-row-customer-pnp','Dynamic Brands');
      assert.ok(await page.$(`[data-pipeline="${pipelineId('Dynamic Brands','pnp')}"]`));
      await page.select('#etl-row-customer-clicks','Ethica');
      assert.equal(await page.$$eval('#etl-row-kind-clicks option',options=>options.length),2);
      await page.select('#etl-row-kind-clicks',pipelineId('Ethica','clicks','Sales'));
      assert.ok(await page.$(`[data-pipeline="${pipelineId('Ethica','clicks','Sales')}"]`));
      await page.type('#etl-pipeline-search','Clicks');assert.equal(await page.$$eval('.etl-pipeline-table tbody tr',rows=>rows.length),1);
      await page.select('#etl-filter-customer','Anchor');assert.equal(await page.$$eval('.etl-pipeline-table tbody tr',rows=>rows.length),1);
      await page.click('[data-pipeline="anchor-clicks-v1"]');await page.waitForSelector('#etlSetupForm');
      assert.equal(await page.$('#etlRunForm'),null);await page.select('#etl-setup-raw','raw');assert.equal(await page.$('#etl-setup-expected'),null);assert.equal(await page.$('#etl-setup-template'),null);
      await page.type('#etl-setup-notes','Synthetic channel mapping requirements');await page.click('#etlSetupForm [type="submit"]');
      await page.waitForFunction(()=>document.querySelector('#etlSetupForm')?.textContent.includes('Saved setup v1'));
      await page.screenshot({path:path.join(out,'channel-setup-desktop.png')});
      await page.click('[data-command="add-pipeline"]');await page.waitForSelector('dialog[open]');await page.select('#etl-add-customer','__new__');await page.type('#etl-new-customer','Test customer');await page.select('#etl-add-channel','spar');await page.click('#etlAddPipelineForm [type="submit"]');
      await page.waitForFunction(()=>!document.querySelector('dialog[open]') && document.querySelector('#etlSetupForm')?.textContent.includes('Test customer / SPAR'));
      assert.ok(await page.$eval('#etl-context-customer',e=>[...e.options].some(o=>o.value==='Test customer')));
      await page.select('#etl-context-channel','clicks');await page.waitForSelector('dialog[open]');
      assert.equal(await page.$eval('#etl-add-customer',e=>e.value),'Test customer');
      assert.equal(await page.$eval('#etl-add-channel',e=>e.value),'clicks');
      await page.click('#etlAddPipelineForm [type="submit"]');
      await page.waitForFunction(()=>!document.querySelector('dialog[open]') && document.querySelector('#etlSetupForm')?.textContent.includes('Test customer / Clicks'));
      assert.equal(await page.$eval('#etl-setup-raw',e=>e.value),'','Customer/channel setup must not copy another customer raw file');
      const saves=await page.evaluate(()=>etlTest.calls.filter(c=>c.data?.action==='savePipeline').length);
      await page.click('[data-command="add-pipeline"]');await page.select('#etl-add-customer','__new__');await page.type('#etl-new-customer','  test   CUSTOMER  ');await page.select('#etl-add-channel','clicks');await page.click('#etlAddPipelineForm [type="submit"]');
      await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      assert.equal(await page.evaluate(()=>etlTest.calls.filter(c=>c.data?.action==='savePipeline').length),saves,'Existing setup cannot be overwritten by a differently cased customer name');
      await page.screenshot({path:path.join(out,'customer-channel-setup.png')});
      await page.click('.etl-tabs [data-tab="history"]');await page.select('[data-history-pipeline]',pipelineId('Test customer','spar'));assert.equal(await page.$$eval('.etl-body tbody tr',rows=>rows.length),0);
      await page.select('[data-history-pipeline]','');
      await page.click('.etl-tabs [data-tab="pipelines"]');await page.click('[data-command="clear-filters"]');
      await page.select('#etl-row-customer-pnp','Anchor');
      await page.click('[data-pipeline="anchor-pnp-v1"][data-destination="run"]');
    }
    await page.click('.etl-tabs [data-tab="run"]');
    assert.equal(await page.$$eval('[data-upload]', e => e.length), 1);
    assert.equal(await page.$eval('#etl-raw', e => e.value), "", "Never reuse a prior raw report automatically");
    assert.equal(await page.$$eval('.etl-reference-summary > div', e => e.length), 6);
    await page.select('#etl-raw', 'raw');
    assert.equal(await page.$eval('[name="salesDays"]', e => e.value), "30");
    await page.select('[name="salesDays"]', "30"); await page.select('[name="openPO"]', "unknown"); await page.select('[name="bannerColumn"]', "D"); await page.select('[name="reportDate"]', "as-of"); assert.equal(await page.$('[name="confirmed"]'),null);
    await page.screenshot({ path: path.join(out, "run-desktop.png") });
    await page.click('#etlRunForm [type="submit"]'); await page.waitForSelector(".etl-metrics");
    assert.equal(await page.$('[data-command="approve"]'), null);
    await page.screenshot({ path: path.join(out, "review-desktop.png") });
    await page.click('.etl-tabs [data-tab="outputs"]'); await page.waitForSelector(".etl-preview");
    assert.equal(await page.$$eval(".etl-preview th", e => e.length), 17); assert.equal(await page.$('[data-command="approve"]'), null);
    await page.click('[data-download="workbook"]'); await page.waitForFunction(() => etlTest.downloadName === "synthetic-inventory.xlsx");
    assert.equal(await page.evaluate(() => etlTest.downloadBlob.text()), "testdata");
    assert.deepEqual(await page.evaluate(() => etlTest.calls.filter(call => call.data?.action === "download").map(call => call.data.offset)), [0, 4]);
    await page.screenshot({ path: path.join(out, "outputs-desktop.png") });
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844 });
      for (const tab of ["pipelines", "portals", "run", "setup", "review", "outputs", "history"]) {
        await page.$eval(`.etl-tabs [data-tab="${tab}"]`, e => e.click());
        await page.$eval("#meridianEtls", e => e.scrollTo(0, 0));
        const dimensions = await page.$eval("#meridianEtls", e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
        assert.ok(dimensions.scroll <= dimensions.width + 1, `Overflow at ${width}/${tab}: ${JSON.stringify(dimensions)}`);
        await page.screenshot({ path: path.join(out, `${tab}-mobile-${width}.png`) });
      }
    }
    await page.setViewport({ width: 1440, height: 1000 });
    if (process.env.NEXUS_ETL_APPROVAL_CHECK) {
      await page.evaluate(() => etlFixture({ action: 'testReady' }));
      await page.$eval('[data-command="refresh"]', e => e.click());
      await page.waitForFunction(() => document.querySelector('.etl-body')?.getAttribute('aria-busy') === 'false');
      await page.$eval('.etl-tabs [data-tab="outputs"]', e => e.click());
      await page.waitForSelector('[data-command="approve"]');
      if (process.env.NEXUS_ETL_MAPPING_POLICY) {
        assert.ok(await page.$eval('.etl-body', e => e.textContent.includes('Accepted mapping warnings') && e.textContent.includes('Excluded Pick n Pay Liquor')));
        for (const width of [1440, 390, 320]) {
          await page.setViewport({ width, height: 1000 });
          await page.$eval('.etl-tabs [data-tab="review"]', e => e.click());
          assert.ok(await page.$eval('.etl-reconcile', e => e.textContent.includes('155 = ready 115 + exceptions 0 + excluded 40')));
          await page.$$eval('.etl-section', sections => sections.find(s => s.textContent.includes('Accepted mapping warnings'))?.scrollIntoView({ block: 'start' }));
          const bounds = await page.$eval('#meridianEtls', e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
          assert.ok(bounds.scroll <= bounds.width + 1);
          await page.screenshot({ path: path.join(out, `mapping-policy-${width}.png`) });
        }
        await page.setViewport({ width: 1440, height: 1000 });
        await page.$eval('.etl-tabs [data-tab="outputs"]', e => e.click());
      }
      assert.equal(await page.$eval('[data-command="approve"]', e => e.disabled), true);
      await page.click('[data-approve-check]');
      await page.click('[data-command="approve"]');
      await page.waitForSelector('.etl-success');
      await page.$eval('.etl-tabs [data-tab="history"]', e => e.click());
      assert.equal(await page.$eval('.etl-body tbody .etl-state', e => e.textContent), 'Approved', 'Approval must update history immediately, without a reload');
      assert.equal(await page.$eval('.etl-body tbody tr td:nth-child(7)', e => e.textContent), '0', 'Approved fixture must not contain unresolved exceptions');
      await page.screenshot({ path: path.join(out, 'approved-history-desktop.png') });
    }
    await page.evaluate(() => { etlTest.fail = true; }); await page.$eval('[data-command="refresh"]', e => e.click()); await page.waitForSelector(".etl-error");
    await page.evaluate(() => { etlTest.fail = false; }); await page.$eval('[data-command="refresh"]', e => e.click()); await page.waitForFunction(() => !document.querySelector(".etl-error"));
    await page.evaluate(() => { location.hash = "resources"; }); await page.waitForSelector("#ref-products");
    assert.equal(await page.$$eval('#etlReferenceFiles [data-ref-role]', e => e.length), process.env.NEXUS_ETL_FEEDBACK ? 8 : 7);
    assert.equal(await page.$('#ref-template'),null);assert.equal(await page.$eval('#ref-inventorySample',e=>e.value),'inventorySample');assert.equal(await page.$eval('#ref-salesSample',e=>e.value),'salesSample');
    await page.click('[data-ref-edit="products"]'); await page.waitForFunction(() => document.getElementById('resourceId').value === 'products');
    assert.equal(await page.$eval('#resourceFile', e => e.files.length), 0, 'Editing a saved master must not require uploading it again');
    await page.$eval('[data-ref-add="inventorySample"]', e => e.click());
    await page.waitForFunction(() => document.getElementById('resourceTitle').value === 'Inventory transformed sample');
    assert.equal(await page.$eval('#resourceCategory', e => e.value), 'Reference');
    assert.equal(await page.$eval('#resourceTitle', e => e.value), 'Inventory transformed sample');
    await page.select('#ref-products', 'products-new'); await page.click('[data-ref-save]');
    await page.waitForFunction(() => document.getElementById('etlReferenceFiles').textContent.includes('Saved set v2'));
    for (const width of [1440, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      await page.$eval('#etlReferenceFiles', e => e.scrollIntoView({ block: 'start' }));
      const size = await page.$eval('#etlReferenceFiles', e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(size.width > 0 && size.scroll <= size.width + 1, `Shared file controls overflow at ${width}`);
      await page.screenshot({ path: path.join(out, `shared-resources-${width}.png`) });
    }
    await page.evaluate(() => { location.hash = 'etls'; }); await page.waitForSelector('.etl-tabs'); await page.$eval('[data-tab="run"]', e => e.click());
    await page.waitForFunction(() => document.querySelector('.etl-reference-summary')?.textContent.includes('products-new.xlsx'));
    assert.equal(await page.$eval('#etl-raw', e => e.value), '');
    await page.setViewport({width:1440,height:1000});
    await page.select('#etl-context-channel','clicks');await page.select('#etl-context-customer','Ethica');
    await page.select('#etl-context-kind',pipelineId('Ethica','clicks','Sales'));await page.click('.etl-tabs [data-tab="run"]');
    await page.waitForSelector('#etlRunForm');assert.equal(await page.$('[name="salesDays"]'),null,'Measured sales must not expose DROS controls');
    assert.equal(await page.$$eval('[data-upload]',els=>els.length),1);await page.select('#etl-raw','raw');
    await page.click('#etlRunForm [type="submit"]');await page.waitForSelector('.etl-reconcile');
    assert.ok(await page.$eval('.etl-reconcile',e=>e.textContent.includes('Units 2 = ready 2 + exceptions 0')));
    assert.ok(await page.$eval('.etl-reconcile',e=>!e.textContent.includes('SOH')));
    await page.click('.etl-tabs [data-tab="outputs"]');assert.equal(await page.$$eval('.etl-preview th',els=>els.length),20);
    assert.ok(await page.$eval('.etl-body',e=>e.textContent.includes('Ethica / Clicks output') && !e.textContent.includes('DROS x undefined')));
    for(const width of [1440,390,320]){await page.setViewport({width,height:1000});const bounds=await page.$eval('#meridianEtls',e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+1);await page.screenshot({path:path.join(out,`sales-output-${width}.png`)});}
    await page.evaluate(() => { etlTest.delay = true; document.querySelector('[data-command="refresh"]').click(); });
    await page.evaluate(() => etlTest.signOut()); await new Promise(r => setTimeout(r, 1200));
    assert.equal(await page.$(".etl-section"), null, "Sign-out must clear ETL data even with pending responses.");
    assert.equal(await page.$eval('#etlReferenceFiles', e => e.textContent), '');
    assert.deepEqual(errors, []);
    console.log("ETLs: customer/channel dropdowns, customer creation, portal runs, access controls, seven tabs, review/approval, downloads, mobile widths, error recovery and sign-out isolation passed.");
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
