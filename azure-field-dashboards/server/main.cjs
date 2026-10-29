'use strict';
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('node:fs');
const path = require('node:path');
const {setTimeout: sleep} = require('node:timers/promises');
const {mountNexusPortal} = require('./nexus-portal.cjs');

const UPSTREAM = 'https://meridian-field-dashboards.web.app';
const API_ROUTES = new Set(['/api/attendance', '/api/orders']);
const PAGE_ROUTE = /^(?:\/attendance(?:\/(?:rep|merchandiser)(?:\/(?:overview|daily|users|stores))?)?\/?|\/franchise-orders(?:\/(?:overview|trend|regions|products|stores|reps|orders))?\/?)$/;
const MAX_RESPONSE = 9 * 1024 * 1024;
const MERIDIAN_TENANT = 'cbe83df2-b350-4dab-8d5f-f78d21fe7d27';
const TENANT_CLAIMS = new Set(['http://schemas.microsoft.com/identity/claims/tenantid', 'tid']);
const ROLE_CLAIMS = new Set(['roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']);
// Guests (B2B: Gmail, personal Microsoft or other-company accounts invited into the Meridian tenant) get tokens from
// the Meridian tenant too, but carry an identity-provider claim naming their home provider. Staff tokens have none.
const IDP_CLAIMS = new Set(['idp', 'http://schemas.microsoft.com/identity/claims/identityprovider']);
// Entra app role (registration "Meridian Nexus Azure") for the full Nexus; assigned to jpinto@ only for now.
const ADMIN_ROLE = 'Nexus.Admin';
// What every Meridian account may open: the Nexus workspace, Syndicated Attendance (Reps and Merchandisers), Franchise
// Orders and their static files. Anything else on this site is the full Nexus (/nexus/) and needs ADMIN_ROLE.
// The Nexus workspace (home page and module pages), built in from ../azure-portal/public by scripts/build.cjs.
const WORKSPACE_ROUTE = /^\/(?:modules\/[a-z-]{2,40}\/?)?$/;
// Who may open what (27 October 2026): permissions are managed in Admin › Users (server/shared/permissions). Every
// Meridian account opens the default dashboards; each tool page and API belongs to a section (catalogue.cjs ROUTES)
// that must be granted; administrators (Entra Nexus.Admin, or switched on in Nexus) open everything.
const {sectionOf} = require('./shared/permissions/catalogue.cjs');
// Client gap trackers (any client): every Meridian account may view (user decision, 24 October 2026); uploads need
// the "Upload gap reports" permission.
const GAP_PAGES = /^\/(?:gap-tracker(?:\/[a-z0-9-]{2,60})?|admin\/gap-upload)\/?$/;
const GAP_VIEW = /^\/(?:gap-tracker(?:\/[a-z0-9-]{2,60})?\/?|api\/gaps(?:\/[a-z0-9-]{2,60}(?:\/(?:compare|detail|export))?)?)$/;
// The tracker briefly lived under Insights (23-24 October 2026); old links keep working.
const GAP_MOVED = {'/insights/sir-fruit': '/gap-tracker/sir-fruit', '/insights/sir-fruit/upload': '/admin/gap-upload'};
// Workspace pages of the tools moved off the Firebase-era Nexus; each needs its section (checked before serving).
const TOOL_PAGES = /^\/(?:sales|stockfix(?:\/captures)?|automation|resources|etls|admin(?:\/(?:profiles|geo-attendance|integrations|users))?)\/?$/;
// Entra role Nexus.GapUploader (26 October 2026) also grants gap uploads (permissions can now be set in Nexus instead).
const GAP_UPLOADER_ROLE = 'Nexus.GapUploader';
const OID_CLAIMS = new Set(['http://schemas.microsoft.com/identity/claims/objectidentifier', 'oid']);
const everyoneMayOpen = (req, assets) => (GAP_VIEW.test(req.path) && ['GET', 'HEAD'].includes(req.method)) || WORKSPACE_ROUTE.test(req.path) || PAGE_ROUTE.test(req.path) || assets.has(req.path) || req.path === '/api/health' || req.path === '/api/me' || API_ROUTES.has(req.path);

