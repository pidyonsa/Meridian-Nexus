'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const puppeteer=require('../functions/node_modules/puppeteer-core');
const recording='C:/Users/PC/Downloads/Game _ Makro ETLs (Data orbis)-20260922_084345-Meeting Recording (1).mp4';
const out=path.resolve(__dirname,'../.tmp/dataorbis-sales-20260922/recording');
async function main() {
  fs.mkdirSync(out,{recursive:true});const size=fs.statSync(recording).size;
  const server=http.createServer((req,res)=>{
    if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0;background:#000"><video id="v" preload="auto" muted style="width:100%;height:100vh;object-fit:contain" src="/video"></video></body></html>');return;}
    if(req.url!=='/video'){res.writeHead(404);res.end();return;}
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    let start=0,end=size-1;
    if(range) {start=Number(range[1]);if(range[2])end=Math.min(Number(range[2]),end);}
    if(start>end || start>=size){res.writeHead(416);res.end();return;}
    res.writeHead(range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
    const stream=fs.createReadStream(recording,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {
    browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions','--no-first-run','--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage();await page.setViewport({width:1600,height:900});
    await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Number.isFinite(document.querySelector('video').duration),{timeout:60000});
    const metadata=await page.$eval('#v',v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
    assert.ok(metadata.width>0);
    for(const seconds of [5,45,90,165,240,278,342,388,520,635,732,904,950,1030,1240]) {
      await page.evaluate(async seconds=>{
        const v=document.querySelector('video');
        await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Video seek timeout')),30000);v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve();},{once:true});v.currentTime=seconds;});
      },seconds);
      await new Promise(resolve=>setTimeout(resolve,200));
      await page.screenshot({path:path.join(out,`frame-${String(seconds).padStart(4,'0')}.png`)});
    }
    fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
    console.log(JSON.stringify({...metadata,frames:15,out}));
  } finally {await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
