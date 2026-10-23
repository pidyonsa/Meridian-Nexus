'use strict';
// Writes synced documents into dbo.documents and keeps sync bookkeeping. One MERGE per page (up to 500 rows),
// passed as a single JSON parameter and expanded with OPENJSON, so values are never part of the SQL text.
const {sql} = require('../server/db.cjs');

function store(db) {
  async function upsert(collection, docs) {
    if (!docs.length) return 0;
    const rows = JSON.stringify(docs.map(d => ({id: d.path, data: JSON.stringify(d.data), t: d.updateTime})));
    const result = await db.request().input('collection', sql.NVarChar(200), collection).input('rows', sql.NVarChar(sql.MAX), rows).query(`
      MERGE dbo.documents WITH (HOLDLOCK) AS target
      USING (SELECT id, CAST(HASHBYTES('SHA2_256', id) AS binary(32)) AS id_hash, data, CONVERT(datetime2, t) AS t FROM OPENJSON(@rows) WITH (id nvarchar(1500), data nvarchar(max), t nvarchar(40))) AS src
        ON target.collection = @collection AND target.id_hash = src.id_hash
      WHEN MATCHED AND (target.source_update_time IS NULL OR target.source_update_time < src.t) THEN
        UPDATE SET data = src.data, source_update_time = src.t, synced_at = sysutcdatetime()
      WHEN NOT MATCHED THEN
        INSERT (collection, id, data, source_update_time) VALUES (@collection, src.id, src.data, src.t);
      SELECT @@ROWCOUNT AS changed;`);
    return result.recordset[0].changed;
  }

  // After a complete full pass: remove rows whose Firestore document no longer exists.
  async function removeMissing(collection, seenIds) {
    // A temp table lives on one connection, so this runs inside a transaction (which pins a pooled connection).
    const tx = new sql.Transaction(db);
    await tx.begin();
    try {
      await new sql.Request(tx).batch('CREATE TABLE #seen (id_hash binary(32) PRIMARY KEY);');
      const ids = [...seenIds];
      for (let i = 0; i < ids.length; i += 1000) {
        await new sql.Request(tx).input('ids', sql.NVarChar(sql.MAX), JSON.stringify(ids.slice(i, i + 1000)))
          .query('INSERT #seen (id_hash) SELECT DISTINCT CAST(HASHBYTES(\'SHA2_256\', CAST(value AS nvarchar(1500))) AS binary(32)) FROM OPENJSON(@ids)');
      }
      const result = await new sql.Request(tx).input('collection', sql.NVarChar(200), collection).query(`
        DELETE d FROM dbo.documents d WHERE d.collection = @collection AND NOT EXISTS (SELECT 1 FROM #seen s WHERE s.id_hash = d.id_hash);
        SELECT @@ROWCOUNT AS deleted; DROP TABLE #seen;`);
      await tx.commit();
      return result.recordset[0].deleted;
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
  }

  async function checkpoint(collection) {
    const r = await db.request().input('c', sql.NVarChar(200), collection).query('SELECT field, last_value, last_full_at FROM dbo.sync_checkpoints WHERE collection = @c');
    return r.recordset[0] || null;
  }

  async function saveCheckpoint(collection, {field = null, lastValue = null, full = false, count = null}) {
    await db.request().input('c', sql.NVarChar(200), collection).input('f', sql.NVarChar(100), field).input('v', sql.NVarChar(64), lastValue).input('full', sql.Bit, full).input('n', sql.Int, count).query(`
      MERGE dbo.sync_checkpoints AS t USING (SELECT @c AS collection) AS s ON t.collection = s.collection
      WHEN MATCHED THEN UPDATE SET field = COALESCE(@f, t.field), last_value = CASE WHEN @v IS NOT NULL AND (t.last_value IS NULL OR @v > t.last_value) THEN @v ELSE t.last_value END,
        last_full_at = CASE WHEN @full = 1 THEN sysutcdatetime() ELSE t.last_full_at END, document_count = COALESCE(@n, t.document_count), updated_at = sysutcdatetime()
      WHEN NOT MATCHED THEN INSERT (collection, field, last_value, last_full_at, document_count) VALUES (@c, @f, @v, CASE WHEN @full = 1 THEN sysutcdatetime() END, @n);`);
  }

  async function startRun(mode) {
    return (await db.request().input('m', sql.NVarChar(20), mode).query('INSERT dbo.sync_runs (mode) OUTPUT inserted.id VALUES (@m)')).recordset[0].id;
  }

  async function finishRun(id, {status, read, written, deleted, detail, error}) {
    await db.request().input('id', sql.BigInt, id).input('s', sql.NVarChar(20), status).input('r', sql.Int, read).input('w', sql.Int, written).input('d', sql.Int, deleted)
      .input('detail', sql.NVarChar(sql.MAX), JSON.stringify(detail)).input('e', sql.NVarChar(2000), error ? String(error).slice(0, 2000) : null)
      .query('UPDATE dbo.sync_runs SET finished_at = sysutcdatetime(), status = @s, documents_read = @r, documents_written = @w, documents_deleted = @d, detail = @detail, error = @e WHERE id = @id');
  }

  return {upsert, removeMissing, checkpoint, saveCheckpoint, startRun, finishRun};
}

module.exports = {store};
