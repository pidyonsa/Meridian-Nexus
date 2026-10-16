# Temporary Orders Publisher

This private function connects the already-downloaded Geo Rep transaction report
to the isolated temporary dashboard snapshot. It does not replace the main Nexus
importer or modify its data. Azure hosting still uses the retained Firebase service.

## Schedule

- Existing `retailers/geo-rep-sales-transactions.reportSchedule`: daily 06:00,
  `Africa/Johannesburg`, all seven days.
- Existing downloader: `processExtraction`, unchanged.
- New private function: `refreshPublicFranchiseOrders`, revision
  `refreshpublicfranchiseorders-00001-xin`, one maximum instance, 1 GiB.
- Scheduler: `public-franchise-orders-publisher`, every five minutes, OIDC to the
  function's Cloud Run URL. It also retries failures up to three times.
- The existing automation service account is the only explicitly granted invoker.
  No new project/database/storage grant was required.

The five-minute job checks the scheduled run pointer. It never redownloads from
Geo Rep, accesses portal credentials, or changes the timestamp when no newer
report exists. Reports can become available after 06:00 due to queue/portal latency.

## Safety

The publisher requires a completed matching transaction run, matching report/file
dates, a full month-to-date range, a bounded private uploads path and a verified
checksum. Blank or invalid workbooks are not published. Exact historical store
mappings fill only unambiguous missing dimensions; original Banner is retained.
Client/Brand enrichment remains the viewer's existing product-master responsibility.

Identical product lines are preserved as separate source rows. All chunks are
staged and counted before a transactional pointer update. Source coverage and
download time cannot move backwards. A six-minute lease prevents overlapping work.
Failures release the lease, record status and leave the prior pointer intact.

Writes are limited in code to:

- `publicDashboardOrderImports/{version}/chunks`
- `publicDashboardSources/orders`
- `publicDashboardRefresh/orders`

The runtime still shares the pre-existing automation identity. This is code-level
collection isolation, not a new IAM collection boundary. The public read-only
viewer retains its separate identity. No raw workbook links, emails, delivery
instructions, photos or signatures are added to the public snapshot.

## Build and Verify

Run from the repository root:

```powershell
node firebase-dashboards/scripts/build-refresh.cjs
node --test firebase-dashboards/tests/order-refresh.test.cjs
node scripts/franchise-refresh-20260917.cjs status
```

The build copies the existing tested parser and pinned dependency manifests into
this directory. The date-scoped release script preserves the original schedule
baseline, deploys only this function, and refuses to overwrite an existing publisher
without a reviewed update. It never deploys root Firebase hosting/rules/functions.

Operational evidence is in `.tmp/franchise-refresh-20260917`. Failure status is in
`publicDashboardRefresh/orders` and Cloud Logging. Disable the publisher scheduler
to stop checks; pause the retailer schedule separately to stop downloads. Existing
published data is retained in either case. Original Nexus importer/master access
remains a separate unresolved maintenance issue.
