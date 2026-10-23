'use strict';
const sql = require('mssql');

// Azure SQL with Entra authentication only: the App Service managed identity in Azure, `az login` locally.
// No SQL passwords are stored anywhere.
function sqlConfig(env = process.env) {
  if (!env.SQL_SERVER || !env.SQL_DATABASE) return null;
  return {
    server: env.SQL_SERVER,
    database: env.SQL_DATABASE,
    authentication: {type: 'azure-active-directory-default', options: env.AZURE_CLIENT_ID ? {clientId: env.AZURE_CLIENT_ID} : {}},
    options: {encrypt: true, trustServerCertificate: false},
    pool: {max: 10, min: 0, idleTimeoutMillis: 30000},
    connectionTimeout: 30000,
    requestTimeout: Number(env.SQL_REQUEST_TIMEOUT_MS || 30000)
  };
}

let poolPromise = null;
function pool(env = process.env) {
  const config = sqlConfig(env);
  if (!config) throw new Error('SQL_SERVER and SQL_DATABASE are not configured.');
  poolPromise ||= new sql.ConnectionPool(config).connect().catch(error => { poolPromise = null; throw error; });
  return poolPromise;
}

// query`SELECT ... WHERE id = ${id}`: every interpolated value becomes a typed parameter, never SQL text.
async function query(strings, ...values) {
  const request = (await pool()).request();
  const text = strings.reduce((out, part, i) => {
    if (i === 0) return part;
    request.input(`p${i}`, values[i - 1]);
    return `${out}@p${i}${part}`;
  }, '');
  return (await request.query(text)).recordset || [];
}

async function close() {
  if (!poolPromise) return;
  const p = await poolPromise.catch(() => null);
  poolPromise = null;
  await p?.close();
}

module.exports = {sql, sqlConfig, pool, query, close};
