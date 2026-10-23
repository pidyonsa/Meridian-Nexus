'use strict';
// Gap tracker data access. sqlGapStore keeps dbo.gap_uploads / dbo.gap_observations; memoryGapStore implements the
// same interface for tests and local preview.
const {sql} = require('../db.cjs');

const rowsOf = parsed => parsed.banners.flatMap(b => [...b.weeks].flatMap(([week, stores]) => [...stores].flatMap(([key, s]) =>
  Object.entries(s.statuses).map(([product, status]) => ({banner: b.banner, week, store_key: key, store: s.store, region: s.region, product, status})))));

function sqlGapStore(getPool) {
  return {
    // Replaces every (banner, week) present in the file, in one transaction, and records the upload.
    async save({client, fileName, sha256, uploadedBy, parsed, summary}) {
      const db = await getPool();
      const tx = new sql.Transaction(db);
      await tx.begin();
      try {
        const upload = (await new sql.Request(tx).input('c', sql.NVarChar(60), client).input('f', sql.NVarChar(260), fileName).input('h', sql.Char(64), sha256)
          .input('u', sql.NVarChar(320), uploadedBy).input('s', sql.NVarChar(sql.MAX), JSON.stringify(summary))
          .query('INSERT dbo.gap_uploads (client, file_name, sha256, uploaded_by, summary) OUTPUT inserted.id VALUES (@c, @f, @h, @u, @s)')).recordset[0].id;
        const pairs = parsed.banners.flatMap(b => [...b.weeks.keys()].map(week => ({banner: b.banner, week})));
        await new sql.Request(tx).input('c', sql.NVarChar(60), client).input('p', sql.NVarChar(sql.MAX), JSON.stringify(pairs)).query(`
          DELETE g FROM dbo.gap_observations g JOIN OPENJSON(@p) WITH (banner nvarchar(60), week date) p ON p.banner = g.banner AND p.week = g.week WHERE g.client = @c`);
        const rows = rowsOf(parsed);
        for (let i = 0; i < rows.length; i += 2000) {
          await new sql.Request(tx).input('c', sql.NVarChar(60), client).input('u', sql.Int, upload).input('r', sql.NVarChar(sql.MAX), JSON.stringify(rows.slice(i, i + 2000))).query(`
            INSERT dbo.gap_observations (client, banner, week, store_key, store, region, product, status, upload_id)
            SELECT @c, banner, week, store_key, store, region, product, status, @u FROM OPENJSON(@r)
            WITH (banner nvarchar(60), week date, store_key nvarchar(200), store nvarchar(200), region nvarchar(80), product nvarchar(200), status char(1))`);
        }
        await tx.commit();
        return {uploadId: upload, rows: rows.length};
      } catch (error) {
        await tx.rollback().catch(() => {});
        throw error;
      }
    },
    async existingWeeks(client) {
      const r = await (await getPool()).request().input('c', sql.NVarChar(60), client).query('SELECT DISTINCT banner, CONVERT(char(10), week, 23) AS week FROM dbo.gap_observations WHERE client = @c');
      return r.recordset;
    },
    // Status counts and store counts per banner and week.
    async weekTotals(client) {
      const r = await (await getPool()).request().input('c', sql.NVarChar(60), client).query(`
        SELECT banner, CONVERT(char(10), week, 23) AS week, COUNT(DISTINCT store_key) AS stores,
          SUM(CASE status WHEN 'N' THEN 1 ELSE 0 END) AS N, SUM(CASE status WHEN 'O' THEN 1 ELSE 0 END) AS O, SUM(CASE status WHEN 'L' THEN 1 ELSE 0 END) AS L
        FROM dbo.gap_observations WHERE client = @c GROUP BY banner, week`);
      return r.recordset;
    },
    // Store x product moves between two weeks of one banner (only pairs present in both weeks).
    async moves(client, banner, from, to) {
      const r = await (await getPool()).request().input('c', sql.NVarChar(60), client).input('b', sql.NVarChar(60), banner).input('f', sql.Date, from).input('t', sql.Date, to).query(`
        SELECT c.store, c.region, c.product, p.status AS from_status, c.status AS to_status
        FROM dbo.gap_observations c JOIN dbo.gap_observations p
          ON p.client = c.client AND p.banner = c.banner AND p.store_key = c.store_key AND p.product = c.product AND p.week = @f
        WHERE c.client = @c AND c.banner = @b AND c.week = @t`);
      return r.recordset;
    },
    // Stores in one week but not the other (coverage changes).
    async storeChanges(client, banner, from, to) {
      const r = await (await getPool()).request().input('c', sql.NVarChar(60), client).input('b', sql.NVarChar(60), banner).input('f', sql.Date, from).input('t', sql.Date, to).query(`
        WITH f AS (SELECT DISTINCT store_key, store FROM dbo.gap_observations WHERE client = @c AND banner = @b AND week = @f),
             t AS (SELECT DISTINCT store_key, store FROM dbo.gap_observations WHERE client = @c AND banner = @b AND week = @t)
        SELECT 'new' AS kind, t.store FROM t WHERE NOT EXISTS (SELECT 1 FROM f WHERE f.store_key = t.store_key)
        UNION ALL SELECT 'missing', f.store FROM f WHERE NOT EXISTS (SELECT 1 FROM t WHERE t.store_key = f.store_key)`);
      return r.recordset;
    },
    async uploads(client) {
      const r = await (await getPool()).request().input('c', sql.NVarChar(60), client).query('SELECT TOP 20 id, file_name, uploaded_at, uploaded_by, summary FROM dbo.gap_uploads WHERE client = @c ORDER BY id DESC');
      return r.recordset.map(u => ({id: u.id, fileName: u.file_name, uploadedAt: u.uploaded_at, uploadedBy: u.uploaded_by, summary: JSON.parse(u.summary)}));
    }
  };
}

