'use strict';
// Copies the full Nexus portal exactly as it is live on Firebase Hosting (site meridian-nexus) into nexus-portal/,
// so the Azure site can serve it at /nexus/ behind Microsoft sign-in. Data, Nexus sign-in and Cloud Functions stay
// on Firebase for now. Two changes only, each asserted against the live code:
//  - Cloud Functions are called through the Azure site (/nexus/__fn), because they only accept browsers on the old
//    Firebase addresses (CORS);
//  - the offline service worker is not registered (its cached files use the old site's root paths);
//  - azure-bridge.js (added) sends the Nexus token to /nexus/__fn in X-Firebase-Authorization, because App Service
//    sign-in reads the Authorization header itself.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {json} = require('../../scripts/release-multi-admin.cjs');
const SITE = 'meridian-nexus', ORIGIN = 'https://meridian-nexus.web.app';
const SDK = ['app', 'auth', 'firestore', 'storage', 'functions'].map(name => `/__/firebase/12.15.0/firebase-${name}-compat.js`);
const out = path.resolve(__dirname, '../nexus-portal');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const BRIDGE = `// Azure: Nexus Cloud Functions are reached through this site (/nexus/__fn). App Service sign-in reads the
// Authorization header itself, so the Nexus (Firebase) token travels in X-Firebase-Authorization instead.
(function () {
  var prefix = window.location.origin + "/nexus/__fn/", nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
    if (!url || url.indexOf(prefix) !== 0) return nativeFetch(input, init);
    var headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
    if (headers.has("Authorization")) { headers.set("X-Firebase-Authorization", headers.get("Authorization")); headers.delete("Authorization"); }
    return nativeFetch(input, Object.assign({}, init, { headers: headers, credentials: "same-origin" }));
  };
})();
`;
const PATCHES = {
  '/index.html': [
    ['<script defer src="/__/firebase/12.15.0/firebase-app-compat.js"></script>', '<script src="azure-bridge.js"></script>\n    <script defer src="/__/firebase/12.15.0/firebase-app-compat.js"></script>']
  ],
  '/app.js': [
    ['cloudFunctions = firebase.app().functions("us-central1");', 'cloudFunctions = firebase.app().functions(window.location.origin + "/nexus/__fn");'],
    ['navigator.serviceWorker.register("service-worker.js")', 'Promise.reject(new Error("Offline cache is not used on Azure"))']
  ]
};
(async () => {
  const release = (await json(`https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/releases?pageSize=1`)).releases[0];
  let token = '', listed = [];
  do { const page = await json(`https://firebasehosting.googleapis.com/v1beta1/${release.version.name}/files?pageSize=1000${token ? '&pageToken=' + token : ''}`); listed.push(...(page.files || [])); token = page.nextPageToken || ''; } while (token);
  const paths = [...listed.map(file => file.path).filter(p => p !== '/service-worker.js'), ...SDK].sort();
  fs.rmSync(out, {recursive: true, force: true});
  const files = [];
  for (const urlPath of paths) {
    assert.match(urlPath, /^\/[A-Za-z0-9_.\/-]+$/); assert.ok(!urlPath.includes('..'));
    const response = await fetch(ORIGIN + urlPath, {redirect: 'error'});
    assert.equal(response.status, 200, urlPath);
    let bytes = Buffer.from(await response.arrayBuffer());
    const live = hash(bytes);
    for (const [from, to] of PATCHES[urlPath] || []) {
      const text = bytes.toString('utf8');
      assert.equal(text.split(from).length, 2, `Live ${urlPath} changed: ${from}`);
      bytes = Buffer.from(text.replace(from, to));
    }
    const target = path.join(out, urlPath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
    files.push({path: urlPath, sha256: hash(bytes), ...(PATCHES[urlPath] ? {liveSha256: live, patched: true} : {})});
  }
  const bridge = Buffer.from(BRIDGE);
  fs.writeFileSync(path.join(out, 'azure-bridge.js'), bridge);
  files.push({path: '/azure-bridge.js', sha256: hash(bridge), added: true});
  // No other file may still call Cloud Functions directly.
  for (const file of files.filter(f => f.path.endsWith('.js') && !f.path.startsWith('/__/'))) {
    assert.ok(!/functions\("us-central1"\)|cloudfunctions\.net/.test(fs.readFileSync(path.join(out, file.path), 'utf8')), file.path + ' calls Cloud Functions directly');
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({source: `${ORIGIN} (${release.version.name}, released ${release.releaseTime})`, fetchedAt: new Date().toISOString(), files}, null, 2) + '\n');
  console.log(`${files.length} files from ${release.version.name} (${release.releaseTime}) into ${out}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
