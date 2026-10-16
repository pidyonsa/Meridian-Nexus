# Salesforce Attendance: SharePoint Source

## Scope

Daily (`sales-force-p-g`) and monthly (`sales-force-p-g-monthly`) attendance
acquisition now reads the approved SharePoint export folder. The worker does
not launch Salesforce, restore a Salesforce session, use a Connected App, or
request MFA for these two acquisition jobs.

Display Compliance, Geo Rep, and explicit Salesforce session-maintenance
workflows are not changed. Existing schedules, job ownership, permissions,
SmartSell masters, daily week overrides, monthly Actual Week selections,
Blueprint processing, workbook preservation, dashboard publication, and
derived workbook delivery remain unchanged.

## Source Contract

Updated on 9 September 2026 to use the administrator's new shared folder.

Site: `meridiangroupza.sharepoint.com/sites/PowerBI9-PowerBI-PG`

Library: `Shared Documents`

Root: `Power BI - PG/Rep Attendance/Rep Attendance Download/Rep Attendance Raw Data`

[Approved shared folder](https://meridiangroupza.sharepoint.com/:f:/s/PowerBI9-PowerBI-PG/IgAB-vX5oVK_TbcKndllxkM9AWd6oGM0ZWE43c12RKpHWAQ?e=lb3Euy)

Both Daily and Monthly read the same combined export:
`Updated South Africa Attendance Report-YYYY-MM-DD-HH-MM-SS.xlsx`.
The resolved drive and folder item IDs are pinned in
`functions/attendance-sharepoint-source.js`; acquisition does not depend on
the sharing link remaining active or on the old Daily/Monthly output folders.
Delivery destinations are unchanged.

The newest filename export timestamp wins; upload time only breaks ties for
the same timestamp. Temporary files, Blueprints, unrecognised names, deleted
items and future timestamps are ignored. Ambiguous versions, empty files and
files exceeding 25 MB stop the job. Invalid latest input never falls back to
an older export or the Salesforce portal.

The filename is an export timestamp, **not** a reporting period. The reader
requires the matching Salesforce `As of ... South Africa Standard Time/SAST`
header and the declared `Visit Date greater or equal M/D/YYYY` filter. Other
date-filter formats stop for review rather than guessing the covered period.
The requested daily date or complete monthly range must fall inside that
filter and end before the export day. Export-day visits are partial and must
not be used as completed-day attendance. Zero-visit days inside the declared
range do not by themselves invalidate the file; an entirely empty target
period still fails safely.

The worker reads all listing pages, requires an unchanged file ETag and size
through the read, and validates Store Code, Employee Id, Visit Date, CheckIn
Location Compliance and CheckOut Location Compliance columns. Visit dates
must agree with the declared filter/export date and include readable visits for the target
period. The existing downstream logic still decides compliance using either
check-in OR checkout location compliance.

The source is read-only. It is never uploaded back into its input folder.
Nexus keeps a verified Firebase Storage copy for the existing pipeline and
records `sourceSharePoint` provenance, export time and `completeThrough` on
the source file. Duplicate identity
includes the SharePoint item version, so a corrected export is not mistaken
for an unchanged cached portal download. Unchanged verified copies can be
reused. Failed source checks stop before any Blueprint update is queued;
there is no automatic fallback to the Salesforce portal.

## Publication Dependency

This change consumes reports; it does not produce them. A person or upstream
publisher must put fresh Salesforce exports in the raw folder before the
existing scheduled jobs run. The shared folder is an input, not a mechanism
for generating fresh Salesforce reports.
Confirm the publisher and publishing time before relying on unattended daily
operation. Missing files produce a failed SharePoint-source job with an
actionable message. Publish the required file and rerun the existing job.

## Verification

Read-only live validation on 9 September 2026:

- Found `Updated South Africa Attendance Report-2026-09-08-13-11-12.xlsx`,
  275,291 bytes, with required columns on row 11.
- The export declares visits from 1 September and was generated at 13:11:12
  SAST on 8 September. It contains 2,206 dated visit rows.
- Daily for 7 September: 476 matching rows.
- Monthly for 1-7 September: 2,102 matching rows.
- Daily for 8 September and Monthly through 8 September were correctly
  rejected: 104 export-day rows cannot establish complete-day attendance.
  A fresh export generated on 9 September or later is needed for those runs.
- No SharePoint report writes or Blueprint updates were made during validation.

Local regression tests:

```powershell
node --test scripts/tests/attendance-sharepoint.test.cjs scripts/tests/attendance-raw-source.test.cjs scripts/tests/stockfix-connectivity.test.cjs
node --check functions/index.js
```

Release scope: `processExtraction` acquisition logic and
`askNexusAssistant` operating playbooks only. Stage each from its currently
deployed source, not from unrelated local changes. No Hosting, IAM, security
rules or database migration is needed.

## Production Release

Initial SharePoint acquisition release, deployed and verified on 8 September 2026:

- `processExtraction`: `processextraction-00435-yag` (ACTIVE).
- `askNexusAssistant`: `asknexusassistant-00013-tad` (ACTIVE).
- Runtime identities, secrets, memory, CPU, timeouts, scaling, concurrency,
  ingress and event trigger semantics matched their pre-deployment settings.
- Eventarc's existing attendance trigger was not replaced or modified. Its
  unordered event-filter array required order-independent comparison.
- All 31 local regression tests passed. The 18 attendance-specific tests
  also passed against the exact staged production worker source.
- No report-processing job was started or rerun as part of this release.

Firebase CLI connections timed out before deployment; the targeted releases
were performed with the Google Cloud CLI from each function's deployed source
archive. Release metadata and read-only validation results are retained in
`.tmp/attendance-sharepoint-release/`.

The 9 September raw-folder release is staged separately from each live
function's source archive using `scripts/release-attendance-raw-source.cjs`.
Only the worker's source import, two acquisition helpers, source module, and
two attendance playbook blocks change. Extraction/Blueprint handlers,
Hosting, schedules, database rules, IAM and other automations are preserved.
Backups and validation evidence: `.tmp/attendance-raw-release/`.

Deployed on 9 September 2026:

- `processExtraction`: `processextraction-00436-mum` (ACTIVE).
- `askNexusAssistant`: `asknexusassistant-00014-lok` (ACTIVE).
- Both functions retained their prior identities, secrets, runtime limits,
  network settings and trigger configuration.
- All 44 regression tests passed; the 28 attendance-specific tests also
  passed against the exact staged worker source.
- No attendance jobs were started or rerun by this release.
