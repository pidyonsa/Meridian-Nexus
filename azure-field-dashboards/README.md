# Meridian Field Dashboards: Azure Hosting and Report Data

Deployed on 15 September 2026:

- https://meridian-field-dashboards.azurewebsites.net/attendance
- https://meridian-field-dashboards.azurewebsites.net/franchise-orders

See [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) for verified resources, security,
cost approval, checks and the boundary between Azure hosting and the existing data service.

Azure report serving and a verified private data snapshot are active as of
21 September 2026. See `../docs/azure-dashboard-migration-20260921.md` for the
approved transfer, private storage, reconciliation and source dates. Since
22 September, Attendance automatically publishes completed 06:00 SAST Geo Rep
imports to Azure. Source extraction still runs in Google; browser refresh reads
the published Azure snapshot. See `../docs/azure-attendance-publishing-20260922.md`.

This edition moves only the already-approved public Attendance and Franchise Orders
website to Azure App Service in Johannesburg. Orders has an Insights-style sidebar
and mobile menu, using only Geo data. Attendance has its own separate sidebar, following
the corrected dedicated Attendance reference supplied on September 18. The September 16 performance release
adds bounded report caching, compression and a product-master Clients filter.
It does not redeploy original Nexus hosting or the separate authenticated
`azure-nexus` migration project. The shared public data service was updated and
the private product master was registered in the existing Nexus Resources catalogue.

## Regional Reference View

The Orders Regions page uses the Sales Insights province geometry and visual theme,
with current Geo Orders data only. `ui/orders-regions.js` renders regional intelligence,
a keyboard-accessible province map, Central / Coastal / Inland snapshots, amount and
unit share charts, the existing exportable league table and the top-six regional trend.
The chart uses observed daily, weekly or monthly buckets; no prior-year growth is inferred.

Hovering the regional trend opens a shared period tooltip with exact values for
each displayed region and the total for all selected regions. It follows Amount
or Units and the current filters; it never fetches another report on hover.
Keyboard focus and arrow/Home/End keys inspect periods, Escape dismisses the tooltip,
and touch opens totals without accidentally activating a point drilldown. Mouse
click and Enter on a focused point retain the existing drilldown. Handlers are
disposed on every render or page exit, so tooltips cannot retain stale filters.

`scripts/build-provinces.mjs` projects the existing local `ZAF_adm1` topology with pinned
build-only d3-geo and topojson-client versions. The generated geometry includes its source
checksum. No iframe, external map service, CDN script or Sales Insights data is loaded.

`firebase-dashboards/backend/order-regional-analytics.cjs` aggregates all selected lines
before restoring the normal 50-row page. Province selection preserves other filters and
combines source regions, including East London / Port Elizabeth and Western Cape / SWD.
Distinct orders and stores are recalculated, never summed across overlapping groups.
Unmapped records remain in totals and the league table; Northern Cape has no invented
division assignment. Currency, missing values and recorded zeros remain unchanged.

Run `node tests/orders-regional-design.cjs` for local browser checks using the existing
approved Orders test snapshot, or append the live HTTPS host for deployed verification.
The public API update is released only with
`node scripts/release-dashboard-performance-clients.cjs prepare --regional-design`
and its corresponding `deploy` action from the workspace root.

## Hosting and Data

Browser -> Azure App Service report engine -> checksum-verified private Azure Blob
snapshot, read through managed identity. Google is not in the active serving path.
The explicit `google-proxy` mode remains only for rollback.

The two paths are `/attendance` and `/franchise-orders`, including their subpages.
Orders uses Executive Overview, Trend, Regions, Products, Stores, Reps and Order Detail
in its sidebar. Attendance uses Daily Visits, MTD Overview, Roster
and Attendance by Store in its sidebar, plus the Reps/Merchandisers selector.
There are no cross-dashboard links or P&G branding. Each Home link opens the supplied Meridian portal URL.
The source extraction automation has not migrated. Attendance was verified
through 21 September 2026 and now publishes automatically after the daily
06:00 SAST import. Orders retains the 21 September 06:01 SAST snapshot; automatic
Orders publication to Azure is not included in the Attendance publisher.

