# Orders Billing Recovery: 21 September 2026

## Status

The Google incident was unresolved after the billing account reopened. The
public portal has since moved to Azure report serving and private Azure data,
removing Google from its serving path. Live reconciliation of Orders and both
Attendance audiences passed at 13:57 UTC, followed by 37 Orders browser checks.
See [Azure migration](azure-dashboard-migration-20260921.md) for post-upgrade
verification, source dates and remaining ingestion work. The evidence below
records the earlier Google recovery attempt, not the current hosting path.

## Evidence

- Original Orders 502 traced to upstream 503 and Cloud Run log message:
  `The request failed because billing is disabled for this project.`
- Account `01611A-E4D3B9-996A37` (Firebase Payment) now reports `open: true`.
- Project `meridain-nexus` reports `billingEnabled: true` on that same account.
- Both direct upstream health and Orders subsequently return HTML 429:
  `The request was aborted because there was no available instance.`
- The viewer revision is Ready, but metrics show zero active and idle instances
  from approximately 12:23 UTC through the latest samples at 12:33 UTC.
- The same error occurs in scheduled extraction, attendance retry and other
  project runtimes. This is not confined to the Azure proxy or Orders UI.
- Recorded memory usage before shutdown was below 23%; no OOM log was found.
- Published regional CPU/memory quotas are 200,000 milliCPU and 400 GiB.
  No quota was changed. The standalone Instances metric has omitted/zero
  entries in some regions; it is not established as the cause for this service.

## Changes and Verification

1. Restarted only the public Google viewer with its exact deployed image digest:
   `sha256:0af4878fc43a1a6e67ef6d54da86a12744b10ba190ffc9a2249f3cc1ef22f97c`.
   New revision: `publicmeridiandashboards-bill-mub7np4y`.
   Restart operation: `f1f76f78-4112-4d38-baf8-012efae8c930`.
   Runtime, identity, traffic, ingress and instance maximums were verified
   unchanged. Exact browser requests and refresh briefly returned 200.
2. Added Azure retries only for non-JSON platform 429/502/503/504 errors.
   Three attempts maximum, common original deadline, Retry-After respected,
   no error caching or raw HTML exposure. All 54 tests passed, including
   recovery, bounded failure, long Retry-After and timeout during backoff.
3. Deployed Azure ZIP `56a12e73-2fc3-4746-9926-dd515b20c7c2`, completed
   12:25:12 UTC, then restarted Azure. Existing static asset hashes match.
   Direct live testing confirms sanitized upstream 429 instead of generic 502.
4. Temporarily set the viewer service minimum to one instance. Provisioning
   did not recover requests. Restored the original `{maxInstanceCount:20}`
   service scaling; revision maximum remains two and minimum remains zero.
   Warm-up operation: `49da9228-f621-4ba0-aa8b-d929c0599c2c`.
5. Full live browser verification did NOT pass following recovery deployment.
   Earlier successful records dated 09:37 UTC belong to the prior release.
   Final fresh browser check at 12:41:15 UTC (14:41 SAST) returned sanitized
   HTTP 429 with no JavaScript page errors. Artifacts are
   `azure-field-dashboards/test-results/orders-reference/live/billing-recovery.json`
   and `billing-recovery.png`. All 54 local tests passed again afterwards.

Local operation/configuration records:
`.tmp/public-dashboard-billing-recovery-20260921/`.
No datasets, IAM changes, database migration, schedule changes or quota increases
were part of this recovery. Requested Daily/Monthly schedule work stays paused.

## Next Checks

- Recheck direct Cloud Run health, Firebase Hosting Orders and Azure Orders
  after billing/service reactivation has propagated.
- If instance provisioning remains blocked, escalate to Google Cloud Billing /
  Cloud Run support for project 730011371323 with the timestamps, revision and
  operation IDs above. Billing is open, but runtime startup remains unavailable.
  Do not unlink/relink billing, raise quotas or move regions speculatively.
- Only mark resolved after real browser requests, refresh, filters and exports
  pass again with the original autoscaling configuration.
