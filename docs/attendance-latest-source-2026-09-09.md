# Salesforce Attendance: Latest SharePoint Export

## Scope

Approved change: select the correct dated attendance source from the existing
SharePoint Raw Data folder, correct automatic reporting dates, and deploy to
`meridain-nexus`. Keep existing attendance workbook processing, ownership,
permissions and schedules. No migration, dashboard redesign or job rerun is part
of this release. Display Compliance remains unchanged.

## Selection Contract

- Daily and Monthly read the same approved `Rep Attendance Raw Data` folder.
- Read all Microsoft Graph pages before selecting a file. The existing safety
  limit is 100 pages; incomplete listings fail without selecting a partial result.
- Recognise `Updated South Africa Attendance Report-YYYY-MM-DD-HH-MM-SS.xlsx`.
  Normal browser duplicate suffixes such as ` (1).xlsx` are also recognised.
- Order by the timestamp in the filename, interpreted as South African time.
  Modification time breaks ties only for identical export timestamps. It never
  promotes an older export above a newer export. Unresolved ties fail closed.
- Ignore temporary files, folders, deleted items, unrelated names, invalid dates,
  and future export timestamps. An invalid newest recognised file must not cause
  a silent fallback to an older one.
- Recheck the selected file's version and size after downloading. Validate its
  attendance columns, Salesforce `As of` timestamp and explicit Visit Date filter.
  The filename alone is not proof of the reporting range.
- An export's own day remains partial, even if some visits already exist for it.
  Only complete earlier days can update attendance.

## Reporting Dates

Daily retains the existing previous-business-day interpretation of its run date.
For example, a run anchored on Monday uses Friday. The anchor is persisted before
source acquisition, so a retry does not subtract another day or drift at midnight.

Monthly `All Actual Weeks`, both manual and scheduled, uses the first day of the
month through yesterday in South African time. On the first day of a month it
finishes the preceding month. That requires an export whose declared filter
still covers that month. Explicit Actual Week start/end selections are preserved,
not silently shortened. Current-day or future requests still fail completeness
validation.

Corrected the manual queue's date destructuring: the existing default date helper
returns `startDate` and `endDate`, not `reportStartDate` and `reportEndDate`.
The original selected dates now persist to the job and downstream handoff.

## Bounded Source Recovery

Only a missing timestamped export or an export that is too old to cover a requested
completed day qualifies for automatic source recovery. Retry after 10 minutes,
for no more than two hours and 12 retries. Scheduler delays can reduce the number
of attempts; the original deadline is never extended.

The existing retry scheduler queues a linked replacement extraction with the
same owner, date anchor, actual-week selections and original deadline. It rechecks
the newest source each time. It does not invalidate an existing completed source
delivery. Transactional checks prevent double queueing and honour cancellation,
terminal status, exhausted attempts and deadlines.

Corrupt files, changed versions, inconsistent headers, wrong start filters and
ambiguous latest versions require source correction. They do not trigger this
automatic retry. Salesforce login/MFA is never a fallback. While waiting, the
attempt remains recorded as failed with its pending retry and next-attempt time;
no workbook is changed. After exhaustion the operator must contact the publisher
and rerun once the correct export is available.

## Verification and Deployment

39 automated tests passed against both local code and the separately staged
production function sources. Tests cover 1,000 files across five pages, latest
file on the final page, time ordering, SAST midnight, browser copy suffixes,
invalid/future files, header and version checks, month/year/leap boundaries,
explicit weeks, date persistence, owner preservation, duplicate retries,
cancellation, deadlines, and the unchanged Blueprint handoff without Salesforce.

`scripts/release-attendance-latest-source.cjs` stages from each function's exact
live source version and changes only reviewed fragments. Targets:

- `startExtraction`: completed Monthly default and manual date persistence.
- `runScheduledExtractions`: completed Monthly All Actual Weeks range only.
- `retrySalesforceAttendanceReportLoadFailures`: bounded SharePoint retry branch.
- `processExtraction`: frozen dates, filename parser and source retry planning.
- `askNexusAssistant`: updated attendance operating instructions only.

Backups, reviewed sources and deployment verification are private under
`.tmp/attendance-latest-release-v2/`. The earlier `.tmp/attendance-latest-release/`
contains an undeployed staging attempt and is not the release. Existing service
accounts, secrets, scaling, environment variables, triggers and access settings
are checked for preservation. No Firestore/Storage rules or hosting deploy is
needed. Live workbook validation is read-only and does not create extraction jobs.

The report publisher remains responsible for placing the complete daily export
in SharePoint. Retry logic cannot create a missing source or repair a wrong filter.

## Read-Only Live Check

At 13:29 SAST on 9 September, the staged production reader selected
`Updated South Africa Attendance Report-2026-09-09-08-49-14.xlsx`.
Its matching Salesforce export header verified coverage through 8 September.
Daily 8 September contained 497 matching raw rows; Monthly 1-8 September contained
2,603 matching raw rows. These are source row counts, not eligible unique visits
or updated workbook cells. Validation created no jobs and made no SharePoint or
Blueprint writes. The four normal-staff attendance access regression tests also
passed independently of the 39 source/workflow tests.

## Production Release

All five deployments completed on 9 September 2026. Downloaded production source
archives match the reviewed staged files; runtime settings and triggers match
their pre-deployment snapshots.

| Function | Active revision |
| --- | --- |
| startExtraction | startextraction-00054-vad |
| runScheduledExtractions | runscheduledextractions-00057-fej |
| retrySalesforceAttendanceReportLoadFailures | retrysalesforceattendancereportloadfailures-00009-ros |
| processExtraction | processextraction-00437-xep |
| askNexusAssistant | asknexusassistant-00015-kof |

Today's failed extraction runs were not restarted by this release. Future runs
use the new policy; an explicitly requested rerun will use the updated worker.
