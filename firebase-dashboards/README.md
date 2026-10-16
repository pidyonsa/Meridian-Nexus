# Meridian Public Field Dashboards

## Status

**Deployed on 14 September 2026.** The user explicitly approved both no-login
access to real data and the broader read-only IAM scope. Only the isolated
`meridian-field-dashboards` Hosting site and `public-dashboard-viewer` function
codebase were deployed. The production pages passed 30 desktop/mobile checks.

- https://meridian-field-dashboards.web.app/attendance
- https://meridian-field-dashboards.web.app/franchise-orders

**Navigation update, 15 September 2026:** deployed to this site's Hosting only.
Home, the Meridian logo, Back to portal and the mobile home/back links return
to `https://meridian-group-za.github.io/Meridian-Nexus/portal.html` in the same
tab. Native browser history is unchanged. The Franchise Orders drilldown return
is labelled Previous selection and keeps its existing report-only behavior.
No functions, rules, original Nexus hosting or Azure infrastructure were deployed.

**Separate Azure hosting move, 15 September 2026:** the same public dashboards are
now hosted at `https://meridian-field-dashboards.azurewebsites.net/attendance` and
`https://meridian-field-dashboards.azurewebsites.net/franchise-orders`. Their Azure
host calls this existing read-only data service; keep this site and API running.
See `../azure-field-dashboards/DEPLOYMENT_STATUS.md`. No Firebase deployment was
performed for that hosting move; the database and automation migration is still pending.

The original Nexus, Firebase rules and Azure edition are not modified by this
edition. There are no admin, import, upload, task or messaging routes.

## Scope and Source

- `/attendance`: syndicated reps and merchandisers; MTD Overview, Daily Visits,
  roster, Attendance by Store, filtered detail and Excel exports.
- `/franchise-orders`: Executive Overview, Trend, Regions, Products, Stores,
  Reps and Orders; charts, filters, line drilldowns and exports.
- Orders place From/To beside the reporting period. Manager and Banner lead
  the main filter row; narrower screens wrap controls without overlap.
- Explicit cancelled status includes the cancelled records. Its inclusion
  checkbox is locked while that status/exception is selected. Selected filters
  remain visible even when a different reporting period has no matching values.
- Attendance retains the selected day while changing filters, when that day is
  still in the selection. Daily details and Excel use the displayed day.
- The current attendance imports have no mapped Banner or Channel values.
  Banner is hidden unless its source supplies mapped values. Channel shows
  `Not in source` and is disabled until the attendance store master supplies
  those mappings; orders are not used to infer them.
- No extra login, iframe, Microsoft sign-in or Geo credentials in the browser.
- Attendance reads the Schedules worksheet referenced by the latest completed
  `geoRepAttendanceDashboard/current` or `merchandisers` import. It uses the
  original Nexus raw-reader mappings, hierarchy and attendance calculations.
- Orders use the existing Nexus calculations. A fresh Geo Rep transaction
  workbook was downloaded on 14 September at 11:54 SAST for 1-14 September.
  Sanitized rows are in viewer-only `publicDashboardOrderImports` chunks, with
  the active version in `publicDashboardSources/orders`. The original
  `salesTransactions` ledger was not modified. Its data supplies other periods
  and supersedes the viewer snapshot when a newer month import arrives.
- Refresh reads imported data. It does not run Geo Rep or Salesforce jobs.
- Browser memory cache: 45 seconds. Backend source checks: 120 seconds; parsed
  attendance versions: 20 minutes, with a bounded 16-entry LRU cache. New source
  versions bypass the parsed cache. There is no browser disk cache of records.
  The first request to a cold instance still needs to parse the source workbook.
- Fresh orders: 2,870 lines, 164 orders including cancellations. Default view:
  2,368 lines, 140 orders, 113 stores, amount 1,687,944.08. Currency is absent,
  so no currency symbol is invented. The full source detail and summary differ
  by 173.65; the UI warns about it and totals retain the unaltered detail lines.
- Existing exact, unambiguous historical store mappings enrich missing region,
  client and channel fields. Unmapped rows remain visible and identified.
- Attendance reads succeeded under the deployed read-only identity. Reps:
  7,329 targets / 7,017 attended; merchandisers: 32,904 / 30,989. Both sources
  cover 1-13 September. Actual and missed-store drilldowns and daily Excel
  exports reconcile to the displayed counts.

## Provincial Order Analytics (21 September 2026)

The isolated read-only service adds `regionalAnalytics` and an exact `province`
filter for the Azure Regions presentation. `order-regional-analytics.cjs` uses
the existing reader's full filtered result before restoring 50-row pagination.
Amounts and units remain source values; distinct orders/stores are recalculated
from constituent lines. Province and division groups include explicit unassigned
coverage. East London and Port Elizabeth combine into Eastern Cape; SWD combines
with Western Cape, matching the supplied Sales Insights geographic reference.

