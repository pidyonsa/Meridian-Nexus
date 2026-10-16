# Franchise Order

## Scope

`#franchiseorder` is a native Nexus report. It follows the Poppins typography,
Meridian colours, KPI accents, filters, chart surfaces and tables of
`Sales Insights Dashboard.dc.html`, with order-specific measures. It does not
embed a second application, sidebar or login. Sales Insights is unchanged.

Pages: Executive Overview, Trend Analysis, Regional Performance, Product
Performance, Store Performance, Rep Performance and Order Detail. Sidebar
children are collapsed initially. Mobile filters can be expanded separately.

## Source And Measures

- Read-only `getFranchiseOrderDashboard` callable, using `salesTransactions`
  in Nexus Firestore. This is the existing Geo Rep transaction-report / Open API
  order ledger, not the retail sales dataset used by Insights.
- Existing import jobs are unchanged. Refresh re-reads Firestore; it does not
  download reports or run a new import. Source date and stale-data notices are
  visible. A per-instance source cache lasts at most 60 seconds; manual Refresh
  bypasses it. Permission decisions are never cached.
- Default range is the newest imported ledger month. Date filters allow up to
  366 days. Queries stop at 30,001 lines and reject oversized ranges rather than
  display partial totals. All metrics use the complete selected range, not the
  displayed 50-row page.
- Amount = sum of the recorded line `value`. Units = sum of `quantity`.
  Orders are distinct store-code/name plus order-number pairs. Average order
  amount uses these references and the selected lines, not inferred revenue.
- Cancelled/canceled/void/voided statuses are excluded by default and available
  through an explicit toggle. Processed is not treated as delivered or paid.
- Missing currency is labelled "Not supplied", without an invented Rand symbol.
  Mixed currencies suppress combined monetary totals. Missing amounts suppress
  monetary totals; unknown or invalid dates are excluded with a warning.
- No franchise classification was present in the inspected ledger sample. This
  is an order report named Franchise Order, not a verified franchise-only subset.
  Classification must be supplied through the source/master data before that
  subset can be certified. No client/banner/channel values are fabricated.
- Trend charts show observed dates, not assumed zero-order days. No invented
  year-on-year comparison or synthetic production data is used.
- Region, product, store and rep rows drill into filtered order lines. An order
  reference further filters to its lines. Tables support sorting, paging and
  selectable columns. CSV exports include all filtered lines up to 10,000, with
  spreadsheet formula-prefix protection. Over-limit exports require narrower
  filters. Group breakdowns show the leading 500 groups and disclose their count.

## Access

Root Nexus administrators have access. Standard staff need the separate
`permissions.allowedNavigationIds` value `franchiseorder`, selectable in Admin >
User management > Side-menu access. The report permits the complete order ledger
to those assigned staff; it is not a per-client or rep-row-scoped permission.

The callable rechecks the Firebase Auth user and `adminUsers` profile on each
request, including disabled/revoked accounts, external-client classification and
current grants. Client accounts are denied. No direct browser Firestore reads,
new Firestore rules, Storage permissions or Geo Rep secrets are required.

## Verification And Release

Tests:

```powershell
node --test scripts/tests/franchise-orders.test.cjs scripts/tests/attendance-sharepoint.test.cjs scripts/tests/stockfix-connectivity.test.cjs
node scripts/tests/franchise-orders-browser.cjs
node scripts/tests/meridian-chat-shell.cjs
```

Browser checks use synthetic data and mocked Firebase sessions. They cover all
seven pages, sidebar access, filters, columns, CSV, paging, order drill-down,
desktop and 390/320px mobile screens, error/retry and late responses after logout.
Screenshots are private under `.tmp/franchise-verification/`.

Production release verified on 9 September 2026:

- Hosting version `838e30246cbec694`, app cache `20260909-franchise-order2`,
  service-worker cache `meridian-nexus-v49`. All five reviewed asset bytes match
  production; 52 pre-existing assets remain unchanged.
- Reader revision `getfranchiseorderdashboard-00001-wuk`: 512 MiB, one CPU,
  concurrency 20, maximum three instances, existing Nexus service account.
- `saveAdminUser` revision `saveadminuser-00047-fiv`: one navigation constant
  changed, existing service configuration preserved.
- Signed-out reader and Chat requests return 401. Admin and direct Firestore
  order-list requests return 403. A fresh production browser loads the normal
  Nexus sign-in flow with no page JavaScript errors or anonymous order data.
- 47 unit/regression checks passed, plus the Franchise Order and existing Chat
  shell browser suites. Direct report links remain on Franchise Order after
  staff sign-in; unassigned staff are redirected to permitted workspaces.

`scripts/release-franchise-orders.cjs` stages exact live-source backups, changes
only the `saveAdminUser` navigation constant, and deploys the new reader from
`functions/franchise-entry.js`. The live `getOperationsWorkspace` already passes
stored permissions through; it is not redeployed. Hosting replaces `index.html`,
`app.js`, `service-worker.js` and adds the two `franchise-orders` assets while
preserving other live asset hashes and hosting configuration. Release metadata
and rollback baselines are private under `.tmp/franchise-release/`.

Signed-in production browser testing requires an assigned staff session and is
not simulated with production-created users or forged tokens. No production
order, profile or permission records are created during verification.

Read-only reconciliation on 9 September 2026 examined all 5,135 existing ledger
lines. The default September range contains 428 non-cancelled lines, 22 orders,
2,693 units, 21 stores and a recorded amount of 456,694.34 (currency not supplied).
There are separately 44 cancelled lines with amount 38,287.03. The latest import
timestamp is 3 September 2026 at 04:26:44 UTC. These are source observations, not
static dashboard values, a full-month forecast or certified retail revenue.
