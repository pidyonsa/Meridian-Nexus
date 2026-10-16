'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const zlib=require('node:zlib');const {Readable}=require('node:stream');const {execFileSync}=require('node:child_process');
const Zip=require('../functions/node_modules/jszip');
const {api,json,hash,once,fnUrl}=require('./release-multi-admin.cjs');
const {connect}=require('./release-chat-etl-portal.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.tmp/dataorbis-sales-20260922'),portal=path.join(stage,'portal');
const site='meridian-nexus',project='meridain-nexus',tag='20260922-dataorbis-sales';
const host='https://firebasehosting.googleapis.com/v1beta1';const assets=['app.js','index.html','service-worker.js','extraction-profile.css'];
const live=()=>json(`${host}/projects/${project}/sites/${site}/channels/live`);
const read=name=>JSON.parse(fs.readFileSync(path.join(stage,name),'utf8'));
const save=(name,value)=>fs.writeFileSync(path.join(stage,name),JSON.stringify(value,null,2),{flag:'wx'});
const normal=value=>value.replace(/\r\n/g,'\n');
const fn=(value,name)=>{const match=value.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));assert.ok(match,name);return match[0];};
async function prepare() {
  fs.mkdirSync(portal,{recursive:true});assert.ok(!fs.existsSync(path.join(stage,'hosting.before.json')));
  const before=await live();const files=await json(`${host}/${before.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  save('hosting.before.json',before);save('hosting.files.before.json',files);
  const after={};
  for(const file of [...assets.filter(file=>file!=='extraction-profile.css'),'styles.css']) {
    const response=await fetch(`https://${site}.web.app/${file}?baseline=${Date.now()}`);assert.ok(response.ok);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(zlib.gzipSync(bytes,{level:9})),files.files.find(f=>f.path==='/'+file).hash);
    fs.writeFileSync(path.join(stage,'before-'+file),bytes,{flag:'wx'});
    let content=normal(bytes.toString());
    if(file==='app.js')content=once(content,fn(content,'renderRetailerSetupStatus'),fn(normal(fs.readFileSync(path.join(root,'public/app.js'),'utf8')),'renderRetailerSetupStatus'));
    if(file==='index.html') {
      const note='<p class="management-note">Credentials are stored separately from the workflow. Leave the password blank when editing to retain the current password.</p>';
      content=once(content,note,note+'\n                    <details id="retailerSalesProcedure" hidden><summary>Monthly sales procedure</summary><ol class="management-note"></ol></details>');
      content=once(content,'</head>',`  <link rel="stylesheet" href="extraction-profile.css?v=${tag}" />\n</head>`);
    }
    if(['index.html','service-worker.js'].includes(file)) {
      const version=content.match(/app\.js\?v=[\w-]+/)?.[0];assert.ok(version);content=once(content,version,'app.js?v='+tag);
      if(file==='service-worker.js') {
        content=once(content,content.match(/^const CACHE = "[^"]+";/)[0],`const CACHE = "meridian-nexus-${tag}";`);
        content=once(content,'const SHELL = [',`const SHELL = ["/extraction-profile.css?v=${tag}",`);
      }
    }
    fs.writeFileSync(path.join(portal,file),content);if(assets.includes(file))after[file]=hash(content);
    if(file.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(portal,file)],{windowsHide:true});
  }
  fs.copyFileSync(path.join(root,'public/extraction-profile.css'),path.join(portal,'extraction-profile.css'));
  after['extraction-profile.css']=hash(fs.readFileSync(path.join(portal,'extraction-profile.css')));
  const config=await json(fnUrl('saveRetailer'));const source=config.buildConfig.source.storageSource;
  save('credential-api.before.json',{revision:config.serviceConfig.revision,source});
  const zip=await Zip.loadAsync(await(await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?generation=${source.generation}&alt=media`)).arrayBuffer());
  fs.writeFileSync(path.join(stage,'credential-api.index.js'),await zip.file('index.js').async('nodebuffer'),{flag:'wx'});
  assert.equal((await live()).release.version.name,before.release.version.name);
  save('prepared.json',{at:new Date().toISOString(),assets:after});console.log('Staged three narrowly patched assets; credential API source read only.');
}
function test() {
  const expected=read('prepared.json');
  const env={...process.env,NEXUS_PORTAL_STAGE:portal,NEXUS_DATAORBIS_SOURCE:path.join(stage,'credential-api.index.js')};
  execFileSync(process.execPath,['--test','scripts/tests/dataorbis-sales-setup.test.cjs','scripts/tests/dataorbis-credentials.test.cjs','scripts/tests/picknpay-restoration.test.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env});
  execFileSync(process.execPath,['scripts/tests/dataorbis-profile-browser.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env});
  execFileSync(process.execPath,['scripts/tests/picknpay-setup-browser.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env});
  for(const file of assets)assert.equal(hash(fs.readFileSync(path.join(portal,file))),expected.assets[file]);
  fs.writeFileSync(path.join(stage,'tested.json'),JSON.stringify({...expected,testedAt:new Date().toISOString()},null,2));
}
function responsive() {
  assert.ok(!fs.existsSync(path.join(stage,'hosting.created.json')));
  const previous=read('prepared.json');save('prepared.before-responsive.json',previous);
  if(fs.existsSync(path.join(stage,'tested.json')))save('tested.before-responsive.json',read('tested.json'));
  fs.copyFileSync(path.join(root,'public/extraction-profile.css'),path.join(portal,'extraction-profile.css'));
  for(const file of ['index.html','service-worker.js']) {
    let text=fs.readFileSync(path.join(portal,file),'utf8');assert.equal(hash(text),previous.assets[file]);
    text=file==='index.html'?once(text,'</head>',`  <link rel="stylesheet" href="extraction-profile.css?v=${tag}" />\n</head>`):once(text,'const SHELL = [',`const SHELL = ["/extraction-profile.css?v=${tag}",`);
    fs.writeFileSync(path.join(portal,file),text);
  }
  const prepared={at:new Date().toISOString(),assets:Object.fromEntries(assets.map(file=>[file,hash(fs.readFileSync(path.join(portal,file)))]))};
  fs.writeFileSync(path.join(stage,'prepared.json'),JSON.stringify(prepared,null,2));
}
function restyle() {
  assert.ok(!fs.existsSync(path.join(stage,'hosting.created.json')));
  const prepared=read('prepared.json');
  fs.copyFileSync(path.join(root,'public/extraction-profile.css'),path.join(portal,'extraction-profile.css'));
  prepared.assets['extraction-profile.css']=hash(fs.readFileSync(path.join(portal,'extraction-profile.css')));
  fs.writeFileSync(path.join(stage,'prepared.json'),JSON.stringify(prepared,null,2));
}
async function publish() {
  const tested=read('tested.json'),before=read('hosting.before.json');
  assert.ok(!fs.existsSync(path.join(stage,'hosting.created.json')),'Inspect the existing deployment before retrying.');
  assert.equal((await live()).release.version.name,before.release.version.name);
  const files=Object.fromEntries(read('hosting.files.before.json').files.map(f=>[f.path,f.hash]));const uploads=new Map();
  for(const file of assets) {
    const bytes=fs.readFileSync(path.join(portal,file));assert.equal(hash(bytes),tested.assets[file]);
    const compressed=zlib.gzipSync(bytes,{level:9}),digest=hash(compressed);files['/'+file]=digest;uploads.set(digest,compressed);
  }
  const version=await json(`${host}/sites/${site}/versions`,'POST',{config:before.release.version.config});save('hosting.created.json',{version,files});
  const populated=await json(`${host}/${version.name}:populateFiles`,'POST',{files});
  const {Client,hosting}=await connect();const uploader=new Client({urlPrefix:populated.uploadUrl,auth:true});
  for(const digest of populated.uploadRequiredHashes||[]) {
    assert.ok(uploads.has(digest),'Unrelated live asset upload requested.');
    const response=await uploader.request({method:'POST',path:'/'+digest,body:Readable.from([uploads.get(digest)]),resolveOnHTTPError:true,responseType:'stream'});
    response.body.resume();assert.equal(response.status,200);
  }
  await hosting.updateVersion(site,version.name.split('/').at(-1),{status:'FINALIZED'});
  assert.equal((await live()).release.version.name,before.release.version.name);
  await hosting.createRelease(site,'live',version.name,{message:'Game and Makro sales setup status and procedure; preserve all other modules'});
  console.log('Hosting released: '+version.name);
}
async function verify() {
  const current=await live(),created=read('hosting.created.json');
  assert.equal(current.release.version.name.split('/').at(-1),created.version.name.split('/').at(-1));
  const files=await json(`${host}/${current.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  assert.deepEqual(Object.fromEntries(files.files.map(f=>[f.path,f.hash])),created.files);
  assert.deepEqual(current.release.version.config,read('hosting.before.json').release.version.config);
  for(const file of assets) {
    let matched=false;
    for(let i=0;i<12;i++) {
      const response=await fetch(`https://${site}.web.app/${file}?verify=${Date.now()}`,{headers:{'Cache-Control':'no-cache'}});
      if(response.ok && hash(Buffer.from(await response.arrayBuffer()))===read('tested.json').assets[file]){matched=true;break;}
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    assert.ok(matched,'Live asset mismatch: '+file);
  }
  assert.equal((await json(fnUrl('saveRetailer'))).serviceConfig.revision,read('credential-api.before.json').revision);
  const anonymous=await fetch(`https://us-central1-${project}.cloudfunctions.net/saveRetailer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{}})});
  assert.ok([401,403].includes(anonymous.status));
  const denied=await anonymous.json();assert.ok(['UNAUTHENTICATED','PERMISSION_DENIED'].includes(denied.error?.status));
  const report={verifiedAt:new Date().toISOString(),version:current.release.version.name,changedAssets:assets,credentialApiUnchanged:true,anonymousDenied:true,anonymousStatus:anonymous.status,functionsDeployed:0,schedulesEnabled:0};
  save('hosting.verified.json',report);console.log(JSON.stringify(report));
}
const actions={prepare,responsive,restyle,test,publish,verify};
if(require.main===module)Promise.resolve().then(()=>{assert.ok(actions[process.argv[2]]);return actions[process.argv[2]]();}).catch(error=>{console.error(error.stack);process.exitCode=1;});
