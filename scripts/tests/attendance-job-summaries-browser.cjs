"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const puppeteer = require("../../functions/node_modules/puppeteer-core");
const { createServer } = require("../chat-preview.cjs");
const root = path.resolve(__dirname, "../..");
const assets = process.env.JOB_SUMMARIES_ASSET_DIR || path.join(root,"public");
const out = path.join(root, ".tmp/job-summaries-verification");
const history = Array.from({ length: 20 }, (_, i) => ({ attendanceDate: `2026-09-${String(20-i).padStart(2,"0")}`, validVisits: 476, actualStores: 430, plannedRows: 500, matchedStoreCodes: 450, sourceFileName: i ? "Salesforce_PG_Rep_Attendance_Daily.xlsx" : '<img src=x onerror="window.bad=true">.xlsx', completedAt: "2026-09-09T07:00:00Z" }));
const snapshot = { id: "daily-saved", fileName: "Attendance Blueprint.xlsx", createdAt: "2026-09-09T07:00:00Z", workbook: { preWriteBackupId: "backup-test" }, worksheet: { name: "Daily", rowCount: 450, columnCount: 3, rows: [["Date", "Store", "Actual"], ["2026-09-07", "TEST_STORE", 1]] } };
const fixture = {
  daily: { month: "2026-09", metrics: { runs: 20, validVisits: 9520, actualStores: 8600, plannedRows: 10000, sourceRows: 11000, coverageRate: 86 }, history,
    activity: history.map(r => ({ label:r.attendanceDate, value:r.actualStores, detail:"430 attended rows of 500 plan rows" })), quality: history.map(r => ({ label:r.attendanceDate, value:r.validVisits, detail:"476 eligible visits; 450 matched stores" })), workbookSnapshot: snapshot },
  monthly: { month: "2026-08", metrics: { actualVisits: 8238, actualWeeks: 4, eligibleVisits: 2102, sourceRows: 2206, plannedRows: 3973, compliantRows: 2140 },
    latest: { monthlyPlan: { updatedCells: 15892, plannedRows: 3973 } },
    weeklyActuals: [1,2,3,4].map(week => ({week,actual:week*500,rangeStart:"2026-08-01",rangeEnd:"2026-08-31"})),
    history: [{ rangeStart:"2026-08-01",rangeEnd:"2026-08-31", actualWeeks:{1:500,2:1000,3:1500,4:2000},eligibleVisits:2102,sourceRows:2206,reconcileAllWeeks:true,sourceFileName:"Combined attendance export.xlsx",completedAt:"2026-09-01T07:00:00Z" }], workbookSnapshot:{...snapshot,id:"monthly-saved",worksheet:{...snapshot.worksheet,name:"South Africa Visit Plan"}} },
  dedicatedCallCycle: {records:[{storeCode:"D1",store:"TEST Dedicated Store",rep:"TEST Rep",employeeId:"E1",division:"Inland",region:"Gauteng",channel:"Test channel",banner:"Test banner",repType:"Dedicated rep",manager:"TEST Manager",status:"Active",frequency:"Weekly",plannedDays:1,scheduledWeeks:4,callsPerMonth:4,weekdayVisits:{Monday:1},smartSellWeeks:{1:1,2:1,3:1,4:1},trax:false,gold:false,posh:false}],source:{fileName:"TEST Master.xlsx",worksheet:"TEST Plan",rowCount:1}}
};

