'use strict';
// Report automation API, mounted by both the Nexus portal and nexus.meridiangroup.co.za (Nexus admins).
//   GET  /api/automation                         profiles, runs (live and recent), waiting prompts, alerts, audit, reports
//   GET  /api/automation/runs/:id                one run with its full timeline
//   POST /api/automation/runs                    {retailerId, reportStartDate?, reportEndDate?}  queue a run
//   POST /api/automation/runs/:id/abort | keep-waiting | restart | retry
//   POST /api/automation/end-all                 cancel every active run and waiting prompt
//   PUT  /api/automation/schedules/:retailerId   {enabled, time, daysOfWeek, dateMode, startDate?, endDate?}
//   POST /api/automation/prompts/:id             {action: submit|approve|cancel, value?}
//   GET  /api/automation/reports/:fileId         download a delivered report
// `allow(req)` decides access; `userOf(req)` gives {email, name}. Without Google access configured every route answers
// 503, so the page can say where the tools still run.
const express = require('express');
const {Readable} = require('node:stream');
const {AppError} = require('../errors.cjs');

function automationRoutes({service, allow, userOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'Report automation on Azure is open to Nexus administrators only.'));
  const ready = (req, res, next) => next(service ? undefined : new AppError('unavailable', 'Report automation is not connected on this site yet.'));
  // Changes come from the Nexus page itself: refuse cross-site posts (sign-in cookies travel with them otherwise).
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const json = express.json({limit: '16kb', strict: true});
  const change = [guard, ready, sameSite, json];
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);

  return app => {
    app.get('/api/automation', guard, ready, wrap(async (req, res) => send(res, await service.workspace(userOf(req)))));
    app.get('/api/automation/runs/:id', guard, ready, wrap(async (req, res) => send(res, await service.runDetail(userOf(req), req.params.id))));
    app.post('/api/automation/runs', ...change, wrap(async (req, res) => send(res.status(201), await service.start(userOf(req), req.body || {}))));
    const actions = {abort: 'abort', 'keep-waiting': 'keepWaiting', restart: 'restart', retry: 'retryStep'};
    app.post('/api/automation/runs/:id/:action', ...change, wrap(async (req, res) => {
      const method = actions[req.params.action];
      if (!method) throw new AppError('not-found', 'Unknown job action.');
      send(res, await service[method](userOf(req), req.params.id));
    }));
    app.post('/api/automation/end-all', ...change, wrap(async (req, res) => send(res, await service.endAll(userOf(req)))));
    app.put('/api/automation/schedules/:retailerId', ...change, wrap(async (req, res) => send(res, await service.saveSchedule(userOf(req), req.params.retailerId, req.body || {}))));
    app.post('/api/automation/prompts/:id', ...change, wrap(async (req, res) => send(res, await service.answerPrompt(userOf(req), req.params.id, req.body || {}))));
    app.get('/api/automation/reports/:fileId', guard, ready, wrap(async (req, res) => {
      const file = await service.reportFile(userOf(req), req.params.fileId);
      res.set({'Content-Type': file.type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', ...(file.size ? {'Content-Length': String(file.size)} : {})});
      Readable.fromWeb(file.body).pipe(res);
    }));
  };
}

module.exports = {automationRoutes};