Storage `meridianfield730011` is in Johannesburg with public blob and shared-key
access disabled. The app identity has container-scoped read permission only.
No raw workbook, snapshot or admin endpoint is exposed. Existing Nexus Entra
roles are unchanged; temporary migration upload access was removed.

`infra/hosting.bicep` now preserves the approved B2 plan, managed identity and
Azure data mode. Storage and its container-scoped reader grant are provisioned
separately; a new app identity needs that grant before serving reports. The
template defaults public access to false; an intentional redeployment of the
approved public site must explicitly retain `publicAccessEnabled=true`.

In rollback mode only, the proxy retries non-JSON platform 429/502/503/504 failures up to twice within
the original 60-second request deadline. It respects Retry-After (long waits
are returned to the caller), preserves the read-only payload, and never caches
errors. Persistent platform failures retain their status with a sanitized
message, rather than being mislabeled as an application 502.

## Attendance Exclusions

Attendance applies the saved Nexus exclusions to totals, details and exports.
The public site does not display the exclusion list or offer its API mode.
The former exclusion-view URLs return 404. Viewing and editing the list remain
in authenticated **Nexus Admin > Geo attendance > Attendance exclusions**.
No admin page or exclusion-list view is added to Azure.

## Attendance Reference Layout

The Azure-only presentation adapter preserves the existing detail/export event
handlers and all audience/filter/version checks. It adds six overview KPIs,
three-division rings, role and regional bars, a two-column manager scorecard,
expandable manager/team detail and a regional weekly heatmap. The original
`azure-nexus` sources and original Nexus deployment are not modified.
The collapsible Visit and verification totals section retains the original
type, region and weekly target/actual/missed/unverified shortcuts, including
distinct-store verification counts. It is not a replacement or estimate of those totals.

Regional weekly totals are additive read-only aggregates from the same filtered,
excluded Geo schedule rows as drilldowns. Weeks use Geo's labels, not guessed
calendar buckets; absent weeks are not fabricated as zeros. Store totals remain
distinct-store calculations and can differ from the sum of overlapping groups.
Early and caught-up completions remain positive against the scheduled day.
Heatmap thresholds are 95% green, 90% amber and below 90% red. Time gone is calendar
month elapsed **through the source report date**, not an assertion of data freshness.
Only source-backed filters appear; the month is a report label, not an unsupported
history selector. Team and numeric detail links keep the current filter selection.

## Daily Visit Log

Daily Visits follows the supplied daily attendance reference for both audiences:
six daily KPIs, the last 13 available report days through the selected date, type
bars, division rings and regional bars, a two-column manager heatmap, and the
missed-store list with Excel export. Meridian syndicated branding is retained.
Central, Coastal and Inland remain in that order; absent source days are not invented.

Daily KPIs and history use the filtered monthly report's daily aggregates. The
remaining sections request the existing dashboard API with the same filters plus
the selected scheduled date and source version. This does not change the backend
or its calculations. Day responses reuse the bounded browser cache; detached views
ignore late responses. Refresh invalidates cached day reports. Daily detail and
Excel actions carry the selected day, audience, filters and source version.
The missed-store list contains distinct missed stores, not scheduled-minus-actual;
unverified visits/stores remain separately inspectable. History bars open their own
day's source records. Daily chart colors use the reference's 80%/50% thresholds;
the manager heatmap varies from red to amber to green. MTD thresholds are unchanged.

## Roster Reference Layout

The Rep and Merchandiser rosters follow the supplied four-card reference: distinct
people, average attendance, top performer and lowest performer. Average attendance
is the mean of individual people's attendance rates, not the weighted visit rate
on MTD Overview. Multiple manager assignments are combined for person-level KPIs
but retained as separate reporting lines in the table. People without schedule
detail remain visible with blanks, are not ranked at 0%, and do not enter the mean.
Active people have at least one completed scheduled visit in the report selection.

