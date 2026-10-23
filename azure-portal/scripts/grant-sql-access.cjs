'use strict';
// Gives an Azure managed identity least-privilege access to the Nexus database: read and write data, no schema
// changes (migrations are run by the "Nexus SQL Admins" Entra group). Run as a member of that group.
//   SQL_SERVER=... SQL_DATABASE=... node scripts/grant-sql-access.cjs <identity display name> [reader|writer]
const {sql, pool, close} = require('../server/db.cjs');

async function main() {
  const [name, level = 'writer'] = process.argv.slice(2);
  if (!/^[A-Za-z0-9-]{3,128}$/.test(name || '') || !['reader', 'writer'].includes(level)) throw new Error('Usage: grant-sql-access.cjs <identity name> [reader|writer]');
  const roles = level === 'writer' ? ['db_datareader', 'db_datawriter'] : ['db_datareader'];
  const db = await pool();
  // Names cannot be parameters in DDL; QUOTENAME guards them and the name was validated above.
  await db.request().input('name', sql.NVarChar, name).query(`
    DECLARE @stmt nvarchar(400);
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = @name)
    BEGIN SET @stmt = N'CREATE USER ' + QUOTENAME(@name) + N' FROM EXTERNAL PROVIDER'; EXEC (@stmt); END
    ${roles.map(role => `IF IS_ROLEMEMBER('${role}', @name) = 0 BEGIN SET @stmt = N'ALTER ROLE ${role} ADD MEMBER ' + QUOTENAME(@name); EXEC (@stmt); END`).join('\n    ')}`);
  const granted = await db.request().input('name', sql.NVarChar, name).query(`
    SELECT r.name AS role FROM sys.database_role_members m
    JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
    JOIN sys.database_principals u ON u.principal_id = m.member_principal_id WHERE u.name = @name`);
  console.log(JSON.stringify({identity: name, roles: granted.recordset.map(r => r.role).sort()}));
}

main().then(close, async error => { console.error(error.message); await close(); process.exitCode = 1; });
