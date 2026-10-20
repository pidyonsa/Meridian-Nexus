# Azure Public Dashboard Deployment

Initially deployed 15 September 2026; dashboard-only shell deployed 16 September 2026.
The public exclusion-list view was removed at the user's request later that day.
On 21 September the user approved moving both report APIs and their verified
source snapshot to Azure. Attendance automatic publishing was restored on
22 September; source extraction still runs in the existing Google project.

## Reports Load Again Behind Sign-In, 20 October

After Microsoft sign-in went live, signed-in users saw "Report unavailable: The report service is
unavailable" on Attendance and Franchise Orders. `ui/viewer.js` still sent report calls with
`credentials:'omit'`, so the App Service session cookie never reached `/api/attendance` or
`/api/orders`; App Service answered 401 with an empty body, and the viewer reported that as an
unavailable service.

- **Fix** (`ui/viewer.js`, copied to `public/` by the build): report calls send the session
  (`credentials:'same-origin'`, `redirect:'manual'`). A 401 or a redirect to Microsoft sign-in (the 8-hour
  session ended) now says "Your Microsoft sign-in has ended. Reload the page to sign in again."
- Tests 80 of 80 pass. Deployed the 1,058,140-byte ZIP (54 allowlisted files), deployment
  `80ca8040-004a-41a3-9a63-87a7fbb70385`, 10:22 UTC; the live `public/viewer.js` and `server/main.cjs`
  match the package. `/healthz` 200; signed-out requests on both host names still 401. Pages and scripts
  are `no-store`, so a reload picks up the fix.
- **Downtime:** an extra `az webapp restart` sent right after the deploy stopped the site while the
  new container was starting (`ContainerStartupFailure` 10:23:24 UTC); it was back at 10:25:23 UTC.
  While stopped, App Service answers every request with 403 ("web app is stopped"), which users saw as
  `/api/orders` 403. `az webapp deploy` already restarts the app; do not restart again after it.

## Microsoft Sign-In Required, 19 October

At the user's request the dashboards are no longer public: everything on
https://nexus.meridiangroup.co.za (and the `azurewebsites.net` name) needs a Meridian
Microsoft account. Any account in the Meridian tenant can sign in, including guests invited
into it; people outside the tenant cannot.

- **App Service Authentication** (`authsettingsV2`): Microsoft Entra ID with the existing
  registration `Meridian Nexus Azure` (`748c496f-5033-415d-9d3f-f2bb85de1d71`, single tenant,
  issuer `login.microsoftonline.com/cbe83df2-…/v2.0`), require authentication, signed-out
  browsers go to Microsoft sign-in, HTTPS only, token store on. No client secret (ID-token sign-in).
  Only `/healthz` is excluded (the App Service health check; it returns status only).
- **Registration changes:** callback URLs for both host names, ID tokens on, assignment no
  longer required (any Meridian account), `openid profile email` consented for the organisation.
  The `Nexus.Reader` / `Nexus.Admin` roles are kept for the later full-portal move.
- **App-side lock** (`server/main.cjs`, app setting `REQUIRE_MS_LOGIN=true`): every request except
  `/healthz` must carry App Service's signed-in principal from the Meridian tenant, otherwise 401.
  App Service strips that header from incoming requests, and the app stays locked even if platform
  sign-in were switched off. Tests: `tests/login.test.cjs` (79 of 79 pass).
- Live checks while signed out, both host names: pages, scripts, `asset-manifest.json` and both
  report APIs return 401 (browsers are redirected to Microsoft sign-in); a forged principal header is
  refused; HTTP redirects to HTTPS; `/healthz` 200. Microsoft accepts the sign-in request (correct
  tenant, client and callback).
- The `verify-*.cjs` live scripts call the site anonymously and now get 401.
- Rollback: set `REQUIRE_MS_LOGIN=false` and disable App Service Authentication (both are needed).

Later on 19 October, after the user was signed in silently (single sign-on from their
browser) and asked for a visible sign-in and tighter access:

- **Sign-in page every time:** `prompt=login` on the Entra provider, so Microsoft always asks
  for the account and password instead of signing in silently.
- **Sessions:** fixed 8 hours (`cookieExpiration` FixedTime 08:00:00), then sign in again.
- **Everyone signed out:** new `WEBSITE_AUTH_ENCRYPTION_KEY` and `WEBSITE_AUTH_SIGNING_KEY` app settings
  (random 256-bit, hex; values not recorded anywhere else), then a restart. Every session issued
  before is no longer accepted. Rotate both again to sign everyone out in future.
- **Access levels** (`server/main.cjs`): every Meridian account sees Syndicated Attendance (Reps and
  Merchandisers), Franchise Orders and their static files. Anything else on this site is the full
  Nexus and needs the Entra app role `Nexus.Admin`, held only by `jpinto@meridiangroup.co.za`; others
  get 403. Today the site has no other pages, so this applies as more of Nexus moves to Azure.
  Tests: 80 of 80 pass.
- Live checks signed out on both host names: every page and file 401, `/healthz` 200; the sign-in
  request carries `prompt=login` and Microsoft shows its sign-in page.

## Store Missed Dates, 30 September

Client request: show on which days each store was missed on Attendance by Store,
on screen and in its Excel download. `storeRows` in the attendance engine now adds
`missedDates` (distinct scheduled dates with a `missed` result; leave and unverified
rows are not included). The store table has a **Missed dates** column (first four
dates, "+N more", full list on hover); the store Excel adds **Missed dates** and
**Scheduled dates** (e.g. `Tue 01 Sep 2026`). Totals, versions and store status are unchanged.

Changed sources: `firebase-dashboards/backend/vendor/attendance.cjs` (copied via
`build-data-engine.cjs`), `ui/attendance-stores.js`, `ui/attendance-layout.css`,
`tests/attendance-stores.test.cjs`, `tests/stores-layout.cjs`. The same engine line
was later released to the Google data service as `publicmeridiandashboards-00016-sez`
(see `../firebase-dashboards/README.md`). Before release, only `attendance-stores.js`,
`attendance-layout.css` and the engine `attendance.cjs` differed from live.