Name search is normalized and performed on the already-filtered report without
network calls. Rows sort by lowest attendance, then name; missing schedules follow
scheduled people. Larger rosters have explicit 100-row pages. Numeric cells and
progress bars retain person/manager-scoped source drilldowns. The expandable visit
and verification section retains missed/unverified visit counts for the shown page.

Roster Excel includes all matching reporting lines, not just the visible page,
in screen order, together with filter/search/version metadata. The source version
is revalidated before download. The existing ExcelJS browser distribution and MIT
license are bundled locally; its script loads only when exporting, without a CDN
or an additional data service. Values are written as typed XLSX cells, not CSV or
HTML disguised as Excel. Source visit exports remain available within drilldowns.

## Attendance Detail by Store

The store page follows the supplied four-card reference: Total stores, Visited,
Missed and % Missed. Clicking a card filters the store list locally. Search matches
rep/merchandiser names, related reps, store names and store codes, without another
API call. Cards summarize the searched selection before the status filter; the
table count and Excel include the chosen status. Total stores clears that status.
Search/status selections survive tab changes and are cleared by Reset filters.

Rows show missed stores first, then unverified, then visited, with name ordering
within each status. A store with any completed visit is visited; unverified stores
are not counted as missed. This preserves the source's distinct-store definition,
not scheduled-minus-actual visits. Early and caught-up positives are unchanged.
Banner is omitted when the source does not supply it. Merchandisers retain their
related rep and Line / Channel Manager columns. Store names, status badges, Target
and Actual retain source drilldowns. The expandable Visit and verification detail
section preserves missed/unverified visit links for the current 100-row page.

Store Excel exports every matching store, not just the current page, and includes
source version, date range, filters, search and status metadata. Version changes
block download until refresh; disconnected views discard pending exports. Roster
and store export share the same lazy, local ExcelJS loader. No additional backend
endpoint, permission, report calculation or Orders behavior is introduced.

## Franchise Insights Reference

The isolated Orders presentation follows the local reference supplied by the user:
`C:/Users/PC/Downloads/CODES/Sales-Insights-master/Sales-Insights-master/Sales Insights Dashboard.dc.html`.
Only its visual conventions are used: fixed navigation, compact filter styling,
Poppins typography, orange/blue accents, left-accent KPI tiles and chart/table
styling. No DC runtime, authentication overlay, Microsoft script, Sales Insights
API, source data, revenue labels, year-on-year comparison or unsupported report
dimension was copied. The existing seven Geo report sections are the sidebar tabs;
Geo filters remain top selectors, with Manager/Banner first and dates by the period.

The Overview keeps four KPI columns and the fifth card below. Other views use a
compact horizontally scrollable five-KPI row. The read-only Geo calculations,
filter payloads, cancellation handling, currency semantics, client/brand mappings,
exports and click-through selection handlers are unchanged. Existing chart
coordinates now have an Insights-style line overlay; missing values break the
line, single records remain single points, and no smoothed or invented values are
added. Transparent hit areas retain mouse/keyboard source drilldowns. Local cache
reuse between tabs is retained. No backend, data import, permission or original
Nexus source is changed. The mobile drawer traps focus while open, closes on Escape
or selection and cannot obscure the page after navigation.

## Clients and Loading

Franchise Orders maps the product master's `Brand` column to both **Clients**
and **Brand**: they represent the same client, including approved SKU mappings.
Both filters, displayed columns and exported columns use that mapped value.
Retail Banner stays separate. The original transaction Brand is preserved as
`sourceBrand` in the read model; source transaction documents are not modified.
The source is **Nexus Resources > Meridian Product Master > Geo Product Order
Master**. Update that resource rather than creating a different record; the data
service follows its current storage path and modification time. The workbook must
retain a `Products` worksheet and the Product Name, Brand and SKU Code columns.