async function main() {
  fs.mkdirSync(out,{recursive:true});
  const server=createServer(); await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await puppeteer.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true,args:["--disable-extensions","--no-first-run"]});
    const page=await browser.newPage(),errors=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width:1440,height:1000});
    await page.setRequestInterception(true);
    page.on("request",request=>{
      const url=new URL(request.url());
      if(url.origin===origin && url.pathname==="/")return request.respond({status:200,contentType:"text/html",body:fs.readFileSync(path.join(assets,"index.html"))});
      if(url.origin===origin && url.pathname==="/app.js")return request.respond({status:200,contentType:"text/javascript",body:fs.readFileSync(path.join(assets,"app.js"))});
      if(url.pathname.startsWith("/__/firebase/") || url.pathname==="/service-worker.js")return request.respond({status:200,contentType:"text/javascript",body:"/* isolated fixture SDK */"});
      if(url.origin===origin)return request.continue();
      const name=url.hostname==="fonts.googleapis.com"?"manrope.css":path.basename(url.pathname);
      const candidates=[path.join(root,".tmp/franchise-verification/vendor",name),path.join(root,".tmp/chat-verification/vendor",name)];
      const vendor=candidates.find(f=>fs.existsSync(f));
      if(vendor)return request.respond({status:200,headers:{"access-control-allow-origin":"*"},contentType:name.endsWith(".css")?"text/css":"font/woff2",body:fs.readFileSync(vendor)});
      return request.abort();
    });
    await page.evaluateOnNewDocument(fixture=>{
      const t=window.jobTest={calls:[],allowed:true,fail:false,delay:false,fixture};
      const auth={currentUser:null,onAuthStateChanged(cb){t.callback=cb;setTimeout(()=>cb(null),150);},async signOut(){auth.currentUser=null;return t.callback(null);}};
      function query(){const q={where:()=>q,orderBy:()=>q,limit:()=>q,doc:()=>q,collection:()=>q,get:async()=>({docs:[],exists:false}),onSnapshot(...args){const cb=args.find(a=>typeof a==="function");let stopped=false;setTimeout(()=>{if(!stopped)cb({docs:[],size:0,exists:false,metadata:{fromCache:false}});},0);return()=>stopped=true;}};return q;}
      const db={settings(){},collection:query};
      const functions={httpsCallable:name=>async data=>{
        t.calls.push({name,data});
        if(name==="getOperationsWorkspace")return{data:{account:{uid:auth.currentUser.uid,role:auth.currentUser.kind,permissions:{allowedNavigationIds:t.allowed?["automation","attendance"]:["automation"],allowedRetailerIds:["unrelated-test-automation"],chatEnabled:false}},profiles:[],runs:[],prompts:[],alerts:[]}};
        if(name==="manageSyndicatedAttendanceExclusions")return{data:{revision:0,entries:[],history:[]}};
        if(name==="getGeoRepAttendanceDashboard")return{data:{metrics:{users:1,scheduled:4,onSchedule:3,strikeRate:75},rows:[{userName:"TEST Rep",role:"Syndicated rep",region:"Gauteng",manager:"TEST Manager",scheduled:4,onSchedule:3,strikeRate:75}],stores:[{storeName:"TEST Syndicated Store",storeCodes:["S1"],resources:["TEST Rep"],regions:["Gauteng"],region:"Gauteng",roles:["Syndicated rep"],divisions:["Inland"],managers:["TEST Manager"],banners:["Test banner"],channels:["Test channel"],dates:["2026-09-01"],weeks:[1,2,3,4],scheduled:4,attended:3}],source:{strikeRate:{fileName:"TEST Strike Rate.xlsx"},schedules:{fileName:"TEST Schedules.xlsx"}},filters:{},charts:{}}};
        if(name==="getSalesforceAttendanceDashboard") {if(t.delay)await new Promise(r=>setTimeout(r,800));if(t.fail)throw new Error("Test source unavailable");return{data:t.empty?{daily:{},monthly:{}}:fixture};}
        if(name==="getSalesforceAttendanceWorkbookSnapshotRows") {if(t.delay)await new Promise(r=>setTimeout(r,800));if(t.failRows)throw new Error("Test snapshot unavailable");return{data:{...fixture.daily.workbookSnapshot,worksheet:{...fixture.daily.workbookSnapshot.worksheet,rows:[{rowNumber:data.offset+1,cells:["2026-09-07","TEST_STORE",1]}]},previousOffset:data.offset?0:null,nextOffset:data.offset?null:200}};}
        return{data:{}};
      }};
      window.firebase={firestore:()=>db,auth:()=>auth,storage:()=>({setMaxUploadRetryTime(){},setMaxOperationRetryTime(){}}),app:()=>({functions:()=>functions})};
      t.signIn=async kind=>{const claims=kind==="admin"?{email:"admin@nexus.co.za",admin:true}:kind==="client"?{nexusRole:"client",chatClient:true}:{operator:true,nexusRole:"normal"};auth.currentUser={kind,uid:kind,email:claims.email||`${kind}@example.test`,async getIdTokenResult(){return{claims};}};await t.callback(auth.currentUser);};
      t.signOut=()=>auth.signOut();
    },fixture);
    await page.goto(`${origin}/#attendance-jobs`,{waitUntil:"networkidle2"});
    await page.waitForFunction(()=>document.getElementById("nexusLoginDialog")?.open);
    assert.equal(await page.evaluate(()=>jobTest.calls.some(c=>c.name==="getSalesforceAttendanceDashboard")),false);
    await page.evaluate(()=>jobTest.signIn("normal"));
    await page.waitForFunction(()=>!document.getElementById("attendanceJobSummaryResults").hidden);
    assert.equal(await page.evaluate(()=>location.hash),"#attendance-jobs");
    await page.waitForFunction(()=>!document.getElementById("appLoader") || getComputedStyle(document.getElementById("appLoader")).opacity==="0");
    assert.equal(await page.$eval("#attendanceStandardHeader",e=>getComputedStyle(e).display),"none");
    assert.equal(await page.$eval("#attendanceStandardControls",e=>getComputedStyle(e).display),"none");
    async function assertJobHeading() {
      assert.equal(await page.$eval("#attendanceStandardHeader",e=>e.hidden),true);
      assert.equal(await page.$eval("#attendanceStandardControls",e=>e.hidden),true);
      assert.equal(await page.$eval(".job-summary-heading h1",e=>e.textContent),"Job Summaries");
      assert.equal(await page.$(".job-summary-heading .eyebrow"),null);
      assert.deepEqual(await page.$$eval("#attendanceDashboardView .nexus-workspace-content h1",headings=>headings.filter(e=>e.getClientRects().length).map(e=>e.textContent)),["Job Summaries"]);
    }
    await assertJobHeading();
    await page.$eval('link[href^="attendance-job-summaries.css"]',e=>e.disabled=true);
    assert.equal(await page.$eval("#attendanceStandardHeader",e=>getComputedStyle(e).display),"none");
    await page.$eval('link[href^="attendance-job-summaries.css"]',e=>e.disabled=false);
    assert.equal(await page.$eval("#salesforceDailyRows",e=>e.rows.length),20);
    assert.equal(await page.$eval("#salesforceDailyRows img",e=>true).catch(()=>false),false);
    assert.equal(await page.evaluate(()=>window.bad),undefined);
    assert.match(await page.$eval("#salesforceDailyPlanned",e=>e.textContent),/10\D?000/);
    await page.screenshot({path:path.join(out,"daily-desktop.png")});
    await page.click('[data-job-summary-tab="monthly"]');
    await assertJobHeading();
    assert.equal(await page.$eval("#attendanceJobDaily",e=>e.hidden),true);
    assert.match(await page.$eval("#attendanceJobSummaryPeriod",e=>e.textContent),/2026-08/);
    assert.match(await page.$eval("#salesforceMonthlyUpdatedCells",e=>e.textContent),/15\D?892/);
    await page.screenshot({path:path.join(out,"monthly-desktop.png")});
    await page.keyboard.press("ArrowLeft");
    await page.click('#salesforceDailySnapshot [data-salesforce-snapshot-load]');
    await page.waitForSelector('#salesforceDailySnapshot [data-salesforce-snapshot-offset="200"]');
    await page.click('#salesforceDailySnapshot [data-salesforce-snapshot-offset="200"]');
    await page.waitForFunction(()=>document.querySelector("#salesforceDailySnapshot tbody th")?.textContent==="201");
    await page.evaluate(()=>jobTest.failRows=true);
    await page.click('#salesforceDailySnapshot [data-salesforce-snapshot-offset="0"]');
    await page.waitForFunction(()=>document.getElementById("salesforceDailySnapshot").textContent.includes("Test snapshot unavailable"));
    await page.evaluate(()=>jobTest.failRows=false);
    for(const width of [390,320]) {
      await page.setViewport({width,height:844});
      await page.$eval("#attendanceDashboardView .nexus-workspace-content",e=>e.scrollTo(0,0));
      await assertJobHeading();
      await page.screenshot({path:path.join(out,`daily-mobile-${width}.png`)});
      const size=await page.$eval("#attendanceJobSummaries",e=>({width:e.clientWidth,scroll:e.scrollWidth}));
      assert.ok(size.scroll<=size.width+1,JSON.stringify(size));
    }
    await page.setViewport({width:1440,height:1000});
    await page.evaluate(()=>openAttendanceDashboard());
    await page.waitForFunction(()=>location.hash==="#attendance" && document.getElementById("attendanceJobSummaries").hidden);
    for(const source of ["salesforce","geo"]) {
      await page.evaluate(source=>setAttendanceDashboardSource(source),source);
      await page.waitForFunction(()=>!state.attendanceDashboardLoading && !state.salesforceAttendanceDashboardLoading);
      for(const tab of ["overview","daily","users","stores"]) {
        await page.evaluate(tab=>setAttendanceCoveragePage(tab),tab);
        assert.equal(await page.evaluate(()=>location.hash),"#attendance");
        assert.equal(await page.$eval("#attendanceStandardHeader",e=>e.hidden),false);
        assert.equal(await page.$eval("#attendanceWorkspaceKicker",e=>e.textContent),source==="salesforce"?"Dedicated Attendance":"Syndicated Attendance");
      }
    }
    await page.$eval('#attendanceDashboardView [data-tree-toggle="callcycle"]',e=>e.click());
    await page.waitForFunction(()=>location.hash==="#callcycle" && !state.callCycleLoading);
    for(const source of ["dedicated","syndicated"]) {
      await page.evaluate(source=>setCallCycleSource(source),source);
      for(const tab of ["overview","divisions","reps","stores"]) {
        await page.evaluate(tab=>setCallCyclePage(tab),tab);
        assert.equal(await page.evaluate(()=>location.hash),"#callcycle");
        const content=await page.$eval("#salesforceDedicatedCallCycle",e=>e.textContent);
        assert.ok(content.length>100 && !content.includes("Admin access is required"));
      }
      await page.screenshot({path:path.join(out,`normal-${source}-callcycle-desktop.png`)});
    }
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(out,"normal-callcycle-mobile.png")});
    assert.equal(await page.evaluate(()=>location.hash),"#callcycle");
    await page.setViewport({width:1440,height:1000});
    await page.evaluate(()=>jobTest.signIn("admin"));
    await page.evaluate(()=>{location.hash="admin";});await page.waitForFunction(()=>!document.getElementById("adminPage").hidden);
    await page.evaluate(()=>activateAdminTab("geo-attendance"));await page.waitForSelector('#attendanceExclusionsAdmin .aex-form');
    assert.ok(await page.evaluate(()=>jobTest.calls.some(c=>c.name==="manageSyndicatedAttendanceExclusions")));
    await page.evaluate(()=>{location.hash="attendance";});
    await page.waitForFunction(()=>document.getElementById("attendanceJobSummaries").hidden);
    assert.equal(await page.$eval('#attendanceExclusionsAdmin',e=>e.children.length),0);
    assert.notEqual(await page.$eval("#attendanceStandardHeader",e=>getComputedStyle(e).display),"none");
    const nav="#attendanceDashboardView .nexus-attendance-submenu";
    await page.$eval('#attendanceDashboardView [data-tree-toggle="attendance"]',e=>{if(e.getAttribute("aria-expanded")!=="true")e.click();});
    await page.click(`${nav} [data-attendance-jobs]`);
    await page.waitForFunction(()=>!document.getElementById("attendanceJobSummaryResults").hidden);
    await assertJobHeading();
    assert.equal(await page.$eval(`${nav} [data-attendance-jobs]`,e=>e.getAttribute("aria-current")),"page");
    await page.evaluate(()=>jobTest.fail=true);await page.click("#attendanceJobSummaryRefresh");
    await page.waitForFunction(()=>document.getElementById("attendanceJobSummaryStatus").textContent.includes("Could not load"));
    await page.evaluate(()=>{jobTest.fail=false;jobTest.empty=true;});await page.click("#attendanceJobSummaryRefresh");
    await page.waitForFunction(()=>document.getElementById("attendanceJobSummaryStatus").textContent.includes("No completed"));
    await page.evaluate(()=>{jobTest.empty=false;jobTest.delay=true;document.getElementById("attendanceJobSummaryRefresh").click();});
    await page.evaluate(()=>jobTest.signOut());await new Promise(r=>setTimeout(r,1000));
    assert.equal(await page.$eval("#attendanceJobSummaryResults",e=>e.hidden),true);
    assert.equal(await page.$eval("#salesforceDailyPlanned",e=>e.textContent),"-");
    await page.evaluate(()=>{jobTest.allowed=false;return jobTest.signIn("normal");});
    await page.evaluate(()=>{location.hash="attendance-jobs";});await page.waitForFunction(()=>location.hash!=="#attendance-jobs");
    assert.notEqual(await page.evaluate(()=>location.hash),"#attendance-jobs");
    assert.deepEqual(errors,[]);
    console.log("PASS: normal staff without Geo automation permission can open Dedicated/Syndicated Attendance and all Call Cycle tabs. Job Summaries, desktop/mobile, auth, denied access and sign-out regressions passed.");
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
