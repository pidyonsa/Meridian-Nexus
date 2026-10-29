'use strict';
// StockFix weekly reporting API, read-only from SharePoint (source.cjs), mounted by both the Nexus portal and
// nexus.meridiangroup.co.za. Replaces the link to the StockFix app's dashboard; reps keep capturing in the StockFix app.
//   GET /api/stockfix          ?week=YYYY-MM-DD&client=&banner=&region=
//                              published weeks, filter options, Overview, Leaderboard and Action Impact for the week
//   GET /api/stockfix/rows     same query + classification=&status=<actioned|pending|escalated>&q=&page=
//                              the week's store tasks, 50 a page
//   GET /api/stockfix/export   same query as rows  every selected store task as an Excel workbook
// `allow(req)` decides access (section "stockfix").
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');
const {WEEK, cleanFilters, cleanRowFilters, weekList, pickWeek, dashboard, detail, selectRows} = require('./report.cjs');

function stockfixRoutes({source, allow}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'StockFix reporting is open to people with the StockFix permission. Ask a Nexus administrator.'));
  const connected = (req, res, next) => next(source ? undefined : new AppError('unavailable', 'SharePoint is not connected on this site yet, so StockFix data cannot be read.'));

  async function weekOf(req) {
    const asked = String(req.query.week || '');
    if (asked && !WEEK.test(asked)) throw new AppError('invalid-argument', 'Choose a week as YYYY-MM-DD.');
    const data = await source.data();
    return {data, ...pickWeek(weekList(data.weeks), asked)};
  }
  async function rowsOf(week) {
    const rows = week ? await source.week(week) : null;
    if (!rows) throw new AppError('not-found', `The store detail for ${week || 'this week'} has not been published on SharePoint.`);
    return rows;
  }

  return app => {
    app.get('/api/stockfix', guard, connected, wrap(async (req, res) => {
      const {data, week} = await weekOf(req);
      // Store and SKU counts come from the week file; the other figures still load when it is missing.
      const rows = week ? await source.week(week).catch(() => null) : null;
      res.set('Cache-Control', 'no-store').json(dashboard({data, week, rows, filters: cleanFilters(req.query)}));
    }));

    app.get('/api/stockfix/rows', guard, connected, wrap(async (req, res) => {
      const {week} = await weekOf(req);
      res.set('Cache-Control', 'no-store').json({week, ...detail(await rowsOf(week), cleanFilters(req.query), cleanRowFilters(req.query), Number(req.query.page) || 1)});
    }));

    app.get('/api/stockfix/export', guard, connected, wrap(async (req, res) => {
      const {week} = await weekOf(req);
      const filters = cleanFilters(req.query), rowFilters = cleanRowFilters(req.query);
      const rows = selectRows(await rowsOf(week), filters, rowFilters);
      const book = new ExcelJS.Workbook();
      book.creator = 'Meridian Nexus';
      const sheet = book.addWorksheet('Store tasks', {views: [{state: 'frozen', ySplit: 1}]});
      sheet.columns = [['Week ending', 'week', 12], ['Client', 'client', 18], ['Banner', 'banner', 16], ['Region', 'region', 16], ['Store', 'store', 34], ['Rep', 'rep', 22], ['Manager', 'manager', 22],
        ['Resource type', 'resourceType', 22], ['Category', 'category', 18], ['Barcode', 'barcode', 16], ['Article', 'article', 40], ['Store SOH', 'storeSoh', 10], ['DC SOH', 'dcSoh', 10], ['P4W sales', 'p4Sales', 10],
        ['Store WFC', 'storeWfc', 10], ['Missed sales', 'missedSales', 12], ['Classification', 'classification', 22], ['Action', 'action', 30], ['Status', 'actionStatus', 14], ['Action date', 'actionDate', 12],
        ['Reason code', 'reasonCode', 24], ['Feedback', 'feedback', 40], ['Action taken / comment', 'actionComment', 40], ['Physical count', 'physicalCount', 12], ['Variance', 'variance', 10], ['System adjusted', 'systemAdjusted', 12]]
        .map(([header, key, width]) => ({header, key, width}));
      for (const r of rows) sheet.addRow(r);
      sheet.getRow(1).font = {bold: true};
      sheet.autoFilter = {from: 'A1', to: 'Z1'};
      const narrowed = Object.keys(filters).length || Object.values(rowFilters).some(Boolean);
      const name = `StockFix store tasks ${week}${narrowed ? ' (filtered)' : ''}.xlsx`;
      res.set({'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store'});
      res.send(Buffer.from(await book.xlsx.writeBuffer()));
    }));
  };
}

module.exports = {stockfixRoutes};
