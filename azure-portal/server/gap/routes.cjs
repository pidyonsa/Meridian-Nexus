'use strict';
// Gap tracker API (any number of clients), mounted by both the Nexus portal and nexus.meridiangroup.co.za.
//   GET  /api/gaps                         clients (with their colours and latest week)
//   POST /api/gaps/clients                 {label}  add a client (managers)
//   GET  /api/gaps/:client                 banners, weeks, status mix and week-on-week movement
//   GET  /api/gaps/:client/compare         ?banner=&from=&to=  movements between two weeks, with every change
//   GET  /api/gaps/:client/detail          ?banner=&week=      one week in depth: products, stores, regions, heatmap, persistent gaps
//   GET  /api/gaps/:client/export          ?banner=&from=&to=  Excel workbook
//   GET  /api/gaps/:client/uploads         upload history (managers)
//   POST /api/gaps/:client/preview         {fileName, data: base64}  check a workbook without saving (managers)
//   POST /api/gaps/:client/upload          same body: replace the weeks in the file (managers)
// `allow(req, 'view' | 'manage')` decides access; `who(req)` names the signed-in person for the upload record.
const crypto = require('node:crypto');
const express = require('express');
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');
const {parseWorkbook, summarise, BANNERS} = require('./parse.cjs');
const {compare, combine, detail, weeksByBanner, MOVES} = require('./report.cjs');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_ID = /^[a-z0-9-]{2,60}$/;
const KNOWN_ORDER = BANNERS.map(b => b.banner);
const bannerOrder = (a, b) => (KNOWN_ORDER.indexOf(a) + 1 || 99) - (KNOWN_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);
const slug = label => String(label).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);

