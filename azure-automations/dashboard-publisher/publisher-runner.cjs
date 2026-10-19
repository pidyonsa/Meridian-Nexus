"use strict";
// Azure replacement for the two Google schedulers (public-franchise-orders-publisher and azure-attendance-publisher),
// run every 5 minutes with the code deployed on Google:
//  1. Orders snapshot refresh (refreshPublicFranchiseOrders): newest Geo Rep transaction workbook -> Firestore snapshot.
//  2. Attendance and Orders publish (publishAzureAttendance): verified snapshots -> private dashboard-data container.
// Identities: Google through Workload Identity Federation as georep-worker@ (id-nexus-georep); dashboard blobs as the
// existing attendance-publisher identity, which already holds the read/write-only role on that container.
const fs = require("node:fs");

async function azureToken(env, resource, clientId) {
  const r = await fetch(`${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}&client_id=${clientId}`, { headers: { "X-IDENTITY-HEADER": env.IDENTITY_HEADER } });
  if (!r.ok) throw new Error(`Azure token ${r.status}`);
  return (await r.json()).access_token;
}
async function googleCredentials(env) {
  fs.writeFileSync("/tmp/azure-token", await azureToken(env, env.AUDIENCE, env.AZURE_CLIENT_ID), { mode: 0o600 });
  fs.writeFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, JSON.stringify({
    type: "external_account", audience: env.GOOGLE_PROVIDER,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt", token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GOOGLE_SERVICE_ACCOUNT}:generateAccessToken`,
    credential_source: { file: "/tmp/azure-token" }
  }), { mode: 0o600 });
}

async function main() {
  const env = process.env;
  if (!/^[a-f0-9-]{36}$/.test(env.PUBLISHER_CLIENT_ID || "")) throw new Error("PUBLISHER_CLIENT_ID is not configured");
  await googleCredentials(env);
  let failed = 0;
  // Each step runs independently, as the two Google schedulers did; a failure keeps the previous verified snapshot.
  try {
    const result = await require("./refresh/index.cjs").runRefresh();
    console.log(JSON.stringify({ event: "orders-snapshot-refresh", ...result }));
  } catch (error) {
    failed++;
    console.log(JSON.stringify({ event: "orders-snapshot-refresh-failed", error: String(error.message).slice(0, 300) }));
  }
  const { applicationDefault } = require("node:module").createRequire(`${__dirname}/refresh/index.cjs`)("firebase-admin/app");
  const google = applicationDefault();
  const tokens = async () => ({ googleToken: (await google.getAccessToken()).access_token, token: await azureToken(env, "https://storage.azure.com", env.PUBLISHER_CLIENT_ID) });
  const { status, body } = await require("./attendance/attendance-publisher/index.cjs").publishAll(tokens);
  console.log(JSON.stringify({ event: "dashboard-publish", status, attendance: body.attendance, orders: body.orders, error: body.error }));
  if (status !== 200) failed++;
  return failed;
}

main().then(failed => process.exit(failed ? 1 : 0)).catch(error => {
  console.log(JSON.stringify({ event: "dashboard-publisher-failed", error: String(error.message || error).slice(0, 500) }));
  process.exit(1);
});
