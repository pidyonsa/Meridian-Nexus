# Franchise Orders Activity and Drilldowns

## Changes

- Five KPI cards use real daily activity bars, with date range and peak-day values. The cards show up to the last 31 recorded dates in the selection. Single, flat, negative, zero and missing observations are not fabricated into a trend.
- Trend supports automatic, daily, Monday-based weekly and monthly aggregation. Period boundaries are clipped to the selected range. Daily KPI series remain daily regardless of the main chart aggregation.
- Every KPI card and number, chart bar, peak, intelligence contribution, status segment, group metric, share, table total and period metric opens the corresponding order lines.
- Drilldowns retain date range, filters, search, cancelled policy and any selected order. Return navigation restores the preceding selection, page and scroll position. Order lines are the first detail content, not below another dashboard.
- Source-line expansion shows all available columns and mapping/status details. Source exceptions can be inspected and combined. Missing dimension values are distinct from a literal source value of "Not supplied".
- The existing filtered CSV export uses the same server-side selection as the detail table. It includes all matching lines up to the existing 10,000-line export limit, rather than just the 50-row page. Summary exports remain clearly labelled as summaries.

## Metric Integrity

Amounts are recorded Geo Rep order values, not recognised sales, delivery or payment. Units remain labelled "Units ordered" because not every imported status establishes processing. Order references are distinct per store; daily or product order counts may overlap. The selected average is calculated from the selected amount and distinct references, not from averages of daily averages. Mixed currencies or incomplete values do not produce fabricated comparable monetary totals. Missing dates do not become confirmed zero-order days.

## Deployment Scope

`scripts/release-franchise-drilldowns.cjs` captures the current live Hosting files and callable source before preparing a release. Only the Franchise orders JS/CSS and their index/service-worker cache references are published to Hosting. The reporting callable replaces only `franchise-orders.js` inside its deployed source archive. Its production authorization, Firestore reader, limits, caching, entry point, dependencies, service configuration and IAM remain unchanged. No source transactions, other functions, security rules or unrelated workspace changes are deployed.

## Verification

- Node tests cover cardinality, null/mixed/negative values, aggregation and exact period reconciliation, nested exceptions, missing fields, pagination/export, validation and fresh authorization checks.
- Isolated full-Nexus Edge tests cover all seven pages, all 35 KPI routes, group numeric cells, period totals, chart keyboard controls, nested order scope, return navigation, scoped export, error recovery and desktop/mobile layouts.
- `scripts/smoke-franchise-drilldowns.cjs` uses a temporary narrowly permitted staff account to verify live bucket and group reconciliation, exports, source exceptions and permission revocation. It deletes that account and profile in `finally`; it does not modify the transaction ledger.
- Release evidence and immutable baseline: `.tmp/franchise-drilldowns-20260911/`.
