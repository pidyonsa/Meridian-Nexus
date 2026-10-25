'use strict';
// Sales dashboard figures from Geo Rep Capture order lines (salesTransactions). Same measures, filters, drilldowns and
// wording as the Firebase-era getGeoRepSalesDashboard / getGeoRepSalesDrilldown (functions/index.js), plus a
// comparison with the previous month over the same days.

// Filter name -> order line field.
const FILTERS = {region: 'region', rep: 'rep', manager: 'manager', store: 'storeName', sku: 'sku', product: 'product', status: 'status'};
const METRICS = ['sales-value', 'orders', 'units', 'average-order', 'stores', 'reps', 'mapped', 'latest-import'];
const PERIOD = /^\d{4}-\d{2}$/;
const PAGE_SIZE = 25;

const clean = (value, max = 240) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
const distinct = (rows, field) => new Set(rows.map(row => clean(row[field], 160)).filter(Boolean)).size;
const orderCount = rows => new Set(rows.map(row => row.orderNumber).filter(Boolean)).size;
const newest = (a, b) => `${b.orderDate || ''}|${b.orderNumber || ''}`.localeCompare(`${a.orderDate || ''}|${a.orderNumber || ''}`);

function periodOffset(period, monthsBack) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Only known filters with short text values; anything else is ignored.
function cleanFilters(input = {}) {
  const out = {};
  for (const key of Object.keys(FILTERS)) { const v = clean(input[key], 200); if (v) out[key] = v; }
  return out;
}
const matches = (row, filters) => Object.entries(filters).every(([key, value]) => row[FILTERS[key]] === value);

function breakdown(rows, field, limit = 10, sortBy = 'value') {
  const grouped = new Map();
  for (const row of rows) {
    const label = clean(row[field], 120) || 'Unassigned';
    const g = grouped.get(label) || {label, value: 0, quantity: 0, orders: new Set()};
    g.value += Number(row.value || 0); g.quantity += Number(row.quantity || 0); g.orders.add(row.orderNumber);
    grouped.set(label, g);
  }
  return [...grouped.values()].map(g => ({...g, orders: g.orders.size}))
    .sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0) || b.value - a.value || b.quantity - a.quantity).slice(0, limit);
}

function orderBreakdown(rows, limit = 10) {
  const grouped = new Map();
  for (const row of rows) {
    const label = clean(row.orderNumber, 160) || 'Unassigned';
    const g = grouped.get(label) || {label, value: 0, quantity: 0, orders: 1};
    g.value += Number(row.value || 0); g.quantity += Number(row.quantity || 0);
    grouped.set(label, g);
  }
  return [...grouped.values()].sort((a, b) => b.value - a.value || b.quantity - a.quantity).slice(0, limit);
}

const line = row => ({orderDate: row.orderDate || '', orderNumber: row.orderNumber || '', storeName: row.storeName || '', storeCode: row.storeCode || '', region: row.region || 'Unmapped', rep: row.rep || 'Unassigned', manager: row.manager || '', product: row.product || '', sku: row.sku || '', quantity: Number(row.quantity || 0), value: Number(row.value || 0), status: row.status || '', mapped: row.mapped === true});

function totals(rows) {
  const orders = orderCount(rows), value = sum(rows, 'value'), quantity = sum(rows, 'quantity');
  return {orderLines: rows.length, orders, salesValue: value, quantity, stores: distinct(rows, 'storeName'), reps: distinct(rows, 'rep'), averageOrderValue: orders ? value / orders : 0, averageUnitsPerOrder: orders ? quantity / orders : 0};
}

// The latest import for this month (imports newest first).
const latestImportFor = (imports, period) => imports.find(i => i.periodKey === period) || null;

