'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const {json} = require('../../scripts/release-multi-admin.cjs');
const directory = path.resolve(__dirname, '../../.tmp/azure-dashboard-migration');
const url = 'https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/iam';
const title = 'azure-dashboard-migration-20260921';
const member = 'user:pidyonsa@gmail.com';
const names = [
  'uploads/2268a954-5eb6-4875-9f41-a3de89c06613/Geo_Rep_Strike_Rate_Report_2026-09-01_to_2026-09-20.xlsx',
  'portal-resources/geo-product-order-master/6b5f76807b5cc67f_Geo Product Order Master.xlsx'
];
async function main() {
  const remove = process.argv[2] === 'remove';
  const policy = await json(url + '?optionsRequestedPolicyVersion=3');
  const existing = policy.bindings?.filter(binding => binding.condition?.title === title) || [];
  if (remove) {
    for (const binding of existing) {
      assert.equal(binding.role, 'roles/storage.objectViewer');
      assert.deepEqual(binding.members, [member]);
    }
    policy.bindings = policy.bindings.filter(binding => binding.condition?.title !== title);
  } else {
    assert.equal(existing.length, 0, 'Migration grant already exists.');
    await fs.mkdir(directory, {recursive:true});
    await fs.writeFile(path.join(directory, 'source-iam-before.json'), JSON.stringify(policy, null, 2));
    const expires = new Date(Date.now() + 3600000).toISOString();
    policy.version = 3;
    policy.bindings.push({role:'roles/storage.objectViewer', members:[member], condition:{title,description:'Temporary read of the two explicitly approved Azure migration source workbooks.',expression:'request.time < timestamp(' + JSON.stringify(expires) + ') && (' + names.map(name => 'resource.name == ' + JSON.stringify('projects/_/buckets/meridain-nexus.firebasestorage.app/objects/' + name)).join(' || ') + ')'}});
    await fs.writeFile(path.join(directory, 'source-read-grant.json'), JSON.stringify({title,member,names,expires}, null, 2));
  }
  await json(url, 'PUT', policy);
  const after = await json(url + '?optionsRequestedPolicyVersion=3');
  assert.equal(after.bindings.some(binding => binding.condition?.title === title), !remove);
  console.log(JSON.stringify({removed:remove, exactObjects:names.length, expiresWithinOneHour:!remove}));
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
