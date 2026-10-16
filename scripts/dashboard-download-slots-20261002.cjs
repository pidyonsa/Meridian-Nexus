"use strict";
// User request, 2 October: move the dashboard downloads after the Geo Rep blueprint batch.
// Over 24 Sep-1 Oct, Attendance failed on all 11 runs that overlapped blueprint runs and succeeded on
// all 6 that did not; no blueprint runs were active at 11:30 or 12:00 on any of those days.
// Only reportSchedule.time changes; lastRunKey is untouched so today's runs happen at the new times.
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const slots = [
  { retailerId: "geo-rep-attendance-for-reps", from: "10:00", time: "11:30" },
  { retailerId: "geo-rep-sales-transactions", from: "10:30", time: "12:00" }
];

async function main() {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal(localDate, "2026-10-02");
  const writes = [], audit = { at: new Date().toISOString(), action: "User moved the dashboard downloads after the Geo Rep blueprint batch; blueprint schedule unchanged", changes: [] };
  for (const slot of slots) {
    const doc = await json(`${base}/retailers/${slot.retailerId}?mask.fieldPaths=reportSchedule`);
    const before = decode({ mapValue: { fields: doc.fields } }).reportSchedule;
    assert.equal(before.time, slot.from, `${slot.retailerId}: unexpected schedule; review before changing`);
    assert.equal(before.frequency, "daily"); assert.equal(before.timezone, "Africa/Johannesburg"); assert.equal(before.enabled, true);
    assert.notEqual(before.lastRunKey, `daily:${localDate}:${slot.from}`, `${slot.retailerId}: today's run already queued`);
    writes.push({ update: { name: `${root}/retailers/${slot.retailerId}`, fields: { reportSchedule: { mapValue: { fields: { time: { stringValue: slot.time } } } } } },
      updateMask: { fieldPaths: ["reportSchedule.time"] }, currentDocument: { updateTime: doc.updateTime } });
    audit.changes.push({ retailerId: slot.retailerId, previousTime: before.time, time: slot.time });
  }
  writes.push({ update: { name: `${root}/publicDashboardRefreshAudit/download-slots-20261002`, fields: fields(audit) }, currentDocument: { exists: false } });
  await json(`${base}:commit`, "POST", { writes });
  for (const slot of slots) {
    const s = decode({ mapValue: { fields: (await json(`${base}/retailers/${slot.retailerId}?mask.fieldPaths=reportSchedule`)).fields } }).reportSchedule;
    assert.equal(s.time, slot.time); assert.equal(s.enabled, true);
    console.log(JSON.stringify({ retailerId: slot.retailerId, time: s.time, timezone: s.timezone, enabled: s.enabled, lastRunKey: s.lastRunKey }));
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