Published the 1,056,854-byte ZIP (36 static assets, 54 allowlisted files), deployment
`28a6de19-d912-4d5e-aaa2-7306291d0896`, then restarted the app. All 36 live asset
hashes match. 70 unit tests, 18 local and 18 live store browser checks (both audiences,
drilldowns, full Excel) and the live filters check passed. Live API, 01-28 September:
reps 7,550 stores / 75 missed; merchandisers 4,381 / 133 missed; every store carries
`missedDates`. `verify-live.cjs` (expects the pre-21 September data service) and
`verify-azure-live.cjs` (compares against the fixed 21 September migration totals)
are stale and failed only on those expectations.

## Attendance Refresh, 22 September

The existing Geo Rep source capture now queues at **06:00 SAST every day**, not
01:00. Its obsolete first-of-month skip was removed from the exact deployed
scheduler source, preserving every other function file and runtime setting.

A dedicated private, keyless publisher checks for completed imports every five
minutes and atomically publishes both Attendance audiences to Azure. It preserves
Orders, checks workbook hashes and report totals, rejects mixed imports, and
retains the last verified snapshot on failure. The public app was not restarted
or redeployed. Full Nexus migration and Salesforce schedule work remain paused.

The automatic 09:55 SAST check successfully published data through **21 September**.
Reps: 11,909 scheduled / 11,679 attended; merchandisers: 54,094 / 50,799.
Latest day: reps 896 / 867; merchandisers 3,308 / 3,045.
Both audiences' live versions, totals, daily details and Excel exports reconcile.
Orders totals and version are unchanged. All 68 tests and 22 live Daily Visit
browser checks passed; desktop/mobile screenshots were reviewed.

Publisher revision: `publishazureattendance-00002-dis`.
Scheduler revision: `runscheduledextractions-00058-lev`.
Snapshot: `d603714160697e6bbe704385ccdb4c72167be4e0f53890fe80fe025c5822615c`.
See `../docs/azure-attendance-publishing-20260922.md` for permissions, limitations,
operations and evidence. The earlier sections below retain their release history.

## Live Links

- https://meridian-field-dashboards.azurewebsites.net/attendance
- https://meridian-field-dashboards.azurewebsites.net/franchise-orders

Both links allow anonymous viewing and exports of the same already-approved live
data. Attendance has a dedicated sidebar and mobile menu with its four report
views and Reps/Merchandisers selector. Orders has its own Insights-style sidebar
with seven Geo report views and top filters. Neither dashboard links to the other. Home opens
https://meridian-group-za.github.io/Meridian-Nexus/portal.html in the same tab.

## Ownership and Infrastructure

| Setting | Verified value |
| --- | --- |
| Directory | Meridian Group |
| Tenant | `cbe83df2-b350-4dab-8d5f-f78d21fe7d27` |
| Subscription | `02b268fe-e01a-453e-b287-eec83ccc0676` |
| Resource group | `rg-meridian-field-dashboards` |
| App | `meridian-field-dashboards` |
| Plan | `meridian-field-dashboards-plan`, Linux B2, one instance; upgrade explicitly approved |
| Region | South Africa North, Johannesburg |
| Runtime | `NODE\|24-lts`, Always On |
| Deployment | `683b5b4f-5adc-483c-a172-501622c033f9` |
| Deployment record | Complete, active, status 4; completed 21 September 2026, 14:02:34 UTC |
| Active data mode | `azure-snapshot`; private `meridianfield730011/dashboard-data` |
| Budget alerts | None, per user response |

The what-if showed five creates: the plan, site, auth configuration, and two
publishing credential policies. No existing resource was updated by the template.
No database, storage account, Key Vault or access role was created in the initial hosting deployment.
The original Nexus, temporary Firebase deployment and separate authenticated
`azure-nexus` edition remain intact. Their Entra assignments are unchanged.

## Security and Data

- HTTPS only; TLS 1.2 minimum for the app and deployment endpoint.
- FTP and password-based SCM publishing disabled; Entra deployment used.
- Public app authentication disabled only for this new, explicitly approved site.
- App APIs expose Attendance and Franchise Orders only; no admin/import/write APIs.
- Managed identity reads fixed Azure blob paths; no Google fallback in active mode.
- CSP restricts scripts and API connections to the same origin; framing blocked.
- No raw workbooks, snapshots or credentials in the 54-file, 1,056,373-byte ZIP.
  Existing reporting hierarchy/calculation files are server-only, not public assets.
- Successful report responses may be served from a bounded, 15-second memory cache.
  Exports bypass that cache. Browser/API responses use no-store. No record disk cache.
- The verified source data is now in private Johannesburg Azure storage. The
  app has container-only Blob Data Reader access. Temporary upload access was removed.
- Source extraction has not migrated. Attendance now publishes automatically;
  Orders still requires a separate verified Azure snapshot publish.

Anyone with internet access can read these reports; no-login links are not private.
Noindex discourages indexing but is not an authorization boundary. Previously
downloaded exports cannot be recalled. There is no distributed WAF or hard billing cap.

## Billing Recovery, 21 September

The approved Azure data migration is live. `DASHBOARD_DATA_MODE=azure-snapshot`
removes Google from report serving. Initial live reconciliation passed for
Orders and both Attendance audiences, including exact totals, versions, latest-day
details and Excel exports. B2 is applied and final post-upgrade verification passed:
37 Orders browser checks, 22 Daily Attendance checks, 48 view/navigation checks
and 11 regional/map/hover checks, with no browser errors. All 36 static hashes
matched and raw/admin/write routes remain unavailable. Desktop/mobile screenshots
were inspected. 59 unit/integration tests pass; the infrastructure template compiles. See
`../docs/azure-dashboard-migration-20260921.md` for the full migration record.

Attendance source dates are 1-20 September 2026; Orders uses the 21 September
06:01 SAST import. Neither future source updates nor Salesforce schedule fixes
are implied by this recovery. Existing public visibility and URLs are unchanged.

### Earlier Google Recovery Attempt

