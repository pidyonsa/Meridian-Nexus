# Azure Dashboard Recovery Migration

## Status

The user explicitly approved the employee-data transfer and temporary operator
upload role with "i approve both" on 21 September 2026. Both report APIs now run
on Azure against the verified private snapshot. There is no Google fallback in
the active mode. Public URLs and the approved report visibility are unchanged.

Live Orders and both Attendance audiences reconciled before and after the approved
B2 upgrade, including latest-day details and Excel exports. Final browser checks
passed: 37 Orders, 22 Daily Attendance, 48 view/navigation and 11 regional/hover
checks. No browser errors were recorded; desktop/mobile screenshots were inspected.
Both public report links are restored on Azure with the source dates below.

This is report serving/data recovery, not a completed scheduled-ingestion migration.
Attendance covers 1-20 September; Orders uses the 21 September 06:01 SAST import.
The requested Salesforce schedule changes remain paused.

## Provisioned Resources

- Subscription: `02b268fe-e01a-453e-b287-eec83ccc0676`.
- Resource group: `rg-meridian-field-dashboards`.
- Storage: `meridianfield730011`, South Africa North, Standard LRS, StorageV2.
- HTTPS and TLS 1.2 enforced; infrastructure encryption enabled.
- Anonymous blob access and shared-key authorization disabled.
- Container: `dashboard-data`, public access off.
- Existing app now has system-assigned managed identity:
  `0306a78d-6923-43ea-9ef4-a0f8739903c4`.
- That identity has Storage Blob Data Reader only on this container.
  Assignment ID: `98bd46a5-fcc7-4276-8fd8-941cb06709ec`.
- Operator `cpillay@meridiangroup.co.za` received temporary container-only Blob
  Data Contributor assignment `a55a7264-a287-4045-8d47-032af08ca225`.
  The assignment was removed after publishing. No shared keys or SAS tokens were used.
- A one-hour, exact-two-object Google source-read grant was removed after export.
- App plan `meridian-field-dashboards-plan` is now B2, one instance, approved by the user.

## Implementation

- `server/azure-reports.cjs` reads a versioned private snapshot using managed
  identity. No Google SDK, credentials or runtime fallback are involved.
- `server/snapshot-data.cjs` supplies the narrow read-only database/storage
  contract expected by the original calculation engine. Snapshots, workbook
  hashes, collection names, chunk counts and response sizes are bounded.
- `scripts/build-data-engine.cjs` copies 11 unchanged calculation/source files
  from the existing backend into the server-only package. This includes the
  established reporting hierarchy; it is never a static/public asset.
- `scripts/export-azure-snapshot.cjs` completed successfully. It selects only
  dashboard source documents and referenced workbooks, checks source revisions
  again to detect racing imports, and creates a checksummed gzip snapshot plus
  `current.json` under ignored `.tmp/azure-dashboard-migration/`.
- All source workbook and ledger data goes into the private snapshot, not the
  application ZIP. The ZIP uses an explicit file allowlist.
- Setting `DASHBOARD_DATA_MODE=azure-snapshot` activates the new path;
  `AZURE_DASHBOARD_CONTAINER_URL` must equal the private container URL.
  Live settings now select `azure-snapshot`; `google-proxy` remains an explicit rollback.
- Snapshot generation swaps are atomic in-process. A failed refresh retains
  the previous checksum-verified generation, marked `refreshFailed`, rather
  than erasing the report or quietly calling Google.
- Imported source dates remain intact. Metadata identifies a verified import
  snapshot; this is not a claim that upstream scheduled imports have migrated.

## Verification

59 tests passed: original host/presentation tests, real XLSX synthetic attendance
for both audiences, exclusions, details, exports, stale-version protection,
Orders recorded zeros/cancellations/filter totals, snapshot integrity checks,
managed identity URL boundaries and no Google fallback. No real employee
payload was used in these new tests.

