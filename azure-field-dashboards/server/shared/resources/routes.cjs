'use strict';
// Shared resources API, mounted by both the Nexus portal and nexus.meridiangroup.co.za (Nexus admins).
//   GET    /api/resources                       categories and the catalogue
//   POST   /api/resources/upload?id=&name=      the file bytes (any type, up to 100 MB) -> {id, storagePath, sourceName}
//   PUT    /api/resources/:id                   {title, category, description, tags, active, storagePath?, sourceName?}
//   GET    /api/resources/:id/download          the current file
//   DELETE /api/resources/:id                   the resource and every stored version
const express = require('express');
const {Readable} = require('node:stream');
const {AppError} = require('../errors.cjs');

function resourceRoutes({service, allow, userOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'Resources are open to Nexus administrators only.'));
  const ready = (req, res, next) => next(service ? undefined : new AppError('unavailable', 'Resources are not connected on this site yet.'));
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);
  return app => {
    app.get('/api/resources', guard, ready, wrap(async (req, res) => send(res, await service.list())));
    app.post('/api/resources/upload', guard, ready, sameSite, express.raw({type: () => true, limit: '100mb'}), wrap(async (req, res) => {
      send(res.status(201), await service.upload(userOf(req), {id: req.query.id, name: req.query.name, type: req.get('content-type'), data: Buffer.isBuffer(req.body) ? req.body : null}));
    }));
    app.put('/api/resources/:id', guard, ready, sameSite, express.json({limit: '32kb'}), wrap(async (req, res) => send(res, await service.save(userOf(req), req.params.id, req.body || {}))));
    app.get('/api/resources/:id/download', guard, ready, wrap(async (req, res) => {
      const file = await service.download(userOf(req), req.params.id);
      res.set({'Content-Type': file.type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', ...(file.size ? {'Content-Length': String(file.size)} : {})});
      Readable.fromWeb(file.body).pipe(res);
    }));
    app.delete('/api/resources/:id', guard, ready, sameSite, wrap(async (req, res) => send(res, await service.remove(userOf(req), req.params.id))));
  };
}

module.exports = {resourceRoutes};
