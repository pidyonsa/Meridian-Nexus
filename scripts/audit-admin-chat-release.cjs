const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.tmp/admin-chat-repair-20260909');
const zip = require(path.join(root, 'functions/node_modules/jszip'));
const gcloud = (...args) => execFileSync('powershell.exe', ['-NoProfile', '-File', 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
async function main() {
  fs.mkdirSync(stage, { recursive: true });
  const token = gcloud('auth', 'print-access-token', '--project=meridain-nexus', '--quiet').trim();
  const get = async url => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': 'meridain-nexus' } });
    if (!response.ok) throw new Error(`Read failed ${response.status}: ${url}`);
    return response;
  };
  const save = (name, data) => { const file = path.join(stage, name); assert.ok(!fs.existsSync(file), `Baseline exists: ${name}`); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };
  for (const name of ['saveAdminUser', 'meridianChat', 'askNexusAssistant']) {
    const config = await (await get(`https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions/${name}`)).json();
    save(`${name}.before.json`, config);
    const source = config.buildConfig.source.storageSource;
    const archive = await zip.loadAsync(await (await get(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
    const destination = path.join(stage, name);
    for (const entry of Object.values(archive.files)) {
      if (entry.dir) continue;
      const target = path.resolve(destination, entry.name);
      assert.ok(target.startsWith(destination + path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async('nodebuffer'));
    }
    console.log(`${name}: ${config.serviceConfig.revision}`);
  }
  const live = await (await get('https://firebasehosting.googleapis.com/v1beta1/projects/meridain-nexus/sites/meridian-nexus/channels/live')).json();
  save('hosting.before.json', live);
  const files = await (await get(`https://firebasehosting.googleapis.com/v1beta1/${live.release.version.name}/files?pageSize=1000`)).json();
  assert.ok(!files.nextPageToken);
  save('hosting-files.before.json', files);
  for (const name of ['index.html', 'app.js', 'service-worker.js', 'meridian-chat.js']) {
    const response = await fetch(`https://meridian-nexus.web.app/${name}`);
    assert.equal(response.status, 200);
    save(`live-${name}`, await response.text());
  }
  const releases = await (await get('https://firebaserules.googleapis.com/v1/projects/meridain-nexus/releases?pageSize=100')).json();
  assert.ok(!releases.nextPageToken);
  save('rules-releases.before.json', releases);
  for (const release of releases.releases.filter(r => /\/cloud.firestore$|\/firebase.storage\/meridain-nexus.firebasestorage.app$/.test(r.name))) {
    const rules = await (await get(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`)).json();
    const kind = release.name.endsWith('/cloud.firestore') ? 'firestore' : 'storage';
    save(`${kind}-ruleset.before.json`, rules);
    assert.equal(rules.source.files.length, 1);
    save(`${kind}.before.rules`, rules.source.files[0].content);
  }
  save('bucket-iam.before.json', await (await get('https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/iam?optionsRequestedPolicyVersion=3')).json());
  console.log(`Read-only baseline: ${live.release.version.name}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