The Google billing account is open again and project billing is enabled. The
Azure deployment adds bounded retries for non-JSON platform 429/502/503/504
responses, which were previously reported as generic 502 errors. Retries share
the original 60-second deadline, respect Retry-After and never cache failures.
All 54 host/presentation tests passed. The ZIP contains 40 entries (36 static
assets), 1,009,392 bytes; existing UI asset hashes are unchanged.

The Google data service was restarted using the identical deployed image digest
as revision `publicmeridiandashboards-bill-mub7np4y`, retaining the two-instance
maximum, identity, permissions, data and runtime settings. Requests briefly
returned 200 with 3,681 selected lines, but subsequent live verification failed:
Google returned platform 429 (no available instance). The same error appeared
in multiple other project services. No out-of-memory termination was observed;
the viewer's recorded memory usage was below 23% before it stopped serving.

A temporary service-level minimum of one instance did not restore service.
It was removed and the original scaling configuration was verified. Azure
`/healthz` remains 200; this is host health, not proof of data-service recovery.
That Google recovery attempt did not resolve the outage; its earlier successful
browser records are not evidence for the later Azure migration. See
`../docs/orders-billing-recovery-20260921.md` for the incident record.

The earlier attempt made no data migration or permission changes. The later
approved Azure migration is documented above. Attendance schedule work remains paused.

## Regional Hover Totals, 21 September

Published the 1,008,996-byte UI-only ZIP (36 static assets, 40 archive entries).
No backend, data mapping, infrastructure, permission or source-data changes were
needed. The data-service revision at that release was `publicmeridiandashboards-00012-roj`.

The regional trend now uses one reference-style tooltip for the hovered period:
colour-coded exact totals for each displayed region and a separate period total
for all selected regions, including regions outside the top six. Amount/Units,
currency, missing values, zeros, selected clients and recorded time buckets are
preserved. A shaded period band, vertical guide and highlighted points follow
the selection. The tooltip stays within desktop/mobile viewport bounds, supports
keyboard and touch, and is disposed when the report changes. Hover issues no API
requests and does not mutate filters; mouse/Enter point drilldowns still work.

Verification passed 50 host/presentation tests, 37 existing local Orders browser
checks, and 11 regional checks both locally and live. Live checks cover exact
decimal totals, all-region totals, zero amounts, filtered units, single-month
data, keyboard navigation, actual-point touch, mobile horizontal scrolling,
drilldowns, exports, all 36 static hashes and read-only route boundaries.
No browser errors were recorded. Hover screenshots and the verification record
are under `test-results/regional-design/live/`.

## Orders Regional Design, 21 September (Earlier Release)

The reference-style Regions page was published in the 1,006,116-byte allowlisted
ZIP (36 static assets, 40 archive entries). The host was restarted to reload its
static allowlist. Original Nexus and the separate authenticated Azure edition
were not deployed or modified.

The retained public data service is now `publicmeridiandashboards-00012-roj`.
Only `service.cjs`, `vendor/orders.cjs` and the new `order-regional-analytics.cjs`
changed against the verified preceding deployed source. The release helper checked
runtime configuration and IAM for equality before and after deployment.

The province map and regional snapshots use contribution shares, not fictional
year-on-year movement. Trends use actual recorded periods. aQuelle starts in Units
on Regions because its imported amounts are zero; the Amount option remains available.
The existing region mapping, client mappings, amounts and source records are unchanged.

Pre-deployment verification passed 53 backend tests, 47 host/presentation tests,
37 existing Orders browser checks and the regional-specific reconciliation,
keyboard drilldown, export and responsive checks. All 37 Orders checks also passed
on the live deployment. Final regional verification completed at
2026-09-21T09:40:32Z with no browser errors: province and observed-period aggregates
reconciled against the full selected source, keyboard and date/region drilldowns
retained filters, zero-value and empty states passed, and exports were verified.
The compact league table and 1440/1366/1024/390/320 layouts passed. All 36 live
static hashes matched and admin/import/write routes remained unavailable.
Evidence: `test-results/regional-design/live/verification.json` and
`test-results/orders-reference/live/verification.json`.

## Orders Region Mapping, 21 September (Earlier Release)

Deployed data-service revision `publicmeridiandashboards-00011-beq` at
2026-09-21T06:18:32Z. Azure continues to use that temporary Firebase read-only
service; no Azure hosting ZIP, original Nexus, IAM policy or automation changed.
All 33 Azure static asset hashes still match the 18 September package.

The current transaction snapshot lacked regions for all 471 aQuelle lines. Its
publisher only used historical ledger matches, and the original importer could
not read the configured cloud Store Master because of a storage permission error.
No storage permissions were widened. The locally available named 13 August
Call Cycle Master supplies 6,121 normalized names; four missing aQuelle stores
were verified by narrowly filtered, existing Geo store records. Only their
store-name/region pairs and source versions were retained as extra evidence.

The versioned lookup is in `publicDashboardSources/orderRegions`, separate from
the original ledger. The public service applies exact, unambiguous store-name
matches only to missing regions. Free-text customer numbers, fuzzy names, rep
locations and brand geography are not used. Existing regions and all order IDs,
amounts, quantities, client/brand mappings and row counts remain unchanged.
This read-time lookup also applies to subsequent daily snapshots, and its version
participates in cache/export consistency checks. It is a verified mapping snapshot,
not an automatic mirror of future Store Master changes; republish after reviewing
updated master/evidence with `firebase-dashboards/scripts/publish-order-regions.cjs`.

All 471 aQuelle lines (55 orders, 2,140 units) now map to six regions: Western Cape
834 units, KwaZulu Natal 757, Gauteng 441, Free State 65, Mpumalanga 29 and North
West 14. Its imported amounts remain zero; a source-data notice explains this.
The correction resolves 1,001 missing-region lines overall. The remaining 712
lines belong to 24 Danone store names absent from the verified lookup and remain
explicitly Unmapped; no geographic guesses or balancing values were added.

