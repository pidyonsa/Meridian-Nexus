'use strict';
// Data access for the API. sqlRepo reads Azure SQL; during the migration, Firestore data lives in dbo.documents
// (copied by the sync job) and the Firebase portal stays the place where it is changed.

const parse = row => ({id: row.id.split('/').pop(), path: row.id, data: JSON.parse(row.data), updatedAt: row.source_update_time});

function sqlRepo(query) {
  return {
    async collection(name) {
      return (await query`SELECT id, data, source_update_time FROM dbo.documents WHERE collection = ${name}`).map(parse);
    },
    async findUserByEmail(email) {
      const rows = await query`SELECT TOP 1 id, data, source_update_time FROM dbo.documents WHERE collection = 'adminUsers' AND LOWER(JSON_VALUE(data, '$.email')) = ${String(email).toLowerCase()}`;
      return rows[0] ? parse(rows[0]) : null;
    },
    async syncStatus() {
      const runs = await query`SELECT TOP 48 id, mode, status, started_at, finished_at, documents_read, documents_written, documents_deleted, error FROM dbo.sync_runs ORDER BY id DESC`;
      const collections = await query`SELECT collection, field, last_value, last_full_at, document_count, updated_at FROM dbo.sync_checkpoints ORDER BY collection`;
      return {runs, collections};
    }
  };
}

module.exports = {sqlRepo};
