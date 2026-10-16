'use strict';
const path = require('node:path'), {spawn} = require('node:child_process');
const express = require('express');
const {createApp} = require('../server/main.cjs');
const {MemoryStore} = require('../../azure-nexus/server/store.cjs');
const {seed} = require('../../azure-nexus/tests/fixtures.cjs');
const {service} = require('../../azure-nexus/server/analytics.cjs');
const {createHandler} = require('../../firebase-dashboards/backend/handler.cjs');
async function main() {
  const targetUrl=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
  const regionCheck=process.argv.includes('--regions-only');
  const dailyCheck=process.argv.includes('--daily-only'),rosterCheck=process.argv.includes('--roster-only'),liveData=process.argv.includes('--live-data');
  const storeCheck=process.argv.includes('--stores-only');
  const ordersCheck=process.argv.includes('--orders-only');
  const servers = [];
  const listen = async app => {const server = app.listen(0, '127.0.0.1'); servers.push(server); await new Promise(resolve => server.once('listening', resolve)); return `http://127.0.0.1:${server.address().port}`;};
  try {
    const store = new MemoryStore(); await seed(store);
    const fixtureService=service(store),originalAttendance=fixtureService.attendance;
    fixtureService.attendance=async input=>{
      const result=await originalAttendance(input);
      if(!input.mode||input.mode==='dashboard'){
        result.scheduleAnalytics.byRegionWeekly=await Promise.all(result.charts.byRegion.map(async region=>{
          const report=await originalAttendance({...input,filters:{...input.filters,region:region.label}});
          return {...region,weeks:report.scheduleAnalytics.weekly};
        }));
      }
      return result;
    };
    const source = express(); source.use(express.json()); source.use(createHandler(fixtureService, {enabled: () => true}));
    const sourceUrl = await listen(source);
    const url = targetUrl || await listen(createApp({enabled: () => true,...(liveData?{}:{fetchImpl: (upstream, options) => fetch(sourceUrl + new URL(upstream).pathname, options)})}));
    for (const file of [ordersCheck?'orders-reference.cjs':storeCheck?'stores-layout.cjs':rosterCheck?'roster-layout.cjs':dailyCheck?'daily-layout.cjs':regionCheck?'region-layout.cjs':'dashboard-only.cjs']) {
      const child = spawn(process.execPath, [path.resolve(__dirname, '../tests', file), url], {
        stdio: 'inherit', env: {...process.env, VIEWER_TEST_RESULTS_DIR: path.resolve(__dirname, '../test-results', ordersCheck?'orders-reference':storeCheck?'store-reference':rosterCheck?'roster-reference':dailyCheck?'daily-reference':regionCheck?'regional-stack':'sidebar-free', targetUrl ? 'live' : liveData?'local-live-data':'local')}
      });
      const code = await new Promise((resolve, reject) => {child.once('exit', resolve); child.once('error', reject);});
      if (code !== 0) throw new Error(file + ' failed with exit ' + code);
    }
  } finally {for (const server of servers) await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});}
}
main().catch(error => {console.error(error.stack); process.exitCode = 1;});
