'use strict';
// Permission management API (Nexus administrators only), mounted by nexus.meridiangroup.co.za.
//   GET    /api/permissions           catalogue, everyone known (signed in, staff directory, granted), recent changes
//   PUT    /api/permissions/:email    {name?, admin, disabled, sections: [...], note?}
//   DELETE /api/permissions/:email    back to the defaults
const express = require('express');
const {AppError} = require('../errors.cjs');

function permissionRoutes({service, allow, actorOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'Only Nexus administrators manage permissions.'));
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);
  return app => {
    app.get('/api/permissions', guard, wrap(async (req, res) => send(res, await service.people())));
    app.put('/api/permissions/:email', guard, sameSite, express.json({limit: '8kb', strict: true}), wrap(async (req, res) => send(res, await service.save(actorOf(req), req.params.email, req.body || {}))));
    app.delete('/api/permissions/:email', guard, sameSite, wrap(async (req, res) => send(res, await service.remove(actorOf(req), req.params.email))));
  };
}

module.exports = {permissionRoutes};