Validation: 47 backend tests and 37 full Azure Franchise regression checks passed.
The full suite covered every available filter, dates, all seven tabs, exports,
chart drilldowns and 1366/1024/390/320px layouts without browser errors.
The targeted live check reconciled all 4,309
source rows and all original totals, all six aQuelle region filters, Brand/Client
equivalence, exports, stale-export rejection, desktop/mobile drilldowns and blocked
admin/write APIs. Browser errors: none. Evidence:
`test-results/order-regions/verification.json`, `test-results/orders-reference/live/verification.json`, screenshots in the corresponding directories,
and `../firebase-dashboards/test-results/order-regions/mapping-audit.json`.
Deployment/IAM baseline: `../.tmp/dashboard-order-regions-20260921/function/`.

## Franchise Insights Reference, 18 September

Franchise Orders adopts the supplied Sales Insights reference's sidebar, typography,
colours, compact filter styling, KPI accents and line-chart treatment. Its seven
views remain Executive Overview, Trend, Regions, Products, Stores, Reps and Order
Detail. Filters remain in the top bar, with reporting period and From/To together.
Home opens the Nexus portal. The desktop sidebar becomes a keyboard-accessible
drawer on mobile; there are no Attendance links or references in the Orders UI.

Only presentation was adapted. The live Geo report, client/brand mapping, source
warnings, daily 06:00 SAST import, calculations, filters, drilldowns, caching and CSV
exports are unchanged. Chart lines use the original unsmoothed data coordinates
and retain the original interactive hit targets. No Sales Insights data, MSAL
runtime, comparisons, categories or channels were introduced. Missing source
currency is still marked Not supplied, not assumed to be Rand.

Validation completed before deployment: 42 unit tests, 48 local shared-navigation
checks, 37 local Franchise checks and 37 local-with-live-data Franchise checks.
After deployment, 37 Azure Franchise checks and 48 Azure shared-navigation checks
passed. These cover available Geo filters, full filtered exports (including long
order references as text), totals reconciled against source rows, date presets,
chart drilldowns, all report tabs, Home and desktop/mobile layouts. Browser checks
reported no console/page errors or page overflow. Attendance behaviour and styling
were preserved. The package contains 33 static assets and 37 allowlisted ZIP
entries (958057 bytes). The app was restarted to reload its static allowlist;
verification began only after the new presentation files matched their hashes.

Final Azure API, Attendance drilldown/Excel, Orders export and read-only security
checks passed. All 33 live asset hashes match the package. The final 37-check
Franchise run also waits for loading and mobile-menu transitions before capturing
screenshots; desktop and mobile screenshots were reviewed. Admin/import/file APIs
remain unavailable and unsupported write methods remain blocked.

No original Nexus app, Firebase backend, database, role, permission or import job
was changed. The temporary Azure host still uses the existing public data service.

Evidence: `test-results/orders-reference/live/verification.json`,
`test-results/sidebar-free/live/dashboard-only-verification.json` and
`test-results/live/asset-verification.json`.

## Store Reference, 18 September

Attendance Detail by Store now follows the supplied four-card reference for both
rep and merchandiser audiences. It retains syndicated Meridian branding, the
attendance-only sidebar, live source filters and existing source drilldowns.
Total stores, Visited, Missed and % Missed cards filter the store table locally.
Search covers assigned staff, related reps, store names and store codes; rows sort
missed first, then unverified, then visited. Search and status persist across tab
changes and Reset clears them. No source data or attendance calculation changed.

Store totals reconcile as visited + missed + unverified = total. A positive visit
marks a store visited even if other visits remain outstanding. Unverified is not
classified as missed. Banner is omitted because the current live source does not
provide it. Merchandiser rows retain the rep and Line / Channel Manager hierarchy.
Target and Actual fit on the checked 1366px desktop view; narrower screens contain
horizontal table scrolling without page overflow. Store/status/visit links retain
source detail. The collapsible Visit and verification detail preserves the previous
missed-visit and unverified-visit shortcuts for the current table page.

The table uses 100-row pages; Excel exports all matching stores, including search
and status, with source/filter/version metadata. A changed source version blocks
download until refresh. The existing local ExcelJS dependency is still loaded only
when exporting; roster and store exports now share its small script loader.

Validation: 39 unit tests, 48 local full-view/navigation checks, 16 local roster
regression checks, 18 local store checks, 18 local-with-live-data store checks and
18 final Azure store checks passed. Final browser checks reported no console or
page errors and covered both audiences at 1366/390/320px, source reconciliation,
search/status without new requests, pagination, manager-filtered drilldowns/Excel,
tab-return selection retention and changed-source export rejection. Screenshots
were reviewed. All 31 deployed asset hashes match the package (35 allowlisted ZIP
files, 953386 bytes). Live Attendance/Orders API, source Excel and read-only security
checks passed. The app restart briefly delayed static readiness; verification ran
after the new asset hashes matched. No other app, backend, database, role or
permission was deployed or changed.

Final evidence: `test-results/store-reference/live/verification.json` and
`test-results/live/asset-verification.json`. Store link:
https://meridian-field-dashboards.azurewebsites.net/attendance/rep/stores

## Roster Reference, 18 September

The Rep and Merchandiser rosters now follow the supplied four-card reference with
name search, lowest-attendance-first sorting, progress bars, source drilldowns and
Excel export. Manager/region/division/role filters are unchanged. Larger rosters
use explicit 100-row pages; Excel contains all matching rows in screen order.
The summary counts distinct people, keeps multiple manager assignments as separate
reporting lines, and averages attendance per scheduled person. Missing schedules
remain visible with blank metrics rather than fabricated zero attendance.

The existing report is searched and paged in browser memory without new data
requests. Export validates the current source version and writes a typed XLSX
workbook with search/filter/version metadata. The existing ExcelJS browser bundle
and its MIT license are served locally; the library loads only at export time.
No backend, data source, permissions, source calculation, original Nexus files,
Daily Visits, MTD Overview or Franchise Orders behavior was changed.

Validation: 34 unit tests, 48 local full-view/navigation checks, 16 local roster
checks, 14 local-with-live-data checks and 16 final Azure roster checks passed.
The roster checks cover no-refetch search and paging, source progress drilldowns,
all-matching-row Excel, manager-plus-name exports, source-version rejection, and
desktop/mobile layouts at 1366/390/320px. All 29 live asset hashes match the package
(33 allowlisted ZIP files). Existing live API/export and read-only security checks
also passed. Screenshots were reviewed for both audiences.

