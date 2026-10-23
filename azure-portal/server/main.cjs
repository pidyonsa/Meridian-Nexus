'use strict';
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('node:path');
const {AppError, requestId, errorHandler} = require('./errors.cjs');
const {authentication, requireUser} = require('./auth.cjs');
const {sectionsFor} = require('./access.cjs');

// createApp takes its dependencies so tests can run it without Azure. `api` mounts the feature routers.
// profileFor(user) returns the user's stored Nexus permissions (dbo.users.profile); none until users are migrated.
function createApp({publicDir = path.join(__dirname, '..', 'public'), env = process.env, api = [], log = console, profileFor = async () => ({})} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet({
    contentSecurityPolicy: {useDefaults: true, directives: {'script-src': ["'self'"], 'style-src': ["'self'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'img-src': ["'self'", 'data:', 'blob:'], 'connect-src': ["'self'"], 'frame-ancestors': ["'none'"]}},
    referrerPolicy: {policy: 'same-origin'}
  }));
  app.use(compression());

  // Health check for App Service; the only route open without sign-in.
  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  app.use(authentication(env));
  app.use(requireUser(env));

  // State-changing API calls must come from this site (Easy Auth cookies are sent cross-site otherwise).
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) return next();
    const origin = req.get('origin');
    const host = `${req.protocol}://${req.get('host')}`;
    next(origin && origin !== host && origin !== env.PUBLIC_ORIGIN ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  });
  app.use('/api', express.json({limit: '1mb'}));
  app.get('/api/me', async (req, res, next) => {
    try {
      const profile = await profileFor(req.user);
      if (profile.disabled && !req.user.admin) throw new AppError('permission-denied', 'Your Nexus account is disabled. Ask the Nexus administrator for access.');
      res.json({id: req.user.id, email: req.user.email, name: req.user.name, admin: req.user.admin, preview: req.user.preview, sections: sectionsFor(req.user, profile, env)});
    } catch (error) { next(error); }
  });
  for (const mount of api) mount(app);
  app.use('/api', (req, res, next) => next(new AppError('not-found', 'Unknown Nexus API.')));

  app.use(express.static(publicDir, {index: false, maxAge: '1h', setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); }}));
  // The portal is a single-page app: every other page route serves the shell.
  app.get(/^\/(?!\.auth\/).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(publicDir, 'index.html')));

  app.use(errorHandler(log));
  return app;
}

// Production wiring: Azure SQL when configured, invented sample data for a local preview, otherwise unavailable.
function defaultRepo(env = process.env) {
  const {sqlConfig, query} = require('./db.cjs');
  if (sqlConfig(env)) return require('./repo.cjs').sqlRepo(query);
  if (require('./auth.cjs').previewAllowed(env)) return require('./fixtures.cjs').previewRepo();
  const unavailable = async () => { throw new AppError('unavailable', 'The Nexus database is not configured.'); };
  return {collection: unavailable, findUserByEmail: unavailable, syncStatus: unavailable};
}

function profileFrom(repo) {
  return async user => {
    const doc = user.email ? await repo.findUserByEmail(user.email) : null;
    return doc ? {...(doc.data.permissions || {}), disabled: doc.data.disabled === true} : {};
  };
}

module.exports = {createApp, defaultRepo, profileFrom};
if (require.main === module) {
  const port = Number(process.env.PORT || 4200);
  const repo = defaultRepo();
  const {adminRoutes} = require('./routes/admin.cjs');
  createApp({api: [adminRoutes(repo)], profileFor: profileFrom(repo)}).listen(port, () => console.log(`Nexus portal on http://localhost:${port}${repo.sample ? ' (sample data)' : ''}`));
}
