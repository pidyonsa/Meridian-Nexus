# No-ETLs Resource Access Repair

## Cause

The deployed endpoints existed. This was not a missing Cloud Function or browser-cache problem.

Cloud Logging showed `meridianEtl` failing with `storage.objects.get` denied for the Nexus runtime service account `730011371323-compute@developer.gserviceaccount.com`. The affected objects were under `portal-resources/`, including the configured Anchor inventory template.

`savePortalResource` used the same identity but converted every metadata-read failure into `not-found`, reporting HTTP 404 even for a Storage permission denial. `meridianEtl` allowed that provider error to escape as HTTP 500.

## Repair

- Added `roles/storage.objectViewer` for the existing runtime identity, conditional on `projects/_/buckets/meridain-nexus.firebasestorage.app/objects/portal-resources/` only.
- No public access, write/delete grant, bucket-wide access or service-account impersonation permission was added. All previous policy bindings were retained.
- Resource saving and ETL reads now distinguish genuinely missing files, denied runtime access and temporary Storage outages. Browser errors no longer expose provider response bodies.
- The worker's existing `roles/run.jobsExecutorWithOverrides` grant remains present. Input snapshot and output-prefix permissions are unchanged.
- No changes to Hosting, Chat, attendance, dashboards, Firebase security rules, shared reference selections, or the ETL worker/container.

Cloud Storage supports object-prefix restrictions through [IAM Conditions](https://docs.cloud.google.com/storage/docs/access-control/iam?authuser=0000). This repair uses the same conditional-binding pattern already present on the bucket.

## Deployment

- `savePortalResource`: `saveportalresource-00003-jef`.
- `meridianEtl`: `meridianetl-00004-ruw`.
- Function runtime settings and IAM verified unchanged.
- Hosting remains `64c5b64c0245ce14`.
- Release tooling and captured evidence: `scripts/repair-etl-resources.cjs` and `.tmp/etl-resource-repair-20260910/`.

## Verification

26 automated tests passed, covering error mapping, admin restrictions, shared references, immutable input generations, download bounds, transformation rules, reconciliation and the inventory template.

Live checks passed on 10 September 2026: existing template access, synthetic workbook upload/save, reference reads, genuine missing-file handling and revoked-Admin rejection. Shared references remained unchanged. Cleanup completed with no failures.

The live smoke test uses a temporary test-only Admin and a synthetic workbook. Duplicate reference selections deliberately stop validation before its configuration-write transaction, proving the runtime can read the files without replacing the real shared references. No production ETL run is started or approved. Synthetic account, workbook and catalogue records are removed afterward; their audit entry is retained.

Service-account impersonation is unavailable to the current CLI identity and was not granted. Runtime access is verified through the real authenticated callable instead.

## User Action

Refresh No-ETLs and retry the failed save/upload. A file whose catalogue save previously failed may need selecting again. This repair does not automatically rerun failed business jobs or approve any outputs.

The supplied Tracking Prevention warnings omitted their URLs, so the exact third-party source cannot be identified from those lines. They do not explain the confirmed server-side Storage denial. Keep browser protections enabled; investigate any remaining browser-specific issue using its full URL and visible symptom.
