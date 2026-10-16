const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {execFileSync} = require('node:child_process');
const { api, json, fnUrl, liveHosting, hash, source, once, fileHashes } = require('./release-multi-admin.cjs');
const { readHierarchy } = require('./attendance-hierarchy-workbook.cjs');
const root = path.resolve(__dirname, '..'), stage = process.env.NEXUS_ATTENDANCE_STAGE || path.join(root, '.tmp/attendance-analytics-20260910');
const docs = 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents';
const save = (name, value) => { const file = path.join(stage, name); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const read = name => JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
function decode(v) {
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k,decode(x)]));
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if ('integerValue' in v) return Number(v.integerValue);
  return Object.values(v)[0];
}
async function documents(collection, query) {
  const rows = []; let token = '';
  if (query) {
    const result = await json(`${docs}:runQuery`, 'POST', {structuredQuery: query});
    return result.filter(x => x.document).map(x => ({id: x.document.name.split('/').at(-1), ...decode({mapValue:{fields:x.document.fields}})}));
  }
  do {
    const page = await json(`${docs}/${collection}?pageSize=1000${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    rows.push(...(page.documents || []).map(d => ({id:d.name.split('/').at(-1), ...decode({mapValue:{fields:d.fields}})})));
    token = page.nextPageToken;
  } while (token);
  return rows;
}
async function audit() {
  assert.ok(!fs.existsSync(path.join(stage, 'audit.json')), 'Preserve existing audit');
  const hierarchy = await readHierarchy('C:/Users/PC/Downloads/National Reporting Hierarchy.xlsx'); save('hierarchy.json', hierarchy);
  const hosting = await liveHosting(); save('hosting.before.json', hosting);
  assert.ok(hosting.release.version.name.endsWith('/dfae27958c6cf54a'), 'Hosting changed; review new baseline');
  const files = await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`); assert.ok(!files.nextPageToken); save('files.before.json', files);
  for (const name of ['getGeoRepAttendanceDashboard', 'getGeoRepAttendanceWorksheetView', 'getSalesforceAttendanceDashboard']) {
    const config = await json(fnUrl(name)); save(`${name}.before.json`, config);
    const expected = JSON.parse(fs.readFileSync(path.join(root, `.tmp/multi-admin-20260910/${name}.after.json`)));
    assert.equal(config.serviceConfig.revision, expected.serviceConfig.revision, 'Function baseline changed');
  }
  const profiles = await documents('adminUsers'); save('profiles.before.json', profiles);
  const access = hierarchy.access.map(person => ({...person, profiles: profiles.filter(p => String(p.email || '').toLowerCase() === person.email).map(p => ({uid:p.id, role:p.role, accountType:p.accountType, disabled:p.disabled === true, navigation:p.permissions?.allowedNavigationIds || []}))})); save('access-audit.json', access);
  for (const [audience, id] of [['rep', 'current'], ['merchandiser', 'merchandisers']]) {
    const doc = await json(`${docs}/geoRepAttendanceDashboard/${id}`), data = decode({mapValue:{fields:doc.fields}}); save(`${audience}.dashboard.json`, data);
    const runId = data.source?.storeCoverage?.runId;
    const result = runId ? await json(`${docs}/geoRepAttendanceCoverage/${audience}:runQuery`, 'POST', {structuredQuery:{from:[{collectionId:'visits'}],where:{fieldFilter:{field:{fieldPath:'runId'},op:'EQUAL',value:{stringValue:runId}}}}}) : [];
    const visits = result.filter(x=>x.document).map(x=>({id:x.document.name.split('/').at(-1),...decode({mapValue:{fields:x.document.fields}})})); save(`${audience}.visits.json`, visits);
    const results = {}; for (const v of visits) results[v.result] = (results[v.result] || 0) + 1;
    console.log(JSON.stringify({audience, rowCount:data.rows?.length, visits:visits.length, expected:data.source?.storeCoverage?.totalVisits, reportEndDate:data.reportEndDate, resultCounts:results, visitFields:Object.keys(visits[0] || {})}));
  }
  const summary = {at:new Date().toISOString(), hierarchyRows:hierarchy.rows.length, duplicates:hierarchy.duplicates.length, accessPeople:access.length, existing:access.filter(p=>p.profiles.length).length, missing:access.filter(p=>!p.profiles.length).length}; save('audit.json', summary); console.log(JSON.stringify(summary));
}
async function auditSource() {
  const id = read('rep.dashboard.json').source.schedules.fileId;
  const document = await json(`${docs}/files/${id}`), file = decode({mapValue:{fields:document.fields}}); save('source-file.json', file);
  // Short-lived read-only credentials for the existing application identity; no IAM grants.
  const credential = await json('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/730011371323-compute@developer.gserviceaccount.com:generateAccessToken', 'POST', {scope:['https://www.googleapis.com/auth/devstorage.read_only'],lifetime:'300s'});
  const response = await fetch(`https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/o/${encodeURIComponent(file.storagePath)}?alt=media`, {headers:{Authorization:`Bearer ${credential.accessToken}`}});
  assert.ok(response.ok, `Source read failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(path.join(stage, 'source.xlsx'), bytes);
  const ExcelJS = require('../functions/node_modules/exceljs'); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  for (const sheet of workbook.worksheets) {
    console.log(JSON.stringify({name:sheet.name, rows:sheet.rowCount, headers:sheet.getRow(1).values, sample:sheet.getRow(2).values}));
  }
}
async function prepare() {
  const baseline = path.join(root, '.tmp/multi-admin-20260910');
  const name = 'getGeoRepAttendanceDashboard', dest = path.join(stage,'deploy',name);
  fs.mkdirSync(dest,{recursive:true});
  const original = path.join(baseline,'deploy',name);
  for (const file of Object.keys(fileHashes(original))) { const target=path.join(dest,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(original,file),target); }
  let index = source(path.join(dest,'index.js'));
  const handler = index.match(/exports\.getGeoRepAttendanceDashboard = onCall\([^]*?\n\}\);/)[0];
  index = once(index,handler,source(path.join(root,'functions/attendance-analytics-entry.txt')).trim());
  const reader = index.match(/async function readGeoRepAttendanceSource\([^]*?\n\}/)[0];
  let enhanced = once(reader,'  const rows = [];','  const rows = [];\n  const sourceRowNumbers = [];');
  enhanced = once(enhanced,'    rows.push(values);','    rows.push(values);\n    sourceRowNumbers.push(rowNumber);');
  enhanced = once(enhanced,'    salesRepRows: selectedRows,','    salesRepRows: selectedRows,\n    sourceRowNumbers: sourceRowNumbers.filter((_, i) => roleIndex >= 0 && geoRepAttendanceRoleGroup(rows[i][roleIndex]) === audience),');
  index = once(index,reader,enhanced);
  fs.writeFileSync(path.join(dest,'index.js'),index);
  fs.copyFileSync(path.join(root,'functions/attendance-analytics.js'),path.join(dest,'attendance-analytics.js'));
  const h = read('hierarchy.json'); fs.writeFileSync(path.join(dest,'attendance-hierarchy.json'),JSON.stringify({sourceName:h.sourceName,sha256:h.sha256,rows:h.rows}));
  const {patch} = require('./attendance-portal-patch.cjs');
  const app = patch(source(path.join(baseline,'portal/app.js')));
  save('portal/app.js',app);
  const tag = process.env.NEXUS_ATTENDANCE_VERSION || '20260910-attendance-analytics';
  let html = source(path.join(baseline,'portal/index.html')).replaceAll('20260910-multi-admin',tag);
  html = once(html,`  <script defer src="app.js?v=${tag}"></script>`,`  <link rel="stylesheet" href="attendance-analytics.css?v=${tag}" />\n  <script defer src="attendance-analytics.js?v=${tag}"></script>\n  <script defer src="app.js?v=${tag}"></script>`);
  save('portal/index.html',html);
  let sw = source(path.join(baseline,'portal/service-worker.js')).replaceAll('20260910-multi-admin',tag).replace('meridian-nexus-v60-multi-admin',`meridian-nexus-${tag}`);
  sw = once(sw,'const SHELL = [',`const SHELL = ["/attendance-analytics.js?v=${tag}","/attendance-analytics.css?v=${tag}",`);save('portal/service-worker.js',sw);
  for(const file of ['attendance-analytics.js','attendance-analytics.css']) fs.copyFileSync(path.join(root,'public',file),path.join(stage,'portal',file));
  save('manifest.json',{functionName:name,functionFiles:fileHashes(dest),portalFiles:fileHashes(path.join(stage,'portal'))});
  console.log(JSON.stringify({prepared:true,backend:name,hostingFiles:5,noRulesChanges:true}));
}
function tested() {
  const manifest=read('manifest.json'),browser=read('browser-verified.json'),attendance=read('attendance-browser-verified.json');
  assert.equal(browser.ok,true);assert.deepEqual(attendance.errors,[]);
  assert.deepEqual(manifest.functionFiles,fileHashes(path.join(stage,'deploy',manifest.functionName)));
  assert.deepEqual(manifest.portalFiles,fileHashes(path.join(stage,'portal')));
  for(const name of ['app.js','index.html','service-worker.js']) assert.equal(browser.hashes[name],hash(source(path.join(stage,'portal',name))));
  for(const name of ['attendance-analytics.js','attendance-analytics.css']) assert.ok(fs.statSync(path.join(stage,'portal',name)).mtimeMs<Date.parse(attendance.at),'Browser checks predate assets');
  assert.equal(hash(fs.readFileSync(path.join(root,'functions/attendance-analytics.js'))),manifest.functionFiles['attendance-analytics.js']);
  execFileSync(process.execPath,['--test','scripts/tests/attendance-analytics.test.cjs'],{cwd:root,stdio:'inherit',windowsHide:true});
  return manifest;
}
async function deployFunction() {
  const manifest=tested(),name=manifest.functionName,before=read(`${name}.before.json`);
  assert.equal((await json(fnUrl(name))).serviceConfig.revision,before.serviceConfig.revision,'Live callable changed');
  const iam=await json(`https://run.googleapis.com/v2/${before.serviceConfig.service}:getIamPolicy`);save('function-iam.before.json',iam);
  const JSZip=require('../functions/node_modules/jszip'),zip=new JSZip();
  for(const [file,digest] of Object.entries(manifest.functionFiles)){const data=fs.readFileSync(path.join(stage,'deploy',name,file));assert.equal(hash(data),digest);zip.file(file,data);}
  const upload=await json('https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl','POST',{});
  const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/zip'},body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});assert.ok(put.ok,`Upload failed: ${put.status}`);
  const operation=await json(`${fnUrl(name)}?updateMask=buildConfig.source`,'PATCH',{name:before.name,buildConfig:{source:{storageSource:upload.storageSource}}});save('function-operation.json',operation);console.log(`Building ${name}`);
  for(;;){const result=await json(`https://cloudfunctions.googleapis.com/v2/${operation.name}`);if(result.done){save('function-result.json',result);assert.ok(!result.error,JSON.stringify(result.error));break;}await new Promise(r=>setTimeout(r,15000));}
  const after=await json(fnUrl(name));assert.equal(after.state,'ACTIVE');
  for(const field of ['timeoutSeconds','environmentVariables','secretEnvironmentVariables','maxInstanceCount','minInstanceCount','ingressSettings','serviceAccountEmail','availableMemory','availableCpu','maxInstanceRequestConcurrency']) assert.deepEqual(after.serviceConfig[field],before.serviceConfig[field],`Runtime changed: ${field}`);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`),iam);
  save(`${name}.after.json`,after);console.log(JSON.stringify({deployed:name,revision:after.serviceConfig.revision,runtimeAndIamPreserved:true}));
}
async function hosting() {
  const manifest=tested(),before=read('hosting.before.json'),current=await liveHosting();
  assert.equal(current.release.version.name,before.release.version.name,'Hosting baseline changed');
  assert.equal((await json(fnUrl(manifest.functionName))).serviceConfig.revision,read(`${manifest.functionName}.after.json`).serviceConfig.revision);
  const files=Object.fromEntries(read('files.before.json').files.map(f=>[f.path,f.hash])),uploads=new Map();
  for(const name of Object.keys(manifest.portalFiles)){const bytes=zlib.gzipSync(fs.readFileSync(path.join(stage,'portal',name)),{level:9}),digest=hash(bytes);files['/'+name]=digest;uploads.set(digest,bytes);}
  const base='https://firebasehosting.googleapis.com/v1beta1';
  const version=await json(`${base}/projects/-/sites/meridian-nexus/versions`,'POST',{config:current.release.version.config});save('hosting.created.json',{version,files});
  const populated=await json(`${base}/${version.name}:populateFiles`,'POST',{files});
  const token=execFileSync('powershell.exe',['-NoProfile','-File','C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1','auth','print-access-token','--project=meridain-nexus','--quiet'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
  for(const digest of populated.uploadRequiredHashes || []){assert.ok(uploads.has(digest));const response=await fetch(`${populated.uploadUrl}/${digest}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:uploads.get(digest)});assert.ok(response.ok,`Hosting upload: ${response.status}`);}
  await json(`${base}/${version.name}?updateMask=status`,'PATCH',{status:'FINALIZED'});
  assert.equal((await liveHosting()).release.version.name,current.release.version.name);
  const released=await json(`${base}/projects/-/sites/meridian-nexus/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,'POST',{message:'Attendance hierarchy, Central division, exact filtered drilldowns and Excel; source-matched Nexus layout and staff security retained.'});save('hosting.after.json',released);
  await verify();
}
async function verify() {
  const created=read('hosting.created.json'),live=await liveHosting();assert.equal(live.release.version.name.split('/').at(-1),created.version.name.split('/').at(-1));
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${live.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);assert.deepEqual(Object.fromEntries(files.files.map(f=>[f.path,f.hash])),created.files);
  const manifest=read('manifest.json');
  for(const name of Object.keys(manifest.portalFiles)){const response=await fetch(`https://meridian-nexus.web.app/${name}?verify=${Date.now()}`);assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),manifest.portalFiles[name]);}
  const denied=await fetch('https://us-central1-meridain-nexus.cloudfunctions.net/getGeoRepAttendanceDashboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{mode:'detail'}})});assert.ok([401,403].includes(denied.status));
  const result={at:new Date().toISOString(),hosting:live.release.version.name,backend:read(`${manifest.functionName}.after.json`).serviceConfig.revision,anonymousDenied:denied.status,changedAssets:5,unchangedAssets:read('files.before.json').files.length-3,rulesChanged:false};save('verified.json',result);console.log(JSON.stringify(result));
}
async function followup() {
  const next=process.env.NEXUS_ATTENDANCE_NEXT_STAGE || path.join(root,'.tmp/attendance-analytics-20260910-v2');assert.ok(next.startsWith(path.join(root,'.tmp')+path.sep) || next.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/.tmp/'));assert.ok(!fs.existsSync(next),'Preserve follow-up baseline');fs.mkdirSync(next);
  for(const name of ['hierarchy.json','rep.dashboard.json','merchandiser.dashboard.json']) fs.copyFileSync(path.join(stage,name),path.join(next,name));
  const config=await json(fnUrl('getGeoRepAttendanceDashboard'));assert.equal(config.serviceConfig.revision,read('getGeoRepAttendanceDashboard.after.json').serviceConfig.revision);
  const hosting=await liveHosting(),previousHosting=fs.existsSync(path.join(stage,'hosting.created.json'))?read('hosting.created.json').version.name:read('hosting.before.json').release.version.name;assert.equal(hosting.release.version.name.split('/').at(-1),previousHosting.split('/').at(-1));
  const files=await json(`https://firebasehosting.googleapis.com/v1beta1/${hosting.release.version.name}/files?pageSize=1000`);assert.ok(!files.nextPageToken);
  for(const [name,value] of [['getGeoRepAttendanceDashboard.before.json',config],['hosting.before.json',hosting],['files.before.json',files]])fs.writeFileSync(path.join(next,name),JSON.stringify(value,null,2));
  console.log('Follow-up baseline captured; original release evidence preserved.');
}
const actions = {audit, 'audit-source':auditSource,prepare,'deploy-function':deployFunction,hosting,verify,followup};
if (require.main === module) actions[process.argv[2]]().catch(e => { console.error(e.message); process.exitCode=1; });
module.exports = {root, stage, save, read, decode, documents};
