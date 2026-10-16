"use strict";
// User request, 1 October: move the dashboard downloads out of the 06:00 slot (blueprint batch
// untouched): Attendance 10:00 SAST, Orders 10:30 SAST. The 06:00 Geo Rep downloads failed on 6
// of the 7 days to 1 October. Attendance's 10:00 slot is marked used today because the catch-up
// covers 1 October and a second 01-30 September run would reuse the half-day 30 September file.
const assert = require("node:assert/strict");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("../firebase-dashboards/scripts/firestore-values.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");

const root = "projects/meridain-nexus/databases/(default)/documents", base = `https://firestore.googleapis.com/v1/${root}`;
const slots = [
  { retailerId: "geo-rep-attendance-for-reps", time: "10:00", skipToday: true },
  { retailerId: "geo-rep-sales-transactions", time: "10:30", skipToday: false }
];

async function main() {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal(localDate, "2026-10-01");
  const writes = [], audit = { at: new Date().toISOString(), action: "User moved the dashboard downloads out of the 06:00 slot; blueprint schedules unchanged", changes: [] };
  for (const slot of slots) {
    const doc = await json(`${base}/retailers/${slot.retailerId}?mask.fieldPaths=reportSchedule`);
    const before = decode({ mapValue: { fields: doc.fields } }).reportSchedule;
    assert.equal(before.time, "06:00", `${slot.retailerId}: unexpected schedule; review before changing`);
    assert.equal(before.frequency, "daily"); assert.equal(before.timezone, "Africa/Johannesburg"); assert.equal(before.enabled, true);
    // decode() returns timestamps as ISO strings; restore their timestamp type.
    const { lastQueuedAt, ...rest } = before;
    const after = { ...rest, time: slot.time, ...(slot.skipToday ? { lastRunKey: `daily:${localDate}:${slot.time}` } : {}) };
    const packed = fields({ reportSchedule: after });
    if (lastQueuedAt) packed.reportSchedule.mapValue.fields.lastQueuedAt = { timestampValue: lastQueuedAt };
    writes.push({ update: { name: `${root}/retailers/${slot.retailerId}`, fields: packed }, updateMask: { fieldPaths: ["reportSchedule"] }, currentDocument: { updateTime: doc.updateTime } });
    audit.changes.push({ retailerId: slot.retailerId, previousTime: before.time, time: slot.time, todayMarkedDone: slot.skipToday });
  }
  writes.push({ update: { name: `${root}/publicDashboardRefreshAudit/download-slots-20261001`, fields: fields(audit) }, currentDocument: { exists: false } });
  await json(`${base}:commit`, "POST", { writes });
  for (const slot of slots) {
    const s = decode({ mapValue: { fields: (await json(`${base}/retailers/${slot.retailerId}?mask.fieldPaths=reportSchedule`)).fields } }).reportSchedule;
    assert.equal(s.time, slot.time); assert.equal(s.enabled, true);
    console.log(JSON.stringify({ retailerId: slot.retailerId, time: s.time, timezone: s.timezone, lastRunKey: s.lastRunKey }));
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
