'use strict';
// Nexus permissions storage: dbo.user_permissions (migration 006), the people who have signed in (dbo.users) and the
// Firebase-era staff directory (adminUsers in dbo.documents) so admins can pick people who have not signed in yet.
// Changes are recorded in dbo.audit_log. memoryPermissionStore has the same surface for tests and local runs.
const {sql} = require('../db.cjs');

const row = r => ({email: r.email, name: r.display_name || null, admin: r.is_admin === true, disabled: r.disabled === true, sections: JSON.parse(r.sections || '[]'), note: r.note || null,
  updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null, updatedBy: r.updated_by || null});

function sqlPermissionStore(getPool) {
  const request = async () => (await getPool()).request();
  return {
    async get(email) {
      const r = await (await request()).input('e', sql.NVarChar(320), email).query('SELECT * FROM dbo.user_permissions WHERE email = @e');
      return r.recordset[0] ? row(r.recordset[0]) : null;
    },
    async list() { return (await (await request()).query('SELECT * FROM dbo.user_permissions')).recordset.map(row); },
    // People who signed in to Nexus, with whether they held the Entra administrator role at their last sign-in.
    async signIns() {
      const r = await (await request()).query('SELECT email, display_name, is_admin, last_seen_at FROM dbo.users');
      return r.recordset.map(x => ({email: x.email, name: x.display_name, entraAdmin: x.is_admin === true, lastSeenAt: x.last_seen_at ? new Date(x.last_seen_at).toISOString() : null}));
    },
    async directory() {
      const r = await (await request()).query(`SELECT LOWER(JSON_VALUE(data, '$.email')) AS email, TRIM(CONCAT(JSON_VALUE(data, '$.name'), ' ', JSON_VALUE(data, '$.surname'))) AS name
        FROM dbo.documents WHERE collection = 'adminUsers' AND JSON_VALUE(data, '$.email') IS NOT NULL`);
      return r.recordset.filter(x => x.email).map(x => ({email: x.email, name: x.name || null}));
    },
    async recordSignIn({id, email, name, entraAdmin}) {
      await (await request()).input('id', sql.UniqueIdentifier, id).input('e', sql.NVarChar(320), email).input('n', sql.NVarChar(200), name).input('a', sql.Bit, entraAdmin).query(`
        MERGE dbo.users WITH (HOLDLOCK) AS t USING (SELECT @e AS email) AS s ON t.email = s.email
        WHEN MATCHED THEN UPDATE SET display_name = @n, is_admin = @a, last_seen_at = sysutcdatetime()
        WHEN NOT MATCHED THEN INSERT (id, email, display_name, is_admin, last_seen_at) VALUES (@id, @e, @n, @a, sysutcdatetime());`);
    },
    async save(value, by, audit) {
      const tx = new sql.Transaction(await getPool());
      await tx.begin();
      try {
        await new sql.Request(tx).input('e', sql.NVarChar(320), value.email).input('n', sql.NVarChar(200), value.name).input('a', sql.Bit, value.admin).input('d', sql.Bit, value.disabled)
          .input('s', sql.NVarChar(sql.MAX), JSON.stringify(value.sections)).input('note', sql.NVarChar(300), value.note).input('by', sql.NVarChar(320), by).query(`
          MERGE dbo.user_permissions WITH (HOLDLOCK) AS t USING (SELECT @e AS email) AS s ON t.email = s.email
          WHEN MATCHED THEN UPDATE SET display_name = COALESCE(@n, t.display_name), is_admin = @a, disabled = @d, sections = @s, note = @note, updated_at = sysutcdatetime(), updated_by = @by
          WHEN NOT MATCHED THEN INSERT (email, display_name, is_admin, disabled, sections, note, created_by, updated_by) VALUES (@e, @n, @a, @d, @s, @note, @by, @by);`);
        await new sql.Request(tx).input('by', sql.NVarChar(320), by).input('action', sql.NVarChar(100), audit.action).input('target', sql.NVarChar(400), value.email).input('detail', sql.NVarChar(sql.MAX), JSON.stringify(audit.detail))
          .query('INSERT dbo.audit_log (actor_email, action, target, detail) VALUES (@by, @action, @target, @detail)');
        await tx.commit();
      } catch (error) { await tx.rollback().catch(() => {}); throw error; }
    },
    async remove(email, by, audit) {
      const tx = new sql.Transaction(await getPool());
      await tx.begin();
      try {
        await new sql.Request(tx).input('e', sql.NVarChar(320), email).query('DELETE dbo.user_permissions WHERE email = @e');
        await new sql.Request(tx).input('by', sql.NVarChar(320), by).input('target', sql.NVarChar(400), email).input('detail', sql.NVarChar(sql.MAX), JSON.stringify(audit.detail))
          .query("INSERT dbo.audit_log (actor_email, action, target, detail) VALUES (@by, 'permissions-removed', @target, @detail)");
        await tx.commit();
      } catch (error) { await tx.rollback().catch(() => {}); throw error; }
    },
    async history(limit = 30) {
      const r = await (await request()).input('n', sql.Int, limit).query("SELECT TOP (@n) at, actor_email, action, target, detail FROM dbo.audit_log WHERE action LIKE 'permissions-%' ORDER BY at DESC");
      return r.recordset.map(x => ({at: new Date(x.at).toISOString(), by: x.actor_email, action: x.action, email: x.target, detail: x.detail ? JSON.parse(x.detail) : null}));
    }
  };
}

function memoryPermissionStore({permissions = [], signIns = [], directory = []} = {}) {
  const rows = new Map(permissions.map(p => [p.email, {admin: false, disabled: false, sections: [], note: null, name: null, ...p}]));
  const people = new Map(signIns.map(s => [s.email, s]));
  const log = [];
  return {
    async get(email) { return rows.has(email) ? structuredClone(rows.get(email)) : null; },
    async list() { return [...rows.values()].map(v => structuredClone(v)); },
    async signIns() { return [...people.values()]; },
    async directory() { return directory; },
    async recordSignIn({email, name, entraAdmin}) { people.set(email, {email, name, entraAdmin, lastSeenAt: new Date().toISOString()}); },
    async save(value, by, audit) { rows.set(value.email, {...rows.get(value.email), ...value, name: value.name ?? rows.get(value.email)?.name ?? null, updatedBy: by, updatedAt: new Date().toISOString()}); log.unshift({at: new Date().toISOString(), by, action: audit.action, email: value.email, detail: audit.detail}); },
    async remove(email, by, audit) { rows.delete(email); log.unshift({at: new Date().toISOString(), by, action: 'permissions-removed', email, detail: audit.detail}); },
    async history() { return log.slice(0, 30); }
  };
}

module.exports = {sqlPermissionStore, memoryPermissionStore};
