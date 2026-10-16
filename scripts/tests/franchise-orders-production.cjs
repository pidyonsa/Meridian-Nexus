const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const puppeteer=require(path.join(root,'functions/node_modules/puppeteer-core'));
async function main(){
  const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-extensions','--no-first-run']});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1440,height:900});
    await page.goto('https://meridian-nexus.web.app/#franchiseorder',{waitUntil:'networkidle2',timeout:60000});
    try { await page.waitForFunction(()=>window.FranchiseOrders && document.getElementById('nexusLoginDialog')?.open); }
    catch(error) {
      console.log(JSON.stringify(await page.evaluate(()=>({module:!!window.FranchiseOrders,firebase:!!window.firebase,view:!!document.getElementById('franchiseOrderView'),dialog:document.getElementById('nexusLoginDialog')?.open,app:document.querySelector('script[src^="app.js"]')?.src,status:document.getElementById('toast')?.textContent}))),errors);
      await page.screenshot({path:path.join(root,'.tmp/franchise-verification/production-startup-failure.png')});throw error;
    }
    assert.equal(await page.$('.fo-kpi'),null,'No order values may render before sign-in');
    assert.equal(await page.$eval('#franchiseOrderView',e=>e.hidden),false);
    const status=await page.evaluate(async()=>{const response=await fetch('https://us-central1-meridain-nexus.cloudfunctions.net/getFranchiseOrderDashboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{role:'admin'}})});return response.status;});
    assert.equal(status,401);assert.deepEqual(errors,[]);
    fs.mkdirSync(path.join(root,'.tmp/franchise-verification'),{recursive:true});
    await page.screenshot({path:path.join(root,'.tmp/franchise-verification/production-sign-in.png')});
    console.log('PASS: live Nexus assets load, existing login required, no anonymous data, forged body role denied, no page JavaScript errors.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