// rows: this month's lines; prior: the previous month's lines (compared over the same days when this month is still
// running, so a part month is not set against a whole one).
function dashboard({period, rows, prior = [], config = null, imports = [], filters = {}}) {
  const options = field => [...new Set(rows.map(r => clean(r[field], 120)).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 500);
  const selected = rows.filter(r => matches(r, filters));
  const lastDay = rows.reduce((max, r) => (r.orderDate > max ? r.orderDate : max), '');
  const priorPeriod = periodOffset(period, 1);
  const monthEnd = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).getUTCDate();
  const dayCut = lastDay ? Number(lastDay.slice(8, 10)) : 0;
  const partial = dayCut > 0 && dayCut < monthEnd;
  const priorSelected = prior.filter(r => matches(r, filters) && (!partial || Number(String(r.orderDate).slice(8, 10)) <= dayCut));
  const latestImport = latestImportFor(imports, period);
  const mappedRows = selected.filter(r => r.mapped).length;
  const missingRegionRows = selected.filter(r => !r.mapped || !clean(r.region) || r.region === 'Unmapped').length;
  const missingRepRows = selected.filter(r => r.repMissing === true || !clean(r.rep) || r.rep === 'Unassigned').length;
  const num = key => Number(latestImport?.[key] || 0);
  return {
    period, priorPeriod, lastOrderDate: lastDay || null, comparedDays: partial ? dayCut : null,
    config: config ? {storeMasterName: config.storeMasterName || null, setupStatus: config.setupStatus || null, apiSchedule: config.apiSchedule ? {enabled: config.apiSchedule.enabled === true, time: config.apiSchedule.time || null} : null} : null,
    latestImport: latestImport ? {id: latestImport.id, sourceFileName: latestImport.sourceFileName || null, completedAt: latestImport.completedAt || latestImport.updatedAt || latestImport.createdAt || null, message: latestImport.message || null, reportEndDate: latestImport.reportEndDate || null} : null,
    filters: {regions: options('region'), reps: options('rep'), managers: options('manager'), stores: options('storeName'), skus: options('sku'), products: options('product'), statuses: options('status')},
    metrics: {...totals(selected), mappedRows, mappedPercent: selected.length ? (mappedRows / selected.length) * 100 : 0, latestNewRecords: num('newRecords'), missingRegionRows, missingRepRows, existingRecords: num('existingRecords'), reconciled: latestImport?.reconciliation?.reconciled === true},
    priorMetrics: prior.length ? totals(priorSelected) : null,
    charts: {
      daily: breakdown(selected, 'orderDate', 31).sort((a, b) => a.label.localeCompare(b.label)),
      priorDaily: breakdown(priorSelected, 'orderDate', 31).sort((a, b) => a.label.localeCompare(b.label)),
      byRegion: breakdown(selected, 'region'), byRep: breakdown(selected, 'rep'), byManager: breakdown(selected, 'manager'), byStore: breakdown(selected, 'storeName'),
      byProduct: breakdown(selected, 'product'), bySku: breakdown(selected, 'sku'), byStatus: breakdown(selected, 'status')
    },
    recentOrders: [...selected].sort(newest).slice(0, 15).map(line),
    unmapped: breakdown(selected.filter(r => !r.mapped), 'storeName', 20),
    quality: {
      sourceRows: num('sourceRows'), uniqueSourceRows: num('uniqueSourceRows'), duplicateSourceRows: num('duplicateSourceRows'), newRecords: num('newRecords'), existingRecords: num('existingRecords'), staleRowsRemoved: num('staleRowsRemoved'),
      fullMonthSnapshot: latestImport?.fullMonthSnapshot === true, missingRegionRows, missingRepRows, missingOrderNumberRows: num('missingOrderNumberRows'), mappedRows,
      unmappedStoreCount: Number(latestImport?.unmappedStoreCount || new Set(selected.filter(r => !r.mapped).map(r => r.storeCode || r.storeName)).size),
      reconciliation: latestImport?.reconciliation || null, storeMasterQuality: latestImport?.storeMasterQuality || null
    }
  };
}

