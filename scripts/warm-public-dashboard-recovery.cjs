'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {json} = require('./release-multi-admin.cjs');
const dir = path.resolve(__dirname, '../.tmp/public-dashboard-billing-recovery-20260921');
const name = 'projects/meridain-nexus/locations/us-central1/services/publicmeridiandashboards';
const url = 'https://run.googleapis.com/v2/' + name;
const backup = path.join(dir, 'scaling-before-warm.json');

async function main() {
  const restore = process.argv[2] === 'restore';
  const before = await json(url);
  let scaling;
  if (restore) {
    scaling = JSON.parse(fs.readFileSync(backup, 'utf8'));
  } else {
    assert.ok(!fs.existsSync(backup), 'Warm-up already requested; use restore.');
    assert.equal(before.template.scaling.maxInstanceCount, 2);
    fs.mkdirSync(dir, {recursive:true});
    fs.writeFileSync(backup, JSON.stringify(before.scaling || {}, null, 2));
    scaling = {...before.scaling, minInstanceCount:1};
  }
  let op = await json(url + '?updateMask=scaling', 'PATCH', {name, etag:before.etag, scaling});
  fs.writeFileSync(path.join(dir, restore ? 'restore-scaling-operation.json' : 'warm-operation.json'), JSON.stringify(op, null, 2));
  for (let i = 0; !op.done && i < 36; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    op = await json('https://run.googleapis.com/v2/' + op.name);
  }
  assert.ok(op.done && !op.error, JSON.stringify(op.error || 'Operation pending'));
  const after = await json(url);
  assert.deepEqual(after.template, before.template, 'Revision and runtime must stay unchanged.');
  assert.deepEqual(after.traffic, before.traffic);
  console.log(JSON.stringify({restore, scaling:after.scaling, ready:after.terminalCondition?.state, revision:after.latestReadyRevision}));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
