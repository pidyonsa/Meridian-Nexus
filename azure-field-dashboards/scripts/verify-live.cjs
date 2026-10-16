'use strict';
const {spawn} = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const base = process.argv[2];
async function main() {
  assert.ok(base && new URL(base).protocol === 'https:', 'Supply the deployed Azure HTTPS URL.');
  const directory = path.resolve(__dirname, '../test-results/live');
  fs.mkdirSync(directory, {recursive: true});
  const health = await fetch(base + '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {status: 'ok', edition: 'azure-field-dashboards', readOnly: true, dataService: 'azure-blob-snapshot', publicAccessEnabled: true});
  for (const audience of ['rep', 'merchandiser']) {
    assert.equal((await fetch(base + `/attendance/${audience}/exclusions`)).status, 404, 'Exclusion view must not be public');
    const response = await fetch(base + '/api/attendance', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({audience, mode: 'exclusions', refresh: true})});
    assert.equal(response.status, 400, 'Exclusion list must not be accessible through the public API');
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/asset-manifest.json')));
  for (const file of manifest.files) {
    const response = await fetch(base + '/' + file.path);
    assert.equal(response.status, 200, file.path);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), file.sha256, file.path);
  }
  const child = spawn(process.execPath, [path.resolve(__dirname, '../../firebase-dashboards/scripts/verify-live.cjs')], {
    stdio: 'inherit', env: {...process.env, PUBLIC_VIEWER_URL: base, VIEWER_TEST_RESULTS_DIR: directory}
  });
  const code = await new Promise((resolve, reject) => {child.once('exit', resolve); child.once('error', reject);});
  assert.equal(code, 0, 'Live API, drilldown and Excel checks failed.');
  fs.writeFileSync(path.join(directory, 'asset-verification.json'), JSON.stringify({at: new Date().toISOString(),url: base,identicalAssets: manifest.files.length,readOnly: true,dataServiceMigrated: false}, null, 2));
  console.log(`${manifest.files.length} live Azure assets match the verified deployment package; live data and exports passed.`);
}
main().catch(error => {console.error(error.stack); process.exitCode = 1;});
