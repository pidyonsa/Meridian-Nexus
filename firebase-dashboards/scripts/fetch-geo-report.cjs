'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const acorn=require('acorn'),puppeteer=require('../../functions/node_modules/puppeteer-core');
const h=require('../../scripts/repair-attendance-september-weeks.cjs');
const ExcelJS=require('../backend/node_modules/exceljs');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'.tmp/public-dashboards-20260914');
async function main(){
  const api=await h.apiClient();
  const keyResponse=await api('https://secretmanager.googleapis.com/v1/projects/meridain-nexus/secrets/RETAILER_CREDENTIAL_KEY/versions/latest:access');
  const key=Buffer.from(Buffer.from(keyResponse.payload.data,'base64').toString('utf8'),'base64');
  const credential=async id=>{
    const data=h.decode(await api(`retailers/${id}`)),secret=h.decode(await api(`retailerSecrets/${id}`));
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(secret.iv,'base64'));decipher.setAuthTag(Buffer.from(secret.tag,'base64'));
    return {...data,password:Buffer.concat([decipher.update(Buffer.from(secret.ciphertext,'base64')),decipher.final()]).toString('utf8')};
  };
  const retailer=await credential('geo-rep-sales-transactions');
  if(retailer.sourceRetailerId&&retailer.sourceRetailerId!=='geo-rep-sales-transactions')retailer.transactionReportFallback=await credential(retailer.sourceRetailerId);
  key.fill(0);
  const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const range={startDate:end.slice(0,8)+'01',endDate:end},directory=await fsp.mkdtemp(path.join(output,'geo-export-'));
  const names=['geoRepDownloadTransactionReport','geoRepWaitForTransactionReport','geoRepOpenTransactionReport','geoRepLoginIsVisible','geoRepRefreshClientSession','geoRepRestoreSession','geoRepPageState'];
  const source=fs.readFileSync(path.join(root,'functions/index.js'),'utf8'),tree=acorn.parse(source,{ecmaVersion:'latest'});
  const declarations=names.map(name=>{const n=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);if(!n)throw Error('Missing source helper '+name);return source.slice(n.start,n.end);}).join('\n');
  const context=vm.createContext({URL,Date,setTimeout,clearTimeout,Promise,console:{log:()=>{}},delay:ms=>new Promise(r=>setTimeout(r,ms)),reportDatesForRun:()=>range,
    waitForDownload:async dir=>{
      const deadline=Date.now()+180000;let previous='';
      while(Date.now()<deadline){const files=(await fsp.readdir(dir)).filter(n=>!n.endsWith('.crdownload')&&!n.endsWith('.tmp'));if(files.length){const p=path.join(dir,files[0]),stat=await fsp.stat(p),signature=`${p}:${stat.size}`;if(signature===previous&&stat.size>0)return {path:p,name:files[0]};previous=signature;}await new Promise(r=>setTimeout(r,1000));}
      throw Error('Geo transaction export did not finish within three minutes.');
    }});
  vm.runInContext(declarations+'\nthis.download=geoRepDownloadTransactionReport;',context);
  let browser;
  try{
    browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage();await page.setViewport({width:1366,height:900});
    const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
    await page.goto('https://meridian.georep.com/portal/index.php/Reports/transactions_report',{waitUntil:'domcontentloaded',timeout:90000});
    console.log('Requesting fresh Geo Rep Orders transaction workbook for '+range.startDate+' to '+range.endDate+'.');
    const file=await context.download(page,directory,{},retailer);
    const book=new ExcelJS.Workbook();await book.xlsx.readFile(file.path);
    const sheets=book.worksheets.map(sheet=>{const first=[];for(let i=1;i<=Math.min(sheet.rowCount,10);i++){const cells=sheet.getRow(i).values.slice(1).map(v=>String(v?.result??v??''));if(cells.some(c=>/^(Brands?|Transaction Number|Product Name)$/i.test(c.trim())))first.push({row:i,headers:cells});}return {name:sheet.name,rows:sheet.rowCount,headers:first};});
    const evidence={downloadedAt:new Date().toISOString(),range,file:path.relative(root,file.path),size:(await fsp.stat(file.path)).size,sha256:crypto.createHash('sha256').update(await fsp.readFile(file.path)).digest('hex'),sheets};
    fs.writeFileSync(path.join(output,'fresh-geo-transaction.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
  }finally{retailer.password='';if(retailer.transactionReportFallback)retailer.transactionReportFallback.password='';await browser?.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
