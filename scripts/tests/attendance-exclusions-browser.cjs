'use strict';
const {chromium}=require('../../azure-nexus/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const E=require('../../functions/attendance-exclusions-core'),{parseWorkbook}=require('../../functions/attendance-exclusions-admin');
const ExcelJS=require('../../functions/node_modules/exceljs'),JSZip=require('../../functions/node_modules/jszip');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.tmp/attendance-exclusions-20260916/browser');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/attendance-exclusions.css"><style>body{margin:0;padding:20px;background:#071729;font-family:Arial,sans-serif}main{max-width:1100px;margin:auto}</style><main class="aex" id="root"></main><script src="/attendance-exclusions.js"></script>');}
    if(!['/attendance-exclusions.js','/attendance-exclusions.css'].includes(req.url)){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'public',req.url.slice(1))));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[];
  try{
    for(const width of [1366,390,320]){
      const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      let policy={revision:0,entries:[],history:[]};const calls=[];
      const book=new ExcelJS.Workbook();book.addWorksheet('Names').addRows([['Name'],['Imported Person'],['Another Person']]);const bytes=Buffer.from(await book.xlsx.writeBuffer());
      await page.exposeFunction('testCall',async data=>{
        calls.push(data.action);
        if(data.action==='list')return policy;
        if(data.action==='template')return {base64:bytes.toString('base64'),fileName:'Syndicated-attendance-exclusions.xlsx'};
        if(data.action==='preview'){
          const entries=data.workbook?await parseWorkbook(data.workbook,{type:data.type,audience:data.audience},{ExcelJS,JSZip}):data.entries.map(E.rule);
          return {entries,review:entries.map(r=>({...r,duplicate:false,matchedPeople:1,sample:['Test Person']})),adding:entries.length,duplicates:0,unmatched:0,revision:policy.revision,reviewId:'reviewed'};
        }
        assert.equal(data.revision,policy.revision);policy={...policy,revision:policy.revision+1,changed:1};
        if(data.action==='commit'){assert.equal(data.reviewId,'reviewed');policy.entries.push(...data.entries);}
        if(data.action==='setEnabled')policy.entries=policy.entries.map(r=>r.id===data.id?{...r,enabled:data.enabled}:r);
        if(data.action==='remove')policy.entries=policy.entries.filter(r=>r.id!==data.id);
        return policy;
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(()=>{window.panel=NexusAttendanceExclusions.mount(document.getElementById('root'),{call:window.testCall});});
      await page.getByRole('textbox',{name:'Full name',exact:true}).fill('Test Person <img src=x onerror=alert(1)>');
      await page.getByRole('button',{name:'Preview exclusion',exact:true}).click();await page.locator('.aex-preview').waitFor();
      assert.equal(await page.locator('.aex-preview img').count(),0);assert.equal(await page.getByRole('button',{name:'Save exclusions',exact:true}).isDisabled(),true);
      await page.locator('[data-aex-confirm]').check();await page.getByRole('button',{name:'Save exclusions',exact:true}).click();await page.locator('.aex-list tbody input').waitFor();
      await page.locator('[data-aex-toggle]').uncheck();await page.waitForFunction(()=>document.querySelector('.aex-status').textContent.includes('saved')&&!document.querySelector('[data-aex-toggle]').disabled);
      assert.equal(policy.entries[0].enabled,false);
      await page.locator('input[type=file]').setInputFiles({name:'names.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});await page.locator('.aex-preview').waitFor();
      assert.equal(await page.locator('.aex-preview tbody tr').count(),2);await page.locator('[data-aex-confirm]').check();await page.getByRole('button',{name:'Save exclusions',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.aex-list tbody tr').length===3);
      await page.locator('select[name=type]').selectOption('manager');assert.equal(await page.locator('input[name=userCode]').isDisabled(),true);
      await page.screenshot({path:path.join(out,`admin-${width}.png`),fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel template',exact:true}).click();assert.equal((await pending).suggestedFilename(),'Syndicated-attendance-exclusions.xlsx');
      await page.locator('[data-aex-action=remove]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.aex-list tbody tr').length===2);
      await page.locator('input[type=file]').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('.aex-status').textContent.includes('XLSX'));
      await page.evaluate(()=>window.panel.stop());assert.equal(await page.locator('#root').innerText(),'');assert.ok(calls.includes('setEnabled')&&calls.includes('commit')&&calls.includes('remove'));
      await page.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verified.json'),JSON.stringify({at:new Date().toISOString(),widths:[1366,390,320],errors}));console.log('PASS: desktop/mobile manual entry, Excel preview/import, confirmation, restore/remove, template download, invalid files, escaping and teardown.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