function memoryGapStore() {
  const obs = new Map(), uploads = [];
  const key = r => [r.client, r.banner, r.week, r.store_key, r.product].join('|');
  const where = (client, banner, week) => [...obs.values()].filter(r => r.client === client && (!banner || r.banner === banner) && (!week || r.week === week));
  return {
    async save({client, fileName, sha256, uploadedBy, parsed, summary}) {
      const id = uploads.length + 1;
      uploads.unshift({id, fileName, uploadedAt: new Date(), uploadedBy, summary, sha256});
      for (const b of parsed.banners) for (const week of b.weeks.keys()) for (const r of where(client, b.banner, week)) obs.delete(key(r));
      const rows = rowsOf(parsed).map(r => ({...r, client, upload_id: id}));
      for (const r of rows) obs.set(key(r), r);
      return {uploadId: id, rows: rows.length};
    },
    async existingWeeks(client) { return [...new Set(where(client).map(r => `${r.banner}|${r.week}`))].map(k => { const [banner, week] = k.split('|'); return {banner, week}; }); },
    async weekTotals(client) {
      const groups = new Map();
      for (const r of where(client)) {
        const k = `${r.banner}|${r.week}`;
        if (!groups.has(k)) groups.set(k, {banner: r.banner, week: r.week, storesSet: new Set(), N: 0, O: 0, L: 0});
        const g = groups.get(k); g.storesSet.add(r.store_key); g[r.status]++;
      }
      return [...groups.values()].map(({storesSet, ...g}) => ({...g, stores: storesSet.size}));
    },
    async moves(client, banner, from, to) {
      const prev = new Map(where(client, banner, from).map(r => [`${r.store_key}|${r.product}`, r]));
      return where(client, banner, to).filter(r => prev.has(`${r.store_key}|${r.product}`)).map(r => ({store: r.store, region: r.region, product: r.product, from_status: prev.get(`${r.store_key}|${r.product}`).status, to_status: r.status}));
    },
    async storeChanges(client, banner, from, to) {
      const stores = week => new Map(where(client, banner, week).map(r => [r.store_key, r.store]));
      const f = stores(from), t = stores(to);
      return [...[...t].filter(([k]) => !f.has(k)).map(([, store]) => ({kind: 'new', store})), ...[...f].filter(([k]) => !t.has(k)).map(([, store]) => ({kind: 'missing', store}))];
    },
    async uploads() { return uploads.slice(0, 20); }
  };
}

module.exports = {sqlGapStore, memoryGapStore, rowsOf};
