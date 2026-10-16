# Jennifer attendance investigation: 21 September 2026

## Scope

Read-only investigation of the Daily and Monthly Salesforce attendance jobs,
their linked workbook updates, and the configured SharePoint file metadata.
No jobs were queued, schedules changed, workbook contents overwritten, or code
deployed. Times below are South African time (UTC+2).

## Daily: cancelled child remains queued in the deduplication record

- At 08:52, source run `AeuMQ5d0HIOA3kQaAlrv` was requested for Monday
  21 September. Daily's previous-business-day rule correctly targeted Friday
  18 September. Source acquisition completed at 08:53:42.
- Derived template run `YvndmTyJireYExb2wc5n` was queued at 08:53:42,
  then cancelled at 08:54:49. Its audit records the abort under Jennifer's
  account. It has no worker-start or workbook-write event.
- The separate `attendanceBlueprintUpdates` record still says `queued` and
  points to that cancelled run, independently confirmed at 12:15.
- Manual source runs `WJGacCQncjMvZsXvC1qU` and `z5VaLEqITU0CNPUfeBpj`
  reused the saved download and the same cancelled template run. They are
  labelled completed, but neither started a replacement template update.
- `abortExtraction` cancels the run without updating the attendance queue
  record. `queueSalesforceAttendanceBlueprintUpdate` trusts that record's
  queued/running status without checking the linked run's status.
- Source-job success is not end-to-end workbook success. The summary also says
  "Run completed" for a cancelled run, and duplicate Daily summaries display
  the request date rather than Friday's effective attendance date.

The Daily schedule is disabled. Its saved update is 15 September at 08:52:31,
under Jennifer's account. This is separate from the manual retry defect.

## Monthly: completed-day cutoff excludes 21 September

- Scheduled source run `TBxUotr1Aelzu8QWHMTv` used the 21 September 08:49:14
  export. Its recorded maximum visit date is 21 September, but its complete-day
  coverage is through 20 September.
- Derived run `48fIuMF7svAn7Nezf0yo` reconciled 1-20 September, reported 380
  changed cells, and recorded SharePoint version 83.0 at 09:02:26.
- Recorded Actual totals: Week 1 = 1,438; Week 2 = 2,320; Week 3 = 2,047.
  Total = 5,805. These are the worker's saved verification results, not a new
  independent cell-by-cell workbook audit.
- September 21 correctly maps to calendar Week 4. All Actual Weeks currently
  ends at yesterday, deliberately excluding the export day's partial visits.
  This explains why a download can contain today's visits while the template
  update excludes them. The September 9 source policy documents this behavior.
- Weekend scheduled attempts could not find an export complete through their
  requested dates and exhausted their bounded retry windows. Monday's Monthly
  run subsequently completed through Sunday.

## Template identity and verification limits

The configured SharePoint item resolves to `Rep Attendance Auto - September
2026.xlsx`. Its configuration still carries an older display name, but the
item ID is the same as the Monthly output. SharePoint metadata shows a later
modification at 11:16:20; the investigation does not attribute that save to the
bot or any individual.

Automatic safety review blocked downloading the complete source and template
because they contain employee-level visit data. The narrower metadata-only
check succeeded. User approval has been requested for full workbook inspection.
The current cell values and the exact number of excluded 21 September visits
have therefore not been independently verified.

Six existing monthly-week/SmartSell regression tests passed, including the
explicit assertion that 21 September 2026 is Week 4.

## Repairs indicated by the evidence

1. Synchronize cancellation with the attendance queue record, and validate the
   linked run before reusing a queued/running update. Explicit new retries may
   replace a cancelled child; cancellation itself must not restart work.
2. Report source acquisition and template-write outcomes separately. Do not
   describe a cancelled run as completed or a saved export as a changed template.
3. After reviewing the later workbook version, explicitly retry Friday's Daily
   update from the verified source. Do not blindly overwrite later edits.
4. Confirm whether Monthly should include current-day provisional visits before
   changing the completed-day policy. Such a change needs clear as-of labeling
   and later reconciliation, not just removal of source validation.
5. Confirm whether to re-enable the Daily schedule; preserve its disabled state
   until that change is authorized.

Internal evidence is under `.tmp/attendance-investigation-20260921/`. The
read-only audit is `scripts/audit-attendance-september21.cjs`; the `metadata`
action does not download workbook contents. The `verify` action was blocked
before execution and has not been approved.