Series include observed daily, weekly or monthly periods only. No annual growth,
prices, missing months or Northern Cape division assignment are fabricated.
The original Nexus orders module and data publisher were not modified.
This release uses the narrowly verified `--regional-design` profile in
`../scripts/release-dashboard-performance-clients.cjs`, not a root deploy.
Revision: `publicmeridiandashboards-00012-roj`, verified 2026-09-21T09:22:34Z.

## Blank R0 Order Lines (1 October 2026)

The full-September transactions file contained one line with no product and a R0
total (order 1790750970100836, IKHWEZI WHOLESALERS ESHOWE, 30 September), which
stopped the whole Orders publication. `backend/order-workbook.cjs` (copied to
`refresh/` by `scripts/build-refresh.cjs`) now skips a line only when it has no
product AND a value of exactly 0, and records the count as `skippedBlankZeroLines`.
Lines with no product but a value, missing order numbers/stores, or out-of-range
dates still stop publication. Released with
`../scripts/release-orders-refresh-blank-lines-20261001.cjs` (prepare/deploy);
only `order-workbook.cjs` changed. Revision `refreshpublicfranchiseorders-00002-ziz`;
runtime and IAM unchanged. 56 tests passed. Published 01-30 September: 7,100 lines,
1 skipped, detail total R4,697,377.43.

## Store Missed Dates (30 September 2026)

Attendance store rows now include `missedDates`: the distinct scheduled dates with
a `missed` result (leave and unverified rows excluded). Only `vendor/attendance.cjs`
changed, by that one field; totals, versions and statuses are unchanged. Released with
the `--store-missed-dates` profile in `../scripts/release-dashboard-performance-clients.cjs`,
which verified the live source against the 21 September regional-design baseline.
Revision: `publicmeridiandashboards-00016-sez`; runtime settings and IAM unchanged.
All 53 tests passed. Live API (01-28 September): reps 7,550 stores / 75 missed,
merchandisers 4,381 / 133 missed, every store carries `missedDates`, identical to the
Azure host. The Azure edition displays these dates; see its deployment record.

## Verified Orders Regions (21 September 2026)

The temporary Orders reader also checks `publicDashboardSources/orderRegions`.
This sanitized lookup contains exact normalized store names and regions, derived
from the named local Call Cycle Master plus four narrowly verified Geo store
records. It does not grant access to the cloud master or alter original ledgers.
`backend/order-regions.cjs` fills only missing, unambiguous matches after selecting
the current snapshot and before filtering, totals, drilldowns and exports. The
mapping version is included in cache/export consistency, so daily imports do not
discard the correction. Existing regions, amounts and quantities are untouched.

Use `scripts/publish-order-regions.cjs` to validate reviewed source evidence; add
`--publish` to atomically publish its versioned lookup. The script preserves the
previous document, refuses oversized data, and reconciles source IDs and totals.
This lookup must be republished when its master/evidence changes; it does not
silently infer regions for newly encountered stores. Missing/ambiguous matches
remain visible, and selections with zero recorded amount have a source notice.
See the Azure deployment record for release details and remaining source gaps.

## Brand Column

The fresh export contains `Banner`, not `Brands`, `Brand` or `Brand Name`.
Those are different dimensions. The parser accepts all three brand aliases,
and orders support brand filtering, visible columns, line details and exports.
Optional brand fields in attendance Schedules also flow to filters, drilldowns
and Excel exports. The filter appears only when the attendance source supplies
brand assignments; transaction brands are never used to infer attendance.

The original Nexus source files were left untouched. The brand adapters are
explicitly recorded in `scripts/build.cjs` and output hashes in the port
manifest, ready for a separately reviewed main-Nexus integration later.

## Public-Access Risk

Anyone with internet access will be able to obtain the included staff/store
attendance and commercial order records, including exports. No-login links are
not private sharing links. `noindex` and `robots.txt` discourage indexing but do
not enforce access control. Previously downloaded records cannot be recalled.

The deployed service account is
`nexus-public-viewer@meridain-nexus.iam.gserviceaccount.com`. Approved permissions:

- `roles/datastore.viewer` at project level. This can read more than these two
  datasets, including other Firestore collections. The API code restricts its
  reads to eight named collections; that is an application boundary, not a
  collection-level IAM boundary. The user approved that broader capability.
