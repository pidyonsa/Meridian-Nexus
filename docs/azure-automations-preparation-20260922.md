# Original Nexus automations: Azure preparation

## Status and boundaries

Scope update later on September 22: the user requested a full parallel Azure copy,
including admin and all automation, while Firebase continues working. See
`nexus-azure-parallel-copy-20260922.md` for current progress and remaining access
confirmation. The earlier preparation-only record below is historical; no
production cutover or duplicate production writers are authorized.

Prepared only, September 22, 2026. No new infrastructure, roles, secret copies,
business-data transfer, scheduler cutover or production deployment is authorized
or performed by this plan. Google originals remain intact. Keep the working
Monthly import and existing live dashboard services running while preparing.

The September 21 read-only inventory found 127 Cloud Functions and 17 scheduler
jobs. The separately approved Attendance publisher added on September 22 is a
further known workload. These are not a complete inventory of all automations:
per-retailer schedules are stored in Firestore, functions include callable APIs
as well as background workers, and the prior Cloud Run jobs/services discovery
had endpoint/region errors. Inventory must be refreshed before cutover.

The live Azure dashboard is a snapshot-serving deployment, not a migration of
all Nexus automation. Its Attendance publisher still has Google-side upstream
dependencies. The separate `azure-nexus/` prototype explicitly excludes most
original Nexus modules and must not be mistaken for a complete replacement.

## Workload register

| Family | Current functions/jobs to inventory | Proposed Azure responsibility |
| --- | --- | --- |
| Salesforce Attendance | `runScheduledExtractions`, `processExtraction`, source retry, stalled/expired worker recovery | Schedule dispatcher, durable queued worker, per-workbook lock, SharePoint download/write/verification |
| Monthly plan/templates | `runScheduledSalesforceMonthlyAttendancePlanSetup`, `runScheduledSalesforceMonthlyAttendanceBlueprintProvisioning` | Monthly provisioning worker, master version validation, preserved formulas and template identity |
| Geo Rep Attendance | Config-driven 06:00 extraction, derived blueprint jobs, lock/failure recovery, new Azure publisher | Export producer, reconciler and publisher, preserving rep and merchandiser source contracts |
| Geo Rep APIs/Orders | `runScheduledGeoRepOpenApiSync`, sales dashboard import, campaign details, `public-franchise-orders-publisher` | API extraction queues, detail completion checks, atomic snapshot publication |
| Salesforce Display Compliance | File batches, phase-two input reconciliation and references | Dependency-aware queue and scoped workbook workers; preserve separate source policy |
| Stock Fix | `runScheduledStockFixSharePointSync`, pipeline jobs and publishers | SharePoint acquisition, transform jobs, operational approvals and publication |
| Sales Insights | `runScheduledSalesInsightsSnapshot`, pipeline, DuckDB/query service | Versioned dataset build plus query hosting; isolate heavy builds from dashboards |
| Shared ETLs | `meridianEtl`, pipeline tasks, external Cloud Run jobs | Versioned pipeline registry, container workers and completion events |
| Communications/support | Chat reminders, notifications, task alerts, support upload cleanup | Event handlers, scheduled reminders and retention jobs; preserve access and retention rules |
| Control plane | Manual run/retry/cancel, role checks, audit/history, secrets, assistant triggers | Entra-protected API, queue state transitions, audit and secret access |

For every workload record the owner, real trigger, timezone, enabled state,
source/destination IDs, inputs, output validation, worker image, dependencies,
maximum duration, retry policy, permissions, costs and rollback route. Do not
copy raw chat/staff/connection records during this metadata preparation phase.

## Proposed design

1. Keep automation compute separate from the live B2 dashboard plan. Use an
   Azure schedule/control API with queued container workers for long downloads,
   browser automation and workbook transformations. Hosting selection and
   Johannesburg availability/quota need preflight and cost review.
