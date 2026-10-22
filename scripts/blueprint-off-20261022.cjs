"use strict";
// User request, 22 October: switch the Geo Rep blueprint automation (retailer geo-rep) off completely.
// Only reportSchedule.enabled changes; days/time stay as set on 21 October (Mondays 06:00), so
// `node <this> rollback` restores the weekly schedule.
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const retailerId = "geo-rep";

async function main() {
  const rollback = process.argv[2] === "rollback", enabled = rollback;
  const doc = await json(`${base}/retailers/${retailerId}?mask.fieldPaths=reportSchedule`);
  const before = decode({ mapValue: { fields: doc.fields } }).reportSchedule;
  assert.equal(before.enabled, !enabled, `${retailerId}: schedule already ${enabled ? "on" : "off"}`);
  assert.equal(before.time, "06:00"); assert.deepEqual(before.daysOfWeek.map(Number), [1]);
  const audit = { at: new Date().toISOString(), retailerId, enabled,
    action: rollback ? "Restored the Geo Rep blueprint batch (Mondays 06:00)" : "User switched the Geo Rep blueprint automation off completely" };
  await json(`${base}:commit`, "POST", { writes: [
    { update: { name: `${root}/retailers/${retailerId}`, fields: { reportSchedule: { mapValue: { fields: { enabled: { booleanValue: enabled } } } } } },
      updateMask: { fieldPaths: ["reportSchedule.enabled"] }, currentDocument: { updateTime: doc.updateTime } },
    { update: { name: `${root}/publicDashboardRefreshAudit/blueprint-off-20261022${rollback ? "-rollback" : ""}`, fields: fields(audit) }, currentDocument: { exists: false } }
  ] });
  const s = decode({ mapValue: { fields: (await json(`${base}/retailers/${retailerId}?mask.fieldPaths=reportSchedule`)).fields } }).reportSchedule;
  assert.equal(s.enabled, enabled);
  console.log(JSON.stringify({ retailerId, enabled: s.enabled, frequency: s.frequency, time: s.time, daysOfWeek: s.daysOfWeek, lastRunKey: s.lastRunKey }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
