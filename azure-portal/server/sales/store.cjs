'use strict';
// Sales dashboard data in Azure SQL: the Firestore copy in dbo.documents kept current by the hourly sync
// (salesTransactions, salesTransactionImports, salesDashboardConfig). Order line ids start with their month
// (salesTransactions/202610-…), so a month is a primary key range, not a scan; only the fields the dashboard uses
// are read. memorySalesStore holds the same shapes for tests and local runs without SQL.
const {sql} = require('../db.cjs');

const PREFIX = 'salesTransactions/';
const monthPrefix = period => `${PREFIX}${period.replace('-', '')}-%`;

function sqlSalesStore(getPool) {
  const request = async () => (await getPool()).request();
  return {
    // Months with order lines, newest first.
    async periods() {
      const r = await (await request()).input('c', sql.NVarChar(200), 'salesTransactions').query(`
        SELECT SUBSTRING(id, ${PREFIX.length + 1}, 6) AS ym, COUNT(*) AS n FROM dbo.documents
        WHERE collection = @c GROUP BY SUBSTRING(id, ${PREFIX.length + 1}, 6) ORDER BY ym DESC`);
      return r.recordset.filter(x => /^\d{6}$/.test(x.ym)).map(x => ({period: `${x.ym.slice(0, 4)}-${x.ym.slice(4)}`, lines: x.n}));
    },
    // Changes whenever the sync adds, updates or removes a line of the month.
    async version(period) {
      const r = await (await request()).input('c', sql.NVarChar(200), 'salesTransactions').input('p', sql.NVarChar(40), monthPrefix(period)).query(`
        SELECT COUNT(*) AS n, CONVERT(nvarchar(40), MAX(synced_at), 126) AS at FROM dbo.documents WHERE collection = @c AND id LIKE @p`);
      return `${r.recordset[0].n}|${r.recordset[0].at || ''}`;
    },
    async rows(period) {
      const r = await (await request()).input('c', sql.NVarChar(200), 'salesTransactions').input('p', sql.NVarChar(40), monthPrefix(period)).query(`
        SELECT j.* FROM dbo.documents d CROSS APPLY OPENJSON(d.data) WITH (
          orderNumber nvarchar(120), orderDate nvarchar(10), storeName nvarchar(300), storeCode nvarchar(120), region nvarchar(160),
          rep nvarchar(200), manager nvarchar(200), product nvarchar(400), sku nvarchar(120), status nvarchar(60),
          quantity float, value float, mapped bit, repMissing bit) j
        WHERE d.collection = @c AND d.id LIKE @p`);
      return r.recordset.map(x => ({...x, mapped: x.mapped === true, repMissing: x.repMissing === true}));
    },
    async config() {
      const r = await (await request()).input('c', sql.NVarChar(200), 'salesDashboardConfig').input('id', sql.NVarChar(400), 'salesDashboardConfig/current')
        .query('SELECT data FROM dbo.documents WHERE collection = @c AND id = @id');
      return r.recordset[0] ? JSON.parse(r.recordset[0].data) : null;
    },
    // The six newest imports, as the Firebase dashboard read them.
    async imports() {
      const r = await (await request()).input('c', sql.NVarChar(200), 'salesTransactionImports')
        .query(`SELECT TOP 6 id, data FROM dbo.documents WHERE collection = @c ORDER BY JSON_VALUE(data, '$.createdAt') DESC`);
      return r.recordset.map(x => ({id: x.id.split('/').pop(), ...JSON.parse(x.data)}));
    }
  };
}

function memorySalesStore({rows = [], config = null, imports = []} = {}) {
  const months = period => rows.filter(r => r.periodKey === period);
  return {
    async periods() {
      const counts = new Map();
      for (const r of rows) counts.set(r.periodKey, (counts.get(r.periodKey) || 0) + 1);
      return [...counts].sort((a, b) => b[0].localeCompare(a[0])).map(([period, lines]) => ({period, lines}));
    },
    async version(period) { return `${months(period).length}|memory`; },
    async rows(period) { return months(period).map(r => ({...r})); },
    async config() { return config; },
    async imports() { return [...imports].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6); }
  };
}

module.exports = {sqlSalesStore, memorySalesStore, monthPrefix};