- Conditional `roles/storage.objectViewer` for `uploads/` and
  `geo-rep-attendance-store-masters/` in the existing Nexus bucket. `uploads/`
  is a shared upload prefix and may contain other imports, not attendance only.
  The API only retrieves the workbook paths referenced by attendance metadata;
  it never accepts an arbitrary storage path from callers.
- No database writes, object writes, Secret Manager access or source exports.
  Existing Firebase client rules remain unchanged; raw source URLs and tracker
  metadata are not included in the viewer responses.

The endpoint rejects other routes and mutation methods. Requests, response
sizes, source workbook sizes and row counts are capped. There is an in-memory
per-IP request limit. It is not a distributed WAF or a hard spending cap.
At most two function instances are configured; monitoring and billing alerts
are still required for an internet-public service.

For stronger isolation, publish only approved reporting snapshots into a
separate database/bucket and give the viewer access only there. That requires a
separate publishing pipeline; it is not implemented in this temporary edition.

## Build and Test

Run from `C:\Users\PC\MeridianNexus\firebase-dashboards`:

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd run build
npm.cmd test
npm.cmd run test:filters
npm.cmd run test:all-filters
npm.cmd run browser
npm.cmd run test:navigation
```

Build copies only an explicit allowlist of retained UI assets and extracts the
read-only reader dependency tree from original Nexus. `PORT_MANIFEST.json`
records provenance and hashes. It does not copy test fixtures into Hosting.
The local browser test uses clearly synthetic data in its own test process;
production has no fixture fallback.

Local checks: 19 service/security/filter/export tests, 30 dashboard/viewport
checks, 52 individual filter/viewport checks, and filter layout at six widths.
The filter suite checks combined selections, cancellations, empty periods,
selected-day persistence, drilldowns and downloaded CSV/Excel contents.
Evidence is in `test-results/` and `../.tmp/public-dashboards-20260914/`.

The navigation suite covers both isolated editions at 1366, 390 and 320 pixel
widths: 58 portal-link and previous-selection checks. Its destination page is
intercepted to test navigation without signing into or modifying the real portal.
The actual portal URL separately returned HTTP 200. To verify the deployed
public links, run `node tests/portal-navigation.cjs --url https://meridian-field-dashboards.web.app`.
All 29 live checks passed on 15 September 2026 with no page or console errors.
Evidence and desktop/mobile screenshots are in `test-results/portal-navigation/`.

`node scripts/audit-live-filters.cjs` audits the deployed read-only APIs against
their current records. `node tests/live-filter-ui.cjs` verifies live attendance
filter availability, selected dates and tab navigation on desktop and mobile.

## Redeploy This Edition

Use only this folder's `firebase.json`. Never deploy the root configuration for
this change. The baseline of the original site and functions is already saved;
do not replace it.

```powershell
npm.cmd run build
npm.cmd test
firebase.cmd deploy --project meridain-nexus --config firebase.json --only functions:public-dashboard-viewer --non-interactive
firebase.cmd deploy --project meridain-nexus --config firebase.json --only hosting --non-interactive
```

The site and read-only service account already exist; do not recreate them.
This function codebase contains exactly `publicMeridianDashboards`.

Live links:

- `https://meridian-field-dashboards.web.app/attendance`
- `https://meridian-field-dashboards.web.app/franchise-orders`

After deployment, verify anonymous reads, actual dates and totals, filtered
exports and deep-link reloads. Confirm admin/import/file routes return 404 and
PUT/PATCH/DELETE return 405. Then:

```powershell
node scripts/verify-live.cjs
node tests/browser.cjs --url https://meridian-field-dashboards.web.app
node scripts/operations.cjs verify
```

The last command compares the original hosting release, automation/report
function revisions and protected local file hashes with the saved baseline.

To obtain another transaction export with the existing configured Geo account,
run `node scripts/fetch-geo-report.cjs`. Credentials stay in memory and are not
saved into the report, logs or viewer. Inspect the evidence, then run
`node scripts/publish-orders.cjs` for a read-only preview. Adding `--publish`
writes only the viewer-specific chunks and switches their pointer after the
row-count check. The original source and ledger remain untouched. Public
viewers cannot initiate this operator-only workflow.

## Suspend Public Access

Set `PUBLIC_DASHBOARDS_ENABLED=false` in `backend/.env.meridain-nexus`, then
redeploy **only** `functions:public-dashboard-viewer` from this folder. It will
return 503 rather than data. Removing or disabling Hosting alone is insufficient
because a deployed HTTP function also has its own URL.

For urgent containment, an authorized cloud administrator can remove public
invoker access from this new function's underlying Cloud Run service, or revoke
this new service account's reader bindings. Do not change original Nexus
identities, rules, functions or hosting. In-memory and already downloaded data
cannot be revoked retroactively.
