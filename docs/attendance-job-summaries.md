# Attendance Job Summaries

Route: `#attendance-jobs`.
Navigation: **Time & Attendance > Job Summaries**.

The former Salesforce attendance update summary is restored as a separate
Daily/Monthly view. Current Dedicated/Syndicated attendance and Call Cycle
dashboards are unchanged. The restored renderer uses the existing
`getSalesforceAttendanceDashboard` response and controlled
`getSalesforceAttendanceWorkbookSnapshotRows` reader; no new data imports,
job runs, database rules, permissions, or backend functions are introduced.

## Recorded Measures

- Daily plan rows processed: `daily.metrics.plannedRows`.
- Daily rows marked attended: `daily.metrics.actualStores`.
- Eligible visits, source rows for the target day, and plan coverage retain
  the former dashboard's calculation and month scope.
- Monthly cells updated: `monthly.latest.monthlyPlan.updatedCells`. This is
  a cell count, not a count of unique rows or a total across all reruns.
- Monthly plan rows: `monthly.latest.monthlyPlan.plannedRows`.
- Actual Week totals use the existing latest-successful-result-per-week
  calculation. Repeated downloads do not become successful workbook updates.
- History includes the reporting date/range, source file and completion time.
- Existing saved workbook previews, downloads and row paging are restored.
  Missing historical cell counts show `-`, not an invented zero.

The existing reader selects completed updates, deduplicates Daily results by
attendance date, and selects each report's latest available month separately.
History is limited to 20 entries per report. Its existing bounded Firestore
reads (500 update documents, 100 snapshot records) remain unchanged. This is
the restored dashboard, not an exhaustive all-time job audit. Running and
failed job investigation remains in Admin job logs.

## Access and Lifecycle

Existing Nexus Attendance navigation permission applies. Staff are not given
new grants. Clients and signed-out users cannot load the data. The new route
waits for workspace permissions, clears counts and workbook rows on sign-out
or access removal, and ignores old responses after a session/route change.
Snapshot errors stay within the summary instead of opening another dashboard.

The existing Nexus Assistant is available through the summary toolbar; its
floating launcher is hidden only on this view to avoid covering mobile data.

## Verification

- `node scripts/tests/attendance-job-summaries-browser.cjs`: full Nexus shell
  with synthetic data, Daily/Monthly switching, counts, snapshot paging,
  empty/error/retry states, escaping, permissions and sign-out races;
  desktop 1440px and mobile 390px/320px.
- Existing Franchise Order browser regressions passed.
- All 44 attendance-source and Stock Fix/connectivity regression tests passed.
- `scripts/tests/job-summaries-production.cjs` checks real anonymous startup;
  signed-in production access is not tested using an employee's credentials.

Release uses `scripts/release-job-summaries.cjs` to preserve every live
Hosting asset except the three reviewed shell files and new scoped stylesheet.
Private release backups and hash verification: `.tmp/job-summaries-release/`.
No extraction job is created or rerun by this restoration.

## Production Release

Published and verified on 9 September 2026:

- Hosting version: `ccd8f2808ae55324`.
- App cache tag: `20260909-job-summaries2`; service-worker cache: `v51`.
- All 54 unrelated hosted assets retained their existing hashes.
- Both attendance readers returned 403 to anonymous requests.
- Fresh live browser startup passed with no JavaScript errors and no private
  attendance requests before login.
- The live check exposed a delayed-Firebase-auth login-opening issue. The
  source fix and delayed-auth regression test are included in this release.
- Follow-up release backup: `.tmp/job-summaries-login-release/`.

## Heading Correction, 16 September 2026

- The only page heading is `Job Summaries`; the Time & Attendance eyebrow was removed.
- Routing now explicitly hides the shared attendance header and controls, independent
  of the Job Summaries stylesheet. The shared header starts hidden to avoid flashing
  its default Syndicated title while the page starts.
- Dedicated/Syndicated Attendance and Call Cycle headings are restored when leaving
  Job Summaries. Daily/Monthly data, permissions and automation are unchanged.
- Local and staged-release browser regressions passed at desktop and 390px/320px,
  including a missing-stylesheet check, route transitions and existing access checks.
- Hosting version: `20d0b6f7b8ef5820`; cache tag: `20260916-job-summary-heading`.
- Only `index.html`, `app.js` and `service-worker.js` were patched from the live
  baseline; all 69 other hosted assets retained their hashes. No Azure site changed.
- Release script: `scripts/release-job-summary-heading.cjs`; baseline and verification
  evidence: `.tmp/job-summary-heading-20260916/`.