// Microsoft sign-in is done by App Service Authentication (Entra ID, Meridian tenant). It passes the signed-in
// user in X-MS-CLIENT-PRINCIPAL and strips that header from incoming requests, so a caller cannot supply it.
function signedInUser(req) {
  const header = req.get('x-ms-client-principal');
  if (!header || header.length > 16384) return null;
  try {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    const claims = Array.isArray(principal?.claims) ? principal.claims : [];
    const tenant = claims.find(claim => TENANT_CLAIMS.has(claim.typ))?.val;
    if (principal.auth_typ !== 'aad' || tenant !== MERIDIAN_TENANT) return null;
    const idp = claims.find(claim => IDP_CLAIMS.has(claim.typ))?.val;
    if (idp && !String(idp).includes(MERIDIAN_TENANT)) return null;
    const roles = new Set(claims.filter(claim => ROLE_CLAIMS.has(claim.typ) || claim.typ === principal.role_typ).map(claim => claim.val));
    const email = req.get('x-ms-client-principal-name') || '';
    const oid = String(claims.find(claim => OID_CLAIMS.has(claim.typ))?.val || '');
    return {name: email, displayName: String(claims.find(claim => claim.typ === 'name')?.val || email), admin: roles.has(ADMIN_ROLE), gapUploader: roles.has(GAP_UPLOADER_ROLE), oid: /^[0-9a-f-]{36}$/i.test(oid) ? oid : null};
  } catch { return null; }
}

