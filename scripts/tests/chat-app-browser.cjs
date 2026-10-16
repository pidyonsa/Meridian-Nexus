const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require('../../functions/node_modules/puppeteer-core');
const {createServer}=require('../chat-preview.cjs');
const output=path.resolve('.tmp/chat-app-20260910/browser');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-extensions']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
    await page.setRequestInterception(true);page.on('request',r=>new URL(r.url()).hostname==='127.0.0.1'?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});await page.goto(`http://127.0.0.1:${server.address().port}/?enhanced#chat`,{waitUntil:'networkidle0'});await page.waitForSelector('[data-room=field]');
    if(process.env.NEXUS_CHAT_WARM){
      await page.click('[data-room=field]');await page.waitForSelector('.mc-compose textarea');
      await page.type('.mc-compose textarea','Draft retained when changing dashboards');
      const before=await page.evaluate(()=>chatTest.calls.filter(c=>c.action==='bootstrap').length);
      await page.evaluate(()=>{chatTest.session.setVisible(false);chatTest.session.setVisible(true);});
      assert.equal(await page.$eval('.mc-compose textarea',e=>e.value),'Draft retained when changing dashboards');
      assert.equal(await page.evaluate(()=>chatTest.calls.filter(c=>c.action==='bootstrap').length),before);
      await page.evaluate(()=>{const original=window.matchMedia.bind(window);window.matchMedia=q=>q==='(pointer: fine)'?{matches:true,addEventListener(){},removeEventListener(){}}:original(q);});
      await page.focus('.mc-compose textarea');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');
      assert.ok((await page.$eval('.mc-compose textarea',e=>e.value)).includes('\n'));
      await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.mc-compose textarea').value==='');
      await page.screenshot({path:path.join(output,'chat-warm-desktop.png')});
    }
    await page.addStyleTag({url:'/nexus-comms.css'});await page.addScriptTag({url:'/nexus-comms.js'});
    await page.evaluate(()=>{
      const button=[...document.querySelectorAll('.nexus-workspace-nav button')].find(b=>b.textContent==='Meridian Chat');button.dataset.openView='chat';
      window.activity={unreadChats:4,events:[]};window.listeners=[];window.toasts=[];window.tones=0;
      const Original=window.AudioContext;window.AudioContext=class extends Original{createOscillator(){window.tones++;return super.createOscillator();}};
      const q={where(){return this;},orderBy(){return this;},limit(){return this;},doc(){return this;},collection(){return this;},onSnapshot(next,error){const item={next,error};listeners.push(item);return()=>listeners.splice(listeners.indexOf(item),1);}};
      window.commsOptions={uid:'admin',database:{collection:()=>q},call:async(name,data)=>data.action==='activity'?structuredClone(activity):chatTest.service.call(data),toast:s=>toasts.push(s)};
      NexusComms.sync(commsOptions);
    });
    await page.waitForFunction(()=>document.querySelector('.nexus-chat-badge')?.textContent==='4');
    assert.equal(await page.$eval('[data-open-view=chat]',b=>b.getAttribute('aria-label')),'Meridian Chat, 4 unread conversations');
    await page.click('[data-nexus-alerts]');await page.waitForSelector('.nexus-app-dialog[open]');await page.click('[data-app-test]');
    await page.waitForFunction(()=>tones===2);await page.click('[data-app-close]');
    await page.evaluate(async()=>{activity={unreadChats:105,events:[{id:'event-1',kind:'task',roomId:'field',at:Date.now()}]};await NexusComms.refresh();await NexusComms.refresh();});
    await page.waitForFunction(()=>tones===4);assert.equal(await page.$eval('.nexus-chat-badge',b=>b.textContent),'99+');
    await page.click('[data-nexus-alerts]');await page.select('[name=appMute]','1');await page.click('[data-app-close]');
    await page.evaluate(async()=>{activity.events=[{id:'event-2',kind:'message',roomId:'field',at:Date.now()}];await NexusComms.refresh();});assert.equal(await page.evaluate(()=>tones),4);
    await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.installedPrompt=true;};event.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(event);});
    await page.click('[data-nexus-install]');assert.equal(await page.evaluate(()=>installedPrompt),true);
    await page.click('[data-action=my-tasks]');await page.waitForSelector('[data-action=task-new]');await page.click('[data-action=task-new]');await page.waitForSelector('.mc-task-dialog[open]');
    await page.type('.mc-task-form [name=title]','Verify shelf availability');await page.type('.mc-task-form [name=store]','Gauteng sample store');
    await page.$eval('[name=dueDate]',n=>{n.value='2020-01-01';});await page.select('.mc-task-form [name=priority]','high');
    await page.click('[data-action=task-add-step]');await page.type('.mc-checklist-row [type=text]','Count stock on shelf');await page.click('[name=requireCompletionNote]');
    await page.screenshot({path:path.join(output,'task-draft-desktop.png')});
    await page.click('.mc-task-form [type=submit]');await page.waitForSelector('.mc-task-row');
    const created=await page.evaluate(()=>chatTest.calls.find(c=>c.action==='taskCreateDirect'));assert.equal(created.checklist.length,1);assert.equal(created.requireCompletionNote,true);assert.equal(created.messageId,undefined);
    await page.click('[data-action=task-summary][data-summary=overdue]');await page.waitForFunction(()=>document.querySelector('.mc-task-summary .mc-overdue strong').textContent==='1');
    await page.type('[name=taskQuery]','does not exist');await page.waitForFunction(()=>document.querySelector('.mc-task-list').textContent.includes('No tasks'));await page.$eval('[name=taskQuery]',n=>{n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForSelector('.mc-task-row');
    await page.screenshot({path:path.join(output,'tasks-desktop.png')});
    for(const width of [390,320]){
      await page.setViewport({width,height:844});await page.screenshot({path:path.join(output,`tasks-mobile-${width}.png`)});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
      await page.click('.mc-task-row');await page.waitForSelector('.mc-task-dialog[open]');
      assert.ok(await page.$eval('.mc-task-dialog',n=>n.getBoundingClientRect().right<=innerWidth+1));
      await page.screenshot({path:path.join(output,`task-mobile-${width}.png`)});await page.click('[data-action=task-close]');
    }
    await page.evaluate(()=>{NexusComms.sync({uid:null});});assert.equal(await page.$eval('.nexus-chat-badge',b=>b.hidden),true);assert.equal(await page.evaluate(()=>listeners.length),0);
    await page.evaluate(()=>{activity={unreadChats:2,events:[]};NexusComms.sync({...commsOptions,uid:'other-staff'});});await page.waitForFunction(()=>document.querySelector('.nexus-chat-badge').textContent==='2');
    await page.evaluate(()=>listeners[0].error({code:'permission-denied'}));assert.equal(await page.$eval('.nexus-chat-badge',b=>b.hidden),true);
    assert.deepEqual(errors,[]);console.log('PASS: global badge, 99+, audio, deduplication, mute, install prompt, direct tasks, checklists, search, due filters, desktop/mobile, sign-out and revocation.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
