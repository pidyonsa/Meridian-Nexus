const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ExcelJS = require('../functions/node_modules/exceljs');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.tmp/attendance-analytics-20260910-v4');
const load = file => JSON.parse(fs.readFileSync(path.join(stage, file), 'utf8'));
async function main() {
  const verified = load('verified.json'), h = load('hierarchy.json');
  const access = JSON.parse(fs.readFileSync(path.join(root, '.tmp/attendance-analytics-20260910/manager-provision-state.json'), 'utf8'));
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'Meridian Nexus';
  function sheet(name, headers, rows) {
    const s = workbook.addWorksheet(name);s.addRows([headers, ...rows]);
    s.views = [{state:'frozen',ySplit:1}];s.autoFilter = {from:{row:1,column:1},to:{row:s.rowCount,column:headers.length}};
    s.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
    s.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF0C2948'}};
    s.columns.forEach(c=>c.width=30);s.getColumn(headers.length).width=60;
  }
  const metrics=[];
  for (const audience of ['rep','merchandiser']) {
    const data=load(`live-${audience}.json`),cycle=load(`live-callcycle-${audience}.json`);
    sheet(audience==='rep'?'Rep Reconciliation':'Merch Reconciliation',['Person','Rep','Line / Channel Manager','Region','Issue'],data.reconciliation.map(r=>[r.userName,r.rep,r.manager,r.region,r.issue]));
    metrics.push([audience,data.reportStartDate,data.reportEndDate,data.metrics.scheduled,data.metrics.attended,data.metrics.caughtUpVisits,data.metrics.missedVisits,data.metrics.unknownVisits,data.metrics.missedStores,data.quality.strikeRateTotals.scheduled,data.quality.strikeRateTotals.actual,data.quality.excludedVisits,cycle.stores.length]);
    sheet(audience==='rep'?'Rep Unverified Results':'Merch Unverified Results',['Geo result','Visits'],data.quality.unverifiedResults.map(r=>[r.result,r.count]));
  }
  sheet('Source Reconciliation',['Audience','Start','End','Schedule Target','Completed','Caught Up Included','Missed Visits','Unverified Visits','Distinct Missed Stores','Geo Strike Target','Geo Strike Actual','Leave Rows Excluded','Call Plan Stores'],metrics);
  sheet('Manager Access',['Name','Title','Email','Access Status','Password Setup Required'],h.access.map(r=>{const a=access[r.email];assert.ok(a && ['verified-viewer','already-viewer'].includes(a.status));return [r.name,r.title,r.email,a.status,a.passwordSetupRequired?'Use Forgot password':'Existing sign-in'];}));
  sheet('Hierarchy Source',['Person','Assignment','Line / Channel Manager','Regional Manager','General Manager','Head','Region','Original Division','Workbook Row'],h.rows.map(r=>[r.name,r.assignment,r.manager,r.regionalManager,r.generalManager,r.head,r.region,r.division,r.sourceRow]));
  sheet('Release',['Item','Value'],[['Verified',verified.at],['Hosting',verified.hosting],['Backend',verified.backend],['Hierarchy SHA256',h.sha256],['Catch-up rule','Caught up on: YYYY-MM-DD counts as attended against the scheduled day; completion date retained.'],['Call Cycle','Includes leave assignments. Attendance exclusions must not remove stores from route coverage.'],['Open decisions','Early visit statuses remain unverified pending the attendance rule. Geo strike-rate totals and individual Schedules rows differ; no balancing rows have been invented.'],['Readiness','Review missing people and reporting-line mappings with Nakita and Natasha before retiring existing reports. No notification has been sent.']]);
  const output=path.join(root,'docs/attendance-reconciliation-2026-09-10.xlsx');
  await workbook.xlsx.writeFile(output);const check=new ExcelJS.Workbook();await check.xlsx.readFile(output);assert.equal(check.getWorksheet('Manager Access').rowCount,34);
  console.log(JSON.stringify({report:output,sheets:check.worksheets.length,managerAccounts:33}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