The export contains 5,135 transaction documents, 4,309 current-import order lines
including cancellations, both attendance sources, approved mappings/config and
two workbooks. Source revisions were checked again before publishing. The optional
attendance store master was absent in the source and was not invented.

Snapshot SHA-256: `4294d0682e355d1d18669d32f12da6a90fa68f37d31cce3e65ac716d77b086b1`.
Size: 2,917,722 compressed bytes; captured at 2026-09-21T13:24:10.804Z.
The immutable blob was downloaded and hash-verified before `current.json` was
published last. Anonymous blob requests are blocked. Private local artifacts
remain in ignored `.tmp/azure-dashboard-migration/`; do not commit or publish them.

Real-data parity checks cover both audiences, exclusions, all regions, latest-day
actual/missed/unknown details, Excel row counts, stale versions, Orders cancelled
lines, full exports, aQuelle and a 12-month selection. Live verification asserts
matching versions/totals and confirms raw data/server files are not public routes.

| Report | Reconciled totals |
| --- | --- |
| Orders, normal selection | 3,681 lines; 229 orders; 16,198 units; amount 2,368,509.69 (currency not supplied) |
| Rep Attendance | 11,047 scheduled; 10,811 attended |
| Merchandiser Attendance | 50,861 scheduled; 47,818 attended |

Evidence: `verification.json` and `live-verification.json` in the private migration directory.
Initial deployment `3ac18801-c5e7-4add-b165-04a7c3b64f0a` completed at 13:32:46 UTC.
Final diagnostic deployment `683b5b4f-5adc-483c-a172-501622c033f9` completed at
14:02:34 UTC: 54 allowlisted files, 1,056,373 bytes; 36 static hashes verified live.
Startup/recycles caused transient 503s; B1 cold report loads were slow and plan
metrics showed high CPU/memory pressure. Subsequent live reconciliation passed;
the approved B2 upgrade adds capacity. Sanitized diagnostics record stage/timing,
not report contents or credentials.

Dependency audit: ExcelJS is pinned to the existing 4.4.0 version. NPM reports
two moderate findings through its uuid dependency (buffer argument checks in
v3/v5/v6). No forced major downgrade or unrelated dependency rewrite was made.

## Release Procedure

1. Completed: explicit payload-transfer and temporary operator-upload approvals.
2. Completed: run the exporter and validate both audiences plus complete Orders chunks.
   Reconcile totals, filtered detail and exports against the unchanged engine.
3. Completed: upload immutable `snapshots/<sha256>.json.gz` privately with Azure login.
   Download and verify its hash before publishing `current.json` last. Never
   include SAS tokens in frontend code, responses, logs or deployment artifacts.
4. Completed: remove temporary Azure upload and Google exact-object read grants.
5. Completed: run `npm test` and `npm run package`; deploy to the existing Azure app.
6. Completed: switch the two non-secret app settings and verify `/api/health`
   identifies `azure-blob-snapshot` and both report APIs return 200 with dates.
7. Completed: final post-B2 Orders and Attendance browser/Excel/filter tests at the unchanged
   URLs, inspect screenshots and verify raw blob anonymous requests fail.
8. Completed: final deployment ID and evidence recorded. Recovery is verified.

Browser evidence is in `azure-field-dashboards/test-results/` under
`orders-reference/live`, `daily-reference/live`, `sidebar-free/live` and
`regional-design/live`. The infrastructure template compiles and preserves
B2, system-assigned identity and Azure data mode; storage/RBAC remain separate
prerequisites. Temporary operator access was rechecked absent after the upgrade.

Rollback: restore `DASHBOARD_DATA_MODE=google-proxy` or redeploy the prior ZIP;
Google is currently unhealthy, so that fallback is operational rollback, not
guaranteed service recovery. No Google data or source files were changed; the
temporary read grant was removed. Scheduled import migration remains separate.
New source imports must be validated and published as new Azure snapshot
generations. Browser Refresh rereads Azure, not Google. Salesforce schedule edits remain paused.
