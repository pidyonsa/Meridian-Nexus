'use strict';
// Gives every active Nexus staff account the matching Entra app role on "Meridian Nexus Azure":
// Firebase role "admin" -> Nexus.Admin, "normal" -> Nexus.Reader. Nobody gets more than they have in the Firebase
// portal. Skips disabled accounts, client/external accounts, malformed records and emails with no Entra user.
// Idempotent: existing assignments are left alone. Reads users from dbo.documents (synced adminUsers).
//   SQL_SERVER=... SQL_DATABASE=... node scripts/assign-nexus-roles.cjs [--apply]
const {execFileSync} = require('node:child_process');
const {query, close} = require('../server/db.cjs');

const APP_ID = '748c496f-5033-415d-9d3f-f2bb85de1d71';
const ROLE_IDS = {'Nexus.Admin': '4973d086-0a70-4503-87ed-b1df70a92d6c', 'Nexus.Reader': '4c64f60e-bff5-4612-9124-a09d7c8c6d05'};
const az = args => execFileSync(process.platform === 'win32' ? 'az.cmd' : 'az', args, {encoding: 'utf8', shell: process.platform === 'win32'}).trim();
const graphToken = () => az(['account', 'get-access-token', '--resource-type', 'ms-graph', '--query', 'accessToken', '-o', 'tsv']);

async function graph(token, path, init = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {...init, headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers}});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph ${init.method || 'GET'} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? {} : res.json();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const users = await query`SELECT id, JSON_VALUE(data, '$.email') AS email, JSON_VALUE(data, '$.role') AS role, JSON_VALUE(data, '$.accountType') AS accountType,
    JSON_VALUE(data, '$.disabled') AS disabled, JSON_VALUE(data, '$.chatAccess.audience') AS audience FROM dbo.documents WHERE collection = 'adminUsers'`;
  const token = graphToken();
  const sp = await graph(token, `/servicePrincipals(appId='${APP_ID}')?$select=id`);
  const existing = (await graph(token, `/servicePrincipals/${sp.id}/appRoleAssignedTo?$top=999`)).value;
  const plan = [], skipped = [];
  for (const u of users) {
    const email = String(u.email || '').toLowerCase();
    const why = !email ? 'no email (malformed record)' : u.disabled === 'true' ? 'disabled' : u.accountType === 'client' || u.audience === 'external' ? 'client/external account'
      : !['admin', 'normal'].includes(u.role) ? `role ${u.role || 'missing'}` : !email.endsWith('@meridiangroup.co.za') ? 'not a Meridian address' : null;
    if (why) { skipped.push({email: email || u.id.slice(0, 40), why}); continue; }
    const entra = await graph(token, `/users/${encodeURIComponent(email)}?$select=id,accountEnabled,userPrincipalName`);
    if (!entra) { skipped.push({email, why: 'no Entra user'}); continue; }
    if (!entra.accountEnabled) { skipped.push({email, why: 'Entra account disabled'}); continue; }
    const role = u.role === 'admin' ? 'Nexus.Admin' : 'Nexus.Reader';
    const has = existing.filter(a => a.principalId === entra.id).map(a => a.appRoleId);
    if (has.includes(ROLE_IDS[role]) || (role === 'Nexus.Reader' && has.includes(ROLE_IDS['Nexus.Admin']))) continue;
    plan.push({email, role, principalId: entra.id});
  }
  for (const p of plan) {
    if (apply) await graph(token, `/servicePrincipals/${sp.id}/appRoleAssignedTo`, {method: 'POST', body: JSON.stringify({principalId: p.principalId, resourceId: sp.id, appRoleId: ROLE_IDS[p.role]})});
    console.log(`${apply ? 'assigned' : 'would assign'} ${p.role.padEnd(12)} ${p.email}`);
  }
  for (const s of skipped) console.log(`skipped      ${s.email}: ${s.why}`);
  console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', assign: plan.length, skipped: skipped.length, admins: plan.filter(p => p.role === 'Nexus.Admin').length}));
}

main().then(close, async error => { console.error(error.message); await close(); process.exitCode = 1; });
