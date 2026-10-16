const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),portal=process.env.NEXUS_PORTAL_STAGE||path.join(root,'public'),out=path.join(root,'.tmp/support-verification');
const puppeteer=require(path.join(root,'functions/node_modules/puppeteer-core')),{createServer}=require('../chat-preview.cjs');
async function main(){
  fs.mkdirSync(out,{recursive:true});const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let browser;
  try{
    browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions','--no-first-run']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});
    const ticket={id:'SUP-0123456789ABCDEF',subject:'Attendance export is not opening',description:'The September attendance export shows an error after selecting Gauteng.',module:'Time & Attendance',priority:'high',status:'open',ownerUid:'normal',ownerName:'Test staff member',assigneeUid:'',assigneeName:'Unassigned',revision:1,createdAt:'2026-09-11T04:00:00Z',updatedAt:'2026-09-11T04:00:00Z',attachments:[],messageCount:0};
    let tickets=[ticket],messages=[];const calls=[];
    await page.exposeFunction('supportFixture',async input=>{
      calls.push(input);if(input.__delay)await new Promise(r=>setTimeout(r,500));if(input.__fail&&['create','reply','update'].includes(input.action))throw new Error('Simulated connection interruption');
      if(input.action==='list')return {tickets:tickets.filter(t=>input.status==='all'||t.status===input.status),next:null};
      if(input.action==='directory')return {admins:[{uid:'admin',name:'Test administrator'}]};
      if(input.action==='get')return {ticket:tickets.find(t=>t.id===input.ticketId),messages,older:null};
      if(input.action==='download')return {name:'support-test.txt',mime:'text/plain',base64:Buffer.from('Synthetic ticket evidence').toString('base64')};
      if(input.action==='create'){const t={...ticket,id:'SUP-FEDCBA9876543210',subject:input.subject,module:input.module,description:input.description,priority:input.priority,attachments:(input.attachments||[]).map((f,i)=>({id:`test-${i}`,name:f.name,size:24}))};tickets.push(t);messages=[];return {ticketId:t.id};}
      const t=tickets.find(t=>t.id===input.ticketId);t.revision++;t.messageCount++;t.updatedAt=new Date().toISOString();
      if(input.action==='reply')messages.push({id:'message-'+t.revision,authorName:input.__role==='admin'?'Test administrator':'Test staff member',authorRole:input.__role,text:input.text,kind:'reply',createdAt:t.updatedAt,attachments:[]});
      if(input.action==='update'){Object.assign(t,{status:input.status,priority:input.priority,assigneeUid:input.assigneeUid,assigneeName:'Test administrator'});messages.push({id:'update-'+t.revision,authorName:'Test administrator',authorRole:'admin',kind:'update',text:input.note,createdAt:t.updatedAt});}
      if(input.action==='reopen')t.status='open';return {ticketId:t.id};
    });
    await page.setRequestInterception(true);page.on('request',request=>{
      const url=new URL(request.url());
      if(url.origin===origin&&(url.pathname==='/'||['app.js','meridian-support.js','meridian-support.css','styles.css','job-status.js','job-status.css'].includes(url.pathname.slice(1)))){const name=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.join(portal,name);return request.respond({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(fs.existsSync(file)?file:path.join(root,'public',name))});}
      if(url.pathname.startsWith('/__/firebase/')||url.pathname==='/service-worker.js')return request.respond({status:200,contentType:'text/javascript',body:'/* isolated test SDK */'});
      if(url.origin===origin)return request.continue();
      const name=url.hostname==='fonts.googleapis.com'?'manrope.css':path.basename(url.pathname),preferred=path.join(root,'.tmp/franchise-verification/vendor',name),vendor=fs.existsSync(preferred)?preferred:path.join(root,'.tmp/chat-verification/vendor',name);
      if(fs.existsSync(vendor))return request.respond({status:200,headers:{'access-control-allow-origin':'*'},contentType:name.endsWith('.css')?'text/css':'font/woff2',body:fs.readFileSync(vendor)});return request.abort();
    });
    await page.evaluateOnNewDocument(()=>{
      const test=window.spTest={calls:[],callback:null,role:'normal'};
      const auth={currentUser:null,onAuthStateChanged(cb){test.callback=cb;setTimeout(()=>cb(null),0);},async signOut(){auth.currentUser=null;return test.callback(null);}};
      function query(){const q={where:()=>q,orderBy:()=>q,limit:()=>q,doc:()=>q,collection:()=>q,get:async()=>({docs:[],exists:false}),onSnapshot(...args){const cb=args.find(a=>typeof a==='function');let stopped=false;setTimeout(()=>{if(!stopped)cb({docs:[],size:0,exists:false,metadata:{fromCache:false}});},0);return()=>stopped=true;}};return q;}
      const db={settings(){},collection:query},functions={httpsCallable:name=>async data=>{test.calls.push({name,data});if(name==='meridianSupport')return {data:await window.supportFixture({...data,__role:test.role,__delay:test.delay,__fail:test.fail})};if(name==='getOperationsWorkspace')return {data:{account:{uid:auth.currentUser.uid,role:test.role,permissions:{allowedNavigationIds:[],chatEnabled:false}},profiles:[],runs:[],prompts:[],alerts:[]}};return {data:{}};}};
      window.firebase={firestore:()=>db,auth:()=>auth,storage:()=>({setMaxUploadRetryTime(){},setMaxOperationRetryTime(){}}),app:()=>({functions:()=>functions})};
      test.signIn=async kind=>{test.role=kind;const claims=kind==='admin'?{admin:true,email:'admin@example.test'}:kind==='client'?{chatClient:true,nexusRole:'client'}:{operator:true,nexusRole:'normal'};auth.currentUser={uid:kind,email:claims.email||`${kind}@example.test`,async getIdTokenResult(){return {claims};}};await test.callback(auth.currentUser);};test.signOut=()=>auth.signOut();
    });
    await page.goto(origin+'/#support',{waitUntil:'networkidle2'});assert.deepEqual(errors,[]);assert.equal(calls.length,0);await page.waitForFunction(()=>document.querySelector('#nexusLoginDialog').open);
    await page.evaluate(()=>spTest.signIn('normal'));await page.waitForSelector('#meridianSupport .sp-ticket-row');
    await page.waitForFunction(()=>!document.getElementById('appLoader')||getComputedStyle(document.getElementById('appLoader')).opacity==='0');
    assert.equal(await page.evaluate(()=>location.hash),'#support');assert.equal(await page.$eval('#supportView',e=>e.hidden),false);
    assert.equal(await page.$eval('#supportPrimaryNav [data-open-view="support"]',e=>e.hidden),false);assert.equal(await page.$eval('#supportPrimaryNav [data-open-view="admin"]',e=>e.hidden),true);
    assert.equal(await page.$$('#meridianSupport [data-sp-action="admin"]').then(e=>e.length),0);
    await page.click('.sp-ticket-row');await page.waitForSelector('.sp-detail h2');assert.equal(await page.$$('.sp-admin-form').then(e=>e.length),0);
    await page.screenshot({path:path.join(out,'staff-desktop.png')});
    await page.click('[data-sp-action="new"]');await page.type('[name="subject"]','Stock Fix filter issue <img src=x onerror=alert(1)>');await page.select('[data-sp-draft="module"]','Stock Fix');await page.type('.sp-create-form [name="description"]','The store filter keeps the previous selection after refresh.');
    await page.click('[data-sp-action="refresh"]');await page.waitForFunction(()=>document.querySelector('.sp-ticket-list').getAttribute('aria-busy')==='false');assert.equal(await page.$eval('.sp-create-form [name="description"]',e=>e.value),'The store filter keeps the previous selection after refresh.');
    const evidence=path.join(out,'support-test.txt');fs.writeFileSync(evidence,'Synthetic ticket evidence');await(await page.$('[data-sp-files]')).uploadFile(evidence);await page.waitForSelector('.sp-selected-files');
    await page.evaluate(()=>spTest.fail=true);await page.click('.sp-create-form [type="submit"]');await page.waitForFunction(()=>document.querySelector('.sp-feedback')?.textContent.includes('Simulated'));
    assert.equal(await page.$eval('[name="subject"]',e=>e.value),'Stock Fix filter issue <img src=x onerror=alert(1)>');
    await page.evaluate(()=>spTest.fail=false);await page.click('.sp-create-form [type="submit"]');await page.waitForFunction(()=>document.querySelector('.sp-detail h2')?.textContent.startsWith('Stock Fix filter issue'));
    const creates=calls.filter(c=>c.action==='create');assert.equal(creates.length,2);assert.equal(creates[0].requestId,creates[1].requestId);assert.equal(creates[1].attachments.length,1);assert.equal(await page.$$('.sp-detail img').then(e=>e.length),0);
    await page.waitForFunction(()=>!document.querySelector('.sp-reply-form fieldset').disabled);await page.type('[name="reply"]','I have attached the error details.');await page.click('.sp-reply-form [type="submit"]');await page.waitForFunction(()=>document.querySelector('.sp-messages').textContent.includes('error details'));
    const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});await page.click('[data-sp-download]');
    await page.waitForFunction(()=>spTest.calls.some(c=>c.name==='meridianSupport'&&c.data.action==='download'));
    for(const width of [390,320]){
      await page.setViewport({width,height:844});await page.screenshot({path:path.join(out,`staff-mobile-${width}.png`)});
      const sizes=await page.$eval('#meridianSupport',e=>({w:e.clientWidth,s:e.scrollWidth}));assert.ok(sizes.s<=sizes.w+1,JSON.stringify(sizes));
      await page.click('[data-sp-action="back"]');assert.equal(await page.$eval('.sp-queue',e=>getComputedStyle(e).display),'flex');await page.click('.sp-ticket-row');await page.waitForSelector('.sp-detail h2');
      await page.click('#supportNavToggle');assert.equal(await page.$eval('#supportNavToggle',e=>e.getAttribute('aria-expanded')),'true');await page.click('#supportPrimaryNav [data-open-view="support"]');assert.equal(await page.$eval('#supportNavToggle',e=>e.getAttribute('aria-expanded')),'false');
    }
    await page.setViewport({width:1440,height:1000});await page.evaluate(()=>{spTest.delay=true;document.querySelector('[data-sp-action="refresh"]').click();});await page.click('[data-sp-action="new"]');await new Promise(r=>setTimeout(r,800));assert.ok(await page.$('.sp-create-form'),'late detail response does not replace new form');
    await page.evaluate(()=>{spTest.delay=false;});await page.click('[data-sp-action="cancel"]');
    await page.evaluate(()=>spTest.signOut());assert.equal(await page.$$('#meridianSupport .sp-ticket-row').then(e=>e.length),0);
    await page.evaluate(()=>spTest.signIn('admin'));await page.evaluate(()=>{location.hash='support';});await page.waitForSelector('[data-sp-action="admin"]');await page.click('[data-sp-action="admin"]');await page.waitForSelector('#adminSupport .sp-ticket-row');
    assert.equal(await page.$eval('[data-admin-panel="support"]',e=>e.hidden),false);await page.click('#adminSupport .sp-ticket-row');await page.waitForSelector('.sp-admin-form');
    await page.select('[data-sp-update="assigneeUid"]','admin');await page.select('[data-sp-update="status"]','resolved');await page.type('[data-sp-update="note"]','Reviewed and corrected the export mapping.');await page.click('.sp-admin-form [type="submit"]');
    await page.waitForFunction(()=>document.querySelector('#adminSupport .sp-detail>header .sp-status').textContent==='Resolved');assert.ok(calls.some(c=>c.action==='update'&&c.assigneeUid==='admin'&&c.note.includes('mapping')));
    await page.screenshot({path:path.join(out,'admin-desktop.png')});
    for(const width of [390,320]){await page.setViewport({width,height:844});await page.$eval('#adminSupport .sp-detail',e=>e.scrollIntoView({block:'start'}));const sizes=await page.$eval('#adminSupport',e=>({w:e.clientWidth,s:e.scrollWidth}));assert.ok(sizes.s<=sizes.w+1,`Admin ${JSON.stringify(sizes)}`);await page.screenshot({path:path.join(out,`admin-mobile-${width}.png`)});}
    await page.$eval('[data-sp-action="reopen"]',e=>e.click());await page.waitForFunction(()=>document.querySelector('#adminSupport .sp-detail>header .sp-status').textContent==='Open');
    await page.evaluate(()=>spTest.signOut());await page.evaluate(()=>spTest.signIn('client'));await page.evaluate(()=>{location.hash='support';});await new Promise(r=>setTimeout(r,300));assert.equal(await page.$$('#meridianSupport .sp-ticket-row').then(e=>e.length),0);
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({passed:true,calls:calls.length,staffPrivacyUI:true,adminWorkflow:true,desktopMobile:true,retrySafety:true},null,2));console.log('PASS: Support staff/admin routes, submit with file, retry identity, replies, assignment/resolution, reopen, session changes, clients blocked and 320/390px layouts.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