function gapRoutes({store, allow, who}) {
  const cache = new Map();
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = kind => (req, res, next) => next(allow(req, kind) ? undefined : new AppError('permission-denied', kind === 'manage' ? 'Only Nexus administrators can upload gap reports.' : 'You do not have access to the gap tracker.'));
  // Uploads come from the Nexus page itself: refuse cross-site posts (sign-in cookies travel with them otherwise).
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    next(origin && origin !== `${req.protocol}://${req.get('host')}` ? new AppError('permission-denied', 'Requests must come from Nexus.') : undefined);
  };
  const cached = (key, load) => { if (!cache.has(key)) cache.set(key, load().catch(error => { cache.delete(key); throw error; })); return cache.get(key); };

  async function clientOf(req) {
    const id = req.params.client;
    if (!CLIENT_ID.test(id || '')) throw new AppError('not-found', 'Unknown client.');
    const client = (await cached('clients', () => store.clients())).find(c => c.id === id);
    if (!client) throw new AppError('not-found', 'Unknown client.');
    return client;
  }

  async function overview(client) {
    const banners = weeksByBanner(await store.weekTotals(client.id));
    const out = [];
    for (const name of [...banners.keys()].sort(bannerOrder)) {
      const weeks = banners.get(name);
      const steps = [];
      for (let i = 1; i < weeks.length; i++) {
        const c = compare(await store.moves(client.id, name, weeks[i - 1].week, weeks[i].week));
        steps.push({from: weeks[i - 1].week, to: weeks[i].week, compared: c.compared, ...c.metrics, rates: c.rates});
      }
      out.push({banner: name, weeks, steps});
    }
    return out;
  }

  async function bannersOf(client) { return (await cached(`overview:${client.id}`, () => overview(client))).map(b => b.banner); }

  async function comparison(client, query) {
    const banner = String(query.banner || 'all'), all = await bannersOf(client);
    if (banner !== 'all' && !all.includes(banner)) throw new AppError('invalid-argument', 'Unknown banner.');
    const {from, to} = query;
    if (!DATE.test(from || '') || !DATE.test(to || '') || from >= to) throw new AppError('invalid-argument', 'Choose two weeks, the earlier one first.');
    const parts = [];
    for (const name of banner === 'all' ? all : [banner]) {
      const moves = (await store.moves(client.id, name, from, to)).map(m => ({...m, banner: name}));
      if (!moves.length) continue;
      parts.push({banner: name, ...compare(moves, await store.storeChanges(client.id, name, from, to))});
    }
    const result = banner === 'all' ? combine(parts) : parts[0] || compare([]);
    return {banner, from, to, ...result, banners: parts.map(p => ({banner: p.banner, compared: p.compared, ...p.metrics, rates: p.rates}))};
  }

  async function weekDetail(client, query) {
    const banner = String(query.banner || 'all'), data = await cached(`overview:${client.id}`, () => overview(client));
    const chosen = banner === 'all' ? data : data.filter(b => b.banner === banner);
    if (!chosen.length) throw new AppError('invalid-argument', 'Unknown banner.');
    const weeks = [...new Set(chosen.flatMap(b => b.weeks.map(w => w.week)))].sort();
    const week = DATE.test(query.week || '') ? query.week : weeks.at(-1);
    if (!weeks.includes(week)) throw new AppError('invalid-argument', 'That week is not in the tracker.');
    const upTo = weeks.filter(w => w <= week).slice(-12);   // persistence looks back at most 12 reported weeks
    const history = await store.observations(client.id, banner === 'all' ? null : banner, upTo);
    const rows = history.filter(r => r.week === week), prev = upTo.at(-2);
    return {banner, week, previousWeek: prev || null, weeks: upTo, ...detail({rows, prevRows: prev ? history.filter(r => r.week === prev) : [], history, weeks: upTo, byBanner: banner === 'all'})};
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
    app.get('/api/gaps', guard('view'), wrap(async (req, res) => {
      const clients = await cached('clients', () => store.clients());
      const out = [];
      for (const c of clients) {
        const banners = await cached(`overview:${c.id}`, () => overview(c));
        out.push({...c, banners: banners.length, latestWeek: banners.flatMap(b => b.weeks.map(w => w.week)).sort().at(-1) || null});
      }
      res.json({clients: out, manage: allow(req, 'manage')});
    }));
    app.post('/api/gaps/clients', sameSite, guard('manage'), express.json({limit: '10kb'}), wrap(async (req, res) => {
      const label = String(req.body?.label || '').replace(/\s+/g, ' ').trim();
      const id = slug(label);
      if (label.length < 2 || label.length > 120 || !CLIENT_ID.test(id)) throw new AppError('invalid-argument', 'Give the client a name of 2 to 120 letters or numbers.');
      if ((await store.clients()).some(c => c.id === id)) throw new AppError('failed-precondition', `${label} is already a client.`);
      const client = await store.createClient({id, label, createdBy: who(req)});
      cache.clear();
      res.status(201).json(client);
    }));

    const base = '/api/gaps/:client';
    app.get(base, guard('view'), wrap(async (req, res) => {
      const client = await clientOf(req);
      res.json({client: client.id, label: client.label, colors: client.colors, moves: MOVES, banners: await cached(`overview:${client.id}`, () => overview(client)), manage: allow(req, 'manage')});
    }));
    app.get(`${base}/compare`, guard('view'), wrap(async (req, res) => {
      const result = await comparison(await clientOf(req), req.query);
      const limit = 5000;
      res.json({...result, changes: result.changes.slice(0, limit), changesTotal: result.changes.length, truncated: result.changes.length > limit});
    }));
    app.get(`${base}/detail`, guard('view'), wrap(async (req, res) => {
      const client = await clientOf(req);
      const key = `detail:${client.id}:${req.query.banner || 'all'}:${req.query.week || 'latest'}`;
      const d = await cached(key, () => weekDetail(client, req.query));
      res.json({...d, stores: d.stores.slice(0, 2000), persistent: d.persistent.slice(0, 2000), persistentTotal: d.persistent.length});
    }));
    app.get(`${base}/export`, guard('view'), wrap(async (req, res) => {
      const client = await clientOf(req);
      const r = await comparison(client, req.query);
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Meridian Nexus';
      const summary = wb.addWorksheet('Summary');
      summary.addRows([[`${client.label} distribution gaps`], [`${r.banner === 'all' ? 'All banners' : r.banner}: ${r.from} to ${r.to}`], [], ['Movement', 'Store x product']]);
      for (const [k, m] of Object.entries(MOVES)) summary.addRow([m.label, r.metrics[k]]);
      summary.addRow(['Net gain (converted + recovered − lost)', r.metrics.net]);
      summary.addRow(['Compared (in both weeks)', r.compared]);
      const pct = v => (v == null ? '' : Math.round(v * 1000) / 10);
      summary.addRows([[], ['Rate', '%'], ['Opportunities converted', pct(r.rates.conversion)], ['Lost lines recovered', pct(r.rates.recovery)], ['No-gap lines lost', pct(r.rates.loss)],
        ['Distribution before', pct(r.rates.distributionBefore)], ['Distribution after', pct(r.rates.distributionAfter)]]);
      summary.getColumn(1).width = 44; summary.getRow(1).font = {bold: true, size: 14};
      const detailSheet = wb.addWorksheet('Changes');
      detailSheet.columns = [{header: 'Banner', key: 'banner', width: 20}, {header: 'Store', key: 'store', width: 36}, {header: 'Region', key: 'region', width: 16}, {header: 'Product', key: 'product', width: 44},
        {header: r.from, key: 'from', width: 14}, {header: r.to, key: 'to', width: 14}, {header: 'Movement', key: 'label', width: 24}];
      detailSheet.addRows(r.changes.map(c => ({...c, banner: c.banner || r.banner, label: MOVES[c.move].label})));
      detailSheet.getRow(1).font = {bold: true}; detailSheet.views = [{state: 'frozen', ySplit: 1}]; detailSheet.autoFilter = {from: 'A1', to: 'G1'};
      // Colour the status cells with the client's own colours.
      const colors = client.colors || {};
      const fill = label => { const hex = {'No gap': colors.N, Opportunity: colors.O, Lost: colors.L}[label]; return hex ? {type: 'pattern', pattern: 'solid', fgColor: {argb: `FF${hex.slice(1)}`}} : null; };
      detailSheet.eachRow((row, n) => { if (n === 1) return; for (const col of [5, 6]) { const f = fill(row.getCell(col).value); if (f) row.getCell(col).fill = f; } });
      const coverage = wb.addWorksheet('Store coverage');
      coverage.columns = [{header: `New in ${r.to}`, key: 'n', width: 44}, {header: `Not in ${r.to}`, key: 'm', width: 44}];
      for (let i = 0; i < Math.max(r.coverage.newStores.length, r.coverage.missingStores.length); i++) coverage.addRow({n: r.coverage.newStores[i] || '', m: r.coverage.missingStores[i] || ''});
      const name = `${client.label}-gaps-${r.banner === 'all' ? 'all' : r.banner.replace(/\W+/g, '')}-${r.from}-to-${r.to}.xlsx`.replace(/[^\w.-]+/g, '-');
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition', `attachment; filename="${name}"`);
      res.send(Buffer.from(await wb.xlsx.writeBuffer()));
    }));
    app.get(`${base}/uploads`, guard('manage'), wrap(async (req, res) => res.json({uploads: await store.uploads((await clientOf(req)).id)})));
    const body = express.json({limit: '15mb'});
    app.post(`${base}/preview`, sameSite, guard('manage'), body, wrap(async (req, res) => {
      const client = await clientOf(req);
      const file = readUpload(req);
      res.json({client: client.id, label: client.label, fileName: file.fileName, sha256: file.sha256, ...(await plan(client, await parseWorkbook(file.buffer)))});
    }));
    app.post(`${base}/upload`, sameSite, guard('manage'), body, wrap(async (req, res) => {
      const client = await clientOf(req);
      const file = readUpload(req);
      const parsed = await parseWorkbook(file.buffer);
      const summary = await plan(client, parsed);
      const saved = await store.save({client: client.id, fileName: file.fileName, sha256: file.sha256, uploadedBy: who(req), parsed, summary});
      // Keep the client's own status colours from its workbook (only where the file had them).
      const picked = Object.fromEntries(Object.entries(parsed.colors || {}).filter(([, v]) => v));
      if (Object.keys(picked).length) await store.setColors(client.id, {...(client.colors || {}), ...picked});
      cache.clear();
      res.json({...saved, ...summary});
    }));
  };
}

module.exports = {gapRoutes, slug};
