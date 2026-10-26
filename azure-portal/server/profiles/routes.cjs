'use strict';
// Extraction profiles and step sets API, mounted by both the Nexus portal and nexus.meridiangroup.co.za (Nexus admins).
//   GET    /api/profiles                  profiles (no passwords), step sets, step actions
//   PUT    /api/profiles/profiles         {id?, name, webAddress, username, extractionProfileId?, password?}
//   DELETE /api/profiles/profiles/:id
//   PUT    /api/profiles/step-sets        {id?, name, steps: [{id?, action, selector, value}]}
//   DELETE /api/profiles/step-sets/:id
const express = require('express');
const {AppError} = require('../errors.cjs');

function profileRoutes({service, allow, userOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'Extraction profiles are open to Nexus administrators only.'));
  const ready = (req, res, next) => next(service ? undefined : new AppError('unavailable', 'Extraction profiles are not connected on this site yet.'));
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const change = [guard, ready, sameSite, express.json({limit: '64kb', strict: true})];
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);
  return app => {
    app.get('/api/profiles', guard, ready, wrap(async (req, res) => send(res, await service.list())));
    app.put('/api/profiles/profiles', ...change, wrap(async (req, res) => send(res, await service.saveProfile(userOf(req), req.body || {}))));
    app.delete('/api/profiles/profiles/:id', guard, ready, sameSite, wrap(async (req, res) => send(res, await service.deleteProfile(userOf(req), req.params.id))));
    app.put('/api/profiles/step-sets', ...change, wrap(async (req, res) => send(res, await service.saveStepSet(userOf(req), req.body || {}))));
    app.delete('/api/profiles/step-sets/:id', guard, ready, sameSite, wrap(async (req, res) => send(res, await service.deleteStepSet(userOf(req), req.params.id))));
  };
}

module.exports = {profileRoutes};
