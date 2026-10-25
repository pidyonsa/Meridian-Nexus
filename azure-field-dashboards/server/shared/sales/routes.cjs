'use strict';
// Sales dashboard API (Geo Rep Capture orders), mounted by both the Nexus portal and nexus.meridiangroup.co.za.
//   GET /api/sales             ?period=YYYY-MM&region=&rep=&manager=&store=&sku=&product=&status=
//                              months with data, KPIs (with the previous month over the same days), charts, latest
//                              lines, unmapped stores and the latest import's reconciliation
//   GET /api/sales/drilldown   same query + metric=<sales-value|orders|…>&page=  one KPI in depth, 25 lines a page
//   GET /api/sales/export      same query  every selected order line as an Excel workbook
// `allow(req)` decides access (Nexus admins: section "sales").
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');
const {METRICS, PERIOD, cleanFilters, matches, dashboard, drilldown, periodOffset, line, latestImportFor} = require('./report.cjs');

const FRESH_MS = 60 * 1000;   // how long a month's lines are used before asking SQL whether they changed
const thisMonth = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit'}).format(now).slice(0, 7);

function salesRoutes({store, allow, now = () => new Date()}) {
  const months = new Map();   // period -> {version, checkedAt, rows: Promise}
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'The sales dashboard is open to Nexus administrators only.'));

  async function linesOf(period) {
    const hit = months.get(period);
    if (hit && Date.now() - hit.checkedAt < FRESH_MS) return hit.rows;
    const version = await store.version(period);
    if (hit && hit.version === version) { hit.checkedAt = Date.now(); return hit.rows; }
    const entry = {version, checkedAt: Date.now(), rows: store.rows(period)};
    entry.rows.catch(() => months.delete(period));
    months.set(period, entry);
    return entry.rows;
  }

  // The requested month, else this month when it has lines, else the newest month with lines.
  async function periodOf(req) {
    const periods = await store.periods();
    const asked = String(req.query.period || '');
    if (asked && !PERIOD.test(asked)) throw new AppError('invalid-argument', 'Choose a month as YYYY-MM.');
    const current = thisMonth(now());
    const period = asked || (periods.some(p => p.period === current) || !periods.length ? current : periods[0].period);
    return {period, periods};
  }

  return app => {
    app.get('/api/sales', guard, wrap(async (req, res) => {
      const {period, periods} = await periodOf(req);
      const [rows, prior, config, imports] = await Promise.all([linesOf(period), linesOf(periodOffset(period, 1)), store.config(), store.imports()]);
      res.set('Cache-Control', 'no-store').json({periods, ...dashboard({period, rows, prior, config, imports, filters: cleanFilters(req.query)})});
    }));

    app.get('/api/sales/drilldown', guard, wrap(async (req, res) => {
      const metric = String(req.query.metric || 'sales-value');
      if (!METRICS.includes(metric)) throw new AppError('invalid-argument', 'Select a valid sales metric.');
      const {period} = await periodOf(req);
      const [rows, imports] = await Promise.all([linesOf(period), store.imports()]);
      const filters = cleanFilters(req.query);
      res.set('Cache-Control', 'no-store').json({period, metric, ...drilldown(metric, rows.filter(r => matches(r, filters)), latestImportFor(imports, period), Number(req.query.page) || 1)});
    }));

    app.get('/api/sales/export', guard, wrap(async (req, res) => {
      const {period} = await periodOf(req);
      const filters = cleanFilters(req.query);
      const rows = (await linesOf(period)).filter(r => matches(r, filters)).map(line).sort((a, b) => `${a.orderDate}|${a.orderNumber}`.localeCompare(`${b.orderDate}|${b.orderNumber}`));
      const book = new ExcelJS.Workbook();
      book.creator = 'Meridian Nexus';
      const sheet = book.addWorksheet('Order lines', {views: [{state: 'frozen', ySplit: 1}]});
      sheet.columns = [['Date', 'orderDate', 12], ['Order number', 'orderNumber', 20], ['Store', 'storeName', 36], ['Store code', 'storeCode', 14], ['Region', 'region', 18], ['Rep', 'rep', 24], ['Manager', 'manager', 22], ['Product', 'product', 44], ['SKU', 'sku', 12], ['Status', 'status', 12], ['Units', 'quantity', 9], ['Value (R)', 'value', 13], ['Mapped', 'mapped', 9]]
        .map(([header, key, width]) => ({header, key, width}));
      for (const r of rows) sheet.addRow({...r, mapped: r.mapped ? 'Yes' : 'No'});
      sheet.getRow(1).font = {bold: true};
      sheet.getColumn('value').numFmt = '#,##0.00';
      sheet.autoFilter = {from: 'A1', to: 'M1'};
      const name = `Sales dashboard ${period}${Object.keys(filters).length ? ' (filtered)' : ''}.xlsx`;
      res.set({'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store'});
      res.send(Buffer.from(await book.xlsx.writeBuffer()));
    }));
  };
}

module.exports = {salesRoutes, thisMonth};