Initial parallel live checks saw report API 502/504 responses. Direct read-only
diagnostics through Azure and the upstream succeeded; sequential full reruns
passed. This UI release does not change backend timeouts or remove the existing
data-service availability dependency. Final evidence:
`test-results/roster-reference/live/verification.json` and
`test-results/live/asset-verification.json`.

## Daily Visit Reference, 18 September

Daily Visits now follows the supplied daily reference for both reps and
merchandisers, retaining Meridian syndicated branding. It includes selected-day
KPIs, up to 13 prior/current report days, type bars, division rings and regional
bars, a two-column line manager daily scorecard and distinct missed stores with
Excel export. Central, Coastal and Inland retain their order. All numbers, bars,
manager links and store links preserve source drilldowns and scheduled dates.

The existing read-only API supplies date-filtered breakdowns; no Firebase backend,
calculation, exclusion, permission, report automation or original Nexus code was
changed. MTD Overview and Franchise Orders are unchanged. Responses reuse the
bounded browser cache; old date responses cannot replace newer views. Unknown
visits/stores stay separate from missed records. The monthly strike-rate reference
is not shown as though it were a daily total.

Validation: 28 unit tests, 48 local full-view/navigation checks, 18 local and
local-with-live-data daily checks, and 22 final Azure daily checks passed. The live
checks include dates, all available manager/region/division/role filters, history
and manager drilldowns, and exact missed-store IDs in Excel, for both audiences.
Desktop (1366px) and mobile (390px/320px) screenshots were reviewed. All 26 live
asset hashes match the package (30 allowlisted ZIP files). Existing live API,
export and read-only security checks passed.

The initial post-restart check caught the previous process's stale asset allowlist;
verification was repeated after the new script returned HTTP 200 and all asset
hashes matched. Final evidence: `test-results/daily-reference/live/verification.json`
and `test-results/live/asset-verification.json`.

## Shared Meridian Favicon, 18 September

Both dashboard links use the same square orange Meridian mark on navy, replacing
the full-wordmark favicon. The existing Meridian PNG is included as a versioned
asset in the build and package (25 static assets, 29 allowlisted ZIP entries).
No dashboard data, layouts or access permissions changed. All 22 host/presentation
unit tests passed. After deployment and host restart, Chrome checks confirmed
both live pages reference the new icon, decode it as 32x32 and serve bytes matching
the source asset. Evidence: `test-results/favicon/verification.json`.

## Corrected Attendance Reference, 18 September

Follow-up layout correction: both regional charts now stack Central, Coastal and
Inland vertically. Only the regional grid CSS changed; data, filters, drilldowns,
backend services and Orders are unchanged. All 21 host/presentation unit tests and
six targeted audience/viewport checks passed locally and on Azure. The live CSS
hash matches the build, and desktop/mobile screenshots were reviewed. Evidence:
`test-results/regional-stack/live/verification.json`.

Replaced the Attendance overview presentation using the corrected dedicated
Attendance screenshots, not the earlier Call Cycle image. The Azure-only shell
now has an Attendance sidebar and mobile menu, six compact overview KPIs,
division rings, role and regional bars, a two-column manager heatmap, expandable
manager/team detail and regional weekly attendance. Meridian syndicated branding
is retained; no P&G branding or Franchise Orders links appear in Attendance.
Orders keeps its existing separate URL and top-tab interface.
The final package retains all original weekly, type and regional visit/verification
shortcuts in a collapsed totals section, without adding another main navigation item.

The existing drilldown/export renderer remains responsible for selections,
pagination, Excel and version checks. The shared public read service gained only
`attendance-overview.cjs` and its invocation in `service.cjs`, producing additive
region/week aggregates from the same filtered, excluded schedule records.
Release `publicmeridiandashboards-00010-xew` preserves the previous runtime
configuration and IAM, verified against the recorded release baseline. No stored
records, exclusion settings, original Nexus UI, roles or hosting were changed.

The package contains 24 static assets and 28 allowlisted ZIP entries. The initial
post-deploy audit found the existing Azure process still held the old asset
allowlist. Restarting this app loaded the new manifest; all 24 live asset hashes
then matched. Read-only route restrictions, rep/merchandiser drilldowns and Excel,
and order totals/exports passed. The API audit used attendance through 17 September:
10,448 rep targets / 10,258 completed; 44,921 merchandiser targets / 42,317 completed.
Early and caught-up visits remain positive. These are verified snapshot figures,
not fixed display values. Cold loads measured 11.5 seconds and 39.6 seconds;
this presentation change does not eliminate cold source-reading latency.

Before publication, 42 backend tests, 21 host/presentation/cache/security tests
and 48 responsive navigation checks passed. The browser checks cover 1366, 390
and 320 pixels, both audiences, all report tabs, numeric drilldowns, manager team
expansion, weekly cell drilldowns, mobile Escape dismissal and the Home destination.
Evidence: `test-results/sidebar-free/local`, `test-results/live` and
`../.tmp/dashboard-attendance-reference-20260918/function`.

Final live verification passed all 24 asset hashes, read-only API restrictions,
both audiences' detail/export reconciliation and Orders exports. The filter audit
passed 43 cases, including two new region/week detail-and-Excel reconciliations.
The final published package passed all 48 desktop/mobile navigation checks at
1366, 390 and 320 pixels, with no browser errors or document overflow. Desktop
overview/manager/weekly screenshots and fully opened mobile-menu screenshots were
reviewed. Navigation/branding checks are scoped to the application shell, not
legitimate source names containing client identifiers. Business names are unchanged.
Evidence: `test-results/all-filters-live`, `test-results/sidebar-free/live` and
`test-results/live/asset-verification.json`.

## Daily Orders and Reference Themes, 17 September

