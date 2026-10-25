'use strict';
// ETL API, mounted by both the Nexus portal and nexus.meridiangroup.co.za (Nexus admins).
//   GET  /api/etls                          pipelines, channels, shared reference set, usable resources, latest 50 runs
//   GET  /api/etls/runs/:id                 run, result and progress (reconciled with the worker's files)
//   POST /api/etls/runs                     {pipelineId, resources, rules?, reportMonth?, referenceRevision}  start a run
//   POST /api/etls/runs/:id/retry           retry a failed run with the same inputs
//   POST /api/etls/runs/:id/approve         {confirm: true}
//   GET  /api/etls/runs/:id/outputs/:file   workbook | facts | exceptions | dc | assignments
//   PUT  /api/etls/pipelines                {id?, customer, channelId, kind, reportName, notes, resources, revision}
//   PUT  /api/etls/references               {resources, revision}
const express = require('express');
const {Readable} = require('node:stream');
const {AppError} = require('../errors.cjs');

function etlRoutes({service, allow, userOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'Only an active Nexus administrator can manage ETLs and shared master data.'));
  const ready = (req, res, next) => next(service ? undefined : new AppError('unavailable', 'ETLs are not connected on this site yet.'));
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const change = [guard, ready, sameSite, express.json({limit: '32kb', strict: true})];
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);
  return app => {
    app.get('/api/etls', guard, ready, wrap(async (req, res) => { const [catalogue, history] = await Promise.all([service.catalogue(), service.history()]); send(res, {...catalogue, runs: history.runs}); }));
    app.get('/api/etls/runs/:id', guard, ready, wrap(async (req, res) => send(res, await service.detail(req.params.id))));
    app.post('/api/etls/runs', ...change, wrap(async (req, res) => send(res.status(201), await service.run(userOf(req), req.body || {}))));
    app.post('/api/etls/runs/:id/retry', ...change, wrap(async (req, res) => send(res.status(201), await service.retry(userOf(req), {id: req.params.id}))));
    app.post('/api/etls/runs/:id/approve', ...change, wrap(async (req, res) => send(res, await service.approve(userOf(req), {id: req.params.id, confirm: req.body?.confirm === true}))));
    app.get('/api/etls/runs/:id/outputs/:file', guard, ready, wrap(async (req, res) => {
      const file = await service.output(userOf(req), req.params.id, req.params.file);
      res.set({'Content-Type': file.type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', ...(file.size ? {'Content-Length': String(file.size)} : {})});
      Readable.fromWeb(file.body).pipe(res);
    }));
    app.put('/api/etls/pipelines', ...change, wrap(async (req, res) => send(res, await service.savePipeline(userOf(req), req.body || {}))));
    app.put('/api/etls/references', ...change, wrap(async (req, res) => send(res, await service.saveReferences(userOf(req), req.body || {}))));
  };
}

module.exports = {etlRoutes};
