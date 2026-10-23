'use strict';
// Gap tracker API, mounted by both the Nexus portal and nexus.meridiangroup.co.za.
//   GET  /api/gaps/:client                 banners, weeks, status mix and week-on-week movement
//   GET  /api/gaps/:client/compare         ?banner=&from=&to=  movements between two weeks, with every change
//   GET  /api/gaps/:client/export          same query, as an Excel workbook
//   GET  /api/gaps/:client/uploads         upload history (managers)
//   POST /api/gaps/:client/preview         {fileName, data: base64}  check a workbook without saving (managers)
//   POST /api/gaps/:client/upload          same body: replace the weeks in the file (managers)
// `allow(req, 'view' | 'manage')` decides access; `who(req)` names the signed-in person for the upload record.
const crypto = require('node:crypto');
const express = require('express');
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');
const {parseWorkbook, summarise} = require('./parse.cjs');
const {compare, combine, weeksByBanner, MOVES} = require('./report.cjs');

const CLIENTS = {'sir-fruit': {label: 'Sir Fruit', banners: ['PnP Family', 'Dis-Chem', "Food Lover's Market"]}};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function gapRoutes({store, allow, who}) {
  const cache = new Map();
  const clientOf = req => {
    const client = CLIENTS[req.params.client];
    if (!client) throw new AppError('not-found', 'Unknown gap tracker.');
    return {id: req.params.client, ...client};
  };
  const guard = kind => (req, res, next) => next(allow(req, kind) ? undefined : new AppError('permission-denied', kind === 'manage' ? 'Only Nexus administrators can upload gap reports.' : 'You do not have access to this gap tracker.'));
  // Uploads come from the Nexus page itself: refuse cross-site posts (sign-in cookies travel with them otherwise).
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  async function overview(client) {
    const totals = await store.weekTotals(client.id);
    const banners = weeksByBanner(totals);
    const out = [];
    for (const name of client.banners) {
      const weeks = banners.get(name) || [];
      const steps = [];
      for (let i = 1; i < weeks.length; i++) {
        const c = compare(await store.moves(client.id, name, weeks[i - 1].week, weeks[i].week));
        steps.push({from: weeks[i - 1].week, to: weeks[i].week, compared: c.compared, ...c.metrics});
      }
      out.push({banner: name, weeks, steps});
    }
    return out;
  }

  async function comparison(client, query) {
    const banner = String(query.banner || 'all');
    if (banner !== 'all' && !client.banners.includes(banner)) throw new AppError('invalid-argument', 'Unknown banner.');
    const {from, to} = query;
    if (!DATE.test(from || '') || !DATE.test(to || '') || from >= to) throw new AppError('invalid-argument', 'Choose two weeks, the earlier one first.');
    const names = banner === 'all' ? client.banners : [banner];
    const parts = [];
    for (const name of names) {
      const moves = (await store.moves(client.id, name, from, to)).map(m => ({...m, banner: name}));
      if (!moves.length) continue;
      parts.push({banner: name, ...compare(moves, await store.storeChanges(client.id, name, from, to))});
    }
    const result = banner === 'all' ? combine(parts) : parts[0] || compare([]);
    return {banner, from, to, ...result, banners: parts.map(p => ({banner: p.banner, compared: p.compared, ...p.metrics}))};
  }

  function readUpload(req) {
    const {fileName, data} = req.body || {};
    if (typeof fileName !== 'string' || !/\.xlsx$/i.test(fileName) || fileName.length > 200) throw new AppError('invalid-argument', 'Choose the client\'s .xlsx gap report.');
    if (typeof data !== 'string' || !data.length) throw new AppError('invalid-argument', 'The file is empty.');
    const buffer = Buffer.from(data, 'base64');
    return {fileName: fileName.replace(/[^\w .()&'-]/g, '_'), buffer, sha256: crypto.createHash('sha256').update(buffer).digest('hex')};
  }

  async function plan(client, parsed) {
    const existing = new Set((await store.existingWeeks(client.id)).map(w => `${w.banner}|${w.week}`));
    const summary = summarise(parsed);
    for (const b of summary.banners) for (const w of b.weeks) w.action = existing.has(`${b.banner}|${w.week}`) ? 'replace' : 'new';
    return summary;
  }

  return app => {
    const base = '/api/gaps/:client';
    app.get(base, guard('view'), wrap(async (req, res) => {
      const client = clientOf(req);
      const key = `overview:${client.id}`;
      if (!cache.has(key)) cache.set(key, overview(client).catch(error => { cache.delete(key); throw error; }));
      res.json({client: client.id, label: client.label, moves: MOVES, banners: await cache.get(key), manage: allow(req, 'manage')});
    }));
    app.get(`${base}/compare`, guard('view'), wrap(async (req, res) => {
      const result = await comparison(clientOf(req), req.query);
      const limit = 5000;
      res.json({...result, changes: result.changes.slice(0, limit), changesTotal: result.changes.length, truncated: result.changes.length > limit});
    }));
    app.get(`${base}/export`, guard('view'), wrap(async (req, res) => {
      const client = clientOf(req);
      const r = await comparison(client, req.query);
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Meridian Nexus';
      const summary = wb.addWorksheet('Summary');
      summary.addRows([[`${client.label} distribution gaps`], [`${r.banner === 'all' ? 'All banners' : r.banner}: ${r.from} to ${r.to}`], [], ['Movement', 'Store x product']]);
      for (const [k, m] of Object.entries(MOVES)) summary.addRow([m.label, r.metrics[k]]);
      summary.addRow(['Net gain (converted + recovered − lost)', r.metrics.net]);
      summary.addRow(['Compared (in both weeks)', r.compared]);
      summary.getColumn(1).width = 44; summary.getRow(1).font = {bold: true, size: 14};
      const detail = wb.addWorksheet('Changes');
      detail.columns = [{header: 'Banner', key: 'banner', width: 20}, {header: 'Store', key: 'store', width: 36}, {header: 'Region', key: 'region', width: 16}, {header: 'Product', key: 'product', width: 44},
        {header: r.from, key: 'from', width: 14}, {header: r.to, key: 'to', width: 14}, {header: 'Movement', key: 'label', width: 24}];
      detail.addRows(r.changes.map(c => ({...c, banner: c.banner || r.banner, label: MOVES[c.move].label})));
      detail.getRow(1).font = {bold: true}; detail.views = [{state: 'frozen', ySplit: 1}]; detail.autoFilter = {from: 'A1', to: 'G1'};
      const coverage = wb.addWorksheet('Store coverage');
      coverage.columns = [{header: `New in ${r.to}`, key: 'n', width: 44}, {header: `Not in ${r.to}`, key: 'm', width: 44}];
      for (let i = 0; i < Math.max(r.coverage.newStores.length, r.coverage.missingStores.length); i++) coverage.addRow({n: r.coverage.newStores[i] || '', m: r.coverage.missingStores[i] || ''});
      const name = `${client.label}-gaps-${r.banner === 'all' ? 'all' : r.banner.replace(/\W+/g, '')}-${r.from}-to-${r.to}.xlsx`;
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition', `attachment; filename="${name}"`);
      res.send(Buffer.from(await wb.xlsx.writeBuffer()));
    }));
    app.get(`${base}/uploads`, guard('manage'), wrap(async (req, res) => res.json({uploads: await store.uploads(clientOf(req).id)})));
    const body = express.json({limit: '15mb'});
    app.post(`${base}/preview`, sameSite, guard('manage'), body, wrap(async (req, res) => {
      const client = clientOf(req);
      const file = readUpload(req);
      res.json({fileName: file.fileName, sha256: file.sha256, ...(await plan(client, await parseWorkbook(file.buffer)))});
    }));
    app.post(`${base}/upload`, sameSite, guard('manage'), body, wrap(async (req, res) => {
      const client = clientOf(req);
      const file = readUpload(req);
      const parsed = await parseWorkbook(file.buffer);
      const summary = await plan(client, parsed);
      const saved = await store.save({client: client.id, fileName: file.fileName, sha256: file.sha256, uploadedBy: who(req), parsed, summary});
      cache.clear();
      res.json({...saved, ...summary});
    }));
  };
}

module.exports = {gapRoutes, CLIENTS};