Only exact product identifiers or a unique normalized product name are matched.
Ambiguous/missing identities remain `Unmapped client`; no fuzzy allocation is made.
The user's approved aQuelle mappings for SKUs `6009612472391` and `6009612472421`
are recorded separately from the original workbook. Future exact master entries
take precedence. The workbook is private and is not packaged with the public site;
the viewer service has read-only access to its specific Resources folder only.
Attendance has no product-level client attribution, so it does not invent a
Clients filter. Existing source-dependent attendance filters remain unchanged.

Browser report caching is memory-only (12 entries, 16 MiB), keyed by every filter
and attendance audience. Matching results are fresh for 45 seconds; matching
stale results up to five minutes old can display while the latest report loads.
Tab switches reuse the current report without repeated data calls. Page reloads
discard that browser cache. Refresh bypasses report/source caches; it does not
run a new Geo Rep extraction. Drilldowns and exports still use server validation.
API responses retain `no-store` and are compressed. A small non-blocking status
indicator reports fetch progress/failure; it cannot intercept navigation clicks.
First loads still depend on the retained data service and can take several seconds.

## Public Access

The user has approved no-login access to real attendance and order records. Anyone
with internet access can read and export them. Noindex is not access control.
Disabling this host cannot recall exports or disable the existing public source.

Only two read-only POST API routes and the GET health route are forwarded. There
are no imports, uploads, admin operations or credential forwarding. Requests and
responses are bounded; redirects are rejected; each IP has a request limit. The
proxy coalesces identical requests, permits eight different requests in flight,
and serves successful non-export/non-refresh results from memory for up to 15
seconds, with 32 entries and 32 MB of serialized payloads. Expired entries are
cleared on the next API request or app restart. No records are stored on disk. These limits are not
a distributed WAF or a billing cap. The upstream viewer's own limits still apply.

`PUBLIC_DASHBOARDS_ENABLED=false` immediately refuses new report reads on this
host, including cached/in-flight results. It does not disable the source website.
`/healthz` checks this host, not report freshness or upstream availability.

## Cost Review

Microsoft's retail API returned Linux B1 in South Africa North at R0.3888/hour on
15 September 2026: approximately R283.82 for 730 hours, before VAT, applicable
network transfer and any other services. Firebase data-service charges continue.
The user accepted the hosting cost on 15 September 2026 and chose no budget-alert
email. No budget or email alert is configured for this edition. Charges continue
until the plan is removed; stopping the web app alone does not remove plan charges.

## Build and Verify

Run the existing `firebase-dashboards` build/tests first when its source changes.
This package validates its output manifest. The shell and report loader live in
`ui/`; shared report-module adaptations live in `firebase-dashboards/scripts/build.cjs`.
The Azure-specific overview/daily hooks and asset allowlist live in `scripts/build.cjs`.
Edit those sources rather than generated `public/` files. The current package
contains 33 static assets and 37 allowlisted ZIP entries.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
node scripts/browser.cjs
node scripts/browser.cjs --daily-only
node scripts/browser.cjs --daily-only --live-data
node scripts/browser.cjs --roster-only
node scripts/browser.cjs --roster-only --live-data
node scripts/browser.cjs --stores-only
node scripts/browser.cjs --stores-only --live-data
node scripts/browser.cjs --orders-only
node scripts/browser.cjs --orders-only --live-data
npm.cmd run package
node scripts/verify-live.cjs https://meridian-field-dashboards.azurewebsites.net
node scripts/verify-clients-live.cjs https://meridian-field-dashboards.azurewebsites.net
node scripts/verify-filters-live.cjs https://meridian-field-dashboards.azurewebsites.net
```

The ZIP includes only verified public assets, this server, package metadata and
the lockfile. Tests, scripts, infrastructure files, secrets and data are excluded.
Use Microsoft Entra deployment authentication; SCM/FTP passwords remain disabled.
After a ZIP deployment that changes the asset manifest, restart the temporary app
and verify every asset hash. Its running process loads the static allowlist at
startup; deployment completion alone does not establish that the new process is ready.
Azure hosting, budget status and tested URLs must be recorded after deployment.
