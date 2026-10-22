"use strict";
// User request, 21 October: run the Geo Rep blueprint batch (retailer geo-rep, ~200 runs at 06:00) weekly
// instead of daily to cut Azure worker cost. The scheduler queues a daily schedule only on daysOfWeek
// (scheduleRunsOnDate), so only daysOfWeek changes: Monday (1) at the existing 06:00. Geo Rep runs fetch
// month-to-date, so weekly runs still cover the month so far. Rollback: node <this> rollback
// (restores all seven days).
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const retailerId = "geo-rep", everyDay = [0, 1, 2, 3, 4, 5, 6], weekly = [1];

async function main() {
  const rollback = process.argv[2] === "rollback";
  const [from, to] = rollback ? [weekly, everyDay] : [everyDay, weekly];
  const doc = await json(`${base}/retailers/${retailerId}?mask.fieldPaths=reportSchedule&mask.fieldPaths=name`);
  const before = decode({ mapValue: { fields: doc.fields } }).reportSchedule;
  assert.deepEqual(before.daysOfWeek.map(Number), from, `${retailerId}: unexpected days; review before changing`);
  assert.equal(before.frequency, "daily"); assert.equal(before.time, "06:00"); assert.equal(before.enabled, true);
  const audit = { at: new Date().toISOString(), retailerId, previousDaysOfWeek: from, daysOfWeek: to,
    action: rollback ? "Rolled back the Geo Rep blueprint batch to daily" : "User moved the Geo Rep blueprint batch to weekly (Monday 06:00) to cut Azure cost" };
  await json(`${base}:commit`, "POST", { writes: [
    { update: { name: `${root}/retailers/${retailerId}`, fields: { reportSchedule: { mapValue: { fields: { daysOfWeek: { arrayValue: { values: to.map(d => ({ integerValue: String(d) })) } } } } } } },
      updateMask: { fieldPaths: ["reportSchedule.daysOfWeek"] }, currentDocument: { updateTime: doc.updateTime } },
    { update: { name: `${root}/publicDashboardRefreshAudit/blueprint-weekly-20261021${rollback ? "-rollback" : ""}`, fields: fields(audit) }, currentDocument: { exists: false } }
  ] });
  const s = decode({ mapValue: { fields: (await json(`${base}/retailers/${retailerId}?mask.fieldPaths=reportSchedule`)).fields } }).reportSchedule;
  assert.deepEqual(s.daysOfWeek.map(Number), to); assert.equal(s.enabled, true);
  console.log(JSON.stringify({ retailerId, frequency: s.frequency, time: s.time, daysOfWeek: s.daysOfWeek, enabled: s.enabled, lastRunKey: s.lastRunKey }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
