'use strict';
// The full Nexus portal at /nexus/ (Nexus.Admin only; the sign-in and role checks run before this). Files are the
// live Firebase Hosting release copied by scripts/fetch-nexus-portal.cjs. Its data, Nexus sign-in and Cloud
// Functions stay on Firebase. Cloud Functions only accept browsers on the old Firebase addresses (CORS), so the
// portal calls them through this site: POST /nexus/__fn/<name> is forwarded to the function unchanged.
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_ORIGIN = 'https://us-central1-meridain-nexus.cloudfunctions.net';
const FUNCTION_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,99}$/;
const MAX_FUNCTION_RESPONSE = 32 * 1024 * 1024;
// The portal ran without a content policy on Firebase and loads Firebase, SharePoint and other services directly;
// keep the protections that do not change what it loads.
const PORTAL_POLICY = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

function mountNexusPortal(app, {fetchImpl = fetch, portalDir = path.join(__dirname, '../nexus-portal')} = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(portalDir, 'manifest.json'), 'utf8'));
  const files = new Set(manifest.files.map(file => file.path));
  const send = (res, file) => res.sendFile(path.join(portalDir, file), {dotfiles: 'deny', etag: true});
  const rawBody = express.raw({type: () => true, limit: '10mb'});

  app.use(['/nexus', '/__/firebase'], (req, res, next) => {
    res.set('Content-Security-Policy', PORTAL_POLICY);
    next();
  });
  // Firebase Hosting's reserved SDK and configuration files, at the paths the portal uses.
  app.get('/__/firebase/{*file}', (req, res, next) => files.has(req.path) ? send(res, req.path) : next());
  app.use('/nexus', (req, res, next) => {
    if (req.method === 'POST' && req.path.startsWith('/__fn/')) return rawBody(req, res, error => error ? next(error) : callFunction(req, res));
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    // The portal's files are relative to /nexus/, so /nexus itself must gain the slash.
    if (req.originalUrl.split('?')[0] === '/nexus') return res.redirect(302, '/nexus/');
    if (req.path === '/') return send(res, '/index.html');
    return files.has(req.path) && !req.path.startsWith('/__/') ? send(res, req.path) : next();
  });

  async function callFunction(req, res) {
    const name = req.path.slice('/__fn/'.length);
    if (!FUNCTION_NAME.test(name)) return res.status(404).json({error: {status: 'NOT_FOUND', message: 'Unknown Nexus function.'}});
    // App Service sign-in reads the Authorization header itself, so the portal sends its Nexus (Firebase) token in
    // X-Firebase-Authorization (azure-bridge.js); it goes to the function as Authorization again.
    const headers = {'content-type': req.get('content-type') || 'application/json'};
    const token = req.get('x-firebase-authorization');
    if (token) headers.authorization = token;
    for (const name of ['firebase-instance-id-token', 'x-firebase-appcheck']) if (req.get(name)) headers[name] = req.get(name);
    try {
      const upstream = await fetchImpl(`${FUNCTIONS_ORIGIN}/${name}`, {method: 'POST', headers, body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), redirect: 'error', signal: AbortSignal.timeout(540000)});
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.length > MAX_FUNCTION_RESPONSE) throw new Error('Function response too large');
      res.status(upstream.status).set('content-type', upstream.headers.get('content-type') || 'application/json').send(bytes);
    } catch (error) {
      res.status(502).json({error: {status: 'UNAVAILABLE', message: 'Nexus could not reach its Firebase service. Please try again shortly.'}});
    }
  }
}

module.exports = {mountNexusPortal, FUNCTIONS_ORIGIN};
