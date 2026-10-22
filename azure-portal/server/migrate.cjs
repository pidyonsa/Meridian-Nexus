'use strict';
// Applies migrations/NNN_name.sql in order, once each, recording them in dbo.schema_migrations.
// Each file runs in one transaction; "GO" lines split it into batches.
//   SQL_SERVER=<server>.database.windows.net SQL_DATABASE=<db> node server/migrate.cjs [--dry-run]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {sql, pool, close} = require('./db.cjs');

const DIR = path.join(__dirname, '..', 'migrations');

function migrations(dir = DIR) {
  return fs.readdirSync(dir).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort().map(name => {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    return {name, text, sha256: crypto.createHash('sha256').update(text).digest('hex'), batches: text.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean)};
  });
}

async function migrate({dryRun = false, log = console.log} = {}) {
  const db = await pool();
  await db.request().batch(`IF OBJECT_ID('dbo.schema_migrations') IS NULL
    CREATE TABLE dbo.schema_migrations (name nvarchar(200) NOT NULL PRIMARY KEY, sha256 char(64) NOT NULL, applied_at datetime2 NOT NULL DEFAULT sysutcdatetime());`);
  const applied = new Map((await db.request().query('SELECT name, sha256 FROM dbo.schema_migrations')).recordset.map(r => [r.name, r.sha256]));
  for (const m of migrations()) {
    if (applied.has(m.name)) {
      if (applied.get(m.name) !== m.sha256) throw new Error(`${m.name} was edited after it was applied; add a new migration instead.`);
      continue;
    }
    if (dryRun) { log(`would apply ${m.name} (${m.batches.length} batches)`); continue; }
    const tx = new sql.Transaction(db);
    await tx.begin();
    try {
      for (const batch of m.batches) await new sql.Request(tx).batch(batch);
      await new sql.Request(tx).input('name', m.name).input('sha', m.sha256).query('INSERT dbo.schema_migrations (name, sha256) VALUES (@name, @sha)');
      await tx.commit();
      log(`applied ${m.name}`);
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw new Error(`${m.name} failed: ${error.message}`);
    }
  }
}

module.exports = {migrations, migrate};
if (require.main === module) {
  migrate({dryRun: process.argv.includes('--dry-run')}).then(close, async error => { console.error(error.message); await close(); process.exitCode = 1; });
}