The existing Geo Rep transaction downloader was running daily at 06:15 SAST,
but its original sales importer could not read the private store master. The
temporary dashboard's separate snapshot was consequently still dated 14 September.
The downloader's existing schedule now runs every day at **06:00 SAST**. This is
the queue time, not a guarantee that Geo Rep completes its export at that minute.

A separate, private `refreshPublicFranchiseOrders` function now publishes the
temporary snapshot. Cloud Scheduler checks every five minutes for a completed
download using the existing scheduled-run pointer, not by scanning filenames or
assuming the newest file in an unbounded directory. It validates the linked file,
month-to-date range and SHA-256, parses all Order Details lines, stages complete
chunks, and atomically advances the public source pointer. A lease, source
freshness check and automatic retries prevent duplicate work and older report
replacement. Validation failures retain the last verified dashboard snapshot.

The function uses the existing automation identity and its existing uploads and
Firestore permissions. No bucket or project data-access grant was expanded.
Only the new function received an authenticated invoker binding for that identity;
anonymous POST was verified denied (403). It cannot be triggered by either public
dashboard. Its code writes only the isolated public snapshot and refresh-status
collections, never original `salesTransactions` or `salesDashboardConfig`.
The original importer/master-access fault is **not** repaired by this isolated
publisher and remains a separate original-Nexus maintenance item.

At 11:27 UTC the publisher processed the completed 17 September export:
3,704 source lines, downloaded at 06:28 SAST. All 3,704 matched the approved
Client/Brand master. Default cancellation-excluded totals: 3,141 lines, 189 orders,
14,387 units, 139 stores, amount 2,141,062.90. Currency is not supplied. The full
workbook's Detail total is 2,485,915.17; the 1,180.34 difference against its Summary
remains explicitly disclosed. The automatic 11:30 UTC check correctly skipped the
unchanged source. Evidence: `../.tmp/franchise-refresh-20260917/`.

The Azure package now contains 21 static assets and 25 allowlisted ZIP entries.
Orders uses the supplied Insights palette, left-accent KPI tiles, matching filter
surfaces and chart colours. Attendance uses the dedicated source's background,
surfaces, borders, typography and status colours, with green for completed visits.
The existing chart/table drilldowns, audience-specific data, no-sidebar shell,
mobile layouts and exclusions remain intact. Before deployment, 39 backend tests,
19 host/cache/security tests and 48 desktop/mobile navigation checks passed.

After deployment, all 21 asset hashes matched. The live filter audit passed 41
cases covering filters, combinations, dates, cancellations, grouping, drilldowns
and exports for Orders and both Attendance audiences. The final live responsive
run passed all 48 cases at 1366, 390 and 320 pixels, including computed reference
colours and the daily download label. Reviewed screenshots and results are in
`test-results/sidebar-free/live`, `test-results/all-filters-live` and
`test-results/live`.

The first responsive live run timed out switching from reps to merchandisers.
It did not capture the failed HTTP response, so its cause is not established.
The separate live data/export audit passed; recent reader error logs contained
no matching error. The complete responsive rerun passed with response/failure
capture added. Cold Attendance reads measured roughly 20-27 seconds during the
data audit; this theme/Orders-publishing release does not resolve that latency.

## Full Package Redeployment, 16 September

At the user's request, the full temporary dashboard package was rebuilt and
redeployed to the existing Azure host at 14:46 UTC. Both links are unchanged.
That initial package matched the deployed backend. The subsequent live audit
identified a manager-scorecard inconsistency and prompted the 15:04 UTC Azure
follow-up deployment. Original Nexus hosting and administration remain untouched.

Before deployment: 32 backend tests, 19 Azure host/cache/security tests and 58
desktop/mobile browser filter checks passed. The package still has 20 static
assets and 24 allowlisted entries, with no source workbooks or credentials.
The live filter audit is repeatable with
`node scripts/verify-filters-live.cjs https://meridian-field-dashboards.azurewebsites.net`.
Its evidence is saved in `test-results/all-filters-live/`.

The audit distinguished two test assumptions from a real application defect:
Currency is intentionally hidden when its only value is Not supplied, and
attendance filter matching is case-insensitive. Separately, scorecard grouping
was case-sensitive: Yolandi Mouton appeared with 119 visits and YOLANDI MOUTON
with 201, while either drilldown selected all 320. Grouping, roster identities,
filter options and scorecard membership now use the same normalized keys as
the existing filters. Region and role groups follow that same rule. Raw visits,
source records and overall attendance totals are not changed.

The follow-up changes only the vendored attendance module and its renderer
adapter. All 33 backend tests, 19 host/cache/security tests and 58 browser filter
checks passed again before deploying the correction. Release evidence:
`../.tmp/dashboard-attendance-identity-20260916/function/`.

The data-service fix is active as `publicmeridiandashboards-00009-wuv`, updated
15:04:57 UTC, with unchanged runtime settings and IAM. All 20 Azure asset hashes
match the follow-up package. Live overall totals and daily Excel exports still
reconcile for both audiences, and read-only route restrictions remain intact.

The final live filter audit passed all 41 recorded cases: 32 filter/control and
export checks plus nine intentional unavailable-field checks. It covers all
available order filters, Brand = Client, cancellation, search, combined filters,
custom dates, 3/12-month presets and sorting. Attendance covers manager, region,
division, role, combined selections, scorecard clicks and mobile daily exports
for both reps and merchandisers. The corrected manager scorecard reconciles at
320 rep visits and 520 merchandiser visits for the selected manager. No browser
errors were reported. Missing-source Channel/Category/Currency order fields and
Banner/Brand/Channel attendance fields remain unavailable rather than invented.
Evidence: `test-results/all-filters-live/verification.json` and screenshots.
The final 48 live navigation/layout checks also passed at 1366, 390 and 320
pixels after the correction, with no sidebar, page overflow or browser errors.
Desktop/mobile screenshots were reviewed. Evidence:
`test-results/sidebar-free/live/dashboard-only-verification.json` (15:10 UTC).

## Brand Equals Client, 16 September

