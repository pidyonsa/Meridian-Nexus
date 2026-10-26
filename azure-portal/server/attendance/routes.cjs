'use strict';
// Geo attendance admin and SharePoint integration inventory API (Nexus admins), mounted by both Nexus sites.
//   GET  /api/geo-attendance                           tracker, operational week, store masters, schedule, exclusions
//   PUT  /api/geo-attendance/tracker                   {sharePointUrl}  validate the Rep TNA tracker and save it
//   PUT  /api/geo-attendance/week                      {operationalWeek: 1-4}
//   POST /api/geo-attendance/store-master?id=&name=&fileName=   the .xlsx bytes (25 MB)
//   GET  /api/geo-attendance/exclusions/template       Excel template
//   POST /api/geo-attendance/exclusions/preview        {entries} | {workbook: base64, type, audience}
//   POST /api/geo-attendance/exclusions/:action        commit {entries, reviewId, revision} | setEnabled {id, enabled, revision} | remove {id, revision}
//   GET  /api/integrations                             latest SharePoint inventory, scans, local code contracts
//   POST /api/integrations/scan                        {maxItems?}
const express = require('express');
const {AppError} = require('../errors.cjs');

function attendanceAdminRoutes({geo, exclusions, inventory, allow, userOf}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'This tool is open to Nexus administrators only.'));
  const ready = service => (req, res, next) => next(service ? undefined : new AppError('unavailable', 'This tool is not connected on this site yet.'));
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const json = limit => express.json({limit, strict: true});
  const send = (res, data) => res.set('Cache-Control', 'no-store').json(data);
  return app => {
    app.get('/api/geo-attendance', guard, ready(geo), wrap(async (req, res) => { const [overview, list] = await Promise.all([geo.overview(), exclusions.list()]); send(res, {...overview, exclusions: list}); }));
    app.put('/api/geo-attendance/tracker', guard, ready(geo), sameSite, json('8kb'), wrap(async (req, res) => send(res, await geo.saveTracker(userOf(req), req.body || {}))));
    app.put('/api/geo-attendance/week', guard, ready(geo), sameSite, json('1kb'), wrap(async (req, res) => send(res, await geo.saveWeek(userOf(req), req.body || {}))));
    app.post('/api/geo-attendance/store-master', guard, ready(geo), sameSite, express.raw({type: () => true, limit: '25mb'}), wrap(async (req, res) => {
      send(res, await geo.saveStoreMaster(userOf(req), {id: req.query.id, name: req.query.name, fileName: req.query.fileName, data: Buffer.isBuffer(req.body) ? req.body : null}));
    }));
    app.get('/api/geo-attendance/exclusions/template', guard, ready(exclusions), wrap(async (req, res) => {
      const file = await exclusions.template();
      res.set({'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file.fileName}"`, 'Cache-Control': 'no-store'}).send(file.data);
    }));
    app.post('/api/geo-attendance/exclusions/preview', guard, ready(exclusions), sameSite, json('2mb'), wrap(async (req, res) => send(res, await exclusions.preview(userOf(req), req.body || {}))));
    app.post('/api/geo-attendance/exclusions/:action', guard, ready(exclusions), sameSite, json('512kb'), wrap(async (req, res) => send(res, await exclusions.change(userOf(req), req.params.action, req.body || {}))));
    app.get('/api/integrations', guard, ready(inventory), wrap(async (req, res) => send(res, await inventory.overview(req.query.limit))));
    app.post('/api/integrations/scan', guard, ready(inventory), sameSite, json('1kb'), wrap(async (req, res) => send(res, await inventory.scan(userOf(req), req.body || {}))));
  };
}

module.exports = {attendanceAdminRoutes};