2. Preserve Johannesburg business dates. Container Apps scheduled jobs evaluate
   cron in UTC: 06:00 SAST is `0 4 * * *`; Monthly's existing 09:00 SAST is
   `0 7 * * *`. Preserve the per-retailer configuration and disabled schedules
   rather than turning every inventoried job on. Manual and event-driven runs
   remain available independently. [Microsoft job scheduling documentation](https://learn.microsoft.com/en-us/azure/container-apps/jobs?tabs=azure-cli).
3. Store immutable source versions and verified outputs in private Azure Blob
   containers. Keep queue/run state and idempotency records in an Azure-backed
   transactional store selected after schema and cost review. Replace Firestore
   listeners with explicit queued events, not polling of the old Google database.
4. Use separate managed identities, scoped data access and Key Vault for vendor
   credentials that cannot use federation. Secrets remain separate from business
   snapshots. SharePoint site access needs its own reviewed Entra grant; Azure
   storage access does not automatically grant SharePoint access.
5. Enforce one writer per SharePoint workbook across Daily, Monthly, setup and
   recovery. Use an owned renewable lock, version/ETag preconditions, pre-write
   backup, bounded `423` retry and download-after-upload reconciliation. Never
   forcibly discard a user's lock or retry an older version over newer edits.
   Blob publication should likewise use conditional ETag/lease operations.
   [Microsoft concurrency guidance](https://learn.microsoft.com/en-us/azure/storage/blobs/concurrency-manage).
6. Show source acquisition, workbook update, validation and dashboard publication
   as separate outcomes. Completion means the required output is independently
   verified. Cancellation must synchronize child jobs and deduplication records;
   a cancelled child cannot remain a reusable queued result.

## Attendance-specific gates

- Scheduled Salesforce Daily/Monthly reads must download online from the
  approved SharePoint raw-data folder. A manual run may specify an authorized
  SharePoint item; it must still pass schema, date, hash and version checks.
  Do not introduce a laptop upload or Salesforce MFA bypass into the schedule.
- Select by actual export time and complete-day coverage, not upload time.
  Reject missing, partial, ambiguous or changed inputs; retain last verified
  output and alert the owner. Keep bounded late-export recovery.
- Preserve month-to-yesterday, distinct employee/store/date visits, calendar
  Week 4 on September 21, SmartSell cycle anchoring, channel target overrides
  and target-capped MTD semantics.
- Settle the workbook calculation contract before moving workers. ExcelJS does
  not calculate formulas. The Graph workbook calculate API does **not** support
  application permissions, so moving an app-only credential to Azure is not
  enough. Review an approved delegated Microsoft 365 calculation flow or a
  proven compatible calculation engine; verify formula and pivot fidelity.
  The local desktop Excel audit is not a production automation architecture.
  [Microsoft calculate permissions](https://learn.microsoft.com/en-us/graph/api/workbookapplication-calculate?view=graph-rest-1.0).
- Fix and test legacy summary-tab source/formula issues separately. Do not hide
  them by returning zero for missing cached results or masking every formula error.

## Controlled migration sequence

1. Complete the metadata inventory, including Cloud Run workers, all region
   deployments, per-retailer schedules, event triggers and external producers.
2. Freeze and review exact production source bundles, not the dirty working tree.
   Define Azure infrastructure and dry-run validation with schedules disabled.
3. Obtain implementation/transfer approval, scoped permissions, cost owner and
   regional capacity confirmation. Preparation does not grant these permissions.
4. Test synthetic cases first. With explicit transfer approval, run shadow jobs
   from immutable approved inputs into isolated outputs. Do not write the live
   SharePoint workbook or publish a live dashboard pointer from shadow runs.
5. Require exact source/workbook/output parity, month-boundary tests, missing
   export and file-lock tests, duplicate/cancelled events, retry idempotency,
   cold restart, secret rotation, access denial, alert delivery and restore tests.
6. Cut over one workload family at a time with explicit approval. Disable its old
   trigger, drain active work, record a checkpoint, then enable the Azure trigger.
   Ensure only one writer can operate even when manual requests arrive.
7. Verify at least two scheduled cycles, plus month-boundary coverage for monthly
   jobs. Keep the prior source and last-good output available for rollback.
8. Roll back by stopping Azure writers, checking saved versions, and restoring
   only the prior trigger/checkpoint. Do not automatically overwrite SharePoint
   with an older backup. Remove temporary migration permissions after acceptance.

## Outstanding decisions

- Full Cloud Run/event/per-retailer inventory and dependency graph.
- Proven cloud workbook calculation and legacy summary repair strategy.
- Azure region/quota, infrastructure sizes, state-store choice and charge estimate.
- Workload-specific service identities, SharePoint grants, ownership and alerts.
- Explicit permission to implement and transfer, followed by individual cutover
  approval. No full Nexus data migration has started.