At the user's direction, the product master's Brand now populates both the
Franchise Orders Brand and Client fields. Both filters, table columns and CSV
columns use the same mapping, including the two approved aQuelle SKU overrides.
Banner remains the separate retail grouping. Unmatched products remain explicitly
unmapped rather than using a conflicting transaction Brand as a client guess.

The original transaction Brand is preserved in `sourceBrand` in the read model.
No transaction documents, quantities, amounts, private workbook bytes or
attendance calculations were changed. Only `product-clients.cjs` changed in
public data-service revision `publicmeridiandashboards-00008-hip` (active at
14:39:48 UTC). Hosting assets, runtime configuration and IAM are unchanged; the
existing Azure site consumes the updated API without a separate ZIP deployment.
All 32 backend tests passed, including Brand/Client filter equivalence, combined
filters, exports, unmatched/conflicting identities and source-field preservation.
Release snapshots: `../.tmp/dashboard-brand-client-20260916/function/`.
Live verification at 14:41 UTC confirmed identical Brand/Client filter results
for all three clients, all 2,870 source lines matched, unchanged transaction
totals and successful desktop/mobile Brand filtering. CSVs were parsed and both
columns checked against the selected client on every exported row. All seven
Franchise tabs retained the selection with no extra API requests or browser
errors. Evidence: `test-results/clients-live/verification.json` and its screenshots.

## Performance and Clients, 16 September

The current release adds a Clients filter using `Brand` from Geo Product Order
Master.xlsx. The original 23,315-byte workbook (181 products) is privately stored
at Resources record `portalResources/geo-product-order-master`. Its SHA-256 is
`6b5f76807b5cc67f70e4d1274930cb12b83113a86e03447af9c4d7020933e2d5`.
The original bytes are unchanged. Explicit user-approved mappings assign the two
missing Cranberry SKUs, `6009612472391` and `6009612472421`, to aQuelle; they are
stored as resource metadata with approval provenance. The three client values
are SOILL, Danone and aQuelle. All totals, tabs, drilldowns and exports use the same
mapped and filtered report. Attendance does not infer clients from order products.

Backend revision `publicmeridiandashboards-00007-rov` changes only five reviewed
modules: index, service, vendored attendance calculations, product matching and
bounded report caching. Function runtime limits, service identity and function
IAM are unchanged. A separate conditional Storage Object Viewer grant allows
that service identity to read only `portal-resources/geo-product-order-master/`.
It does not grant public file access, write access or access to other Resources.
The original Nexus hosting, Admin, report automation and saved exclusions remain
unchanged. No Azure infrastructure or hosting-plan changes were made.

Browser caches are bounded, memory-only and keyed by the full selection and
audience. Loaded tabs reuse reports; stale matching reports display while being
revalidated. Refresh bypasses source/report caches; export source versions are
validated. Server report caches coalesce identical requests. Attendance hierarchy
and manager aggregation avoid repeated scans. HTTP compression reduces large
report/script transfers. The floating status indicator is non-blocking and does
not shift layout. No background job or Geo extraction is triggered by Refresh.

Local verification: 31 public-service tests, 19 Azure host/cache/security tests,
48 browser navigation/layout checks and 58 filter/export/browser checks passed.
An identical-output synthetic attendance benchmark improved calculation time
from 2,551 to 1,597 ms; this is not a live end-to-end latency claim. Browser checks
verify tab changes issue no extra API requests and rapid filter responses cannot
overwrite newer selections. Package: 20 static assets, 24 allowlisted ZIP files;
no private workbook, report rows or credentials are included.

Release evidence: `../.tmp/dashboard-performance-clients-20260916/`,
`test-results/filters/`, `test-results/clients-live/` and `test-results/live/`.

Live post-deployment checks confirmed all 20 asset hashes, gzip report responses,
read-only route restrictions, both audiences' drilldowns and daily Excel exports.
Attendance now covers 1-15 September. All 2,870 source order lines (including
cancelled records) matched a client, with no unmatched or ambiguous identities.
The default non-cancelled ledger remains byte-for-byte equivalent on original
fields: 2,368 lines, 140 distinct orders, 10,914 units and amount 1,687,944.08.
Client selections and combined client/banner/manager filters reconcile with their
exports and every grouped/trend total. Distinct orders may contain multiple
clients, so their per-client order counts must not be added together.
All 48 live dashboard/navigation checks subsequently passed at 1366, 390 and
320 pixels, including both attendance audiences, every order tab, drilldowns,
history and Home navigation. No sidebar, page overflow or browser errors were
observed. Desktop and mobile screenshots were visually reviewed.

Seven live Franchise tabs switched in 106-232 ms across desktop/mobile with zero
repeat requests, preserved client selection and correct selected-line counts.
The measured manual orders refresh took 7.9 seconds and a subsequent data request
1.4 seconds. Initial attendance loads still took 17.6 seconds for reps and 29.6
seconds for merchandisers through the retained source service. Caching improves
repeat navigation, not a guarantee of instant first loads or extraction freshness.

Source caveat: aQuelle's 132 non-cancelled lines contain 734 units but all amounts
are recorded as zero. These values are preserved; master prices are not substituted
for transaction amounts. Danone and SOILL amounts remain 1,675,649.64 and 12,294.44.
The sections below record earlier releases and their historical verification.

## Exclusion List Removed, 16 September

The briefly published read-only Exclusion list tab, its page markup/styles and
both audience deep links have been removed. The old URLs return 404. Public
attendance API `mode: "exclusions"` returns 400, so the list is not merely hidden
in navigation. Server-side filtering still applies saved exclusions to totals,
details and exports. Original Nexus Admin management is unchanged.

Only `service.cjs` changed in the public data service, now revision
`publicmeridiandashboards-00006-fib`. All other deployed source modules, IAM and
runtime settings were verified unchanged. No original Nexus hosting, admin
callable, rules, report data or automation was redeployed or modified.

The four individual staff exclusions remain enabled for both audiences at
revision 1, with the original update time of 08:35:45.718 UTC. A deployment check
initially compared raw JSON hashes, which differ when Firestore returns object
keys in another order. Read-only follow-up checks confirmed identical values;
policy verification now canonicalizes keys and checks the saved staff entries.