function drilldown(metric, rows, latestImport, page = 1) {
  const orders = orderCount(rows), value = sum(rows, 'value'), quantity = sum(rows, 'quantity');
  const stores = distinct(rows, 'storeName'), reps = distinct(rows, 'rep');
  const mappedRows = rows.filter(r => r.mapped === true).length;
  const n = v => v.toLocaleString('en-ZA');
  const base = {
    title: 'Sales analysis', subtitle: 'Selected Geo Rep Capture transaction detail.',
    primary: {label: 'Sales value', value, format: 'currency', note: `${n(orders)} unique orders`},
    insights: [{label: 'Units', value: quantity, format: 'number'}, {label: 'Stores', value: stores, format: 'number'}, {label: 'Average order', value: orders ? value / orders : 0, format: 'currency'}],
    chart: {eyebrow: 'Product mix', title: 'Sales value by product', format: 'currency', rows: breakdown(rows, 'product', 10)},
    recordTitle: 'Transaction lines', recordRows: [...rows].sort(newest)
  };
  const byLabel = (field) => (a, b) => `${a[field] || ''}|${a.orderDate || ''}`.localeCompare(`${b[field] || ''}|${b.orderDate || ''}`);
  if (metric === 'orders') Object.assign(base, {title: 'Order analysis', subtitle: 'Unique orders within the current selection.', primary: {label: 'Unique orders', value: orders, format: 'number', note: `${n(rows.length)} order lines`}, insights: [{label: 'Sales value', value, format: 'currency'}, {label: 'Units', value: quantity, format: 'number'}, {label: 'Active stores', value: stores, format: 'number'}], chart: {eyebrow: 'Order value', title: 'Largest orders', format: 'currency', rows: orderBreakdown(rows)}, recordTitle: 'Order lines'});
  else if (metric === 'units') Object.assign(base, {title: 'Unit analysis', subtitle: 'Ordered units and the product mix behind them.', primary: {label: 'Ordered units', value: quantity, format: 'number', note: `${n(orders)} unique orders`}, insights: [{label: 'Sales value', value, format: 'currency'}, {label: 'Units per order', value: orders ? quantity / orders : 0, format: 'number1'}, {label: 'Product SKUs', value: distinct(rows, 'sku'), format: 'number'}], chart: {eyebrow: 'Volume', title: 'Units by product SKU', format: 'number', rows: breakdown(rows, 'sku', 10, 'quantity')}, recordTitle: 'Highest-volume order lines', recordRows: [...rows].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0) || newest(a, b))});
  else if (metric === 'average-order') Object.assign(base, {title: 'Average order analysis', subtitle: 'Average transaction value across the current selection.', primary: {label: 'Average order value', value: orders ? value / orders : 0, format: 'currency', note: `${n(orders)} unique orders`}, insights: [{label: 'Sales value', value, format: 'currency'}, {label: 'Units per order', value: orders ? quantity / orders : 0, format: 'number1'}, {label: 'Orders', value: orders, format: 'number'}], chart: {eyebrow: 'Order value', title: 'Largest orders', format: 'currency', rows: orderBreakdown(rows)}});
  else if (metric === 'stores') Object.assign(base, {title: 'Store coverage', subtitle: 'Active stores with orders in the current selection.', primary: {label: 'Active stores', value: stores, format: 'number', note: `${n(mappedRows)} lines mapped to a region`}, insights: [{label: 'Orders', value: orders, format: 'number'}, {label: 'Sales value', value, format: 'currency'}, {label: 'Regions', value: distinct(rows.filter(r => r.region !== 'Unmapped'), 'region'), format: 'number'}], chart: {eyebrow: 'Store performance', title: 'Sales value by store', format: 'currency', rows: breakdown(rows, 'storeName')}, recordTitle: 'Store order lines', recordRows: [...rows].sort(byLabel('storeName'))});
  else if (metric === 'reps') Object.assign(base, {title: 'Rep performance', subtitle: 'Active reps and the orders assigned to them.', primary: {label: 'Active reps', value: reps, format: 'number', note: `${n(distinct(rows, 'manager'))} managers in selection`}, insights: [{label: 'Orders', value: orders, format: 'number'}, {label: 'Sales value', value, format: 'currency'}, {label: 'Stores', value: stores, format: 'number'}], chart: {eyebrow: 'Rep performance', title: 'Sales value by rep', format: 'currency', rows: breakdown(rows, 'rep')}, recordTitle: 'Rep order lines', recordRows: [...rows].sort(byLabel('rep'))});
  else if (metric === 'mapped') Object.assign(base, {title: 'Region mapping quality', subtitle: 'Store Master coverage for the current order selection.', primary: {label: 'Mapped to region', value: rows.length ? (mappedRows / rows.length) * 100 : 0, format: 'percent', note: `${n(mappedRows)} of ${n(rows.length)} lines mapped`}, insights: [{label: 'Unmapped lines', value: rows.length - mappedRows, format: 'number'}, {label: 'Unmapped stores', value: new Set(rows.filter(r => !r.mapped).map(r => r.storeCode || r.storeName).filter(Boolean)).size, format: 'number'}, {label: 'Mapped regions', value: distinct(rows.filter(r => r.mapped), 'region'), format: 'number'}], chart: {eyebrow: 'Region coverage', title: 'Sales value by mapped region', format: 'currency', rows: breakdown(rows, 'region')}, recordTitle: 'Mapping review lines', recordRows: [...rows].sort((a, b) => Number(a.mapped === true) - Number(b.mapped === true) || newest(a, b))});
  else if (metric === 'latest-import') Object.assign(base, {title: 'Latest import review', subtitle: 'Current month data reconciliation and latest import outcome.', primary: {label: 'New lines in latest import', value: Number(latestImport?.newRecords || 0), format: 'number', note: `${n(Number(latestImport?.existingRecords || 0))} source lines already existed`}, insights: [{label: 'Source rows', value: Number(latestImport?.sourceRows || 0), format: 'number'}, {label: 'Duplicates removed', value: Number(latestImport?.duplicateSourceRows || 0), format: 'number'}, {label: 'Current month lines', value: rows.length, format: 'number'}], chart: {eyebrow: 'Daily movement', title: 'Sales value by order date', format: 'currency', rows: breakdown(rows, 'orderDate', 31).sort((a, b) => a.label.localeCompare(b.label))}, recordTitle: 'Latest month transaction lines'});
  const totalRows = base.recordRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const {recordRows, ...rest} = base;
  return {...rest, records: recordRows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(line), page: current, pageCount, pageSize: PAGE_SIZE, totalRows};
}

module.exports = {FILTERS, METRICS, PERIOD, cleanFilters, matches, breakdown, periodOffset, dashboard, drilldown, line, latestImportFor};