function createApp({gapStore = null, salesStore = null, stockfixSource, stockfixAppSource = null, permissionStore = null, googleServices = {}, fetchImpl = fetch, functionsFetch = fetch, portalDir, now = Date.now, enabled = () => process.env.PUBLIC_DASHBOARDS_ENABLED === 'true', requireLogin = () => process.env.REQUIRE_MS_LOGIN === 'true', timeoutMs = 60000, retryDelayMs = 1000, reportProvider = null, publicDir = path.join(__dirname, '../public')} = {}) {
  const app = express();
  const limits = new Map();
  const pending = new Map();
  const cache = new Map();
  let cacheBytes = 0;
  const assets = new Set(JSON.parse(fs.readFileSync(path.join(publicDir, 'asset-manifest.json'), 'utf8')).files.map(file => '/' + file.path));
  app.disable('x-powered-by');
  app.use(compression({threshold:1024}));
  // Azure App Service is the single ingress proxy; never trust arbitrary forwarded hops.
  app.set('trust proxy', 1);
  app.use(helmet({contentSecurityPolicy: {directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'"], connectSrc: ["'self'"],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'none'"]
  }}, referrerPolicy: {policy: 'same-origin'}}));
  // 'same-origin', not 'no-referrer': under no-referrer browsers send "Origin: null" on the report POSTs, and App Service
  // Authentication refuses those with 403 for signed-in users (20 October: no report loaded behind sign-in until this).
  app.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/healthz', (req, res) => res.json({status: 'ok', edition: 'azure-field-dashboards', readOnly: true, dataService: reportProvider?.kind || 'existing-public-viewer', publicAccessEnabled: enabled()}));
  // One log line per refused or failed request (no names or emails), so a 401/403 can be told apart from App Service's.
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) return;
      const user = signedInUser(req);
      console.warn(JSON.stringify({event: 'dashboard-request-refused', status: res.statusCode, method: req.method, path: req.path,
        principal: Boolean(req.get('x-ms-client-principal')), signedIn: Boolean(user), admin: user ? user.admin : null}));
    });
    next();
  });
  app.get(Object.keys(GAP_MOVED), (req, res) => res.redirect(301, GAP_MOVED[req.path]));
  // Everything except the App Service health check needs a signed-in Meridian user. App Service Authentication sends
  // signed-out visitors to Microsoft sign-in and passes signed-in users in X-MS-CLIENT-PRINCIPAL. This also holds if
  // platform sign-in is switched off or set to allow anonymous requests: signed-out page and file requests go to
  // Microsoft sign-in, anything else without a Meridian user is refused.
  const db = require('./shared/db.cjs');
  const permissions = require('./shared/permissions/service.cjs').permissionService({store: permissionStore || (db.sqlConfig() ? require('./shared/permissions/store.cjs').sqlPermissionStore(() => db.pool()) : require('./shared/permissions/store.cjs').memoryPermissionStore())});
  const accessOf = user => permissions.effective({email: user.name, entraAdmin: user.admin, gapUploader: user.gapUploader});
  app.use(async (req, res, next) => {
    if (!requireLogin()) return next();
    const user = signedInUser(req);
    if (!user && ['GET', 'HEAD'].includes(req.method) && !req.path.startsWith('/api/')) {
      return res.redirect(302, '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(req.originalUrl));
    }
    if (!user) return res.status(401).json({error: 'Sign in with your Meridian Microsoft account to view the dashboards.'});
    try { req.access = await accessOf(user); } catch (error) { return next(error); }
    if (req.access.admin) return next();
    const section = sectionOf(req.path);
    const allowed = req.access.disabled ? WORKSPACE_ROUTE.test(req.path) || assets.has(req.path) || req.path === '/api/me'
      : section ? req.access.sections.includes(section) : everyoneMayOpen(req, assets);
    if (!allowed) return res.status(403).json({error: req.access.disabled ? 'Your Nexus access is blocked. Ask a Nexus administrator.' : 'Your account does not have access to this part of Nexus. Ask a Nexus administrator.'});
    next();
  });
  const has = (req, section) => Boolean(req.access?.admin || req.access?.sections.includes(section));
  // The workspace asks who is signed in and which sections they may open; the checks above already enforce it.
  // Each visit also records the person (dbo.users) so administrators can find them in Admin › Users.
  app.get('/api/me', async (req, res, next) => {
    const user = signedInUser(req);
    if (!user) return res.status(401).json({error: {code: 'unauthenticated', message: 'Sign in with your Meridian Microsoft account.'}});
    try {
      const access = req.access || await accessOf(user);
      if (db.sqlConfig() && user.oid) require('./shared/permissions/store.cjs').sqlPermissionStore(() => db.pool()).recordSignIn({id: user.oid, email: user.name.toLowerCase(), name: user.displayName, entraAdmin: user.admin}).catch(() => {});
      res.json({email: user.name.toLowerCase(), name: user.displayName, admin: access.admin, blocked: access.disabled, preview: false, sections: access.sections});
    } catch (error) { next(error); }
  });
  app.get(WORKSPACE_ROUTE, (req, res) => res.sendFile(path.join(publicDir, 'workspace.html')));
  app.get(GAP_PAGES, (req, res) => res.sendFile(path.join(publicDir, 'workspace.html')));
  app.get(TOOL_PAGES, (req, res) => res.sendFile(path.join(publicDir, 'workspace.html')));
  // Gap trackers (code shared with the Nexus portal, server/shared/). Viewing: any signed-in Meridian account;
  // uploads: Nexus.Admin. The sign-in check above already enforces this; allow() repeats it so the API is safe alone.
  const {gapRoutes} = require('./shared/gap/routes.cjs');
  const {AppError} = require('./shared/errors.cjs');
  const store = gapStore || (require('./shared/db.cjs').sqlConfig() ? require('./shared/gap/store.cjs').sqlGapStore(() => require('./shared/db.cjs').pool()) : require('./shared/gap/store.cjs').memoryGapStore());
  gapRoutes({store, allow: (req, kind) => Boolean(signedInUser(req) && (kind === 'view' || has(req, 'gaps-upload'))), who: req => signedInUser(req)?.name || 'unknown'})(app);
  // Sales dashboard (shared code), "Sales dashboard" permission; the check above already refuses everyone else and
  // allow() repeats it so each API is safe on its own.
  const {salesRoutes} = require('./shared/sales/routes.cjs');
  const sales = salesStore || (db.sqlConfig() ? require('./shared/sales/store.cjs').sqlSalesStore(() => db.pool()) : require('./shared/sales/store.cjs').memorySalesStore());
  salesRoutes({store: sales, allow: req => has(req, 'sales')})(app);
  // StockFix reporting (shared code), every Meridian account (section "stockfix"); read-only from the StockFix data on SharePoint through the
  // Nexus SharePoint app (Key Vault secrets, the site's identity). Reps keep capturing in the StockFix app.
  const stockfix = stockfixSource !== undefined ? stockfixSource
    : require('./shared/stockfix/source.cjs').sharePointStockFixSource({graph: require('./shared/azure/graph.cjs').graphClient({vault: require('./shared/azure/keyvault.cjs').keyVault()})});
  require('./shared/stockfix/routes.cjs').stockfixRoutes({source: stockfix, allow: req => has(req, 'stockfix')})(app);
  // StockFix Adoption: the StockFix app's own adoption figures (stock-fix.replit.app API), read server-side.
  const adoptionLib = require('./shared/stockfix/adoption.cjs');
  adoptionLib.adoptionRoutes({source: stockfixAppSource || adoptionLib.stockfixAppSource(), allow: req => has(req, 'stockfix')})(app);
  // Report automation, Resources, ETLs, extraction profiles, Geo attendance and the SharePoint inventory (shared code),
  // each behind its own permission. Firebase-era Firestore and Storage through the keyless Google link when the site
  // has GOOGLE_* settings; otherwise their APIs answer 503.
  const google = {...require('./shared/google/services.cjs').googleServices(), ...googleServices};
  const userOf = req => { const user = signedInUser(req); return {email: user.name, name: user.displayName}; };
  require('./shared/automation/routes.cjs').automationRoutes({service: google.automation, allow: req => has(req, 'automation'), userOf})(app);
  require('./shared/resources/routes.cjs').resourceRoutes({service: google.resources, allow: req => has(req, 'resources'), userOf})(app);
  require('./shared/etl/routes.cjs').etlRoutes({service: google.etls, allow: req => has(req, 'etls'), userOf})(app);
  require('./shared/profiles/routes.cjs').profileRoutes({service: google.profiles, allow: req => has(req, 'profiles'), userOf})(app);
  require('./shared/attendance/routes.cjs').attendanceAdminRoutes({geo: google.geo, exclusions: google.exclusions, inventory: google.inventory, allow: req => has(req, req.path.startsWith('/api/integrations') ? 'integrations' : 'geo-attendance'), userOf})(app);
  // Permissions (Admin › Users): administrators only.
  require('./shared/permissions/routes.cjs').permissionRoutes({service: permissions, allow: req => Boolean(req.access?.admin), actorOf: req => ({email: signedInUser(req).name.toLowerCase(), entraAdmin: signedInUser(req).admin})})(app);
  // Migration health: the Firestore -> Azure SQL sync runs and checkpoints.
  app.get('/api/admin/sync', async (req, res, next) => {
    try {
      if (!has(req, 'admin')) throw new AppError('permission-denied', 'Migration health is open to Nexus administrators only.');
      if (!db.sqlConfig()) return res.json({sample: false, runs: [], collections: []});
      const iso = v => (v ? new Date(v).toISOString() : null);
      const runs = await db.query`SELECT TOP 48 id, mode, status, started_at, finished_at, documents_read, documents_written, documents_deleted, error FROM dbo.sync_runs ORDER BY id DESC`;
      const collections = await db.query`SELECT collection, field, last_full_at, document_count, updated_at FROM dbo.sync_checkpoints ORDER BY collection`;
      res.json({sample: false, runs: runs.map(r => ({id: Number(r.id), mode: r.mode, status: r.status, startedAt: iso(r.started_at), finishedAt: iso(r.finished_at), read: r.documents_read, written: r.documents_written, deleted: r.documents_deleted, error: r.error})),
        collections: collections.map(c => ({name: c.collection, field: c.field, lastFullAt: iso(c.last_full_at), documents: c.document_count, updatedAt: iso(c.updated_at)}))});
    } catch (error) { next(error); }
  });
  app.use(['/api/gaps', '/api/sales', '/api/stockfix', '/api/automation', '/api/resources', '/api/etls', '/api/profiles', '/api/geo-attendance', '/api/integrations', '/api/permissions', '/api/admin'], (error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof AppError) return res.status(error.status).json({error: {code: error.code, message: error.message}});
    if (error.type === 'entity.too.large') return res.status(413).json({error: {code: 'resource-exhausted', message: 'The file is too large.'}});
    if (error.type === 'entity.parse.failed') return res.status(400).json({error: {code: 'invalid-argument', message: 'The request could not be read.'}});
    console.error(JSON.stringify({event: 'workspace-api-failed', path: req.originalUrl.split('?')[0], error: String(error?.stack || error).slice(0, 1500)}));
    res.status(500).json({error: {code: 'internal', message: 'Nexus could not complete this request. Try again.'}});
  });
  mountNexusPortal(app, {fetchImpl: functionsFetch, ...(portalDir ? {portalDir} : {})});
  app.use('/api', (req, res, next) => {
    if (!enabled()) return res.status(503).json({error: 'The public dashboards are currently unavailable.'});
    if (req.path !== '/health' && !API_ROUTES.has('/api' + req.path)) return res.status(404).json({error: 'This viewer contains Attendance and Franchise Orders only.'});
    if (req.path === '/health') {
      if (req.method !== 'GET') return res.status(405).set('Allow', 'GET').json({error: 'Unsupported request method.'});
    } else if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').json({error: 'Unsupported request method.'});
    const time = now();
    for (const [key, limit] of limits) if (limit.until <= time) limits.delete(key);
    const ip = req.ip || 'unknown';
    if (!limits.has(ip)) {
      if (limits.size >= 2000) return res.status(429).set('Retry-After', '60').json({error: 'The viewer is busy. Try again shortly.'});
      limits.set(ip, {until: time + 60000, count: 0});
    }
    if (++limits.get(ip).count > 90) return res.status(429).set('Retry-After', '60').json({error: 'Please wait a minute before requesting more records.'});
    next();
  });
  app.use('/api', express.json({limit: '32kb', strict: true, inflate: false}));

  function evict(key) { const entry = cache.get(key); if (entry) cacheBytes -= entry.bytes; cache.delete(key); }
  async function requestReport(route, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (reportProvider) {
        const result = await reportProvider.request(route, body === undefined ? {} : JSON.parse(body));
        if (controller.signal.aborted) throw new Error('Report deadline exceeded');
        const bytes = Buffer.byteLength(JSON.stringify(result.data));
        if (bytes > MAX_RESPONSE) return {status:413, data:{error:'Narrow the filters to reduce the response size.'}};
        return {...result, bytes};
      }
      // Fixed origin and exact paths only. Never forward credentials, cookies or caller headers.
      let upstream;
      for (let attempt = 0; ; attempt++) {
        upstream = await fetchImpl(UPSTREAM + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {accept: 'application/json'} : {accept: 'application/json', 'content-type': 'application/json'},
        body, redirect: 'error', signal: controller.signal
        });
        // Cloud Run can reject before our JSON handler starts. Retry only
        // these read-only platform failures, within the original deadline.
        if (!upstream.headers.get('content-type')?.includes('application/json') && [429, 502, 503, 504].includes(upstream.status)) {
          const header = upstream.headers.get('retry-after');
          const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 0;
          const retrySeconds = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 5;
          const waitMs = Math.max(retryDelayMs * (attempt + 1), Number.isFinite(seconds) ? seconds * 1000 : 0);
          await upstream.body?.cancel();
          if (attempt < 2 && waitMs <= 5000 && enabled()) {
            await sleep(waitMs, undefined, {signal: controller.signal});
            continue;
          }
          return {status: upstream.status, retry: String(retrySeconds), data: {error: 'The report service is temporarily busy or unavailable. Please try again shortly.'}};
        }
        break;
      }
      if (!upstream.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected response type');
      if (Number(upstream.headers.get('content-length') || 0) > MAX_RESPONSE) { await upstream.body?.cancel(); throw new Error('Response too large'); }
      const reader = upstream.body.getReader(), chunks = [];
      let size = 0;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_RESPONSE) { await reader.cancel(); throw new Error('Response too large'); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid report response');
      if (!upstream.ok) {
        const status = [400, 404, 409, 413, 429, 503].includes(upstream.status) ? upstream.status : 502;
        return {status, data: {error: status === 502 ? 'The report service is unavailable. Please try again shortly.' : String(data.error || 'The report could not be loaded.').slice(0, 500)}, retry: status === 429 ? '60' : undefined};
      }
      return {status: 200, data, bytes: size};
    } catch (error) {
      return {status: controller.signal.aborted ? 504 : 502, data: {error: 'The report service did not respond successfully. Please try again shortly.'}};
    } finally { clearTimeout(timer); }
  }

  app.use('/api', async (req, res) => {
    const route = '/api' + req.path;
    if (req.method === 'POST' && (!req.is('application/json') || !req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({error: 'Invalid dashboard request.'});
    const body = req.method === 'POST' ? JSON.stringify(req.body) : undefined;
    const key = route + ':' + (body || '');
    const cacheable = req.method === 'POST' && !req.body.export && req.body.mode !== 'export' && !req.body.refresh;
    for (const [entryKey, entry] of cache) if (entry.until <= now()) evict(entryKey);
    let result = cacheable ? cache.get(key)?.result : null;
    if (!result) {
      let request = pending.get(key);
      if (!request) {
        if (pending.size >= 8) return res.status(503).set('Retry-After', '5').json({error: 'The report service is busy. Please try again shortly.'});
        request = requestReport(route, body);
        pending.set(key, request);
        request.finally(() => pending.delete(key));
      }
      result = await request;
      if (cacheable && result.status === 200 && !cache.has(key)) {
        while (cache.size && (cache.size >= 32 || cacheBytes + result.bytes > 32 * 1024 * 1024)) evict(cache.keys().next().value);
        cache.set(key, {result, bytes: result.bytes, until: now() + 15000});
        cacheBytes += result.bytes;
      }
    }
    if (!enabled()) return res.status(503).json({error: 'The public dashboards are currently unavailable.'});
    if (result.retry) res.set('Retry-After', result.retry);
    res.status(result.status).json(result.data);
  });
  const staticFiles = express.static(publicDir, {dotfiles: 'deny', index: false, redirect: false, etag: true});
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).set('Allow', 'GET, HEAD').json({error: 'Read-only dashboard.'});
    if (PAGE_ROUTE.test(req.path)) return res.sendFile(path.join(publicDir, 'index.html'));
    if (assets.has(req.path)) return staticFiles(req, res, next);
    res.status(404).json({error: 'Page not found.'});
  });
  app.use((error, req, res, next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.status === 415 ? 415 : 400;
    if (!res.headersSent) res.status(status).json({error: 'Invalid dashboard request.'});
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4190);
  const mode = process.env.DASHBOARD_DATA_MODE || 'google-proxy';
  if (!['google-proxy','azure-snapshot'].includes(mode)) throw Error('Invalid dashboard data mode.');
  const reportProvider = mode === 'azure-snapshot' ? require('./azure-reports.cjs').createAzureReports() : null;
  createApp({reportProvider}).listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Azure field dashboards listening on ${port}; data mode: ${mode}.`));
}
module.exports = {createApp, UPSTREAM, MERIDIAN_TENANT};