Verification before deployment: 21 public-service tests, 12 Azure host/security
tests and 48 desktop/mobile dashboard/navigation checks passed. Tests assert no
exclusion navigation, blocked list routes/API and retained policy filtering.
Evidence: `test-results/sidebar-free/local/` and
`../.tmp/remove-public-exclusion-list-20260916/`.

The first live check reached the previous worker immediately after deployment.
A subsequent request confirmed the new JavaScript and 404 exclusion routes;
no additional deployment or configuration change was required.

Post-deployment verification completed successfully: all 19 live asset hashes
match; both exclusion-page URLs return 404 and both audiences' public list mode
returns 400. Attendance drilldowns and daily Excel exports reconcile for reps
and merchandisers; Franchise Orders totals, exports and Banner filtering pass.
The four enabled exclusion entries were independently verified unchanged.
All 48 live browser checks passed at 1366, 390 and 320 pixels, including absence
of the exclusion tab, navigation, Home, audience switching and drilldowns, with
no browser errors or page overflow. Screenshots were reviewed on desktop/mobile.
Evidence: `test-results/live/`, `test-results/sidebar-free/live/` and
`../.tmp/remove-public-exclusion-list-20260916/policy-verified.json`.

## Dashboard-Only Release, 16 September

The three shell adapters in `ui/` remove the sidebar, mobile menu, sidebar branding
and footer. Both existing URLs and their deep links remain unchanged. The 16 other
static assets, report calculations, filters, exports and data service are unchanged.
The build records source and output hashes and packages only 23 allowlisted files.

The same dashboard-only package was redeployed at the user's request at 07:05:24
UTC on 16 September. No infrastructure, data service or dashboard code changed.
All 12 server tests passed again, and post-redeployment live verification confirmed
19 asset hashes, both report routes, drilldown/export reconciliation and read-only
API restrictions. The existing 48 live browser checks apply to the identical UI.

- 12 local server/security tests passed.
- 48 local dashboard-only view/navigation checks passed at 1366, 390 and 320 pixels.
- Tests include all report views, audience switching, active tabs, drilldowns,
  browser history and the Home destination, without a sidebar, drawer, page overflow
  or browser errors.
- Local evidence and screenshots: `test-results/sidebar-free/local/`.
- The same 48 checks passed against live Azure data, with screenshots reviewed at
  desktop and mobile widths. Live evidence: `test-results/sidebar-free/live/`.
- All 19 live asset hashes match this release's verified package. Live attendance
  drilldowns/daily Excel exports reconciled for both audiences; Franchise Orders
  export totals and Banner filtering passed. Admin/import/file routes and mutation
  methods remain blocked. Evidence: `test-results/live/asset-verification.json`
  and `test-results/live/public-live-verification.json` (16 September).
- All eight original source hashes remain unchanged, confirmed by the authenticated
  edition's package verifier.

## Initial Release Verification

- 12 local server/security tests passed.
- 30 local dashboard/viewport combinations and 29 local navigation checks passed.
- All 19 initial-release static files matched the tested temporary Firebase assets by SHA-256.
- Live attendance actual/missed-store drilldowns and daily Excel exports reconciled
  for both reps and merchandisers.
- Live Franchise Orders export totals and Banner filtering passed.
- Live admin/import/file routes returned 404; mutation methods returned 405.
- `/healthz` returned 200 with readOnly=true and publicAccessEnabled=true.
- All 30 live dashboard/viewport checks passed on 15 September: charts,
  drilldowns, cached tab navigation and independent scrolling, with no browser errors.
- All 29 live portal/previous-selection checks passed on 16 September at 1366,
  390 and 320 pixel widths, with no browser errors. The destination portal was
  intercepted by the navigation test; its real URL was separately verified earlier.
- Live browser verification evidence and screenshots are in `test-results/live/`.

At initial data verification on 15 September, both attendance sources covered
1-14 September. Reps: 8,200 targets,
7,833 completed; merchandisers: 36,090 targets, 33,969 completed. Default orders:
140 orders, 2,368 lines, 10,914 units, 113 stores, amount 1,687,944.08. Currency is
not supplied by that source and no symbol is invented. These are verification
snapshots, not frozen dashboard data.

The first navigation-only run timed out while waiting for attendance data after
the complete dashboard suite had passed. The subsequent health check confirmed
the same Azure process remained running, and the attendance API returned HTTP 200
with the newer report through 15 September. The complete navigation rerun passed.
The initial timeout's cause was not conclusively established; cold report reads
can still take tens of seconds through the retained data service. This hosting
move is not a claim that data-service latency or availability has been resolved.

The CLI's startup monitor continued waiting after an app-setting restart. Azure's
deployment record independently confirmed complete/active status and live endpoint,
asset, data and export checks passed. Only the stale local polling process was
stopped; the Azure site was not stopped or rolled back. The public-read flag was
corrected from the ARM string `True` to the required `true`; the Bicep template
now emits explicit lowercase values.

## Cost and Operations

Hosting was approved at approximately R283.82 per 730-hour month (R0.3888/hour),
before VAT and applicable transfer charges. Existing Firebase charges continue.
The user chose no budget-alert email, so none was configured. Stopping the app
does not stop the App Service plan charge. Removing the dedicated plan requires
a separate, explicit retirement decision.

Rebuild, test and deploy only this directory's allowlisted ZIP. Never deploy the
root Firebase configuration or the authenticated Azure edition to this hostname.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run package
az webapp deploy --subscription 02b268fe-e01a-453e-b287-eec83ccc0676 --resource-group rg-meridian-field-dashboards --name meridian-field-dashboards --src-path dist/meridian-field-dashboards.zip --type zip --track-status false --timeout 600000
node scripts/verify-live.cjs https://meridian-field-dashboards.azurewebsites.net
node scripts/browser.cjs https://meridian-field-dashboards.azurewebsites.net
```

For public-access containment, set this app's `PUBLIC_DASHBOARDS_ENABLED=false`.
That disables this host's report reads, including cached/in-flight results, but
does not disable the existing Firebase public site. Do not retire that source
until the next data-service migration has been implemented and reconciled.
